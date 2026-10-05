'use client'

import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import {
  hrmsService,
  type AttendanceEmployeeOption,
  type MonthlyAttendanceDay,
  type MonthlyAttendanceSummary,
} from '@/services/hrms'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/** "YYYY-MM" for a Date. */
function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** The last N months, newest first, as {value,label} for the picker. */
export function recentMonths(count = 18): Array<{ value: string; label: string }> {
  const out: Array<{ value: string; label: string }> = []
  const cursor = new Date()
  cursor.setDate(1)
  for (let i = 0; i < count; i += 1) {
    out.push({
      value: monthKey(cursor),
      label: cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    })
    cursor.setMonth(cursor.getMonth() - 1)
  }
  return out
}

/**
 * Monthly Attendance Report - GET /api/employee-attendance-monthly-report.
 *
 * F-171. The most complete attendance endpoint in the module, with no caller
 * anywhere: a nine-field summary plus one row per date carrying status, punch
 * times, working hours, lateness, the rostered shift, any leave with its
 * reason, and any holiday name. It is roster- and holiday-aware, so a Sunday
 * reads as 'weekend' rather than as an absence - which the day-count reports
 * this module already ships cannot distinguish.
 *
 * The server refuses a user_id that is not the caller unless the caller is
 * admin/hr/executive/auditor (F-159). That refusal is surfaced as-is: it is
 * more specific than anything worth writing here.
 */
export function useMonthlyAttendance() {
  const { user, isLoading: authLoading } = useAuth()

  const [month, setMonth] = useState(() => monthKey(new Date()))
  const [employeeId, setEmployeeId] = useState<string>('')

  /*
   * The department filter. /attendance/employees has ALWAYS accepted a
   * department_id - hrmsService.getAttendanceEmployees takes one as its second
   * argument - and this hook simply never passed it, so the screen offered a
   * flat list of every employee in the organisation and no way to narrow it.
   * Nothing new is needed on the server.
   */
  const [departmentId, setDepartmentId] = useState<string>('all')
  const [departments, setDepartments] = useState<Array<{ value: string; label: string }>>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [employees, setEmployees] = useState<AttendanceEmployeeOption[]>([])
  const [summary, setSummary] = useState<MonthlyAttendanceSummary | null>(null)
  const [days, setDays] = useState<MonthlyAttendanceDay[]>([])
  const [employeeName, setEmployeeName] = useState('')
  const [loadedFor, setLoadedFor] = useState<{ month: string; employeeId: string } | null>(null)

  // The employee picker. Its own failure must not present as "no employees":
  // an empty list with no error would read as an organisation with no staff.
  const [employeesError, setEmployeesError] = useState<string | null>(null)

  // The department list, once. Its own failure leaves the filter empty rather
  // than blocking the screen - an employee picker still works unfiltered.
  useEffect(() => {
    if (authLoading || !user) return
    let cancelled = false

    hrmsService
      .getAttendanceReportIndex(getLaravelContext(user))
      .then((response) => {
        if (cancelled) return
        const raw = response.departments
        const list: Array<{ value: string; label: string }> = Array.isArray(raw)
          ? raw.map((entry) =>
              typeof entry === 'string'
                ? { value: entry, label: entry }
                : { value: String(entry.value ?? ''), label: String(entry.label ?? '') },
            )
          : Object.entries(raw ?? {}).map(([value, label]) => ({ value, label: String(label) }))
        setDepartments(list.filter((entry) => entry.value !== '' && entry.label !== ''))
      })
      .catch(() => {
        if (!cancelled) setDepartments([])
      })

    return () => {
      cancelled = true
    }
  }, [authLoading, user])

  useEffect(() => {
    if (authLoading || !user) return
    let cancelled = false

    hrmsService
      .getAttendanceEmployees(getLaravelContext(user), departmentId)
      .then((response) => {
        if (cancelled) return
        setEmployees(response.employees ?? [])
        setEmployeesError(null)
        // Default to the signed-in user, so the screen opens on something real
        // for an employee and HR can switch.
        setEmployeeId((current) => current || String(user.id ?? ''))
      })
      .catch((listError) => {
        if (cancelled) return
        setEmployees([])
        setEmployeesError(toMessage(listError, 'Could not load the employee list.'))
        setEmployeeId((current) => current || String(user.id ?? ''))
      })

    return () => {
      cancelled = true
    }
  }, [authLoading, user, departmentId])

  const load = useCallback(
    async (next?: { month?: string; employeeId?: string }) => {
      const targetMonth = next?.month ?? month
      const targetEmployee = next?.employeeId ?? employeeId

      if (!user || !targetEmployee) return

      setLoading(true)
      setError(null)

      try {
        const response = await hrmsService.getEmployeeMonthlyAttendance(getLaravelContext(user), {
          userId: targetEmployee,
          month: targetMonth,
        })

        const payload = response.data ?? {}
        setSummary(payload.summary ?? null)
        setDays(payload.daily_report ?? [])
        setEmployeeName(String(payload.employee?.name ?? '').replace(/\s+/g, ' ').trim())
        setLoadedFor({ month: targetMonth, employeeId: targetEmployee })
      } catch (loadError) {
        // A refusal (403) and a failure both land here, and both must clear the
        // table: leaving the previous employee's month on screen under a new
        // name would be worse than showing nothing.
        setSummary(null)
        setDays([])
        setEmployeeName('')
        setLoadedFor(null)
        setError(toMessage(loadError, 'Could not load the attendance for that month.'))
      } finally {
        setLoading(false)
      }
    },
    [month, employeeId, user],
  )

  useEffect(() => {
    if (authLoading || !employeeId) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, employeeId])

  return {
    month,
    setMonth,
    employeeId,
    setEmployeeId,
    departmentId,
    setDepartmentId,
    departments,
    employees,
    employeesError,
    months: recentMonths(),
    loading,
    error,
    summary,
    days,
    employeeName,
    loadedFor,
    apply: () => load(),
    retry: () => load(),
  }
}
