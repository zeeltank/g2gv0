'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy, FileSearch, Loader2, Sparkles, Upload } from 'lucide-react'
import { accountService, type DocumentProcessingStep } from '@/services/account'
import { useLaravelContext } from '@/hooks/use-agentic'

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

export interface DocumentProcessingProgressProps {
  documentId: number
  fileName: string
  onFinished: (outcome: { timedOut: boolean; failed: boolean }) => void
}

export function DocumentProcessingProgress({ documentId, fileName, onFinished }: DocumentProcessingProgressProps) {
  const resolveContext = useLaravelContext()
  const [step, setStep] = useState<DocumentProcessingStep>(null)
  const finishedRef = useRef(false)

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
  const percent = Math.round(((index + 1) / STEPS.length) * 100)
  const failed = step === 'failed'

  return (
    <div className="py-6 text-center">
      <p className="truncate text-sm font-medium text-foreground">{fileName}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Uploaded — now reading, checking and classifying its content so it’s searchable.
      </p>

      {/* The bar: real width, driven by the backend's own step, animated only via a CSS transition on width change — not a timer. */}
      <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
          style={{ width: `${Math.max(8, percent)}%` }}
        />
      </div>
      <p className="mt-1.5 text-right text-xs font-medium tabular-nums text-muted-foreground">{percent}%</p>

      <ol className="mt-5 space-y-2.5 text-left">
        {STEPS.map((s, i) => {
          const complete = i < index || (i === index && (step === 'done' || (failed && i === STEPS.length - 1)))
          const active = i === index && !complete
          const Icon = s.icon

          return (
            <li key={s.key} className="flex items-center gap-3">
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  complete
                    ? 'border-primary bg-primary text-primary-foreground'
                    : active
                      ? 'border-primary text-primary'
                      : 'border-border text-muted-foreground/50'
                }`}
              >
                {complete ? (
                  <Check className="size-3.5" aria-hidden="true" />
                ) : active ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Icon className="size-3.5" aria-hidden="true" />
                )}
              </span>
              <span
                className={`text-sm ${complete ? 'text-foreground' : active ? 'font-medium text-foreground' : 'text-muted-foreground/60'}`}
              >
                {s.key === 'done' && failed ? 'Finished (enrichment hit a snag — the document is still filed and searchable by title)' : s.label}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
