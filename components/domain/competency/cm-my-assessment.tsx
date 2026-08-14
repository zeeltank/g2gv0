'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, Radio } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { aiAssessmentService, type AiQuestion, type MyTestResult } from '@/services/competency/ai-assessment'

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

  const answeredNow = useMemo(
    () =>
      Object.values(draft).filter(
        (d) => (d.selected_option ?? '') !== '' || (d.answer_text ?? '').trim() !== '',
      ).length,
    [draft],
  )

  async function submit() {
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

      const res = await aiAssessmentService.submitAnswers(answers, getLaravelContext(user))

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
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your answers were not saved.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Spinner /> Loading your assessment…
      </div>
    )
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
        </div>
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
          <Card key={q.id} className="p-4">
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
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void submit()} disabled={saving || answeredNow === 0}>
          {saving ? 'Saving…' : 'Submit answers'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Written answers are reviewed by your HR team. Submitting does not change your proficiency
          level.
        </p>
      </div>
    </div>
  )
}
