/**
 * HRMS Service
 * API calls for HRMS - attendance, leave, and compliance
 */

import { apiClient, webClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

export interface AttendanceRecord {
  id: string
  userId: string
  date: string
  checkIn?: string
  checkOut?: string
  status: 'present' | 'absent' | 'late' | 'half_day'
}

export interface LeaveRequest {
  id: string
  userId: string
  leaveType: string
  startDate: string
  endDate: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  reason?: string
  approvedBy?: string
}

export interface LeaveBalance {
  leaveType: string
  total: number
  used: number
  pending: number
  available: number
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
}

export interface MyAttendanceResponse {
  status?: number | string
  status_code?: number | string
  message?: string
  daysInMonth?: number
  presentDays?: number
  lateDays?: number
  leaveDays?: number
  absentDays?: number
  percentege?: number
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

function attendanceParams(context: LaravelContext, params?: AttendanceWeeklyParams) {
  return withLaravelParams(context, {
    ...(params?.fromDate ? { from_date: params.fromDate } : {}),
    ...(params?.toDate ? { to_date: params.toDate } : {}),
    ...(params?.departmentId ? { department_id: params.departmentId } : {}),
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
  // Attendance
  getAttendanceRecords: (params?: { userId?: string; startDate?: string; endDate?: string }) => 
    apiClient.get<AttendanceRecord[]>('/attendance', params as Record<string, string>),
  checkIn: (userId: string) => apiClient.post<AttendanceRecord>('/attendance/check-in', { userId }),
  checkOut: (userId: string) => apiClient.post<AttendanceRecord>('/attendance/check-out', { userId }),
  getAttendanceKpis: (context: LaravelContext, params?: Pick<AttendanceWeeklyParams, 'departmentId'>) =>
    apiClient.get<AttendanceKpiResponse>('/KPI-HRITDashboard', attendanceParams(context, params)),
  getAttendanceWeeklySummary: (context: LaravelContext, params?: AttendanceWeeklyParams) =>
    apiClient.get<AttendanceWeeklyResponse>('/attendance-weekly', attendanceParams(context, params)),
  getAttendanceReportIndex: (context: LaravelContext) =>
    webClient.get<AttendanceReportIndexResponse>('/hrms-attendance-report', withLaravelParams(context)),
  getAttendanceEmployees: (context: LaravelContext, departmentId: string) =>
    webClient.post<AttendanceEmployeesResponse>('/get-employees-list', {
      ...withLaravelParams(context),
      department_id: departmentId,
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
  getMyAttendance: (context: LaravelContext, params?: { fromDate?: string; toDate?: string }) =>
    webClient.get<MyAttendanceResponse>('/hrms-attendance', withLaravelParams(context, {
      formType: 'MyAttendance',
      ...(params?.fromDate ? { from_date: params.fromDate } : {}),
      ...(params?.toDate ? { to_date: params.toDate } : {}),
    })),
  punchAttendanceIn: (context: LaravelContext, data: { date: string; time: string }) =>
    ensureAttendanceSuccess(webClient.post<AttendancePunchResponse>('/hrms-attendance-in-time/store', {
      ...withLaravelParams(context),
      employee: context.userId,
      indate: data.date,
      intime: data.time,
    })),
  punchAttendanceOut: (context: LaravelContext, data: { date: string; time: string }) =>
    ensureAttendanceSuccess(webClient.post<AttendancePunchResponse>('/hrms-attendance-out-time/store', {
      ...withLaravelParams(context),
      employee: context.userId,
      outdate: data.date,
      outtime: data.time,
    })),

  // Leave
  getLeaveRequests: (params?: { userId?: string; status?: string }) => 
    apiClient.get<LeaveRequest[]>('/leave-requests', params as Record<string, string>),
  getLeaveRequest: (id: string) => apiClient.get<LeaveRequest>(`/leave-requests/${id}`),
  createLeaveRequest: (data: Partial<LeaveRequest>) => 
    apiClient.post<LeaveRequest>('/leave-requests', data),
  approveLeaveRequest: (id: string, approverId: string) => 
    apiClient.post<LeaveRequest>(`/leave-requests/${id}/approve`, { approverId }),
  rejectLeaveRequest: (id: string, reason: string) => 
    apiClient.post<LeaveRequest>(`/leave-requests/${id}/reject`, { reason }),

  // Leave Balance
  getLeaveBalances: (userId: string) => 
    apiClient.get<LeaveBalance[]>(`/users/${userId}/leave-balances`),

  // Compliance
  getComplianceItems: (params?: { category?: string; status?: string }) => 
    apiClient.get<ComplianceItem[]>('/compliance', params as Record<string, string>),
  updateComplianceStatus: (id: string, status: string) => 
    apiClient.patch<ComplianceItem>(`/compliance/${id}`, { status }),
}
