/**
 * Leave Management Service
 *
 * Backed by the Laravel /api/leave/* endpoints (App\Http\Controllers\Api\Leave).
 * Every call carries the standard Laravel context (token, sub_institute_id,
 * syear, user_id) via withLaravelParams, exactly like the attendance calls in
 * ./index.ts.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

/** Every /api/leave endpoint replies with this envelope. */
export interface LeaveApiResponse<T> {
  status: number
  message: string
  year?: number
  data: T
}

export type LeaveStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'sent_back'
  | 'cancelled'
  | 'approved_lwp'

export interface LeaveOption {
  value: string
  label: string
}

export interface LeaveEmployeeOption extends LeaveOption {
  employee_no?: string | null
  department_id?: string | null
  department?: string | null
}

export interface LeaveTypeOption extends LeaveOption {
  code?: string | null
}

export interface LeaveOptionsData {
  departments: LeaveOption[]
  employees: LeaveEmployeeOption[]
  leave_types: LeaveTypeOption[]
  statuses: LeaveOption[]
}

export interface LeaveActivityItem {
  id: number
  type: 'application' | 'approval' | 'rejection' | 'cancellation'
  title: string
  description: string
  timestamp: string | null
  from_date: string | null
  to_date: string | null
}

export interface LeaveDashboardData {
  total_requests: number
  pending_requests: number
  approved_requests: number
  rejected_requests: number
  cancelled_requests: number
  on_leave_today: number
  available_balance: number
  recent_activity: LeaveActivityItem[]
}

export interface LeaveTrendPoint {
  period: string
  month: string
  requests: number
  approved: number
  rejected: number
}

export interface LeaveDepartmentSummaryRow {
  department_id: number
  department: string
  requests: number
  approved: number
  rejected: number
  pending: number
}

export interface LeaveTypeDistributionRow {
  leave_type_id: number
  leave_type: string
  leave_count: number
  full_day_count: number
  half_day_count: number
}

export interface LeaveHolidayRow {
  id: number
  holiday_name: string
  description?: string | null
  from_date: string | null
  to_date: string | null
  day: string | null
  applicable_year: string | null
  day_type: string | null
  department_ids: number[]
  department_names: string[]
}

export interface LeaveUpcomingHoliday {
  id: number
  name: string
  from_date: string | null
  to_date: string | null
  day: string | null
  day_type: string | null
  department: string | null
}

export interface LeaveBalanceRow {
  leave_type: string
  total: number
  used: number
  remaining: number
}

export interface LeaveBalancesData {
  leave_types: LeaveBalanceRow[]
  overall: { total: number; used: number; remaining: number }
}

export interface LeaveRequestRow {
  id: number
  employee_id: number
  employee_no: string | null
  employee_name: string
  designation: string | null
  email: string | null
  mobile: string | null
  avatar: string | null
  department_id: number
  department: string
  leave_type_id: number
  leave_type: string
  leave_type_code: string | null
  day_type: string | null
  slot: string | null
  session: 'Full Day' | 'Half Day'
  days: number
  duration: string
  from_date: string | null
  to_date: string | null
  status: string
  reason: string | null
  hod_comment: string | null
  hod_comment_date: string | null
  hr_remarks: string | null
  hr_remark_date: string | null
  approver: string | null
  submitted_date: string | null
  updated_date: string | null
}

export interface LeaveRequestComment {
  author: string
  role: string
  body: string
  timestamp: string | null
}

export interface LeaveRequestTimelineEntry {
  stage: string
  status: string
  actor: string | null
  timestamp: string | null
}

export interface LeaveRequestDetail extends LeaveRequestRow {
  balances: LeaveBalanceRow[]
  comments: LeaveRequestComment[]
  timeline: LeaveRequestTimelineEntry[]
}

export interface LeavePagination {
  page: number
  per_page: number
  total: number
  last_page: number
}

export interface LeaveRequestListResponse extends LeaveApiResponse<LeaveRequestRow[]> {
  pagination: LeavePagination
}

export interface LeaveRequestFilters {
  search?: string
  status?: string[]
  departmentId?: string
  leaveTypeId?: string
  employeeId?: string
  fromDate?: string
  toDate?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  page?: number
  perPage?: number
}

export interface LeaveApplyPayload {
  leaveTypeId: string
  dayType: 'full' | 'half'
  fromDate: string
  toDate?: string
  slot?: string
  comment: string
  employeeId?: string
  departmentId?: string
}

export interface LeaveTypeAllocation {
  department_id: number
  department: string
  value: number
}

export interface LeaveTypeConfig {
  id: number
  leave_type_id: string | null
  leave_type: string
  sort_order: number
  carry_forward: boolean
  status: number
  annual_quota: number | null
  annual_quota_varies: boolean
  allocations: LeaveTypeAllocation[]
}

export interface LeaveTypePayload {
  id?: number
  leaveType: string
  sortOrder?: number
  status?: boolean
  carryForward?: boolean
  annualQuota?: string | number | null
  departmentId?: string
}

export interface HolidayPayload {
  holidayName: string
  description?: string
  fromDate: string
  toDate?: string
  dayType?: 'full' | 'half'
  departmentIds?: string[]
}

export interface LeaveWeekday {
  day: string
  label: string
  day_type: 'full' | 'half' | 'weekend'
}

export interface LeaveWorkflowSettings {
  id: number
  reporting_manager_enabled: boolean
  department_head_enabled: boolean
  hr_enabled: boolean
  multi_level_enabled: boolean
  multi_level_count: number
  escalation_enabled: boolean
  escalation_time: number
  escalation_unit: 'hours' | 'days'
  escalate_to: 'department-head' | 'hr' | 'admin'
}

export interface LeaveRolePermission {
  id: number
  role_name: string
  scope: 'Self' | 'Team' | 'Department' | 'Organization'
  approve_leave: boolean
  view_reports: boolean
  configure_settings: boolean
  bulk_operations: boolean
  escalation_rights: boolean
  user_management: boolean
  status: boolean
  sort_order: number
}

export interface LeaveReportSummaryRow {
  leave_type_id: number
  leave_type: string
  leave_type_code: string | null
  total: number
  approved: number
  pending: number
  rejected: number
  cancelled: number
  sent_back: number
  days: number
}

export interface LeaveReportSummaryData {
  rows: LeaveReportSummaryRow[]
  totals: {
    total: number
    approved: number
    pending: number
    rejected: number
    cancelled: number
    sent_back: number
    days: number
  }
  department_breakdown: { department: string; total: number; percentage: number }[]
}

export interface LeaveRegisterRow {
  id: number
  employee_id: number
  employee_no: string | null
  employee_name: string
  department: string
  leave_type: string
  from_date: string | null
  to_date: string | null
  days: number
  duration: string
  status: string
  reason: string | null
  approver: string | null
  submitted_date: string | null
}

export interface LeaveBalanceReportData {
  leave_types: string[]
  rows: {
    employee_id: number
    employee_no: string | null
    employee_name: string
    department: string
    balances: Record<string, { total: number; used: number; remaining: number }>
  }[]
}

export interface LeaveReportFilters {
  fromDate?: string
  toDate?: string
  departmentId?: string
  employeeId?: string
  leaveTypeId?: string
  status?: string[]
  employeeStatus?: 'active' | 'inactive' | 'all'
  limit?: number
}

/** Drops 'all' / '0' / empty so Laravel's filled() checks skip the param. */
function leaveFilter(value?: string | number | null) {
  if (value === undefined || value === null) return undefined
  const normalized = String(value).trim()
  return normalized === '' || normalized === '0' || normalized === 'all' ? undefined : normalized
}

/** Repeatable params go out as `key[0]=a&key[1]=b`, which Laravel reads as an array. */
function leaveListParams(key: string, values?: string[]) {
  if (!values?.length) return {}

  return values.reduce<Record<string, string>>((params, value, index) => {
    const normalized = leaveFilter(value)
    if (normalized) params[`${key}[${index}]`] = normalized
    return params
  }, {})
}

function optionalParam(key: string, value?: string | null) {
  const normalized = leaveFilter(value)
  return normalized ? { [key]: normalized } : {}
}

function leaveReportParams(context: LaravelContext, filters?: LeaveReportFilters) {
  return withLaravelParams(context, {
    ...optionalParam('from_date', filters?.fromDate),
    ...optionalParam('to_date', filters?.toDate),
    ...optionalParam('department_id[0]', filters?.departmentId),
    ...optionalParam('employee_id[0]', filters?.employeeId),
    ...optionalParam('leave_type_id[0]', filters?.leaveTypeId),
    ...leaveListParams('status', filters?.status),
    ...(filters?.employeeStatus ? { employee_status: filters.employeeStatus } : {}),
    ...(filters?.limit ? { limit: String(filters.limit) } : {}),
  })
}

export const leaveService = {
  // Dashboard
  getDashboard: (context: LaravelContext, departmentId?: string) =>
    apiClient.get<LeaveApiResponse<LeaveDashboardData>>(
      '/leave/dashboard',
      withLaravelParams(context, optionalParam('department_id', departmentId)),
    ),
  getTrend: (context: LaravelContext, departmentId?: string) =>
    apiClient.get<LeaveApiResponse<LeaveTrendPoint[]>>(
      '/leave/trend',
      withLaravelParams(context, optionalParam('department_id', departmentId)),
    ),
  getDepartmentSummary: (context: LaravelContext) =>
    apiClient.get<LeaveApiResponse<LeaveDepartmentSummaryRow[]>>(
      '/leave/department-summary',
      withLaravelParams(context),
    ),
  getTypeDistribution: (context: LaravelContext, departmentId?: string) =>
    apiClient.get<LeaveApiResponse<LeaveTypeDistributionRow[]>>(
      '/leave/type-distribution',
      withLaravelParams(context, optionalParam('department_id', departmentId)),
    ),
  getUpcomingHolidays: (context: LaravelContext, limit = 5) =>
    apiClient.get<LeaveApiResponse<LeaveUpcomingHoliday[]>>(
      '/leave/holidays/upcoming',
      withLaravelParams(context, { limit: String(limit) }),
    ),

  // Shared lookups
  getOptions: (context: LaravelContext, departmentId?: string) =>
    apiClient.get<LeaveApiResponse<LeaveOptionsData>>(
      '/leave/options',
      withLaravelParams(context, optionalParam('department_id', departmentId)),
    ),
  getBalances: (context: LaravelContext, employeeId?: string) =>
    apiClient.get<LeaveApiResponse<LeaveBalancesData>>(
      '/leave/balances',
      withLaravelParams(context, optionalParam('employee_id', employeeId)),
    ),

  // Leave requests
  getRequests: (context: LaravelContext, filters?: LeaveRequestFilters) =>
    apiClient.get<LeaveRequestListResponse>(
      '/leave/requests',
      withLaravelParams(context, {
        ...(filters?.search ? { search: filters.search } : {}),
        ...leaveListParams('status', filters?.status),
        ...optionalParam('department_id[0]', filters?.departmentId),
        ...optionalParam('leave_type_id[0]', filters?.leaveTypeId),
        ...optionalParam('employee_id[0]', filters?.employeeId),
        ...optionalParam('from_date', filters?.fromDate),
        ...optionalParam('to_date', filters?.toDate),
        ...(filters?.sortBy ? { sort_by: filters.sortBy } : {}),
        ...(filters?.sortDir ? { sort_dir: filters.sortDir } : {}),
        page: String(filters?.page ?? 1),
        per_page: String(filters?.perPage ?? 10),
      }),
    ),
  getRequest: (context: LaravelContext, id: number | string) =>
    apiClient.get<LeaveApiResponse<LeaveRequestDetail>>(
      `/leave/requests/${id}`,
      withLaravelParams(context),
    ),
  applyLeave: (context: LaravelContext, payload: LeaveApplyPayload) =>
    apiClient.post<LeaveApiResponse<{ id: number }>>('/leave/requests', {
      ...withLaravelParams(context),
      leave_type_id: payload.leaveTypeId,
      day_type: payload.dayType,
      from_date: payload.fromDate,
      to_date: payload.dayType === 'half' ? payload.fromDate : payload.toDate,
      ...(payload.dayType === 'half' && payload.slot ? { slot: payload.slot } : {}),
      comment: payload.comment,
      ...optionalParam('employee_id', payload.employeeId),
      ...optionalParam('department_id', payload.departmentId),
    }),
  decideRequest: (
    context: LaravelContext,
    id: number | string,
    payload: { status: LeaveStatus; hodComment?: string; hrRemarks?: string },
  ) =>
    apiClient.post<LeaveApiResponse<null> & { updated_count: number }>(
      `/leave/requests/${id}/decision`,
      {
        ...withLaravelParams(context),
        status: payload.status,
        ...(payload.hodComment ? { hod_comment: payload.hodComment } : {}),
        ...(payload.hrRemarks ? { hr_remarks: payload.hrRemarks } : {}),
      },
    ),
  bulkDecideRequests: (
    context: LaravelContext,
    payload: { ids: (number | string)[]; status: LeaveStatus; hodComment?: string; hrRemarks?: string },
  ) =>
    apiClient.post<LeaveApiResponse<null> & { updated_count: number }>(
      '/leave/requests/bulk-decision',
      {
        ...withLaravelParams(context),
        ids: payload.ids.map((id) => Number(id)),
        status: payload.status,
        // Keyed by id because Laravel writes each remark against its own record.
        ...(payload.hodComment
          ? { hod_comment: Object.fromEntries(payload.ids.map((id) => [id, payload.hodComment])) }
          : {}),
        ...(payload.hrRemarks
          ? { hr_remarks: Object.fromEntries(payload.ids.map((id) => [id, payload.hrRemarks])) }
          : {}),
      },
    ),
  withdrawRequest: (context: LaravelContext, id: number | string) =>
    apiClient.delete<LeaveApiResponse<null>>(`/leave/requests/${id}`, withLaravelParams(context)),

  // Reports
  getReportSummary: (context: LaravelContext, filters?: LeaveReportFilters) =>
    apiClient.get<LeaveApiResponse<LeaveReportSummaryData>>(
      '/leave/reports/summary',
      leaveReportParams(context, filters),
    ),
  getReportRegister: (context: LaravelContext, filters?: LeaveReportFilters) =>
    apiClient.get<LeaveApiResponse<LeaveRegisterRow[]>>(
      '/leave/reports/register',
      leaveReportParams(context, filters),
    ),
  getReportBalance: (context: LaravelContext, filters?: LeaveReportFilters) =>
    apiClient.get<LeaveApiResponse<LeaveBalanceReportData>>(
      '/leave/reports/balance',
      leaveReportParams(context, filters),
    ),

  // Configuration - leave types
  getLeaveTypes: (context: LaravelContext) =>
    apiClient.get<LeaveApiResponse<LeaveTypeConfig[]>>('/leave/leave-types', withLaravelParams(context)),
  saveLeaveType: (context: LaravelContext, payload: LeaveTypePayload) => {
    const quota = payload.annualQuota
    // 'Unlimited' and friends are not a number - only send a real quota.
    const hasQuota =
      quota !== undefined && quota !== null && String(quota).trim() !== '' && Number.isFinite(Number(quota))

    const body = {
      ...withLaravelParams(context),
      leave_type: payload.leaveType,
      sort_order: payload.sortOrder ?? 0,
      status: payload.status === false ? 0 : 1,
      carry_forward: payload.carryForward ? 1 : 0,
      ...(hasQuota ? { annual_quota: Number(quota) } : {}),
      ...optionalParam('department_id', payload.departmentId),
    }

    return payload.id
      ? apiClient.put<LeaveApiResponse<{ id: number }>>(`/leave/leave-types/${payload.id}`, body)
      : apiClient.post<LeaveApiResponse<{ id: number }>>('/leave/leave-types', body)
  },
  toggleLeaveTypeStatus: (context: LaravelContext, id: number | string, status: boolean) =>
    apiClient.patch<LeaveApiResponse<{ id: number; status: number }>>(
      `/leave/leave-types/${id}/status`,
      { ...withLaravelParams(context), status: status ? 1 : 0 },
    ),
  deleteLeaveType: (context: LaravelContext, id: number | string) =>
    apiClient.delete<LeaveApiResponse<null>>(`/leave/leave-types/${id}`, withLaravelParams(context)),

  // Configuration - holidays
  getHolidays: (context: LaravelContext, params?: { calendarYear?: string; departmentId?: string }) =>
    apiClient.get<LeaveApiResponse<LeaveHolidayRow[]>>(
      '/leave/holidays',
      withLaravelParams(context, {
        ...optionalParam('calendar_year', params?.calendarYear),
        ...optionalParam('department_id', params?.departmentId),
      }),
    ),
  saveHoliday: (context: LaravelContext, payload: HolidayPayload, id?: number | string) => {
    const body = {
      ...withLaravelParams(context),
      holiday_name: payload.holidayName,
      description: payload.description ?? '',
      from_date: payload.fromDate,
      to_date: payload.toDate ?? payload.fromDate,
      day_type: payload.dayType ?? 'full',
      department: payload.departmentIds ?? [],
    }

    return id
      ? apiClient.put<LeaveApiResponse<{ id: number }>>(`/leave/holidays/${id}`, body)
      : apiClient.post<LeaveApiResponse<{ id: number }>>('/leave/holidays', body)
  },
  deleteHoliday: (context: LaravelContext, id: number | string) =>
    apiClient.delete<LeaveApiResponse<null>>(`/leave/holidays/${id}`, withLaravelParams(context)),

  // Configuration - weekly off pattern
  getWeekdays: (context: LaravelContext) =>
    apiClient.get<LeaveApiResponse<LeaveWeekday[]>>('/leave/weekdays', withLaravelParams(context)),
  saveWeekdays: (context: LaravelContext, weekdays: Record<string, string>) =>
    apiClient.post<LeaveApiResponse<null>>('/leave/weekdays', {
      ...withLaravelParams(context),
      ...weekdays,
    }),

  // Configuration - approval workflow and role access
  getWorkflow: (context: LaravelContext) =>
    apiClient.get<LeaveApiResponse<LeaveWorkflowSettings>>('/leave/workflow', withLaravelParams(context)),
  saveWorkflow: (context: LaravelContext, settings: Omit<LeaveWorkflowSettings, 'id'>) =>
    apiClient.put<LeaveApiResponse<LeaveWorkflowSettings>>('/leave/workflow', {
      ...withLaravelParams(context),
      reporting_manager_enabled: settings.reporting_manager_enabled ? 1 : 0,
      department_head_enabled: settings.department_head_enabled ? 1 : 0,
      hr_enabled: settings.hr_enabled ? 1 : 0,
      multi_level_enabled: settings.multi_level_enabled ? 1 : 0,
      multi_level_count: settings.multi_level_count,
      escalation_enabled: settings.escalation_enabled ? 1 : 0,
      escalation_time: settings.escalation_time,
      escalation_unit: settings.escalation_unit,
      escalate_to: settings.escalate_to,
    }),
  getRoles: (context: LaravelContext) =>
    apiClient.get<LeaveApiResponse<LeaveRolePermission[]>>('/leave/roles', withLaravelParams(context)),
  saveRoles: (context: LaravelContext, roles: LeaveRolePermission[]) =>
    apiClient.put<LeaveApiResponse<LeaveRolePermission[]>>('/leave/roles', {
      ...withLaravelParams(context),
      roles: roles.map((role) => ({
        id: role.id,
        role_name: role.role_name,
        scope: role.scope,
        approve_leave: role.approve_leave ? 1 : 0,
        view_reports: role.view_reports ? 1 : 0,
        configure_settings: role.configure_settings ? 1 : 0,
        bulk_operations: role.bulk_operations ? 1 : 0,
        escalation_rights: role.escalation_rights ? 1 : 0,
        user_management: role.user_management ? 1 : 0,
        status: role.status ? 1 : 0,
        sort_order: role.sort_order,
      })),
    }),
}
