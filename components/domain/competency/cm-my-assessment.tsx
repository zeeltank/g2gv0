'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, Clock3 } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, Radio } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { aiAssessmentService, type AiQuestion, type MyTestResult } from '@/services/competency/ai-assessment'
import { CmAssessmentResult } from './cm-assessment-result'

/**
 * THE EMPLOYEE'S ASSESSMENT — the screen the whole AI assessment backend was
 * built for, and the first thing that lets a person actually take a test.
 *
 * SECURITY IS THE ENDPOINT'S SHAPE, NOT THIS COMPONENT'S LOGIC.
 * It calls `mine()` and `submitAnswers()`, NEITHER OF WHICH TAKES A user_id.
 * There is no employee prop, no id in state, and nothing here that could be
 * pointed at another person — the server derives who you are from your token.
 * A client-side scope check would be a suggestion; an absent parameter is not.
 *
 * CORRECT ANSWERS NEVER ARRIVE. The payload carries no correct_option and no
 * model_answer, so they cannot be read out of the network response.
 *
 * BUILT ENTIRELY FROM EXISTING PRIMITIVES: Card, Button, RadioGroup/Radio,
 * Textarea, Progress, EmptyState, Spinner. No new component was created.
 */
export function CmMyAssessment() {
  const { user } = useAuth()
  const [state, setState] = useState<MyTestResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<number, { selected_option?: string; answer_text?: string }>>({})
  /*
   * THE CLOCK IS THE SERVER'S, NOT THIS COMPONENT'S.
   *
   * `secondsLeft` is seeded from what start() returned and then counted down
   * locally so the number moves. It is never the authority: a refresh re-asks
   * the server, and the server measures from `started_at`, so closing the tab
   * does not hand anybody more time.
   */
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [attemptId, setAttemptId] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await aiAssessmentService.mine(getLaravelContext(user))
      setState(res)
      // Seed the form from answers already recorded, so returning to a
      // part-finished test shows what was given rather than a blank page.
      const seeded: Record<number, { selected_option?: string; answer_text?: string }> = {}
      for (const q of res.questions ?? []) {
        if (q.selected_option !== null || q.answer_text !== null) {
          seeded[q.id] = {
            selected_option: q.selected_option ?? undefined,
            answer_text: q.answer_text ?? undefined,
          }
        }
      }
      setDraft(seeded)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your assessment could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  // Opening the test starts the sitting. Doing it here rather than behind a
  // "Begin" button means the clock starts when the questions become readable,
  // which is the honest moment - not when somebody notices a button.
  useEffect(() => {
    const testId = state?.test?.id
    if (!testId || state?.submitted) return
    let active = true
    aiAssessmentService
      .start(Number(testId), getLaravelContext(user))
      .then((res) => {
        if (!active) return
        setAttemptId(res.attempt_id)
        setSecondsLeft(res.seconds_remaining)
      })
      .catch(() => { /* a test with no limit still works; the clock is optional */ })
    return () => { active = false }
  }, [state?.test?.id, state?.submitted, user])

  // One tick a second, and only while there is time to count.
  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) return
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => (current === null ? null : Math.max(0, current - 1)))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [secondsLeft === null])

  /*
   * TIME UP SUBMITS WHAT IS THERE.
   *
   * The alternative - locking the form and making them press a button - loses
   * the answers of anybody who walked away, which punishes them twice.
   */
  useEffect(() => {
    if (secondsLeft === 0 && !saving && state?.questions?.length && !state?.submitted) {
      void submit(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft])

  const answeredNow = useMemo(
    () =>
      Object.values(draft).filter(
        (d) => (d.selected_option ?? '') !== '' || (d.answer_text ?? '').trim() !== '',
      ).length,
    [draft],
  )

  async function submit(final = false) {
    if (!state?.questions?.length) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      // ONLY QUESTIONS THAT WERE ACTUALLY ANSWERED ARE SENT. An untouched
      // question is UNANSWERED, and sending it as an empty string would record
      // a blank answer — which reads as "attempted and left empty" rather than
      // "not reached". Those are different facts.
      const answers = Object.entries(draft)
        .filter(([, d]) => (d.selected_option ?? '') !== '' || (d.answer_text ?? '').trim() !== '')
        .map(([id, d]) => ({
          question_id: Number(id),
          selected_option: d.selected_option ?? null,
          answer_text: d.answer_text ?? null,
        }))

      const res = await aiAssessmentService.submitAnswers(answers, getLaravelContext(user), final)

      // The server's own counts, shown rather than summarised away. `dropped`
      // is never silent: it means a question id was not part of this person's
      // published test.
      setNotice(
        [
          `${res.answers_written} answer(s) recorded`,
          res.auto_scored ? `${res.auto_scored} scored automatically` : null,
          res.awaiting_review ? `${res.awaiting_review} awaiting review` : null,
          res.dropped ? `${res.dropped} not accepted` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      )

      if (final && res.result) {
        /*
         * Marking is asked for SEPARATELY, and only once the answers are
         * already safe. It is an HTTP call to a model with a two-minute
         * timeout; if it is slow, or the account is out of credit, the person
         * still has a submitted assessment and a score for everything that
         * could be marked automatically.
         */
        if (res.result.marking_pending && res.result.attempt_id) {
          setNotice('Submitted. Marking your written answers…')
          try {
            await aiAssessmentService.markMine(res.result.attempt_id, getLaravelContext(user))
          } catch {
            // Left for a person to mark. Never scored zero.
          }
        }
        setShowResult(true)
        return
      }

      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your answers were not saved.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-2 w-full max-w-sm" />
        <div className="flex flex-col gap-3 pt-2">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
    )
  }

  // Straight to the result after submitting, and whenever the server says this
  // sitting is already finished. Re-rendering the paper for a test that has
  // been handed in invites somebody to answer it again into a void.
  if (showResult || state?.submitted) {
    return <CmAssessmentResult onRetake={showResult ? () => { setShowResult(false); void load() } : undefined} />
  }

  // The server distinguishes "no job role" from "nothing published for your
  // role". Both are normal and each has a different fix, so its wording is
  // passed through rather than replaced with one generic message.
  if (!state?.test || state.empty_is_expected) {
    return (
      <EmptyState
        icon={<ClipboardCheck className="size-6 text-muted-foreground" />}
        title="No assessment for you right now"
        description={state?.empty_reason ?? 'Nothing has been published for your job role yet.'}
      />
    )
  }

  const total = state.questions.length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{state.test.title}</h2>
        {state.test.instructions && (
          <p className="text-sm text-muted-foreground">{state.test.instructions}</p>
        )}
        <div className="flex items-center gap-3">
          <Progress value={total ? (answeredNow / total) * 100 : 0} className="max-w-sm" />
          {/* Outstanding is stated, never implied by a score of nothing. */}
          <span className="text-xs tabular-nums text-muted-foreground">
            {answeredNow} of {total} answered · {total - answeredNow} outstanding
          </span>
          {/* Only shown when the test actually has a limit. A clock on an
              untimed test would invent pressure nobody asked for. */}
          {secondsLeft !== null && (
            <span className={cn('ml-auto flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium tabular-nums',
              secondsLeft <= 60 ? 'border-destructive/40 bg-destructive/10 text-destructive'
                : secondsLeft <= 300 ? 'border-warning/40 bg-warning/10 text-warning'
                : 'border-border text-muted-foreground')}>
              <Clock3 className="size-3.5" aria-hidden="true" />
              {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')} left
            </span>
          )}
        </div>
        {secondsLeft !== null && secondsLeft <= 60 && (
          <p className="text-xs text-destructive">
            When the time runs out this submits whatever you have answered. Nothing is lost.
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm">{notice}</p>
      )}

      <div className="flex flex-col gap-3">
        {state.questions.map((q: AiQuestion, index) => (
          <div key={q.id} className="rounded-xl border border-border bg-background p-4">
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium">
                <span className="mr-2 text-xs tabular-nums text-muted-foreground">{index + 1}.</span>
                {q.question_text}
              </p>

              {q.format === 'mcq' && q.options ? (
                <RadioGroup
                  value={draft[q.id]?.selected_option ?? ''}
                  onValueChange={(v) => setDraft((d) => ({ ...d, [q.id]: { selected_option: v } }))}
                >
                  {q.options.map((opt) => (
                    <Radio key={opt} value={opt} label={opt} />
                  ))}
                </RadioGroup>
              ) : (
                <Textarea
                  rows={4}
                  placeholder="Your answer"
                  value={draft[q.id]?.answer_text ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [q.id]: { answer_text: e.target.value } }))}
                />
              )}

              {q.answered_at && (
                <p className="text-xs text-muted-foreground">
                  Previously answered. Changing it replaces your earlier answer.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* TWO ACTIONS, BECAUSE THEY ARE TWO DIFFERENT DECISIONS.
            Save keeps your place. Submit ends the sitting and produces a
            result. Collapsing them into one button means someone saving their
            progress accidentally hands in a half-finished test. */}
        <Button variant="outline" onClick={() => void submit(false)} disabled={saving || answeredNow === 0}>
          {saving ? 'Saving…' : 'Save and continue later'}
        </Button>
        <Button onClick={() => void submit(true)} disabled={saving || answeredNow === 0}>
          {saving ? 'Submitting…' : 'Submit assessment'}
        </Button>
        <p className="text-xs text-muted-foreground">
          {answeredNow < total
            ? `${total - answeredNow} question(s) unanswered — those score nothing, and are not marked wrong.`
            : 'All questions answered.'}{' '}
          Submitting does not change your proficiency level; any rating it suggests is reviewed first.
        </p>
      </div>
    </div>
  )
}
