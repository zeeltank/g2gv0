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

export type PreviewRow = {
  leaveType: string
  short: string
  total: number
  approved: number
  pending: number
  rejected: number
  cancelled: number
  days: number
  tone: string
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

export const previewRows: PreviewRow[] = [
  { leaveType: 'Casual Leave', short: 'CL', total: 72, approved: 45, pending: 18, rejected: 6, cancelled: 3, days: 114.5, tone: 'text-primary' },
  { leaveType: 'Sick Leave', short: 'SL', total: 58, approved: 32, pending: 20, rejected: 4, cancelled: 2, days: 87, tone: 'text-violet-600' },
  { leaveType: 'Privilege Leave', short: 'PL', total: 46, approved: 28, pending: 10, rejected: 6, cancelled: 2, days: 102, tone: 'text-emerald-600' },
  { leaveType: 'Earned Leave', short: 'EL', total: 38, approved: 22, pending: 12, rejected: 3, cancelled: 1, days: 76, tone: 'text-orange-600' },
  { leaveType: 'Comp Off', short: 'CO', total: 18, approved: 12, pending: 6, rejected: 1, cancelled: 0, days: 36, tone: 'text-cyan-600' },
  { leaveType: 'Maternity Leave', short: 'ML', total: 16, approved: 9, pending: 4, rejected: 0, cancelled: 3, days: 112, tone: 'text-pink-600' },
]

export const departmentBreakdown = [
  { name: 'Engineering', value: 35.6, color: 'var(--chart-blue)' },
  { name: 'Marketing', value: 22.1, color: 'var(--chart-indigo)' },
  { name: 'Sales', value: 18.7, color: 'var(--chart-green)' },
  { name: 'Operations', value: 14.3, color: 'var(--chart-yellow)' },
  { name: 'HR', value: 9.3, color: 'var(--chart-red)' },
]

export const selectOptions = {
  dateRange: [
    { label: 'Custom', value: 'custom' },
    { label: 'This Month', value: 'month' },
    { label: 'This Quarter', value: 'quarter' },
    { label: 'This Year', value: 'year' },
  ],
  leaveType: [
    { label: 'All', value: 'all' },
    { label: 'Casual Leave', value: 'casual' },
    { label: 'Sick Leave', value: 'sick' },
    { label: 'Earned Leave', value: 'earned' },
  ],
  department: [
    { label: 'All', value: 'all' },
    { label: 'Engineering', value: 'engineering' },
    { label: 'Marketing', value: 'marketing' },
    { label: 'Sales', value: 'sales' },
    { label: 'Operations', value: 'operations' },
  ],
  employee: [
    { label: 'All', value: 'all' },
    { label: 'Rahul Kumar', value: 'rahul' },
    { label: 'Sneha Patel', value: 'sneha' },
    { label: 'Priya Sharma', value: 'priya' },
  ],
  status: [
    { label: 'All', value: 'all' },
    { label: 'Approved', value: 'approved' },
    { label: 'Pending', value: 'pending' },
    { label: 'Rejected', value: 'rejected' },
  ],
  employeeStatus: [
    { label: 'Active Employees Only', value: 'active' },
    { label: 'All Employees', value: 'all' },
    { label: 'Inactive Employees Only', value: 'inactive' },
  ],
}

export const defaultFilters: ReportFilters = {
  dateRange: 'custom',
  leaveType: 'all',
  department: 'all',
  employee: 'all',
  status: 'all',
  employeeStatus: 'active',
  includeSubordinates: false,
  startDate: '2025-05-01',
  endDate: '2025-05-31',
}

export function pct(value: number, total: number) {
  return total ? `${((value / total) * 100).toFixed(2)}%` : '0%'
}

export function totalFor(key: keyof Pick<PreviewRow, 'total' | 'approved' | 'pending' | 'rejected' | 'cancelled' | 'days'>) {
  return previewRows.reduce((sum, row) => sum + row[key], 0)
}
