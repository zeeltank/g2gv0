'use client'

/**
 * Campaign detail — Overview, Ratings, Calibration and Audit Trail.
 *
 * WHY THIS FILE EXISTS
 *
 * routes/api.php carries this comment above four endpoints:
 *
 *     // Campaign detail panel: Overview / Edit / Ratings / Calibration / Audit Trail.
 *
 * They were built for this screen, complete with progress counts, a score
 * distribution, a department split and an activity feed — and nothing ever
 * called them. Opening a campaign and clicking any tab but Participants gave
 * one shared card:
 *
 *     This section is coming soon
 *     We are currently building the {campaignTab} functionality.
 *
 * — where `campaignTab` was derived as `tab.toLowerCase().split(' ')[0]`, so
 * "Audit Trail" printed "building the audit functionality". Four finished
 * endpoints behind a placeholder that could not even name itself.
 *
 * Each tab loads only its own endpoint, and only when it is opened: the
 * ratings query joins across assessments and users, and paying for it to
 * render the Overview would be waste.
 */

import { useCallback, useEffect, useState } from 'react'
import { Activity, BarChart3, ClipboardCheck, History, Users } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { assessmentWorkspaceService } from '@/services/competency/assessment-workspace'
import type {
  CampaignAuditEntry,
  CalibrationCandidate,
  CampaignAuditTrail,
  CampaignDetail,
  CampaignRating,
} from '@/services/competency/assessment-workspace'

/** The tab ids this component answers to. */
export type CampaignDetailTab = 'overview' | 'ratings' | 'calibration' | 'audit'

/* ------------------------------------------------------------------ *
 * One small loader, shared by all four tabs
 * ------------------------------------------------------------------ */

function useCampaignResource<T>(
  cycleId: string | null,
  enabled: boolean,
  fetcher: (context: ReturnType<typeof getLaravelContext>, id: string) => Promise<{ data?: T }>,
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!cycleId || !enabled) return

    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) {
      setError('You are not signed in, so this cannot be loaded.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await fetcher(context, cycleId)
      setData((response.data ?? null) as T | null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'This could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [cycleId, enabled, fetcher])

  useEffect(() => {
    // queueMicrotask because react-hooks/set-state-in-effect is an error here:
    // load() sets state, and calling it straight from the effect body trips it.
    queueMicrotask(() => { load() })
  }, [load])

  return { data, loading, error, reload: load }
}

function TabSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Overview
 * ------------------------------------------------------------------ */

function OverviewTab({ cycleId }: { cycleId: string }) {
  const { data, loading, error, reload } = useCampaignResource<CampaignDetail>(
    cycleId,
    true,
    (context, id) => assessmentWorkspaceService.getCampaign(context!, id),
  )

  if (loading) return <TabSkeleton />
  if (error) return <ErrorState title="Unable to load this campaign" description={error} retry={reload} />
  if (!data) return <EmptyState icon={<BarChart3 className="w-10 h-10" />} title="No detail" description="This campaign returned nothing to show." />

  const p = data.progress
  const s = data.scores

  /*
   * The counts, as counts. `completion_pct` is computed by the server from the
   * same numbers shown beside it, so the percentage and the tally can never
   * disagree the way two independent front-end calculations would.
   */
  const cards: { label: string; value: number; tone: string }[] = [
    { label: 'Completed', value: p.completed, tone: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'In progress', value: p.in_progress, tone: 'text-blue-600 dark:text-blue-400' },
    { label: 'Not started', value: p.not_started, tone: 'text-muted-foreground' },
    { label: 'Overdue', value: p.overdue, tone: 'text-destructive' },
  ]

  const widest = Math.max(1, ...s.buckets.map((b) => b.count))

  return (
    <div className="space-y-5">
      {/* ── the campaign itself ─────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-background p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-bold text-foreground">{data.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {/* type_is_set exists precisely so this screen does not invent a
                  type the way the campaign list used to. */}
              {data.type_is_set ? data.type : 'No assessment type recorded'}
              {data.start_label || data.end_label ? (
                <> · {data.start_label ?? '—'} to {data.end_label ?? '—'}</>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge
              variant={data.status === 'closed' ? 'inactive' : data.status === 'scheduled' ? 'pending' : 'success'}
              label={data.status}
              size="sm"
            />
            {data.days_left !== null && (
              <span className={`text-xs font-semibold ${data.days_left < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {data.days_left < 0
                  ? `${Math.abs(data.days_left)} days overdue`
                  : `${data.days_left} days left`}
              </span>
            )}
          </div>
        </div>
        {data.description && <p className="mt-2 text-xs text-muted-foreground">{data.description}</p>}
      </div>

      {/* ── progress ────────────────────────────────────────────────── */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-sm font-bold text-foreground">Progress</h3>
          <span className="text-xs text-muted-foreground">
            {p.completed} of {p.total} complete · {p.completion_pct}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${p.completion_pct}%` }} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className="rounded-xl border border-border bg-background p-3">
              <p className={`text-xl font-black tabular-nums ${card.tone}`}>{card.value}</p>
              <p className="text-[11px] font-semibold text-muted-foreground">{card.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {p.reviewed} reviewed ({p.review_pct}%) · {p.pending_calibration} waiting on calibration
        </p>
      </div>

      {/* ── score spread ────────────────────────────────────────────── */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-sm font-bold text-foreground">Score distribution</h3>
          <span className="text-xs text-muted-foreground">
            {s.rated > 0
              ? <>avg {s.average}% · range {s.min}–{s.max}%</>
              : 'nothing scored yet'}
          </span>
        </div>
        {s.rated === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
            No assessment in this campaign has been scored, so there is no distribution to show.
          </p>
        ) : (
          <div className="space-y-1.5">
            {s.buckets.map((bucket) => (
              <div key={bucket.range} className="flex items-center gap-3">
                {/* Percentage bands, not the 1-6 proficiency scale — the
                    column holds 0-100 and the controller says so. */}
                <span className="w-16 shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {bucket.range}%
                </span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full rounded bg-primary/70"
                    style={{ width: `${(bucket.count / widest) * 100}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-[11px] font-bold tabular-nums text-foreground">
                  {bucket.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── reach ───────────────────────────────────────────────────── */}
      {data.departments.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-foreground">Departments covered</h3>
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table className="w-full text-sm">
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-3 py-2 font-bold">Department</TableHead>
                  <TableHead className="px-3 py-2 text-right font-bold">Participants</TableHead>
                  <TableHead className="px-3 py-2 text-right font-bold">Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.departments.map((dept) => (
                  <TableRow key={dept.department} className="hover:bg-muted/30">
                    <TableCell className="px-3 py-2">{dept.department}</TableCell>
                    <TableCell className="px-3 py-2 text-right tabular-nums">{dept.total}</TableCell>
                    <TableCell className="px-3 py-2 text-right tabular-nums">{dept.completed}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            The eight departments with the most participants.
          </p>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Ratings
 * ------------------------------------------------------------------ */

function RatingsTab({ cycleId }: { cycleId: string }) {
  const { data, loading, error, reload } = useCampaignResource<CampaignRating[]>(
    cycleId,
    true,
    (context, id) => assessmentWorkspaceService.getCampaignRatings(context!, id),
  )

  if (loading) return <TabSkeleton />
  if (error) return <ErrorState title="Unable to load ratings" description={error} retry={reload} />

  const rows = data ?? []
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Users className="w-10 h-10" />}
        title="No ratings yet"
        description="Nobody in this campaign has been rated. Scores appear here as assessments are completed."
      />
    )
  }

  const target = rows[0]?.target_pct

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table className="w-full text-sm">
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-3 py-2 font-bold">Employee</TableHead>
              <TableHead className="px-3 py-2 font-bold">Role</TableHead>
              <TableHead className="px-3 py-2 font-bold">Framework</TableHead>
              <TableHead className="px-3 py-2 text-right font-bold">Score</TableHead>
              <TableHead className="px-3 py-2 font-bold">Against target</TableHead>
              <TableHead className="px-3 py-2 font-bold">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.assessment_id} className="hover:bg-muted/30">
                <TableCell className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {row.initials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{row.name}</p>
                      {row.emp_id && <p className="text-[10px] text-muted-foreground">{row.emp_id}</p>}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-3 py-2 text-muted-foreground">{row.role}</TableCell>
                <TableCell className="px-3 py-2 text-muted-foreground">{row.framework ?? '—'}</TableCell>
                <TableCell className="px-3 py-2 text-right tabular-nums">
                  {row.score_pct !== null ? `${row.score_pct}%` : '—'}
                </TableCell>
                <TableCell className="px-3 py-2">
                  {/* meets_target is null when there is no score - which is a
                      different thing from missing the target, and must not
                      render as a red "below". */}
                  {row.meets_target === null ? (
                    <span className="text-xs text-muted-foreground">not scored</span>
                  ) : (
                    <StatusBadge
                      variant={row.meets_target ? 'success' : 'warning'}
                      label={row.meets_target ? 'Meets' : 'Below'}
                      size="sm"
                    />
                  )}
                </TableCell>
                <TableCell className="px-3 py-2">
                  <span className="text-xs capitalize text-muted-foreground">
                    {String(row.status).replace(/_/g, ' ')}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {target !== undefined && (
        <p className="text-[11px] text-muted-foreground">
          {rows.length} rated · target is {target}%, set in competency weighting settings.
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Calibration
 * ------------------------------------------------------------------ */

function CalibrationTab({ cycleId }: { cycleId: string }) {
  const { data, loading, error, reload } = useCampaignResource<CalibrationCandidate[]>(
    cycleId,
    true,
    (context, id) => assessmentWorkspaceService.getCampaignCalibrationQueue(context!, id),
  )

  if (loading) return <TabSkeleton />
  if (error) return <ErrorState title="Unable to load the calibration queue" description={error} retry={reload} />

  const rows = data ?? []
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardCheck className="w-10 h-10" />}
        title="Nothing waiting on calibration"
        description="Completed assessments appear here once they are submitted for review. An empty queue means none are outstanding — not that calibration is unavailable."
      />
    )
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table className="w-full text-sm">
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-3 py-2 font-bold">Employee</TableHead>
              <TableHead className="px-3 py-2 font-bold">Role</TableHead>
              <TableHead className="px-3 py-2 font-bold">Department</TableHead>
              <TableHead className="px-3 py-2 text-right font-bold">Score</TableHead>
              <TableHead className="px-3 py-2 font-bold">Completed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.assessment_id} className="hover:bg-muted/30">
                <TableCell className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {row.initials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{row.name}</p>
                      {row.emp_id && <p className="text-[10px] text-muted-foreground">{row.emp_id}</p>}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-3 py-2 text-muted-foreground">{row.role}</TableCell>
                <TableCell className="px-3 py-2 text-muted-foreground">{row.department ?? '—'}</TableCell>
                <TableCell className="px-3 py-2 text-right tabular-nums">
                  {row.score !== null ? row.score : '—'}
                </TableCell>
                <TableCell className="px-3 py-2 text-muted-foreground">{row.completed_on ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {rows.length} waiting. Calibration decisions are taken on the organisation-wide
        Calibration tab, which acts across campaigns.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Audit trail
 * ------------------------------------------------------------------ */

function AuditTab({ cycleId }: { cycleId: string }) {
  const { data, loading, error, reload } = useCampaignResource<CampaignAuditTrail>(
    cycleId,
    true,
    (context, id) => assessmentWorkspaceService.getCampaignAuditTrail(context!, id),
  )

  if (loading) return <TabSkeleton />
  if (error) return <ErrorState title="Unable to load the audit trail" description={error} retry={reload} />

  const entries: CampaignAuditEntry[] = data?.entries ?? []
  const stamps = data?.stamps ?? []

  return (
    <div className="space-y-4">
      {stamps.length > 0 && (
        <div className="flex flex-wrap gap-4 rounded-xl border border-border bg-background p-3">
          {stamps.map((stamp) => (
            <div key={stamp.label}>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{stamp.label}</p>
              <p className="text-xs font-semibold text-foreground">{stamp.date}</p>
            </div>
          ))}
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState
          icon={<History className="w-10 h-10" />}
          title="No recorded activity"
          description="Nothing has been logged against this campaign's assessments yet. Entries appear as ratings are submitted, reviewed and calibrated."
        />
      ) : (
        <ol className="relative space-y-3 border-l border-border pl-4">
          {entries.map((entry) => (
            <li key={entry.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold capitalize text-foreground">
                  {String(entry.action).replace(/_/g, ' ')}
                  {entry.record && <span className="font-normal text-muted-foreground"> · {entry.record}</span>}
                </p>
                <span className="text-[11px] text-muted-foreground">{entry.date ?? ''}</span>
              </div>
              {entry.description && <p className="text-xs text-muted-foreground">{entry.description}</p>}
              <p className="text-[11px] text-muted-foreground">by {entry.by}</p>

              {/* What actually changed, when the log recorded it. */}
              {entry.changes.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {entry.changes.map((change, index) => (
                    <li key={`${entry.id}-${index}`} className="text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground">{change.label ?? change.field}</span>
                      {': '}
                      <span className="line-through opacity-70">{String(change.old ?? '—')}</span>
                      {' → '}
                      <span className="font-semibold text-foreground">{String(change.new ?? '—')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}

      <p className="text-[11px] text-muted-foreground">
        Append-only. A correction is recorded as its own entry rather than altering an existing one.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * The switch
 * ------------------------------------------------------------------ */

export function CampaignDetailTabs({ cycleId, tab }: { cycleId: string; tab: CampaignDetailTab }) {
  if (tab === 'overview') return <OverviewTab cycleId={cycleId} />
  if (tab === 'ratings') return <RatingsTab cycleId={cycleId} />
  if (tab === 'calibration') return <CalibrationTab cycleId={cycleId} />
  if (tab === 'audit') return <AuditTab cycleId={cycleId} />

  // Unreachable through the tab strip, which offers exactly these four plus
  // Participants. Named rather than silent, so a future tab id that is added
  // to the strip and not here shows what happened instead of a blank panel.
  return (
    <EmptyState
      icon={<Activity className="w-10 h-10" />}
      title="Unknown tab"
      description={`No panel is registered for "${tab}".`}
    />
  )
}
