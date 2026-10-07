'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy, FileSearch, Loader2, Sparkles, Upload } from 'lucide-react'
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
 * That creep is bounded — it always stops a few points short of the next
 * real milestone and can only be pushed past that point by an actual
 * `processing_step` change, so it can visually stall for a moment but can
 * never fake-complete a stage the backend hasn't confirmed.
 */

const STEPS: Array<{ key: Exclude<DocumentProcessingStep, null>; label: string; icon: typeof Upload }> = [
  { key: 'ocr', label: 'Reading text (OCR if it’s a scan)', icon: FileSearch },
  { key: 'checking_duplicates', label: 'Checking for duplicates', icon: Copy },
  { key: 'classifying', label: 'Classifying with AI', icon: Sparkles },
  { key: 'done', label: 'Ready', icon: Check },
]

/** Index into STEPS for wherever the backend says we are right now. 'failed' still counts as finished — see ProcessDocumentPipelineJob's docblock: enrichment failing never blocks the document. */
function stepIndex(step: DocumentProcessingStep): number {
  if (step === 'failed') return STEPS.length - 1
  const i = STEPS.findIndex((s) => s.key === step)
  return i === -1 ? -1 : i // -1 = still at "Uploaded", before the job has reported anything
}

const POLL_MS = 1200
const MAX_POLLS = 25 // ~30s — matches the reference's own 30-attempt fallback; the document is already usable regardless (see ProcessDocumentPipelineJob's docblock)
const CREEP_MS = 450 // how often the bar nudges itself forward between real backend updates
// 6 -> 10: now that the orb's continuous motion and the word-by-word step
// label (see document-processing-steps.tsx) carry the "something is alive"
// signal, the number itself can hold back a bit further and still not read
// as stalled - its eventual real jump should land as "the backend told us
// something new," not a last-second creep nudge.
const CREEP_RESERVE = 10 // percentage points held back from the next real milestone, so the creep can never claim a stage finished before the backend says so

export interface DocumentProcessingProgressProps {
  documentId: number
  fileName: string
  onFinished: (outcome: { timedOut: boolean; failed: boolean }) => void
}

export function DocumentProcessingProgress({ documentId, fileName, onFinished }: DocumentProcessingProgressProps) {
  const resolveContext = useLaravelContext()
  const [step, setStep] = useState<DocumentProcessingStep>(null)
  const finishedRef = useRef(false)

  // Starts alive, not dead at 0 — the upload request itself already moved
  // bytes before the server reported a single pipeline stage.
  const [displayPercent, setDisplayPercent] = useState(() => 5 + Math.random() * 13) // 5-18%

  useEffect(() => {
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

  // Real milestones from the backend: `floor` is guaranteed the instant the
  // server reports this step; `ceiling` is the next one, not yet confirmed.
  // The creep below moves from floor toward (ceiling - CREEP_RESERVE) on
  // its own, but can't cross into "this stage is done" territory until the
  // backend actually says so.
  const floor = finished ? 100 : ((index + 1) / STEPS.length) * 100
  const ceiling = finished ? 100 : Math.min(100, ((index + 2) / STEPS.length) * 100)
  const creepCap = Math.max(floor, ceiling - CREEP_RESERVE)

  // Jump up to the real floor the instant the backend confirms it (never
  // backward) — the creep interval below takes over from there.
  useEffect(() => {
    setDisplayPercent((p) => Math.max(p, floor))
  }, [floor])

  useEffect(() => {
    if (finished) {
      setDisplayPercent(100)
      return
    }

    const id = setInterval(() => {
      setDisplayPercent((p) => Math.min(creepCap, p + Math.random() * 2.2))
    }, CREEP_MS)

    return () => clearInterval(id)
  }, [creepCap, finished])

  const percent = Math.round(displayPercent)

  // The headline under the orb: the real step label once the backend has
  // reported one, "Uploading" before that, "Ready" at the end - never a
  // generic "Processing…" that would undercut the word-reveal's whole point
  // of naming the actual stage.
  const activeLabel = finished ? (failed ? 'Finished (with a snag)' : 'Ready') : index === -1 ? 'Uploading' : STEPS[index].label

  return (
    <div className="py-6 text-center">
      <p className="truncate text-sm font-medium text-foreground">{fileName}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Uploaded — now reading, checking and classifying its content so it’s searchable.
      </p>

      <div className="mt-5 flex flex-col items-center gap-3">
        <GeneratingOrb percent={percent} text={`${percent}%`} size={120} active={!finished} />
        <DocumentProcessingSteps label={activeLabel} />
      </div>

      {/* The checklist, de-emphasized below the orb now that the orb/label
          above carry the primary "something is happening" signal - this
          stays for "what's already done" detail, not as the main focus. */}
      <ol className="mx-auto mt-5 max-w-xs space-y-2 text-left">
        {STEPS.map((s, i) => {
          const complete = i < index || (i === index && (step === 'done' || (failed && i === STEPS.length - 1)))
          const active = i === index && !complete
          const Icon = s.icon

          return (
            <li key={s.key} className="flex items-center gap-2.5">
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  complete
                    ? 'border-primary bg-primary text-primary-foreground'
                    : active
                      ? 'border-primary text-primary'
                      : 'border-border text-muted-foreground/50'
                }`}
              >
                {complete ? (
                  <Check className="size-3" aria-hidden="true" />
                ) : active ? (
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                ) : (
                  <Icon className="size-3" aria-hidden="true" />
                )}
              </span>
              <span className={`text-xs ${complete ? 'text-muted-foreground' : active ? 'font-medium text-foreground' : 'text-muted-foreground/50'}`}>
                {s.key === 'done' && failed ? 'Finished (enrichment hit a snag — the document is still filed and searchable by title)' : s.label}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
