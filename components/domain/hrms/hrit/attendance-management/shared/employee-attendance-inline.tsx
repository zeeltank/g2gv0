'use client'

import * as React from 'react'

import { useEmployeeDayDetail } from '@/hooks/use-employee-day-detail'
import { EmployeeAttendanceMonth } from './employee-attendance-month'
import { AttendanceMonthSummary } from './attendance-month-summary'

/** The month the calendar opens on: the one we are in. */
function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/**
 * One employee's attendance month, with no drawer around it.
 *
 * ── WHY THIS EXISTS BESIDE `EmployeeAttendancePanel` ────────────────────────
 *
 * The same month + summary has three homes and only one of them wants a Sheet:
 *
 *   the HR attendance desk   `EmployeeAttendancePanel` - a Sheet, opened from
 *                            a grid row
 *   Employee Directory       INLINE in its Attendance tab. That drawer is
 *                            already a Sheet, and a Sheet inside a Sheet is a
 *                            stacking and focus-trap problem
 *   Attendance Tracking      INLINE, in place of the self dashboard, when an
 *                            `employee` parameter is present
 *
 * The two inline homes need exactly the same three things - own the month,
 * read the detail once, stack summary over calendar - so that composition
 * lives here once instead of being written out in both. The Sheet variant
 * composes the same two children its own way; neither wraps the other, because
 * a wrapper with a `variant` prop would be one component pretending to be two.
 *
 * ── IT OWNS ITS MONTH ──────────────────────────────────────────────────────
 *
 * Seeded from `initialMonth` (default: this month) and never written back to a
 * caller. Mount it with `key={userId}` so a different employee starts fresh
 * rather than inheriting wherever you had paged to for the previous one -
 * exactly the reasoning in the Sheet variant, and the opposite of the change
 * history tab's old behaviour, where paging one surface silently re-fetched
 * another.
 *
 * ── READ ONLY BY DEFAULT ───────────────────────────────────────────────────
 *
 * `canCorrect` is off unless a caller passes it. The Employee Directory drawer
 * and an employee's own Attendance Tracking are both places to LOOK at
 * attendance; corrections have one home and one dialog, on the HR desk, so
 * there stays exactly one write path.
 */
export function EmployeeAttendanceInline({
  userId,
  employeeName,
  employeeCode,
  departmentName,
  hasRoster,
  initialMonth,
  canCorrect = false,
  onOpenHistory,
  reloadKey,
}: {
  userId: number | string
  employeeName?: string | null
  employeeCode?: string | null
  departmentName?: string | null
  hasRoster?: boolean
  /** Seeds this component's own month. Defaults to the current month. */
  initialMonth?: string
  canCorrect?: boolean
  onOpenHistory?: (date: string) => void
  reloadKey?: number
}) {
  const [month, setMonth] = React.useState(() => initialMonth ?? currentMonth())

  const detail = useEmployeeDayDetail(userId, month)

  return (
    <div className="flex flex-col gap-5">
      {/*
        * The server's own counts, not a re-tally of the calendar's cells. The
        * component returns null when the response carries no summary, rather
        * than rendering zeroes that look like measurements.
        */}
      <AttendanceMonthSummary
        summary={detail.summary}
        hasRoster={hasRoster ?? detail.hasRoster}
      />

      <EmployeeAttendanceMonth
        userId={userId}
        /*
         * The caller's name if it has one, else the server's.
         *
         * Attendance Tracking's `?employee=<id>` view has nothing but an id -
         * nobody passed it a row - so without this fallback that surface would
         * render a month with no indication of whose it is. The monthly-report
         * response carries the name, and the hook already returns it.
         */
        employeeName={employeeName ?? detail.employeeName}
        employeeCode={employeeCode}
        departmentName={departmentName}
        hasRoster={hasRoster}
        month={month}
        onMonthChange={setMonth}
        canCorrect={canCorrect}
        onOpenHistory={onOpenHistory}
        reloadKey={reloadKey}
      />
    </div>
  )
}
