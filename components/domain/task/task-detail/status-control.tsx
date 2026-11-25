'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import type { DeadlineExtension, MyTask } from '@/types/task-management'
import { formatDay } from './date-utils'
import { ExtensionRequestForm } from './extension-request-form'
import { statusChoices, type StatusOption } from './use-task-detail'

export type StatusMenuView = 'status' | 'extension'

/** What the "Ask for more time" half of the menu needs. Absent, or with nothing to ask or show, the menu is status only. */
export interface StatusMenuExtension {
  /** The server's `can.request_extension`: the assignee, task unfinished, no request open. */
  canRequest: boolean
  /** The request still waiting for a decision, if any - shown instead of the form. */
  pending: DeadlineExtension | null
  busy: boolean
  onRequest: (requestedDate: string, reason: string) => Promise<boolean>
  onWithdraw: (id: string) => Promise<boolean>
}

/**
 * THE STATUS, WHERE IT CAN BE CHANGED WITHOUT SCROLLING - AND WHERE A LATE TASK
 * CAN ASK FOR MORE TIME.
 *
 * It used to be the last section of a long body, under a required-remarks box,
 * so updating a task meant scrolling to the bottom of the popup. It is a chip
 * in the header now: click it, pick the new status, say why, confirm.
 *
 * The same menu holds the second thing an assignee does to a task that is
 * running late, asking for a new due date, as a second view ("Ask for more
 * time"). Before, that lived only in the Extensions tab, under the fold, and
 * people looking for it at the status chip did not find it. The panel owns
 * `open` and `view` so the "Ask for more time" button beside the due date can
 * open this menu straight onto that view.
 *
 * Only the assignee can move a status - the server refuses anyone else - so for
 * everybody else this is the plain badge, not a control that fails when used.
 * The choices are the moves the server accepts from the current status.
 *
 * The statuses are a radio list rather than the shared <Select>: a listbox
 * portalled out of a popover that is itself portalled out of a sheet fights its
 * parents over focus and wheel scrolling, and there are never more than a
 * handful of statuses.
 */
export function StatusControl({ task, options, editable, busy, onSave, open, onOpenChange, view, onViewChange, extension }: {
  task: MyTask
  options: StatusOption[]
  editable: boolean
  busy: boolean
  onSave: (status: string, remarks: string) => Promise<boolean>
  open: boolean
  onOpenChange: (open: boolean) => void
  view: StatusMenuView
  onViewChange: (view: StatusMenuView) => void
  extension?: StatusMenuExtension
}) {
  const current = task.status_label || task.status
  const [status, setStatus] = useState(current)
  const [remarks, setRemarks] = useState('')
  const [attempted, setAttempted] = useState(false)

  const badge = <StatusBadge status={task.status} label={task.status_label || undefined} size="lg" />
  if (!editable) return badge

  const choices = statusChoices(options, task.status)
  const missingRemarks = attempted && !remarks.trim()
  const hasExtensionView = Boolean(extension && (extension.canRequest || extension.pending))
  const showing: StatusMenuView = hasExtensionView ? view : 'status'

  /** Every way out of the menu comes through here, so it always opens again from the task's real status. */
  function close() {
    onOpenChange(false)
    setStatus(current); setRemarks(''); setAttempted(false)
  }

  async function confirm() {
    setAttempted(true)
    if (!remarks.trim()) return
    if (await onSave(status, remarks)) close()
  }

  return (
    <Popover open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <PopoverTrigger
        className="inline-flex items-center gap-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Status: ${current}. Change status`}
      >
        {badge}
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3" onEscapeKeyDown={() => close()}>
        {hasExtensionView ? (
          <div role="group" aria-label="What to do" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm">
            {([['status', 'Change status'], ['extension', 'Ask for more time']] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={showing === id}
                onClick={() => onViewChange(id)}
                className={cn(
                  'min-h-8 rounded-md px-2 font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                  showing === id ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm font-semibold">Change status</p>
        )}

        {showing === 'status' && (
          <>
            <div role="radiogroup" aria-label="New status" className="space-y-1">
              {choices.map((option) => {
                const selected = option.value === status
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setStatus(option.value)}
                    className={cn(
                      'flex min-h-8 w-full items-center gap-2 rounded-md border px-3 text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      selected ? 'border-primary bg-primary/5 font-medium' : 'border-transparent hover:bg-accent',
                    )}
                  >
                    <span aria-hidden="true" className={cn('size-3 rounded-full border', selected ? 'border-primary bg-primary' : 'border-muted-foreground/50')} />
                    {option.label}
                  </button>
                )
              })}
            </div>
            <div className="space-y-1">
              <label htmlFor="status-remarks" className="text-xs font-medium text-muted-foreground">Remarks (required)</label>
              <textarea
                id="status-remarks"
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                placeholder="Progress, or what was completed"
                aria-invalid={missingRemarks}
                className={cn(
                  'min-h-20 w-full rounded-lg border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40',
                  missingRemarks ? 'border-destructive' : 'border-input',
                )}
              />
              {missingRemarks && <p className="text-xs text-red-700 dark:text-red-300">Say why the status is changing.</p>}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => close()} disabled={busy}>Cancel</Button>
              <Button size="sm" onClick={() => void confirm()} disabled={busy}>{busy ? 'Saving…' : 'Confirm'}</Button>
            </div>
          </>
        )}

        {showing === 'extension' && extension && (
          extension.pending ? (
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium">Waiting for a decision.</span>{' '}
                You asked to move the due date to <span className="font-medium tabular-nums">{formatDay(extension.pending.requested_date)}</span>.
              </p>
              {extension.pending.reason && <p className="rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">{extension.pending.reason}</p>}
              {extension.pending.can_withdraw && (
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" disabled={extension.busy} onClick={() => void extension.onWithdraw(extension.pending!.id).then((ok) => { if (ok) close() })}>
                    Withdraw request
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <ExtensionRequestForm
              stacked
              due={task.due_date}
              busy={extension.busy}
              onSubmit={async (date, reason) => {
                const sent = await extension.onRequest(date, reason)
                if (sent) close()
                return sent
              }}
            />
          )
        )}
      </PopoverContent>
    </Popover>
  )
}
