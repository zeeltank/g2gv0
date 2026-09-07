'use client'

/**
 * THE RECORD OF SOMEBODY'S CAPABILITY IMPROVING.
 *
 * ── WHAT THIS REPLACES ──────────────────────────────────────────────────────
 *
 * Nothing. Before this, every capability surface showed a current number with
 * no provenance and no past: a person reading "your level is 3 of 4 required"
 * could not tell whether that 3 came from their own self-rating last week or an
 * AI-marked quiz, and a gap that closed left no trace of ever having been open.
 * The one "history" view that existed was fabricated — the server stamped both
 * its entries with the current level, so it drew a flat line whatever had
 * actually happened.
 *
 * ── ONE COMPONENT, THREE PLACES ─────────────────────────────────────────────
 *
 * The employee's own profile, the HR employee drawer and the Talent Management
 * progress record all ask the same question about different people. Three
 * copies would drift, and this is a record people will act on — so it is one
 * component taking a `userId`, and the server decides who may read whose.
 *
 * ── WHAT IT WILL NOT DO ─────────────────────────────────────────────────────
 *
 * No arithmetic. Levels come from ProficiencyService, the one named roll-up.
 * `unmeasured` is never rendered as zero and never as a gap: an unassessed
 * capability is unknown, not absent, and conflating the two is the defect that
 * once turned 3,328 of 3,873 live gap rows into shortfalls nobody had measured.
 */

import { useCallback, useEffect, useState } from 'react'
import { ArrowUpRight, GraduationCap, History, Minus } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import {
  capabilityProgressService,
  CAPABILITY_SOURCE_LABELS,
  type CapabilityProgress,
} from '@/services/competency/capability-progress'

function formatDate(value: string | null) {
  if (!value) return null
  const parsed = new Date(value.replace(' ', 'T'))
  return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleDateString()
}

export function CmCapabilityProgress({
  userId,
  competencyId,
  title = 'Capability progress',
}: {
  /** Omit for the signed-in person's own record. */
  userId?: number
  competencyId?: number
  title?: string
}) {
  const { user } = useAuth()
  const [data, setData] = useState<CapabilityProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const context = getLaravelContext(user)
    if (!isLaravelContextReady(context)) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await capabilityProgressService.get(context, userId, competencyId)
      setData(response.data ?? null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load this record.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [user, userId, competencyId])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    )
  }

  if (error) {
    return <ErrorState title="Couldn't load capability progress" description={error} retry={load} />
  }

  const competencies = data?.competencies ?? []
  const history = data?.history ?? []
  const improved = competencies.filter((row) => row.changes > 0)

  if (competencies.length === 0) {
    return (
      <EmptyState
        icon={<History className="size-8" />}
        title="No capability requirements yet"
        description={
          data?.is_self
            ? 'Your job role does not have capabilities mapped to it, so there is nothing to measure progress against yet.'
            : 'This person&rsquo;s job role does not have capabilities mapped to it yet.'
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {improved.length === 0
            ? 'Nothing has changed yet. Movements appear here as capabilities are assessed or courses are passed.'
            : `${improved.length} of ${competencies.length} ${
                competencies.length === 1 ? 'capability has' : 'capabilities have'
              } moved.`}
        </p>
      </div>

      {/* ── WHERE THEY ARE, AND WHERE THEY STARTED ── */}
      <ul className="flex flex-col gap-2">
        {competencies.map((row) => {
          const moved = row.changes > 0 && row.started_from !== null && row.measured_level !== null
          const delta = moved ? row.measured_level! - row.started_from! : null

          return (
            <li
              key={row.competency_id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border/60 bg-card px-3 py-2.5"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                {row.competency_name}
                {row.is_mandatory && (
                  <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    required
                  </span>
                )}
              </span>

              {/*
                * Unmeasured shows no number at all. Rendering it as 0 would say
                * "assessed, and scored nothing" about somebody nobody assessed.
                */}
              {row.state === 'unmeasured' ? (
                <span className="text-xs text-muted-foreground">Not yet assessed</span>
              ) : (
                <span className="flex items-center gap-1.5 font-mono text-xs tabular-nums">
                  {moved && (
                    <>
                      <span className="text-muted-foreground line-through">
                        {row.started_from!.toFixed(2)}
                      </span>
                      <ArrowUpRight
                        className={
                          delta! >= 0 ? 'size-3.5 text-success' : 'size-3.5 rotate-90 text-warning'
                        }
                      />
                    </>
                  )}
                  <span className="font-semibold text-foreground">
                    {row.measured_level!.toFixed(2)}
                  </span>
                  <span className="text-muted-foreground">/ {row.required_proficiency ?? '—'}</span>
                </span>
              )}

              <StatusBadge
                variant={
                  row.state === 'met' ? 'active' : row.state === 'gap' ? 'pending' : 'inactive'
                }
                size="sm"
                className="text-[10px] font-bold uppercase tracking-wider"
              >
                {row.state === 'met' ? 'Met' : row.state === 'gap' ? 'Gap' : 'Unmeasured'}
              </StatusBadge>
            </li>
          )
        })}
      </ul>

      {/* ── WHAT CHANGED, AND WHAT CAUSED IT ── */}
      {history.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            What changed
          </h4>
          <ol className="flex flex-col gap-2">
            {history.map((change) => (
              <li
                key={change.id}
                className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/10 px-3 py-2.5"
              >
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  {change.course_id ? (
                    <GraduationCap className="size-4" />
                  ) : (
                    <History className="size-4" />
                  )}
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium text-foreground">
                    {change.item_label ?? change.competency_name ?? 'A capability'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {CAPABILITY_SOURCE_LABELS[change.source] ?? change.source}
                    {/*
                      * The course is NAMED. "Your rating has been updated" was
                      * the whole of what a learner was ever told, transiently,
                      * at submit time — naming no competency and surviving on no
                      * screen afterwards.
                      */}
                    {change.course_title && (
                      <>
                        {' · '}
                        <span className="font-medium text-foreground">{change.course_title}</span>
                      </>
                    )}
                    {change.assessor_name && ` · ${change.assessor_name}`}
                    {formatDate(change.changed_at) && ` · ${formatDate(change.changed_at)}`}
                  </span>
                </div>

                <span className="flex shrink-0 items-center gap-1.5 font-mono text-xs tabular-nums">
                  {change.old_rating === null ? (
                    <span className="text-muted-foreground">first</span>
                  ) : (
                    <span className="text-muted-foreground">{change.old_rating}</span>
                  )}
                  {change.old_rating === null ? (
                    <Minus className="size-3 text-muted-foreground" />
                  ) : (
                    <ArrowUpRight
                      className={
                        change.new_rating >= change.old_rating
                          ? 'size-3.5 text-success'
                          : 'size-3.5 rotate-90 text-warning'
                      }
                    />
                  )}
                  <span className="font-semibold text-foreground">{change.new_rating}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
