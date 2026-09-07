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
  /**
   * Optional on purpose (F-116). An unrecognised status used to be coerced to
   * `'present'` — the most favourable reading of a day nobody could classify.
   * `undefined` now means "the API sent something we do not know", and the UI
   * says so rather than flattering the record.
   */
  status?: AttendanceStatus
  /** hrms_attendances.work_mode — office | home | field. */
  workMode?: 'office' | 'home' | 'field'
  /** Display label for workMode. Was the constant 'Office' (F-115). */
  location?: string
}

/**
 * Leave balance as the tenant actually configures it.
 *
 * This was `{ casual, earned, sick, pending }` — four fixed leave types, which
 * matched the fixture the dashboard rendered (F-97) and no tenant's real
 * configuration. Leave types are per-tenant rows in `hrms_leave_types`;
 * tenant 3 has "Annual Leave", "Scholar Clone" and "Scholar Clone 2".
 */
export interface LeaveBalanceType {
  leaveType: string
  total: number
  used: number
  remaining: number
}

export interface LeaveBalance {
  types: LeaveBalanceType[]
  total: number
  used: number
  remaining: number
}

/** Today's expected in/out, from the employee's own roster on `tbluser`. */
export interface ShiftWindow {
  isWorkingDay: boolean
  expectedIn: string | null
  expectedOut: string | null
  expectedMinutes: number | null
  /** 'roster' when the employee has one; 'none' when they do not, and the UI says so. */
  source: 'roster' | 'none'
}

export interface AttendanceAlertItem {
  id: string
  text: string
  severity: 'critical' | 'warning' | 'info'
  date: string | null
}

export interface MyRequestSummary {
  id: string
  type: string
  pending: number
  approved: number
  rejected: number
}

export type RegularisationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface RegularisationRequest {
  id: number
  employeeId: number
  employeeName: string | null
  employeeNo: string | null
  department: string | null
  day: string
  requestedInTime: string | null
  requestedOutTime: string | null
  originalInTime: string | null
  originalOutTime: string | null
  reason: string
  status: RegularisationStatus
  reviewerComment: string | null
  reviewedAt: string | null
  submittedAt: string | null
}

export interface Event {
  id: string
  title: string
  date: string
  type: 'holiday' | 'event' | 'leave'
  description?: string
}

export interface MonthlySummary {
  present: number
  late: number
  leave: number
  absent: number
}