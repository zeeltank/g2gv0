'use client'

/**
 * The recruiter's own read of a CV, shown under the AI analysis in the
 * candidate panel's Screening tab.
 *
 * The two belong together and are not the same thing. Above this block, the AI
 * says what it computed about the CANDIDATE. This block says what a named person
 * decided about THIS APPLICATION, and when. That is the part a hiring decision
 * has to be able to point at afterwards.
 *
 * `talent_resume_screenings` had 0 rows and no code path anywhere before this;
 * audit F-59 had it down for deletion. It is kept and this is what it is for.
 */

import React from 'react'
import { Loader2, AlertCircle, ClipboardCheck, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  resumeScreeningService,
  type ResumeScreening,
} from '@/services/talent/hiring-team'

/** Bands the score is described in, so a number is never shown without a meaning. */
function scoreBand(score: number) {
  if (score >= 80) return { label: 'Strong match', bar: 'bg-success', text: 'text-success' }
  if (score >= 60) return { label: 'Worth a look', bar: 'bg-primary', text: 'text-primary' }
  if (score >= 40) return { label: 'Partial match', bar: 'bg-warning', text: 'text-warning' }
  return { label: 'Weak match', bar: 'bg-destructive', text: 'text-destructive' }
}

export function ResumeReviewBlock({ applicationId }: { applicationId: number | null }) {
  const [screening, setScreening] = React.useState<ResumeScreening | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = React.useState(false)

  // Every setState happens after an await, so nothing is set synchronously in
  // the effect body — that cascade is what react-hooks/set-state-in-effect
  // catches, and it is a real one.
  React.useEffect(() => {
    if (!applicationId) return

    let cancelled = false

    void (async () => {
      try {
        const res = await resumeScreeningService.forApplication(applicationId)
        if (cancelled) return
        setScreening(res.latest)
        setError(null)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'The resume review could not be loaded.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [applicationId])

  if (!applicationId) return null

  return (
    <div className="@container/review mt-4 rounded-lg border border-border/60 bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="size-4 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Recruiter resume review
            </span>
            <span className="text-[11px] text-muted-foreground">
              A person&apos;s read of this CV, separate from the analysis above.
            </span>
          </div>
        </div>
        {!isFormOpen && (
          <Button size="sm" variant="outline" className="h-7 shrink-0 px-2 text-[10px]" onClick={() => setIsFormOpen(true)}>
            {screening ? 'Record another' : 'Record screening'}
          </Button>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
          <p className="text-[11px] text-destructive">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-16 items-center justify-center">
          <Loader2 className="size-4 animate-spin text-primary" />
        </div>
      ) : screening ? (
        <ReviewSummary screening={screening} />
      ) : !isFormOpen ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Nobody has reviewed this CV yet.
        </p>
      ) : null}

      {isFormOpen && (
        <ReviewForm
          applicationId={applicationId}
          onCancel={() => setIsFormOpen(false)}
          onSaved={(saved) => {
            setScreening(saved)
            setIsFormOpen(false)
          }}
        />
      )}
    </div>
  )
}

function ReviewSummary({ screening }: { screening: ResumeScreening }) {
  const score = screening.ai_score ?? 0
  const band = scoreBand(score)
  const percentage = Math.min(100, Math.max(0, score))

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div>
        <div className="flex items-baseline justify-between">
          <span className={cn('text-lg font-black tabular-nums', band.text)}>{score.toFixed(1)}%</span>
          <span className={cn('text-[11px] font-semibold', band.text)}>{band.label}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={cn('h-full rounded-full', band.bar)} style={{ width: `${percentage}%` }} />
        </div>
      </div>

      {screening.keywords_matched.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold text-foreground">Keywords matched</p>
          <div className="flex flex-wrap gap-1.5">
            {screening.keywords_matched.map((keyword, index) => (
              <span
                key={`${keyword}-${index}`}
                className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}

      {screening.comments && (
        <p className="rounded-md bg-muted/50 px-3 py-2 text-xs italic text-foreground/80">
          &ldquo;{screening.comments}&rdquo;
        </p>
      )}

      {/* Who signed it and when. The whole reason this record exists. */}
      <div className="flex items-center gap-1.5 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
        <UserCheck className="size-3.5" />
        <span>
          Reviewed by <span className="font-semibold text-foreground">{screening.reviewer_name ?? 'a team member'}</span>
          {screening.reviewed_on ? ` on ${screening.reviewed_on}` : ''}
        </span>
      </div>
    </div>
  )
}

function ReviewForm({
  applicationId,
  onCancel,
  onSaved,
}: {
  applicationId: number
  onCancel: () => void
  onSaved: (screening: ResumeScreening) => void
}) {
  const [score, setScore] = React.useState('')
  const [keywords, setKeywords] = React.useState('')
  const [comments, setComments] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)

  const submit = async () => {
    const numeric = Number(score)
    if (!score.trim() || !Number.isFinite(numeric)) {
      setError('Give the CV a score out of 100.')
      return
    }
    if (numeric < 0 || numeric > 100) {
      setError('The score has to be between 0 and 100.')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const saved = await resumeScreeningService.record({
        application_id: applicationId,
        ai_score: numeric,
        keywords_matched: keywords.trim() || undefined,
        comments: comments.trim() || undefined,
      })
      onSaved(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That review could not be saved.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-border/40 pt-3">
      {/* Errors sit above the fields they belong to. */}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
          <p className="text-[11px] text-destructive">{error}</p>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="rr-score" className="text-[11px] font-semibold text-foreground">Score out of 100</label>
        <Input
          id="rr-score"
          type="number"
          min={0}
          max={100}
          step="0.1"
          value={score}
          onChange={(e) => setScore(e.target.value)}
          placeholder="e.g. 82.5"
          className="h-8 text-xs tabular-nums"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="rr-keywords" className="text-[11px] font-semibold text-foreground">
          Keywords matched <span className="font-normal text-muted-foreground">(comma separated)</span>
        </label>
        <Input
          id="rr-keywords"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="Laravel, MySQL, REST APIs"
          className="h-8 text-xs"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="rr-comments" className="text-[11px] font-semibold text-foreground">Comments</label>
        <Textarea
          id="rr-comments"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="What stood out, and what did not."
          rows={3}
          className="text-xs"
        />
      </div>

      <p className="text-[11px] text-muted-foreground">
        Saved against your name and today&apos;s date.
      </p>

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button size="sm" className="h-7 gap-1.5 px-2 text-[10px]" onClick={() => void submit()} disabled={isSaving}>
          {isSaving && <Loader2 className="size-3 animate-spin" />}
          Save review
        </Button>
      </div>
    </div>
  )
}
