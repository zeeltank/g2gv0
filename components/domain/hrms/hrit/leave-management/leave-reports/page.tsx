'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useLeaveOptions, useLeaveReports } from '@/hooks/use-leave'

import {
  categories,
  currentLeaveYearRange,
  defaultFilters,
  reports,
  type ReportCategory,
  type ReportFilters,
} from './services/leave-reports-data'
import {
  ReportCatalogSection,
  ReportPreviewSection,
  ReportsSidebar,
  TabButton,
  toDepartmentSlices,
  withAllOption,
} from './components/LeaveReportsSections'

/** Report ids whose export should be the row-level register rather than the summary. */
const REGISTER_REPORTS = new Set(['leave-register', 'employee-history', 'long-leave', 'pending-approvals'])
const BALANCE_REPORTS = new Set(['leave-balance', 'carry-forward', 'encashment'])

function formatRangeLabel(startDate: string, endDate: string) {
  const format = (value: string) =>
    new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })

  return `${format(startDate)} - ${format(endDate)}`
}

function toCsvValue(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Translates a preset range into concrete dates the API can filter on. */
function resolveDateRange(preset: string, current: ReportFilters) {
  const today = new Date()

  if (preset === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    return { startDate: toInput(start), endDate: toInput(end) }
  }

  if (preset === 'quarter') {
    const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3
    const start = new Date(today.getFullYear(), quarterStartMonth, 1)
    const end = new Date(today.getFullYear(), quarterStartMonth + 3, 0)
    return { startDate: toInput(start), endDate: toInput(end) }
  }

  if (preset === 'year') {
    return currentLeaveYearRange()
  }

  return { startDate: current.startDate, endDate: current.endDate }
}

function toInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function LeaveReportsPage() {
  const [activeTab, setActiveTab] = useState<'catalog' | 'saved'>('catalog')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ReportCategory>('All Reports')
  const [selectedReportId, setSelectedReportId] = useState('leave-summary')
  const [savedIds, setSavedIds] = useState(
    () => new Set(reports.filter((report) => report.saved).map((report) => report.id)),
  )
  const [filters, setFilters] = useState<ReportFilters>(defaultFilters)
  // Draft filters only become the applied filters when the user hits Apply, so
  // the report does not refetch on every dropdown change.
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>(defaultFilters)

  const apiFilters = useMemo(
    () => ({
      fromDate: appliedFilters.startDate,
      toDate: appliedFilters.endDate,
      departmentId: appliedFilters.department,
      employeeId: appliedFilters.employee,
      leaveTypeId: appliedFilters.leaveType,
      status: appliedFilters.status === 'all' ? undefined : [appliedFilters.status],
      employeeStatus: appliedFilters.employeeStatus as 'active' | 'inactive' | 'all',
    }),
    [appliedFilters],
  )

  const { loading, error, summary, register, balance } = useLeaveReports(apiFilters)
  const { options } = useLeaveOptions()

  const selectedReport = reports.find((report) => report.id === selectedReportId) ?? reports[0]

  const rows = useMemo(() => summary?.rows ?? [], [summary])
  const totals = summary?.totals
  const totalRequests = totals?.total ?? 0
  const approved = totals?.approved ?? 0
  const pending = totals?.pending ?? 0
  const rejected = totals?.rejected ?? 0
  const cancelled = totals?.cancelled ?? 0
  const totalDays = totals?.days ?? 0

  const departmentSlices = useMemo(
    () => toDepartmentSlices(summary?.department_breakdown ?? []),
    [summary],
  )

  const topLeaveType = useMemo(
    () => rows.reduce<typeof rows[number] | null>((top, row) => (!top || row.days > top.days ? row : top), null),
    [rows],
  )

  const filterOptions = useMemo(
    () => ({
      leaveType: withAllOption(options?.leave_types ?? []),
      department: withAllOption(options?.departments ?? []),
      employee: withAllOption(options?.employees ?? []),
      status: withAllOption(options?.statuses ?? []),
    }),
    [options],
  )

  const lastApplied = formatRangeLabel(appliedFilters.startDate, appliedFilters.endDate)

  const filteredReports = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return reports.filter((report) => {
      const matchesTab = activeTab === 'catalog' || savedIds.has(report.id)
      const matchesCategory = category === 'All Reports' || report.category === category
      const matchesQuery =
        !normalizedQuery ||
        report.title.toLowerCase().includes(normalizedQuery) ||
        report.description.toLowerCase().includes(normalizedQuery) ||
        report.category.toLowerCase().includes(normalizedQuery)

      return matchesTab && matchesCategory && matchesQuery
    })
  }, [activeTab, category, query, savedIds])

  const categoryCounts = useMemo(() => {
    return categories.reduce<Record<ReportCategory, number>>((acc, current) => {
      acc[current] =
        current === 'All Reports'
          ? reports.length
          : reports.filter((report) => report.category === current).length
      return acc
    }, {} as Record<ReportCategory, number>)
  }, [])

  function toggleSaved(reportId: string) {
    setSavedIds((current) => {
      const next = new Set(current)
      if (next.has(reportId)) {
        next.delete(reportId)
      } else {
        next.add(reportId)
      }
      return next
    })
  }

  function updateFilter(key: string | number | symbol, value: string | boolean) {
    const field = key as keyof ReportFilters

    setFilters((current) => {
      const next = { ...current, [field]: value } as ReportFilters

      // Choosing a preset range rewrites the concrete dates the API filters on.
      if (field === 'dateRange' && typeof value === 'string') {
        return { ...next, ...resolveDateRange(value, current) }
      }

      // Editing a date by hand means the range is no longer a preset.
      if (field === 'startDate' || field === 'endDate') {
        return { ...next, dateRange: 'custom' }
      }

      // Employees are department scoped, so changing department resets the employee.
      if (field === 'department') {
        return { ...next, employee: 'all' }
      }

      return next
    })
  }

  function resetFilters() {
    setFilters(defaultFilters)
    setAppliedFilters(defaultFilters)
  }

  function applyFilters() {
    setAppliedFilters(filters)
  }

  /** Exports whichever dataset the selected report represents. */
  function exportCsv() {
    let csvRows: (string | number | null | undefined)[][]

    if (REGISTER_REPORTS.has(selectedReport.id)) {
      csvRows = [
        ['Employee', 'Employee ID', 'Department', 'Leave Type', 'From', 'To', 'Days', 'Status', 'Approver', 'Reason'],
        ...register.map((row) => [
          row.employee_name,
          row.employee_no ?? row.employee_id,
          row.department,
          row.leave_type,
          row.from_date,
          row.to_date,
          row.days,
          row.status,
          row.approver,
          row.reason,
        ]),
      ]
    } else if (BALANCE_REPORTS.has(selectedReport.id) && balance) {
      csvRows = [
        ['Employee', 'Employee ID', 'Department', ...balance.leave_types.flatMap((type) => [`${type} Total`, `${type} Used`, `${type} Remaining`])],
        ...balance.rows.map((row) => [
          row.employee_name,
          row.employee_no ?? row.employee_id,
          row.department,
          ...balance.leave_types.flatMap((type) => [
            row.balances[type]?.total ?? 0,
            row.balances[type]?.used ?? 0,
            row.balances[type]?.remaining ?? 0,
          ]),
        ]),
      ]
    } else {
      csvRows = [
        ['Leave Type', 'Total Requests', 'Approved', 'Pending', 'Rejected', 'Cancelled', 'Total Days'],
        ...rows.map((row) => [
          row.leave_type,
          row.total,
          row.approved,
          row.pending,
          row.rejected,
          row.cancelled,
          row.days,
        ]),
        ['Total', totalRequests, approved, pending, rejected, cancelled, totalDays],
      ]
    }

    const csv = csvRows.map((row) => row.map(toCsvValue).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${selectedReport.id}-${appliedFilters.startDate}-to-${appliedFilters.endDate}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-5 text-foreground">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">View, analyze and export leave reports.</p>
          <div className="mt-5 flex items-center gap-7 border-b border-border">
            <TabButton active={activeTab === 'catalog'} onClick={() => setActiveTab('catalog')}>
              Report Catalog
            </TabButton>
            <TabButton active={activeTab === 'saved'} onClick={() => setActiveTab('saved')}>
              My Reports
            </TabButton>
          </div>
        </div>

        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search reports..."
            className="h-10 bg-card pl-9"
          />
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="flex min-w-0 flex-col gap-4">
          <ReportCatalogSection
            activeTab={activeTab}
            category={category}
            categoryCounts={categoryCounts}
            filteredReports={filteredReports}
            query={query}
            savedCount={savedIds.size}
            savedIds={savedIds}
            selectedReportId={selectedReportId}
            onCategoryChange={setCategory}
            onQueryChange={setQuery}
            onReportSelect={setSelectedReportId}
            onSaveToggle={toggleSaved}
            onSavedTabOpen={() => setActiveTab('saved')}
          />

          <ReportPreviewSection
            approved={approved}
            cancelled={cancelled}
            lastApplied={lastApplied}
            loading={loading}
            pending={pending}
            rejected={rejected}
            rows={rows}
            saved={savedIds.has(selectedReport.id)}
            selectedReport={selectedReport}
            totalDays={totalDays}
            totalRequests={totalRequests}
            onApplyFilters={applyFilters}
            onExportCsv={exportCsv}
            onSaveToggle={toggleSaved}
          />
        </div>

        <ReportsSidebar
          approved={approved}
          cancelled={cancelled}
          departmentBreakdown={departmentSlices}
          filterOptions={filterOptions}
          filters={filters}
          rejected={rejected}
          topLeaveType={topLeaveType}
          totalRequests={totalRequests}
          onApplyFilters={applyFilters}
          onFilterChange={updateFilter}
          onResetFilters={resetFilters}
        />
      </div>
    </div>
  )
}
