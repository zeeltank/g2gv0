'use client'

import { useCallback, useEffect, useRef, useState, use } from 'react'
import { Link2Off, CheckCircle2, ShieldCheck, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AssessmentPaper,
  type PaperAnswer,
  type PaperQuestion,
} from '@/components/domain/competency/assessment-paper'
import {
  assessmentApi,
  CareersError,
  formatDeadline,
  type CandidateAssessment,
} from '@/lib/careers-api'

/**
 * A candidate sitting their own assessment. Public: no account, no login.
 *
 * `/assessment` is a top-level segment, so `proxy.ts`'s protected-route list
 * never guards it (that list is allow-by-default and names only /dashboard,
 * /organization, /profile, /settings and /module). The page mounts neither
 * GtgAppShell nor GtgPageShell — both require a Laravel token a candidate does
 * not have. This mirrors app/offer/[token]/page.tsx exactly, on purpose.
 *
 * ── ONE ERROR BRANCH, DELIBERATELY ──────────────────────────────────────────
 *
 * Unknown, expired and already-used all arrive as 410 carrying a sentence
 * written for a person. This page prints that sentence and never branches on
 * `reason` — branching would let someone with a guessed token tell "wrong" from
 * "expired", which is exactly what the uniform response prevents.
 *
 * ── WHY ANSWERS SAVE AS YOU GO ──────────────────────────────────────────────
 *
 * A written or coding answer takes minutes to type. The autosave is debounced
 * per question, so a dropped connection or a closed lid costs the sentence in
 * progress rather than the sitting. Submit is separate and final: it burns the
 * link, and the page says so before it is pressed.
 */
export default function CandidateAssessmentPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)

  const [paper, setPaper] = useState<CandidateAssessment | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [answers, setAnswers] = useState<Record<number, PaperAnswer>>({})
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  /*
   * Debounce timers, one per question, held in a ref rather than state.
   * In state, every keystroke would re-render the whole paper to store a
   * timer id nothing renders.
   */
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    let cancelled = false
    assessmentApi
      .show(token)
      .then((data) => {
        if (cancelled) return
        setPaper(data)
        setLoadError(null)
        // Seed from what the server already holds, so reopening the link
        // restores the sitting rather than showing a blank paper.
        const seeded: Record<number, PaperAnswer> = {}
        for (const q of data.questions) {
          if (q.answer) {
            seeded[q.id] = q.format === 'mcq' ? { selectedOption: q.answer } : { text: q.answer }
          }
        }
        setAnswers(seeded)
      })
      .catch((cause) => {
        if (cancelled) return
        setLoadError(cause instanceof Error ? cause.message : 'This link could not be opened.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  // Every pending timer is cleared on unmount, or a save fires against a
  // component that no longer exists after the candidate navigates away.
  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const id of Object.values(pending)) clearTimeout(id)
    }
  }, [])

  const persist = useCallback(
    async (questionId: number, value: PaperAnswer) => {
      setSaveState('saving')
      try {
        await assessmentApi.saveAnswer(token, questionId, {
          answer: value.text,
          selected_option: value.selectedOption,
        })
        setSaveState('saved')
      } catch {
        // Not fatal and not shouted about: the answer is still in the field,
        // and submit sends everything again. Saying "saved" when it was not
        // would be the actual harm.
        setSaveState('error')
      }
    },
    [token],
  )

  const onAnswer = useCallback(
    (questionId: number, value: PaperAnswer) => {
      setAnswers((prev) => ({ ...prev, [questionId]: value }))

      clearTimeout(timers.current[questionId])
      // An MCQ is one click and final, so it saves at once. Typing waits, or
      // every keystroke is a request.
      const delay = value.selectedOption !== undefined ? 0 : 900
      timers.current[questionId] = setTimeout(() => void persist(questionId, value), delay)
    },
    [persist],
  )

  async function submit() {
    if (!paper) return
    setFormError(null)
    setSubmitting(true)
    try {
      // Flush anything still waiting on a debounce, so the last sentence
      // typed is never lost to the submit that follows it.
      for (const [id, timer] of Object.entries(timers.current)) {
        clearTimeout(timer)
        const qid = Number(id)
        if (answers[qid]) await persist(qid, answers[qid])
      }
      const result = await assessmentApi.submit(token)
      setDone(result.message)
    } catch (cause) {
      setFormError(
        cause instanceof CareersError
          ? cause.message
          : 'Your answers could not be submitted. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const questions: PaperQuestion[] = (paper?.questions ?? []).map((q) => ({
    id: q.id,
    format: q.format,
    text: q.question,
    options: q.options,
    maxScore: q.max_score,
    previouslyAnswered: Boolean(q.answer),
  }))

  const answeredCount = questions.filter((q) => {
    const a = answers[q.id]
    return Boolean(a?.selectedOption || a?.text?.trim())
  }).length

  return (
    <div className="@container/assessment mx-auto w-full max-w-3xl px-4 py-10 @2xl/assessment:px-6 @2xl/assessment:py-16">
      {loading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-24 rounded-xl bg-muted/50" />
          <div className="h-40 rounded-xl bg-muted/50" />
          <div className="h-40 rounded-xl bg-muted/50" />
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-background px-6 py-12 text-center">
          <Link2Off className="size-8 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-lg font-semibold">This link cannot be opened</h1>
          {/* The backend's sentence, verbatim. The page does not know or care
              whether it was unknown, expired or already used. */}
          <p className="max-w-md text-sm text-muted-foreground">{loadError}</p>
        </div>
      ) : done ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-success/40 bg-success/5 px-6 py-12 text-center">
          <CheckCircle2 className="size-8 text-success" aria-hidden="true" />
          <h1 className="text-lg font-semibold">Your answers are in</h1>
          <p className="max-w-md text-sm text-muted-foreground">{done}</p>
          <p className="max-w-md text-xs text-muted-foreground">
            You can close this page. The link will not open again.
          </p>
        </div>
      ) : paper ? (
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-1">
            {paper.organisation && (
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {paper.organisation}
              </p>
            )}
            <h1 className="text-xl font-semibold">
              {paper.candidate_name ? `${paper.candidate_name}, here is your assessment` : 'Your assessment'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {paper.total_marks} marks in total
              {paper.time_limit_minutes ? ` · about ${paper.time_limit_minutes} minutes` : ''}
              {paper.expires_at ? ` · open until ${formatDeadline(paper.expires_at)}` : ''}
            </p>
          </header>

          <AssessmentPaper
            title={paper.title ?? 'Assessment'}
            instructions={paper.instructions}
            questions={questions}
            answers={answers}
            onAnswer={onAnswer}
            /* Untimed from this page's point of view: the limit is guidance
               shown in the header, and nothing is auto-submitted. A countdown
               that discarded a candidate's work on an unauthenticated link,
               with no way to appeal, is not a trade worth making. */
            secondsLeft={null}
            disabled={submitting}
          />

          {formError && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          )}

          <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
              Your answers save as you type. You can close this page and come back to the same
              link — until you submit.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => void submit()} disabled={submitting || answeredCount === 0}>
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Submitting…
                  </>
                ) : (
                  'Submit assessment'
                )}
              </Button>

              <span className="text-xs text-muted-foreground" aria-live="polite">
                {saveState === 'saving'
                  ? 'Saving…'
                  : saveState === 'saved'
                    ? 'Saved'
                    : saveState === 'error'
                      ? 'Not saved yet — your answers are still here and will be sent when you submit.'
                      : ''}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              {answeredCount < questions.length
                ? `${questions.length - answeredCount} question(s) unanswered — those score nothing, and are not marked wrong.`
                : 'All questions answered.'}{' '}
              Submitting is final and the link will not open again.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
