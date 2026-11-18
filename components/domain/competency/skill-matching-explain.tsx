'use client'

/**
 * Skill Matching - the view this feature never had (a prior agent confirmed
 * no such page exists anywhere in this frontend, though the backend
 * endpoint - SkillMatchingController::explainMatch() - has existed since
 * Phase 7.4). Minimal, by design: a person id, a job role id, and the
 * graph-grounded explanation of whether they match, rendered the same way
 * `employee-directory-sheets.tsx` renders the Competency Gap narrative - a
 * labelled card under the gap numbers it explains, nothing while loading,
 * nothing when there is nothing to say.
 *
 * NO ARITHMETIC HERE. `gap_summary` is the same required-vs-measured
 * comparison `/competency/gap` returns; this screen only asks the server for
 * it and displays what comes back.
 */

import { useCallback, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { skillMatchingService, type SkillMatchExplanation } from '@/services/competency/skill-matching'

export function SkillMatchingExplain() {
  const { user } = useAuth()

  const [userId, setUserId] = useState('')
  const [jobroleId, setJobroleId] = useState('')
  const [result, setResult] = useState<SkillMatchExplanation | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  const load = useCallback(async () => {
    const uid = Number(userId)
    const jid = Number(jobroleId)
    if (!uid || !jid) {
      setError('Enter both a person id and a job role id.')
      return
    }

    setIsLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await skillMatchingService.explain(getLaravelContext(user), uid, jid)
      setResult(res?.data ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the match explanation.')
    } finally {
      setIsLoading(false)
      setHasSearched(true)
    }
  }, [userId, jobroleId, user])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Skill Matching</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Why does (or doesn&apos;t) this person match a job role&apos;s competency requirements -
          grounded in the role-competency graph, never re-ranking the gap figures themselves.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-border bg-card/40 p-5">
        <div className="space-y-1.5">
          <Label htmlFor="skill-matching-user-id">Person (user id)</Label>
          <Input
            id="skill-matching-user-id"
            inputMode="numeric"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="e.g. 28"
            className="w-40"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="skill-matching-jobrole-id">Job role id</Label>
          <Input
            id="skill-matching-jobrole-id"
            inputMode="numeric"
            value={jobroleId}
            onChange={(e) => setJobroleId(e.target.value)}
            placeholder="e.g. 4282"
            className="w-40"
          />
        </div>
        <Button onClick={() => void load()} disabled={isLoading}>
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
          Explain match
        </Button>
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
          {error}
        </div>
      )}

      {!error && hasSearched && !isLoading && result && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card/40 p-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Competency requirements
            </p>
            {result.gap_summary.competencies.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                This job role has no competency requirements defined yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {result.gap_summary.competencies.map((c) => (
                  <li key={c.competency_id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">
                      {c.competency_name}
                      {c.competency_code ? <span className="text-muted-foreground"> ({c.competency_code})</span> : null}
                    </span>
                    <span
                      className={
                        c.state === 'met'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : c.state === 'gap'
                            ? 'text-destructive'
                            : 'text-muted-foreground'
                      }
                    >
                      {c.state === 'unmeasured'
                        ? 'unmeasured'
                        : `measured ${c.measured_level ?? '—'} / required ${c.required_proficiency}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/*
            * A missing explanation is a normal state (no AI model configured,
            * or nothing to explain), never an error - same rule the
            * Competency Gap narrative already renders by.
            */}
          {result.explanation && (
            <div className="rounded-2xl border border-border bg-card/40 p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Why this match
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">{result.explanation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
