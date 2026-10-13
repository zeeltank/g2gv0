'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { accountService, type DocumentProcessingStep } from '@/services/account'
import { useLaravelContext } from '@/hooks/use-agentic'
import { GeneratingOrb } from '@/components/ui/generating-orb'
import { DocumentProcessingSteps } from '@/components/domain/documents/document-processing-steps'

/**
 * A REAL staged progress indicator for the upload→enrichment pipeline — not
 * a client-side timed simulation.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS IS HONEST, NOT JUST ANIMATED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The reference this was asked to exceed (LMS K-12's own upload modal) polls
 * a document's `processing_status`, which only ever holds
 * pending/processing/done/failed — three words for "not started", "running
 * (no detail)", "finished". Its "stages" are a single static sentence
 * listing every pipeline step at once, swapped for a different heading
 * exactly once; nothing in it tracks which step is actually running.
 *
 * `ProcessDocumentPipelineJob` writes a real `processing_step` as it moves
 * through the pipeline (ocr → checking_duplicates → classifying → done), so
 * THIS bar fills because the backend said so, not because a timer expired.
 * The OCR step is genuinely skipped in the UI when the document already had
 * extractable text (most PDFs/DOCX/text files) — the bar visibly jumps past
 * it rather than pretending every document goes through every stage.
 *
 * The one part that ISN'T purely backend-driven is the small "creep" added
 * below: the number starts at a random 5-18% instead of a dead 0% (the
 * upload itself already moved bytes before the server reported anything),
 * and nudges forward on its own between polls so it never looks frozen.
 *
 * That creep used to be a hard per-milestone cap (stop a few points short of
 * the next step, freeze there until the backend confirms it) - which is
 * exactly the bug it looked like from the outside: a long queue-worker boot
 * gap (see ProcessDocumentPipelineJob's own docblock) meant the number would
 * climb to that cap and then go completely, visibly dead at whatever number
 * it landed on - 15%, 20%, however far it got before hitting the wall. It's
 * an asymptotic decay toward 99% now instead (`displayPercent + (99 -
 * displayPercent) * CREEP_RATE` on every tick) - the same "approach but
 * never arrive" idea `creepPercent()` in document-batch-upload-progress.tsx
 * already uses for its own per-row bars, just reshaped to restart its
 * approach from a higher floor each time the backend confirms a step rather
 * than running off a single elapsed-time clock. There is always SOME motion
 * on every tick, by construction, for as long as processing runs - it can
 * only ever end by a real `processing_step` floor jump pulling it up (never
 * backward) or by `finished` snapping it to 100, never by silently running
 * out of room the way the old cap did.
 */

const STEPS: Array<{ key: Exclude<DocumentProcessingStep, null>; label: string }> = [
  { key: 'ocr', label: 'Reading text (OCR if it’s a scan)' },
  { key: 'checking_duplicates', label: 'Checking for duplicates' },
  { key: 'classifying', label: 'Classifying with AI' },
  { key: 'done', label: 'Ready' },
]

/** Index into STEPS for wherever the backend says we are right now. 'failed' still counts as finished — see ProcessDocumentPipelineJob's docblock: enrichment failing never blocks the document. */
function stepIndex(step: DocumentProcessingStep): number {
  if (step === 'failed') return STEPS.length - 1
  const i = STEPS.findIndex((s) => s.key === step)
  return i === -1 ? -1 : i // -1 = still at "Uploaded", before the job has reported anything
}

// 1200 -> 500: ProcessDocumentPipelineJob (hp_erp) writes each real step
// (ocr -> checking_duplicates -> classifying -> done) to the row as it goes,
// but for a short/plain-text document the whole duplicate-check-plus-
// classify sequence can finish in well under a second once the worker
// picks the job up - at the old 1200ms interval, the poller's very next
// check would just find 'done' already, having never landed inside that
// narrow window to see (and animate) an intermediate step at all. Polling
// more often doesn't change WHAT is shown, only raises the odds of actually
// observing a real step the backend already reported - still never a timer
// faking progress, see this file's own docblock above. MAX_POLLS raised to
// hold the ~30s overall ceiling.
const POLL_MS = 500
const MAX_POLLS = 60 // ~30s — matches the reference's own 30-attempt fallback; the document is already usable regardless (see ProcessDocumentPipelineJob's docblock)
const CREEP_MS = 450 // how often the bar nudges itself forward between real backend updates
const CREEP_CAP = 99 // never claims done on its own — only `finished` is allowed to reach 100
const CREEP_RATE = 0.045 // fraction of the remaining distance to CREEP_CAP closed on each tick — always a positive step, so it can never go fully still

export interface DocumentProcessingProgressProps {
  /**
   * null for the brief window between the user clicking Upload and the
   * server actually returning the new document's id - see this component's
   * own "WHY documentId CAN BE null" note below. Polling only starts once
   * this becomes a real number.
   */
  documentId: number | null
  fileName: string
  onFinished: (outcome: { timedOut: boolean; failed: boolean }) => void
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY documentId CAN BE null
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The caller mounts this component the INSTANT the user clicks Upload, not
 * after the upload request resolves - otherwise the dialog sits on the
 * dropzone for however long the multipart upload itself takes (a real
 * multi-second gap on an office document) before suddenly jumping to this
 * screen, which read as broken. So `documentId` starts `null` and the orb
 * below is already live (creeping upward exactly as it does once polling
 * starts, since `index === -1` behaves identically whether that's because
 * polling hasn't started yet or because the server hasn't reported a step
 * yet) before the server has even acknowledged the file; the polling effect
 * below simply does nothing until the caller re-renders with a real id, at
 * which point it starts exactly as before.
 */
export function DocumentProcessingProgress({ documentId, fileName, onFinished }: DocumentProcessingProgressProps) {
  const resolveContext = useLaravelContext()
  const [step, setStep] = useState<DocumentProcessingStep>(null)
  const finishedRef = useRef(false)

  // Starts alive, not dead at 0 — the upload request itself already moved
  // bytes before the server reported a single pipeline stage.
  const [displayPercent, setDisplayPercent] = useState(() => 5 + Math.random() * 13) // 5-18%

  useEffect(() => {
    if (documentId === null) return

    let cancelled = false
    let attempts = 0

    const poll = async () => {
      attempts++

      try {
        const response = await accountService.getDocument(resolveContext(), documentId)
        if (cancelled) return

        const nextStep = response.data.processing_step
        setStep(nextStep)

        if (nextStep === 'done' || nextStep === 'failed') {
          finishedRef.current = true
          onFinished({ timedOut: false, failed: nextStep === 'failed' })
          return
        }
      } catch {
        // A missed poll isn't fatal — the next tick tries again. Only
        // running out of attempts ends the wait (see below).
      }

      if (attempts >= MAX_POLLS) {
        if (!finishedRef.current) {
          finishedRef.current = true
          onFinished({ timedOut: true, failed: false })
        }
        return
      }

      if (!cancelled) setTimeout(poll, POLL_MS)
    }

    const first = setTimeout(poll, POLL_MS)

    return () => {
      cancelled = true
      clearTimeout(first)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId])

  const index = stepIndex(step)
  const failed = step === 'failed'
  const finished = step === 'done' || failed

  // A real milestone from the backend — guaranteed the instant the server
  // reports this step. The creep interval below keeps closing the distance
  // to CREEP_CAP on its own between milestones; this only ever pulls the
  // number UP when real progress lands, never down.
  const floor = finished ? 100 : ((index + 1) / STEPS.length) * 100

  useEffect(() => {
    setDisplayPercent((p) => Math.max(p, floor))
  }, [floor])

  useEffect(() => {
    if (finished) {
      setDisplayPercent(100)
      return
    }

    const id = setInterval(() => {
      setDisplayPercent((p) => {
        const next = p + (CREEP_CAP - p) * CREEP_RATE
        return next >= CREEP_CAP - 0.05 ? CREEP_CAP : next
      })
    }, CREEP_MS)

    return () => clearInterval(id)
  }, [finished])

  const percent = Math.round(displayPercent)

  // The headline under the orb: the real step label once the backend has
  // reported one, "Uploading" before that, "Ready" at the end - never a
  // generic "Processing…" that would undercut the roll-in's whole point of
  // naming the actual stage.
  const activeLabel = finished ? (failed ? 'Finished (with a snag)' : 'Ready') : index === -1 ? 'Uploading' : STEPS[index].label

  return (
    <div className="py-6 text-center">
      <p className="truncate text-sm font-medium text-foreground">{fileName}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Uploaded — now reading, checking and classifying its content so it’s searchable.
      </p>

      <div className="mt-5 flex flex-col items-center gap-4">
        <GeneratingOrb percent={percent} text={`${percent}%`} size={220} active={!finished} />
        <DocumentProcessingSteps label={activeLabel} size="lg" />
      </div>

      {/* The checklist, de-emphasized below the orb now that the orb/label
          above carry the primary "something is happening" signal - this
          stays for "what's already done" detail, not as the main focus.
          Centered (not left-aligned), and no badge circle around each
          row's icon any more - just a bare glyph, since a flat bordered
          circle next to the orb's own moving, colorful rendering read as
          mismatched. A spinning Loader2 (plain, no background) marks any
          row that isn't done yet - pending or active alike, so "something
          is turning" is literal and not just implied by text motion; a
          static check replaces it the instant that row finishes. The
          active row's own label gets the vivid looping color treatment
          (DocumentProcessingSteps - see its own docblock) layered on its
          roll-in entrance; a still-pending row's label shimmers in place
          (g2g-text-shimmer); every not-yet-finished row also gently bobs
          as a whole line (g2g-row-float), staggered per row by index so
          the list reads as a soft wave, not everything moving in lockstep. */}
      <ol className="mx-auto mt-6 max-w-sm space-y-3">
        {STEPS.map((s, i) => {
          const complete = i < index || (i === index && (step === 'done' || (failed && i === STEPS.length - 1)))
          const active = i === index && !complete
          const label = s.key === 'done' && failed ? 'Finished (enrichment hit a snag — the document is still filed and searchable by title)' : s.label

          return (
            <li
              key={s.key}
              className={`flex items-center justify-center gap-2.5 ${complete ? '' : 'motion-safe:[animation:g2g-row-float_2.6s_ease-in-out_infinite]'}`}
              style={complete ? undefined : { animationDelay: `${i * 160}ms` }}
            >
              {complete ? (
                <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
              ) : (
                <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
              )}
              {active ? (
                <DocumentProcessingSteps label={label} size="sm" />
              ) : complete ? (
                <span className="text-xs text-muted-foreground">{label}</span>
              ) : (
                <span
                  className="bg-clip-text text-xs text-transparent [background-image:linear-gradient(110deg,var(--muted-foreground)_35%,var(--foreground)_50%,var(--muted-foreground)_65%)] [background-size:250%_100%] motion-safe:[animation:g2g-text-shimmer_2.2s_linear_infinite]"
                >
                  {label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
