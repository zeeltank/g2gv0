'use client'

/**
 * The project's schedule — what is late, what is next.
 *
 * ── WHY THIS IS NOT A GANTT ─────────────────────────────────────────────────
 *
 * It was. It drew one bar per workstream against a shared axis, and on a real
 * project it rendered four identical full-width bars — because every workstream
 * is created carrying the PROJECT's own start and due date, and nobody had
 * changed them. A Gantt needs variation along a time axis to say anything; with
 * none, it is four rectangles and a rating of 1 out of 10, fairly given.
 *
 * Measured on the customer's own project: 4 workstream windows all identical,
 * 19 deliverables with zero due dates, 0 checkpoints, and 5 dated tasks. The
 * only real schedule information was those 5 dates — and three of them were
 * already overdue, which the chart had no way of saying.
 *
 * So this answers the question a schedule is actually asked: **what is late,
 * and what is next.** Lateness is the fact that changes what somebody does
 * today; a bar's left edge is not.
 *
 * ── ONE LIST, NOT THREE ─────────────────────────────────────────────────────
 *
 * Tasks, deliverables and checkpoints are three tables and one question. A
 * reader wanting to know what is due this week does not care which table a date
 * came from, so they are merged and sorted by date, with the kind shown as a
 * quiet label rather than as three separate sections.
 *
 * ── ABSENCE IS THE HEADLINE, NOT A FOOTNOTE ─────────────────────────────────
 *
 * Most of this project has no dates at all. A view that silently omitted those
 * items would report a near-empty schedule as if the project were nearly done.
 * The undated count is therefore a row of its own, with the reason and the way
 * to fix it.
 */

import { useMemo } from 'react'
import { AlertTriangle, CalendarDays, CheckCircle2, CircleDot, Flag, ListTodo } from 'lucide-react'

import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import type { ProjectRecord, ScheduleItem, WorkstreamSummary } from '@/types/task-management'

type Kind = 'TASK' | 'DELIVERABLE' | 'CHECKPOINT'

interface Row {
  id: string
  kind: Kind
  title: string
  date: string
  done: boolean
  status: string | null
  who: string | null
  workstream: string | null
  critical?: boolean
}

const KIND_ICON: Record<Kind, React.ElementType> = {
  TASK: ListTodo,
  DELIVERABLE: Flag,
  CHECKPOINT: CircleDot,
}

const KIND_LABEL: Record<Kind, string> = {
  TASK: 'Task',
  DELIVERABLE: 'Deliverable',
  CHECKPOINT: 'Checkpoint',
}

/** Midnight today, so "overdue" is a whole-day question, not a clock question. */
function startOfToday(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const DAY = 86_400_000

export function WorkstreamSchedule({
  project, workstreams, schedule, onOpenWorkstream, onOpenTask,
}: {
  project: ProjectRecord
  workstreams: WorkstreamSummary[]
  /** Dated deliverables and checkpoints, from the workstream payload. */
  schedule: ScheduleItem[]
  onOpenWorkstream: (id: string) => void
  onOpenTask: (id: string) => void
}) {
  const today = startOfToday()

  const { buckets, undated } = useMemo(() => {
    const at = (d: string) => {
      const t = new Date(`${d}T00:00:00`).getTime()
      return Number.isNaN(t) ? null : t
    }

    const rows: Row[] = []

    for (const t of project.tasks ?? []) {
      if (!t.due_date) continue
      rows.push({
        id: `task-${t.id}`, kind: 'TASK', title: t.title, date: t.due_date,
        done: (t.status ?? '').toUpperCase() === 'COMPLETED',
        status: t.status, who: t.assignee, workstream: t.workstream_name,
      })
    }

    for (const s of schedule) {
      const done = s.kind === 'DELIVERABLE'
        ? ['DELIVERED', 'ACCEPTED'].includes((s.status ?? '').toUpperCase())
        : (s.status ?? '').toUpperCase() === 'COMPLETED'
      rows.push({
        id: s.id, kind: s.kind, title: s.title, date: s.date, done,
        status: s.status, who: null, workstream: s.workstream_name,
        critical: s.is_critical,
      })
    }

    rows.sort((a, b) => a.date.localeCompare(b.date))

    /*
     * Buckets are relative to today, not calendar months. "Overdue" and "this
     * week" are what change somebody's afternoon; "August" is not.
     */
    const overdue: Row[] = [], todayRows: Row[] = [], week: Row[] = [], later: Row[] = [], done: Row[] = []
    for (const r of rows) {
      const t = at(r.date)
      if (r.done) { done.push(r); continue }
      if (t === null) { later.push(r); continue }
      if (t < today) overdue.push(r)
      else if (t === today) todayRows.push(r)
      else if (t <= today + 7 * DAY) week.push(r)
      else later.push(r)
    }

    // Everything the project owns that CANNOT be placed on a schedule.
    const datedTaskIds = new Set(rows.filter((r) => r.kind === 'TASK').map((r) => r.id))
    const undatedTasks = (project.tasks ?? []).filter((t) => !datedTaskIds.has(`task-${t.id}`)).length
    const undatedDeliverables = workstreams.reduce((n, w) => n + w.health.deliverables.total, 0)
      - schedule.filter((s) => s.kind === 'DELIVERABLE').length
    const undatedCheckpoints = workstreams.reduce((n, w) => n + w.health.milestones.total, 0)
      - schedule.filter((s) => s.kind === 'CHECKPOINT').length

    return {
      buckets: [
        { key: 'overdue', label: 'Overdue', rows: overdue, tone: 'destructive' as const },
        { key: 'today', label: 'Due today', rows: todayRows, tone: 'warning' as const },
        { key: 'week', label: 'Next 7 days', rows: week, tone: 'default' as const },
        { key: 'later', label: 'Later', rows: later, tone: 'default' as const },
        { key: 'done', label: 'Completed', rows: done, tone: 'success' as const },
      ].filter((b) => b.rows.length > 0),
      undated: {
        tasks: undatedTasks,
        deliverables: Math.max(0, undatedDeliverables),
        checkpoints: Math.max(0, undatedCheckpoints),
      },
    }
  }, [project.tasks, schedule, workstreams, today])

  const undatedTotal = undated.tasks + undated.deliverables + undated.checkpoints
  const overdueCount = buckets.find((b) => b.key === 'overdue')?.rows.length ?? 0

  if (buckets.length === 0 && undatedTotal === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing on this project carries a date yet.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      {/* The one sentence somebody needs before reading anything else. */}
      <p className={cn(
        'rounded-lg border px-3 py-2 text-sm',
        overdueCount > 0
          ? 'border-destructive/30 bg-destructive/5 text-destructive'
          : 'border-border bg-muted/30 text-muted-foreground',
      )}>
        {overdueCount > 0 ? (
          <>
            <AlertTriangle className="mr-1.5 inline size-4 align-text-bottom" aria-hidden="true" />
            <strong className="font-semibold">{overdueCount}</strong>{' '}
            {overdueCount === 1 ? 'item is' : 'items are'} past their date.
          </>
        ) : (
          <>
            <CheckCircle2 className="mr-1.5 inline size-4 align-text-bottom" aria-hidden="true" />
            Nothing is overdue.
          </>
        )}
        {project.due_date && (
          <span className="ml-1">
            The project runs to {friendly(project.due_date)}.
          </span>
        )}
      </p>

      {buckets.map((bucket) => (
        <section key={bucket.key} className="space-y-1">
          <h3 className="flex items-center gap-2">
            <span className={cn('size-2 shrink-0 rounded-full',
              bucket.tone === 'destructive' ? 'bg-destructive'
                : bucket.tone === 'warning' ? 'bg-warning'
                  : bucket.tone === 'success' ? 'bg-success' : 'bg-muted-foreground/40')}
              aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">{bucket.label}</span>
            <span className="text-[11px] tabular-nums text-muted-foreground">{bucket.rows.length}</span>
          </h3>

          <ul className="divide-y divide-border rounded-lg border">
            {bucket.rows.map((row) => (
              <ScheduleRow
                key={row.id} row={row} today={today}
                onOpenWorkstream={onOpenWorkstream} onOpenTask={onOpenTask}
                workstreams={workstreams}
              />
            ))}
          </ul>
        </section>
      ))}

      {/* Not a footnote. On this project it is most of the work. */}
      {undatedTotal > 0 && (
        <section className="rounded-lg border border-dashed p-3">
          <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <CalendarDays className="size-3.5" aria-hidden="true" /> No date set
            <span className="tabular-nums">{undatedTotal}</span>
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {[
              undated.deliverables > 0 && `${undated.deliverables} deliverable${undated.deliverables === 1 ? '' : 's'}`,
              undated.tasks > 0 && `${undated.tasks} task${undated.tasks === 1 ? '' : 's'}`,
              undated.checkpoints > 0 && `${undated.checkpoints} checkpoint${undated.checkpoints === 1 ? '' : 's'}`,
            ].filter(Boolean).join(', ')}{' '}
            {undatedTotal === 1 ? 'has' : 'have'} no date, so {undatedTotal === 1 ? 'it does' : 'they do'} not
            appear above. Open a workstream and give a deliverable a due date to schedule it.
          </p>
        </section>
      )}
    </div>
  )
}

function ScheduleRow({
  row, today, workstreams, onOpenWorkstream, onOpenTask,
}: {
  row: Row
  today: number
  workstreams: WorkstreamSummary[]
  onOpenWorkstream: (id: string) => void
  onOpenTask: (id: string) => void
}) {
  const Icon = KIND_ICON[row.kind]
  const stamp = new Date(`${row.date}T00:00:00`).getTime()
  const lateDays = !row.done && !Number.isNaN(stamp) && stamp < today
    ? Math.round((today - stamp) / DAY)
    : 0

  const ws = row.workstream
    ? workstreams.find((w) => w.name === row.workstream)
    : undefined

  const open = () => {
    if (row.kind === 'TASK') onOpenTask(row.id.replace(/^task-/, ''))
    else if (ws) onOpenWorkstream(ws.id)
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2">
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <button type="button" onClick={open}
          className={cn(
            'min-w-0 truncate text-left text-sm outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/40',
            row.done ? 'text-muted-foreground line-through' : 'text-foreground',
          )}>
          {row.title}
        </button>
        {row.critical && (
          <span className="shrink-0 rounded-full bg-destructive/10 px-1.5 text-[10px] font-semibold uppercase tracking-wider text-destructive">
            Critical
          </span>
        )}
      </span>

      <span className="flex shrink-0 items-center gap-2.5 text-[11px] text-muted-foreground">
        <span className="hidden sm:inline">{KIND_LABEL[row.kind]}</span>
        {row.workstream && (
          <span className="hidden max-w-[10rem] truncate md:inline">{row.workstream}</span>
        )}
        {row.who && <span className="hidden max-w-[8rem] truncate lg:inline">{row.who}</span>}
        <span className="tabular-nums">{friendly(row.date)}</span>
        {/* The number that makes "overdue" actionable — six days late is a
            different conversation from one day late. */}
        {lateDays > 0 && (
          <span className="font-semibold tabular-nums text-destructive">
            {lateDays}d late
          </span>
        )}
        {row.status && (
          <StatusBadge status={row.status} size="sm" className="shrink-0">{row.status}</StatusBadge>
        )}
      </span>
    </li>
  )
}

function friendly(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
