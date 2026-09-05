'use client'

import * as React from 'react'
import { AlertTriangle, Check, Clock, Minus, Undo2, X } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { LeaveApprovalStep } from '@/services/hrms/leave'

/**
 * Who still has to say yes. F-124.
 *
 * The Leave Configuration screen has always offered a two-stage approval chain
 * and a 24-hour escalation, saved them, reloaded them — and nothing in the
 * product read them. One approval from anyone holding `approve_leave` decided
 * the request, whatever the tenant had configured.
 *
 * This renders the chain the request was actually submitted under, which is
 * frozen at submit time: if HR changes the configuration tomorrow, a request
 * already in flight keeps the approvers it entered with. So this component
 * shows the SERVER's chain and never rebuilds one from the current settings —
 * the two can legitimately differ, and the request's own is the true one.
 */

const STEP_STYLES: Record<
  LeaveApprovalStep['status'],
  { icon: React.ElementType; ring: string; dot: string; note: string }
> = {
  approved: {
    icon: Check,
    ring: 'border-success/40 bg-success/10 text-success',
    dot: 'bg-success',
    note: 'Approved',
  },
  rejected: {
    icon: X,
    ring: 'border-destructive/40 bg-destructive/10 text-destructive',
    dot: 'bg-destructive',
    note: 'Rejected',
  },
  pending: {
    icon: Clock,
    ring: 'border-warning/50 bg-warning/10 text-warning',
    dot: 'bg-warning',
    note: 'Waiting for a decision',
  },
  waiting: {
    icon: Minus,
    ring: 'border-border bg-muted text-muted-foreground',
    dot: 'bg-border',
    note: 'Not started — an earlier approval is outstanding',
  },
  skipped: {
    icon: Minus,
    ring: 'border-border bg-muted text-muted-foreground',
    dot: 'bg-border',
    note: 'Not required — the request was decided earlier',
  },
  // Sent back is not a refusal: the request returns to the employee to amend
  // and re-submit, and the chain restarts. Labelling it "Rejected" told people
  // their request had been refused when it had not.
  sent_back: {
    icon: Undo2,
    ring: 'border-warning/40 bg-warning/10 text-warning',
    dot: 'bg-warning',
    note: 'Sent back for amendment',
  },
}

/** What the approver actually chose, when it differs from the step's own state. */
const DECISION_NOTE: Record<string, string> = {
  approved: 'Approved',
  approved_lwp: 'Approved as leave without pay',
  rejected: 'Rejected',
  sent_back: 'Sent back for amendment',
  cancelled: 'Cancelled',
}

function formatWhen(value: string | null): string | null {
  if (!value) return null
  const parsed = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return value
  // en-GB with the year, matching formatDateTime in LeaveRequestDetailsDrawer.
  // The ambient locale renders 09/05 for a US reader and 05/09 for a UK one on
  // the same screen as a date that always reads 05 Sep 2026.
  return parsed.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ApprovalChain({
  steps,
  loading = false,
  className,
}: {
  steps: LeaveApprovalStep[]
  /** The detail fetch is still running. Without this, an in-flight or failed
   *  request renders the "no chain" message, which is a different claim. */
  loading?: boolean
  className?: string
}) {
  if (loading) {
    return <Skeleton className={cn('h-32 rounded-xl', className)} />
  }

  // Requests submitted before the chain existed have no steps. Say so plainly
  // rather than rendering an empty box that reads like a loading failure.
  if (steps.length === 0) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        This request was submitted before approval chains were configured, so it takes a single
        decision.
      </p>
    )
  }

  const decided = steps.filter((step) => step.status === 'approved').length
  const current = steps.find((step) => step.status === 'pending')

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-bold text-foreground">Approval chain</h4>
        <span className="text-xs font-medium text-muted-foreground tabular-nums">
          {decided} of {steps.length} approved
        </span>
      </div>

      <ol className="flex flex-col">
        {steps.map((step, index) => {
          const style = STEP_STYLES[step.status] ?? STEP_STYLES.waiting
          const Icon = style.icon
          const isLast = index === steps.length - 1
          const when = formatWhen(step.decided_at ?? step.pending_since)

          return (
            <li key={step.step} className="flex gap-3">
              {/* Rail: the marker, and the line down to the next step. */}
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-full border',
                    style.ring,
                  )}
                >
                  <Icon className="size-4" />
                </span>
                {!isLast && <span className={cn('w-px flex-1', style.dot, 'opacity-40')} />}
              </div>

              <div className={cn('min-w-0 flex-1', isLast ? 'pb-0' : 'pb-5')}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-semibold text-foreground">{step.role_label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Step {step.step}
                  </span>
                  {step.escalated_at && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                      <AlertTriangle className="size-3" />
                      Escalated to {step.escalated_to_label}
                    </span>
                  )}
                </div>

                <p className="mt-0.5 text-sm text-muted-foreground">
                  {/* The decision the approver actually made wins over the
                      step's lifecycle state, so "sent back" and "cancelled"
                      are not both reported as "rejected". */}
                  {(() => {
                    const note = (step.decision && DECISION_NOTE[step.decision]) || style.note
                    return step.approver_name ? `${note} by ${step.approver_name}` : note
                  })()}
                  {when ? ` · ${when}` : ''}
                </p>

                {step.comment && (
                  <p className="mt-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                    “{step.comment}”
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {/*
        The line below says exactly who can act, including the administrator
        escape hatch. An earlier draft read "Nobody else can approve it in their
        place until it is escalated", which is not true: roleMayDecide()
        short-circuits for role_key 'administrator' before any step check, and
        every live tenant grants Administrator approve_leave. UI copy that
        asserts a guarantee the server does not make is its own kind of defect.
      */}
      {current && (
        <p className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-foreground">
          Waiting on <span className="font-semibold">{current.role_label}</span>.
          {current.escalated_at
            ? ` Overdue — ${current.escalated_to_label} can now decide it as well.`
            : ' Only they or an administrator can act on it until it is escalated.'}
        </p>
      )}
    </div>
  )
}
