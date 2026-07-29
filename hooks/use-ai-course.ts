'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import {
  aiCourseService,
  type AiGenerationStatusResult,
  type AiOutline,
  type AiOutlineRequest,
  type AiOutlineResult,
  type AiProviderStatus,
  type AiPublishRequest,
} from '@/services/lms'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/** How often to ask Gamma whether the deck is ready, and for how long. */
const POLL_INTERVAL_MS = 4000
const POLL_TIMEOUT_MS = 5 * 60 * 1000

export type AiStep = 'idle' | 'outline' | 'rendering' | 'ready' | 'failed'

export interface AiCourseState {
  providers: AiProviderStatus | null
  providersLoading: boolean

  step: AiStep
  outline: AiOutline | null
  outlinePlainText: string
  model: string | null

  generationId: string | null
  outlineId: number | null
  gammaUrl: string | null
  exportUrl: string | null

  busy: boolean
  error: string | null
  message: string | null
  dismiss: () => void
  reset: () => void

  generateOutline: (payload: AiOutlineRequest) => Promise<{ ok: boolean; message: string }>
  /** Locally edit a slide's text before sending the outline to Gamma. */
  updateOutline: (outline: AiOutline) => void
  generatePresentation: (
    meta?: { course_type?: string; input_fields?: Record<string, unknown> },
  ) => Promise<{ ok: boolean; message: string }>
  publish: (payload: AiPublishRequest) => Promise<{ ok: boolean; message: string }>
}

export function useAiCourse(enabled: boolean): AiCourseState {
  const { user } = useAuth()
  const resolveContext = useCallback(() => getLaravelContext(user), [user])
  const profileName = user?.profileName

  const [providers, setProviders] = useState<AiProviderStatus | null>(null)
  const [providersLoading, setProvidersLoading] = useState(false)

  const [step, setStep] = useState<AiStep>('idle')
  const [outline, setOutline] = useState<AiOutline | null>(null)
  const [outlinePlainText, setOutlinePlainText] = useState('')
  const [model, setModel] = useState<string | null>(null)

  const [generationId, setGenerationId] = useState<string | null>(null)
  const [outlineId, setOutlineId] = useState<number | null>(null)
  const [gammaUrl, setGammaUrl] = useState<string | null>(null)
  const [exportUrl, setExportUrl] = useState<string | null>(null)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Cleared on unmount / reset so a closed sheet stops polling Gamma.
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollStartedAt = useRef<number>(0)

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current)
      pollTimer.current = null
    }
  }, [])

  useEffect(() => stopPolling, [stopPolling])

  useEffect(() => {
    if (!enabled) return

    queueMicrotask(() => {
      const context = resolveContext()
      if (!isLaravelContextReady(context)) return

      setProvidersLoading(true)
      aiCourseService
        .getStatus(context)
        .then((response) => setProviders(response.data ?? null))
        .catch(() => setProviders(null))
        .finally(() => setProvidersLoading(false))
    })
  }, [enabled, resolveContext])

  const reset = useCallback(() => {
    stopPolling()
    setStep('idle')
    setOutline(null)
    setOutlinePlainText('')
    setModel(null)
    setGenerationId(null)
    setOutlineId(null)
    setGammaUrl(null)
    setExportUrl(null)
    setError(null)
    setMessage(null)
    setBusy(false)
  }, [stopPolling])

  const dismiss = useCallback(() => {
    setError(null)
    setMessage(null)
  }, [])

  const generateOutline = useCallback(
    async (payload: AiOutlineRequest) => {
      const context = resolveContext()
      setBusy(true)
      setError(null)
      setMessage(null)

      try {
        const response = await aiCourseService.generateOutline(context, payload, profileName)
        const result: AiOutlineResult = response.data

        setOutline(result.outline)
        setOutlinePlainText(result.plain_text)
        setModel(result.model)
        setStep('outline')

        const ok = `Outline generated with ${result.model} (${result.slide_count} slides).`
        setMessage(ok)
        return { ok: true, message: ok }
      } catch (generateError) {
        const failure = toMessage(generateError, 'Failed to generate the course outline.')
        setError(failure)
        return { ok: false, message: failure }
      } finally {
        setBusy(false)
      }
    },
    [resolveContext, profileName],
  )

  const updateOutline = useCallback((next: AiOutline) => {
    setOutline(next)
  }, [])

  /** Recursive setTimeout rather than setInterval - no overlapping requests. */
  const pollGeneration = useCallback(
    (id: string) => {
      const context = resolveContext()

      const tick = async () => {
        if (Date.now() - pollStartedAt.current > POLL_TIMEOUT_MS) {
          stopPolling()
          setStep('failed')
          setError('The presentation is taking longer than expected. Check Gamma directly.')
          return
        }

        try {
          const response = await aiCourseService.getGenerationStatus(context, id)
          const result: AiGenerationStatusResult = response.data

          if (result.generation_status === 'completed') {
            stopPolling()
            setGammaUrl(result.gamma_url)
            setExportUrl(result.export_url)
            setStep('ready')
            setMessage('Presentation ready.')
            return
          }

          if (result.generation_status === 'failed') {
            stopPolling()
            setStep('failed')
            setError('Gamma could not render this presentation.')
            return
          }

          pollTimer.current = setTimeout(() => void tick(), POLL_INTERVAL_MS)
        } catch (pollError) {
          // A transient poll failure should not kill a render that may still
          // succeed - keep trying until the overall timeout.
          console.error('[ai-course] poll failed', pollError)
          pollTimer.current = setTimeout(() => void tick(), POLL_INTERVAL_MS)
        }
      }

      pollStartedAt.current = Date.now()
      pollTimer.current = setTimeout(() => void tick(), POLL_INTERVAL_MS)
    },
    [resolveContext, stopPolling],
  )

  const generatePresentation = useCallback(
    async (meta?: { course_type?: string; input_fields?: Record<string, unknown> }) => {
      if (!outline) {
        const failure = 'Generate an outline first.'
        setError(failure)
        return { ok: false, message: failure }
      }

      const context = resolveContext()
      setBusy(true)
      setError(null)
      setMessage(null)

      try {
        const response = await aiCourseService.generatePresentation(
          context,
          {
            outline,
            slide_count: outline.slides.length,
            ai_model: model ?? undefined,
            course_type: meta?.course_type,
            input_fields: meta?.input_fields,
          },
          profileName,
        )

        setGenerationId(response.data.generation_id)
        setOutlineId(response.data.outline_id)
        setStep('rendering')
        pollGeneration(response.data.generation_id)

        const ok = 'Building your presentation with Gamma…'
        setMessage(ok)
        return { ok: true, message: ok }
      } catch (presentationError) {
        const failure = toMessage(presentationError, 'Failed to start presentation generation.')
        setError(failure)
        setStep('failed')
        return { ok: false, message: failure }
      } finally {
        setBusy(false)
      }
    },
    [outline, model, resolveContext, profileName, pollGeneration],
  )

  const publish = useCallback(
    async (payload: AiPublishRequest) => {
      if (!outlineId) {
        const failure = 'Generate the presentation before publishing.'
        setError(failure)
        return { ok: false, message: failure }
      }

      const context = resolveContext()
      setBusy(true)
      setError(null)

      try {
        await aiCourseService.publishOutline(context, outlineId, payload, profileName)
        const ok = `"${payload.display_name}" published to the catalog.`
        setMessage(ok)
        return { ok: true, message: ok }
      } catch (publishError) {
        const failure = toMessage(publishError, 'Failed to publish the course.')
        setError(failure)
        return { ok: false, message: failure }
      } finally {
        setBusy(false)
      }
    },
    [outlineId, resolveContext, profileName],
  )

  return {
    providers,
    providersLoading,

    step,
    outline,
    outlinePlainText,
    model,

    generationId,
    outlineId,
    gammaUrl,
    exportUrl,

    busy,
    error,
    message,
    dismiss,
    reset,

    generateOutline,
    updateOutline,
    generatePresentation,
    publish,
  }
}
