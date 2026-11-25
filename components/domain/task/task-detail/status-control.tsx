'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import type { MyTask } from '@/types/task-management'
import { statusChoices, type StatusOption } from './use-task-detail'

/**
 * THE STATUS, WHERE IT CAN BE CHANGED WITHOUT SCROLLING.
 *
 * It used to be the last section of a long body, under a required-remarks box,
 * so updating a task meant scrolling to the bottom of the popup. It is a chip
 * in the header now: click it, pick the new status, say why, confirm.
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
export function StatusControl({ task, options, editable, busy, onSave }: {
  task: MyTask
  options: StatusOption[]
  editable: boolean
  busy: boolean
  onSave: (status: string, remarks: string) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const current = task.status_label || task.status
  const [status, setStatus] = useState(current)
  const [remarks, setRemarks] = useState('')
  const [attempted, setAttempted] = useState(false)

  const badge = <StatusBadge status={task.status} label={task.status_label || undefined} size="lg" />
  if (!editable) return badge

  const choices = statusChoices(options, task.status)
  const missingRemarks = attempted && !remarks.trim()

  async function confirm() {
    setAttempted(true)
    if (!remarks.trim()) return
    if (await onSave(status, remarks)) {
      setOpen(false); setRemarks(''); setAttempted(false)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        // Always start from the task's real status, not a half-made choice.
        if (next) { setStatus(current); setRemarks(''); setAttempted(false) }
      }}
    >
      <PopoverTrigger
        className="inline-flex items-center gap-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Status: ${current}. Change status`}
      >
        {badge}
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3" onEscapeKeyDown={() => setOpen(false)}>
        <p className="text-sm font-semibold">Change status</p>
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
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button size="sm" onClick={() => void confirm()} disabled={busy}>{busy ? 'Saving…' : 'Confirm'}</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
