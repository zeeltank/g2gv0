export type AttendanceStatus = 'present' | 'late' | 'absent' | 'half-day' | 'leave'

export interface AttendanceRecord {
  id: string
  date: string
  day: string
  punchIn?: string
  punchOut?: string
  totalHours?: string
  breakTime?: string
  overtime?: string
  status: AttendanceStatus
  location?: string
}

export interface LeaveBalance {
  casual: number
  earned: number
  sick: number
  pending: number
}

export interface Event {
  id: string
  title: string
  date: string
  type: 'holiday' | 'event'
  description?: string
}

export interface MonthlySummary {
  present: number
  late: number
  leave: number
  absent: number
}