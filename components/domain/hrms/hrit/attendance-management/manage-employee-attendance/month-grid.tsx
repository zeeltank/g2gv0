'use client'

import * as React from 'react'
import { ChevronRight } from 'lucide-react'

import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { AttendanceDayTile, type TileDensity } from '@/domain/hrms/hrit/attendance-management/shared/attendance-day-tile'
import {
  AttendanceCellPeek,
  usePeek,
  type PeekTarget,
} from '@/domain/hrms/hrit/attendance-management/shared/attendance-cell-peek'
import {
  formatMinutes,
  isLate,
  sumDurations,
  type AttendanceDayCell,
} from '@/domain/hrms/hrit/attendance-management/shared/attendance-day-status'
import type {
  AttendanceGridCell,
  AttendanceGridDay,
  AttendanceGridEmployee,
} from '@/services/hrms'

/**
 * Employees down, days across, the name column frozen.
 *
 * ── WHY THIS IS STILL A TABLE ───────────────────────────────────────────────
 *
 * The obvious upgrade was FullCalendar, and it cannot do this shape: an
 * employees-as-rows, days-as-columns view is `@fullcalendar/resource-timeline`,
 * a premium plugin that is not installed and cannot be (npm install fails
 * outright on a private git dependency here). Approximating it in a month grid
 * would be worse than the table. FullCalendar earns its place on the
 * per-employee drill-down instead, where a calendar is the right shape.
 *
 * ── WHAT CHANGED, AND WHAT COULD NOT ────────────────────────────────────────
 *
 * A compact cell is 28px square - 31 of them beside a 240px name column is
 * about a laptop's width - so it cannot show status, both punch times, worked
 * hours and the expected shift at once. Everything beyond two facts now lives
 * in a hover/focus reveal, which is also the first time any of it was reachable
 * by keyboard: it used to be in a `title=` attribute, and a native tooltip never
 * appears on focus.
 *
 * ── THE SCROLL LIVES HERE, NOT ON THE PAGE ──────────────────────────────────
 *
 * A 31-day row is wider than any screen. Letting the body scroll sideways would
 * take the filters and the heading with it.
 *
 * Note the sticky column keeps a class literally containing `sticky`: the
 * screen's print rules force `[class*="sticky"]` to `position: static`, so
 * renaming it would silently break printing.
 */
export function MonthGrid({
  days,
  employees,
  selected,
  density = 'compact',
  onToggle,
  onToggleAll,
  onPick,
  onOpenEmployee,
  onOpenHistory,
  canCorrect = true,
}: {
  days: AttendanceGridDay[]
  employees: AttendanceGridEmployee[]
  selected: number[]
  density?: TileDensity
  onToggle: (userId: number) => void
  onToggleAll: () => void
  onPick: (employee: AttendanceGridEmployee, date: string, cell: AttendanceGridCell) => void
  onOpenEmployee: (employee: AttendanceGridEmployee) => void
  onOpenHistory?: (employee: AttendanceGridEmployee, date: string) => void
  canCorrect?: boolean
}) {
  const peek = usePeek()

  /**
   * One row of totals per employee.
   *
   * `late` is deliberately nullable. An employee with no roster has no start
   * time to be late against, and reporting "0 late" for them would be a
   * confident claim about something unknowable - the same mistake the two
   * endpoints that read `monday_in_date` for every weekday make.
   */
  const totals = React.useMemo(() => {
    const out = new Map<number, {
      present: number
      absent: number
      late: number | null
      minutes: number
      missing: number
    }>()

    for (const employee of employees) {
      const cells = Object.values(employee.days) as AttendanceDayCell[]
      const { minutes, missing } = sumDurations(cells)

      let lateCount = 0
      let judgeable = 0
      for (const cell of cells) {
        const late = isLate(cell)
        if (late === null) continue
        judgeable += 1
        if (late) lateCount += 1
      }

      out.set(employee.user_id, {
        present: cells.filter((c) => c.status === 'present' || c.status === 'incomplete').length,
        absent: cells.filter((c) => c.status === 'absent').length,
        late: judgeable === 0 ? null : lateCount,
        minutes,
        missing,
      })
    }

    return out
  }, [employees])

  const allSelected = employees.length > 0 && selected.length === employees.length

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        {/* border-separate is required for the sticky cells' borders to render. */}
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-20 min-w-[248px] border-b border-r border-border bg-card px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                <span className="flex items-center gap-2">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={selected.length > 0 && !allSelected}
                    onCheckedChange={onToggleAll}
                    aria-label="Select every employee on this page"
                    className="print:hidden"
                  />
                  Employee
                </span>
              </th>

              {days.map((day) => (
                <th
                  key={day.date}
                  scope="col"
                  className={cn(
                    'border-b border-border bg-card px-1 py-2 text-center text-xs font-semibold',
                    // Saturday and Sunday read differently at a glance. This is
                    // NOT a roster claim - the roster is per employee, and each
                    // cell carries its own.
                    day.weekday === 'Sat' || day.weekday === 'Sun'
                      ? 'text-muted-foreground'
                      : 'text-foreground',
                  )}
                >
                  <span className="block tabular-nums">{day.day_of}</span>
                  <span className="block text-[10px] font-normal text-muted-foreground">
                    {day.weekday}
                  </span>
                </th>
              ))}

              {/*
                * Totals at the far right, and NOT sticky.
                *
                * A `right: 0` sticky column is forced to `static` by the print
                * rules and would land in the middle of the printed table. These
                * are a conclusion rather than a scanning aid, so they are
                * allowed to scroll out of view.
                */}
              {(['P', 'A', 'L', 'Hrs'] as const).map((head) => (
                <th
                  key={head}
                  scope="col"
                  className="border-b border-l border-border bg-card px-2 py-2 text-right text-xs font-semibold text-muted-foreground"
                  title={
                    head === 'P' ? 'Days present' :
                    head === 'A' ? 'Days absent' :
                    head === 'L' ? 'Days late' : 'Hours worked'
                  }
                >
                  {head}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {employees.map((employee) => {
              const row = totals.get(employee.user_id)
              const isSelected = selected.includes(employee.user_id)

              return (
                <tr key={employee.user_id} className="group">
                  <th
                    scope="row"
                    className={cn(
                      // `sticky` in the class name is load-bearing for printing.
                      'sticky left-0 z-10 border-b border-r border-border px-3 py-2 text-left align-middle font-normal',
                      // bg-card ALWAYS. The selected state used to replace it
                      // with bg-primary/10, which is 90% transparent - so the
                      // day cells scrolling underneath showed through the frozen
                      // column. The tint is layered on top instead.
                      'bg-card',
                      'before:pointer-events-none before:absolute before:inset-0',
                      isSelected ? 'before:bg-primary/10' : 'group-hover:before:bg-muted/40',
                      // A seam at the right edge, so the frozen column reads as
                      // frozen without a scroll listener.
                      'after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-2',
                      'after:bg-gradient-to-r after:from-transparent after:to-black/5 dark:after:to-white/5',
                    )}
                  >
                    <span className="relative flex items-start gap-2">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggle(employee.user_id)}
                        aria-label={`Select ${employee.name}`}
                        className="mt-1 print:hidden"
                      />

                      <span className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => onOpenEmployee(employee)}
                          className="flex w-full items-center gap-1 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="truncate font-medium text-foreground">{employee.name}</span>
                          <ChevronRight className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </button>

                        {/*
                          * One line, always - the row height has to be constant
                          * or the 31-column rhythm breaks. The no-roster pill
                          * used to be a third line, making those rows taller
                          * than the rest.
                          */}
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="truncate">
                            {employee.employee_code ? `${employee.employee_code} · ` : ''}
                            {employee.department_name ?? 'No department'}
                          </span>
                          {!employee.has_roster && (
                            <span className="shrink-0 rounded bg-violet-500/15 px-1 py-0.5 text-[10px] font-medium text-violet-800 dark:text-violet-200">
                              No roster
                            </span>
                          )}
                        </span>
                      </span>
                    </span>
                  </th>

                  {days.map((day) => {
                    const cell = employee.days[day.date] as AttendanceDayCell | undefined

                    if (!cell) {
                      return <td key={day.date} className="border-b border-border px-1 py-1" />
                    }

                    const target: PeekTarget = {
                      rect: new DOMRect(),
                      date: day.date,
                      cell,
                      employeeName: employee.name,
                      employeeId: employee.user_id,
                      canCorrect,
                    }

                    return (
                      <td key={day.date} className="border-b border-border p-0.5 align-middle">
                        <AttendanceDayTile
                          cell={cell}
                          date={day.date}
                          employeeName={employee.name}
                          density={density}
                          onActivate={() => onPick(employee, day.date, cell as AttendanceGridCell)}
                          onPeek={(rect) => peek.open({ ...target, rect })}
                          onPeekEnd={peek.close}
                        />
                      </td>
                    )
                  })}

                  {/* Totals. `—` for lateness that cannot be judged, never 0. */}
                  <td className="border-b border-l border-border px-2 py-2 text-right text-xs tabular-nums text-emerald-700 dark:text-emerald-300">
                    {row?.present ?? 0}
                  </td>
                  <td className="border-b border-border px-2 py-2 text-right text-xs tabular-nums text-rose-700 dark:text-rose-300">
                    {row?.absent ?? 0}
                  </td>
                  <td
                    className="border-b border-border px-2 py-2 text-right text-xs tabular-nums text-amber-700 dark:text-amber-300"
                    title={row?.late === null ? 'No roster, so lateness cannot be calculated' : undefined}
                  >
                    {row?.late === null || row?.late === undefined ? '—' : row.late}
                  </td>
                  <td
                    className="border-b border-border px-2 py-2 text-right text-xs tabular-nums text-foreground"
                    title={
                      row && row.missing > 0
                        ? `${row.missing} ${row.missing === 1 ? 'day has' : 'days have'} no punch out, so those hours are not included`
                        : undefined
                    }
                  >
                    {/*
                      * A trailing "+" when days were clearly worked but carry no
                      * duration. Adding them as zero would quietly understate
                      * the month, and an understated number looks just as
                      * authoritative as a correct one.
                      */}
                    {row ? formatMinutes(row.minutes) : '0:00'}
                    {row && row.missing > 0 ? '+' : ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <AttendanceCellPeek
        target={peek.target}
        onCancelClose={peek.cancelClose}
        onClose={peek.close}
        onCorrect={
          canCorrect
            ? (hit) => {
                peek.closeNow()
                const employee = employees.find((e) => e.user_id === hit.employeeId)
                if (employee) onPick(employee, hit.date, hit.cell as AttendanceGridCell)
              }
            : undefined
        }
        onOpenHistory={
          onOpenHistory
            ? (hit) => {
                peek.closeNow()
                const employee = employees.find((e) => e.user_id === hit.employeeId)
                if (employee) onOpenHistory(employee, hit.date)
              }
            : undefined
        }
        onOpenEmployee={(hit) => {
          peek.closeNow()
          const employee = employees.find((e) => e.user_id === hit.employeeId)
          if (employee) onOpenEmployee(employee)
        }}
      />
    </>
  )
}
