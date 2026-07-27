import {
  BarChart3,
  CalendarDays,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  FolderClock,
  History,
  LockKeyhole,
  Share2,
  ShieldAlert,
  WalletCards,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type ReportCategory =
  | 'All Reports'
  | 'Leave Request Reports'
  | 'Leave Balance Reports'
  | 'Leave Usage Reports'
  | 'Employee Reports'
  | 'Approval Reports'

export type ReportDefinition = {
  id: string
  title: string
  description: string
  category: Exclude<ReportCategory, 'All Reports'>
  icon: LucideIcon
  tone: string
  saved?: boolean
}

export type ReportFilters = {
  dateRange: string
  leaveType: string
  department: string
  employee: string
  status: string
  employeeStatus: string
  includeSubordinates: boolean
  startDate: string
  endDate: string
}

export const reports: ReportDefinition[] = [
  {
    id: 'leave-summary',
    title: 'Leave Summary Report',
    description: 'Summary of leave requests by status, type and department.',
    category: 'Leave Request Reports',
    icon: FileBarChart,
    tone: 'bg-primary/10 text-primary',
    saved: true,
  },
  {
    id: 'leave-register',
    title: 'Leave Register Report',
    description: 'Detailed register of all leave requests.',
    category: 'Leave Request Reports',
    icon: FileSpreadsheet,
    tone: 'bg-sky-100 text-sky-700',
  },
  {
    id: 'leave-balance',
    title: 'Leave Balance Report',
    description: 'Current leave balance for employees.',
    category: 'Leave Balance Reports',
    icon: WalletCards,
    tone: 'bg-cyan-100 text-cyan-700',
    saved: true,
  },
  {
    id: 'leave-usage',
    title: 'Leave Usage Report',
    description: 'Leave utilization by type, employee and department.',
    category: 'Leave Usage Reports',
    icon: BarChart3,
    tone: 'bg-indigo-100 text-indigo-700',
  },
  {
    id: 'pending-approvals',
    title: 'Pending Approvals Report',
    description: 'List of leave requests pending approval.',
    category: 'Approval Reports',
    icon: LockKeyhole,
    tone: 'bg-teal-100 text-teal-700',
  },
  {
    id: 'employee-history',
    title: 'Employee Leave History',
    description: 'Complete leave history of employees.',
    category: 'Employee Reports',
    icon: History,
    tone: 'bg-emerald-100 text-emerald-700',
  },
  {
    id: 'absenteeism',
    title: 'Absenteeism Report',
    description: 'Absences and leave trends.',
    category: 'Employee Reports',
    icon: ShieldAlert,
    tone: 'bg-cyan-100 text-cyan-700',
  },
  {
    id: 'holiday-calendar',
    title: 'Holiday Calendar Report',
    description: 'List of holidays within a date range.',
    category: 'Leave Usage Reports',
    icon: CalendarDays,
    tone: 'bg-indigo-100 text-indigo-700',
  },
  {
    id: 'department-summary',
    title: 'Department Summary Report',
    description: 'Leave summary grouped by department.',
    category: 'Leave Usage Reports',
    icon: FileBarChart,
    tone: 'bg-blue-100 text-blue-700',
  },
  {
    id: 'monthly-trend',
    title: 'Monthly Leave Trend',
    description: 'Monthly leave trends and comparisons.',
    category: 'Leave Usage Reports',
    icon: BarChart3,
    tone: 'bg-violet-100 text-violet-700',
  },
  {
    id: 'carry-forward',
    title: 'Carry Forward Report',
    description: 'Carry forward analysis by employee.',
    category: 'Leave Balance Reports',
    icon: FileBarChart,
    tone: 'bg-violet-100 text-violet-700',
  },
  {
    id: 'policy-exception',
    title: 'Policy Exception Report',
    description: 'Requests violating leave policies.',
    category: 'Approval Reports',
    icon: ShieldAlert,
    tone: 'bg-slate-100 text-slate-700',
  },
  {
    id: 'encashment',
    title: 'Leave Encashment Report',
    description: 'Encashment details and summaries.',
    category: 'Leave Balance Reports',
    icon: WalletCards,
    tone: 'bg-cyan-100 text-cyan-700',
  },
  {
    id: 'long-leave',
    title: 'Long Leave Report',
    description: 'Employees on long duration leave.',
    category: 'Employee Reports',
    icon: FolderClock,
    tone: 'bg-slate-100 text-slate-700',
  },
  {
    id: 'custom-report',
    title: 'Custom Report',
    description: 'Create a custom report.',
    category: 'Leave Request Reports',
    icon: Share2,
    tone: 'bg-cyan-100 text-cyan-700',
  },
]

export const categories: ReportCategory[] = [
  'All Reports',
  'Leave Request Reports',
  'Leave Balance Reports',
  'Leave Usage Reports',
  'Employee Reports',
  'Approval Reports',
]

/** Palette applied to the live department breakdown returned by the API. */
export const reportChartColors = [
  'var(--chart-blue)',
  'var(--chart-indigo)',
  'var(--chart-green)',
  'var(--chart-yellow)',
  'var(--chart-red)',
  'var(--chart-teal)',
]

/**
 * Only the presentation-level choices stay here. Leave types, departments,
 * employees and statuses all come from /api/leave/options at runtime.
 */
export const selectOptions = {
  dateRange: [
    { label: 'Custom', value: 'custom' },
    { label: 'This Month', value: 'month' },
    { label: 'This Quarter', value: 'quarter' },
    { label: 'This Leave Year', value: 'year' },
  ],
  employeeStatus: [
    { label: 'Active Employees Only', value: 'active' },
    { label: 'All Employees', value: 'all' },
    { label: 'Inactive Employees Only', value: 'inactive' },
  ],
}

/** Leave year runs April to March, so "this year" starts on 1 April. */
export function currentLeaveYearRange() {
  const today = new Date()
  const startYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1

  return {
    startDate: `${startYear}-04-01`,
    endDate: `${startYear + 1}-03-31`,
  }
}

export const defaultFilters: ReportFilters = {
  dateRange: 'year',
  leaveType: 'all',
  department: 'all',
  employee: 'all',
  status: 'all',
  employeeStatus: 'active',
  includeSubordinates: false,
  ...currentLeaveYearRange(),
}

export function pct(value: number, total: number) {
  return total ? `${((value / total) * 100).toFixed(2)}%` : '0%'
}

/** "Casual Leave" -> "CL" for the compact preview table. */
export function leaveTypeInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 3)
}
