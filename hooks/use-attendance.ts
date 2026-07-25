'use client'

import { useState, useEffect, useCallback } from 'react'
import type { AttendanceRecord, LeaveBalance, Event, MonthlySummary } from '@/domain/hrms/hrit/attendance-management/types'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { hrmsService, type LaravelAttendanceEntry } from '@/services/hrms'

const mockLeaveBalance: LeaveBalance = {
  casual: 12,
  earned: 7,
  sick: 0,
  pending: 1,
}

const mockUpcomingEvents: Event[] = [
  {
    id: 'e1',
    title: 'Independence Day',
    date: '2026-08-15',
    type: 'holiday',
    description: 'National Holiday',
  },
]

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

function mapAttendanceEntry(entry: LaravelAttendanceEntry): AttendanceRecord {
  const date = new Date(`${entry.day}T00:00:00`)
  const day = Number.isNaN(date.getTime())
    ? entry.day
    : date.toLocaleDateString('en-US', { weekday: 'long' })
  const hasPunchIn = Boolean(entry.punchin_time)
  const hasPunchOut = Boolean(entry.punchout_time)

  return {
    id: String(entry.id),
    date: entry.day,
    day,
    punchIn: formatDisplayTime(entry.punchin_time),
    punchOut: formatDisplayTime(entry.punchout_time),
    totalHours: formatDuration(entry.timestamp_diff),
    status: hasPunchIn && hasPunchOut ? 'present' : hasPunchIn ? 'present' : 'absent',
    location: entry.ipaddress_in ? 'Office' : undefined,
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
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null)
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([])
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([])

  const loadAttendance = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const context = getLaravelContext(user)
      const response = await hrmsService.getMyAttendance(context)
      const records = sortRecordsByDateDesc((response.attendanceData ?? []).map(mapAttendanceEntry))
      const today = formatDateInput(new Date())
      const todayFromApi = records.find((record) => record.date === today) ?? records[0] ?? null

      setTodayRecord(todayFromApi)
      setMonthlySummary({
        present: response.presentDays ?? 0,
        late: response.lateDays ?? 0,
        leave: response.leaveDays ?? 0,
        absent: response.absentDays ?? 0,
      })
      setAttendanceHistory(records)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load attendance.')
      setTodayRecord(null)
      setMonthlySummary(null)
      setAttendanceHistory([])
    } finally {
      setLeaveBalance(mockLeaveBalance)
      setUpcomingEvents(mockUpcomingEvents)
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    queueMicrotask(() => {
      loadAttendance()
    })
  }, [loadAttendance])

  const punch = async (action: 'in' | 'out') => {
    setProcessing(true)
    setError(null)
    try {
      const context = getLaravelContext(user)
      const now = new Date()
      const date = formatDateInput(now)
      const time = formatTimeInput(now)

      if (action === 'in') {
        await hrmsService.punchAttendanceIn(context, { date, time })
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

  const retry = () => {
    setError(null)
    punch(todayRecord?.punchIn && !todayRecord?.punchOut ? 'out' : 'in')
  }

  return {
    loading,
    processing,
    error,
    todayRecord,
    monthlySummary,
    leaveBalance,
    upcomingEvents,
    attendanceHistory,
    punch,
    retry,
  }
}
