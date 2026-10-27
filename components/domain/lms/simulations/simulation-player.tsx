'use client'

import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Maximize2, Minimize2, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Button } from '@/components/ui/button'
import {
  SIM_FRAME_SANDBOX,
  answerAssetRequest,
  assetCreditLines,
  createAssetLoader,
  creditKindFor,
  creditsOpenByDefault,
  creditsSummary,
  parseRuntimeMessage,
  postToRuntime,
  runtimeFrameUrl,
  type AssetLoader,
  type AssetModelRef,
  type HostMessage,
} from '@/lib/simulation-host'
import { cn } from '@/lib/utils'
import { describeSimulationError } from '@/hooks/use-simulations'
import { simulationService, type SimulationCard, type SimulationDetail, type SimulationProgress } from '@/services/lms/simulations'

import { ExperimentMark } from './simulation-bits'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface Report {
  status: SimulationProgress['status']
  percent: number
  step: number
  snapshot: unknown
}

/** How long the runtime has to say it is listening before the player gives up and offers a retry. */
const READY_TIMEOUT_MS = 20000
/** Progress is saved at most this often while a learner plays; completing a simulation is saved at once. */
const SAVE_EVERY_MS = 4000
/** The server keeps 4,000 characters of the resume snapshot; anything near that is dropped rather than saved cut in half. */
const MAX_SNAPSHOT_CHARS = 3500

function smallSnapshot(snapshot: unknown): unknown {
  if (snapshot === undefined || snapshot === null) return undefined
  try {
    return JSON.stringify(snapshot).length <= MAX_SNAPSHOT_CHARS ? snapshot : undefined
  } catch {
    return undefined
  }
}

export interface SimulationPlayerOutcome {
  completed: boolean
  /** Settles when the last progress report has been sent (or has failed); a reload of the list should wait for it. It never rejects. */
  saved: Promise<void>
}

/**
 * Plays one simulation, full screen, in the generic runtime.
 *
 * The specification and the learner's saved place are fetched from the API; the runtime is a sandboxed frame (see lib/simulation-host.ts for
 * why that frame has no access to this page and how messages are authenticated) that is sent both once it says it is listening. What it reports
 * back - how far the learner has got, and when they finish - is saved to the learner's own progress row, throttled, and closing the player
 * saves whatever has not gone yet. Progress is what the runtime reports; the server records it and does not verify it.
 */
export function SimulationPlayer({
  simulation,
  onClose,
  onProgress,
}: {
  simulation: SimulationCard
  onClose: (outcome: SimulationPlayerOutcome) => void
  onProgress: (id: number, report: Pick<SimulationProgress, 'status' | 'percent' | 'step'>) => void
}) {
  const id = simulation.id
  const lessonId = String(id)

  const rootRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const [attempt, setAttempt] = useState(0)
  const [detail, setDetail] = useState<SimulationDetail | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [verdict, setVerdict] = useState<{ ok: boolean; issues: string[] } | null>(null)
  const [percent, setPercent] = useState(simulation.progress?.percent ?? 0)
  const [completed, setCompleted] = useState(simulation.progress?.status === 'completed')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [fullscreen, setFullscreen] = useState(false)

  const latest = useRef<Report | null>(null)
  const lastSaved = useRef<Report | null>(null)
  const saveTimer = useRef<number | null>(null)
  const completedHere = useRef(false)
  const mounted = useRef(true)
  const initSentFor = useRef<string | null>(null)
  const onProgressRef = useRef(onProgress)
  useEffect(() => {
    onProgressRef.current = onProgress
  }, [onProgress])
  // The specification the runtime was sent, for the message handler: it decides which 3D model and image files the frame may be given.
  const detailRef = useRef<SimulationDetail | null>(null)
  useEffect(() => {
    detailRef.current = detail
  }, [detail])
  // The files downloaded for this player (up to 3 at a time across all requests). Dropped with it, and closing the player stops a download
  // that is still running. The registered kind of a file (from the credits) sets how much of it may be read: 3 MB for an image, 25 MB for a model.
  const assetLoader = useRef<AssetLoader | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    assetLoader.current = createAssetLoader((sha256) =>
      simulationService.assetFile(id, sha256, { kind: creditKindFor(detailRef.current?.assets, sha256), signal: controller.signal }),
    )
    return () => {
      controller.abort()
      assetLoader.current = null
    }
  }, [id])

  /* ------------------------------------------------------------------ saving */

  const flush = useCallback(async () => {
    const report = latest.current
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    if (!report || report === lastSaved.current) return
    const before = lastSaved.current
    lastSaved.current = report
    if (mounted.current) setSaveState('saving')
    try {
      await simulationService.progress(id, {
        percent: report.percent,
        step: report.step,
        status: report.status,
        result: smallSnapshot(report.snapshot),
      })
      if (mounted.current) setSaveState('saved')
    } catch (err) {
      // Put the old marker back so the next report (or closing) tries again.
      lastSaved.current = before
      if (mounted.current) setSaveState('error')
      console.error('[SimulationPlayer] saving progress failed:', err)
    }
  }, [id])

  const handleProgress = useCallback(
    (type: 'progress' | 'completed', step: number, reported: number, snapshot: unknown) => {
      const done = type === 'completed'
      const report: Report = { status: done ? 'completed' : 'in_progress', percent: done ? 100 : reported, step, snapshot }
      latest.current = report
      setPercent(report.percent)
      if (done) {
        completedHere.current = true
        setCompleted(true)
      }
      onProgressRef.current(id, { status: report.status, percent: report.percent, step })
      if (done) {
        void flush()
      } else if (saveTimer.current === null) {
        saveTimer.current = window.setTimeout(() => void flush(), SAVE_EVERY_MS)
      }
    },
    [id, flush],
  )

  /* ------------------------------------------------- the specification and the frame */

  // Everything is in its starting state on the first mount; `retry` puts it back there before asking for another attempt.
  useEffect(() => {
    let live = true
    simulationService
      .show(id)
      .then((response) => {
        if (live) setDetail(response.data)
      })
      .catch((err) => {
        if (live) setDetailError(describeSimulationError(err, 'The simulation could not be loaded.').message)
      })
    return () => {
      live = false
    }
  }, [id, attempt])

  const retry = useCallback(() => {
    setDetail(null)
    setDetailError(null)
    setReady(false)
    setTimedOut(false)
    setVerdict(null)
    initSentFor.current = null
    setAttempt((n) => n + 1)
  }, [])

  // The runtime has to say it is listening; if it never does (not deployed, blocked), say so instead of spinning for ever.
  useEffect(() => {
    if (ready) return
    const timer = window.setTimeout(() => setTimedOut(true), READY_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [ready, attempt])

  // Hand the runtime the specification as soon as both sides are ready - whichever got there first.
  useEffect(() => {
    if (!ready || !detail) return
    const key = `${attempt}:${detail.id}:${detail.version}`
    if (initSentFor.current === key) return
    initSentFor.current = key
    postToRuntime(frameRef.current, { type: 'init', spec: detail.spec, resume: detail.progress?.snapshot ?? undefined })
  }, [ready, detail, attempt])

  /**
   * The runtime asks for 3D model and image files by hash, in requests of at most 8 and whenever it needs more. Only a hash that the
   * specification this page holds names is fetched (anything else is answered "missing" without a request); at most three downloads run at
   * once for the whole player, so a later request is accepted while an earlier one is still downloading and its files take the next free
   * slots; each file is fetched once; and each answer is its own message, sent as that file arrives. A file's bytes are transferred, not
   * copied - the loader hands out a private copy, so the ones it keeps stay whole. An answer goes only to the window that asked, and only
   * while that frame is still this player's.
   */
  const serveAssets = useCallback((models: AssetModelRef[], asker: Window) => {
    try {
      const reply = (message: HostMessage, transfer?: Transferable[]): boolean => {
        const frame = frameRef.current
        if (!mounted.current || !frame || frame.contentWindow !== asker) return false
        return postToRuntime(frame, message, transfer)
      }
      void answerAssetRequest({
        spec: detailRef.current?.spec,
        assets: detailRef.current?.assets,
        models,
        loader: assetLoader.current,
        reply,
        onFailure: (err) => {
          if (mounted.current) console.warn('[SimulationPlayer] a 3D model or image could not be loaded:', err)
        },
      })
    } catch (err) {
      console.warn('[SimulationPlayer] a request for 3D models or images could not be handled:', err)
    }
  }, [])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const frameWindow = frameRef.current?.contentWindow
      if (!frameWindow || event.source !== frameWindow) return
      const message = parseRuntimeMessage(event.data, lessonId)
      if (!message) return
      if (message.type === 'ready') setReady(true)
      else if (message.type === 'spec') setVerdict({ ok: message.ok, issues: message.issues })
      else if (message.type === 'progress' || message.type === 'completed') {
        handleProgress(message.type, message.step, message.percent, message.snapshot)
      } else if (message.type === 'assets-needed') serveAssets(message.models, frameWindow)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [lessonId, handleProgress, serveAssets])

  /* ------------------------------------------------------------ window behaviour */

  const close = useCallback(() => {
    onClose({ completed: completedHere.current, saved: flush() })
  }, [flush, onClose])

  useEffect(() => {
    mounted.current = true
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // The player is a modal dialog: everything else on the page is made inert while it is open, so Tab from inside the frame cannot land in the
    // gallery behind the overlay (where Enter would open a sheet nobody can see). Only what was not already inert is touched, and given back.
    const inerted: HTMLElement[] = []
    for (const sibling of Array.from(document.body.children)) {
      if (sibling instanceof HTMLElement && sibling !== rootRef.current && !sibling.inert) {
        sibling.inert = true
        inerted.push(sibling)
      }
    }
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      // Escape leaves full screen first (the browser does that itself); only a plain Escape closes the player.
      if (event.key === 'Escape' && !document.fullscreenElement) close()
    }
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFullscreen)
    return () => {
      mounted.current = false
      document.body.style.overflow = overflow
      for (const element of inerted) element.inert = false
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onFullscreen)
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
      opener?.focus?.()
    }
    // close is stable for the life of the player; re-binding it would only churn the listeners
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    else void rootRef.current?.requestFullscreen?.().catch(() => undefined)
  }

  const failed = detailError ?? (timedOut && !ready ? 'The simulation player did not start. It may be blocked or not installed on this site.' : null)
  const unplayable = verdict && !verdict.ok
  const starting = !failed && !unplayable && !verdict?.ok
  const creditLines = failed || unplayable ? [] : assetCreditLines(detail?.assets)

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${simulation.title} simulation`}
      className="fixed inset-0 z-[70] flex flex-col bg-background"
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
        <Button ref={closeRef} variant="ghost" size="sm" onClick={close} className="gap-1.5">
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Simulations</span>
          <span className="sr-only sm:hidden">Back to simulations</span>
        </Button>
        <span className="h-5 w-px bg-border" aria-hidden="true" />
        <ExperimentMark size="sm" />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{simulation.title}</h2>

        <span className="flex items-center gap-3 text-xs text-muted-foreground" aria-live="polite">
          {saveState === 'saving' && (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" aria-hidden="true" /> Saving
            </span>
          )}
          {saveState === 'saved' && <span className="hidden sm:inline">Progress saved</span>}
          {saveState === 'error' && (
            <span className="inline-flex items-center gap-1 text-destructive">
              <AlertTriangle className="size-3" aria-hidden="true" /> Not saved yet
            </span>
          )}
          {completed ? (
            <span className="inline-flex items-center gap-1 font-medium text-success">
              <CheckCircle2 className="size-3.5" aria-hidden="true" /> Completed
            </span>
          ) : (
            <span className="tabular-nums">{percent}%</span>
          )}
        </span>

        <Button variant="ghost" size="icon" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}>
          {fullscreen ? <Minimize2 className="size-4" aria-hidden="true" /> : <Maximize2 className="size-4" aria-hidden="true" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={close} aria-label="Close simulation">
          <X className="size-4" aria-hidden="true" />
        </Button>
      </header>

      <div className="relative min-h-0 flex-1 bg-muted">
        <iframe
          key={attempt}
          ref={frameRef}
          title={`${simulation.title} simulation`}
          src={runtimeFrameUrl({ lessonId })}
          sandbox={SIM_FRAME_SANDBOX}
          className={cn('size-full border-0 bg-background', (failed || unplayable) && 'invisible')}
        />

        {starting && (
          <div className="absolute inset-0 grid place-items-center bg-background" role="status">
            <div className="flex flex-col items-center gap-3 text-center">
              <Loader2 className="size-7 animate-spin text-primary" aria-hidden="true" />
              <p className="text-sm font-medium text-foreground">Loading {simulation.title}…</p>
              <p className="max-w-xs text-xs text-muted-foreground">Setting up the scene. This takes a few seconds the first time.</p>
            </div>
          </div>
        )}

        {(failed || unplayable) && (
          <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-background p-6" role="alert">
            <div className="flex w-full max-w-md flex-col items-center gap-3 text-center">
              <AlertTriangle className="size-8 text-destructive" aria-hidden="true" />
              <h3 className="text-lg font-semibold text-foreground">
                {unplayable ? 'This simulation cannot be played' : 'The simulation could not start'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {unplayable
                  ? 'Its specification has problems. Tell the person who manages simulations for your organisation.'
                  : failed}
              </p>
              {unplayable && verdict.issues.length > 0 && (
                <ul className="max-h-48 w-full list-disc space-y-1 overflow-y-auto rounded-lg border border-border bg-muted/40 py-3 pl-8 pr-4 text-left text-xs text-foreground">
                  {verdict.issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              )}
              <div className="mt-2 flex gap-2">
                {!unplayable && (
                  <Button onClick={retry} className="gap-2">
                    <RefreshCw className="size-4" aria-hidden="true" /> Try again
                  </Button>
                )}
                <Button variant="outline" onClick={close}>
                  Back to simulations
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {creditLines.length > 0 && (
        <details open={creditsOpenByDefault(creditLines.length)} className="shrink-0 border-t border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none hover:text-foreground">{creditsSummary(creditLines.length)}</summary>
          <ul aria-label="3D model and image credits" className="mt-1 flex max-h-40 flex-wrap gap-x-4 gap-y-0.5 overflow-y-auto">
            {creditLines.map((line) => (
              <li key={line.key}>
                {line.text}
                {line.href && (
                  <>
                    {' · '}
                    <a
                      href={line.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={line.name ? `Source of ${line.name}` : undefined}
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      Source
                    </a>
                  </>
                )}
                {line.sourceText && ` · Source: ${line.sourceText}`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>,
    document.body,
  )
}
