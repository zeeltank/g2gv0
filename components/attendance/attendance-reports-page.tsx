'use client'

import * as React from 'react'
import { GtgPageHeader } from '@/components/shell/gtg-page-header'
import { AttendanceTabs } from './attendance-tabs'
import { AttendanceFilters } from './attendance-filters'
import { AttendanceSummaryCards } from './attendance-summary-cards'
import { AttendanceReportTable } from './attendance-report-table'
import {
  earlyGoingMockData,
  departmentReportMockData,
  employeeReportMockData,
  departments,
  employees,
  savedReports,
  type EarlyGoingRecord,
  type DepartmentReport,
  type EmployeeReport,
} from './report-data'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Eye } from 'lucide-react'
import { type Column } from '@/components/data/enterprise-data-table'

const earlyGoingTabs = [
  { id: 'early-going', label: 'Early Going Report' },
  { id: 'department-wise', label: 'Department Wise Report' },
  { id: 'employee-wise', label: 'Employee Wise Report' },
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

function getDepartmentColumns(): Column<DepartmentReport>[] {
  return [
    { id: 'id', header: '#' },
    { id: 'department', header: 'Department' },
    { id: 'totalEmployees', header: 'Total Employees' },
    { id: 'present', header: 'Present' },
    { id: 'absent', header: 'Absent' },
    { id: 'late', header: 'Late' },
    { id: 'earlyGoing', header: 'Early Going' },
    { id: 'averageWorkingHours', header: 'Average Working Hours' },
    {
      id: 'attendancePercentage',
      header: 'Attendance %',
      render: (value) => `${value}%`,
    },
    {
      id: 'actions' as keyof DepartmentReport,
      header: 'Actions',
      render: () => (
        <Button variant="ghost" size="icon" className="size-8 rounded-full">
          <Eye className="size-4" />
        </Button>
      ),
    },
  ]
}

function getEmployeeColumns(): Column<EmployeeReport>[] {
  return [
    { id: 'id', header: '#' },
    { id: 'date', header: 'Date' },
    { id: 'punchIn', header: 'Punch In' },
    { id: 'punchOut', header: 'Punch Out' },
    { id: 'expectedIn', header: 'Expected In' },
    { id: 'expectedOut', header: 'Expected Out' },
    { id: 'workingHours', header: 'Working Hours' },
    { id: 'lateBy', header: 'Late By' },
    { id: 'earlyBy', header: 'Early By' },
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
      id: 'actions' as keyof EmployeeReport,
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
  const [activeTab, setActiveTab] = React.useState('early-going')
  const [dateRange, setDateRange] = React.useState({ from: '2026-06-01', to: '2026-06-26' })
  const [department, setDepartment] = React.useState('')
  const [employee, setEmployee] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const pageSize = 10
  const [filtersApplied, setFiltersApplied] = React.useState(false)

  const showEmployeeFilter = activeTab === 'employee-wise'

  const earlyGoingData = filtersApplied
    ? earlyGoingMockData.filter((d) => {
        if (search && !d.employee.toLowerCase().includes(search.toLowerCase())) return false
        if (department && d.department.toLowerCase() !== department.toLowerCase()) return false
        if (dateRange.from && d.date) {
          if (d.date < dateRange.from || d.date > dateRange.to) return false
        }
        return true
      })
    : earlyGoingMockData

  const departmentData = filtersApplied
    ? departmentReportMockData.filter((d) => {
        if (department && d.department.toLowerCase() !== department.toLowerCase()) return false
        return true
      })
    : departmentReportMockData

  const employeeData = filtersApplied
    ? employeeReportMockData.filter((d) => {
        if (employee && d.employeeId?.toLowerCase() !== employee.toLowerCase()) return false
        if (dateRange.from && d.date) {
          if (d.date < dateRange.from || d.date > dateRange.to) return false
        }
        return true
      })
    : employeeReportMockData

  const earlygoingCards = React.useMemo(() => {
    const totalEmployees = earlyGoingMockData.length
    const earlyGoingCount = earlyGoingMockData.filter((d) => d.earlyByMin > 0).length
    const avgEarly = Math.round(
      earlyGoingMockData.reduce((sum, d) => sum + d.earlyByMin, 0) / earlyGoingMockData.length,
    )
    const deptCounts = earlyGoingMockData.reduce(
      (acc, d) => {
        acc[d.department] = (acc[d.department] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )
    const highestDept = Object.entries(deptCounts).reduce((max, curr) =>
      curr[1] > max[1] ? curr : max,
    )[0] as string

    return [
      { id: 'total-employees', label: 'Total Employees', value: totalEmployees },
      { id: 'early-going-count', label: 'Early Going Count', value: earlyGoingCount },
      { id: 'avg-early-minutes', label: 'Average Early Minutes', value: avgEarly, unit: 'min' },
      { id: 'highest-early-dept', label: 'Highest Early Going Department', value: highestDept },
    ]
  }, [earlyGoingMockData])

  const departmentCards = React.useMemo(() => {
    const totalDepts = departmentReportMockData.length
    const bestDept = departmentReportMockData.reduce((max, d) =>
      d.attendancePercentage > max.attendancePercentage ? d : max,
    ).department
    const lowestDept = departmentReportMockData.reduce((min, d) =>
      d.attendancePercentage < min.attendancePercentage ? d : min,
    ).department
    const highestEarlyDept = departmentReportMockData.reduce((max, d) =>
      d.earlyGoing > max.earlyGoing ? d : max,
    ).department

    return [
      { id: 'total-depts', label: 'Total Departments', value: totalDepts },
      { id: 'best-attendance', label: 'Best Attendance Department', value: bestDept },
      { id: 'lowest-attendance', label: 'Lowest Attendance Department', value: lowestDept },
      { id: 'highest-early', label: 'Highest Early Going Department', value: highestEarlyDept },
    ]
  }, [])

  const employeeCards = React.useMemo(() => {
    const workingDays = employeeReportMockData.length
    const presentDays = employeeReportMockData.filter((d) => d.status === 'present').length
    const absentDays = employeeReportMockData.filter((d) => d.status === 'absent').length
    const lateEarlyDays = employeeReportMockData.filter((d) => d.lateBy !== '--' || d.earlyBy !== '--').length

    return [
      { id: 'working-days', label: 'Working Days', value: workingDays },
      { id: 'present-days', label: 'Present Days', value: presentDays },
      { id: 'absent-days', label: 'Absent Days', value: absentDays },
      { id: 'late-early', label: 'Late / Early Days', value: lateEarlyDays },
    ]
  }, [])

  const handleExport = () => {
    console.log('Export clicked')
  }

  const handlePrint = () => {
    console.log('Print clicked')
  }

  const handleSavedReportChange = (value: string) => {
    console.log('Saved report:', value)
  }

  const handleSearchClick = () => {
    setFiltersApplied(true)
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-6">
      <GtgPageHeader
        title="Attendance Reports"
        description="View and analyze attendance data with detailed reports."
      />

      <AttendanceTabs
        tabs={earlyGoingTabs}
        active={activeTab}
        onChange={setActiveTab}
      />

      <AttendanceFilters
        dateRange={dateRange}
        department={department}
        employee={employee}
        onDateRangeChange={setDateRange}
        onDepartmentChange={setDepartment}
        onEmployeeChange={setEmployee}
        onSavedReportChange={handleSavedReportChange}
        onExport={handleExport}
        onPrint={handlePrint}
        onSearch={handleSearchClick}
        departments={departments}
        employees={employees}
        savedReports={savedReports}
        showEmployee={showEmployeeFilter}
      />

      <AttendanceSummaryCards
        cards={
          activeTab === 'early-going'
            ? earlygoingCards
            : activeTab === 'department-wise'
              ? departmentCards
              : employeeCards
        }
      />

      <AttendanceReportTable
        columns={(
          activeTab === 'early-going'
            ? getEarlyGoingColumns()
            : activeTab === 'department-wise'
              ? getDepartmentColumns()
              : getEmployeeColumns()
        ) as any}
        data={
          (
            activeTab === 'early-going'
              ? earlyGoingData
              : activeTab === 'department-wise'
                ? departmentData
              : employeeData
          ) as any
        }
        searchValue={search}
        onSearchChange={setSearch}
        page={page}
        pageSize={pageSize}
        total={
          activeTab === 'early-going'
            ? earlyGoingData.length
            : activeTab === 'department-wise'
              ? departmentData.length
              : employeeData.length
        }
        onPageChange={setPage}
        filtersApplied={filtersApplied}
      />
    </div>
  )
}