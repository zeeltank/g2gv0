'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ApprovalQueue } from './audit/approval-queue'
import {
  Search,
  Filter,
  Download,
  Settings,
  FileText,
  CheckCircle2,
  Edit3,
  MessageSquare,
  ArrowUpFromLine,
  ArrowDownToLine,
  ChevronRight,
  PlusCircle,
  Trash2,
  X,
  ChevronLeft,
  ExternalLink,
  History,
  XCircle,
  Link2,
  UserCheck,
  ArrowUpDown,
  Loader2,
  MonitorPlay,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  useAuditEntry,
  useAuditUserActions,
  useCompetencyAudit,
} from '@/hooks/use-competency-audit'
import type { AuditEntry, AuditListParams, AuditTab } from '@/services/competency'

/**
 * Tab ids are explicit constants, never derived from the labels: deriving them
 * is what left two sibling competency screens opening on a blank tab.
 */
const TABS: { id: AuditTab; label: string }[] = [
  { id: 'timeline', label: 'Activity Timeline' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'comments', label: 'Comments' },
  { id: 'history', label: 'Version History' },
  { id: 'io', label: 'Imports / Exports' },
  { id: 'actions', label: 'User Actions Log' },
]

const ALL = 'all'

const SORT_COLUMNS: { key: NonNullable<AuditListParams['sort']>; label: string }[] = [
  { key: 'date', label: 'Date & Time' },
  { key: 'user', label: 'User' },
  { key: 'action', label: 'Action' },
  { key: 'type', label: 'Record Type' },
  { key: 'record', label: 'Record Name' },
]

const PER_PAGE_OPTIONS = [
  { label: '25 per page', value: '25' },
  { label: '50 per page', value: '50' },
  { label: '100 per page', value: '100' },
]

/** Columns the gear popover can hide. Date & Time and Action always stay. */
const TOGGLEABLE_COLUMNS = [
  { key: 'user', label: 'User' },
  { key: 'record_type', label: 'Record Type' },
  { key: 'record_name', label: 'Record Name' },
  { key: 'module', label: 'Module' },
] as const

type ColumnKey = (typeof TOGGLEABLE_COLUMNS)[number]['key']

interface DisplaySettings {
  columns: Record<ColumnKey, boolean>
  perPage: string
}

const DEFAULT_SETTINGS: DisplaySettings = {
  columns: { user: true, record_type: true, record_name: true, module: true },
  perPage: '25',
}

const SETTINGS_KEY = 'cm-audit:display-settings'

function readSettings(): DisplaySettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS

    const parsed = JSON.parse(raw) as Partial<DisplaySettings>
    return {
      columns: { ...DEFAULT_SETTINGS.columns, ...(parsed.columns ?? {}) },
      perPage: parsed.perPage ?? DEFAULT_SETTINGS.perPage,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

/** The row icon follows the derived action class, with a few exact-verb cases. */
function actionIcon(entry: Pick<AuditEntry, 'action' | 'action_class'>) {
  const className = 'w-4 h-4'

  switch (entry.action) {
    case 'Rejected':
      return <XCircle className={`${className} text-destructive`} />
    case 'Imported':
      return <ArrowDownToLine className={`${className} text-indigo-500`} />
    case 'Exported':
    case 'Uploaded':
      return <ArrowUpFromLine className={`${className} text-indigo-500`} />
    case 'Mapped':
    case 'Unmapped':
      return <Link2 className={`${className} text-cyan-600`} />
    case 'Assigned':
    case 'Unassigned':
      return <UserCheck className={`${className} text-violet-500`} />
    default:
      break
  }

  switch (entry.action_class) {
    case 'create':
      return <PlusCircle className={`${className} text-primary`} />
    case 'update':
      return <Edit3 className={`${className} text-orange-500`} />
    case 'delete':
      return <Trash2 className={`${className} text-destructive`} />
    case 'approval':
      return <CheckCircle2 className={`${className} text-success`} />
    case 'comment':
      return <MessageSquare className={`${className} text-primary`} />
    case 'io':
      return <ArrowUpFromLine className={`${className} text-indigo-500`} />
    default:
      return <History className={`${className} text-muted-foreground`} />
  }
}

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadCsv(rows: AuditEntry[]) {
  const header = ['Date & Time', 'User', 'Action', 'Record Type', 'Record Name', 'Module', 'Details']
  const body = rows.map((row) =>
    [row.date, row.user, row.action, row.record_type, row.record_name, row.module, row.description]
      .map(csvCell)
      .join(','),
  )

  const blob = new Blob([[header.join(','), ...body].join('\n')], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `competency-audit-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function CmAudit() {
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<AuditTab>('timeline')
  const [selectedActivity, setSelectedActivity] = useState<number | null>(null)

  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [range, setRange] = useState(ALL)
  const [recordType, setRecordType] = useState(ALL)
  const [moduleFilter, setModuleFilter] = useState(ALL)
  const [userFilter, setUserFilter] = useState(ALL)
  const [actionClass, setActionClass] = useState(ALL)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [sort, setSort] = useState<NonNullable<AuditListParams['sort']>>('date')
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)

  // Read once on mount rather than during render, so server and client markup
  // match before hydration.
  const [settings, setSettings] = useState<DisplaySettings>(DEFAULT_SETTINGS)
  useEffect(() => {
    setSettings(readSettings())
  }, [])

  const persistSettings = useCallback((next: DisplaySettings) => {
    setSettings(next)
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
    } catch {
      // A full or blocked localStorage must not break the screen.
    }
  }, [])

  // Debounce the keyword box so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  const filters = useMemo<AuditListParams>(
    () => ({
      search: search || undefined,
      range: range === ALL ? undefined : range,
      record_type: recordType === ALL ? undefined : recordType,
      module: moduleFilter === ALL ? undefined : moduleFilter,
      user_id_filter: userFilter === ALL ? undefined : userFilter,
      action_class: actionClass === ALL ? undefined : actionClass,
    }),
    [search, range, recordType, moduleFilter, userFilter, actionClass],
  )

  const params = useMemo<AuditListParams>(
    () => ({
      ...filters,
      tab: activeTab,
      sort,
      direction,
      page,
      per_page: Number(settings.perPage),
    }),
    [filters, activeTab, sort, direction, page, settings.perPage],
  )

  const {
    loading,
    error,
    entries,
    pagination,
    metrics,
    metricsLoading,
    filterOptions,
    exporting,
    exportError,
    retry,
    exportRows,
  } = useCompetencyAudit(params)

  const userActions = useAuditUserActions(filters, activeTab === 'actions')
  const detail = useAuditEntry(selectedActivity)

  // Any change to what is being filtered invalidates the current page number.
  const filtersKey = JSON.stringify(filters)
  useEffect(() => {
    setPage(1)
  }, [filtersKey, activeTab, settings.perPage])

  const hasActiveFilters =
    Boolean(search) ||
    range !== ALL ||
    recordType !== ALL ||
    moduleFilter !== ALL ||
    userFilter !== ALL ||
    actionClass !== ALL

  const clearAll = () => {
    setSearchInput('')
    setSearch('')
    setRange(ALL)
    setRecordType(ALL)
    setModuleFilter(ALL)
    setUserFilter(ALL)
    setActionClass(ALL)
  }

  const toggleSort = (key: NonNullable<AuditListParams['sort']>) => {
    if (sort === key) {
      setDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSort(key)
    setDirection(key === 'date' ? 'desc' : 'asc')
  }

  const handleExport = async () => {
    const rows = await exportRows()
    if (rows.length) downloadCsv(rows)
  }

  const openRecord = (entry: Pick<AuditEntry, 'submenu_id'>) => {
    if (!entry.submenu_id) return
    router.push(`/module/m2/${entry.submenu_id}/${entry.submenu_id}`)
  }

  const withOption = (options: { value: string; label: string; count?: number }[] | undefined, allLabel: string) => [
    { label: allLabel, value: ALL },
    ...(options ?? []).map((option) => ({
      label: option.count === undefined ? option.label : `${option.label} (${option.count})`,
      value: option.value,
    })),
  ]

  const kpis = [
    {
      key: 'total',
      value: metrics?.total,
      label: 'Total Activities',
      icon: <FileText className="w-5 h-5" />,
      tone: 'bg-primary/10 text-primary',
      onClick: () => setActionClass(ALL),
    },
    {
      key: 'approvals',
      value: metrics?.approvals,
      label: 'Approvals',
      icon: <CheckCircle2 className="w-5 h-5" />,
      tone: 'bg-success/10 text-success',
      onClick: () => setActiveTab('approvals'),
    },
    {
      key: 'updates',
      value: metrics?.updates,
      label: 'Updates',
      icon: <Edit3 className="w-5 h-5" />,
      tone: 'bg-orange-500/10 text-orange-500',
      onClick: () => {
        setActiveTab('timeline')
        setActionClass('update')
      },
    },
    {
      key: 'comments',
      value: metrics?.comments,
      label: 'Comments',
      icon: <MessageSquare className="w-5 h-5" />,
      tone: 'bg-primary/10 text-primary',
      onClick: () => setActiveTab('comments'),
    },
    {
      key: 'io',
      value: metrics?.imports_exports,
      label: 'Imports / Exports',
      icon: <ArrowUpFromLine className="w-5 h-5" />,
      tone: 'bg-destructive/10 text-destructive',
      onClick: () => setActiveTab('io'),
    },
  ]

  const lastPage = pagination?.last_page ?? 1
  const pageNumbers = useMemo(() => {
    const pages: (number | 'gap')[] = []
    const push = (value: number | 'gap') => {
      if (value === 'gap' || (value >= 1 && value <= lastPage && !pages.includes(value))) {
        pages.push(value)
      }
    }

    push(1)
    if (page > 3) push('gap')
    for (let candidate = page - 1; candidate <= page + 1; candidate++) push(candidate)
    if (page < lastPage - 2) push('gap')
    push(lastPage)

    return pages
  }, [page, lastPage])

  const rangeStart = pagination && pagination.total > 0 ? (pagination.page - 1) * pagination.per_page + 1 : 0
  const rangeEnd = pagination ? Math.min(pagination.page * pagination.per_page, pagination.total) : 0

  return (
    /* min-w-0 so a wide table scrolls inside its own container instead of
       stretching the page and clipping the cards and filter bar above it. */
    <div className="flex flex-col gap-6 p-6 min-h-max min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Audit &amp; Activity Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track all changes, approvals, comments, and user actions across competencies and related records.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="h-10 px-4 rounded-xl font-semibold border-border bg-background gap-2"
            onClick={handleExport}
            disabled={exporting || loading}
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? 'Exporting...' : 'Export'}
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-10 w-10 p-0 rounded-xl font-semibold border-border bg-background"
                aria-label="Display settings"
              >
                <Settings className="w-4 h-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4" align="end">
              <p className="text-sm font-bold text-foreground mb-3">Display settings</p>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Columns
              </p>
              <div className="flex flex-col gap-2 mb-4">
                {TOGGLEABLE_COLUMNS.map((column) => (
                  <label key={column.key} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border accent-primary"
                      checked={settings.columns[column.key]}
                      onChange={(event) =>
                        persistSettings({
                          ...settings,
                          columns: { ...settings.columns, [column.key]: event.target.checked },
                        })
                      }
                    />
                    {column.label}
                  </label>
                ))}
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Rows per page
              </p>
              <Select
                options={PER_PAGE_OPTIONS}
                value={settings.perPage}
                onChange={(value) => persistSettings({ ...settings, perPage: value })}
                className="h-9 w-full"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4 min-w-0">
        {kpis.map((kpi) => (
          <Card key={kpi.key} className="shadow-sm min-w-0">
            <CardContent className="p-0">
              <button
                type="button"
                onClick={kpi.onClick}
                className="w-full text-left p-5 flex items-start gap-4 rounded-xl hover:bg-muted/30 transition-colors"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${kpi.tone}`}>
                  {kpi.icon}
                </div>
                <div>
                  {metricsLoading ? (
                    <Skeleton className="h-7 w-16 mb-1" />
                  ) : (
                    <p className="text-2xl font-bold text-foreground leading-none mb-1">
                      {(kpi.value ?? 0).toLocaleString()}
                    </p>
                  )}
                  <p className="text-sm font-semibold text-foreground">{kpi.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {metrics?.range_label ?? 'All time'}
                  </p>
                </div>
              </button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-4 flex flex-col gap-3 bg-card rounded-xl">
          {/* One row, as designed. NOTE Select's own root is always
              `inline-block w-full` and the className lands on its inner button,
              so the width has to live on a wrapper - putting it on the Select
              leaves every control claiming a full-width flex line. */}
          <div className="flex items-center gap-3 min-w-0 overflow-x-auto g2g-scrollbar">
            <div className="w-40 shrink-0">
              <Select
                options={withOption(filterOptions?.date_ranges, 'All time')}
                value={range}
                onChange={setRange}
                placeholder="All time"
                className="h-10 bg-background"
                aria-label="Date range"
              />
            </div>
            <div className="w-44 shrink-0">
              <Select
                options={withOption(filterOptions?.record_types, 'All Record Types')}
                value={recordType}
                onChange={setRecordType}
                placeholder="All Record Types"
                className="h-10 bg-background"
                aria-label="Record type"
              />
            </div>
            <div className="w-44 shrink-0">
              <Select
                options={withOption(filterOptions?.modules, 'All Modules')}
                value={moduleFilter}
                onChange={setModuleFilter}
                placeholder="All Modules"
                className="h-10 bg-background"
                aria-label="Module"
              />
            </div>
            <div className="w-40 shrink-0">
              <Select
                options={withOption(filterOptions?.users, 'All Users')}
                value={userFilter}
                onChange={setUserFilter}
                placeholder="All Users"
                className="h-10 bg-background"
                aria-label="User"
              />
            </div>

            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by keyword..."
                className="h-10 pl-8 bg-background border-border"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>

            <Button
              variant="outline"
              className={`h-10 px-4 gap-2 bg-background border-border text-sm shrink-0 ${showAdvanced ? 'border-primary text-primary' : ''}`}
              onClick={() => setShowAdvanced((current) => !current)}
            >
              <Filter className="w-4 h-4" /> Filters
            </Button>

            <Button
              variant="link"
              className="text-primary font-semibold text-sm shrink-0 px-0 disabled:opacity-40"
              onClick={clearAll}
              disabled={!hasActiveFilters}
            >
              Clear All
            </Button>
          </div>

          {showAdvanced && (
            <div className="flex items-center gap-3 border-t border-border pt-3 min-w-0">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide shrink-0">
                Action type
              </span>
              <div className="w-56 shrink-0">
                <Select
                  options={withOption(filterOptions?.action_classes, 'All Actions')}
                  value={actionClass}
                  onChange={setActionClass}
                  placeholder="All Actions"
                  className="h-9 bg-background"
                  aria-label="Action type"
                />
              </div>
              <span className="text-xs text-muted-foreground truncate">
                Narrows every tab to one kind of action - the tabs themselves stay as they are.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Split View */}
      <Card className="flex flex-col shadow-sm overflow-hidden flex-1 min-h-[600px]">
        <div className="flex items-center gap-8 border-b border-border px-6 pt-4 bg-muted/10">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setSelectedActivity(null)
                userActions.selectUser(null)
              }}
              className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === tab.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        {activeTab === 'approvals' ? (
          // Was a read-only filter on approval log rows, which meant the module
          // had nowhere to actually approve a competency or publish a framework.
          <div className="flex-1 overflow-auto g2g-scrollbar bg-card p-6">
            <ApprovalQueue />
          </div>
        ) : activeTab === 'actions' ? (
          <UserActionsTab state={userActions} />
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Table */}
            <div
              className={`flex flex-col h-full min-w-0 border-r border-border transition-all duration-300 ${selectedActivity ? 'w-2/3' : 'w-full'}`}
            >
              <div className="flex-1 overflow-auto g2g-scrollbar relative bg-card">
                {error ? (
                  <div className="p-6">
                    <ErrorState
                      title="Could not load the activity log"
                      description={error}
                      retry={retry}
                    />
                  </div>
                ) : loading ? (
                  <div className="p-6 flex flex-col gap-3">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <Skeleton key={index} className="h-12 w-full" />
                    ))}
                  </div>
                ) : entries.length === 0 ? (
                  <div className="p-6">
                    <EmptyState
                      icon={<History className="w-10 h-10" />}
                      title="No activity found"
                      description={
                        hasActiveFilters
                          ? 'No entries match the current filters. Try clearing them.'
                          : 'Activity will appear here as competencies, frameworks, assessments and certifications are changed.'
                      }
                      action={
                        hasActiveFilters ? (
                          <Button variant="outline" onClick={clearAll}>
                            Clear filters
                          </Button>
                        ) : undefined
                      }
                    />
                  </div>
                ) : (
                  <Table className="w-full text-sm">
                    <TableHeader className="bg-muted/30 border-b border-border sticky top-0 z-20">
                      <TableRow className="hover:bg-transparent">
                        {SORT_COLUMNS.filter(
                          (column) =>
                            column.key === 'date' ||
                            column.key === 'action' ||
                            settings.columns[
                              (column.key === 'type' ? 'record_type' : column.key === 'record' ? 'record_name' : column.key) as ColumnKey
                            ],
                        ).map((column) => (
                          <TableHead key={column.key} className="px-6 py-3 font-bold text-foreground">
                            <button
                              type="button"
                              onClick={() => toggleSort(column.key)}
                              className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
                            >
                              {column.label}
                              <ArrowUpDown
                                className={`w-3.5 h-3.5 ${sort === column.key ? 'text-primary' : 'text-muted-foreground/50'}`}
                              />
                            </button>
                          </TableHead>
                        ))}
                        {settings.columns.module && (
                          <TableHead className="px-6 py-3 font-bold text-foreground">Module</TableHead>
                        )}
                        <TableHead className="px-6 py-3 font-bold text-foreground text-center">
                          Details
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-border">
                      {entries.map((row) => (
                        <TableRow
                          key={row.id}
                          className={`hover:bg-muted/30 cursor-pointer ${selectedActivity === row.id ? 'bg-primary/5' : ''}`}
                          onClick={() => setSelectedActivity(row.id)}
                        >
                          <TableCell className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                            {row.date ?? '-'}
                          </TableCell>
                          {settings.columns.user && (
                            <TableCell className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-secondary-foreground shrink-0 border border-border">
                                  {row.initials}
                                </div>
                                <span className="font-medium text-foreground whitespace-nowrap">
                                  {row.user}
                                </span>
                              </div>
                            </TableCell>
                          )}
                          <TableCell className="px-6 py-4">
                            <div className="flex items-center gap-2 text-foreground font-medium">
                              {actionIcon(row)}
                              {row.action}
                            </div>
                          </TableCell>
                          {settings.columns.record_type && (
                            <TableCell className="px-6 py-4 text-foreground">{row.record_type}</TableCell>
                          )}
                          {settings.columns.record_name && (
                            <TableCell className="px-6 py-4 max-w-[260px]">
                              {row.submenu_id ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    openRecord(row)
                                  }}
                                  className="text-primary font-semibold hover:underline text-left truncate block w-full"
                                  title={row.record_name ?? undefined}
                                >
                                  {row.record_name ?? '-'}
                                </button>
                              ) : (
                                <span className="text-foreground truncate block">
                                  {row.record_name ?? '-'}
                                </span>
                              )}
                            </TableCell>
                          )}
                          {settings.columns.module && (
                            <TableCell className="px-6 py-4 text-muted-foreground">{row.module}</TableCell>
                          )}
                          <TableCell className="px-6 py-4 text-center">
                            <ChevronRight className="w-5 h-5 text-muted-foreground mx-auto" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              {/* Pagination */}
              <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-card shrink-0">
                <span>
                  {pagination && pagination.total > 0
                    ? `Showing ${rangeStart.toLocaleString()} to ${rangeEnd.toLocaleString()} of ${pagination.total.toLocaleString()} activities`
                    : 'No activities to show'}
                </span>
                <div className="flex items-center gap-2">
                  {/* Sized wrapper, not a width on the Select - see the filter
                      bar note above. */}
                  <div className="w-32 mr-2 shrink-0">
                    <Select
                      options={PER_PAGE_OPTIONS}
                      value={settings.perPage}
                      onChange={(value) => persistSettings({ ...settings, perPage: value })}
                      className="h-8 text-xs"
                      aria-label="Rows per page"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page <= 1 || loading}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  {pageNumbers.map((value, index) =>
                    value === 'gap' ? (
                      <span key={`gap-${index}`} className="px-1">
                        ...
                      </span>
                    ) : (
                      <Button
                        key={value}
                        variant="outline"
                        size="sm"
                        className={`h-8 w-8 p-0 ${value === page ? 'bg-primary text-primary-foreground border-primary' : ''}`}
                        onClick={() => setPage(value)}
                        disabled={loading}
                      >
                        {value}
                      </Button>
                    ),
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setPage((current) => Math.min(lastPage, current + 1))}
                    disabled={page >= lastPage || loading}
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {exportError && (
                <div className="px-4 pb-3 text-xs text-destructive">{exportError}</div>
              )}
            </div>

            {/* Details panel */}
            {selectedActivity !== null && (
              <div className="w-1/3 flex flex-col h-full bg-muted/5 relative overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between bg-card z-10 shrink-0">
                  <h3 className="font-bold text-foreground text-sm">Activity Details</h3>
                  <Button
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => setSelectedActivity(null)}
                    aria-label="Close details"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex-1 overflow-auto g2g-scrollbar p-6 flex flex-col gap-6">
                  {detail.error ? (
                    <ErrorState
                      title="Could not load the details"
                      description={detail.error}
                      retry={detail.retry}
                    />
                  ) : detail.loading || !detail.entry ? (
                    <div className="flex flex-col gap-3">
                      <Skeleton className="h-40 w-full" />
                      <Skeleton className="h-28 w-full" />
                    </div>
                  ) : (
                    <>
                      {/* Overview */}
                      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-border bg-muted/20">
                          <h4 className="text-sm font-bold text-foreground">Overview</h4>
                        </div>
                        <div className="p-4 flex flex-col gap-4">
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-sm text-muted-foreground">Date &amp; Time</span>
                            <span className="text-sm font-medium text-foreground col-span-2">
                              {detail.entry.date ?? '-'}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 items-center">
                            <span className="text-sm text-muted-foreground">User</span>
                            <div className="flex items-center gap-2 col-span-2">
                              <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-secondary-foreground border border-border">
                                {detail.entry.initials}
                              </div>
                              <span className="text-sm font-medium text-foreground">
                                {detail.entry.user}
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 items-center">
                            <span className="text-sm text-muted-foreground">Action</span>
                            <div className="flex items-center gap-2 text-sm font-medium text-foreground col-span-2">
                              {actionIcon(detail.entry)}
                              {detail.entry.action}
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-sm text-muted-foreground">Record Type</span>
                            <span className="text-sm font-medium text-foreground col-span-2">
                              {detail.entry.record_type}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-sm text-muted-foreground">Record Name</span>
                            <span className="text-sm font-semibold text-foreground col-span-2 break-words">
                              {detail.entry.record_name ?? '-'}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-sm text-muted-foreground">Module</span>
                            <span className="text-sm font-medium text-foreground col-span-2">
                              {detail.entry.module}
                            </span>
                          </div>
                          {detail.entry.description && (
                            <div className="grid grid-cols-3 gap-2">
                              <span className="text-sm text-muted-foreground">Details</span>
                              <span className="text-sm text-foreground col-span-2 break-words">
                                {detail.entry.description}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Change Summary - always present, so the panel has the
                          same shape for every entry. Only field-level edits
                          carry a diff; anything else says so explicitly rather
                          than silently dropping the card. */}
                      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between gap-2">
                          <h4 className="text-sm font-bold text-foreground">Change Summary</h4>
                          {detail.entry.has_changes && (
                            <span className="text-[11px] font-semibold text-muted-foreground">
                              {detail.entry.changes_count} field{detail.entry.changes_count === 1 ? '' : 's'} changed
                            </span>
                          )}
                        </div>
                        {!detail.entry.has_changes ? (
                          <div className="p-4 flex items-start gap-3">
                            <History className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                            <p className="text-sm text-muted-foreground">
                              {detail.entry.action_class === 'create'
                                ? 'This entry recorded a new record, so there are no previous values to compare.'
                                : detail.entry.action_class === 'delete'
                                  ? 'This entry recorded a removal, so there are no field changes to compare.'
                                  : detail.entry.action_class === 'comment'
                                    ? 'This entry is a comment — it did not change any field.'
                                    : 'No field-level changes were recorded for this activity.'}
                            </p>
                          </div>
                        ) : (
                          <div className="p-0 overflow-x-auto">
                            <Table className="w-full text-xs">
                              <TableHeader className="bg-transparent">
                                <TableRow className="hover:bg-transparent">
                                  <TableHead className="h-8 font-semibold text-muted-foreground">Field</TableHead>
                                  <TableHead className="h-8 font-semibold text-muted-foreground">Old Value</TableHead>
                                  <TableHead className="h-8 font-semibold text-muted-foreground">New Value</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {detail.entry.changes.map((change) => (
                                  <TableRow key={change.field} className="hover:bg-muted/10">
                                    <TableCell className="font-medium text-foreground align-top py-3">
                                      {change.label}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground align-top py-3 break-words">
                                      {change.old ?? <span className="italic">empty</span>}
                                    </TableCell>
                                    <TableCell className="text-foreground align-top py-3 break-words">
                                      {change.new ?? <span className="italic">empty</span>}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>

                      {/* Record Link */}
                      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden p-4">
                        <h4 className="text-sm font-bold text-foreground mb-3">Record Link</h4>
                        {detail.entry.submenu_id ? (
                          <Button
                            variant="link"
                            className="p-0 h-auto gap-2 text-primary font-semibold text-sm"
                            onClick={() => openRecord(detail.entry!)}
                          >
                            Open {detail.entry.record_type} <ExternalLink className="w-4 h-4" />
                          </Button>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            This entry is not tied to a screen you can open.
                          </p>
                        )}
                      </div>

                      {/* Other activity on the same record */}
                      {detail.entry.related.length > 0 && (
                        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                          <div className="px-4 py-3 border-b border-border bg-muted/20">
                            <h4 className="text-sm font-bold text-foreground">
                              Other activity on this record
                            </h4>
                          </div>
                          <div className="p-2 flex flex-col">
                            {detail.entry.related.map((related) => (
                              <button
                                key={related.id}
                                type="button"
                                onClick={() => setSelectedActivity(related.id)}
                                className="flex items-start gap-3 px-2 py-2.5 rounded-lg hover:bg-muted/40 text-left transition-colors"
                              >
                                <span className="mt-0.5">{actionIcon(related)}</span>
                                <span className="flex-1 min-w-0">
                                  <span className="block text-sm font-medium text-foreground truncate">
                                    {related.action} &middot; {related.user}
                                  </span>
                                  <span className="block text-xs text-muted-foreground">
                                    {related.date}
                                  </span>
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * User Actions Log tab
 * ------------------------------------------------------------------ */

function UserActionsTab({
  state,
}: {
  state: ReturnType<typeof useAuditUserActions>
}) {
  const { loading, error, users, selectedUserId, selectUser, detail, detailLoading, detailError, retry } = state

  return (
    <div className="flex flex-1 overflow-hidden">
      <div
        className={`flex flex-col h-full min-w-0 border-r border-border transition-all duration-300 ${selectedUserId ? 'w-2/3' : 'w-full'}`}
      >
        <div className="flex-1 overflow-auto g2g-scrollbar bg-card">
          {error ? (
            <div className="p-6">
              <ErrorState title="Could not load the user actions log" description={error} retry={retry} />
            </div>
          ) : loading ? (
            <div className="p-6 flex flex-col gap-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<UserCheck className="w-10 h-10" />}
                title="No user activity yet"
                description="Once people start changing competency records, their activity is summarised here."
              />
            </div>
          ) : (
            <Table className="w-full text-sm">
              <TableHeader className="bg-muted/30 border-b border-border sticky top-0 z-20">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-6 py-3 font-bold text-foreground">User</TableHead>
                  <TableHead className="px-6 py-3 font-bold text-foreground text-right">Actions</TableHead>
                  <TableHead className="px-6 py-3 font-bold text-foreground text-right">Created</TableHead>
                  <TableHead className="px-6 py-3 font-bold text-foreground text-right">Updated</TableHead>
                  <TableHead className="px-6 py-3 font-bold text-foreground text-right">Deleted</TableHead>
                  <TableHead className="px-6 py-3 font-bold text-foreground text-right">Approved</TableHead>
                  <TableHead className="px-6 py-3 font-bold text-foreground text-right">Comments</TableHead>
                  <TableHead className="px-6 py-3 font-bold text-foreground">Last Active</TableHead>
                  <TableHead className="px-6 py-3 font-bold text-foreground text-center">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border">
                {users.map((row) => (
                  <TableRow
                    key={row.user_id ?? 'system'}
                    className={`hover:bg-muted/30 ${row.user_id ? 'cursor-pointer' : ''} ${selectedUserId === row.user_id ? 'bg-primary/5' : ''}`}
                    onClick={() => row.user_id && selectUser(row.user_id)}
                  >
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-secondary-foreground shrink-0 border border-border">
                          {row.initials}
                        </div>
                        <span className="font-medium text-foreground whitespace-nowrap">{row.user}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right font-semibold text-foreground">
                      {row.total.toLocaleString()}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right text-muted-foreground">{row.created}</TableCell>
                    <TableCell className="px-6 py-4 text-right text-muted-foreground">{row.updated}</TableCell>
                    <TableCell className="px-6 py-4 text-right text-muted-foreground">{row.deleted}</TableCell>
                    <TableCell className="px-6 py-4 text-right text-muted-foreground">{row.approved}</TableCell>
                    <TableCell className="px-6 py-4 text-right text-muted-foreground">{row.commented}</TableCell>
                    <TableCell className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                      {row.last_active ?? '-'}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-center">
                      {row.user_id ? (
                        <ChevronRight className="w-5 h-5 text-muted-foreground mx-auto" />
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {selectedUserId !== null && (
        <div className="w-1/3 flex flex-col h-full bg-muted/5 overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between bg-card z-10 shrink-0">
            <h3 className="font-bold text-foreground text-sm">
              {detail?.user.name ?? 'User activity'}
            </h3>
            <Button
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => selectUser(null)}
              aria-label="Close user activity"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-auto g2g-scrollbar p-6 flex flex-col gap-6">
            {detailError ? (
              <ErrorState title="Could not load this user's activity" description={detailError} />
            ) : detailLoading || !detail ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : (
              <>
                <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-muted/20">
                    <h4 className="text-sm font-bold text-foreground">Record changes</h4>
                  </div>
                  {detail.changes.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">
                      No record changes in the selected range.
                    </p>
                  ) : (
                    <div className="p-2 flex flex-col">
                      {detail.changes.map((change) => (
                        <div key={change.id} className="flex items-start gap-3 px-2 py-2.5">
                          <span className="mt-0.5">{actionIcon(change)}</span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-medium text-foreground truncate">
                              {change.action} &middot; {change.record_type}
                            </span>
                            <span className="block text-xs text-muted-foreground truncate">
                              {change.record_name ?? change.description}
                            </span>
                            <span className="block text-xs text-muted-foreground/70">{change.date}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-muted/20">
                    <h4 className="text-sm font-bold text-foreground">Screen access log</h4>
                  </div>
                  {detail.access_log.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">
                      No screen-access events recorded for this user.
                    </p>
                  ) : (
                    <div className="p-2 flex flex-col">
                      {detail.access_log.map((access) => (
                        <div key={access.id} className="flex items-start gap-3 px-2 py-2.5">
                          <MonitorPlay className="w-4 h-4 text-muted-foreground mt-0.5" />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-medium text-foreground truncate">
                              {access.screen}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {access.event} &middot; {access.date}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
