'use client'

import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { hrmsService, type MonthlyAttendanceDay } from '@/services/hrms'

/**
 * One employee's day-by-day attendance for a month.
 *
 * WHY THIS EXISTS. The attendance drill-down drawer had no data source at all.
 * Its "Recent Attendance Records" table was fed by slicing the EARLY-GOING
 * dataset, which covers a single date and only rows that have already punched
 * out — so with the screen's default range of "today" it was empty essentially
 * always, and two of the columns it rendered (`workingHours`, `earlyGoing`)
 * were never populated by any branch and so read `--` and `0` permanently.
 * "No recent records" was not a quiet month; it was a table wired to the wrong
 * query.
 *
 * `/api/employee-attendance-monthly-report` is the endpoint that actually
 * answers this question, and it already existed: punch in and out, working
 * hours, lateness, the rostered shift, leave with its reason, and holidays,
 * resolved per day. It enforces HR-or-self server-side, so opening a drawer on
 * a colleague is refused for anyone who should not see it rather than being
 * prevented only by the UI.
 */
export interface EmployeeDayDetail {
  loading: boolean
  error: string | null
  days: MonthlyAttendanceDay[]
  reload: () => void
}

export function useEmployeeDayDetail(
  /** tbluser.id. Null closes the hook down — nothing is fetched. */
  userId: string | number | null,
  /** "YYYY-MM". */
  month: string | null,
): EmployeeDayDetail {
  const { user, isLoading: authLoading } = useAuth()

  const [days, setDays] = useState<MonthlyAttendanceDay[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((value) => value + 1), [])

  useEffect(() => {
    if (authLoading || !user || !userId || !month) {
      setDays([])
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    hrmsService
      .getEmployeeMonthlyAttendance(getLaravelContext(user), {
        userId: String(userId),
        month,
      })
      .then((response) => {
        if (cancelled) return
        setDays(response.data?.daily_report ?? [])
      })
      .catch((caught) => {
        if (cancelled) return
        // Never rendered as "no records" — an empty month and a failed request
        // look identical in a table, and only one of them is about the employee.
        setDays([])
        setError(
          caught instanceof Error
            ? caught.message
            : 'Could not load this employee’s attendance.',
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [authLoading, user, userId, month, nonce])

  return { loading, error, days, reload }
}
