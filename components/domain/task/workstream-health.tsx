'use client'

/**
 * Health and status presentation for workstreams.
 *
 * Small on purpose: these are the two mappings every workstream surface needs,
 * and having them in one place is what stops the project page and the workstream
 * page disagreeing about what amber means.
 */

import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import type { ProjectStatus, WorkstreamHealth, WorkstreamHealthState } from '@/types/task-management'

type BadgeVariant = 'default' | 'active' | 'success' | 'inactive' | 'pending' | 'warning' | 'error' | 'processing' | 'primary'

/**
 * ⚠ THIS EXISTS BECAUSE `'IN PROGRESS'` IS MISSING FROM `statusVariantMap`.
 *
 * `components/ui/status-badge.tsx` maps `'In Progress'`, `'in-progress'` and
 * `'IN-PROGRESS'` — but not the space-and-caps form that `ProjectStatus`
 * actually uses. So of the five project statuses, four render coloured and that
 * one renders neutral. It is live on the project cards today.
 *
 * `components/ui` is a shared design system and is not edited from a feature
 * branch, so the fix is to pass `variant` explicitly — which StatusBadge already
 * honours ahead of its own lookup.
 */
export function projectStatusVariant(status: ProjectStatus): BadgeVariant {
  switch (status) {
    case 'IN PROGRESS': return 'processing'
    case 'COMPLETED':   return 'active'
    case 'AT RISK':     return 'error'
    case 'PLANNING':    return 'inactive'
    case 'ARCHIVED':    return 'inactive'
    default:            return 'default'
  }
}

/**
 * Health → colour.
 *
 * NOT STARTED and UNMEASURED are deliberately NEUTRAL, not green. A workstream
 * nobody has planned satisfies every "nothing is overdue" test trivially, and a
 * KPI with no reading is unread rather than passing — colouring either of them
 * green would be the screen asserting a health nobody measured.
 */
export function healthVariant(state: WorkstreamHealthState): BadgeVariant {
  switch (state) {
    case 'ON TRACK':    return 'active'
    case 'AT RISK':     return 'warning'
    case 'OFF TRACK':   return 'error'
    case 'UNMEASURED':  return 'default'
    case 'NOT STARTED': return 'inactive'
    default:            return 'default'
  }
}

/** A left rail / border tint for cards, matching the badge. */
export function healthTone(state: WorkstreamHealthState): string {
  switch (state) {
    case 'ON TRACK':    return 'border-success/40'
    case 'AT RISK':     return 'border-warning/50'
    case 'OFF TRACK':   return 'border-danger/50'
    default:            return 'border-border'
  }
}

export function WorkstreamHealthBadge({ state, className }: { state: WorkstreamHealthState; className?: string }) {
  return <StatusBadge status={state} variant={healthVariant(state)} className={className}>{state}</StatusBadge>
}

/**
 * The badge AND the sentence that explains it.
 *
 * The reason is never optional here. A colour on its own tells somebody how to
 * feel; "2 deliverables are past their due date" tells them what to do, and the
 * API always sends one.
 */
export function WorkstreamHealthLine({ health, className }: { health: WorkstreamHealth; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <WorkstreamHealthBadge state={health.state} />
      <span className="text-sm text-muted-foreground">{health.state_reason}</span>
    </div>
  )
}

/**
 * The counters, rendered only where there is something to count.
 *
 * A row of zeroes reads as "we measured and found nothing", which is a different
 * claim from "there is nothing here yet" — so an empty group is omitted rather
 * than shown as 0.
 */
export function WorkstreamHealthCounts({ health }: { health: WorkstreamHealth }) {
  const groups: Array<{ label: string; value: string; tone?: string }> = []

  if (health.deliverables.total > 0) {
    groups.push({
      label: 'Deliverables',
      value: `${health.deliverables.done} of ${health.deliverables.total}`,
      tone: health.deliverables.overdue > 0 ? 'text-danger' : undefined,
    })
  }
  if (health.kpis.total > 0) {
    groups.push({
      label: 'KPIs measured',
      value: `${health.kpis.total - health.kpis.unmeasured} of ${health.kpis.total}`,
      tone: health.kpis.off_track > 0 ? 'text-danger' : health.kpis.at_risk > 0 ? 'text-warning' : undefined,
    })
  }
  if (health.risks.open + health.risks.closed > 0) {
    groups.push({
      label: 'Open risks',
      value: String(health.risks.open),
      tone: health.risks.regulated_open > 0 ? 'text-danger' : health.risks.severe_open > 0 ? 'text-warning' : undefined,
    })
  }
  if (health.tasks.total > 0) {
    groups.push({
      label: 'Tasks done',
      value: `${health.tasks.completed} of ${health.tasks.total}`,
      tone: health.tasks.overdue > 0 ? 'text-danger' : undefined,
    })
  }
  if (health.milestones.total > 0) {
    groups.push({
      label: 'Checkpoints',
      value: `${health.milestones.completed} of ${health.milestones.total}`,
      tone: health.milestones.overdue > 0 ? 'text-danger' : undefined,
    })
  }

  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing has been planned for this workstream yet.</p>
  }

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      {groups.map((group) => (
        <div key={group.label}>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</dt>
          <dd className={cn('mt-0.5 text-lg font-bold tabular-nums', group.tone ?? 'text-foreground')}>{group.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Progress, or an honest sentence.
 *
 * `progress` is NULL — not 0 — when a workstream has no deliverables, because
 * zero percent asserts that work exists and none of it is done. A bar sitting
 * empty at 0% makes exactly that claim, so the null case renders as words.
 */
export function WorkstreamProgress({ progress, className }: { progress: number | null; className?: string }) {
  if (progress === null) {
    return <p className={cn('text-sm text-muted-foreground', className)}>No deliverables defined</p>
  }

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-xs font-medium text-muted-foreground">Deliverables complete</span>
        <span className="text-xs font-semibold tabular-nums text-foreground">{progress}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  )
}
