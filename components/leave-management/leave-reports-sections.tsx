import type { ReactNode } from 'react'
import {
  Bookmark,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  FolderClock,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  Star,
  Users,
  XCircle,
} from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

import {
  categories,
  departmentBreakdown,
  pct,
  previewRows,
  selectOptions,
  type ReportCategory,
  type ReportDefinition,
  type ReportFilters,
} from './leave-reports-data'

type ReportCatalogSectionProps = {
  activeTab: 'catalog' | 'saved'
  category: ReportCategory
  categoryCounts: Record<ReportCategory, number>
  filteredReports: ReportDefinition[]
  query: string
  savedCount: number
  savedIds: Set<string>
  selectedReportId: string
  onCategoryChange: (value: ReportCategory) => void
  onQueryChange: (value: string) => void
  onReportSelect: (reportId: string) => void
  onSaveToggle: (reportId: string) => void
  onSavedTabOpen: () => void
}

type ReportPreviewSectionProps = {
  approved: number
  cancelled: number
  lastApplied: string
  pending: number
  rejected: number
  saved: boolean
  selectedReport: ReportDefinition
  totalDays: number
  totalRequests: number
  onApplyFilters: () => void
  onExportCsv: () => void
  onSaveToggle: (reportId: string) => void
}

type ReportsSidebarProps = {
  approved: number
  cancelled: number
  filters: ReportFilters
  rejected: number
  totalRequests: number
  onApplyFilters: () => void
  onFilterChange: (key: keyof ReportFilters, value: string | boolean) => void
  onResetFilters: () => void
}

export function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'border-b-2 px-1 pb-3 text-sm font-medium transition-colors',
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

export function ReportCatalogSection({
  activeTab,
  category,
  categoryCounts,
  filteredReports,
  query,
  savedCount,
  savedIds,
  selectedReportId,
  onCategoryChange,
  onQueryChange,
  onReportSelect,
  onSaveToggle,
  onSavedTabOpen,
}: ReportCatalogSectionProps) {
  return (
    <Card className="overflow-hidden rounded-lg">
      <CardHeader className="flex-row items-start justify-between gap-4 border-b border-border p-4">
        <div>
          <CardTitle className="text-base">Report Catalog</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a report to view, customize and export.
          </p>
        </div>
        <Button variant="outline" className="h-9 gap-2" onClick={onSavedTabOpen}>
          <Bookmark className="size-4" />
          My Saved Reports
        </Button>
      </CardHeader>
      <CardContent className="p-4">
        <div className="mb-4 grid gap-3 lg:grid-cols-[280px_260px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search reports by name or keyword..."
              className="h-9 pl-9"
            />
          </div>
          <Select
            value={category}
            onChange={(value) => onCategoryChange(value as ReportCategory)}
            options={categories.map((item) => ({ label: item === 'All Reports' ? 'All Categories' : item, value: item }))}
            className="h-9"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[245px_minmax(0,1fr)]">
          <div className="space-y-1 border-r border-border pr-4">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onCategoryChange(item)}
                className={cn(
                  'flex h-10 w-full items-center justify-between rounded-md px-3 text-left text-sm transition-colors',
                  category === item
                    ? 'bg-primary/10 font-medium text-primary ring-1 ring-primary/20'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <span>{item}</span>
                <span className="text-xs">{categoryCounts[item]}</span>
              </button>
            ))}
          </div>

          <div>
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {filteredReports.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  selected={selectedReportId === report.id}
                  saved={savedIds.has(report.id)}
                  onSelect={() => onReportSelect(report.id)}
                  onSave={() => onSaveToggle(report.id)}
                />
              ))}
            </div>
            {filteredReports.length === 0 && (
              <div className="flex min-h-[210px] flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
                <FileText className="size-10 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium">No reports found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Adjust the search, category, or saved report tab.
                </p>
              </div>
            )}
            <p className="mt-4 text-sm text-muted-foreground">
              Showing {filteredReports.length ? 1 : 0} to {filteredReports.length} of{' '}
              {activeTab === 'saved' ? savedCount : categoryCounts['All Reports']} reports
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ReportPreviewSection({
  approved,
  cancelled,
  lastApplied,
  pending,
  rejected,
  saved,
  selectedReport,
  totalDays,
  totalRequests,
  onApplyFilters,
  onExportCsv,
  onSaveToggle,
}: ReportPreviewSectionProps) {
  return (
    <Card className="overflow-hidden rounded-lg">
      <CardHeader className="flex-row items-center justify-between gap-4 border-b border-border p-4">
        <div>
          <CardTitle className="text-base">Report Preview</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedReport.title} <span className="mx-2">|</span> {lastApplied}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="h-9 gap-2" onClick={() => onSaveToggle(selectedReport.id)}>
            <Bookmark className={cn('size-4', saved && 'fill-primary text-primary')} />
            Save Report
          </Button>
          <Button variant="outline" className="h-9 gap-2" onClick={onExportCsv}>
            <Download className="size-4" />
            Export
            <ChevronDown className="size-4" />
          </Button>
          <Button variant="outline" size="icon-lg" onClick={() => window.print()}>
            <Printer className="size-4" />
            <span className="sr-only">Print</span>
          </Button>
          <Button variant="outline" size="icon-lg" onClick={onApplyFilters}>
            <RefreshCw className="size-4" />
            <span className="sr-only">Refresh</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Metric icon={<Users className="size-5" />} label="Total Requests" value={String(totalRequests)} tone="bg-primary/10 text-primary" />
          <Metric icon={<CheckCircle2 className="size-5" />} label="Approved" value={String(approved)} badge={pct(approved, totalRequests)} tone="bg-success/10 text-success" />
          <Metric icon={<FolderClock className="size-5" />} label="Pending" value={String(pending)} badge={pct(pending, totalRequests)} tone="bg-warning/10 text-warning" />
          <Metric icon={<XCircle className="size-5" />} label="Rejected" value={String(rejected)} badge={pct(rejected, totalRequests)} tone="bg-destructive/10 text-destructive" />
          <Metric icon={<ShieldAlert className="size-5" />} label="Cancelled" value={String(cancelled)} badge={pct(cancelled, totalRequests)} tone="bg-slate-100 text-slate-700" />
        </div>

        <div className="overflow-auto rounded-lg border border-border">
          <Table>
            <TableHeader className="bg-surface-muted">
              <TableRow className="hover:bg-surface-muted">
                <TableHead className="normal-case">Leave Type</TableHead>
                <TableHead className="text-center normal-case">Total Requests</TableHead>
                <TableHead className="text-center normal-case">Approved</TableHead>
                <TableHead className="text-center normal-case">Pending</TableHead>
                <TableHead className="text-center normal-case">Rejected</TableHead>
                <TableHead className="text-center normal-case">Cancelled</TableHead>
                <TableHead className="text-center normal-case">Total Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((row) => (
                <TableRow key={row.short}>
                  <TableCell className="min-w-[190px] font-medium">
                    <span className={cn('mr-2 inline-flex size-5 items-center justify-center rounded bg-current/10', row.tone)}>
                      <FileText className="size-3.5" />
                    </span>
                    {row.leaveType} ({row.short})
                  </TableCell>
                  <TableCell className="text-center">{row.total}</TableCell>
                  <TableCell className="text-center">{row.approved}</TableCell>
                  <TableCell className="text-center">{row.pending}</TableCell>
                  <TableCell className="text-center">{row.rejected}</TableCell>
                  <TableCell className="text-center">{row.cancelled}</TableCell>
                  <TableCell className="text-center">{row.days.toFixed(1)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Total</TableCell>
                <TableCell className="text-center">{totalRequests}</TableCell>
                <TableCell className="text-center">{approved}</TableCell>
                <TableCell className="text-center">{pending}</TableCell>
                <TableCell className="text-center">{rejected}</TableCell>
                <TableCell className="text-center">{cancelled}</TableCell>
                <TableCell className="text-center">{totalDays.toFixed(1)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

export function ReportsSidebar({
  approved,
  cancelled,
  filters,
  rejected,
  totalRequests,
  onApplyFilters,
  onFilterChange,
  onResetFilters,
}: ReportsSidebarProps) {
  return (
    <aside className="flex flex-col gap-4">
      <Card className="rounded-lg">
        <CardHeader className="flex-row items-center justify-between p-4 pb-2">
          <CardTitle className="text-base">Filters</CardTitle>
          <Button variant="link" className="h-auto px-0 text-xs" onClick={onResetFilters}>
            Reset
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <FilterSelect label="Date Range" value={filters.dateRange} onChange={(value) => onFilterChange('dateRange', value)} options={selectOptions.dateRange} />
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <Input type="date" value={filters.startDate} onChange={(event) => onFilterChange('startDate', event.target.value)} className="h-9" />
            <span className="text-muted-foreground">-</span>
            <Input type="date" value={filters.endDate} onChange={(event) => onFilterChange('endDate', event.target.value)} className="h-9" />
          </div>
          <FilterSelect label="Leave Type" value={filters.leaveType} onChange={(value) => onFilterChange('leaveType', value)} options={selectOptions.leaveType} />
          <FilterSelect label="Department" value={filters.department} onChange={(value) => onFilterChange('department', value)} options={selectOptions.department} />
          <FilterSelect label="Employee" value={filters.employee} onChange={(value) => onFilterChange('employee', value)} options={selectOptions.employee} />
          <FilterSelect label="Status" value={filters.status} onChange={(value) => onFilterChange('status', value)} options={selectOptions.status} />
          <FilterSelect label="Employee Status" value={filters.employeeStatus} onChange={(value) => onFilterChange('employeeStatus', value)} options={selectOptions.employeeStatus} />

          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              size="sm"
              checked={filters.includeSubordinates}
              onCheckedChange={(checked) => onFilterChange('includeSubordinates', checked)}
            />
            Include Subordinate Data
          </label>

          <Button className="h-10 w-full" onClick={onApplyFilters}>
            Apply Filters
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base">Report Insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 p-4">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <Insight>Approval rate is {pct(approved, totalRequests)} for the selected period.</Insight>
            <Insight>Maximum leaves taken are Casual Leave ({previewRows[0].days} days).</Insight>
            <Insight>{rejected} requests were rejected.</Insight>
            <Insight>{cancelled} requests were cancelled.</Insight>
          </ul>

          <div>
            <h3 className="text-sm font-semibold text-foreground">Top Departments by Leave Days</h3>
            <div className="mt-3 grid grid-cols-[120px_1fr] items-center gap-3">
              <div className="h-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={departmentBreakdown} dataKey="value" innerRadius={34} outerRadius={58} paddingAngle={2}>
                      {departmentBreakdown.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {departmentBreakdown.map((item) => (
                  <div key={item.name} className="grid grid-cols-[10px_1fr_auto] items-center gap-2 text-xs">
                    <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="truncate text-muted-foreground">{item.name}</span>
                    <span className="font-medium text-foreground">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="border-t border-border pt-4 text-xs text-muted-foreground">
            Report generated on 16 May 2025, 10:30 AM
          </p>
        </CardContent>
      </Card>
    </aside>
  )
}

function ReportCard({
  report,
  selected,
  saved,
  onSelect,
  onSave,
}: {
  report: ReportDefinition
  selected: boolean
  saved: boolean
  onSelect: () => void
  onSave: () => void
}) {
  const Icon = report.icon

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group flex min-h-[78px] items-start gap-3 rounded-lg border bg-card p-3 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md',
        selected ? 'border-primary ring-2 ring-primary/15' : 'border-border',
      )}
    >
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', report.tone)}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{report.title}</span>
        <span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{report.description}</span>
      </span>
      <span
        role="button"
        tabIndex={0}
        aria-label={saved ? 'Remove saved report' : 'Save report'}
        onClick={(event) => {
          event.stopPropagation()
          onSave()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            event.stopPropagation()
            onSave()
          }
        }}
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
      >
        <Star className={cn('size-4', saved && 'fill-primary text-primary')} />
      </span>
    </button>
  )
}

function Metric({
  icon,
  label,
  value,
  badge,
  tone,
}: {
  icon: ReactNode
  label: string
  value: string
  badge?: string
  tone: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
      <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', tone)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <div className="mt-1 flex items-center gap-2">
          <p className="text-xl font-bold text-foreground">{value}</p>
          {badge && <Badge variant="success" className="px-2 py-0 text-[10px]">{badge}</Badge>}
        </div>
      </div>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { label: string; value: string }[]
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <Select value={value} onChange={onChange} options={options} className="h-9" />
    </label>
  )
}

function Insight({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
      <span>{children}</span>
    </li>
  )
}



