'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useLeaveOptions, useLeaveReportCatalog, useLeaveReports } from '@/hooks/use-leave'

import {
  categories,
  currentLeaveYearRange,
  defaultFilters,
  reports,
  type ReportCategory,
  type ReportDefinition,
  type ReportFilters,
} from './services/leave-reports-data'
import {
  ReportCatalogSection,
  ReportPreviewSection,
  ReportInsightsSection,
  ReportsSidebar,
  TabButton,
  toDepartmentSlices,
  withAllOption,
} from './components/LeaveReportsSections'

const SAVED_REPORTS_KEY = 'hrit.leave-reports.saved'

/*
 * Which dataset each report is. One id per endpoint, and the catalogue is now
 * trimmed to match - see the note on `reports` in leave-reports-data.ts.
 *
 * These sets used to name nine ids between them, seven of which had no endpoint.
 * `carry-forward` and `encashment` sat in BALANCE_REPORTS and exported a plain
 * balance CSV - no carry-forward column, no encashment column - under a filename
 * built from the report id, so the file asserted in its own name what it did not
 * contain.
 */
const REGISTER_REPORTS = new Set(['leave-register'])
const BALANCE_REPORTS = new Set(['leave-balance'])

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
  const searchParams = useSearchParams()
  /*
   * THE CATALOGUE COMES FROM THE SERVER NOW.
   *
   * It was a module-level constant, so adding or renaming a report meant a
   * frontend deploy, and there was no way for the API and the screen to
   * disagree loudly when they drifted - the screen would simply keep offering a
   * report the backend had stopped producing.
   *
   * Only the DATA is fetched. `icon` and `tone` stay local, matched by id:
   * they are a React component and a colour, not facts about a report, and
   * serialising a Lucide icon through JSON is not a thing worth inventing.
   *
   * The local constant remains the fallback. A catalogue that fails to load
   * should degrade to the three reports this build knows about, not to an empty
   * screen that implies the organisation has no reports.
   */
  const { catalog } = useLeaveReportCatalog()

  /*
   * The server's list, wearing this build's presentation.
   *
   * Only the DATA is fetched: `icon` and `tone` stay local, matched by id -
   * they are a React component and a colour, not facts about a report, and
   * serialising a Lucide icon through JSON is not worth inventing. A report the
   * server knows and this build does not still renders, neutrally styled,
   * rather than disappearing.
   */
  const serverReports = useMemo(() => {
    const entries = catalog?.reports ?? []
    if (entries.length === 0) return null

    const byId = new Map(reports.map((report) => [report.id, report]))

    return entries.map((entry): ReportDefinition => {
      const local = byId.get(entry.id)
      return {
        id: entry.id,
        title: entry.title,
        description: entry.description,
        category: entry.category as ReportDefinition['category'],
        icon: local?.icon ?? Search,
        tone: local?.tone ?? 'bg-muted text-muted-foreground',
        saved: local?.saved,
      }
    })
  }, [catalog])

  /** The server's list where we have it, this build's where we do not. */
  const catalogReports = serverReports ?? reports

  const [activeTab, setActiveTab] = useState<'catalog' | 'saved'>('catalog')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ReportCategory>('All Reports')
  const [selectedReportId, setSelectedReportId] = useState(() => {
    const requested = searchParams.get('report')
    return requested && reports.some((report) => report.id === requested) ? requested : 'leave-summary'
  })
  /*
   * F-114. This was seeded from a static `report.saved` flag on the catalogue
   * and held in component state only, so the Saved tab reset on every refresh
   * and showed every user the same thing. A starred report is a per-person
   * display preference, not tenant configuration, so it belongs in the
   * browser rather than in a new database table.
   *
   * Every read and write is wrapped: storage throws outright in some contexts
   * (private windows, blocked site data) rather than returning null.
   */
  const [savedIds, setSavedIds] = useState<Set<string>>(() => {
    try {
      const raw = window.localStorage.getItem(SAVED_REPORTS_KEY)
      if (raw) return new Set(JSON.parse(raw) as string[])
    } catch {
      // fall through to the catalogue defaults
    }
    return new Set(reports.filter((report) => report.saved).map((report) => report.id))
  })
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

  /*
   * `retry` was returned by the hook and dropped on the floor here.
   *
   * Two things followed. The Refresh button was wired to onApplyFilters, which
   * only calls setAppliedFilters - and the hook keys its fetch on
   * JSON.stringify(filters), so re-applying identical values produces an
   * identical key and NO refetch. Pressing Refresh without first changing a
   * filter, which is the entire point of a refresh button, did nothing.
   * And the error state offered no way back.
   */
  const { loading, error, summary, register, balance, loaded, retry } = useLeaveReports(apiFilters)
  const { options } = useLeaveOptions()

  const selectedReport =
    catalogReports.find((report) => report.id === selectedReportId) ?? catalogReports[0]

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

    return catalogReports.filter((report) => {
      const matchesTab = activeTab === 'catalog' || savedIds.has(report.id)
      const matchesCategory = category === 'All Reports' || report.category === category
      const matchesQuery =
        !normalizedQuery ||
        report.title.toLowerCase().includes(normalizedQuery) ||
        report.description.toLowerCase().includes(normalizedQuery) ||
        report.category.toLowerCase().includes(normalizedQuery)

      return matchesTab && matchesCategory && matchesQuery
    })
  }, [activeTab, category, query, savedIds, catalogReports])

  /*
   * COUNTED OVER WHAT THE USER IS ACTUALLY LOOKING AT.
   *
   * This reduced over the module-level `reports` constant inside a useMemo with
   * an EMPTY dependency array, so it was frozen at 3 / 2 / 1 for the life of the
   * page. It ignored the search box and it ignored the active tab - so on "My
   * Reports" the rail claimed three reports while the grid showed one, and the
   * "Showing X of Y" line a few pixels away used the real filtered count. Two
   * numbers on the same card, disagreeing.
   *
   * Now it counts the same set the grid renders, minus the category filter -
   * a category's own count must not collapse to zero the moment you select a
   * different category.
   */
  const categoryCounts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    const inScope = catalogReports.filter((report) => {
      const matchesTab = activeTab === 'catalog' || savedIds.has(report.id)
      const matchesQuery =
        !normalizedQuery ||
        report.title.toLowerCase().includes(normalizedQuery) ||
        report.description.toLowerCase().includes(normalizedQuery) ||
        report.category.toLowerCase().includes(normalizedQuery)

      return matchesTab && matchesQuery
    })

    return categories.reduce<Record<ReportCategory, number>>((acc, current) => {
      acc[current] =
        current === 'All Reports'
          ? inScope.length
          : inScope.filter((report) => report.category === current).length
      return acc
    }, {} as Record<ReportCategory, number>)
  }, [activeTab, query, savedIds, catalogReports])

  function toggleSaved(reportId: string) {
    setSavedIds((current) => {
      const next = new Set(current)
      if (next.has(reportId)) {
        next.delete(reportId)
      } else {
        next.add(reportId)
      }

      try {
        window.localStorage.setItem(SAVED_REPORTS_KEY, JSON.stringify([...next]))
      } catch {
        // A browser that will not store it still gets the toggle for this visit.
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
    /*
     * F-189. A failed load must not become a file.
     *
     * On failure the hook clears summary, register and balance, and this
     * function would happily write the resulting zeros to
     * leave-register-2026-07-01-to-2026-09-30.csv - a document whose own name
     * asserts a period and whose contents assert that nothing happened in it.
     * That file then leaves the building and nobody who receives it can tell.
     */
    if (!loaded) return

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

      {/*
        F-189. This used to be the ONLY sign of failure - a banner above a
        report still rendering "Total Requests 0 / Approved 0 (0%)", "No leave
        data for this period" and the insight "No leave was taken in the
        selected period." Every one of those is a claim about an organisation's
        leave, produced by a network error, and Export would write them to a
        CSV. The banner now carries a retry and says which it is.
      */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {error} Nothing below is a statement about your organisation&rsquo;s leave &mdash;
              this is a failure to load it.
            </span>
            <Button variant="outline" size="sm" onClick={retry} disabled={loading}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/*
        ONE COLUMN, IN READING ORDER: filters, then the catalogue, then the
        report, then the insights about it.

        This was a two-column grid with a 330px rail holding the filters AND the
        Report Insights card. Below xl the grid collapsed to one column and the
        insights - which describe the metrics at the top of the preview - landed
        last, at the very bottom of the page, a full screen away from what they
        were commenting on.
      */}
      <div className="flex flex-col gap-4">
        <ReportsSidebar
          loaded={loaded}
          approved={approved}
          cancelled={cancelled}
          departmentBreakdown={departmentSlices}
          filterOptions={filterOptions}
          filters={filters}
          rejected={rejected}
          topLeaveType={topLeaveType}
          totalRequests={totalRequests}
          onApplyFilters={applyFilters}
          onRefresh={retry}
          onFilterChange={updateFilter}
          onResetFilters={resetFilters}
        />

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
            register={register}
            balance={balance}
            saved={savedIds.has(selectedReport.id)}
            // F-189. False when the load failed, so the preview renders an
            // error instead of a zeroed report.
            loaded={loaded}
            selectedReport={selectedReport}
            totalDays={totalDays}
            totalRequests={totalRequests}
            onApplyFilters={applyFilters}
            onRefresh={retry}
            onExportCsv={exportCsv}
            onSaveToggle={toggleSaved}
          />

          {/* Directly under the metrics it describes. */}
          <ReportInsightsSection
            loaded={loaded}
            approved={approved}
            cancelled={cancelled}
            departmentBreakdown={departmentSlices}
            rejected={rejected}
            topLeaveType={topLeaveType}
            totalRequests={totalRequests}
          />
        </div>
      </div>

      {/*
        Print rules, mounted with this page so they apply only while it is open -
        the same shape attendance-reports uses, and the fix F-99 made there and
        never brought here. Without them window.print() put the sidebar, tabs,
        filter panel and every button on the paper: a screenshot of an
        application rather than a report.
      */}
      <style jsx global>{`
        @media print {
          .leave-report-no-print,
          nav, aside, header button { display: none !important; }
          .leave-report-print-area { break-inside: auto; overflow: visible !important; }
          .leave-report-print-area table { break-inside: auto; width: 100%; }
          .leave-report-print-area tr { break-inside: avoid; }
          body { background: #fff; }
        }
      `}</style>
    </div>
  )
}
