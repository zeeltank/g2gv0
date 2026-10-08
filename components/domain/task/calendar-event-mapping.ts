import { addDays, format, isBefore, isSameDay, startOfDay } from 'date-fns'
import type { EventInput } from '@fullcalendar/core'
import type { CalendarEntry, CalendarEntryKind, WorkspaceTask } from '@/types/task-management'

/**
 * A `yyyy-MM-dd` string as a LOCAL date.
 *
 * `new Date('2026-08-21')` parses as UTC midnight and then renders in local
 * time, which lands on the 20th for anyone west of Greenwich - a task silently
 * one day early. Appending the time forces local-midnight parsing, matching how
 * `format(day, 'yyyy-MM-dd')` writes them back out.
 */
export function localDate(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

/** A `yyyy-MM-dd HH:mm:ss` (or `...THH:mm`) wire datetime, parsed as LOCAL time - never UTC. */
export function localDateTime(value: string): Date {
  return new Date(value.replace(' ', 'T'))
}

/**
 * The days a task occupies: [start, due].
 *
 * Returns null when it has neither date - such a task is not on the calendar
 * at all. Where only one is present that date stands for both, so the task is
 * a single day rather than an open-ended bar.
 *
 * INVERTED DATA IS NORMALISED, NOT TRUSTED. `TaskScheduleController` validates
 * order only on write, so legacy rows can hold a start AFTER their due date.
 * Rendering that literally would produce a negative-length span that draws
 * nothing; the two are swapped so the task still appears and can be corrected.
 */
export function taskSpan(task: WorkspaceTask): { start: Date; end: Date } | null {
  const startRaw = task.planned_start_date ?? task.due_date
  const endRaw = task.due_date ?? task.planned_start_date
  if (!startRaw || !endRaw) return null

  const a = localDate(startRaw)
  const b = localDate(endRaw)
  return a <= b ? { start: a, end: b } : { start: b, end: a }
}

/**
 * What a chip needs beyond FullCalendar's own id/start/end/title - read back
 * inside `eventContent` to render the same look the old day-cell list used,
 * plus what the milestone/checkpoint popover shows without a second fetch.
 */
export interface CalendarGridExtendedProps {
  kind: CalendarEntryKind
  /** The bare id (no kind prefix) - what onTaskClick/onEventClick receive. */
  refId: string
  /** Tailwind chip classes - the only styling when no custom feed color applies. */
  fallbackClassName: string
  /**
   * A per-person custom hex (9.8, 9.11), TASK/EVENT only - a share color the
   * owner picked for this viewer specifically, or failing that the owner's
   * own task_card_color preference (CalendarFeed.color resolves both, see
   * its own docblock). Rendered as the chip's FULL solid fill + border,
   * overriding the project/feed-palette fallbackClassName entirely - paired
   * with contrastTextColor() below rather than a flat white/black, since an
   * employee's own pick is arbitrary and unreviewed, unlike the palette's
   * theme tokens.
   */
  accentColor: string | null
  /** Raw status string - shown as-is on the milestone/checkpoint popover. */
  status: string
  /** TASK only - COMPLETED/ON HOLD read as done-with via strikethrough, matching the old day-cell look exactly. Always false for the other three kinds, which never had this treatment. */
  settled: boolean
  /** TASK only, same reason. */
  overdue: boolean
  /** Shown on the milestone/checkpoint popover; best-effort display text for TASK/EVENT, which open a full drawer instead and do not otherwise use it. */
  projectName: string | null
  departmentName: string | null
  hint: string
}

interface ColourClasses { chip: string; dot: string; solid: string }

/** `id` is kind-prefixed (`TASK-42` vs `EVENT-42`) - task and entry ids come from different tables and can collide, which would corrupt FullCalendar's internal diffing. */
export function taskEventId(taskId: string): string {
  return `TASK-${taskId}`
}

export function entryEventId(entry: Pick<CalendarEntry, 'kind' | 'id'>): string {
  return `${entry.kind}-${entry.id}`
}

export function mapTaskToEvent(
  task: WorkspaceTask,
  projectColour: (project: string | null) => ColourClasses,
  feedColorByUserId: Map<string, string | null>,
): EventInput | null {
  const span = taskSpan(task)
  if (!span) return null

  const settled = task.status === 'COMPLETED' || task.status === 'ON HOLD'
  const overdue = !settled && isBefore(startOfDay(span.end), startOfDay(new Date()))
  const project = task.project || null
  const accentColor = (task.assignee_id && feedColorByUserId.get(task.assignee_id)) || null

  const extendedProps: CalendarGridExtendedProps = {
    kind: 'TASK',
    refId: task.id,
    fallbackClassName: projectColour(project).solid,
    accentColor,
    status: task.status,
    settled,
    overdue,
    projectName: project,
    departmentName: task.department || null,
    hint: hintFor(task.title, project || 'Not in a project', span.start, span.end),
  }

  return {
    id: taskEventId(task.id),
    title: task.title,
    start: span.start,
    // FullCalendar's all-day end is EXCLUSIVE; taskSpan's is inclusive (the
    // last occupied day). Omitting the +1 renders every multi-day task one
    // day short.
    end: addDays(span.end, 1),
    allDay: true,
    editable: true,
    startEditable: true,
    // Stretching only due_date via resize doesn't survive a reload: taskSpan's
    // own planned_start_date ?? due_date fallback recomputes start to the new
    // due date too, silently collapsing the task back to one day on the next
    // load. Drag (move) stays enabled either way.
    durationEditable: Boolean(task.planned_start_date),
    extendedProps,
  }
}

export function mapEntryToEvent(
  entry: CalendarEntry,
  viewerId: string,
  feedColorByUserId: Map<string, string | null>,
  feedColour: (userId: string) => ColourClasses,
): EventInput {
  const owned = entry.kind === 'EVENT' && entry.owner_id === viewerId

  let start: Date
  let end: Date
  let allDay: boolean

  if (entry.kind === 'EVENT' && !entry.all_day) {
    start = localDateTime(entry.start)
    end = localDateTime(entry.end)
    allDay = false
  } else {
    // All-day (every MILESTONE/CHECKPOINT, and an all-day EVENT): both ends
    // carry inclusive dates the same way a task's own span does - see
    // mapTaskToEvent's comment for why the end needs +1 for FullCalendar.
    const startDay = localDate(entry.start.slice(0, 10))
    const endDay = localDate(entry.end.slice(0, 10))
    start = startDay
    end = addDays(endDay, 1)
    allDay = true
  }

  const fallbackClassName = entry.kind === 'EVENT'
    // No custom color set: still distinguish events by whose calendar they're
    // on, via the same automatic by-index palette the Feeds panel already
    // uses - a flat, identical tint for everyone was the old (and reported
    // insufficiently distinct) look.
    ? (entry.owner_id ? feedColour(entry.owner_id).solid : 'bg-secondary/60 text-secondary-foreground hover:bg-secondary/80')
    : statusClassName(entry)
  // Status-colored (milestones/checkpoints) is its own established scheme,
  // independent of whose calendar something is on - a per-feed accent only
  // makes sense for TASK/EVENT, which are owned by one person.
  const accentColor = entry.kind === 'EVENT' ? ((entry.owner_id && feedColorByUserId.get(entry.owner_id)) || null) : null

  const extendedProps: CalendarGridExtendedProps = {
    kind: entry.kind,
    refId: entry.id,
    fallbackClassName,
    accentColor,
    status: entry.status,
    // Strikethrough/overdue-ring was never part of the event chip's look
    // (it had one static style regardless of status) or of milestones'/
    // checkpoints' own status-color treatment - not reintroduced here.
    settled: false,
    overdue: false,
    projectName: entry.project_name,
    departmentName: entry.department_name,
    hint: entry.kind === 'EVENT' ? entry.title : hintFor(entry.title, entry.project_name || 'Not in a project', start, allDay ? addDays(end, -1) : end),
  }

  return {
    id: entryEventId(entry),
    title: entry.title,
    start, end, allDay,
    editable: owned,
    startEditable: owned,
    durationEditable: owned,
    extendedProps,
  }
}

/** MILESTONE/CHECKPOINT only - status-colored, matching dependencies-view.tsx's own scheme. */
function statusClassName(entry: CalendarEntry): string {
  if (entry.kind === 'MILESTONE') {
    if (entry.status === 'COMPLETED') return 'bg-success/10 text-success border border-emerald-500/20'
    if (entry.status === 'AT RISK') return 'bg-warning/10 text-warning border border-amber-500/20'
    return 'bg-primary/10 text-primary border border-primary/20'
  }
  if (entry.status === 'COMPLETED') return 'bg-success/10 text-success border border-emerald-500/20'
  return 'bg-secondary/60 text-secondary-foreground border border-border'
}

/** Hover text that says what the chip covers, matching the old single-day-list tooltip. */
function hintFor(title: string, where: string, start: Date, end: Date): string {
  const when = !isSameDay(start, end) ? ` (${format(start, 'd MMM')} - ${format(end, 'd MMM')})` : ''
  return `${where} - ${title}${when}`
}

/**
 * Black or white, whichever reads on an ARBITRARY hex background - an
 * employee's own `task_card_color` pick, unlike the PALETTE's theme tokens,
 * is never reviewed for contrast ahead of time. Standard YIQ brightness
 * split (perceived luminance, not a straight RGB average - the eye weighs
 * green far more than blue), same threshold libraries like Chroma.js use.
 */
export function contrastTextColor(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 128 ? '#000000' : '#ffffff'
}
