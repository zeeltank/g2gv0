'use client'

import * as React from 'react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useEmployeeDayDetail } from '@/hooks/use-employee-day-detail'
import { EmployeeAttendanceMonth } from './employee-attendance-month'
import { AttendanceMonthSummary } from './attendance-month-summary'
import type { AttendanceDayCell } from './attendance-day-status'

/**
 * One employee's attendance month, in a drawer.
 *
 * ── WHY THE SHEET IS A SEPARATE FILE FROM THE MONTH ─────────────────────────
 *
 * The same month + summary has three homes, and only two of them want a drawer:
 *
 *   the HR attendance desk      this Sheet, opened by clicking an employee
 *   Employee Directory          INLINE in a tab - the directory drawer is
 *                               already a Sheet, and a Sheet inside a Sheet is
 *                               a stacking and focus-trap problem
 *   Attendance Tracking         inline, in place of the self dashboard
 *
 * So the Sheet is a thin mount around `EmployeeAttendanceMonth` +
 * `AttendanceMonthSummary` rather than part of them. The two surfaces that
 * cannot nest a Sheet compose those two directly.
 *
 * ── THE MONTH IS THIS PANEL'S OWN STATE ─────────────────────────────────────
 *
 * Seeded from whatever month the caller was looking at, and never written back.
 * Mount it with `key={userId}` so a different employee starts fresh. Paging the
 * calendar inside the drawer must not re-page the grid behind it -
 * the same mistake the change-history tab makes today by sharing the grid's
 * month setter, where changing the month in one tab silently re-fetches the
 * other.
 *
 * ── THE CORRECTION DIALOG IS NOT RENDERED HERE ──────────────────────────────
 *
 * `onCorrect` bubbles out to the page, which renders the dialog as a SIBLING of
 * this Sheet. Both are z-50, so DOM order is what puts the dialog on top; a
 * dialog rendered inside the Sheet would be trapped under it.
 */
export function EmployeeAttendancePanel({
  open,
  onOpenChange,
  userId,
  employeeName,
  employeeCode,
  departmentName,
  hasRoster,
  initialMonth,
  canCorrect = false,
  onCorrect,
  onOpenHistory,
  reloadKey,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: number | string
  employeeName?: string | null
  employeeCode?: string | null
  departmentName?: string | null
  hasRoster?: boolean
  /** Seeds this panel's own month. Not kept in step with the caller's. */
  initialMonth: string
  canCorrect?: boolean
  onCorrect?: (date: string, cell: AttendanceDayCell) => void
  onOpenHistory?: (date: string) => void
  reloadKey?: number
}) {
  /*
   * This panel owns its month, seeded once from the caller's.
   *
   * MOUNT THIS WITH key={userId} - the parent is expected to, and it is how
   * opening a different employee gets a fresh month instead of inheriting
   * wherever you had paged to for the last one.
   *
   * The first version of this tried to re-seed in-render by comparing a ref,
   * which is the "adjust state when a prop changes" pattern - and the linter
   * correctly refused it, because writing a ref during render is not allowed
   * and the setState alongside it was the same smell. A key is the plain answer
   * to "this subtree is about a different thing now", and it needs no
   * reconciliation logic to get wrong.
   */
  const [month, setMonth] = React.useState(initialMonth)

  // A second read of the same endpoint the calendar uses, for the summary.
  // Cheap: the hook is keyed on (userId, month) and both components ask for the
  // same pair, so this is one request's worth of work either way.
  const detail = useEmployeeDayDetail(open ? userId : null, open ? month : null)

  const monthLabel = React.useMemo(() => {
    const [year, mon] = month.split('-').map(Number)
    if (!year || !mon) return month
    return new Date(year, mon - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  }, [month])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 border-l border-border/80 p-0 sm:max-w-3xl">
        <SheetHeader className="space-y-0 p-6 pb-0 text-left">
          <SheetTitle>{employeeName || 'Employee attendance'}</SheetTitle>
          <SheetDescription>
            {monthLabel}
            {canCorrect ? ' · click a day to correct it' : ' · read only'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
          <AttendanceMonthSummary
            summary={detail.summary}
            hasRoster={hasRoster ?? detail.hasRoster}
          />

          <EmployeeAttendanceMonth
            userId={userId}
            employeeName={employeeName}
            employeeCode={employeeCode}
            departmentName={departmentName}
            hasRoster={hasRoster}
            month={month}
            onMonthChange={setMonth}
            canCorrect={canCorrect}
            onCorrect={onCorrect}
            onOpenHistory={onOpenHistory}
            reloadKey={reloadKey}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
