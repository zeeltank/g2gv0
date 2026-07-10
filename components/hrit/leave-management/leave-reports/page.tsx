'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'

import {
  categories,
  defaultFilters,
  previewRows,
  reports,
  totalFor,
  type ReportCategory,
  type ReportFilters,
} from './services/leave-reports-data'
import {
  ReportCatalogSection,
  ReportPreviewSection,
  ReportsSidebar,
  TabButton,
} from './components/LeaveReportsSections'

export default function LeaveReportsPage() {
  const [activeTab, setActiveTab] = useState<'catalog' | 'saved'>('catalog')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ReportCategory>('All Reports')
  const [selectedReportId, setSelectedReportId] = useState('leave-summary')
  const [savedIds, setSavedIds] = useState(
    () => new Set(reports.filter((report) => report.saved).map((report) => report.id)),
  )
  const [filters, setFilters] = useState<ReportFilters>(defaultFilters)
  const [lastApplied, setLastApplied] = useState('01 May 2025 - 31 May 2025')

  const selectedReport = reports.find((report) => report.id === selectedReportId) ?? reports[0]
  const totalRequests = totalFor('total')
  const approved = totalFor('approved')
  const pending = totalFor('pending')
  const rejected = totalFor('rejected')
  const cancelled = totalFor('cancelled')
  const totalDays = totalFor('days')

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
    setFilters((current) => ({
      ...current,
      [(key as keyof ReportFilters)]: value,
    }))
  }

  function resetFilters() {
    setFilters(defaultFilters)
    setLastApplied('01 May 2025 - 31 May 2025')
  }

  function applyFilters() {
    const from = new Date(filters.startDate).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    const to = new Date(filters.endDate).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    setLastApplied(`${from} - ${to}`)
  }

  function exportCsv() {
    const rows = [
      ['Leave Type', 'Total Requests', 'Approved', 'Pending', 'Rejected', 'Cancelled', 'Total Days'],
      ...previewRows.map((row) => [
        `${row.leaveType} (${row.short})`,
        row.total,
        row.approved,
        row.pending,
        row.rejected,
        row.cancelled,
        row.days,
      ]),
      ['Total', totalRequests, approved, pending, rejected, cancelled, totalDays],
    ]
    const csv = rows.map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${selectedReport.id}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-5 text-foreground">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View, analyze and export leave reports.
          </p>
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
            pending={pending}
            rejected={rejected}
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
          filters={filters}
          rejected={rejected}
          totalRequests={totalRequests}
          onApplyFilters={applyFilters}
          onFilterChange={updateFilter}
          onResetFilters={resetFilters}
        />
      </div>
    </div>
  )
}
