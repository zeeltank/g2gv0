'use client'

import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDay, localDay, parseDay } from './date-utils'

/** The earliest day a deadline can move to: after the current one, and after today. */
export function earliestExtensionDate(due: string | null | undefined): string {
  const today = parseDay(localDay(0))!
  const current = parseDay(due)
  const base = current && current > today ? current : today
  const next = new Date(base)
  next.setDate(next.getDate() + 1)
  return localDay(Math.round((next.getTime() - today.getTime()) / 86_400_000))
}

/**
 * ASKING FOR MORE TIME: a new due date and why. One form, used in two places -
 * the status menu in the panel header (where people look when a task is late)
 * and the Extensions tab - so the rule for the earliest date and the two
 * required fields live here once.
 *
 * `onSubmit` says whether the request went through; the fields are cleared only
 * then, so a failed send does not lose what was typed.
 */
export function ExtensionRequestForm({ due, busy, stacked, onSubmit }: {
  due: string | null | undefined
  busy: boolean
  /** One field per row (the narrow status menu) rather than date and reason side by side. */
  stacked?: boolean
  onSubmit: (requestedDate: string, reason: string) => Promise<boolean>
}) {
  const id = useId()
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const ready = Boolean(date) && Boolean(reason.trim())

  async function send() {
    if (!ready) return
    if (await onSubmit(date, reason)) { setDate(''); setReason('') }
  }

  const field = 'rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Currently due {formatDay(due, 'on no set date')}.</p>
      <div className={cn('grid gap-2', !stacked && '@lg/panel:grid-cols-[11rem_1fr]')}>
        <div className="space-y-1">
          <label htmlFor={`${id}-date`} className={cn('text-xs font-medium text-muted-foreground', !stacked && 'sr-only')}>New due date</label>
          <input
            id={`${id}-date`}
            type="date"
            value={date}
            min={earliestExtensionDate(due)}
            onChange={(event) => setDate(event.target.value)}
            className={cn(field, 'h-9 w-full')}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-reason`} className={cn('text-xs font-medium text-muted-foreground', !stacked && 'sr-only')}>Why is more time needed? (required)</label>
          {stacked ? (
            <textarea
              id={`${id}-reason`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="What is holding this up?"
              className={cn(field, 'min-h-16 w-full py-2')}
            />
          ) : (
            <input
              id={`${id}-reason`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why is more time needed?"
              className={cn(field, 'h-9 w-full')}
            />
          )}
        </div>
      </div>
      <div className="flex justify-end">
        <Button size="sm" disabled={busy || !ready} onClick={() => void send()}>
          {busy ? 'Sending…' : 'Send request'}
        </Button>
      </div>
    </div>
  )
}
