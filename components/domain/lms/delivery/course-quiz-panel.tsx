'use client'

/**
 * The course quiz, from locked to marked.
 *
 * ── THE THREE STATES THIS PANEL HAS ─────────────────────────────────────────
 *
 *   overview  the card: why it is locked, or what it will ask
 *   sitting   the questions, one card each
 *   result    what was scored, and what it changed
 *
 * The lock reason is never worked out here. `can_start` and `locked_reason`
 * arrive together from the server, decided by the same code that would refuse
 * the start — so the button is never offered and then rejected, and the
 * sentence the learner reads is the true one.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  Award,
  CheckCircle2,
  ClipboardList,
  Clock,
  Loader2,
  Lock,
  RotateCcw,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import {
  lmsQuizService,
  type QuizAnswers,
  type QuizOverview,
  type QuizQuestion,
  type QuizResultResponse,
  type QuizSubmitResponse,
} from '@/services/lms'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/** Options carry authored rich text; strip it rather than render it raw. */
function plain(value: string | null | undefined) {
  return (value ?? '').replace(/<[^>]*>/g, '').trim()
}

export function CourseQuizPanel({
  courseId,
  /** Called after a pass, so the player can re-check the certificate. */
  onPassed,
}: {
  courseId: number
  onPassed?: () => void
}) {
  const { user } = useAuth()

  const [overview, setOverview] = useState<QuizOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [attemptId, setAttemptId] = useState<number | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [answers, setAnswers] = useState<QuizAnswers>({})
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<QuizSubmitResponse | null>(null)
  /**
   * A past attempt, opened for review.
   *
   * The result endpoint existed and had no caller — the same defect as the
   * builder's `load`: a finished server capability the product could not reach.
   * A learner who scored 60% and wants to know WHICH questions they lost had
   * nowhere to look.
   */
  const [review, setReview] = useState<QuizResultResponse | null>(null)
  const [reviewing, setReviewing] = useState<number | null>(null)

  const load = useCallback(async () => {
    const context = getLaravelContext(user)

    if (!isLaravelContextReady(context)) {
      setLoading(false)
      setError('Your session has expired. Sign in again.')
      return
    }

    setLoading(true)

    try {
      const response = await lmsQuizService.overview(context, courseId)
      setOverview(response.data)
      setError(null)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the quiz.'))
    } finally {
      setLoading(false)
    }
  }, [courseId, user])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  const start = async () => {
    const context = getLaravelContext(user)
    if (!isLaravelContextReady(context)) return

    setBusy(true)
    setError(null)

    try {
      const response = await lmsQuizService.start(context, courseId)
      setAttemptId(response.data.attempt_id)
      setQuestions(response.data.questions)
      setAnswers({})
      setResult(null)
    } catch (startError) {
      setError(toMessage(startError, 'Could not start the quiz.'))
    } finally {
      setBusy(false)
    }
  }

  const openReview = async (attemptId: number) => {
    const context = getLaravelContext(user)
    if (!isLaravelContextReady(context)) return

    setReviewing(attemptId)
    setError(null)

    try {
      const response = await lmsQuizService.result(context, attemptId)
      setReview(response.data)
    } catch (reviewError) {
      setError(toMessage(reviewError, 'Could not open that attempt.'))
    } finally {
      setReviewing(null)
    }
  }

  const submit = async () => {
    const context = getLaravelContext(user)
    if (!isLaravelContextReady(context) || attemptId === null) return

    setBusy(true)
    setError(null)

    try {
      const response = await lmsQuizService.submit(context, attemptId, answers)
      setResult(response.data)
      setQuestions([])
      setAttemptId(null)
      await load()
      if (response.data.passed) onPassed?.()
    } catch (submitError) {
      setError(toMessage(submitError, 'Could not submit the quiz.'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <Skeleton className="h-40 rounded-xl" />
  }

  // Most courses have no quiz. Say nothing rather than showing an empty card.
  if (!overview?.has_quiz) {
    return null
  }

  /* ── Reviewing a past attempt ────────────────────────────────────────── */

  if (review) {
    return (
      <Card className="overflow-hidden rounded-xl border-border/80 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold tracking-tight text-foreground">
              Attempt {review.attempt.attempt_no}
            </h3>
            <span className="text-sm font-semibold text-foreground">
              {review.attempt.score} / {review.attempt.max_score}
              {review.attempt.percent !== null && ` · ${Math.round(review.attempt.percent)}%`}
            </span>
          </div>

          <div className="flex flex-col divide-y divide-border/50 rounded-lg border border-border/60">
            {review.responses.map((row) => (
              <div key={row.question_id} className="flex items-start gap-3 px-3 py-2.5">
                {/*
                  * null is NOT wrong. An unmarked answer is one a model could
                  * not reach a verdict on, and showing it as a red cross would
                  * tell the learner they got it wrong when nobody has decided.
                  */}
                {row.is_correct === null ? (
                  <Clock className="mt-0.5 size-4 shrink-0 text-amber-600" />
                ) : row.is_correct ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                )}

                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-sm text-foreground">{plain(row.question_title)}</p>

                  {row.is_correct === null && (
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      Still being marked — not counted as wrong.
                    </p>
                  )}

                  {row.feedback && (
                    <p className="text-xs text-muted-foreground">{row.feedback}</p>
                  )}

                  {/* Only when the paper's author chose to reveal answers. */}
                  {review.show_answers && row.correct_answer && !row.is_correct && (
                    <p className="text-xs text-muted-foreground">
                      Correct answer: {plain(row.correct_answer)}
                    </p>
                  )}
                </div>

                <span className="ml-auto shrink-0 text-xs font-semibold text-muted-foreground">
                  {row.score ?? '—'} / {row.max_score}
                </span>
              </div>
            ))}
          </div>

          {!review.show_answers && (
            <p className="text-[11px] text-muted-foreground">
              This quiz does not reveal its answers, so a retry stays a real test.
            </p>
          )}

          <Button variant="outline" className="self-start" onClick={() => setReview(null)}>
            Back
          </Button>
        </CardContent>
      </Card>
    )
  }

  /* ── Result ──────────────────────────────────────────────────────────── */

  if (result) {
    return (
      <Card className="overflow-hidden rounded-xl border-border/80 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex items-start gap-3">
            {result.passed ? (
              <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-600" />
            ) : (
              <XCircle className="mt-0.5 size-6 shrink-0 text-destructive" />
            )}
            <div className="flex flex-col gap-0.5">
              <h3 className="text-lg font-bold tracking-tight text-foreground">
                {result.passed ? 'Quiz passed' : 'Not passed this time'}
              </h3>
              <p className="text-sm text-muted-foreground">
                You scored {result.score} of {result.max_score} — {Math.round(result.percent)}%
                {result.passing_score !== null && `, and the pass mark is ${result.passing_score}%`}.
              </p>
            </div>
          </div>

          <Progress value={result.percent} className="h-2" />

          <div className="flex flex-col gap-2">
            {/*
              * Say what the result changed. A rating that moves silently is a
              * rating the person finds out about later, on a screen they did
              * not expect it on.
              */}
            {result.ratings_applied > 0 && (
              <p className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <TrendingUp className="size-4 shrink-0" />
                Your competency rating has been updated from this result
                {result.ratings_applied > 1 ? ` (${result.ratings_applied} competencies).` : '.'}
              </p>
            )}

            {result.ratings_proposed > result.ratings_applied && (
              <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                {result.ratings_proposed - result.ratings_applied} rating change
                {result.ratings_proposed - result.ratings_applied > 1 ? 's are' : ' is'} waiting
                for review before it takes effect.
              </p>
            )}

            {/* Unmarked is not zero, and the learner should not think it is. */}
            {result.awaiting_review > 0 && (
              <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                {result.awaiting_review} written answer
                {result.awaiting_review > 1 ? 's are' : ' is'} still being marked. They are not
                counted as wrong — your score may rise once they are marked.
              </p>
            )}

            {result.certificate_available && (
              <p className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
                <Award className="size-4 shrink-0" />
                Your certificate is now available.
              </p>
            )}
          </div>

          <Button variant="outline" className="self-start gap-2" onClick={() => setResult(null)}>
            Back to the course
          </Button>
        </CardContent>
      </Card>
    )
  }

  /* ── Sitting the quiz ────────────────────────────────────────────────── */

  if (attemptId !== null) {
    const answered = questions.filter((question) => {
      const given = answers[question.id]
      return Array.isArray(given) ? given.length > 0 : given !== undefined && given !== ''
    }).length

    return (
      <Card className="overflow-hidden rounded-xl border-border/80 shadow-sm">
        <CardContent className="flex flex-col gap-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-bold tracking-tight text-foreground">
              {overview.paper_name || 'Course quiz'}
            </h3>
            <span className="text-xs font-semibold text-muted-foreground">
              {answered} of {questions.length} answered
            </span>
          </div>

          <Progress value={questions.length ? (answered / questions.length) * 100 : 0} className="h-1.5" />

          <div className="flex flex-col gap-5">
            {questions.map((question, index) => (
              <div key={question.id} className="flex flex-col gap-2.5">
                <p className="text-sm font-semibold text-foreground">
                  <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                  {plain(question.question_title)}
                  <span className="ml-2 text-xs font-medium text-muted-foreground">
                    ({question.points} {question.points === 1 ? 'mark' : 'marks'})
                  </span>
                </p>

                {question.is_written ? (
                  <Textarea
                    rows={3}
                    placeholder="Type your answer"
                    value={typeof answers[question.id] === 'string' ? (answers[question.id] as string) : ''}
                    onChange={(event) =>
                      setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                    }
                  />
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {question.options.map((option) => {
                      const selected = answers[question.id] === option.id

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() =>
                            setAnswers((current) => ({ ...current, [question.id]: option.id }))
                          }
                          className={cn(
                            'flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                            selected
                              ? 'border-primary bg-primary/10 font-semibold text-foreground'
                              : 'border-border/70 text-muted-foreground hover:border-border hover:bg-muted/50',
                          )}
                        >
                          <span
                            className={cn(
                              'flex size-4 shrink-0 items-center justify-center rounded-full border',
                              selected ? 'border-primary' : 'border-muted-foreground/40',
                            )}
                          >
                            {selected && <span className="size-2 rounded-full bg-primary" />}
                          </span>
                          {plain(option.answer)}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {error && <p className="text-xs font-semibold text-destructive">{error}</p>}

          <div className="flex items-center gap-3">
            <Button className="gap-2" disabled={busy} onClick={() => void submit()}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Submit quiz
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setAttemptId(null)
                setQuestions([])
              }}
            >
              Finish later
            </Button>
            {/*
              * Leaving does not burn an attempt — start() returns the open one
              * rather than opening another — so this is safe to offer.
              */}
            <span className="text-[11px] text-muted-foreground">
              Your attempt stays open if you leave.
            </span>
          </div>
        </CardContent>
      </Card>
    )
  }

  /* ── Overview ────────────────────────────────────────────────────────── */

  const locked = !overview.can_start

  return (
    <Card className="overflow-hidden rounded-xl border-border/80 shadow-sm">
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-lg',
              overview.passed
                ? 'bg-emerald-500/10 text-emerald-600'
                : locked
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-primary/10 text-primary',
            )}
          >
            {overview.passed ? (
              <CheckCircle2 className="size-5" />
            ) : locked ? (
              <Lock className="size-5" />
            ) : (
              <ClipboardList className="size-5" />
            )}
          </span>

          <div className="flex flex-col gap-0.5">
            <h3 className="text-base font-bold tracking-tight text-foreground">
              {overview.paper_name || 'Course quiz'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {overview.total_questions} question{overview.total_questions === 1 ? '' : 's'}
              {overview.passing_score !== null && ` · pass mark ${overview.passing_score}%`}
              {overview.max_attempts !== null && ` · ${overview.max_attempts} attempts`}
            </p>
          </div>
        </div>

        {overview.paper_desc && (
          <p className="text-sm text-muted-foreground">{plain(overview.paper_desc)}</p>
        )}

        {overview.passed ? (
          <p className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <Award className="size-4 shrink-0" />
            You passed with {Math.round(overview.best_percent ?? 0)}%. Your certificate is available.
          </p>
        ) : locked ? (
          /* The server's own sentence, not one guessed here. */
          <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
            <Lock className="mt-px size-3.5 shrink-0" />
            {overview.locked_reason}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button className="gap-2" disabled={busy} onClick={() => void start()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ClipboardList className="size-4" />}
              {(overview.attempts_used ?? 0) > 0 ? 'Try again' : 'Start quiz'}
            </Button>

            {overview.time_allowed && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5" /> {overview.time_allowed} minutes
              </span>
            )}

            {overview.attempts_left !== null && overview.attempts_left !== undefined && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <RotateCcw className="size-3.5" /> {overview.attempts_left} attempt
                {overview.attempts_left === 1 ? '' : 's'} left
              </span>
            )}
          </div>
        )}

        {/* Past attempts, so a learner can see they improved. */}
        {(overview.attempts?.length ?? 0) > 0 && (
          <div className="flex flex-col gap-1 border-t border-border/60 pt-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Your attempts
            </p>
            <p className="text-[11px] text-muted-foreground">
              Open one to see which questions you lost.
            </p>
            {overview.attempts?.map((attempt) => {
              const submitted = attempt.status === 'submitted'

              return (
                <button
                  key={attempt.id}
                  type="button"
                  // Only a submitted attempt has anything to review.
                  disabled={!submitted || reviewing !== null}
                  onClick={() => void openReview(attempt.id)}
                  className={cn(
                    'flex items-center justify-between rounded-md px-1.5 py-1 text-xs transition-colors',
                    submitted ? 'hover:bg-muted/60' : 'cursor-default',
                  )}
                >
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    Attempt {attempt.attempt_no}
                    {reviewing === attempt.id && <Loader2 className="size-3 animate-spin" />}
                  </span>
                  <span
                    className={cn(
                      'font-semibold',
                      attempt.passed ? 'text-emerald-600' : 'text-muted-foreground',
                    )}
                  >
                    {attempt.percent === null ? 'In progress' : `${Math.round(attempt.percent)}%`}
                    {attempt.passed ? ' · passed' : attempt.percent !== null ? ' · not passed' : ''}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}
