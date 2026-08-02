'use client'

/**
 * Build a course from a competency, inside its detail popup.
 *
 * Two steps, deliberately separate:
 *   1. DeepSeek drafts an outline from the competency's own context.
 *   2. Once a human has read it, Gamma renders it to slides.
 *
 * The review step in the middle is the point — slide rendering costs credits
 * and takes minutes, so committing to it before anyone has looked at the
 * outline wastes both. The previous app went straight from prompt to slides.
 *
 * Both calls are server-side (`/lms/ai/*`). The old frontend held an OpenRouter
 * key in the browser bundle; here the key stays on the backend and the model is
 * config, so swapping it is not a frontend release.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, ExternalLink, FileText, Loader2, Presentation, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { isLaravelContextReady } from '@/lib/laravel-context'
import { useLaravelContext } from '@/hooks/use-agentic'
import { courseBuilderService } from '@/services/competency/course-builder'
import type { AiStatus, CourseOutline, OutlineResult } from '@/services/competency/course-builder'
import type { SkillDetailResponse } from '@/services/competency/skill-detail'

interface CourseBuilderPanelProps {
  /** Rich skill payload when the row is a skill; null for every other tab. */
  data: SkillDetailResponse | null
  title: string
  /**
   * The row itself. Non-skill libraries have no proficiency levels or mapped
   * roles, so their prompt is built from the row's own columns instead.
   */
  record?: Record<string, unknown>
}

/** How often to ask Gamma whether the render has finished. */
const POLL_INTERVAL_MS = 5000
/** Give up after this long rather than polling forever on a stuck render. */
const POLL_LIMIT = 60

export function CourseBuilderPanel({ data, title, record }: CourseBuilderPanelProps) {
  const resolveContext = useLaravelContext()

  const [status, setStatus] = useState<AiStatus | null>(null)
  const [slideCount, setSlideCount] = useState(10)
  const [courseTitle, setCourseTitle] = useState(title)

  const [outline, setOutline] = useState<OutlineResult | null>(null)
  const [drafting, setDrafting] = useState(false)
  const [rendering, setRendering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [slidesUrl, setSlidesUrl] = useState<{ gamma: string | null; export: string | null } | null>(null)
  const [progress, setProgress] = useState<string | null>(null)

  // Cleared on unmount so a poll cannot outlive the popup.
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [])

  const loadStatus = useCallback(async () => {
    const context = resolveContext()
    if (!isLaravelContextReady(context)) return

    try {
      const response = await courseBuilderService.status(context)
      setStatus(response.data)
    } catch {
      // Not fatal: the generate button reports the real reason when pressed.
    }
  }, [resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      loadStatus()
    })
  }, [loadStatus])

  /** The competency's own context, which is what makes the outline specific. */
  const buildRequest = () => {
    const skill = (data?.editData ?? record ?? {}) as Record<string, unknown>
    const roles = data?.userJobroleData ?? []

    // The highest level defined is the one worth training to.
    const levels = (data?.userproficiency_levelData ?? [])
      .map((item) => item.proficiency_level)
      .filter((level): level is string => Boolean(level))

    const topLevel = levels.sort((a, b) => Number(b) - Number(a))[0]

    return {
      course_title: courseTitle.trim() || title,
      job_role: roles[0]?.jobrole ?? undefined,
      department: (skill.department as string) || undefined,
      industry: roles[0]?.sector ?? undefined,
      skills: [title],
      proficiency: topLevel ? `Level ${topLevel}` : undefined,
      // Applications describe what someone does with the competency, which is
      // closer to a task list than the knowledge items are.
      tasks: (data?.userApplicationData ?? [])
        .map((item) => item.classification_item)
        .filter((item): item is string => Boolean(item))
        .slice(0, 12),
      slide_count: slideCount,
    }
  }

  const draftOutline = async () => {
    const context = resolveContext()
    if (!isLaravelContextReady(context)) return

    setDrafting(true)
    setError(null)
    setSlidesUrl(null)

    try {
      const response = await courseBuilderService.generateOutline(context, buildRequest())
      setOutline(response.data)
    } catch (draftError) {
      setError(draftError instanceof Error ? draftError.message : 'Could not generate the outline.')
    } finally {
      setDrafting(false)
    }
  }

  const renderSlides = async () => {
    const context = resolveContext()
    if (!isLaravelContextReady(context) || !outline) return

    setRendering(true)
    setError(null)
    setProgress('Sending the outline to Gamma…')

    try {
      const started = await courseBuilderService.generatePresentation(
        context,
        outline.outline as CourseOutline,
        slideCount,
      )

      let attempts = 0

      const poll = async () => {
        attempts += 1

        if (attempts > POLL_LIMIT) {
          setProgress(null)
          setRendering(false)
          setError('The slide render is taking longer than expected. Check back from the LMS shortly.')
          return
        }

        try {
          const check = await courseBuilderService.presentationStatus(context, started.data.generation_id)
          const state = check.data.generation_status

          if (state === 'completed') {
            setSlidesUrl({ gamma: check.data.gamma_url, export: check.data.export_url })
            setProgress(null)
            setRendering(false)
            return
          }

          if (state === 'failed') {
            setProgress(null)
            setRendering(false)
            setError('Gamma could not render these slides.')
            return
          }

          setProgress(`Rendering slides… (${attempts})`)
          pollRef.current = setTimeout(poll, POLL_INTERVAL_MS)
        } catch (pollError) {
          setProgress(null)
          setRendering(false)
          setError(pollError instanceof Error ? pollError.message : 'Lost contact while rendering.')
        }
      }

      pollRef.current = setTimeout(poll, POLL_INTERVAL_MS)
    } catch (renderError) {
      setProgress(null)
      setRendering(false)
      setError(renderError instanceof Error ? renderError.message : 'Could not start the slide render.')
    }
  }

  const slides = outline?.outline?.slides ?? []

  return (
    <div className="space-y-4">
      {/* Provider state, so a missing key is visible before pressing anything. */}
      {status && (!status.deepseek_configured || !status.gamma_configured) && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
            {!status.deepseek_configured && 'Outline generation is not configured. '}
            {!status.gamma_configured && 'Slide rendering is not configured. '}
            An administrator needs to add the API key.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2 sm:col-span-2">
          <label className="text-sm font-semibold text-foreground" htmlFor="course-title">
            Course Title
          </label>
          <Input
            id="course-title"
            value={courseTitle}
            onChange={(event) => setCourseTitle(event.target.value)}
            className="border-border bg-background"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground" htmlFor="course-slides">
            Slides
          </label>
          <Input
            id="course-slides"
            type="number"
            min={3}
            max={40}
            value={slideCount}
            onChange={(event) => setSlideCount(Number(event.target.value))}
            className="border-border bg-background"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        The outline is written from this competency&apos;s own mapped role, proficiency levels and applications
        {status?.deepseek_model ? ` using ${status.deepseek_model}` : ''}.
      </p>

      <Button
        onClick={draftOutline}
        disabled={drafting || rendering || status?.deepseek_configured === false}
        className="h-10 w-full gap-2 rounded-xl font-bold"
      >
        {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {drafting ? 'Writing the outline…' : outline ? 'Regenerate outline' : 'Generate course outline'}
      </Button>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm font-medium text-destructive">{error}</p>
        </div>
      )}

      {/* Review before spending render credits. */}
      {outline && (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-bold text-foreground">
                {outline.outline.course_title || courseTitle}
              </p>
            </div>
            <span className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {outline.slide_count} slides · {outline.model}
            </span>
          </div>

          {outline.outline.summary && (
            <p className="text-sm leading-relaxed text-muted-foreground">{outline.outline.summary}</p>
          )}

          {(outline.outline.learning_objectives?.length ?? 0) > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Learning Objectives
              </p>
              <ul className="space-y-1">
                {outline.outline.learning_objectives?.map((objective, index) => (
                  <li key={index} className="flex gap-2 text-sm text-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{objective}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ol className="space-y-2">
            {slides.map((slide, index) => (
              <li key={index} className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="flex gap-2 text-sm font-semibold text-foreground">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                    {index + 1}
                  </span>
                  {slide.title}
                </p>
                {(slide.bullets?.length ?? 0) > 0 && (
                  <ul className="mt-1.5 space-y-0.5 pl-7">
                    {slide.bullets?.map((bullet, bulletIndex) => (
                      <li key={bulletIndex} className="text-xs text-muted-foreground">
                        · {bullet}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>

          <Button
            onClick={renderSlides}
            disabled={rendering || status?.gamma_configured === false}
            className="h-10 w-full gap-2 rounded-xl font-bold"
          >
            {rendering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Presentation className="h-4 w-4" />}
            {rendering ? (progress ?? 'Rendering…') : 'Create slides from this outline'}
          </Button>
        </div>
      )}

      {slidesUrl && (
        <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-4">
          <p className="text-sm font-bold text-foreground">Slides are ready.</p>
          <div className="flex flex-wrap gap-2">
            {slidesUrl.gamma && (
              <Button
                variant="outline"
                onClick={() => window.open(slidesUrl.gamma!, '_blank', 'noopener,noreferrer')}
                className="h-9 gap-2 rounded-lg font-semibold"
              >
                <ExternalLink className="h-4 w-4" /> Open presentation
              </Button>
            )}
            {slidesUrl.export && (
              <Button
                variant="outline"
                onClick={() => window.open(slidesUrl.export!, '_blank', 'noopener,noreferrer')}
                className={cn('h-9 gap-2 rounded-lg font-semibold')}
              >
                <FileText className="h-4 w-4" /> Download
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
