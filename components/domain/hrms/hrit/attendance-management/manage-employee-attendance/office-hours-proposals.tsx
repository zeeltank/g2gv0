'use client'

import * as React from 'react'
import { AlertTriangle, Check, Inbox, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { useOfficeHoursRequests } from '@/hooks/use-office-hours-requests'
import { cn } from '@/lib/utils'
import type { OfficeHoursDay, OfficeHoursRequestRow } from '@/services/hrms'

const LABEL: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
}

/**
 * Employees' office-hours proposals, awaiting a decision.
 *
 * ── WHY IT LIVES IN THE OFFICE HOURS TAB ────────────────────────────────────
 *
 * Three places were possible: a fourth tab on this desk, a reuse of
 * `RegularisationQueue`, or here.
 *
 * Here, because an approver deciding "do I allow Priya's 10:00 start" needs the
 * DEPARTMENT TEMPLATE beside it - and that context exists on this tab and
 * nowhere else. `SchedulePreviewWeekday.would_change` is already the number for
 * "whose hours differ from the department's", and an employee-set roster is now
 * a fourth bucket in that same preview. The question and its context belong
 * together.
 *
 * `RegularisationQueue` was not reused: it is hard-wired to its own service and
 * row type, so reusing it would mean either a second component with the same
 * layout or generifying one that two screens depend on. Its IDIOMS are reused -
 * the 403-means-not-an-approver try/catch, returning null when empty - which is
 * the part worth copying.
 *
 * ── RENDERS NOTHING UNLESS THE SERVER SAYS SO ───────────────────────────────
 *
 * No role check in this component. It asks for `?scope=team` and the endpoint
 * refuses anyone who may not decide; `permitted` comes from that answer. A
 * component gating itself on a role is a guess that drifts from the server's
 * (F-91).
 */
export function OfficeHoursProposals({ onDecided }: { onDecided?: () => void }) {
  const { rows, isLoading, permitted, busyId, error, notice, setError, setNotice, decide } =
    useOfficeHoursRequests()

  const [comments, setComments] = React.useState<Record<number, string>>({})

  // Not an approver, or nothing waiting. No empty card either way - the same
  // rule RegularisationQueue applies.
  if (isLoading) {
    return <Skeleton className="h-28 w-full" />
  }

  if (!permitted || rows.length === 0) {
    return null
  }

  const act = async (row: OfficeHoursRequestRow, status: 'approved' | 'rejected') => {
    const ok = await decide(row.id, status, comments[row.id]?.trim() || undefined)
    if (ok) {
      setComments((current) => {
        const next = { ...current }
        delete next[row.id]
        return next
      })
      // The department preview's counts move when an approval lands - an
      // employee-set roster is a bucket in it.
      onDecided?.()
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <Inbox className="size-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-foreground">
          {rows.length} office-hours {rows.length === 1 ? 'request' : 'requests'} waiting on you
        </h3>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={() => setError(null)}>Dismiss</Button>
          </AlertDescription>
        </Alert>
      )}

      {notice && (
        <Alert className="border-emerald-500/40 bg-emerald-500/10">
          <Check className="size-4 text-emerald-600" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span className="text-emerald-800 dark:text-emerald-200">{notice}</span>
            <Button variant="ghost" size="sm" onClick={() => setNotice(null)}>Dismiss</Button>
          </AlertDescription>
        </Alert>
      )}

      {rows.map((row) => (
        <ProposalCard
          key={row.id}
          row={row}
          comment={comments[row.id] ?? ''}
          onComment={(value) => setComments((current) => ({ ...current, [row.id]: value }))}
          busy={busyId === row.id}
          onApprove={() => void act(row, 'approved')}
          onReject={() => void act(row, 'rejected')}
        />
      ))}
    </div>
  )
}

function ProposalCard({
  row, comment, onComment, busy, onApprove, onReject,
}: {
  row: OfficeHoursRequestRow
  comment: string
  onComment: (value: string) => void
  busy: boolean
  onApprove: () => void
  onReject: () => void
}) {
  /** The requested week, with what each day says now beside it. */
  const diff = React.useMemo(() => {
    const currentByDay = new Map(row.current_week.map((day) => [day.weekday, day]))
    const templateByDay = new Map((row.template_week ?? []).map((day) => [day.weekday, day]))

    return row.week.map((requested) => ({
      requested,
      current: currentByDay.get(requested.weekday) ?? null,
      template: templateByDay.get(requested.weekday) ?? null,
    }))
  }, [row])

  const show = (day: OfficeHoursDay | null) => {
    if (!day) return '—'
    // null means never set, which is not the same as "not a working day".
    if (day.is_working === null) return 'not set'
    if (!day.is_working) return 'not worked'
    if (!day.in_time && !day.out_time) return 'worked, no hours'
    return `${day.in_time ?? '--:--'}–${day.out_time ?? '--:--'}`
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {row.employee_name || `Employee ${row.user_id}`}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {[row.employee_no, row.department_name].filter(Boolean).join(' · ') || 'No department'}
          </p>
        </div>
        {row.submitted_at && (
          <p className="text-xs text-muted-foreground tabular-nums">
            asked {row.submitted_at.slice(0, 10)}
          </p>
        )}
      </div>

      <p className="mt-2 text-sm text-foreground">&ldquo;{row.reason}&rdquo;</p>

      <div className="mt-3 overflow-x-auto rounded border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th scope="col" className="px-2 py-1.5 font-semibold">Day</th>
              <th scope="col" className="px-2 py-1.5 font-semibold">Now</th>
              <th scope="col" className="px-2 py-1.5 font-semibold">Asking for</th>
              {/* The department's own template, muted - the context that makes
                  this tab the right home for the panel. */}
              <th scope="col" className="px-2 py-1.5 font-semibold">Department</th>
            </tr>
          </thead>
          <tbody>
            {diff.map(({ requested, current, template }) => (
              <tr key={requested.weekday} className="border-b border-border last:border-0">
                <td className="px-2 py-1.5 font-medium text-foreground">
                  {LABEL[requested.weekday] ?? requested.weekday}
                </td>
                <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{show(current)}</td>
                <td className="px-2 py-1.5 font-medium tabular-nums text-primary">
                  {show(requested)}
                </td>
                <td className="px-2 py-1.5 tabular-nums text-muted-foreground/70">
                  {show(template)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/*
        * Said where it is true, in the same words the apply confirmation uses.
        * Approving this writes tbluser, and those columns decide what counts as
        * late and what counts as a full day.
        */}
      <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
        Office hours decide what counts as late and what counts as a full day, so approving this
        affects this employee&apos;s future attendance and payable days. It is also not
        effective-dated &mdash; it changes how earlier days are scored too.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input
          value={comment}
          onChange={(event) => onComment(event.target.value)}
          placeholder="Comment (optional, shown to the employee)"
          maxLength={255}
          className="h-8 min-w-[16rem] flex-1 text-xs"
        />
        <Button size="sm" className="h-8" onClick={onApprove} disabled={busy}>
          <Check className="mr-1.5 size-3" />
          {busy ? 'Saving…' : 'Approve'}
        </Button>
        <Button size="sm" variant="outline" className="h-8" onClick={onReject} disabled={busy}>
          <X className="mr-1.5 size-3" />
          Reject
        </Button>
      </div>
    </div>
  )
}
