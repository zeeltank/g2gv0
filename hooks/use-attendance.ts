'use client'

import { useState, useEffect } from 'react'
import type { AttendanceRecord, LeaveBalance, Event, MonthlySummary } from './types'

const mockTodayRecord: AttendanceRecord = {
  id: 'today',
  date: '2026-06-23',
  day: 'Tuesday',
  punchIn: '09:00 AM',
  punchOut: undefined,
  totalHours: undefined,
  breakTime: undefined,
  overtime: undefined,
  status: 'present',
}

const mockMonthlySummaryData: MonthlySummary = {
  present: 20,
  late: 2,
  leave: 1,
  absent: 0,
}

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

const mockAttendanceHistory: AttendanceRecord[] = [
  {
    id: 'r1',
    date: '2026-06-22',
    day: 'Monday',
    punchIn: '09:15 AM',
    punchOut: '06:00 PM',
    totalHours: '8h 45m',
    breakTime: '45m',
    overtime: '15m',
    status: 'late',
  },
  {
    id: 'r2',
    date: '2026-06-21',
    day: 'Sunday',
    punchIn: undefined,
    punchOut: undefined,
    totalHours: undefined,
    breakTime: undefined,
    overtime: undefined,
    status: 'leave',
  },
  {
    id: 'r3',
    date: '2026-06-20',
    day: 'Saturday',
    punchIn: undefined,
    punchOut: undefined,
    totalHours: undefined,
    breakTime: undefined,
    overtime: undefined,
    status: 'absent',
  },
  {
    id: 'r4',
    date: '2026-06-19',
    day: 'Friday',
    punchIn: '09:00 AM',
    punchOut: '06:00 PM',
    totalHours: '8h 0m',
    breakTime: '30m',
    overtime: '0m',
    status: 'present',
  },
  {
    id: 'r5',
    date: '2026-06-18',
    day: 'Thursday',
    punchIn: '08:55 AM',
    punchOut: '05:55 PM',
    totalHours: '8h 0m',
    breakTime: '30m',
    overtime: '0m',
    status: 'present',
  },
]

export function useAttendance() {
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null)
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null)
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null)
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([])
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([])

  useEffect(() => {
    // Simulate API call
    const timer = setTimeout(() => {
      setTodayRecord(mockTodayRecord)
      setMonthlySummary(mockMonthlySummaryData)
      setLeaveBalance(mockLeaveBalance)
      setUpcomingEvents(mockUpcomingEvents)
      setAttendanceHistory(mockAttendanceHistory)
      setLoading(false)
    }, 500)

    return () => clearTimeout(timer)
  }, [])

  const punch = async (action: 'in' | 'out') => {
    setProcessing(true)
    setError(null)
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500))
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      if (action === 'in') {
        setTodayRecord((prev) =>
          prev
            ? {
                ...prev,
                punchIn: time,
                punchOut: undefined,
                status: 'present',
              }
            : null,
        )
      } else {
        setTodayRecord((prev) =>
          prev
            ? {
                ...prev,
                punchOut: time,
              }
            : null,
        )
      }
    } catch {
      setError('Failed to record attendance. Please try again.')
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