'use client'

import * as React from 'react'
import { GtgPageHeader } from '@/components/shell/gtg-page-header'
import { EnhancedAttendanceFilters } from '@/domain/hrms/hrit/attendance-management/attendance-tracking/components/enhanced-attendance-filters'
import { AttendanceReportTable } from '@/domain/hrms/hrit/attendance-management/attendance-reports/components/AttendanceReportTable'
import {
  earlyGoingMockData,
  departments,
  employees,
  savedReports,
  type EarlyGoingRecord,
} from './services/report-data'
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
import { Eye } from 'lucide-react'
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


type ViewTab = { id: ViewTabId; label: string }
type ViewTabId = 'table-focus' | 'trend-focus' | 'daily-details'

type AttendanceTrendData = {
  label: string
  present: number
  late: number
  earlyGoing: number
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

function mapWeeklyTrend(response: AttendanceWeeklyResponse | null): AttendanceTrendData[] {
  if (!response) return []

  return response.labels.map((label, index) => ({
    label,
    present: response.present[index] ?? 0,
    late: response.late[index] ?? 0,
    earlyGoing: 0,
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

function getEarlyGoingColumns(): Column<EarlyGoingRecord>[] {
  return [
    { id: 'id', header: '#' },
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
      id: 'actions' as keyof EarlyGoingRecord,
      header: 'Actions',
      render: () => (
        <Button variant="ghost" size="icon" className="size-8 rounded-full">
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
  const [groupBy, setGroupBy] = React.useState('organization')
  const [department, setDepartment] = React.useState('all')
  const [employee, setEmployee] = React.useState('all')
  const [quickFilter, setQuickFilter] = React.useState('custom')
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [apiLoading, setApiLoading] = React.useState(false)
  const [apiError, setApiError] = React.useState<string | null>(null)
  const [weeklySummary, setWeeklySummary] = React.useState<AttendanceWeeklyResponse | null>(null)
  const [attendanceKpis, setAttendanceKpis] = React.useState<AttendanceKpiResponse | null>(null)
  const [departmentOptions, setDepartmentOptions] = React.useState<AttendanceOption[]>(departments)
  const [employeeOptions, setEmployeeOptions] = React.useState<AttendanceOption[]>(employees)
  const [departmentReport, setDepartmentReport] = React.useState<DepartmentAttendanceEmployee[]>([])
  const [earlyGoingRows, setEarlyGoingRows] = React.useState<EarlyGoingRecord[]>([])
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
      case 'custom':
      default:
        break
    }
  }, [quickFilter])
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: pagination reset on filter change */
  React.useEffect(() => {
    setPage(1)
  }, [dateRange.from, dateRange.to, groupBy, department, employee, search])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleDateRangeChange = (range: { from: string; to: string }) => {
    setDateRange(range)
    setQuickFilter('custom')
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
  }

  const earlyGoingData = React.useMemo(() => {
    const apiRows = earlyGoingRows.filter((record) => matchesSearch(record, search))
    if (apiRows.length > 0 || apiLoading || apiError) return apiRows

    return earlyGoingMockData.filter((d) => {
      if (!matchesSearch(d, search)) return false
      if (department && department !== 'all' && d.department.toLowerCase() !== department.toLowerCase()) return false
      if (employee && employee !== 'all' && d.employeeId.toLowerCase() !== employee.toLowerCase()) return false
      if (dateRange.from && d.date) {
        if (d.date < dateRange.from || d.date > dateRange.to) return false
      }
      return true
    })
  }, [apiError, apiLoading, dateRange, department, earlyGoingRows, employee, search])

  const handleSearchClick = () => {
    setPage(1)
  }

  const handleExport = () => {
    console.log('Export clicked')
  }

  const handlePrint = () => {
    console.log('Print clicked')
  }

  const handleSavedReportChange = (value: string) => {
    console.log('Saved report:', value)
  }

  React.useEffect(() => {
    let cancelled = false

    async function loadReportOptions() {
      try {
        const context = getLaravelContext(user)
        const response = await hrmsService.getAttendanceReportIndex(context)
        if (cancelled) return

        const apiDepartments = optionsFromDepartments(response.departments)
        if (apiDepartments.length > 0) {
          setDepartmentOptions(apiDepartments)
        }
      } catch {
        if (!cancelled) {
          setDepartmentOptions(departments)
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

    async function loadEmployees() {
      if (department === 'all') {
        setEmployeeOptions(employees)
        return
      }

      try {
        const context = getLaravelContext(user)
        const response = await hrmsService.getAttendanceEmployees(context, department)
        if (!cancelled) {
          const apiEmployees = optionsFromEmployees(response.employees)
          setEmployeeOptions(apiEmployees.length > 0 ? apiEmployees : employees)
        }
      } catch {
        if (!cancelled) {
          setEmployeeOptions(employees)
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
        const departmentId = getApiDepartmentId(department)
        const [kpis, weekly, departmentSummary, earlyGoing] = await Promise.all([
          hrmsService.getAttendanceKpis(context, { departmentId }),
          hrmsService.getAttendanceWeeklySummary(context, {
            fromDate: dateRange.from,
            toDate: dateRange.to,
            departmentId,
          }),
          hrmsService.getDepartmentAttendanceReport(context, {
            fromDate: dateRange.from,
            toDate: dateRange.to,
            departmentId: departmentId ?? 'all',
            employeeId: employee,
          }),
          hrmsService.getEarlyGoingAttendanceReport(context, {
            date: dateRange.to || dateRange.from,
            departmentId: departmentId ?? 'all',
            employeeId: employee,
          }),
        ])

        if (!cancelled) {
          setAttendanceKpis(kpis)
          setWeeklySummary(weekly)
          setDepartmentReport(departmentSummary.empData ?? [])
          setEarlyGoingRows((earlyGoing.hrmsList ?? []).map((entry) => mapEarlyGoingRecord(entry, departmentsById)))
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
  }, [dateRange.from, dateRange.to, department, departmentsById, employee, user])

  const groupedTableData = React.useMemo((): GroupedRecord[] => {
    if (departmentReport.length > 0) {
      if (groupBy === 'organization' || groupBy === 'date') {
        const deptMap = new Map<string, { employees: number; present: number; absent: number; late: number; earlyGoing: number; workingDays: number }>()
        departmentReport.forEach((record) => {
          const dept = record.department || '--'
          if (!deptMap.has(dept)) {
            deptMap.set(dept, { employees: 0, present: 0, absent: 0, late: 0, earlyGoing: 0, workingDays: 0 })
          }
          const entry = deptMap.get(dept)!
          entry.employees += 1
          entry.present += toNumber(record.total_att_day)
          entry.absent += toNumber(record.total_ab_day)
          entry.late += toNumber(record.late)
          entry.earlyGoing += 0
          entry.workingDays += toNumber(record.workingDays)
        })

        return Array.from(deptMap.entries()).map(([dept, vals]) => ({
          id: `${groupBy}-${dept}`,
          date: groupBy === 'date' ? `${dateRange.from} to ${dateRange.to}` : undefined,
          department: dept,
          employees: vals.employees,
          present: vals.present,
          absent: vals.absent,
          late: vals.late,
          earlyGoing: vals.earlyGoing,
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
          date: `${dateRange.from} to ${dateRange.to}`,
          punchIn: '--',
          punchOut: '--',
          expectedIn: '--',
          expectedOut: '--',
          workingHours: `${present}/${workingDays || 0} days`,
          lateBy: late ? `${late} days` : '--',
          earlyBy: '--',
          present,
          absent,
          late,
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
  }, [dateRange.from, dateRange.to, departmentReport, earlyGoingData, groupBy])

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
      return {
        present: average(weeklySummary.present),
        late: average(weeklySummary.late),
        earlyGoing: 0,
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

    let bestDept = '', worstDept = '', earlyDept = ''
    let bestPct = 0, worstPct = 100, earlyCnt = 0
    deptCounts.forEach((vals, dept) => {
      const pct = (vals.present / vals.total) * 100
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
      return getEnhancedSummaryCards({
        totalEmployees: attendanceKpis.active_employees,
        attendancePercentage: Math.round(parsePercentage(attendanceKpis.present_today)),
        latePercentage: dist.late,
        earlyGoingPercentage: dist.earlyGoing,
        absentPercentage: dist.absent,
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
    const data = earlyGoingData.slice((page - 1) * pageSize, page * pageSize)
    const total = earlyGoingData.length
    const columns = getEarlyGoingColumns()

    return (
      <div className="flex flex-col gap-6">
        <AttendanceKPICards cards={enhancedCards} />
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

  const renderTableFocus = () => (
    <div className="flex flex-col gap-6">
      <AttendanceKPICards cards={enhancedCards} />
      <AttendanceGroupedTable
        records={groupedTableData}
        groupBy={groupBy}
        searchValue={search}
        onSearchChange={setSearch}
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
      <GtgPageHeader
        title="Attendance Report"
        description="View and analyze attendance data with detailed reports."
      />

      <EnhancedAttendanceFilters
        dateRange={dateRange}
        groupBy={groupBy}
        department={department}
        employee={employee}
        quickFilter={quickFilter}
        departments={departmentOptions}
        employees={employeeOptions}
        savedReports={savedReports}
        onDateRangeChange={handleDateRangeChange}
        onGroupByChange={setGroupBy}
        onDepartmentChange={setDepartment}
        onEmployeeChange={setEmployee}
        onQuickFilterChange={setQuickFilter}
        onSavedReportChange={handleSavedReportChange}
        onReset={handleReset}
        onSearch={handleSearchClick}
      />

      <AttendanceTabs
        tabs={viewTabs}
        active={viewMode}
        onChange={(id: string) => setViewMode(id as ViewTabId)}
      />

      {apiError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
          {apiError}
        </div>
      )}

      {apiLoading && (
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-muted-foreground">
          Loading attendance data...
        </div>
      )}

      {renderContent()}
    </div>
  )
}
