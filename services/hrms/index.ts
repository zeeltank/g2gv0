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

/**
 * One day of /api/employee-attendance-monthly-report (F-171).
 *
 * `status` is resolved by the server against the roster and the holiday
 * calendar, so a Sunday is 'weekend' and a declared holiday is 'holiday' -
 * neither is reported as an absence. 'incomplete' means a punch-in with no
 * punch-out, which is why working_hours is null on those rows.
 */
export interface MonthlyAttendanceDay {
  date: string
  day_name: string
  status: 'present' | 'absent' | 'leave' | 'holiday' | 'weekend' | 'incomplete' | string
  punchin_time: string | null
  punchout_time: string | null
  /** "HH:MM". Null unless the day has BOTH punches. */
  working_hours: string | null
  is_late: boolean
  /** The rostered start time for that weekday, or null on a non-working day. */
  shift_time: string | null
  /**
   * The server's own keys. `leave_type`, NOT `type` - AttendanceApiController
   * builds this map with 'leave_type' => $leave->leave_type_name, and the
   * interface declared `type`, so every consumer read undefined. The CSV's
   * Leave column has therefore always exported blank, and the on-screen Note
   * column fell back to the bare word "On leave". Nothing errored; the data
   * was simply never there.
   */
  leave: { leave_id?: number | null; leave_type?: string | null; day_type?: string | number | null; reason?: string | null } | null
  holiday_name: string | null
}

export interface MonthlyAttendanceSummary {
  total_days: number
  present_days: number
  absent_days: number
  leave_days: number
  holiday_days: number
  late_days: number
  weekend_days: number
  working_days: number
}

export interface MonthlyAttendanceResponse {
  status?: number
  message?: string
  data?: {
    employee?: { id?: number | string; name?: string | null; employee_id?: string | null }
    month?: string
    summary?: MonthlyAttendanceSummary
    /** Named `daily_report`, not `daily`. */
    daily_report?: MonthlyAttendanceDay[]
  }
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

/* ---------------- Department office hours ---------------- */

/**
 * One weekday of a department's template.
 *
 * `is_working: null` means never set, which is a different fact from `false`
 * (set, and not a working day). The screen needs the distinction: 88% of
 * employees are in the "never set" state and the fix for them is different from
 * the fix for someone whose Sunday is correctly off.
 */
export interface DepartmentScheduleDay {
  weekday: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  is_working: boolean | null
  in_time: string | null
  out_time: string | null
}

export interface DepartmentSchedule {
  department_id: number
  department_name: string
  employee_count: number
  has_schedule: boolean
  week: DepartmentScheduleDay[]
}

export interface DepartmentSchedulesResponse {
  status: number
  data: DepartmentSchedule[]
}

/** What an apply would do to one weekday, per employee bucket. */
export interface SchedulePreviewWeekday {
  weekday: string
  is_working: boolean
  in_time: string | null
  out_time: string | null
  is_weekend: boolean
  already_match: number
  /**
   * Employees holding hours somebody CHOSE, which this apply would overwrite.
   * The number to read before pressing Apply - the previous version of this
   * feature was deleted for overwriting 100 Saturdays without showing it.
   */
  would_change: number
  /** Employees with nothing set, who would get hours for the first time. */
  would_set: number
}

export interface SchedulePreviewResponse {
  status: number
  applied: boolean
  message?: string
  data: {
    department_id: number
    employees: number
    weekdays: string[]
    includes_weekend: string[]
    per_weekday: SchedulePreviewWeekday[]
    employees_touched: number
    total_would_change: number
    total_would_set: number
  }
}

/* ---------------- The HR attendance desk (admin corrections) ---------------- */

/**
 * One cell of the month grid.
 *
 * `status` carries a third answer the rest of the module does not have. Two
 * existing screens disagree about an employee with no roster - Monthly
 * Attendance Report reads every day as a weekend, Attendance Tracking reads
 * Mon-Sat as worked - because each invented a different fallback. 2,008 of
 * 2,283 active employees are in exactly that state. `unset` says so instead of
 * picking a side, and `upcoming` keeps a month-to-date view from counting days
 * that have not happened as absences.
 */
export type AttendanceGridStatus =
  | 'present'     // punched in and out
  | 'incomplete'  // punched in, never out
  | 'recorded'    // a row exists with neither time - something created it
  | 'absent'      // no row, and the roster says this day is worked
  | 'weekend'     // no row, and the roster says it is not
  | 'unset'       // no row, and the employee has NO roster at all
  | 'upcoming'    // no row, and the day is in the future

export interface AttendanceGridCell {
  status: AttendanceGridStatus
  in: string | null
  out: string | null
  duration: string | null
  work_mode: string | null
  /** A correction has been applied to this day. The who and why come from /admin/edits. */
  edited: boolean
  shift_in: string | null
  shift_out: string | null
}

export interface AttendanceGridDay {
  date: string
  day_of: number
  weekday: string
  is_future: boolean
}

export interface AttendanceGridEmployee {
  user_id: number
  name: string
  employee_code: string | null
  department_id: number | null
  department_name: string | null
  has_roster: boolean
  /** Keyed by 'YYYY-MM-DD'; every day of the month is present. */
  days: Record<string, AttendanceGridCell>
}

export interface AttendanceGridResponse {
  status: number
  data: {
    month: string
    days: AttendanceGridDay[]
    employees: AttendanceGridEmployee[]
    meta: {
      page: number
      per_page: number
      total: number
      total_pages: number
      without_roster: number
    }
  }
}

export interface AttendanceCorrectionPayload {
  userId: number | string
  day: string
  /** 'HH:MM'. Omit to leave that side of the day untouched. */
  inTime?: string
  outTime?: string
  reason: string
}

export interface AttendanceCorrectionResponse {
  status: number
  message: string
  data?: {
    attendance_id: number
    created_row: boolean
    before: Record<string, string | null> | null
    after: { punchin_time: string | null; punchout_time: string | null; timestamp_diff: string | null }
  }
}

/** One recorded change. The before-image is what makes it an audit rather than a log. */
export interface AttendanceEditRow {
  id: number
  user_id: number
  day: string
  attendance_id: number | null
  before_in_time: string | null
  before_out_time: string | null
  before_duration: string | null
  after_in_time: string | null
  after_out_time: string | null
  after_duration: string | null
  created_row: number
  reason: string
  source: string
  created_at: string
  employee_name: string | null
  changed_by_name: string | null
}

export interface AttendanceEditsResponse {
  status: number
  data: AttendanceEditRow[]
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
  /** The chain this pending request is actually waiting on, when hrms.attendance.regularisation has an active chain. */
  approval?: { pending: boolean; step_name: string | null; approver_role: string | null; step: number | null; of: number | null } | null
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
  /**
   * The date range is now sent. It used to be deliberately withheld - the
   * signature accepted only department and employee - because the endpoint
   * hardcoded Carbon::today() and ignored it. So every range the screen offered
   * returned today's number under the selected period's label.
   */
  getAttendanceKpis: (context: LaravelContext, params?: AttendanceWeeklyParams) =>
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
  /**
   * /api/employee-attendance-monthly-report - one employee, one calendar month,
   * day by day (F-171).
   *
   * The most complete attendance endpoint in the module and it had no caller:
   * a nine-field summary plus a row per date carrying status, punch times,
   * working hours, lateness, the rostered shift, any leave (with its reason)
   * and any holiday name. Roster- and holiday-aware, so a weekend is
   * 'weekend' rather than 'absent'.
   *
   * `month` is 'YYYY-MM' and the server validates the format. It refuses a
   * user_id that is not the caller unless the caller is admin/hr/executive/
   * auditor (F-159), so the employee picker below is HR's view; an employee
   * reading their own month passes their own id.
   *
   * The payload is nested under `data`, unlike its siblings.
   */
  getEmployeeMonthlyAttendance: (
    context: LaravelContext,
    params: { userId: string | number; month: string },
  ) =>
    apiClient.get<MonthlyAttendanceResponse>('/employee-attendance-monthly-report', {
      ...withLaravelParams(context),
      user_id: String(params.userId),
      month: params.month,
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

  /* ---------------- The HR attendance desk ---------------- */

  /**
   * GET /api/attendance/admin/grid - every employee down, every day across.
   *
   * One request for the whole screen. The alternative was one request per
   * employee against /employee-attendance-monthly-report, which is the only
   * other endpoint that returns a month day by day and takes a single user_id:
   * 50 round trips for a department, 2,283 for an organisation.
   *
   * Paged on PEOPLE, never on days - a half-month row would be worse than a
   * missing one, because an empty cell already carries meaning here.
   */
  getAttendanceGrid: (
    context: LaravelContext,
    params: { month: string; departmentId?: string; search?: string; page?: number; perPage?: number },
  ) =>
    apiClient.get<AttendanceGridResponse>('/attendance/admin/grid', {
      ...withLaravelParams(context),
      month: params.month,
      ...(activeFilter(params.departmentId) ? { department_id: activeFilter(params.departmentId) as string } : {}),
      ...(params.search ? { search: params.search } : {}),
      ...(params.page ? { page: String(params.page) } : {}),
      ...(params.perPage ? { per_page: String(params.perPage) } : {}),
    }),

  /**
   * POST /api/attendance/admin/corrections - HR changes somebody else's day.
   *
   * The ONLY endpoint that does this. The three that came close were not
   * usable: update_user_att has no caller and writes across tenants, the two
   * punch endpoints are self-service (and now force the subject to the caller),
   * and the regularisation path only ever runs for a request the employee
   * raised themselves.
   *
   * A reason is required, as it is on the employee-raised path. Omitting a time
   * leaves that side of the day alone, so a missing punch-out can be filled in
   * without restating the punch-in.
   *
   * The server refuses an employee id outside the caller's organisation with
   * 404 rather than 403 - a refusal should not confirm that the id exists
   * somewhere else.
   */
  correctAttendance: (context: LaravelContext, payload: AttendanceCorrectionPayload) =>
    apiClient.post<AttendanceCorrectionResponse>('/attendance/admin/corrections', {
      ...withLaravelParams(context),
      user_id: payload.userId,
      day: payload.day,
      ...(payload.inTime ? { in_time: payload.inTime } : {}),
      ...(payload.outTime ? { out_time: payload.outTime } : {}),
      reason: payload.reason,
    }),

  /**
   * GET /api/attendance/admin/edits - who changed whose day, from what, and why.
   *
   * The platform event log holds the same facts and is the system of record,
   * but it is keyed by entity and time and answering "who changed Priya's
   * Tuesday" from it is a query nobody on the HR desk will write. This is that
   * question, asked the way the screen asks it.
   */
  getAttendanceEdits: (
    context: LaravelContext,
    params?: { userId?: number | string; month?: string },
  ) =>
    apiClient.get<AttendanceEditsResponse>('/attendance/admin/edits', {
      ...withLaravelParams(context),
      ...(params?.userId ? { user_id: String(params.userId) } : {}),
      ...(params?.month ? { month: params.month } : {}),
    }),

  /* ---------------- Department office hours ---------------- */

  /**
   * GET /attendance/admin/schedules - every department with its week.
   *
   * Departments with no schedule come back with all seven days present and
   * empty, so the screen renders one shape instead of branching on
   * "has a schedule".
   */
  getDepartmentSchedules: (context: LaravelContext) =>
    apiClient.get<DepartmentSchedulesResponse>('/attendance/admin/schedules', withLaravelParams(context)),

  /**
   * POST /attendance/admin/schedules - save one department's week.
   *
   * The TEMPLATE only. No employee row changes until applySchedule is called,
   * and that separation is the safety mechanism rather than a nicety: saving
   * what the hours should be is cheap and reversible, writing them onto a
   * hundred people is neither.
   */
  saveDepartmentSchedule: (
    context: LaravelContext,
    payload: { departmentId: number; week: Array<{ weekday: string; is_working: boolean; in_time: string | null; out_time: string | null }> },
  ) =>
    apiClient.post<{ status: number; message: string }>('/attendance/admin/schedules', {
      ...withLaravelParams(context),
      department_id: payload.departmentId,
      week: payload.week,
    }),

  /**
   * POST /attendance/admin/schedules/preview - what an apply would do.
   *
   * Computes exactly what applySchedule computes and writes nothing. A preview
   * that diverges from the write is worse than none: it is a promise the write
   * does not keep.
   */
  previewScheduleApply: (context: LaravelContext, payload: { departmentId: number; weekdays: string[] }) =>
    apiClient.post<SchedulePreviewResponse>('/attendance/admin/schedules/preview', {
      ...withLaravelParams(context),
      department_id: payload.departmentId,
      weekdays: payload.weekdays,
    }),

  /**
   * POST /attendance/admin/schedules/apply - write the template onto employees.
   *
   * `weekdays` is explicit and there is no "all" on the server. Saturday and
   * Sunday have to be named, because Saturday is the day whose hours genuinely
   * vary - 100 employees in one tenant finish at 14:00 - and a blanket write is
   * what got the previous version of this feature removed.
   *
   * Records a `department.schedule.applied` event with the before-image of
   * every employee it touched.
   */
  applySchedule: (context: LaravelContext, payload: { departmentId: number; weekdays: string[] }) =>
    apiClient.post<SchedulePreviewResponse>('/attendance/admin/schedules/apply', {
      ...withLaravelParams(context),
      department_id: payload.departmentId,
      weekdays: payload.weekdays,
    }),



  // Leave - see leaveService below for the Leave Management module endpoints.

  /*
   * F-118. getComplianceItems -> `/compliance` and updateComplianceStatus ->
   * `/compliance/{id}` were deleted too. Neither route exists and nothing
   * called them; there is no compliance surface in this module at all, so
   * these described a feature rather than reaching one.
   */
}
