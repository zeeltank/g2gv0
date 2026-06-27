'use client'

import * as React from 'react'
import { EnhancedAttendanceFilters } from './enhanced-attendance-filters'
import { AttendanceReportTable } from './attendance-report-table'
import { AttendanceReportHeader } from './attendance-report-header'
import { AttendanceTabs as ReportViewTabs, type ReportTab as ViewTab } from './attendance-tabs'
import { AttendanceKPICards, type AttendanceKPICard, getEnhancedSummaryCards } from './attendance-kpi-cards'
import { AttendanceTrendChart, type AttendanceTrendData } from './attendance-trend-chart'
import { AttendanceDonutChart, type AttendanceDistributionData } from './attendance-donut-chart'
import { AttendanceHighlights, type AttendanceHighlightsData } from './attendance-highlights'
import { AttendanceGroupedTable, type GroupedRecord } from './attendance-grouped-table'
import {
  earlyGoingMockData,
  departments,
  employees,
  savedReports,
  type EarlyGoingRecord,
} from './report-data'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Eye } from 'lucide-react'
import type { Column } from '@/components/ui/data-table'

const viewTabs: ViewTab[] = [
  { id: 'table-focus', label: 'Table Focus' },
  { id: 'trend-focus', label: 'Trend Focus' },
  { id: 'daily-details', label: 'Daily Details' },
]

type ViewTabId = 'table-focus' | 'trend-focus' | 'daily-details'

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
  const [viewMode, setViewMode] = React.useState<ViewTabId>('table-focus')
  const [dateRange, setDateRange] = React.useState({ from: '2026-06-01', to: '2026-06-26' })
  const [groupBy, setGroupBy] = React.useState('organization')
  const [department, setDepartment] = React.useState('all')
  const [employee, setEmployee] = React.useState('all')
  const [quickFilter, setQuickFilter] = React.useState('custom')
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
   const pageSize = 10

  const formatDate = (date: Date) => {
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

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

  React.useEffect(() => {
    setPage(1)
  }, [dateRange.from, dateRange.to, groupBy, department, employee, search])

  const handleDateRangeChange = (range: { from: string; to: string }) => {
    setDateRange(range)
    setQuickFilter('custom')
  }

  const handleReset = () => {
    setDateRange({ from: '2026-06-01', to: '2026-06-26' })
    setGroupBy('organization')
    setDepartment('all')
    setEmployee('all')
    setQuickFilter('custom')
    setSearch('')
    setPage(1)
  }

  const earlyGoingData = React.useMemo(() => {
    return earlyGoingMockData.filter((d) => {
      if (search && !d.employee.toLowerCase().includes(search.toLowerCase())) return false
      if (department && department !== 'all' && d.department.toLowerCase() !== department.toLowerCase()) return false
      if (employee && employee !== 'all' && d.employeeId.toLowerCase() !== employee.toLowerCase()) return false
      if (dateRange.from && d.date) {
        if (d.date < dateRange.from || d.date > dateRange.to) return false
      }
      return true
    })
  }, [search, department, employee, dateRange])

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

  const groupedTableData = React.useMemo((): GroupedRecord[] => {
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
  }, [groupBy, earlyGoingData])

  const trendData = React.useMemo((): AttendanceTrendData[] => {
    const dataSource = earlyGoingData
    const dateMap = new Map<string, { present: number; late: number; early: number; absent: number }>()
    dataSource.forEach((r: any) => {
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
  }, [earlyGoingData])

  const distributionData = React.useMemo((): AttendanceDistributionData => {
    const dataSource = earlyGoingData
    const present = dataSource.filter((r: any) => r.status === 'present').length
    const late = dataSource.filter((r: any) => r.status === 'late').length
    const absent = dataSource.filter((r: any) => r.status === 'absent').length
    const earlyGoing = dataSource.filter((r: any) => r.earlyByMin > 0).length

    return { present, late, earlyGoing, absent }
  }, [earlyGoingData])

  const highlightsData = React.useMemo((): AttendanceHighlightsData => {
    const dataSource = earlyGoingData
    const deptCounts = new Map<string, { present: number; absent: number; early: number; total: number }>()
    dataSource.forEach((r: any) => {
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
  }, [distributionData])

  const renderDailyDetails = () => {
    const data = earlyGoingData
    const total = earlyGoingData.length
    const columns = getEarlyGoingColumns()

    return (
      <div className="flex flex-col gap-6">
        <AttendanceKPICards cards={enhancedCards} />
        <AttendanceReportTable
          columns={columns as any}
          data={data as any}
          searchValue={search}
          onSearchChange={setSearch}
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
      <AttendanceReportHeader
        onSave={() => console.log('Save clicked')}
        onExport={handleExport}
        onPrint={handlePrint}
      />

      <EnhancedAttendanceFilters
        dateRange={dateRange}
        groupBy={groupBy}
        department={department}
        employee={employee}
        quickFilter={quickFilter}
        departments={departments}
        employees={employees}
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

      <ReportViewTabs
        tabs={viewTabs}
        active={viewMode}
        onChange={(id) => setViewMode(id as ViewTabId)}
      />

      {renderContent()}
    </div>
  )
}
