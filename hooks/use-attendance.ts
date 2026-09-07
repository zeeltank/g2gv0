'use client'

import { useState, useEffect, useCallback } from 'react'
import type {
  AttendanceAlertItem,
  AttendanceRecord,
  Event,
  LeaveBalance,
  MyRequestSummary,
  MonthlySummary,
  ShiftWindow,
} from '@/domain/hrms/hrit/attendance-management/types'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { hrmsService, leaveService, type LaravelAttendanceEntry } from '@/services/hrms'

/*
 * F-97. This hook used to open with two fixtures:
 *
 *   const mockLeaveBalance  = { casual: 12, earned: 7, sick: 0, pending: 1 }
 *   const mockUpcomingEvents = [{ title: 'Independence Day', date: '2026-08-15' }]
 *
 * and set them in its `finally` block, so they rendered on SUCCESS as well as
 * on failure. Every employee, in every tenant, was told they had 12 casual and
 * 7 earned days and that their next holiday was 15 August — regardless of their
 * actual balance or their tenant's actual holiday calendar.
 *
 * Both numbers already had correct, tenant-scoped endpoints that nothing called:
 * /api/leave/balances and /api/leave/holidays/upcoming. They are called now.
 * Nothing here re-implements them — a second version of a number the product
 * must agree with itself about is how the two drift apart.
 */

function formatDateInput(date: Date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function formatTimeInput(date: Date) {
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function formatDisplayTime(value?: string | null) {
  if (!value) return undefined

  const date = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDuration(value?: string | null) {
  if (!value) return undefined
  const [hours = '0', minutes = '0'] = value.split(':')
  return `${Number(hours)}h ${Number(minutes)}m`
}

const KNOWN_STATUSES: AttendanceRecord['status'][] = ['present', 'late', 'absent', 'half-day', 'leave']

/** The API also emits snake_case for the two-word statuses. */
const STATUS_ALIASES: Record<string, AttendanceRecord['status']> = {
  half_day: 'half-day',
  halfday: 'half-day',
}

export type WorkMode = 'office' | 'home' | 'field'

const WORK_MODE_LABELS: Record<WorkMode, string> = {
  office: 'Office',
  home: 'Work from home',
  field: 'Field',
}

export function workModeLabel(mode?: string | null): string {
  return WORK_MODE_LABELS[(mode ?? 'office') as WorkMode] ?? 'Office'
}

function mapAttendanceEntry(entry: LaravelAttendanceEntry): AttendanceRecord {
  // `day` is a DATE column, but drop any time part so the today lookup keeps
  // matching if the API ever serialises it as a datetime.
  const isoDay = String(entry.day ?? '').slice(0, 10)
  const date = new Date(`${isoDay}T00:00:00`)
  const day = Number.isNaN(date.getTime())
    ? entry.day
    : date.toLocaleDateString('en-US', { weekday: 'long' })

  const raw = entry.attendance_status ?? undefined
  const aliased = raw ? (STATUS_ALIASES[raw] ?? raw) : undefined

  return {
    id: String(entry.id),
    date: isoDay,
    day,
    punchIn: formatDisplayTime(entry.punchin_time),
    punchOut: formatDisplayTime(entry.punchout_time),
    totalHours: formatDuration(entry.timestamp_diff),
    /*
     * F-116. This used to be `: 'present'` — an unrecognised status silently
     * became Present, the most favourable possible reading of a day nobody
     * could classify. `undefined` instead, and the table renders "Unknown".
     * A defaulting rule for a status must never default to the answer that
     * flatters the record.
     */
    status: aliased && KNOWN_STATUSES.includes(aliased as AttendanceRecord['status'])
      ? (aliased as AttendanceRecord['status'])
      : undefined,
    /*
     * F-115. This used to be `entry.ipaddress_in ? 'Office' : undefined`, and
     * the table then rendered `record.location || 'Office'` — a constant twice
     * over. hrms_attendances.work_mode is the real value, added in Sprint 2.
     */
    workMode: (entry.work_mode as WorkMode | undefined) ?? undefined,
    location: entry.work_mode ? workModeLabel(entry.work_mode) : undefined,
  }
}

function sortRecordsByDateDesc(records: AttendanceRecord[]) {
  return [...records].sort((a, b) => {
    const aTime = new Date(`${a.date}T00:00:00`).getTime()
    const bTime = new Date(`${b.date}T00:00:00`).getTime()

    if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0
    if (Number.isNaN(aTime)) return 1
    if (Number.isNaN(bTime)) return -1

    return bTime - aTime
  })
}

export function useAttendance() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null)
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null)
  const [attendancePercentage, setAttendancePercentage] = useState(0)
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null)
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([])
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([])
  const [shift, setShift] = useState<ShiftWindow | null>(null)
  const [alerts, setAlerts] = useState<AttendanceAlertItem[]>([])
  const [requests, setRequests] = useState<MyRequestSummary[]>([])
  const [todayWorkMode, setTodayWorkMode] = useState<WorkMode | null>(null)

  const loadAttendance = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const context = getLaravelContext(user)

      /*
       * Four independent reads, so one slow or failing panel does not blank the
       * others. Settled, not `all`: an employee whose tenant has configured no
       * leave types should still see their punches.
       */
      const [attendance, summary, balances, holidays] = await Promise.allSettled([
        hrmsService.getMyAttendance(context),
        hrmsService.getAttendanceSelfSummary(context),
        leaveService.getBalances(context),
        leaveService.getUpcomingHolidays(context, 5),
      ])

      if (attendance.status === 'rejected') {
        throw attendance.reason
      }

      const response = attendance.value
      const records = sortRecordsByDateDesc((response.attendanceData ?? []).map(mapAttendanceEntry))
      const today = formatDateInput(new Date())
      // Strictly today's row. Falling back to the newest record made a stale
      // open shift from an earlier day render as today's, so the panel offered
      // Punch Out and the API rejected it with "No punch in record found for
      // this employee and date" - punch out always posts today's date.
      const todayFromApi = records.find((record) => record.date === today) ?? null

      setTodayRecord(todayFromApi)
      setAttendanceHistory(records)
      setMonthlySummary({
        present: response.presentDays ?? 0,
        late: response.lateDays ?? 0,
        leave: response.leaveDays ?? 0,
        absent: response.absentDays ?? 0,
      })
      /*
       * F-108. The percentage is the API's, not a second one computed here.
       * The page used to derive its own as
       *   present / (present + late + leave + absent)
       * while the backend returns (present + late) / workingDays. With 15
       * present, 3 late, 2 leave, 1 absent over 21 working days those are
       * 71.4% and 85.7% — two answers to one question, and the screen showed
       * the one nobody had reviewed.
       */
      setAttendancePercentage(Math.round(Number(response.percentege ?? 0)))

      if (summary.status === 'fulfilled') {
        const shiftData = summary.value.shift
        setShift(
          shiftData
            ? {
                isWorkingDay: Boolean(shiftData.is_working_day),
                expectedIn: shiftData.expected_in ?? null,
                expectedOut: shiftData.expected_out ?? null,
                expectedMinutes: shiftData.expected_minutes ?? null,
                source: shiftData.source ?? 'none',
              }
            : null,
        )
        setAlerts(summary.value.alerts ?? [])
        setRequests(
          (summary.value.requests ?? []).map((row) => ({
            id: row.id,
            type: row.type,
            pending: row.pending,
            approved: row.approved,
            rejected: row.rejected,
          })),
        )
        setTodayWorkMode((summary.value.work_mode as WorkMode | null) ?? null)
      }

      if (balances.status === 'fulfilled') {
        const data = balances.value.data
        setLeaveBalance(
          data
            ? {
                types: (data.leave_types ?? []).map((row) => ({
                  leaveType: row.leave_type,
                  total: Number(row.total ?? 0),
                  used: Number(row.used ?? 0),
                  remaining: Number(row.remaining ?? 0),
                })),
                total: Number(data.overall?.total ?? 0),
                used: Number(data.overall?.used ?? 0),
                remaining: Number(data.overall?.remaining ?? 0),
              }
            : null,
        )
      }

      if (holidays.status === 'fulfilled') {
        setUpcomingEvents(
          (holidays.value.data ?? []).map((holiday) => ({
            id: String(holiday.id),
            title: holiday.name,
            date: holiday.from_date ?? '',
            type: 'holiday' as const,
            description: holiday.department || undefined,
          })),
        )
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load attendance.')
      setTodayRecord(null)
      setMonthlySummary(null)
      setAttendanceHistory([])
      // No fixtures on the failure path either. An empty panel that says so is
      // a better answer than a confident wrong one.
      setLeaveBalance(null)
      setUpcomingEvents([])
      setShift(null)
      setAlerts([])
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    queueMicrotask(() => {
      loadAttendance()
    })
  }, [loadAttendance])

  const punch = async (action: 'in' | 'out', workMode: WorkMode = 'office') => {
    setProcessing(true)
    setError(null)
    try {
      const context = getLaravelContext(user)
      const now = new Date()
      const date = formatDateInput(now)
      const time = formatTimeInput(now)

      if (action === 'in') {
        await hrmsService.punchAttendanceIn(context, { date, time, workMode })
      } else {
        await hrmsService.punchAttendanceOut(context, { date, time })
      }
      await loadAttendance()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to record attendance. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  /*
   * F-117. This used to be
   *   const retry = () => { setError(null); punch(...) }
   * — a retry, offered after a failed *load*, that wrote an attendance punch.
   * Retrying a page that would not load should reload the page.
   */
  const retry = useCallback(() => {
    setError(null)
    loadAttendance()
  }, [loadAttendance])

  return {
    loading,
    processing,
    error,
    todayRecord,
    monthlySummary,
    attendancePercentage,
    leaveBalance,
    upcomingEvents,
    attendanceHistory,
    shift,
    alerts,
    requests,
    todayWorkMode,
    punch,
    retry,
    reload: loadAttendance,
  }
}
