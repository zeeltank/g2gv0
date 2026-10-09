'use client'

import * as React from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { EmployeeAttendanceInline } from '@/domain/hrms/hrit/attendance-management/shared/employee-attendance-inline'

interface AttendanceCalendarDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Your own attendance month, in a drawer.
 *
 * ── WHAT THIS FILE USED TO BE, AND WHY IT IS NOW SIX LINES OF BODY ──────────
 *
 * 340 lines: its own month grid maths (`buildMonthGrid`, `startOfMonth`,
 * `endOfMonth`, `formatDateInput`), its own four-status vocabulary, its own
 * colour maps, its own summary reader and its own fetch - all of it a second
 * implementation of what `EmployeeAttendanceMonth` + `AttendanceMonthSummary`
 * now do for the HR desk and the Employee Directory.
 *
 * Two implementations of "an attendance month" is how the two disagreed, and
 * they did:
 *
 *   1. `toDayStatus()` returned **null for `incomplete`**, and a null status
 *      renders unmarked. So a day where you punched in and never punched out
 *      looked EXACTLY like a day you were never at work - on the employee's
 *      own calendar, which is the one place somebody would notice a missing
 *      punch-out in time to file a regularisation about it. It is the same
 *      defect class as the HR grid's `STATUS_CLASS[cell.status]` returning
 *      undefined for an unknown status.
 *
 *   2. It knew four statuses - present, late, absent, leave. No holiday, no
 *      half day, no week-off, and no `unset`. The shared vocabulary in
 *      `shared/attendance-day-status.ts` carries all of them, including the
 *      distinction this module exists to make: an employee with NO ROSTER is
 *      `unset`, not `weekend`.
 *
 * ── THE SUBJECT IS THE SESSION'S OWN user_id, NOT `user.id` ─────────────────
 *
 * This drawer's signature is unchanged - `{ open, onOpenChange }` - so it has
 * no subject passed in and must resolve its own. It uses
 * `getLaravelContext(user).userId`, which reads the stored Laravel session.
 * That is the SAME value the API already receives as the caller on every other
 * request, so the monthly report's self branch (HR-or-self, F-159) permits it.
 *
 * `useAuth().user.id` was deliberately not used: it is a different field from a
 * different store, and the one that matters is the one the server will compare
 * against. A subject that disagrees with the token here would 403 the employee
 * out of their own calendar.
 *
 * ── THE ENDPOINT CHANGED, AND THAT IS THE POINT ─────────────────────────────
 *
 * It read `getMyAttendance` (a date range, token-resolved). The shared month
 * reads `/employee-attendance-monthly-report`, which is strictly richer - leave
 * with its reason, holiday names, `is_late`, the expected shift window and a
 * server-computed summary - and is the same endpoint the HR desk reads, so
 * what you see about your own month is now what HR sees about it.
 */
export function AttendanceCalendarDrawer({ open, onOpenChange }: AttendanceCalendarDrawerProps) {
  const { user } = useAuth()

  const userId = React.useMemo(() => getLaravelContext(user).userId, [user])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/*
        * Wider than the `w-3/5 max-w-lg` this used to be. A seven-column month
        * with times in the cells does not fit in max-w-lg, and the previous
        * grid only fitted because it drew a coloured dot and nothing else.
        */}
      <SheetContent className="flex w-full flex-col gap-0 border-l border-border/80 p-0 sm:max-w-3xl">
        <SheetHeader className="space-y-0 p-6 pb-0 text-left">
          <SheetTitle>My attendance</SheetTitle>
          <SheetDescription>
            Your month, day by day. Click a day to see the detail.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {/*
            * Mounted only while open, so closing the drawer stops it holding a
            * month of somebody's attendance, and reopening it starts on the
            * current month rather than wherever it was last left.
            *
            * `canCorrect` is absent: this is the employee's own view, and an
            * employee does not correct their own attendance - they file a
            * regularisation, which has its own drawer on the page behind this.
            */}
          {open && userId ? (
            <EmployeeAttendanceInline userId={userId} />
          ) : (
            <Skeleton className="h-96 w-full" />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
