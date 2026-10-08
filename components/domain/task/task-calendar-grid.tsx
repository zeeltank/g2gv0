'use client'

import { useEffect, useMemo, useRef } from 'react'
import { addDays, format } from 'date-fns'
import { CircleDot, Flag, Lock } from 'lucide-react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventClickArg, EventContentArg, EventDropArg, EventInput } from '@fullcalendar/core'
import type { DateClickArg, EventResizeDoneArg } from '@fullcalendar/interaction'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { CalendarEntry, CalendarFeed, WorkspaceTask } from '@/types/task-management'
import { mapEntryToEvent, mapTaskToEvent, type CalendarGridExtendedProps } from './calendar-event-mapping'
import './task-calendar-grid.css'

export type CalendarGridView = 'month' | 'week' | 'day'

const FC_VIEW: Record<CalendarGridView, string> = {
  month: 'dayGridMonth', week: 'timeGridWeek', day: 'timeGridDay',
}

interface ColourClasses { chip: string; dot: string; solid: string }

interface Props {
  tasks: WorkspaceTask[]
  /** EVENT + MILESTONE + CHECKPOINT only - the caller still sources TASK rows from getWorkspace, not this feed. */
  entries: CalendarEntry[]
  feeds: CalendarFeed[]
  viewerId: string
  view: CalendarGridView
  anchorDate: Date
  projectColour: (project: string | null) => ColourClasses
  feedColour: (userId: string) => ColourClasses
  onTaskClick: (taskId: string) => void
  onEventClick: (eventId: string) => void
  /** `timeStr` ('HH:mm') is only present for a week/day-view click on a specific time slot - a month-view day cell has no time to give. */
  onEmptyDateClick: (dateStr: string, timeStr?: string) => void
  /** Resolves to whether the move should stick - false reverts the drag/resize visually too, not just in state. */
  onTaskReschedule: (taskId: string, start: Date, end: Date) => Promise<boolean>
  onEventReschedule: (eventId: string, start: Date, end: Date, allDay: boolean) => Promise<boolean>
}

/**
 * FullCalendar's all-day end is EXCLUSIVE; this app's own schedule fields
 * (task.due_date, an all-day event's end_at) are INCLUSIVE of the last
 * occupied day. Converting a drag/resize result back for the API needs the
 * opposite adjustment from the one calendar-event-mapping.ts applies when
 * first placing the entry on the grid.
 */
function inclusiveEnd(allDay: boolean, start: Date, end: Date | null): Date {
  if (!allDay) return end ?? start
  return addDays(end ?? addDays(start, 1), -1)
}

export function TaskCalendarGrid({
  tasks, entries, feeds, viewerId, view, anchorDate,
  projectColour, feedColour,
  onTaskClick, onEventClick, onEmptyDateClick, onTaskReschedule, onEventReschedule,
}: Props) {
  const calendarRef = useRef<FullCalendar>(null)

  // One-way sync: the parent's own Month/Week/Day buttons and date-nav
  // arrows already own `view`/`anchorDate` (headerToolbar is off, so
  // FullCalendar renders no native nav of its own and never changes either
  // value by itself) - there is nothing to read back out.
  //
  // DEFERRED, NOT CALLED DIRECTLY IN THE EFFECT. @fullcalendar/react uses
  // flushSync internally to keep its own DOM in sync when changeView/gotoDate
  // are invoked - calling them synchronously from inside a plain useEffect
  // collided with React's own commit ("flushSync was called from inside a
  // lifecycle method"), which tore down the whole calendar on every view
  // switch (confirmed live: .fc vanished entirely after clicking "week").
  // queueMicrotask pushes the call past the current commit, the same pattern
  // already used throughout this module's own data-loading effects.
  useEffect(() => {
    queueMicrotask(() => {
      const api = calendarRef.current?.getApi()
      if (!api) return
      api.changeView(FC_VIEW[view])
      api.gotoDate(anchorDate)
    })
  }, [view, anchorDate])

  const feedColorByUserId = useMemo(() => {
    const map = new Map<string, string | null>()
    feeds.forEach((feed) => map.set(feed.user_id, feed.color))
    return map
  }, [feeds])

  const events = useMemo<EventInput[]>(() => {
    const taskEvents = tasks
      .map((task) => mapTaskToEvent(task, projectColour, feedColorByUserId))
      .filter((event): event is EventInput => event !== null)
    const entryEvents = entries.map((entry) => mapEntryToEvent(entry, viewerId, feedColorByUserId, feedColour))
    return [...taskEvents, ...entryEvents]
  }, [tasks, entries, viewerId, projectColour, feedColour, feedColorByUserId])

  const handleEventClick = (arg: EventClickArg) => {
    const props = arg.event.extendedProps as CalendarGridExtendedProps
    if (props.kind === 'TASK') onTaskClick(props.refId)
    else if (props.kind === 'EVENT') onEventClick(props.refId)
    // MILESTONE/CHECKPOINT: the chip's own Popover owns this click - nothing further to route.
  }

  const handleDateClick = (arg: DateClickArg) => {
    // arg.allDay is true for a dayGridMonth cell (no time of day to give) and
    // false for a timeGridWeek/Day slot, which carries the actual time clicked.
    onEmptyDateClick(format(arg.date, 'yyyy-MM-dd'), arg.allDay ? undefined : format(arg.date, 'HH:mm'))
  }

  const handleEventDrop = async (arg: EventDropArg) => {
    const props = arg.event.extendedProps as CalendarGridExtendedProps
    const start = arg.event.start
    if (!start) { arg.revert(); return }

    // inclusiveEnd handles both cases: for a timed entry it's a no-op
    // (end ?? start); for an all-day one it undoes FullCalendar's own
    // exclusive-end convention - an all-day EVENT needs this exactly like a
    // TASK does (mapEntryToEvent applies the same +1 going the other way),
    // which a prior version of this handler missed, writing every dragged
    // or resized all-day event's end_at one day later than where it was
    // actually dropped.
    const ok = props.kind === 'TASK'
      ? await onTaskReschedule(props.refId, start, inclusiveEnd(true, start, arg.event.end))
      : await onEventReschedule(props.refId, start, inclusiveEnd(arg.event.allDay, start, arg.event.end), arg.event.allDay)
    if (!ok) arg.revert()
  }

  const handleEventResize = async (arg: EventResizeDoneArg) => {
    const props = arg.event.extendedProps as CalendarGridExtendedProps
    const start = arg.event.start
    if (!start) { arg.revert(); return }

    const ok = props.kind === 'TASK'
      ? await onTaskReschedule(props.refId, start, inclusiveEnd(true, start, arg.event.end))
      : await onEventReschedule(props.refId, start, inclusiveEnd(arg.event.allDay, start, arg.event.end), arg.event.allDay)
    if (!ok) arg.revert()
  }

  return (
    <div className="tm-calendar-grid">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={FC_VIEW[view]}
        initialDate={anchorDate}
        headerToolbar={false}
        firstDay={1}
        fixedWeekCount
        height={view === 'month' ? 'auto' : 700}
        scrollTime="07:00:00"
        nowIndicator
        dayMaxEvents={view === 'month' ? 3 : false}
        events={events}
        dateClick={handleDateClick}
        eventClick={handleEventClick}
        eventDrop={(arg) => { void handleEventDrop(arg) }}
        eventResize={(arg) => { void handleEventResize(arg) }}
        eventContent={(arg) => <EventChip arg={arg} />}
      />
    </div>
  )
}

function EventChip({ arg }: { arg: EventContentArg }) {
  const props = arg.event.extendedProps as CalendarGridExtendedProps
  const isPin = props.kind === 'MILESTONE' || props.kind === 'CHECKPOINT'

  const chip = (
    <div
      title={props.hint}
      className={`flex w-full items-center gap-1 truncate rounded-lg px-2.5 py-1.5 text-left text-xs font-medium leading-snug ${props.fallbackClassName} ${props.settled ? 'line-through opacity-70' : ''} ${props.overdue ? 'ring-1 ring-inset ring-destructive/50' : ''}`}
      style={props.accentColor ? { borderLeft: `3px solid ${props.accentColor}` } : undefined}
    >
      {props.kind === 'MILESTONE' && <Flag className="size-3 shrink-0" />}
      {props.kind === 'CHECKPOINT' && <CircleDot className="size-3 shrink-0" />}
      {arg.timeText && <span className="shrink-0 opacity-70">{arg.timeText}</span>}
      <span className="min-w-0 flex-1 truncate">{arg.event.title}</span>
      {!isPin && !arg.event.startEditable && <Lock className="size-3 shrink-0 text-muted-foreground" />}
    </div>
  )

  if (!isPin) return chip

  return (
    <Popover>
      <PopoverTrigger asChild><button type="button" className="w-full min-w-0">{chip}</button></PopoverTrigger>
      <PopoverContent className="w-64 text-sm" onClick={(event) => event.stopPropagation()}>
        <p className="font-semibold">{arg.event.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{props.kind === 'MILESTONE' ? 'Milestone' : 'Checkpoint'} · {props.status}</p>
        {arg.event.start && <p className="mt-2 text-xs text-muted-foreground">{format(arg.event.start, 'd MMM yyyy')}</p>}
        {props.projectName && <p className="mt-1 text-xs">{props.projectName}</p>}
        {props.departmentName && <p className="text-xs text-muted-foreground">{props.departmentName}</p>}
      </PopoverContent>
    </Popover>
  )
}
