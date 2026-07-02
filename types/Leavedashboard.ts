export type LeaveType =
  | 'Casual Leave'
  | 'Sick Leave'
  | 'Earned Leave'
  | 'Work From Home'
  | 'Maternity Leave'
  | 'Paternity Leave'

export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected'

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
  employee: {
    id: string
    name: string
    avatar?: string
  }
  department: string
  leaveType: LeaveType
  duration: string
  appliedDate: string
  fromDate: string
  toDate: string
  status: LeaveRequestStatus
  reason?: string
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
