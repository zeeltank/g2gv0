'use client'

import * as React from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventInput } from '@fullcalendar/core'
import { AlertTriangle, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { MonthPicker } from '@/components/ui/month-picker'
import { useEmployeeDayDetail } from '@/hooks/use-employee-day-detail'
import { cn } from '@/lib/utils'
import { AttendanceDayTile } from './attendance-day-tile'
import { AttendanceCellPeek, usePeek } from './attendance-cell-peek'
import {
  fromMonthlyReportDay,
  statusLabel,
  type AttendanceDayCell,
} from './attendance-day-status'

import './employee-attendance-month.css'

/**
 * One employee's attendance month, as a calendar.
 *
 * ── WHY A CALENDAR HERE AND A TABLE ON THE DESK ─────────────────────────────
 *
 * The employees-down/days-across matrix is the right shape for "show me
 * everybody" and cannot be built with FullCalendar at all - that view is
 * `@fullcalendar/resource-timeline`, a premium plugin, absent from this repo and
 * uninstallable (`npm install` fails outright on a private git dependency). So
 * the matrix stays, and this is the view for ONE person, which is the shape a
 * calendar is actually good at.
 *
 * ── dayCellContent, NOT EVENTS ──────────────────────────────────────────────
 *
 * The status FILL is the primary encoding, and a FullCalendar event cannot paint
 * a day cell's background - `dayCellClassNames` and `dayCellContent` can. That
 * alone decides it. Three more reasons it would have been the wrong choice:
 * an all-day chip competes with the date number for the cell's height;
 * `dayMaxEvents` collapsing into "+2 more" is a liability when there is exactly
 * one thing per day; and a timed event in a month view renders as a dot and a
 * time string, which is strictly less than the tile.
 *
 * The ONE exception is leave and holidays, which go in as real events with
 * `display: 'background'`. That is precisely FullCalendar's feature for "this
 * day has a quality": it consumes no cell height and layers under the tile. For
 * those the all-day exclusive-end rule applies, so a span's `end` is the day
 * after its last day.
 *
 * ── queueMicrotask IS NOT OPTIONAL ──────────────────────────────────────────
 *
 * See the gotoDate effect below. Copied, with its reasoning, from
 * components/domain/task/task-calendar-grid.tsx:61-83.
 */

/** Local-midnight parse. `new Date('2026-10-03')` is UTC and lands a day early in negative offsets. */
function localDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function EmployeeAttendanceMonth({
  userId,
  employeeName,
  employeeCode,
  departmentName,
  hasRoster,
  month,
  onMonthChange,
  canCorrect = false,
  onCorrect,
  onOpenHistory,
  reloadKey,
  className,
}: {
  userId: number | string
  employeeName?: string | null
  employeeCode?: string | null
  departmentName?: string | null
  /**
   * Whether this employee has any rostered day.
   *
   * Passed in where the caller knows it (the HR grid has `has_roster` on every
   * row); otherwise left undefined and taken from the server's own answer. NOT
   * defaulted to true - see the mapper's docblock for why that would silently
   * reintroduce "a month of weekends".
   */
  hasRoster?: boolean
  month: string
  onMonthChange: (month: string) => void
  canCorrect?: boolean
  onCorrect?: (date: string, cell: AttendanceDayCell) => void
  onOpenHistory?: (date: string) => void
  /** Bump to refetch after a correction landed elsewhere. */
  reloadKey?: number
  className?: string
}) {
  const detail = useEmployeeDayDetail(userId, month)
  const calendarRef = React.useRef<FullCalendar>(null)
  const peek = usePeek()

  // The caller's answer wins when it has one; otherwise the server's.
  const roster = hasRoster ?? detail.hasRoster

  /*
   * Refetch when the caller says a correction landed.
   *
   * `detail.reload` is a useCallback with no dependencies, so it is stable and
   * belongs in the dependency list - listing `detail` instead would loop, since
   * the hook returns a fresh object every render. That is what the suppression
   * I first wrote here was hiding.
   *
   * Deferred for the same reason as the gotoDate effect: reload() calls
   * setState, and calling it straight from an effect body is the cascading
   * render this repo defers everywhere else.
   */
  const reload = detail.reload
  React.useEffect(() => {
    if (reloadKey === undefined) return
    const handle = setTimeout(reload, 0)
    return () => clearTimeout(handle)
  }, [reloadKey, reload])

  /** date -> cell, in this module's own vocabulary. */
  const cells = React.useMemo(() => {
    const map = new Map<string, AttendanceDayCell>()
    for (const day of detail.days) {
      map.set(day.date, fromMonthlyReportDay(day, roster))
    }
    return map
  }, [detail.days, roster])

  /**
   * Leave and holidays as background events.
   *
   * Consecutive days of the same kind are merged into one span, because five
   * separate single-day background events render five separate tint edges where
   * one block is what a week of leave actually is. The `end` is the day AFTER
   * the last - FullCalendar's all-day end is exclusive while every date field in
   * this app is inclusive, which is the off-by-one the task module documents.
   */
  const backgroundEvents = React.useMemo<EventInput[]>(() => {
    const events: EventInput[] = []
    let run: { kind: 'leave' | 'holiday'; from: string; to: string; label: string } | null = null

    const flush = () => {
      if (!run) return
      events.push({
        id: `${run.kind}:${run.from}`,
        start: localDate(run.from),
        end: addDays(localDate(run.to), 1),
        allDay: true,
        display: 'background',
        title: run.label,
        color:
          run.kind === 'leave'
            ? 'color-mix(in srgb, var(--primary) 10%, transparent)'
            : 'color-mix(in srgb, var(--chart-4, var(--primary)) 12%, transparent)',
      })
      run = null
    }

    for (const day of detail.days) {
      const kind: 'leave' | 'holiday' | null =
        day.holiday_name ? 'holiday' : day.leave ? 'leave' : null

      if (!kind) {
        flush()
        continue
      }

      const label = kind === 'holiday' ? (day.holiday_name ?? 'Holiday') : (day.leave?.leave_type ?? 'On leave')

      if (run && run.kind === kind && run.label === label) {
        run.to = day.date
      } else {
        flush()
        run = { kind, from: day.date, to: day.date, label }
      }
    }
    flush()

    return events
  }, [detail.days])

  /*
   * DEFERRED, NOT CALLED DIRECTLY IN THE EFFECT.
   *
   * @fullcalendar/react uses flushSync internally to keep its own DOM in step
   * when gotoDate/changeView are invoked. Calling them synchronously from a
   * plain useEffect collides with React's own commit ("flushSync was called from
   * inside a lifecycle method") and tears down the whole calendar - confirmed
   * live in the task module, where .fc vanished entirely on a view switch.
   * queueMicrotask pushes the call past the current commit.
   *
   * One-way: the parent owns `month`, headerToolbar is off, so FullCalendar
   * never changes the date by itself and there is nothing to read back.
   */
  React.useEffect(() => {
    queueMicrotask(() => {
      const api = calendarRef.current?.getApi()
      if (!api) return
      api.gotoDate(localDate(`${month}-01`))
    })
  }, [month])

  const step = (delta: number) => {
    const [year, mon] = month.split('-').map(Number)
    onMonthChange(monthKey(new Date(year, (mon ?? 1) - 1 + delta, 1)))
  }

  const subtitle = [employeeCode, departmentName].filter(Boolean).join(' · ')

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {employeeName && (
            <p className="truncate font-semibold text-foreground">{employeeName}</p>
          )}
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" className="size-8" onClick={() => step(-1)} aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </Button>
          <MonthPicker value={month} onChange={onMonthChange} className="w-[11rem]" />
          <Button variant="outline" size="icon" className="size-8" onClick={() => step(1)} aria-label="Next month">
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={detail.reload}
            disabled={detail.loading}
            aria-label="Refresh"
          >
            <RefreshCw className={cn('size-4', detail.loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* The 88%, said here too - this panel is often the first place somebody
          looks at one person, and a month of "Non-working" would be a lie. */}
      {roster === false && (
        <Alert className="border-violet-500/40 bg-violet-500/10">
          <AlertTriangle className="size-4 text-violet-600" />
          <AlertDescription className="text-sm text-violet-900 dark:text-violet-200">
            Nobody has recorded which days this employee works, so days with no punch are shown as
            <strong> No roster</strong> rather than as absences or days off. Lateness cannot be
            calculated for them until a roster is set.
          </AlertDescription>
        </Alert>
      )}

      {/* Error before loading before empty before data - the order this module
          uses everywhere, so a failure is never hidden behind a spinner. */}
      {detail.error ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{detail.error}</span>
            <Button variant="ghost" size="sm" onClick={detail.reload}>Try again</Button>
          </AlertDescription>
        </Alert>
      ) : detail.loading && detail.days.length === 0 ? (
        <Skeleton className="h-[26rem] w-full" />
      ) : (
        <div className="mea-employee-month rounded-xl border border-border bg-card p-1">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            initialDate={localDate(`${month}-01`)}
            headerToolbar={false}
            firstDay={1}
            height="auto"
            // No 6th blank row for one employee - fixedWeekCount pads every
            // month to six weeks, which wastes a row of vertical space here.
            fixedWeekCount={false}
            // A greyed-out neighbouring month with no status would read as an
            // absence, which is exactly the kind of invented fact this screen
            // exists to avoid.
            showNonCurrentDates={false}
            events={backgroundEvents}
            dayHeaderFormat={{ weekday: 'short' }}
            dayCellClassNames="p-0"
            dayCellContent={(arg) => {
              const date = `${arg.date.getFullYear()}-${String(arg.date.getMonth() + 1).padStart(2, '0')}-${String(arg.date.getDate()).padStart(2, '0')}`
              const cell = cells.get(date)

              if (!cell) {
                return (
                  <div className="flex h-full min-h-[64px] items-start justify-start p-1 text-[10px] text-muted-foreground tabular-nums">
                    {arg.date.getDate()}
                  </div>
                )
              }

              return (
                <AttendanceDayTile
                  cell={cell}
                  date={date}
                  density="roomy"
                  dayNumber={arg.date.getDate()}
                  isToday={arg.isToday}
                  onActivate={
                    canCorrect && onCorrect && cell.status !== 'upcoming'
                      ? () => onCorrect(date, cell)
                      : undefined
                  }
                  onPeek={(rect) =>
                    peek.open({
                      rect,
                      date,
                      cell,
                      employeeName: employeeName ?? undefined,
                      employeeId: Number(userId),
                      canCorrect,
                    })
                  }
                  onPeekEnd={peek.close}
                />
              )
            }}
          />
        </div>
      )}

      {detail.days.length === 0 && !detail.loading && !detail.error && (
        <p className="text-sm text-muted-foreground">
          No attendance recorded for this month.
        </p>
      )}

      <AttendanceCellPeek
        target={peek.target}
        onCancelClose={peek.cancelClose}
        onClose={peek.close}
        onCorrect={
          canCorrect && onCorrect
            ? (hit) => {
                peek.closeNow()
                onCorrect(hit.date, hit.cell)
              }
            : undefined
        }
        onOpenHistory={
          onOpenHistory
            ? (hit) => {
                peek.closeNow()
                onOpenHistory(hit.date)
              }
            : undefined
        }
      />

      {/* A legend only for what this view can show, derived from the data so it
          cannot advertise a status that is not present. */}
      {cells.size > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {Array.from(new Set(Array.from(cells.values()).map((cell) => cell.status))).map((status) => (
            <span key={status}>{statusLabel(status)}</span>
          ))}
        </div>
      )}
    </div>
  )
}
