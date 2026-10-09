'use client'

import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import {
  hrmsService,
  type MonthlyAttendanceDay,
  type MonthlyAttendanceSummary,
} from '@/services/hrms'

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
  /**
   * The server's own month counts, or null when it did not send them.
   *
   * Null rather than a zeroed object on purpose, so a caller hides the card
   * instead of rendering nine confident zeroes. The tracking calendar drawer
   * set that precedent and its comment explains it: derived numbers on a screen
   * whose job is to be trusted are worse than no numbers.
   */
  summary: MonthlyAttendanceSummary | null
  /**
   * Whether this employee has ANY rostered working day.
   *
   * Load-bearing, not decoration. The monthly report has no `unset` status - for
   * an employee with no roster it answers `weekend` for every day of the month -
   * so a caller cannot tell "day off" from "nobody ever recorded which days this
   * person works" without it. `undefined` means the server did not say, and the
   * honest rendering of that is a neutral state, not a guess either way.
   */
  hasRoster: boolean | undefined
  employeeName: string | null
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
  const [summary, setSummary] = useState<MonthlyAttendanceSummary | null>(null)
  const [hasRoster, setHasRoster] = useState<boolean | undefined>(undefined)
  const [employeeName, setEmployeeName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((value) => value + 1), [])

  useEffect(() => {
    if (authLoading || !user || !userId || !month) {
      /*
       * Deferred, not called straight from the effect body.
       *
       * Six setState calls in a row inside an effect is the cascading-render
       * pattern this repo defers everywhere else, and the rule that flags it
       * was already firing on this branch before the summary/roster fields were
       * added - it is not new, it is just worth fixing now that two more
       * components read this hook.
       *
       * A microtask rather than a timeout: the clear should land in the same
       * frame, since it is "the inputs went away", not a fetch.
       */
      queueMicrotask(() => {
        setDays([])
        setSummary(null)
        setHasRoster(undefined)
        setEmployeeName(null)
        setError(null)
      })
      return
    }

    let cancelled = false

    /*
     * Deferred, like the reset above - and the FETCH is not.
     *
     * The request goes out immediately; only the two state writes that mark it
     * as in-flight are pushed past this commit. So nothing is slower, and the
     * effect no longer sets state synchronously during render.
     */
    queueMicrotask(() => {
      if (cancelled) return
      setLoading(true)
      setError(null)
    })

    hrmsService
      .getEmployeeMonthlyAttendance(getLaravelContext(user), {
        userId: String(userId),
        month,
      })
      .then((response) => {
        if (cancelled) return
        setDays(response.data?.daily_report ?? [])
        setSummary(response.data?.summary ?? null)
        setHasRoster(response.data?.employee?.has_roster)
        setEmployeeName(response.data?.employee?.name ?? null)
      })
      .catch((caught) => {
        if (cancelled) return
        // Never rendered as "no records" — an empty month and a failed request
        // look identical in a table, and only one of them is about the employee.
        setDays([])
        setSummary(null)
        setHasRoster(undefined)
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

  return { loading, error, days, summary, hasRoster, employeeName, reload }
}
