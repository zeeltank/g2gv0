'use client'

import { useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import type { DeadlineExtension, MyTask } from '@/types/task-management'
import { formatDay, localDay, parseDay, relativeTime } from './date-utils'

/**
 * Asking for more time, and deciding on a request, from the task itself.
 *
 * WHO SEES WHAT comes from the server's `can` flags, not from guessing at
 * ownership: `request_extension` is the assignee on an unfinished task with no
 * request open, and `decide_extension` is an administrator or the task's owner.
 * The old buttons were keyed to the owner while the server demanded an elevated
 * role, so owners were shown buttons that answered 403 and administrators were
 * shown none.
 *
 * A rejection must say why - the requester is owed the reason - so Reject opens
 * a remarks box rather than deciding on the click. Approving needs no reason.
 */
export function ExtensionTab({ task, extensions, busy, onRequest, onDecide, onWithdraw }: {
  task: MyTask
  extensions: DeadlineExtension[]
  busy: boolean
  onRequest: (requestedDate: string, reason: string) => Promise<boolean>
  onDecide: (id: string, decision: 'approve' | 'reject', remarks: string) => Promise<boolean>
  onWithdraw: (id: string) => Promise<boolean>
}) {
  const can = task.can
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [remarks, setRemarks] = useState('')
  const [attempted, setAttempted] = useState(false)

  // The new date has to be later than the one it replaces, and later than today.
  const current = parseDay(task.due_date)
  const earliest = (() => {
    const today = parseDay(localDay(0))!
    const base = current && current > today ? current : today
    const next = new Date(base); next.setDate(next.getDate() + 1)
    return localDay(Math.round((next.getTime() - today.getTime()) / 86_400_000))
  })()

  async function submitRequest() {
    if (!date || !reason.trim()) return
    if (await onRequest(date, reason)) { setDate(''); setReason('') }
  }

  async function confirmReject(id: string) {
    setAttempted(true)
    if (!remarks.trim()) return
    if (await onDecide(id, 'reject', remarks)) { setRejecting(null); setRemarks(''); setAttempted(false) }
  }

  return (
    <div className="space-y-4 pt-3">
      {extensions.length === 0 && !can?.request_extension && (
        <p className="rounded-xl border border-dashed py-6 text-center text-sm text-muted-foreground">No extension requests for this task.</p>
      )}

      <ul className="space-y-2">
        {extensions.map((extension) => (
          <li key={extension.id} className="rounded-xl border bg-card p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {/* Original -> requested, because approving overwrites the task's own date. */}
                <span className="font-semibold tabular-nums">
                  {extension.original_date ? <>{formatDay(extension.original_date)} <span aria-hidden="true">→</span><span className="sr-only">to</span> </> : null}
                  {formatDay(extension.requested_date)}
                </span>
                {typeof extension.days_requested === 'number' && extension.days_requested > 0 && (
                  <span className="ml-1.5 tabular-nums text-muted-foreground">(+{extension.days_requested}d)</span>
                )}
                <span className="text-muted-foreground"> requested by {extension.requested_by ?? 'someone'}</span>
              </span>
              {/* Lower case on purpose: the badge's colour map is keyed on it, and
                  upper-casing used to leave "approved" and "rejected" plain grey. */}
              <StatusBadge status={extension.status} size="sm" />
            </div>
            {extension.reason && <p className="mt-1.5 text-muted-foreground">{extension.reason}</p>}
            {extension.decision_remarks && (
              <p className="mt-1.5 rounded-lg bg-muted/40 p-2 text-xs">
                <span className="font-medium">{extension.decided_by ?? 'Decision'}:</span> {extension.decision_remarks}
              </p>
            )}
            {extension.decided_on && <p className="mt-1 text-xs text-muted-foreground">Decided {relativeTime(extension.decided_on)}</p>}

            {extension.can_withdraw && (
              <div className="mt-3">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void onWithdraw(extension.id)}>Withdraw request</Button>
              </div>
            )}

            {extension.status === 'pending' && can?.decide_extension && (
              rejecting === extension.id ? (
                <div className="mt-3 space-y-2">
                  <label htmlFor={`reject-${extension.id}`} className="text-xs font-medium text-muted-foreground">Why is this declined? (required)</label>
                  <textarea
                    id={`reject-${extension.id}`}
                    value={remarks}
                    onChange={(event) => setRemarks(event.target.value)}
                    aria-invalid={attempted && !remarks.trim()}
                    className={cn('min-h-16 w-full rounded-lg border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-primary/40', attempted && !remarks.trim() ? 'border-destructive' : 'border-input')}
                  />
                  {attempted && !remarks.trim() && <p className="text-xs text-destructive">The requester is owed a reason.</p>}
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" disabled={busy} onClick={() => void confirmReject(extension.id)}>Decline request</Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setRejecting(null); setRemarks(''); setAttempted(false) }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" disabled={busy} onClick={() => void onDecide(extension.id, 'approve', '')}>Approve</Button>
                  <Button size="sm" variant="outline" className="text-destructive" disabled={busy} onClick={() => { setRejecting(extension.id); setRemarks(''); setAttempted(false) }}>Decline…</Button>
                </div>
              )
            )}
          </li>
        ))}
      </ul>

      {/* One open request per task: the form only appears when the server says a new one is allowed. */}
      {can?.request_extension && (
        <section className="space-y-2 rounded-xl border p-3" aria-label="Request an extension">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><CalendarClock className="size-4" aria-hidden="true" />Ask for more time</h3>
          <p className="text-xs text-muted-foreground">Currently due {formatDay(task.due_date, 'on no set date')}.</p>
          <div className="grid gap-2 @lg/panel:grid-cols-[11rem_1fr]">
            <input
              type="date"
              value={date}
              min={earliest}
              onChange={(event) => setDate(event.target.value)}
              aria-label="New due date"
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why is more time needed?"
              aria-label="Reason"
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex justify-end">
            <Button size="sm" disabled={busy || !date || !reason.trim()} onClick={() => void submitRequest()}>
              {busy ? 'Sending…' : 'Send request'}
            </Button>
          </div>
        </section>
      )}
    </div>
  )
}
