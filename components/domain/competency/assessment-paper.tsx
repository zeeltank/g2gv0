'use client'

import { Clock3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, Radio } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'

/**
 * The paper itself — questions, progress, the clock. Presentational only.
 *
 * ── WHY THIS WAS EXTRACTED RATHER THAN WRITTEN TWICE ────────────────────────
 *
 * Two audiences sit the same paper: an employee inside the app
 * (`cm-my-assessment.tsx`, authenticated, the test chosen by their job role)
 * and a CANDIDATE on a magic link with no account at all. Their containers
 * cannot be shared — one derives identity from a Sanctum token, the other from
 * a 64-character URL — but the paper is identical, and a second copy would have
 * drifted the way the two MCQ scorers on the backend already had.
 *
 * So the difference lives in the containers and the sameness lives here. This
 * component fetches nothing, knows no user, and holds no state: everything
 * arrives as props.
 *
 * ── RULES THIS ENCODES, WHICH ARE EASY TO LOSE IN A REWRITE ─────────────────
 *
 *   - Outstanding questions are STATED, never implied by a score of nothing.
 *   - The clock renders only when the test actually has a limit. A countdown on
 *     an untimed test invents pressure nobody asked for.
 *   - An unanswered question scores nothing and is NOT marked wrong. Those are
 *     different things and the copy says so.
 *   - `coding` gets a monospace field with spellcheck off. A proportional font
 *     with autocorrect turns a candidate's code into prose while they type it.
 */

export type PaperQuestion = {
  id: number
  /** 'mcq' | 'short_answer' | 'coding'. Widened so a new format renders as prose rather than vanishing. */
  format: string
  text: string
  /** mcq only. */
  options?: string[] | null
  maxScore?: number | null
  /** Shows the "changing it replaces your earlier answer" note. */
  previouslyAnswered?: boolean
}

export type PaperAnswer = { selectedOption?: string; text?: string }

export function AssessmentPaper({
  title,
  instructions,
  questions,
  answers,
  onAnswer,
  secondsLeft = null,
  disabled = false,
  className,
}: {
  title: string
  instructions?: string | null
  questions: PaperQuestion[]
  answers: Record<number, PaperAnswer>
  onAnswer: (questionId: number, value: PaperAnswer) => void
  /** null when the test is untimed — not 0, which would read as "no time left". */
  secondsLeft?: number | null
  disabled?: boolean
  className?: string
}) {
  const total = questions.length
  const answered = questions.filter((q) => {
    const a = answers[q.id]
    return Boolean(a?.selectedOption || a?.text?.trim())
  }).length

  return (
    <div className={cn('@container/paper flex flex-col gap-4', className)}>
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {instructions && <p className="text-sm text-muted-foreground">{instructions}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <Progress value={total ? (answered / total) * 100 : 0} className="max-w-sm" />
          <span className="text-xs tabular-nums text-muted-foreground">
            {answered} of {total} answered · {total - answered} outstanding
          </span>

          {secondsLeft !== null && (
            <span
              className={cn(
                'ml-auto flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium tabular-nums',
                secondsLeft <= 60
                  ? 'border-destructive/40 bg-destructive/10 text-destructive'
                  : secondsLeft <= 300
                    ? 'border-warning/40 bg-warning/10 text-warning'
                    : 'border-border text-muted-foreground',
              )}
            >
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

      <div className="flex flex-col gap-3">
        {questions.map((q, index) => (
          <div key={q.id} className="rounded-xl border border-border bg-background p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">
                  <span className="mr-2 text-xs tabular-nums text-muted-foreground">{index + 1}.</span>
                  {q.text}
                </p>
                {/* The mark shown per question so a candidate can budget their
                    time. Hidden when the paper does not weight questions. */}
                {q.maxScore ? (
                  <span className="shrink-0 rounded-md border border-border px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                    {q.maxScore} {q.maxScore === 1 ? 'mark' : 'marks'}
                  </span>
                ) : null}
              </div>

              {q.format === 'mcq' && q.options ? (
                <RadioGroup
                  value={answers[q.id]?.selectedOption ?? ''}
                  onValueChange={(v) => onAnswer(q.id, { selectedOption: v })}
                  disabled={disabled}
                >
                  {q.options.map((opt) => (
                    <Radio key={opt} value={opt} label={opt} />
                  ))}
                </RadioGroup>
              ) : (
                <Textarea
                  rows={q.format === 'coding' ? 12 : 4}
                  placeholder={q.format === 'coding' ? 'Write your solution here' : 'Your answer'}
                  value={answers[q.id]?.text ?? ''}
                  disabled={disabled}
                  onChange={(e) => onAnswer(q.id, { text: e.target.value })}
                  className={cn(
                    q.format === 'coding' && 'font-mono text-[13px] leading-relaxed',
                  )}
                  spellCheck={q.format !== 'coding'}
                  autoCapitalize={q.format === 'coding' ? 'off' : undefined}
                  autoCorrect={q.format === 'coding' ? 'off' : undefined}
                />
              )}

              {q.previouslyAnswered && (
                <p className="text-xs text-muted-foreground">
                  Previously answered. Changing it replaces your earlier answer.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
