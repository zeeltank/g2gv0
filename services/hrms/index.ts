/**
 * HRMS Service
 * API calls for HRMS - attendance, leave, and compliance
 */

import { apiClient, webClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

// Leave Management module - /api/leave/*
export * from './leave'
export * from './leave-bi'

// Payroll module - legacy Laravel web routes (routes/hrms.php)
export * from './payroll'
// Employee module
export * from './employee'
// F-130. My HR - the employee's own view of themselves.
export * from './my-hr'

export interface AttendanceRecord {
  id: string
  userId: string
  date: string
  checkIn?: string
  checkOut?: string
  status: 'present' | 'absent' | 'late' | 'half_day'
}

export interface ComplianceItem {
  id: string
  title: string
  category: string
  dueDate?: string
  status: 'compliant' | 'non_compliant' | 'pending'
  assignedTo?: string
}

export interface AttendanceKpiResponse {
  present_today: string
  leave_utilization: string
  active_employees: number
}

export interface AttendanceWeeklyPunch {
  employee_id: number | string
  day: string
  type: 'present' | 'absent' | 'incomplete' | string
  time: string | null
}

export interface AttendanceWeeklyResponse {
  date_range: {
    start: string
    end: string
  }
  department_filter: number | string
  labels: string[]
  present: number[]
  absent: number[]
  late: number[]
  punch_times: Record<string, AttendanceWeeklyPunch[]>
}

export interface AttendanceWeeklyParams {
  fromDate?: string
  toDate?: string
  departmentId?: string
  employeeId?: string
}

export interface AttendanceOption {
  value: string
  label: string
}

export interface LaravelAttendanceEntry {
  id: number | string
  user_id: number | string
  employee_no?: string | null
  employee_name?: string | null
  department?: string | null
  day: string
  punchin_time?: string | null
  punchout_time?: string | null
  timestamp_diff?: string | null
  status?: number | string | null
  attendance_status?: string | null
  status_label?: string | null
  type?: string | null
  ipaddress_in?: string | null
  ipaddress_out?: string | null
  /** office | home | field. Added in Sprint 2 — see hrms_attendances.work_mode. */
  work_mode?: string | null
}

/** One calendar day of the requested range, as resolved by Laravel. */
export interface LaravelAttendanceCalendarDay {
  date: string
  day_name?: string
  /** null when the API has no status for that date - render nothing. */
  status: 'present' | 'late' | 'absent' | 'leave' | null
  is_working_day?: boolean
  is_holiday?: boolean
  holiday_name?: string | null
  leave_type?: string | null
  day_type?: string | null
  punchin_time?: string | null
  punchout_time?: string | null
  timestamp_diff?: string | null
  work_mode?: string | null
}

export interface MyAttendanceResponse {
  status?: number | string
  status_code?: number | string
  message?: string
  fromDate?: string
  toDate?: string
  daysInMonth?: number
  workingDays?: number
  holidays?: number
  presentDays?: number
  lateDays?: number
  leaveDays?: number
  absentDays?: number
  percentege?: number
  calendar?: LaravelAttendanceCalendarDay[]
  attendanceData?: LaravelAttendanceEntry[]
}

export interface AttendanceReportIndexResponse {
  employee_id?: string | number | null
  department_id?: string | number | null
  from_date_formatted?: string
  to_date_formatted?: string
  departments?: Record<string, string> | string[] | AttendanceOption[]
}

export interface AttendanceEmployeeOption {
  id: number | string
  employee_no?: string | null
  first_name?: string | null
  middle_name?: string | null
  last_name?: string | null
}

export interface AttendanceEmployeesResponse {
  employees?: AttendanceEmployeeOption[]
  department_id?: string | number | null
  employee_id?: string | number | null
}

export interface DepartmentAttendanceEmployee {
  user_id: number | string
  employee_no?: string | null
  full_name?: string | null
  user_profile?: string | null
  department?: string | null
  department_id?: string | null
  total_att_day?: number | string | null
  total_ab_day?: number | string | null
  total_holidays?: number | string | null
  half_day?: number | string | null
  late?: number | string | null
  weekday_off?: number | string | null
  totalDays?: number | string | null
  workingDays?: number | string | null
}

export interface DepartmentAttendanceReportResponse {
  status_code?: number | string
  message?: string
  empData?: DepartmentAttendanceEmployee[]
}

export interface EarlyGoingUser {
  employee_no?: string | null
  first_name?: string | null
  middle_name?: string | null
  last_name?: string | null
  department_id?: number | string | null
}

export interface EarlyGoingAttendanceEntry extends LaravelAttendanceEntry {
  atten_id?: number | string
  expected_time?: string | null
  is_late?: number | string | null
  get_user?: EarlyGoingUser | null
  getUser?: EarlyGoingUser | null
}

export interface EarlyGoingAttendanceReportResponse {
  employees?: unknown
  date_formatted?: string
  hrmsList?: EarlyGoingAttendanceEntry[]
  departments?: Record<string, string> | string[] | AttendanceOption[]
}

export interface AttendanceReportParams {
  fromDate: string
  toDate: string
  departmentId?: string
  employeeId?: string
}

export interface AttendancePunchResponse {
  status?: number | string
  status_code?: number | string
  message?: string
  attendanceData?: LaravelAttendanceEntry
}

/* ------------------------------------------------------------------ *
 * Self summary - GET /api/attendance/self-summary
 *
 * Replaces the three hardcoded arrays the dashboard used to render
 * (F-98, F-113). Leave balance and holidays are NOT here: they already have
 * endpoints, and leaveService.getBalances / getUpcomingHolidays serve them.
 * ------------------------------------------------------------------ */

export interface AttendanceShiftWindow {
  is_working_day: boolean
  expected_in: string | null
  expected_out: string | null
  expected_minutes: number | null
  source: 'roster' | 'none'
}

export interface AttendanceAlertRow {
  id: string
  text: string
  severity: 'critical' | 'warning' | 'info'
  date: string | null
}

export interface AttendanceRequestRow {
  id: string
  type: string
  pending: number
  approved: number
  rejected: number
}

export interface AttendanceSelfSummaryResponse {
  status?: number | string
  message?: string
  date?: string
  shift?: AttendanceShiftWindow
  alerts?: AttendanceAlertRow[]
  requests?: AttendanceRequestRow[]
  /** Today's recorded work mode, so the punch control can preselect it. */
  work_mode?: string | null
}

/* ------------------------------------------------------------------ *
 * Attendance regularisation - /api/attendance/regularisations
 * ------------------------------------------------------------------ */

export interface RegularisationRow {
  id: number
  employee_id: number
  employee_name: string | null
  employee_no: string | null
  department: string | null
  day: string
  requested_in_time: string | null
  requested_out_time: string | null
  original_in_time: string | null
  original_out_time: string | null
  reason: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  reviewer_comment: string | null
  reviewed_at: string | null
  submitted_at: string | null
}

export interface RegularisationListResponse {
  status?: number | string
  message?: string
  scope?: 'mine' | 'team'
  count?: number
  data?: RegularisationRow[]
}

export interface RegularisationPayload {
  day: string
  /** 'HH:mm'. At least one of the two is required by the API. */
  requestedInTime?: string
  requestedOutTime?: string
  reason: string
}

export interface RegularisationActionResponse {
  status?: number | string
  message?: string
  data?: { id: number }
  errors?: Record<string, string[]>
}

/** 'all' means "no filter" - the param is omitted so Laravel's filled() check skips it. */
function activeFilter(value?: string) {
  return value && value !== 'all' && value !== '0' ? value : undefined
}

function attendanceParams(context: LaravelContext, params?: AttendanceWeeklyParams) {
  const departmentId = activeFilter(params?.departmentId)
  const employeeId = activeFilter(params?.employeeId)

  return withLaravelParams(context, {
    ...(params?.fromDate ? { from_date: params.fromDate } : {}),
    ...(params?.toDate ? { to_date: params.toDate } : {}),
    ...(departmentId ? { department_id: departmentId } : {}),
    ...(employeeId ? { employee_id: employeeId } : {}),
  })
}

async function ensureAttendanceSuccess(request: Promise<AttendancePunchResponse>) {
  const response = await request
  const status = response.status ?? response.status_code
  if (String(status) === '0') {
    throw new Error(response.message || 'Attendance request failed')
  }
  return response
}

export const hrmsService = {
  /*
   * F-118. Three methods were deleted from here: getAttendanceRecords ->
   * `/attendance`, checkIn -> `/attendance/check-in`, checkOut ->
   * `/attendance/check-out`. None of those routes is registered
   * (`php artisan route:list --path=api/attendance` lists my-attendance,
   * punch-in, punch-out, self-summary, regularisations, kpi, weekly-summary,
   * report-filters, employees), and nothing in this repo called them.
   *
   * They were an earlier generation of the punch API. punchIn/punchOut below
   * are the ones that work, and keeping both meant the file advertised a
   * capability that 404s beside the one that does not - which is how somebody
   * picks the wrong one. Removed rather than repointed: a second name for
   * punchIn is a duplicate, not a fix.
   */
  // Attendance
  /** /api/attendance/kpi - the employee filter is only honoured by this route. */
  getAttendanceKpis: (context: LaravelContext, params?: Pick<AttendanceWeeklyParams, 'departmentId' | 'employeeId'>) =>
    apiClient.get<AttendanceKpiResponse>('/attendance/kpi', attendanceParams(context, params)),
  /** /api/attendance/weekly-summary - as above, /attendance-weekly ignores employee_id. */
  getAttendanceWeeklySummary: (context: LaravelContext, params?: AttendanceWeeklyParams) =>
    apiClient.get<AttendanceWeeklyResponse>('/attendance/weekly-summary', attendanceParams(context, params)),
  /** Departments are scoped to the caller's sub_institute by this route. */
  getAttendanceReportIndex: (context: LaravelContext) =>
    apiClient.get<AttendanceReportIndexResponse>('/attendance/report-filters', withLaravelParams(context)),
  /** Omitting department_id (or passing 'all') lists every active employee of the institute. */
  getAttendanceEmployees: (context: LaravelContext, departmentId?: string) =>
    apiClient.get<AttendanceEmployeesResponse>('/attendance/employees', {
      ...withLaravelParams(context),
      ...(activeFilter(departmentId) ? { department_id: activeFilter(departmentId) as string } : {}),
    }),
  getDepartmentAttendanceReport: (context: LaravelContext, params: AttendanceReportParams) =>
    webClient.get<DepartmentAttendanceReportResponse>('/departmentwise-attendance-report/create', withLaravelParams(context, {
      from_date: params.fromDate,
      to_date: params.toDate,
      ...(params.departmentId && params.departmentId !== 'all' ? { 'department_id[]': params.departmentId } : { department_id: '0' }),
      ...(params.employeeId && params.employeeId !== 'all' ? { emp_id: params.employeeId, employee_id: params.employeeId } : {}),
    })),
  getEarlyGoingAttendanceReport: (context: LaravelContext, params: { date: string; departmentId?: string; employeeId?: string }) =>
    webClient.get<EarlyGoingAttendanceReportResponse>('/show-early-going-hrms-attendance-report', withLaravelParams(context, {
      date: params.date,
      ...(params.departmentId && params.departmentId !== 'all' ? { 'department_id[]': params.departmentId } : { department_id: '0' }),
      ...(params.employeeId && params.employeeId !== 'all' ? { 'emp_id[]': params.employeeId } : { emp_id: '0' }),
    })),
  /**
   * /api/attendance/my-attendance returns the punch rows for the window plus
   * the resolved day by day calendar. The legacy GET /hrms-attendance
   * (formType=MyAttendance) only ever answers for the current day.
   */
  getMyAttendance: (context: LaravelContext, params?: { fromDate?: string; toDate?: string }) =>
    apiClient.get<MyAttendanceResponse>('/attendance/my-attendance', withLaravelParams(context, {
      ...(params?.fromDate ? { from_date: params.fromDate } : {}),
      ...(params?.toDate ? { to_date: params.toDate } : {}),
    })),
  punchAttendanceIn: (context: LaravelContext, data: { date: string; time: string; workMode?: string }) =>
    ensureAttendanceSuccess(apiClient.post<AttendancePunchResponse>('/attendance/punch-in', {
      ...withLaravelParams(context),
      employee: context.userId,
      indate: data.date,
      intime: data.time,
      // Optional server-side, so omitting it keeps the column default.
      ...(data.workMode ? { work_mode: data.workMode } : {}),
    })),
  punchAttendanceOut: (context: LaravelContext, data: { date: string; time: string }) =>
    ensureAttendanceSuccess(apiClient.post<AttendancePunchResponse>('/attendance/punch-out', {
      ...withLaravelParams(context),
      employee: context.userId,
      outdate: data.date,
      outtime: data.time,
    })),

  /** /api/attendance/self-summary - the caller's roster, alerts and request counts. */
  getAttendanceSelfSummary: (context: LaravelContext) =>
    apiClient.get<AttendanceSelfSummaryResponse>('/attendance/self-summary', withLaravelParams(context)),

  /* ---------------- Attendance regularisation ---------------- */

  /** `scope: 'team'` is the approver queue and requires approval rights. */
  getRegularisations: (context: LaravelContext, params?: { scope?: 'mine' | 'team'; status?: string }) =>
    apiClient.get<RegularisationListResponse>('/attendance/regularisations', {
      ...withLaravelParams(context),
      ...(params?.scope ? { scope: params.scope } : {}),
      ...(params?.status ? { status: params.status } : {}),
    }),

  /**
   * Always raised for the caller. Re-submitting the same day edits the pending
   * request rather than creating a second one, so an approver never sees two
   * contradictory versions of the same morning.
   */
  submitRegularisation: (context: LaravelContext, payload: RegularisationPayload) =>
    apiClient.post<RegularisationActionResponse>('/attendance/regularisations', {
      ...withLaravelParams(context),
      day: payload.day,
      ...(payload.requestedInTime ? { requested_in_time: payload.requestedInTime } : {}),
      ...(payload.requestedOutTime ? { requested_out_time: payload.requestedOutTime } : {}),
      reason: payload.reason,
    }),

  /** Approving applies the correction to the attendance row in one transaction. */
  decideRegularisation: (
    context: LaravelContext,
    id: number,
    status: 'approved' | 'rejected',
    reviewerComment?: string,
  ) =>
    apiClient.post<RegularisationActionResponse>(`/attendance/regularisations/${id}/decision`, {
      ...withLaravelParams(context),
      status,
      ...(reviewerComment ? { reviewer_comment: reviewerComment } : {}),
    }),

  withdrawRegularisation: (context: LaravelContext, id: number) =>
    apiClient.delete<RegularisationActionResponse>(`/attendance/regularisations/${id}`, withLaravelParams(context)),

  // Leave - see leaveService below for the Leave Management module endpoints.

  /*
   * F-118. getComplianceItems -> `/compliance` and updateComplianceStatus ->
   * `/compliance/{id}` were deleted too. Neither route exists and nothing
   * called them; there is no compliance surface in this module at all, so
   * these described a feature rather than reaching one.
   */
}
