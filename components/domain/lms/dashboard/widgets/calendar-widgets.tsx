'use client'

import React, { useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, ChevronRight, Loader2 } from 'lucide-react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import type { LearningCalendarEvent, TrainingSession } from '@/services/lms'
import { WidgetLink, WidgetLoading, WidgetMessage, WidgetShell } from './shared'

/** calendar_events stores no time columns, so an event is a whole-day marker. */
function eventDate(event: LearningCalendarEvent): Date | null {
  if (!event.school_date) return null
  const parsed = new Date(event.school_date)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function sessionDate(session: TrainingSession): Date | null {
  if (!session.event_date) return null
  const parsed = new Date(session.event_date)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** "09:30 – 11:00", or just the start when there is no end. */
function sessionTime(session: TrainingSession) {
  const from = (session.from_time ?? '').slice(0, 5)
  const to = (session.to_time ?? '').slice(0, 5)
  return from && to ? `${from} – ${to}` : from
}

function isDeadlineEvent(event: LearningCalendarEvent) {
  const type = (event.event_type || '').toLowerCase()
  return type.includes('deadline') || type.includes('due') || type.includes('exam')
}

/* ------------------------------------------------------------------ *
 * Upcoming sessions
 * ------------------------------------------------------------------ */

/**
 * Fed from /api/lms/sessions rather than calendar_events: a scheduled session
 * is what this widget claims to list, and only that table carries the time,
 * venue and seat state a learner needs to act on the row.
 */
export function UpcomingSessionsWidget({
  sessions: rows,
  loading,
  error,
  onViewCalendar,
}: {
  sessions: TrainingSession[]
  loading: boolean
  error: string | null
  onViewCalendar: () => void
}) {
  const sessions = useMemo(
    () =>
      rows
        .map((session) => ({ session, date: sessionDate(session) }))
        .filter((item): item is { session: TrainingSession; date: Date } => item.date !== null)
        .slice(0, 5),
    [rows],
  )

  return (
    <WidgetShell
      title="Upcoming Sessions"
      headerAction={<WidgetLink label="View Calendar" onClick={onViewCalendar} />}
      footerAction={
        <WidgetLink label="Browse All Sessions" onClick={onViewCalendar} variant="footer" />
      }
    >
      {loading ? (
        <WidgetLoading />
      ) : error ? (
        <WidgetMessage icon={AlertTriangle} tone="danger" title="Couldn't load sessions" description={error} />
      ) : sessions.length === 0 ? (
        <WidgetMessage
          icon={CalendarDays}
          title="No upcoming sessions"
          description="Nothing is scheduled for this month or next."
        />
      ) : (
        <CardContent className="flex-1 overflow-auto p-0">
          <div className="flex flex-col divide-y divide-border/50">
            {sessions.map(({ session, date }) => (
              <div key={session.id} className="flex items-start gap-3 p-4 hover:bg-muted/30">
                <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-border/80 bg-background py-1.5 shadow-sm">
                  <span className="text-base font-bold leading-none">{format(date, 'dd')}</span>
                  <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    {format(date, 'MMM')}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
                  <h4 className="truncate text-sm font-semibold leading-tight text-foreground">
                    {session.room_name || 'Untitled session'}
                  </h4>
                  <p className="truncate text-[11px] font-medium text-muted-foreground">
                    {[
                      format(date, 'EEE, dd MMM'),
                      sessionTime(session),
                      session.venue || session.trainer_name,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                {/* Registration state is the actionable bit — surface it ahead
                    of the session type, which the row title already implies. */}
                <StatusBadge
                  variant={session.is_registered ? 'active' : 'processing'}
                  size="sm"
                  className="shrink-0 text-[10px] font-bold uppercase tracking-wider"
                >
                  {session.is_registered ? 'Registered' : session.session_type}
                </StatusBadge>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </WidgetShell>
  )
}

/* ------------------------------------------------------------------ *
 * Month calendar
 * ------------------------------------------------------------------ */

export function LmsCalendarWidget({
  month,
  onMonthChange,
  events,
  loading,
  error,
}: {
  month: Date
  onMonthChange: (date: Date) => void
  events: LearningCalendarEvent[]
  loading: boolean
  error: string | null
}) {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month)),
        end: endOfWeek(endOfMonth(month)),
      }),
    [month],
  )

  const eventsByDay = useMemo(() => {
    const map = new Map<string, LearningCalendarEvent[]>()
    events.forEach((event) => {
      const date = eventDate(event)
      if (!date) return
      const key = format(date, 'yyyy-MM-dd')
      map.set(key, [...(map.get(key) ?? []), event])
    })
    return map
  }, [events])

  const selectedEvents = selectedDay
    ? (eventsByDay.get(format(selectedDay, 'yyyy-MM-dd')) ?? [])
    : []

  const changeMonth = (next: Date) => {
    setSelectedDay(null)
    onMonthChange(next)
  }

  return (
    <WidgetShell
      title="Calendar"
      headerAction={loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
    >
      <CardContent className="flex flex-1 flex-col overflow-hidden p-5">
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="text-sm font-bold text-foreground">{format(month, 'MMMM yyyy')}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => changeMonth(subMonths(month, 1))}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
            >
              <ChevronRight className="size-4 rotate-180" />
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => changeMonth(addMonths(month, 1))}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        {error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <AlertTriangle className="size-6 text-destructive" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        ) : (
          <>
            <div className="mx-auto grid w-full max-w-[280px] grid-cols-7 content-start gap-y-1 text-center">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                <div key={day} className="mb-1 text-[11px] font-bold tracking-wide text-muted-foreground">
                  {day}
                </div>
              ))}

              {days.map((day) => {
                const key = format(day, 'yyyy-MM-dd')
                const dayEvents = eventsByDay.get(key) ?? []
                const inMonth = isSameMonth(day, month)
                const hasDeadline = dayEvents.some(isDeadlineEvent)
                const hasSession = dayEvents.some((event) => !isDeadlineEvent(event))
                const isSelected = selectedDay ? isSameDay(day, selectedDay) : false

                return (
                  <div key={key} className="relative flex items-center justify-center py-0.5">
                    <button
                      type="button"
                      onClick={() => setSelectedDay(dayEvents.length > 0 ? day : null)}
                      aria-label={`${format(day, 'dd MMM yyyy')}${dayEvents.length ? `, ${dayEvents.length} event(s)` : ''}`}
                      className={cn(
                        'relative z-10 flex size-8 items-center justify-center rounded-md text-[13px] font-medium transition-colors',
                        !inMonth && 'text-muted-foreground/30',
                        isToday(day) && 'bg-primary font-bold text-primary-foreground shadow-sm',
                        !isToday(day) && isSelected && 'bg-muted font-bold text-foreground',
                        !isToday(day) && !isSelected && 'hover:bg-muted/60',
                        dayEvents.length > 0 && 'cursor-pointer',
                      )}
                    >
                      {format(day, 'd')}
                    </button>
                    {inMonth && (hasSession || hasDeadline) && (
                      <div className="absolute bottom-[-2px] left-1/2 z-20 flex -translate-x-1/2 items-center gap-0.5">
                        {hasSession && <span className="size-1 rounded-full bg-primary" />}
                        {hasDeadline && <span className="size-1 rounded-full bg-warning" />}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="mt-3 min-h-0 flex-1 overflow-auto border-t border-border/40 pt-3">
              {selectedDay && selectedEvents.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {format(selectedDay, 'EEEE, dd MMM')}
                  </p>
                  {selectedEvents.map((event, index) => (
                    <div key={index} className="rounded-md bg-muted/40 px-2.5 py-1.5">
                      <p className="truncate text-xs font-semibold text-foreground">
                        {event.title || 'Untitled event'}
                      </p>
                      {event.event_type && (
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {event.event_type}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-primary" /> Session
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-warning" /> Deadline
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </WidgetShell>
  )
}
