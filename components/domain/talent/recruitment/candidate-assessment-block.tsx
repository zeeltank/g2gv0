'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ClipboardCheck, Copy, Check, Loader2, Send, AlertTriangle, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { recruitmentService } from '@/services/talent/recruitment'
import type { CandidateAssessmentResultApi, LaravelId } from '@/types/recruitment'

/**
 * The candidate's assessment, on the recruiter's Screening tab.
 *
 * ── WHY THIS SITS BESIDE THE CV SCREENING RATHER THAN IN ITS OWN TAB ────────
 *
 * A recruiter deciding whether to interview someone is already looking at the
 * AI's CV match and the résumé review. The assessment is the third input to the
 * SAME decision, so it belongs in the same place. A separate tab would mean the
 * decision is made with two thirds of the evidence on another screen.
 *
 * ── THE RULES THIS SCREEN MUST NOT BREAK ────────────────────────────────────
 *
 *   - `qualified` is TRI-STATE. null means "not judged yet", and it renders as
 *     that, never as a fail. A paper still being marked is not a rejection.
 *   - An unmarked answer shows an em dash, not a zero. Those are different
 *     claims about a person.
 *   - The pass mark is in MARKS, because that is what HR set. The percentage is
 *     shown too, but the verdict is stated against the marks.
 *   - Qualifying MOVES the candidate to Interview automatically; failing does
 *     NOT reject them. The copy says so, because a recruiter who assumes
 *     otherwise will leave people sitting in Assessment forever.
 */
export function CandidateAssessmentBlock({
  applicationId,
  candidateStage,
}: {
  applicationId: LaravelId
  candidateStage?: string
}) {
  const [result, setResult] = useState<CandidateAssessmentResultApi | null>(null)
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  /**
   * Reload after an invite. Called from an event handler, never from an effect —
   * see the effect below for why that distinction matters here.
   */
  const refresh = useCallback(async () => {
    try {
      setResult(await recruitmentService.getAssessment(applicationId))
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The assessment could not be loaded.')
    }
  }, [applicationId])

  /*
   * Every setState here happens AFTER an await, deliberately.
   *
   * The obvious shape — `useEffect(() => { void load() })` with `setLoading(true)`
   * as load()'s first line — sets state synchronously inside the effect body and
   * trips react-hooks/set-state-in-effect, which is an error in this repo, not a
   * warning. `loading` already starts true from useState, so the synchronous set
   * was redundant as well as illegal.
   */
  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const data = await recruitmentService.getAssessment(applicationId)
        if (cancelled) return
        setResult(data)
        setError(null)
      } catch (cause) {
        if (cancelled) return
        setError(cause instanceof Error ? cause.message : 'The assessment could not be loaded.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [applicationId])

  async function invite() {
    setInviting(true)
    setError(null)
    try {
      const response = await recruitmentService.inviteAssessment(applicationId)
      setLink(response.data?.url ?? null)
      if (response.data && !response.data.email_sent) {
        // Said plainly rather than swallowed: a link nobody received, reported
        // as success, is how a candidate waits a week for nothing.
        setError(
          `The link was created but not emailed${
            response.data.email_error ? ` (${response.data.email_error})` : ''
          }. Copy it to the candidate.`,
        )
      }
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The assessment could not be created.')
    } finally {
      setInviting(false)
    }
  }

  async function copyLink() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('The link could not be copied. Select it and copy it manually.')
    }
  }

  if (loading) {
    return (
      <div className="space-y-2 rounded-lg border border-border/60 p-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  const marked = result?.answers?.filter((a) => a.score !== null).length ?? 0
  const totalAnswers = result?.answers?.length ?? 0
  const awaiting = totalAnswers - marked

  return (
    <div className="@container/assess rounded-lg border border-border/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <ClipboardCheck className="size-4 text-muted-foreground" aria-hidden="true" />
          Assessment
        </p>
        {result?.status && (
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {result.status}
          </span>
        )}
      </div>

      {error && (
        <p className="mb-3 flex items-start gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {!result ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            No assessment has been sent yet. Inviting generates a paper for this job role and emails
            the candidate a personal link — they do not need an account.
          </p>
          <Button size="sm" onClick={() => void invite()} disabled={inviting}>
            {inviting ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />
                Writing the questions…
              </>
            ) : (
              <>
                <Send className="mr-1.5 size-3.5" aria-hidden="true" />
                Invite to assessment
              </>
            )}
          </Button>
          {candidateStage && candidateStage !== 'Assessment' && (
            <p className="text-[11px] text-muted-foreground">
              This candidate is at <strong>{candidateStage}</strong>. Inviting them does not move
              them — drag the card to Assessment if that is where they belong.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {result.score !== null && result.max_score ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-2xl font-bold tabular-nums">
                  {result.score}
                  <span className="text-sm font-normal text-muted-foreground"> / {result.max_score}</span>
                </span>
                {/* TRI-STATE. null renders as "being marked", never as a fail. */}
                {result.qualified === null ? (
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    Not judged yet
                  </span>
                ) : result.qualified ? (
                  <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                    Qualified
                  </span>
                ) : (
                  <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">
                    Below the pass mark
                  </span>
                )}
              </div>

              <Progress value={result.percent ?? 0} />

              <p className="text-[11px] text-muted-foreground">
                {result.qualification_marks !== null ? (
                  <>
                    Pass mark {result.qualification_marks} of {result.max_score}
                    {result.percent !== null ? ` · scored ${result.percent}%` : ''}
                  </>
                ) : (
                  'This assessment has no pass mark, so no pass or fail is claimed.'
                )}
              </p>

              {result.qualified === true && (
                <p className="text-[11px] text-success">
                  Qualifying moved this application to Interview Scheduled automatically.
                </p>
              )}
              {result.qualified === false && (
                <p className="text-[11px] text-muted-foreground">
                  They stay in Assessment. Nothing rejects a candidate automatically — that decision
                  is yours.
                </p>
              )}
              {awaiting > 0 && (
                <p className="text-[11px] text-warning">
                  {awaiting} answer(s) still need marking, so this total is not final.
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {result.link_used
                ? 'Submitted. Waiting to be marked.'
                : `Invited${result.expires_at ? `, link open until ${new Date(result.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}. Not started yet.`}
            </p>
          )}

          {result.answers.length > 0 && (
            <div className="space-y-2 border-t border-border/40 pt-3">
              <p className="text-xs font-semibold">Answers</p>
              {result.answers.map((a) => (
                <div key={a.question_id} className="rounded-md bg-muted/30 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] font-medium">{a.question}</p>
                    <span className="shrink-0 text-[11px] font-semibold tabular-nums">
                      {/* An unmarked answer is an em dash, NOT a zero. */}
                      {a.score === null ? '—' : a.score} / {a.max_score}
                    </span>
                  </div>
                  {a.answer && (
                    <p
                      className={cn(
                        'mt-1.5 whitespace-pre-wrap text-[11px] text-muted-foreground',
                        a.format === 'coding' && 'font-mono',
                      )}
                    >
                      {a.answer.length > 400 ? `${a.answer.slice(0, 400)}…` : a.answer}
                    </p>
                  )}
                  {a.ai_feedback && (
                    <p className="mt-1.5 flex items-start gap-1 text-[11px] italic text-muted-foreground">
                      <Sparkles className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                      {a.ai_feedback}
                    </p>
                  )}
                  {a.scored_by && (
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                      marked by {a.scored_by}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-3">
            <Button size="sm" variant="outline" onClick={() => void invite()} disabled={inviting}>
              {inviting ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />
                  Writing…
                </>
              ) : (
                'Send a new assessment'
              )}
            </Button>
            {link && (
              <Button size="sm" variant="ghost" onClick={() => void copyLink()}>
                {copied ? (
                  <>
                    <Check className="mr-1.5 size-3.5" aria-hidden="true" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 size-3.5" aria-hidden="true" />
                    Copy link
                  </>
                )}
              </Button>
            )}
            <span className="text-[10px] text-muted-foreground">
              Sending a new one invalidates the previous link.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
