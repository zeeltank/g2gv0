'use client'

import { useState, type ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Spinner } from '@/components/ui/spinner'
import { StatusBadge } from '@/components/ui/status-badge'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { MyTask, RecurrenceRule, WorkspaceTask } from '@/types/task-management'
import { PriorityBadge } from '../priority-badge'
import { RecurrenceRulePicker } from '../recurrence-rule-picker'
import { dueBadge, formatDay, formatDayShort, relativeTime, type DueTone } from './date-utils'

const TONE_CLASS: Record<DueTone, string> = {
  overdue: 'border-destructive/40 bg-destructive/10 text-destructive',
  soon: 'border-warning/40 bg-warning/10 text-warning',
  later: 'border-border bg-muted text-muted-foreground',
  done: 'border-success/30 bg-success/10 text-success',
}

/** "Overdue 3d" / "Due in 2d" / "Done". The words carry the meaning; the colour only backs them up. */
export function DueChip({ due, finished, className }: { due: string | null; finished: boolean; className?: string }) {
  const badge = dueBadge(due, finished)
  if (!badge) return null
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium leading-none', TONE_CLASS[badge.tone], className)}>
      {badge.label}
    </span>
  )
}

const REMINDER_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'No reminder', value: 'none' },
  { label: '5 minutes before', value: '5' },
  { label: '30 minutes before', value: '30' },
  { label: '1 hour before', value: '60' },
  { label: '1 day before', value: '1440' },
  { label: '1 week before', value: '10080' },
]

function describeRecurrence(rule: RecurrenceRule): string {
  const unit = { daily: 'day', weekly: 'week', monthly: 'month' }[rule.frequency]
  const every = rule.interval > 1 ? `${rule.interval} ${unit}s` : unit
  return `Every ${every}${rule.until ? `, until ${formatDay(rule.until)}` : ', no end date'}`
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-h-8 grid-cols-[92px_minmax(0,1fr)] items-start gap-x-3 py-1.5">
      <dt className="pt-0.5 text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  )
}

function Person({ name }: { name: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?'
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">{initials}</span>
      <span className="truncate">{name}</span>
    </span>
  )
}

/**
 * THE FACTS ABOUT A TASK, AS A LABELLED LIST.
 *
 * This replaced six bordered cards in two columns, which spent a screen and a
 * half on six values and pushed the description off the first screen. A
 * `<dl>` carries the same facts in about a third of the height, reads as a
 * list to a screen reader, and has room for the ones the cards never showed:
 * the start date, project, hours and the delay reason.
 *
 * Status is not edited here - the header chip does that - and the plain badge
 * is repeated only so the list is complete when the layout is one column.
 */
export function PropertiesList({
  task, workspace, canManage, busy, recurrence, reminderMinutes,
  onToggleVisibility, onSetReminder, onSaveRecurrence, onStopRepeat,
}: {
  task: MyTask
  workspace: WorkspaceTask | null
  canManage: boolean
  busy: string | null
  recurrence: RecurrenceRule | null
  reminderMinutes: number | null
  onToggleVisibility: () => void
  onSetReminder: (minutes: number | null) => void
  onSaveRecurrence: (rule: RecurrenceRule) => Promise<boolean>
  onStopRepeat: () => void
}) {
  const [repeatOpen, setRepeatOpen] = useState(false)
  const [draft, setDraft] = useState<RecurrenceRule | null>({ frequency: 'weekly', interval: 1, until: null })
  const finished = task.status === 'COMPLETED'
  const start = task.planned_start_date ?? workspace?.planned_start_date ?? null
  const project = workspace?.project && workspace.project !== 'Unassigned' ? workspace.project : ''
  const hours = [
    task.estimated_hours != null ? `Est. ${task.estimated_hours}h` : null,
    task.actual_hours != null ? `Logged ${task.actual_hours}h` : null,
    task.remaining_hours != null ? `Left ${task.remaining_hours}h` : null,
  ].filter(Boolean)

  return (
    <dl className="divide-y divide-border/60">
      <Row label="Status"><StatusBadge status={task.status} label={task.status_label || undefined} size="sm" /></Row>
      <Row label="Assignee"><Person name={task.assignee} /></Row>
      <Row label="Assigned by"><Person name={task.owner} /></Row>
      <Row label="Dates">
        <div className="space-y-1">
          <p className="tabular-nums">
            {start && start !== task.due_date
              ? <>{formatDayShort(start)} <span aria-hidden="true">→</span><span className="sr-only">to</span> {formatDay(task.due_date, 'No due date')}</>
              : formatDay(task.due_date, 'No due date')}
          </p>
          <DueChip due={task.due_date} finished={finished} />
        </div>
      </Row>
      <Row label="Priority"><PriorityBadge priority={task.priority ?? task.task_type} /></Row>
      <Row label="Department">{task.department || <span className="text-muted-foreground">Not set</span>}</Row>
      {project && <Row label="Project">{project}</Row>}
      {hours.length > 0 && <Row label="Hours"><span className="tabular-nums">{hours.join(' · ')}</span></Row>}
      {task.approve_status && (
        <Row label="Review">
          <StatusBadge
            status={task.approve_status}
            label={task.approve_status === 'rejected' ? 'Sent back' : task.approve_status === 'approved' ? 'Approved' : 'Awaiting review'}
            size="sm"
          />
        </Row>
      )}
      {(task.delay_category || task.delay_reason) && (
        <Row label="Delay">{[task.delay_category, task.delay_reason].filter(Boolean).join(' - ')}</Row>
      )}

      <Row label="Visibility">
        {canManage ? (
          <label className="flex cursor-pointer items-center gap-2">
            <Switch checked={task.visibility === 'PRIVATE'} onChange={onToggleVisibility} disabled={busy === 'visibility'} aria-label="Private task" />
            <span className="flex items-center gap-1 text-muted-foreground"><Lock className="size-3.5" aria-hidden="true" />Private</span>
          </label>
        ) : (
          <span className="text-muted-foreground">{task.visibility === 'PRIVATE' ? 'Private' : 'Visible to the team'}</span>
        )}
      </Row>

      <Row label="Repeat">
        {recurrence ? (
          <div className="space-y-1">
            <p>{describeRecurrence(recurrence)}</p>
            {canManage && (
              <Button variant="ghost" size="xs" className="-ml-2 text-destructive" onClick={onStopRepeat} disabled={busy === 'recurrence'}>
                Stop repeating
              </Button>
            )}
          </div>
        ) : canManage ? (
          <Popover open={repeatOpen} onOpenChange={setRepeatOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="xs">Set up repeat</Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-3">
              <RecurrenceRulePicker value={draft} onChange={setDraft} />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setRepeatOpen(false)}>Cancel</Button>
                <Button
                  size="sm"
                  disabled={busy === 'recurrence' || !draft}
                  onClick={async () => { if (draft && await onSaveRecurrence(draft)) setRepeatOpen(false) }}
                >
                  {busy === 'recurrence' ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        ) : <span className="text-muted-foreground">Does not repeat</span>}
      </Row>

      <Row label="Reminder">
        <span className="flex items-center gap-2">
          <select
            value={reminderMinutes === null ? 'none' : String(reminderMinutes)}
            onChange={(event) => onSetReminder(event.target.value === 'none' ? null : Number(event.target.value))}
            disabled={busy === 'reminder'}
            aria-label="Reminder"
            className="h-8 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {REMINDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          {busy === 'reminder' && <Spinner className="size-4" />}
        </span>
      </Row>

      <div className="pt-3 text-xs text-muted-foreground">
        {task.created_at && <p>Created {relativeTime(task.created_at)}</p>}
        {task.updated_at && <p>Updated {relativeTime(task.updated_at)}</p>}
      </div>
    </dl>
  )
}
