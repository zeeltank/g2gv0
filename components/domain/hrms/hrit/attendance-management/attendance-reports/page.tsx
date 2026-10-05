'use client'

import * as React from 'react'
import { GtgPageHeader } from '@/components/shell/gtg-page-header'
import { EnhancedAttendanceFilters } from '@/domain/hrms/hrit/attendance-management/attendance-tracking/components/enhanced-attendance-filters'
import { AttendanceReportTable } from '@/domain/hrms/hrit/attendance-management/attendance-reports/components/AttendanceReportTable'
import type { EarlyGoingRecord } from './types'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import {
  hrmsService,
  type AttendanceEmployeeOption,
  type AttendanceKpiResponse,
  type AttendanceOption,
  type AttendanceWeeklyResponse,
  type DepartmentAttendanceEmployee,
  type EarlyGoingAttendanceEntry,
} from '@/services/hrms'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Download, Eye, Printer } from 'lucide-react'
import type { Column } from '@/components/ui/data-table'
import { AttendanceTabs } from '@/domain/hrms/hrit/attendance-management/attendance-tracking/components/attendance-tabs'
import {
  AttendanceKPICards,
  type AttendanceKPICard,
  getEnhancedSummaryCards,
} from '@/domain/hrms/hrit/attendance-management/attendance-tracking/components/attendance-kpi-cards'
import { AttendanceTrendChart } from '@/domain/hrms/hrit/attendance-management/attendance-tracking/components/attendance-trend-chart'
import { AttendanceDonutChart} from '@/domain/hrms/hrit/attendance-management/attendance-tracking/components/attendance-donut-chart'
import { AttendanceHighlights } from '@/domain/hrms/hrit/attendance-management/attendance-tracking/components/attendance-highlights'
import {
  AttendanceGroupedTable,
  type GroupedRecord,
} from '@/domain/hrms/hrit/attendance-management/attendance-tracking/components/attendance-grouped-table'
import {
  AttendanceDrillDownDrawer,
  type DrillDownRecord,
} from '@/domain/hrms/hrit/attendance-management/attendance-tracking/components/attendance-drill-down-drawer'
// One CSV writer for the whole module - the payroll screens already had it.
import { csvText, downloadCsv } from '@/domain/hrms/hrit/payroll-management/shared/payroll-shell'


type ViewTab = { id: ViewTabId; label: string }
type ViewTabId = 'table-focus' | 'trend-focus' | 'daily-details'

/**
 * The filter set the report data is currently loaded for. Dropdown selections
 * stay in draft state until Apply commits them here, so a department/employee
 * change does not refetch until the user asks for it.
 */
type AppliedFilters = {
  from: string
  to: string
  department: string
  employee: string
}

/**
 * The four datasets this screen loads, in the order they are requested.
 *
 * F-161. Used to name the ones that actually failed. Order matters: these are
 * matched positionally against the Promise.allSettled results, so a new request
 * added to that array needs a label added here at the same index.
 */
const REPORT_DATASET_LABELS = [
  'the summary cards',
  'the weekly trend',
  'the department breakdown',
  'the early-going records',
] as const

/** "a", "a and b", "a, b and c" - so the error line reads as a sentence. */
function formatList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

type AttendanceTrendData = {
  label: string
  present: number
  late: number
  // F-175. No earlyGoing. The weekly-summary endpoint does not carry one, so
  // the chart drew a flat zero line with its own legend entry.
  absent: number
}

type AttendanceDistributionData = {
  present: number
  late: number
  earlyGoing: number
  absent: number
}

type AttendanceHighlightsData = {
  highestAttendanceDept: string
  highestAbsenteeismDept: string
  highestEarlyGoingDept: string
}

function parsePercentage(value?: string | number | null) {
  if (typeof value === 'number') return value
  if (!value) return 0
  const parsed = Number(value.replace('%', ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function getApiDepartmentId(department: string) {
  return /^\d+$/.test(department) ? department : undefined
}

/** 'all' (or anything non-numeric) means no employee filter. */
function getApiEmployeeId(employee: string) {
  return /^\d+$/.test(employee) ? employee : undefined
}

function mapWeeklyTrend(response: AttendanceWeeklyResponse | null): AttendanceTrendData[] {
  if (!response) return []

  return response.labels.map((label, index) => ({
    label,
    present: response.present[index] ?? 0,
    late: response.late[index] ?? 0,
    // F-175. `earlyGoing: 0` was here and the chart drew it as a named series
    // with its own legend entry - a flat zero line labelled as a metric.
    // AttendanceWeeklyResponse carries present/absent/late and nothing else.
    absent: response.absent[index] ?? 0,
  }))
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatName(parts: Array<string | null | undefined>) {
  return parts.map((part) => part?.trim()).filter(Boolean).join(' ') || '--'
}

function optionsFromDepartments(value?: Record<string, string> | string[] | AttendanceOption[]) {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      if (typeof item === 'string') return { value: String(index), label: item }
      return item
    })
  }
  return Object.entries(value).map(([id, label]) => ({ value: id, label }))
}

function optionsFromEmployees(value?: AttendanceEmployeeOption[]) {
  return (value ?? []).map((employee) => {
    const name = formatName([employee.first_name, employee.middle_name, employee.last_name])
    const employeeNo = employee.employee_no ? ` (${employee.employee_no})` : ''
    return { value: String(employee.id), label: `${name}${employeeNo}` }
  })
}

function formatTime(value?: string | null) {
  if (!value) return '--'
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function minutesBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return 0
  const startDate = new Date(start.includes('T') ? start : start.replace(' ', 'T'))
  const endDate = new Date(end.includes('T') ? end : end.replace(' ', 'T'))
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0
  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000))
}

function formatMinutes(totalMinutes: number) {
  if (totalMinutes <= 0) return '--'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

function mapEarlyGoingRecord(entry: EarlyGoingAttendanceEntry, departmentsById: Map<string, string>): EarlyGoingRecord {
  const user = entry.get_user ?? entry.getUser
  const expectedOut = entry.expected_time ?? undefined
  const earlyByMin = expectedOut ? minutesBetween(entry.punchout_time, `${entry.day} ${expectedOut}`) : 0
  const departmentId = String(user?.department_id ?? '')

  return {
    id: String(entry.atten_id ?? entry.id),
    employee: entry.employee_name ?? formatName([user?.first_name, user?.middle_name, user?.last_name]),
    employeeId: entry.employee_no ?? user?.employee_no ?? String(entry.user_id),
    department: entry.department ?? departmentsById.get(departmentId) ?? (departmentId || '--'),
    date: entry.day,
    punchIn: formatTime(entry.punchin_time),
    punchOut: formatTime(entry.punchout_time),
    expectedOut: expectedOut ?? '--',
    earlyBy: formatMinutes(earlyByMin),
    earlyByMin,
    status: entry.punchin_time ? 'present' : 'absent',
  }
}

function matchesSearch(record: EarlyGoingRecord, search: string) {
  if (!search) return true
  const query = search.toLowerCase()
  return [record.employee, record.employeeId, record.department, record.date].some((value) =>
    value.toLowerCase().includes(query),
  )
}

const viewTabs: ViewTab[] = [
  { id: 'table-focus', label: 'Table Focus' },
  { id: 'trend-focus', label: 'Trend Focus' },
  { id: 'daily-details', label: 'Daily Details' },
]

function getEarlyGoingColumns(onRowOpen: (row: EarlyGoingRecord) => void): Column<EarlyGoingRecord>[] {
  return [
    /*
     * F-179. This rendered `record.id` - the hrms_attendances primary key -
     * under a heading that everywhere else in this product means "row number".
     * On the live data it reads 1447, 1452, 1461... which looks like a broken
     * counter. A positional index is what the heading promises.
     */
    { id: 'rowNumber', header: '#' },
    { id: 'employee', header: 'Employee' },
    { id: 'employeeId', header: 'Employee ID' },
    { id: 'department', header: 'Department' },
    { id: 'date', header: 'Date' },
    { id: 'punchIn', header: 'Punch In' },
    { id: 'punchOut', header: 'Punch Out' },
    { id: 'expectedOut', header: 'Expected Out' },
    { id: 'earlyBy', header: 'Early By' },
    { id: 'earlyByMin', header: 'Early By (Min)' },
    {
      id: 'status',
      header: 'Status',
      render: (value) => (
        <StatusBadge
          variant={value === 'present' ? 'active' : value === 'late' ? 'pending' : 'error'}
          className="h-6 px-2.5 text-xs font-semibold"
        >
          {value === 'present' ? 'Present' : value === 'late' ? 'Late' : 'Absent'}
        </StatusBadge>
      ),
    },
    {
      // F-112: this button had no onClick at all. It opens the drill-down
      // drawer that already existed in attendance-tracking/components.
      id: 'actions' as keyof EarlyGoingRecord,
      header: 'Actions',
      render: (_value, row) => (
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          aria-label={`View ${row.employee}'s day`}
          onClick={() => onRowOpen(row)}
        >
          <Eye className="size-4" />
        </Button>
      ),
    },
  ]
}

export function AttendanceReportsPage() {
  const { user } = useAuth()
  const initialDate = React.useMemo(() => {
    const date = new Date()
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }, [])
  const [viewMode, setViewMode] = React.useState<ViewTabId>('table-focus')
  const [dateRange, setDateRange] = React.useState({ from: initialDate, to: initialDate })
  /*
   * Employee, not organization.
   *
   * The per-employee rows were already built - departmentAttendanceReportCreate
   * returns one row per tbluser.id and the 'employee' branch of groupedTableData
   * renders them - but the screen opened on 'organization', which folds them
   * into department totals. So the detail HR needs was one dropdown away and
   * nothing said so. Department grouping is still there, one click away.
   */
  const [groupBy, setGroupBy] = React.useState('employee')
  const [department, setDepartment] = React.useState('all')
  const [employee, setEmployee] = React.useState('all')
  const [quickFilter, setQuickFilter] = React.useState('custom')
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [apiLoading, setApiLoading] = React.useState(false)
  const [apiError, setApiError] = React.useState<string | null>(null)
  const [weeklySummary, setWeeklySummary] = React.useState<AttendanceWeeklyResponse | null>(null)
  const [attendanceKpis, setAttendanceKpis] = React.useState<AttendanceKpiResponse | null>(null)
  const [departmentOptions, setDepartmentOptions] = React.useState<AttendanceOption[]>([])
  const [employeeOptions, setEmployeeOptions] = React.useState<AttendanceOption[]>([])
  const [employeesLoading, setEmployeesLoading] = React.useState(false)
  const [departmentReport, setDepartmentReport] = React.useState<DepartmentAttendanceEmployee[]>([])
  const [earlyGoingRows, setEarlyGoingRows] = React.useState<EarlyGoingRecord[]>([])
  const [drillDownRecord, setDrillDownRecord] = React.useState<DrillDownRecord | null>(null)
  const [appliedFilters, setAppliedFilters] = React.useState<AppliedFilters>(() => ({
    from: initialDate,
    to: initialDate,
    department: 'all',
    employee: 'all',
  }))
  const pageSize = 10
  const departmentsById = React.useMemo(
    () => new Map(departmentOptions.map((option) => [option.value, option.label])),
    [departmentOptions],
  )

  const formatDate = (date: Date) => {
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: reset date range based on quick filter */
  React.useEffect(() => {
    const today = new Date()
    switch (quickFilter) {
      case 'today':
        const todayStr = formatDate(today)
        setDateRange({ from: todayStr, to: todayStr })
        break
      case 'week': {
        const day = today.getDay()
        const diff = today.getDate() - day
        const start = new Date(today)
        start.setDate(diff)
        const end = new Date(start)
        end.setDate(end.getDate() + 6)
        setDateRange({ from: formatDate(start), to: formatDate(end) })
        break
      }
      case 'month': {
        const start = new Date(today.getFullYear(), today.getMonth(), 1)
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        setDateRange({ from: formatDate(start), to: formatDate(end) })
        break
      }
      case 'last-month': {
        const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const end = new Date(today.getFullYear(), today.getMonth(), 0)
        setDateRange({ from: formatDate(start), to: formatDate(end) })
        break
      }
      case 'quarter': {
        const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3
        const start = new Date(today.getFullYear(), quarterStartMonth, 1)
        const end = new Date(today.getFullYear(), quarterStartMonth + 3, 0)
        setDateRange({ from: formatDate(start), to: formatDate(end) })
        break
      }
      case 'year': {
        const start = new Date(today.getFullYear(), 0, 1)
        const end = new Date(today.getFullYear(), 11, 31)
        setDateRange({ from: formatDate(start), to: formatDate(end) })
        break
      }
      case 'custom':
      default:
        break
    }
  }, [quickFilter])
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: pagination reset on filter change */
  React.useEffect(() => {
    setPage(1)
  }, [appliedFilters, groupBy, search])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleDateRangeChange = (range: { from: string; to: string }) => {
    setDateRange(range)
    setQuickFilter('custom')
  }

  // Employees are scoped to the department, so a department change invalidates
  // whatever employee was picked. Fall back to "All Employees".
  const handleDepartmentChange = (value: string) => {
    setDepartment(value)
    setEmployee('all')
  }

  const handleReset = () => {
    const today = formatDate(new Date())
    setDateRange({ from: today, to: today })
    setGroupBy('organization')
    setDepartment('all')
    setEmployee('all')
    setQuickFilter('custom')
    setSearch('')
    setPage(1)
    setAppliedFilters({ from: today, to: today, department: 'all', employee: 'all' })
  }

  // API rows only - the report never falls back to sample data.
  const earlyGoingData = React.useMemo(
    () => earlyGoingRows.filter((record) => matchesSearch(record, search)),
    [earlyGoingRows, search],
  )

  // "Apply" is what commits the draft filters and triggers the refetch.
  const handleSearchClick = () => {
    setAppliedFilters({
      from: dateRange.from,
      to: dateRange.to,
      department,
      employee,
    })
    setPage(1)
  }

  /**
   * F-99. Was `console.log('Export clicked')`.
   *
   * Exports what is on screen for the applied filters, in the view the user is
   * actually looking at — exporting a different shape from the one they can see
   * is how an export stops being trusted. Reuses `downloadCsv` from the payroll
   * shell rather than adding a second CSV writer.
   */
  /** F-112: the row "eye" had no handler. It opens the existing drawer. */
  const handleRowOpen = React.useCallback((row: EarlyGoingRecord) => {
    setDrillDownRecord({
      id: row.id,
      date: row.date,
      employee: row.employee,
      employeeId: row.employeeId,
      department: row.department,
      punchIn: row.punchIn,
      punchOut: row.punchOut,
      expectedOut: row.expectedOut,
      earlyBy: row.earlyBy,
      status: row.status,
    })
  }, [])

  const handleExport = () => {
    if (viewMode === 'daily-details') {
      downloadCsv(
        `attendance-daily-${appliedFilters.from}-to-${appliedFilters.to}.csv`,
        ['Employee', 'Employee ID', 'Department', 'Date', 'Punch In', 'Punch Out', 'Expected Out', 'Early By', 'Status'],
        earlyGoingData.map((row) => [
          row.employee,
          // Employee numbers with leading zeros survive as text; 007 otherwise
          // exports as 7.
          csvText(row.employeeId),
          row.department,
          csvText(row.date),
          csvText(row.punchIn),
          csvText(row.punchOut),
          csvText(row.expectedOut),
          row.earlyBy,
          row.status,
        ]),
      )
      return
    }

    downloadCsv(
      `attendance-${groupBy}-${appliedFilters.from}-to-${appliedFilters.to}.csv`,
      /*
       * The export follows the table. It carried eight columns while the
       * employee view now shows twelve, so half of what HR could see on screen
       * could not leave it - and an export that is quietly narrower than the
       * report it came from is how people stop trusting exports.
       */
      [
        'Group', 'Department', 'Employee', 'Employee ID', 'Employees',
        'Present', 'Absent', 'Half Day', 'Late', 'Holidays', 'Week Off',
        'Working Days', 'Attendance %',
      ],
      groupedTableData.map((row) => [
        groupBy,
        row.department ?? '',
        row.employee ?? '',
        csvText(row.employeeId ?? ''),
        row.employees ?? '',
        row.present ?? '',
        row.absent ?? '',
        row.halfDays ?? '',
        row.late ?? '',
        row.holidays ?? '',
        row.weekOffs ?? '',
        row.workingDays ?? '',
        row.attendancePercentage ?? '',
      ]),
    )
  }

  /**
   * F-99. Was `console.log('Print clicked')`.
   *
   * The browser's own print dialog, with a print stylesheet on the page that
   * drops the filter bar, the tabs and the action buttons so the report prints
   * as a report rather than as a screenshot of an app.
   */
  const handlePrint = () => {
    window.print()
  }

  React.useEffect(() => {
    let cancelled = false

    async function loadReportOptions() {
      try {
        const context = getLaravelContext(user)
        const response = await hrmsService.getAttendanceReportIndex(context)
        if (cancelled) return

        setDepartmentOptions(optionsFromDepartments(response.departments))
      } catch {
        if (!cancelled) {
          setDepartmentOptions([])
        }
      }
    }

    loadReportOptions()

    return () => {
      cancelled = true
    }
  }, [user])

  React.useEffect(() => {
    let cancelled = false

    // Employee options track the *draft* department so the dropdown narrows
    // as soon as a department is picked, before Apply is pressed.
    async function loadEmployees() {
      setEmployeesLoading(true)

      try {
        const context = getLaravelContext(user)
        const response = await hrmsService.getAttendanceEmployees(context, department)
        if (!cancelled) {
          setEmployeeOptions(optionsFromEmployees(response.employees))
        }
      } catch {
        if (!cancelled) {
          setEmployeeOptions([])
        }
      } finally {
        if (!cancelled) {
          setEmployeesLoading(false)
        }
      }
    }

    loadEmployees()

    return () => {
      cancelled = true
    }
  }, [department, user])

  React.useEffect(() => {
    let cancelled = false

    async function loadAttendanceReports() {
      setApiLoading(true)
      setApiError(null)

      try {
        const context = getLaravelContext(user)
        const departmentId = getApiDepartmentId(appliedFilters.department)
        const employeeId = getApiEmployeeId(appliedFilters.employee)
        /*
         * F-161. This was Promise.all, and its catch cleared ALL FOUR datasets.
         *
         * So one failing endpoint blanked the whole screen - KPIs, charts, table
         * and highlights - even when the other three had answered perfectly. The
         * stray `echo` in HrmsController::earlyGoingHrmsAttendanceReport meant
         * that happened every time a specific employee was selected.
         *
         * That backend bug is fixed, but the coupling was the reason a one-line
         * defect presented as a dead screen. allSettled keeps each dataset
         * independent: whatever answered is rendered, and the error line names
         * only what actually failed.
         */
        const results = await Promise.allSettled([
          hrmsService.getAttendanceKpis(context, {
            // The range was not sent here, because the endpoint hardcoded today
            // and discarded it. It honours it now, so the KPI row finally
            // describes the period the filter says it does.
            fromDate: appliedFilters.from,
            toDate: appliedFilters.to,
            departmentId,
            employeeId,
          }),
          hrmsService.getAttendanceWeeklySummary(context, {
            fromDate: appliedFilters.from,
            toDate: appliedFilters.to,
            departmentId,
            employeeId,
          }),
          hrmsService.getDepartmentAttendanceReport(context, {
            fromDate: appliedFilters.from,
            toDate: appliedFilters.to,
            departmentId: departmentId ?? 'all',
            employeeId: employeeId ?? 'all',
          }),
          hrmsService.getEarlyGoingAttendanceReport(context, {
            date: appliedFilters.to || appliedFilters.from,
            departmentId: departmentId ?? 'all',
            employeeId: employeeId ?? 'all',
          }),
        ])

        if (!cancelled) {
          const [kpisResult, weeklyResult, departmentResult, earlyGoingResult] = results

          setAttendanceKpis(kpisResult.status === 'fulfilled' ? kpisResult.value : null)
          setWeeklySummary(weeklyResult.status === 'fulfilled' ? weeklyResult.value : null)
          setDepartmentReport(
            departmentResult.status === 'fulfilled' ? departmentResult.value.empData ?? [] : [],
          )
          setEarlyGoingRows(
            earlyGoingResult.status === 'fulfilled'
              ? (earlyGoingResult.value.hrmsList ?? []).map((entry) =>
                  mapEarlyGoingRecord(entry, departmentsById),
                )
              : [],
          )

          // Name what failed. "Failed to load attendance reports" when three of
          // four worked sends the user looking for a problem that isn't there.
          const failed = REPORT_DATASET_LABELS.filter(
            (_, index) => results[index].status === 'rejected',
          )

          setApiError(
            failed.length === 0
              ? null
              : failed.length === results.length
                ? 'Could not load attendance data.'
                : `Could not load ${formatList(failed)}. The rest of this report is up to date.`,
          )
        }
      } catch (error) {
        if (!cancelled) {
          setApiError(error instanceof Error ? error.message : 'Failed to load attendance reports.')
          setAttendanceKpis(null)
          setWeeklySummary(null)
          setDepartmentReport([])
          setEarlyGoingRows([])
        }
      } finally {
        if (!cancelled) {
          setApiLoading(false)
        }
      }
    }

    loadAttendanceReports()

    return () => {
      cancelled = true
    }
  }, [appliedFilters, departmentsById, user])

  const groupedTableData = React.useMemo((): GroupedRecord[] => {
    if (departmentReport.length > 0) {
      /*
       * F-175. This read `groupBy === 'organization' || groupBy === 'date'`.
       * One body for two options meant "Group By: Date" grouped by DEPARTMENT
       * and differed only by a column holding the same "from to to" string on
       * every row. The option is gone; so is the `earlyGoing` accumulator,
       * which was `+= 0` because departmentReport carries no early-going field.
       */
      if (groupBy === 'organization') {
        const deptMap = new Map<string, { employees: number; present: number; absent: number; late: number; workingDays: number }>()
        departmentReport.forEach((record) => {
          const dept = record.department || '--'
          if (!deptMap.has(dept)) {
            deptMap.set(dept, { employees: 0, present: 0, absent: 0, late: 0, workingDays: 0 })
          }
          const entry = deptMap.get(dept)!
          entry.employees += 1
          entry.present += toNumber(record.total_att_day)
          entry.absent += toNumber(record.total_ab_day)
          entry.late += toNumber(record.late)
          entry.workingDays += toNumber(record.workingDays)
        })

        return Array.from(deptMap.entries()).map(([dept, vals]) => ({
          id: `${groupBy}-${dept}`,
          department: dept,
          employees: vals.employees,
          present: vals.present,
          absent: vals.absent,
          late: vals.late,
          attendancePercentage: vals.workingDays > 0 ? Math.round((vals.present / vals.workingDays) * 100) : 0,
          recentRecords: earlyGoingData.filter((record) => record.department === dept).slice(0, 3),
        }))
      }

      return departmentReport.map((record) => {
        const workingDays = toNumber(record.workingDays)
        const present = toNumber(record.total_att_day)
        const late = toNumber(record.late)
        const absent = toNumber(record.total_ab_day)

        return {
          id: String(record.user_id),
          employee: record.full_name ?? '--',
          employeeId: record.employee_no ?? String(record.user_id),
          department: record.department ?? '--',
          date: `${appliedFilters.from} to ${appliedFilters.to}`,
          // No punchIn / punchOut / expectedIn / expectedOut / earlyBy: this row
          // is built from a day-count summary that has none of them, and the
          // grouped table no longer renders those columns for this grouping.
          workingHours: `${present}/${workingDays || 0} days`,
          lateBy: late ? `${late} days` : '--',
          present,
          absent,
          late,
          // Carried through rather than dropped: the response has had these all
          // along and the table simply never asked for them.
          halfDays: toNumber(record.half_day),
          workingDays,
          holidays: toNumber(record.total_holidays),
          weekOffs: toNumber(record.weekday_off),
          status: absent > present ? 'absent' : late > 0 ? 'late' : 'present',
          attendancePercentage: workingDays > 0 ? Math.round((present / workingDays) * 100) : 0,
          recentRecords: earlyGoingData.filter((item) => item.employeeId === record.employee_no || item.id === String(record.user_id)).slice(0, 5),
        }
      })
    }

    const dataSource = earlyGoingData
    switch (groupBy) {
      case 'organization': {
        const deptMap = new Map<string, { employees: number; present: number; absent: number; late: number; earlyGoing: number }>()
        dataSource.forEach((d) => {
          if (!deptMap.has(d.department)) {
            deptMap.set(d.department, { employees: 0, present: 0, absent: 0, late: 0, earlyGoing: 0 })
          }
          const entry = deptMap.get(d.department)!
          if (d.status === 'present') entry.present += 1
          if (d.status === 'absent') entry.absent += 1
          if (d.status === 'late') entry.late += 1
          if (d.earlyByMin > 0) entry.earlyGoing += 1
        })
        return Array.from(deptMap.entries()).map(([dept, vals]) => ({
          id: dept,
          department: dept,
          employees: vals.present + vals.absent + vals.late,
          present: vals.present,
          absent: vals.absent,
          late: vals.late,
          earlyGoing: vals.earlyGoing,
          attendancePercentage: vals.employees > 0 ? Math.round((vals.present / vals.employees) * 100) : 0,
          recentRecords: dataSource.filter((r) => r.department === dept).slice(-3),
        }))
      }
      case 'department':
        const deptMap = new Map<string, { employees: number; present: number; absent: number; late: number; earlyGoing: number }>()
        dataSource.forEach((d) => {
          if (!deptMap.has(d.department)) {
            deptMap.set(d.department, { employees: 0, present: 0, absent: 0, late: 0, earlyGoing: 0 })
          }
          const entry = deptMap.get(d.department)!
          entry.employees += 1
          if (d.status === 'present') entry.present += 1
          if (d.status === 'absent') entry.absent += 1
          if (d.status === 'late') entry.late += 1
          if (d.earlyByMin > 0) entry.earlyGoing += 1
        })
        return Array.from(deptMap.entries()).map(([dept, vals]) => ({
          id: dept,
          department: dept,
          employees: vals.employees,
          present: vals.present,
          absent: vals.absent,
          late: vals.late,
          earlyGoing: vals.earlyGoing,
          attendancePercentage: Math.round((vals.present / vals.employees) * 100),
          recentRecords: dataSource.filter((r) => r.department === dept).slice(-3),
        }))
      default:
        return dataSource.map((d) => ({
          id: d.id,
          employee: d.employee,
          employeeId: d.employeeId,
          department: d.department,
          date: d.date,
          punchIn: d.punchIn,
          punchOut: d.punchOut,
          earlyBy: d.earlyBy,
          earlyByMin: d.earlyByMin,
          status: d.status,
          recentRecords: dataSource.filter((r) => r.employee === d.employee).slice(-5),
        }))
    }
  }, [appliedFilters, departmentReport, earlyGoingData, groupBy])

  const trendData = React.useMemo((): AttendanceTrendData[] => {
    const apiTrendData = mapWeeklyTrend(weeklySummary)
    if (apiTrendData.length > 0) return apiTrendData

    const dataSource = earlyGoingData
    const dateMap = new Map<string, { present: number; late: number; early: number; absent: number }>()
    dataSource.forEach((r) => {
      const date = r.date
      if (!dateMap.has(date)) dateMap.set(date, { present: 0, late: 0, early: 0, absent: 0 })
      const entry = dateMap.get(date)!
      if (r.status === 'present') entry.present += 1
      else if (r.status === 'late') entry.late += 1
      else if (r.status === 'absent') entry.absent += 1
      if (r.earlyByMin > 0) entry.early += 1
    })
    return Array.from(dateMap.entries()).map(([label, vals]) => ({
      label,
      present: vals.present,
      late: vals.late,
      earlyGoing: vals.early,
      absent: vals.absent,
    }))
  }, [earlyGoingData, weeklySummary])

  const distributionData = React.useMemo((): AttendanceDistributionData => {
    if (weeklySummary) {
      /*
       * earlyGoing was hardcoded 0 on this branch - the one that actually runs
       * whenever the weekly summary loads. "Early Going" is a named metric on
       * this screen: a KPI card, a donut slice, a trend line, a table column and
       * a drill-down field, all reading a constant.
       *
       * The real figure is already fetched. getEarlyGoingAttendanceReport is
       * asked for a SINGLE date (`date: appliedFilters.to || appliedFilters.from`),
       * so this is that day's count sitting beside per-day averages for the
       * other three - comparable in scale, and honest about being one day rather
       * than an average across the range.
       */
      return {
        present: average(weeklySummary.present),
        late: average(weeklySummary.late),
        earlyGoing: earlyGoingData.filter((r) => r.earlyByMin > 0).length,
        absent: average(weeklySummary.absent),
      }
    }

    const dataSource = earlyGoingData
    const present = dataSource.filter((r) => r.status === 'present').length
    const late = dataSource.filter((r) => r.status === 'late').length
    const absent = dataSource.filter((r) => r.status === 'absent').length
    const earlyGoing = dataSource.filter((r) => r.earlyByMin > 0).length

    return { present, late, earlyGoing, absent }
  }, [earlyGoingData, weeklySummary])

  const highlightsData = React.useMemo((): AttendanceHighlightsData => {
    const dataSource = earlyGoingData
    const deptCounts = new Map<string, { present: number; absent: number; early: number; total: number }>()
    dataSource.forEach((r) => {
      const dept = r.department
      if (!deptCounts.has(dept)) deptCounts.set(dept, { present: 0, absent: 0, early: 0, total: 0 })
      const entry = deptCounts.get(dept)!
      entry.total += 1
      if (r.status === 'present') entry.present += 1
      if (r.status === 'absent') entry.absent += 1
      if (r.earlyByMin > 0) entry.early += 1
    })

    /*
     * F-177. `worstPct` started at 100 and the test was `pct < worstPct`.
     *
     * mapEarlyGoingRecord sets status 'present' whenever there is a punch-in,
     * and the endpoint only returns rows that HAVE a punch-out - so every
     * department scores exactly 100%, `100 < 100` is false for all of them,
     * and worstDept stayed ''. The card rendered the label "Highest
     * Absenteeism" above an empty value, on every load.
     *
     * Seeded from the data instead of from a constant, so the first department
     * always wins the comparison and a real name comes out.
     */
    let bestDept = '', worstDept = '', earlyDept = ''
    let bestPct = -1, worstPct = Number.POSITIVE_INFINITY, earlyCnt = 0
    deptCounts.forEach((vals, dept) => {
      const pct = vals.total > 0 ? (vals.present / vals.total) * 100 : 0
      if (pct > bestPct) { bestPct = pct; bestDept = dept }
      if (pct < worstPct) { worstPct = pct; worstDept = dept }
      if (vals.early > earlyCnt) { earlyCnt = vals.early; earlyDept = dept }
    })

    return {
      highestAttendanceDept: bestDept,
      highestAbsenteeismDept: worstDept,
      highestEarlyGoingDept: earlyDept,
    }
  }, [earlyGoingData])

  const enhancedCards = React.useMemo<AttendanceKPICard[]>(() => {
    const dist = distributionData
    const total = dist.present + dist.late + dist.earlyGoing + dist.absent
    if (attendanceKpis) {
      /*
       * These are PERCENTAGES, and they used to be head-counts.
       *
       * dist.late and dist.absent are averages of "how many employees" per day.
       * They were passed straight into latePercentage / absentPercentage, which
       * getEnhancedSummaryCards renders with unit '%' - so three late employees
       * printed as "3%". The fallback branch below already divides by the total;
       * this branch, the one that runs whenever the KPI endpoint answers, did not.
       */
      return getEnhancedSummaryCards({
        totalEmployees: attendanceKpis.active_employees,
        attendancePercentage: Math.round(parsePercentage(attendanceKpis.present_today)),
        latePercentage: total ? Math.round((dist.late / total) * 100) : 0,
        earlyGoingPercentage: total ? Math.round((dist.earlyGoing / total) * 100) : 0,
        absentPercentage: total ? Math.round((dist.absent / total) * 100) : 0,
      })
    }

    if (total === 0) return []

    const attendancePct = Math.round((dist.present / total) * 100)
    const latePct = Math.round((dist.late / total) * 100)
    const earlyPct = Math.round((dist.earlyGoing / total) * 100)
    const absentPct = Math.round((dist.absent / total) * 100)

    return getEnhancedSummaryCards({
      totalEmployees: total,
      attendancePercentage: attendancePct,
      latePercentage: latePct,
      earlyGoingPercentage: earlyPct,
      absentPercentage: absentPct,
    })
  }, [attendanceKpis, distributionData])

  const renderDailyDetails = () => {
    // F-179. The row number is positional and accounts for the page offset, so
    // page 2 starts at 11 rather than restarting at 1.
    const offset = (page - 1) * pageSize
    const data = earlyGoingData
      .slice(offset, page * pageSize)
      .map((record, index) => ({ ...record, rowNumber: offset + index + 1 }))
    const total = earlyGoingData.length
    const columns = getEarlyGoingColumns(handleRowOpen)

    // F-180. This tab is ONE DAY, and the filter bar above it offers a range.
    //
    // getEarlyGoingAttendanceReport takes a single `date` and the controller
    // does `where('day', $date)`; there is no range variant. So picking "This
    // Year" and pressing Apply returned a single day's rows with nothing on
    // screen saying so - the filter promised something the tab cannot honour.
    // Said out loud rather than left to be discovered.
    const shownDate = appliedFilters.to || appliedFilters.from
    const isRange = appliedFilters.from && appliedFilters.to && appliedFilters.from !== appliedFilters.to

    return (
      <div className="flex flex-col gap-6">
        <AttendanceKPICards cards={enhancedCards} />
        {shownDate && (
          <p className="-mb-2 text-sm text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{shownDate}</span>.
            {isRange && (
              <>
                {' '}This tab reports a single day, so only the end of your{' '}
                {appliedFilters.from} to {appliedFilters.to} range is shown. Use the Summary tab for
                the whole range.
              </>
            )}
          </p>
        )}
        <AttendanceReportTable
          columns={columns}
          data={data}
          searchValue={search}
          onSearchChange={setSearch}
          isLoading={apiLoading}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
        />
      </div>
    )
  }

  const renderTrendFocus = () => (
    <div className="flex flex-col gap-6">
      <AttendanceKPICards cards={enhancedCards} />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <AttendanceTrendChart data={trendData} />
        <div className="flex flex-col gap-6">
          <AttendanceDonutChart data={distributionData} />
          <AttendanceHighlights data={highlightsData} />
        </div>
      </div>
    </div>
  )

  /*
   * F-178. The Summary tab's search box filtered nothing.
   *
   * `search` is applied by `earlyGoingData` (line ~393), which feeds Daily
   * Details. This tab renders `groupedTableData`, built from departmentReport,
   * which `search` never touched - and AttendanceGroupedTable only sorts, it
   * does not filter. So typing in the search box on the screen's DEFAULT tab
   * changed nothing at all.
   *
   * Filtered here rather than inside the table, so the row count the table
   * reports is the filtered one.
   */
  const filteredGroupedData = React.useMemo(() => {
    if (!search.trim()) return groupedTableData
    const query = search.trim().toLowerCase()
    return groupedTableData.filter((row) =>
      [row.department, row.employee, row.employeeId, row.status]
        .some((value) => String(value ?? '').toLowerCase().includes(query)),
    )
  }, [groupedTableData, search])

  const renderTableFocus = () => (
    <div className="flex flex-col gap-6">
      <AttendanceKPICards cards={enhancedCards} />
      <AttendanceGroupedTable
        records={filteredGroupedData}
        groupBy={groupBy}
        searchValue={search}
        onSearchChange={setSearch}
        /* The month the drill-down should load: the end of the applied range. */
        month={(appliedFilters.to || appliedFilters.from || '').slice(0, 7) || null}
        className="sm:col-span-2"
      />
    </div>
  )

  const renderContent = () => {
    switch (viewMode) {
      case 'table-focus':
        return renderTableFocus()
      case 'trend-focus':
        return renderTrendFocus()
      case 'daily-details':
        return renderDailyDetails()
      default:
        return renderTableFocus()
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="report-no-print flex flex-wrap items-start justify-between gap-3">
        <GtgPageHeader
          title="Attendance Report"
          description="View and analyze attendance data with detailed reports."
        />

        {/*
          * F-99, and it was worse than filed. The audit recorded Export and
          * Print as `console.log` handlers; in fact the handlers were bound to
          * NOTHING - there were no Export or Print controls on this screen at
          * all. Here they are, and they work.
          */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleExport}
            disabled={apiLoading || (viewMode === 'daily-details' ? earlyGoingData.length === 0 : groupedTableData.length === 0)}
          >
            <Download className="size-4" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrint} disabled={apiLoading}>
            <Printer className="size-4" />
            Print
          </Button>
        </div>
      </div>

      <div className="report-no-print">
      <EnhancedAttendanceFilters
        dateRange={dateRange}
        groupBy={groupBy}
        department={department}
        employee={employee}
        quickFilter={quickFilter}
        departments={departmentOptions}
        employees={employeeOptions}
        employeesLoading={employeesLoading}
        onDateRangeChange={handleDateRangeChange}
        onGroupByChange={setGroupBy}
        onDepartmentChange={handleDepartmentChange}
        onEmployeeChange={setEmployee}
        onQuickFilterChange={setQuickFilter}
        onReset={handleReset}
        onSearch={handleSearchClick}
      />

      <AttendanceTabs
        tabs={viewTabs}
        active={viewMode}
        onChange={(id: string) => setViewMode(id as ViewTabId)}
      />
      </div>

      {/*
        F-199. This banner had NO RETRY, and sat above a table reading "No
        records found" - because the catch had already cleared all four
        datasets. Together they read as "there is no attendance data", not as
        "the request failed". A retry is the one control the state needs.

        Since F-161 the message names which datasets failed, so a partial
        failure no longer claims the whole screen is broken.
      */}
      {apiError && (
        <div className="report-no-print flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
          <span>{apiError}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAppliedFilters({ ...appliedFilters })}
            disabled={apiLoading}
          >
            Try again
          </Button>
        </div>
      )}

      {/*
        F-199. The loading state was a one-line text strip while renderContent()
        kept painting the PREVIOUS result underneath, so stale numbers looked
        current. The strip stays - it is unobtrusive - but the content below is
        now visibly inert while it refreshes.
      */}
      {apiLoading && (
        <div className="report-no-print rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-muted-foreground">
          Loading attendance data...
        </div>
      )}

      <div
        className={`report-print-area ${apiLoading ? 'pointer-events-none opacity-50' : ''}`}
        aria-busy={apiLoading}
      >
        {renderContent()}
      </div>

      <AttendanceDrillDownDrawer
        open={drillDownRecord !== null}
        onOpenChange={(next) => { if (!next) setDrillDownRecord(null) }}
        record={drillDownRecord}
        recentRecords={earlyGoingData
          .filter((row) => row.employeeId === drillDownRecord?.employeeId)
          .slice(0, 10)
          .map((row) => ({
            id: row.id,
            date: row.date,
            employee: row.employee,
            employeeId: row.employeeId,
            department: row.department,
            punchIn: row.punchIn,
            punchOut: row.punchOut,
            expectedOut: row.expectedOut,
            earlyBy: row.earlyBy,
            status: row.status,
          }))}
      />

      {/*
        * F-99. Print used to be console.log. The browser's own dialog does the
        * printing; this makes what it prints a report rather than a screenshot
        * of an application - the filter bar, tabs and buttons come out, and the
        * table is allowed to break across pages.
        */}
      <style jsx global>{`
        @media print {
          .report-no-print,
          nav, aside, header button { display: none !important; }
          .report-print-area { break-inside: auto; }
          .report-print-area table { break-inside: auto; width: 100%; }
          .report-print-area tr { break-inside: avoid; }
          body { background: #fff; }
        }
      `}</style>
    </div>
  )
}
