/**
 * Leave types are institute-defined rows in hrms_leave_types, so this cannot be a
 * closed union - the API returns whatever the institute has configured.
 */
export type LeaveType = string

/**
 * Laravel's hrms_emp_leaves.status vocabulary. The API uses the snake_case
 * 'sent_back'; the design system's StatusBadge already styles the hyphenated
 * form, so leaveStatusTone() in hooks/use-leave.ts bridges the two.
 */
export type LeaveRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'sent-back'
  | 'cancelled'
  | 'approved_lwp'

/**
 * The activity feed renders three tones. Laravel also emits 'cancellation',
 * which mapActivity() collapses into 'rejection'.
 */
export type ActivityType = 'application' | 'approval' | 'rejection'

export type DashboardStatTone =
  | 'primary'
  | 'warning'
  | 'success'
  | 'destructive'
  | 'info'
  | 'muted'

export interface DashboardUser {
  id: string
  name: string
  role: string
  email: string
}

export interface DashboardStat {
  id: string
  title: string
  value: number
  suffix?: string
  percentageChange: number
  icon: 'clipboard-list' | 'clock' | 'check-circle' | 'x-circle' | 'users' | 'calendar-days'
  tone: DashboardStatTone
}

export interface LeaveRequest {
  id: string
  employeeId: string
  employee: {
    id: string
    name: string
    avatar?: string
    designation?: string
    email?: string
    mobileNumber?: string
  }
  department: string
  leaveType: LeaveType
  leaveBalanceBefore?: number
  duration: string
  session?: 'Full Day' | 'Half Day'
  appliedDate: string
  fromDate: string
  toDate: string
  status: LeaveRequestStatus
  approver?: string
  submittedDate?: string
  reason?: string
  backupEmployee?: string
  pendingTasks?: string
  handoverNotes?: string
  approvalWorkflow?: {
    stage: string
    status: LeaveRequestStatus | 'completed'
  }[]
}

export interface Holiday {
  id: string
  name: string
  date: string
  day: string
}

export interface Activity {
  id: string
  title: string
  description: string
  timestamp: string
  type: ActivityType
}

export interface LeaveTrendData {
  month: string
  requests: number
  approved: number
  rejected: number
}

export interface LeaveTypeDistribution {
  name: LeaveType
  value: number
  color: string
}

export interface DepartmentLeaveData {
  department: string
  requests: number
  approved: number
  rejected: number
}

export interface EmployeeLeave {
  id: string
  employee: string
  leaveType: LeaveType
  fromDate: string
  toDate: string
  duration: string
}

export interface LeaveBalanceSnapshot {
  id: string
  label: string
  used: number
  total: number
  tone: DashboardStatTone
}

export interface LeaveQuickAction {
  id: string
  icon: string
  label: string
  description: string
}
