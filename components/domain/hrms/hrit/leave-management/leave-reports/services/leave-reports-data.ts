import {
  FileBarChart,
  FileSpreadsheet,
  WalletCards,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/*
 * Only the categories that contain a report.
 *
 * 'Leave Usage Reports', 'Employee Reports' and 'Approval Reports' held nothing
 * once the unbacked reports were removed, and the catalogue sidebar renders one
 * row per category with a count beside it - so they would have shown as three
 * filters reading "0" that a user can click and get an empty list from. An
 * empty category is the same defect as an empty report, one level up.
 */
export type ReportCategory =
  | 'All Reports'
  | 'Leave Request Reports'
  | 'Leave Balance Reports'

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

/*
 * THREE REPORTS, BECAUSE THERE ARE THREE ENDPOINTS.
 *
 * This list held FIFTEEN. Nine of them had no backing endpoint of any kind -
 * Holiday Calendar, Monthly Leave Trend, Absenteeism, Policy Exception, Leave
 * Encashment, Carry Forward, Leave Usage, Department Summary and Custom Report -
 * and the preview always rendered the same leave-type summary regardless, so
 * the ONLY thing selecting one changed on screen was the title.
 *
 * Export was worse than useless for them: the filename is built from the report
 * id, so choosing "Holiday Calendar Report" downloaded
 * `holiday-calendar-<dates>.csv` containing leave-type totals. Carry Forward and
 * Encashment downloaded a plain balance CSV with no carry-forward or
 * encashment column in it. A file that asserts in its own name what it does not
 * contain is worse than no export.
 *
 * Employee Leave History, Long Leave and Pending Approvals are gone for a
 * different reason: they carried no filter of any kind - a ReportDefinition is
 * title, description, category, icon and tone, nothing more - so all three were
 * labels over the same unfiltered register. They come back the day they carry
 * the filter their name implies; the API already accepts status and dates.
 *
 * leaveService exposes exactly getReportSummary, getReportRegister and
 * getReportBalance. This list is now those three.
 */
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
    description: 'Detailed register of every leave request in the range.',
    category: 'Leave Request Reports',
    icon: FileSpreadsheet,
    tone: 'bg-sky-100 text-sky-700',
  },
  {
    id: 'leave-balance',
    title: 'Leave Balance Report',
    description: 'Entitlement, used and remaining, per employee and leave type.',
    category: 'Leave Balance Reports',
    icon: WalletCards,
    tone: 'bg-cyan-100 text-cyan-700',
    saved: true,
  },
]

export const categories: ReportCategory[] = [
  'All Reports',
  'Leave Request Reports',
  'Leave Balance Reports',
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
