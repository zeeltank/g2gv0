/**
 * Laravel -> design-system mappers for the Leave Management module.
 *
 * The presentation components (DashboardStats, LeaveTypeChart, DataTable
 * columns, drawers) keep their existing prop shapes from @/types/leave-dashboard;
 * everything below translates the /api/leave/* payloads into those shapes so no
 * component had to be redesigned.
 */

import type {
  Activity,
  DashboardStat,
  DepartmentLeaveData,
  EmployeeLeave,
  Holiday,
  LeaveBalanceSnapshot,
  LeaveRequest,
  LeaveRequestStatus,
  LeaveTrendData,
  LeaveTypeDistribution,
} from '@/types/leave-dashboard'
import type {
  LeaveActivityItem,
  LeaveBalanceRow,
  LeaveDashboardData,
  LeaveDepartmentSummaryRow,
  LeaveRequestRow,
  LeaveTrendPoint,
  LeaveTypeDistributionRow,
  LeaveUpcomingHoliday,
} from '@/services/hrms'

/** Palette reused from the existing dashboard mock so the charts look unchanged. */
const CHART_PALETTE = [
  'var(--chart-blue)',
  'var(--chart-red)',
  'var(--chart-green)',
  'var(--chart-yellow)',
  'var(--chart-indigo)',
  'var(--chart-teal)',
]

const BALANCE_TONES: LeaveBalanceSnapshot['tone'][] = ['primary', 'success', 'warning', 'destructive', 'info', 'muted']

/** Laravel uses snake_case; StatusBadge already styles the hyphenated variant. */
export function toDisplayStatus(status: string): LeaveRequestStatus {
  return (status === 'sent_back' ? 'sent-back' : status) as LeaveRequestStatus
}

/** The inverse, for sending a decision back to Laravel. */
export function toApiStatus(status: string) {
  return status === 'sent-back' ? 'sent_back' : status
}

export function mapLeaveRequest(row: LeaveRequestRow): LeaveRequest {
  return {
    id: String(row.id),
    employeeId: row.employee_no || String(row.employee_id),
    employee: {
      id: String(row.employee_id),
      name: row.employee_name || '—',
      avatar: row.avatar ?? undefined,
      designation: row.designation ?? undefined,
      email: row.email ?? undefined,
      mobileNumber: row.mobile ?? undefined,
    },
    department: row.department,
    leaveType: row.leave_type,
    duration: row.duration,
    session: row.session,
    appliedDate: row.submitted_date ?? row.from_date ?? '',
    fromDate: row.from_date ?? '',
    toDate: row.to_date ?? row.from_date ?? '',
    status: toDisplayStatus(row.status),
    approver: row.approver ?? undefined,
    submittedDate: row.submitted_date ?? undefined,
    reason: row.reason ?? undefined,
  }
}

export function mapDashboardStats(summary: LeaveDashboardData | null): DashboardStat[] {
  return [
    {
      id: 'total-requests',
      title: 'Total Leave Requests',
      value: summary?.total_requests ?? 0,
      // The API has no prior-period comparison yet, so no delta is claimed.
      percentageChange: 0,
      icon: 'clipboard-list',
      tone: 'primary',
    },
    {
      id: 'pending-requests',
      title: 'Pending Requests',
      value: summary?.pending_requests ?? 0,
      percentageChange: 0,
      icon: 'clock',
      tone: 'warning',
    },
    {
      id: 'approved-requests',
      title: 'Approved Requests',
      value: summary?.approved_requests ?? 0,
      percentageChange: 0,
      icon: 'check-circle',
      tone: 'success',
    },
    {
      id: 'rejected-requests',
      title: 'Rejected Requests',
      value: summary?.rejected_requests ?? 0,
      percentageChange: 0,
      icon: 'x-circle',
      tone: 'destructive',
    },
    {
      id: 'on-leave-today',
      title: 'Employees on Leave Today',
      value: summary?.on_leave_today ?? 0,
      percentageChange: 0,
      icon: 'users',
      tone: 'info',
    },
    {
      id: 'available-balance',
      title: 'Available Leave Balance',
      value: summary?.available_balance ?? 0,
      suffix: 'days',
      percentageChange: 0,
      icon: 'calendar-days',
      tone: 'muted',
    },
  ]
}

export function mapTrend(points: LeaveTrendPoint[]): LeaveTrendData[] {
  return points.map((point) => ({
    month: point.month,
    requests: point.requests,
    approved: point.approved,
    rejected: point.rejected,
  }))
}

export function mapDepartmentSummary(rows: LeaveDepartmentSummaryRow[]): DepartmentLeaveData[] {
  return rows.map((row) => ({
    department: row.department,
    requests: row.requests,
    approved: row.approved,
    rejected: row.rejected,
  }))
}

export function mapTypeDistribution(rows: LeaveTypeDistributionRow[]): LeaveTypeDistribution[] {
  return rows.map((row, index) => ({
    name: row.leave_type,
    value: row.leave_count,
    color: CHART_PALETTE[index % CHART_PALETTE.length],
  }))
}

export function mapHolidays(rows: LeaveUpcomingHoliday[]): Holiday[] {
  return rows.map((row) => ({
    id: String(row.id),
    name: row.name,
    date: row.from_date ?? '',
    day: row.day ?? '',
  }))
}

export function mapBalanceSnapshot(rows: LeaveBalanceRow[]): LeaveBalanceSnapshot[] {
  return rows
    // A zero entitlement is not a balance card - it is an unallocated leave type.
    .filter((row) => row.total > 0)
    .map((row, index) => ({
      id: row.leave_type.toLowerCase().replace(/\s+/g, '-'),
      label: row.leave_type,
      used: row.used,
      total: row.total,
      tone: BALANCE_TONES[index % BALANCE_TONES.length],
    }))
}

export function mapActivity(items: LeaveActivityItem[]): Activity[] {
  return items.map((item) => ({
    id: String(item.id),
    title: item.title,
    description: item.description,
    timestamp: formatRelativeTime(item.timestamp),
    // The Activity component styles three tones; a cancellation reads as a rejection.
    type: item.type === 'cancellation' ? 'rejection' : item.type,
  }))
}

export function mapUpcomingLeaves(rows: LeaveRequestRow[]): EmployeeLeave[] {
  return rows.map((row) => ({
    id: String(row.id),
    employee: row.employee_name || '—',
    leaveType: row.leave_type,
    fromDate: row.from_date ?? '',
    toDate: row.to_date ?? row.from_date ?? '',
    duration: row.duration,
  }))
}

/** "2 hours ago" style label for the activity feed. */
export function formatRelativeTime(value: string | null): string {
  if (!value) return '—'

  const timestamp = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(timestamp.getTime())) return value

  const seconds = Math.floor((Date.now() - timestamp.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`

  return timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Local-time YYYY-MM-DD; toISOString() would shift the date across timezones. */
export function toDateInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
