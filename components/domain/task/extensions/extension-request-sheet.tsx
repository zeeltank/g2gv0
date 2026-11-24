'use client'

import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import type { DeadlineExtension } from '@/types/task-management'
import { formatDay } from '../task-detail/date-utils'
import { formatDateTime, formatDaysRequested, ordinal } from './extension-format'
import { STATUS_LABELS } from './extension-filter-state'

/**
 * ONE REQUEST, IN FULL, beside the queue it came from.
 *
 * The table row is a summary; this is where a manager reads the whole reason,
 * sees what already happened to the request, and decides. The decision form
 * appears only when the server's flags say this viewer may decide (or withdraw)
 * - never from a guess about who they are - and a decline cannot be sent
 * without its reason, because the requester is owed one.
 */
export function ExtensionRequestSheet({ row, busy, onClose, onOpenTask, onApprove, onDecline, onWithdraw }: {
  row: DeadlineExtension | null
  busy: boolean
  onClose: () => void
  onOpenTask: (taskId: string) => void
  onApprove: (row: DeadlineExtension) => Promise<boolean>
  onDecline: (row: DeadlineExtension, remarks: string) => Promise<boolean>
  onWithdraw: (row: DeadlineExtension) => Promise<boolean>
}) {
  const [declining, setDeclining] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [attempted, setAttempted] = useState(false)

  const reset = () => { setDeclining(false); setRemarks(''); setAttempted(false) }

  async function decline() {
    if (!row) return
    setAttempted(true)
    if (!remarks.trim()) return
    if (await onDecline(row, remarks)) reset()
  }

  const days = row ? formatDaysRequested(row.days_requested) : null

  return (
    <Sheet open={row !== null} onOpenChange={(next) => { if (!next) { reset(); onClose() } }}>
      <SheetContent side="right" aria-describedby={undefined} className="flex w-full flex-col gap-0 border-l p-0 sm:w-[480px] sm:max-w-none">
        {row && (
          <>
            <header className="space-y-2 border-b py-4 pl-6 pr-14">
              <SheetTitle className="break-words text-lg font-semibold leading-snug tracking-normal">{row.task_title}</SheetTitle>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={row.status} label={STATUS_LABELS[row.status]} />
                {(row.nth ?? 1) >= 2 && (
                  <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                    {ordinal(row.nth ?? 1)} request on this task
                  </span>
                )}
                <Button variant="outline" size="xs" className="ml-auto" onClick={() => onOpenTask(row.task_id)}>
                  <ExternalLink className="mr-1 size-3.5" aria-hidden="true" />Open task
                </Button>
              </div>
            </header>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
              {/* Original -> current -> requested: approving overwrites the task's own date, so all three are shown. */}
              <section aria-label="Dates" className="grid grid-cols-3 gap-2 rounded-xl border p-3 text-center">
                {([
                  ['Original', row.original_date ?? (row.status === 'approved' ? null : row.current_due_date)],
                  ['Due now', row.current_due_date],
                  ['Requested', row.requested_date],
                ] as const).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-sm font-semibold tabular-nums">{value ? formatDay(value) : '-'}</p>
                  </div>
                ))}
                {days && <p className="col-span-3 text-xs text-muted-foreground">Asks for <span className="font-semibold tabular-nums text-foreground">{days}</span> more{row.overdue_at_request ? ' - and was already past its date when asked' : ''}.</p>}
              </section>

              <dl className="grid grid-cols-[92px_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
                <dt className="text-xs font-medium text-muted-foreground">Requested by</dt><dd>{row.requested_by ?? '-'}</dd>
                <dt className="text-xs font-medium text-muted-foreground">Assignee</dt><dd>{row.assignee ?? '-'}</dd>
                <dt className="text-xs font-medium text-muted-foreground">Department</dt><dd>{row.department ?? '-'}</dd>
                <dt className="text-xs font-medium text-muted-foreground">Priority</dt><dd>{row.priority ?? '-'}</dd>
              </dl>

              <section aria-label="Reason">
                <h3 className="mb-1 text-xs font-semibold text-muted-foreground">Reason</h3>
                <p className="whitespace-pre-wrap text-sm leading-6">{row.reason || <span className="text-muted-foreground">No reason was given.</span>}</p>
              </section>

              <section aria-label="History">
                <h3 className="mb-2 text-xs font-semibold text-muted-foreground">What happened</h3>
                <ol className="space-y-3 border-l pl-4">
                  <li className="relative text-sm">
                    <span aria-hidden="true" className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary" />
                    <p className="font-medium">Submitted by {row.requested_by ?? 'someone'}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(row.created_at)}</p>
                  </li>
                  {row.status !== 'pending' && (
                    <li className="relative text-sm">
                      <span aria-hidden="true" className={cn('absolute -left-[21px] top-1.5 size-2 rounded-full', row.status === 'approved' ? 'bg-success' : row.status === 'rejected' ? 'bg-destructive' : 'bg-muted-foreground')} />
                      <p className="font-medium">{STATUS_LABELS[row.status]}{row.decided_by ? ` by ${row.decided_by}` : ''}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(row.decided_on)}</p>
                      {row.decision_remarks && <p className="mt-1 rounded-lg bg-muted/40 p-2 text-xs">{row.decision_remarks}</p>}
                    </li>
                  )}
                  {row.status === 'pending' && (
                    <li className="relative text-sm text-muted-foreground">
                      <span aria-hidden="true" className="absolute -left-[21px] top-1.5 size-2 rounded-full border border-muted-foreground bg-background" />
                      Waiting{row.age_days ? ` ${row.age_days} day${row.age_days === 1 ? '' : 's'}` : ''} for a decision
                    </li>
                  )}
                </ol>
              </section>
            </div>

            {(row.can_decide || row.can_withdraw) && (
              <footer className="space-y-2 border-t bg-background p-4">
                {declining ? (
                  <>
                    <label htmlFor="sheet-decline" className="text-xs font-medium text-muted-foreground">Why is this declined? (required)</label>
                    <textarea
                      id="sheet-decline"
                      value={remarks}
                      onChange={(event) => setRemarks(event.target.value)}
                      aria-invalid={attempted && !remarks.trim()}
                      className={cn('min-h-20 w-full rounded-lg border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40', attempted && !remarks.trim() ? 'border-destructive' : 'border-input')}
                    />
                    {attempted && !remarks.trim() && <p className="text-xs text-destructive">The requester is owed a reason.</p>}
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" disabled={busy} onClick={reset}>Cancel</Button>
                      <Button variant="destructive" size="sm" disabled={busy} onClick={() => void decline()}>Decline request</Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-wrap justify-end gap-2">
                    {row.can_withdraw && <Button variant="outline" size="sm" disabled={busy} onClick={() => void onWithdraw(row)}>Withdraw request</Button>}
                    {row.can_decide && (
                      <>
                        <Button variant="outline" size="sm" className="text-destructive" disabled={busy} onClick={() => setDeclining(true)}>Decline…</Button>
                        <Button size="sm" disabled={busy} onClick={() => void onApprove(row)}>Approve</Button>
                      </>
                    )}
                  </div>
                )}
              </footer>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
