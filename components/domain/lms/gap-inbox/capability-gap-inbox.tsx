'use client'

/**
 * Capability Gap Inbox — HR/Admin side of Capability-Driven Auto Course
 * Assignment.
 *
 * Deliberately matches `LearningAssignments` (components/domain/lms/
 * assignments/learning-assignments.tsx) structurally — header, KPI-card
 * strip, status tabs, filter sidebar, `DataTable` with an explicit
 * `getRowId` — because it sits right beside that screen in Training &
 * Records navigation and should read as the same product, not a bolt-on.
 *
 * ONE ROW PER COMPETENCY, NEVER PER EMPLOYEE OR PER EVENT. The table's
 * primary key is a (tenant, competency) request id; `affected_count` is a
 * number on that row, not a reason to expect one row per person. A request
 * can also leave "Needs a course" on its own (status flips to `superseded`
 * once every affected rating has recovered) — Dismiss is one way out, not
 * the only one.
 *
 * NO BULK "AUTO-MATCH TO A SIMILAR COURSE" ACTION EXISTS HERE, DELIBERATELY.
 * That was proposed and rejected in planning: a wrong automated mapping
 * becomes a real assignment, with a real due date, to real employees. Bulk
 * actions here are limited to Dismiss (reason required) and mapping several
 * selected competencies onto ONE course a human picked.
 */

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  Filter,
  Gauge,
  GraduationCap,
  Inbox,
  Link2,
  Loader2,
  Plus,
  Search,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/ui/data-table'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { LMS_COURSE_BUILDER_ACCESS_LINK } from '@/lib/gtg-navigation'
import { useCapabilityGapInbox, type GapInboxTab } from '@/hooks/use-capability-gap-inbox'
import type { CapabilityCourseRequestRow } from '@/services/lms/capability-gap'
import { GapDetailDrawer } from './gap-detail-drawer'
import { MapExistingCourseDialog } from './map-existing-course-dialog'
import { DismissReasonDialog } from './dismiss-reason-dialog'

const STATUS_LABEL: Record<CapabilityCourseRequestRow['status'], string> = {
  open: 'Needs a course',
  course_created: 'Course mapped',
  dismissed: 'Dismissed',
  superseded: 'Resolved on its own',
}

const STATUS_VARIANT: Record<CapabilityCourseRequestRow['status'], 'pending' | 'active' | 'inactive'> = {
  open: 'pending',
  course_created: 'active',
  dismissed: 'inactive',
  superseded: 'active',
}

const TABS: { id: GapInboxTab; label: string }[] = [
  { id: 'needs_action', label: 'Needs a course' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'dismissed', label: 'Dismissed' },
]

export function CapabilityGapInbox() {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()

  const {
    loading,
    error,
    rows,
    emptyIsExpected,
    summary,
    selectedIds,
    setSelectedIds,
    activeTab,
    setActiveTab,
    tabCounts,
    filters,
    setFilter,
    resetFilters,
    setQuickFilter,
    activeFilterCount,
    departmentOptions,
    competencyOptions,
    jobroleOptions,
    dismiss,
    bulkDismiss,
    acting,
    actionError,
    retry,
  } = useCapabilityGapInbox()

  const [showFilterSidebar, setShowFilterSidebar] = useState(true)
  const [openRequestId, setOpenRequestId] = useState<number | null>(null)
  const [mapTarget, setMapTarget] = useState<{ ids: number[]; label: string } | null>(null)
  const [dismissTarget, setDismissTarget] = useState<{ ids: number[]; label: string } | null>(null)

  const builderRoute = resolveAccessLink(LMS_COURSE_BUILDER_ACCESS_LINK)

  // One removable chip per active filter, surfaced above the table so a
  // narrowed view is visible (and undoable) without opening the sidebar -
  // the sidebar's own selects already show the same state, this is just
  // the at-a-glance summary of it.
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onClear: () => void }[] = []
    if (filters.department !== 'All') {
      chips.push({ key: 'department', label: filters.department, onClear: () => setFilter('department', 'All') })
    }
    if (filters.competency !== 'All') {
      const name = competencyOptions.find((c) => String(c.id) === filters.competency)?.name ?? filters.competency
      chips.push({ key: 'competency', label: name, onClear: () => setFilter('competency', 'All') })
    }
    if (filters.jobrole !== 'All') {
      const name = jobroleOptions.find((r) => String(r.id) === filters.jobrole)?.name ?? filters.jobrole
      chips.push({ key: 'jobrole', label: name, onClear: () => setFilter('jobrole', 'All') })
    }
    if (filters.severity !== 'All') {
      chips.push({
        key: 'severity',
        label: filters.severity === 'severe' ? 'Severe' : 'Moderate',
        onClear: () => setFilter('severity', 'All'),
      })
    }
    if (filters.daysPending !== 'All') {
      chips.push({
        key: 'daysPending',
        label: `≤ ${filters.daysPending} days pending`,
        onClear: () => setFilter('daysPending', 'All'),
      })
    }
    if (filters.mandatoryOnly) {
      chips.push({ key: 'mandatoryOnly', label: 'Mandatory only', onClear: () => setFilter('mandatoryOnly', false) })
    }
    return chips
  }, [filters, competencyOptions, jobroleOptions, setFilter])

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.includes(String(row.id))),
    [rows, selectedIds],
  )

  const handleCreateCourse = (row: CapabilityCourseRequestRow) => {
    router.push(`${builderRoute}?competency_id=${row.competency_id}`)
  }

  const columns: Column<CapabilityCourseRequestRow>[] = [
    {
      id: 'competency_name',
      header: 'Competency',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">{row.competency_name}</span>
          {row.is_mandatory && (
            <Badge variant="destructive" className="text-[10px] font-bold uppercase">
              Mandatory
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: 'required_proficiency',
      header: 'Severity',
      render: (_, row) => (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
          <AlertTriangle className="size-3.5" />
          Needs level {row.required_proficiency}
        </div>
      ),
    },
    {
      id: 'affected_count',
      header: 'Affected',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {Array.from({ length: Math.min(row.affected_count, 3) }).map((_, i) => (
              <span
                key={i}
                className="flex size-6 items-center justify-center rounded-full border border-background bg-muted text-[10px] font-bold text-muted-foreground"
              >
                <Users className="size-3" />
              </span>
            ))}
          </div>
          <span className="text-sm font-semibold text-foreground">{row.affected_count}</span>
        </div>
      ),
    },
    {
      id: 'days_pending',
      header: 'Days pending',
      render: (_, row) => (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-xs font-semibold',
            row.days_pending >= 30 ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          <CalendarClock className="size-3.5" />
          {row.days_pending}d{row.times_seen > 1 ? ` · seen ${row.times_seen}×` : ''}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      render: (_, row) => (
        <StatusBadge variant={STATUS_VARIANT[row.status]} className="text-[10px] font-bold uppercase">
          {STATUS_LABEL[row.status]}
        </StatusBadge>
      ),
    },
    {
      id: 'id',
      header: '',
      render: (_, row) =>
        row.status === 'open' ? (
          <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
            <Button
              size="sm"
              className="h-8 gap-1.5 font-bold"
              onClick={() => handleCreateCourse(row)}
            >
              <Plus className="size-3.5" /> Create course
            </Button>
          </div>
        ) : null,
    },
  ]

  if (error && !loading && rows.length === 0 && !emptyIsExpected) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <AlertTriangle className="size-12 text-destructive" />
        <p className="text-lg font-bold text-foreground">Failed to load the capability gap inbox</p>
        <p className="max-w-md text-center text-sm text-muted-foreground">{error}</p>
        <Button className="gap-2 font-bold" onClick={retry}>
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col bg-background pb-12">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between border-b border-border/60 pb-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Capability Gap Inbox</h1>
          <p className="mt-0.5 text-sm font-medium text-muted-foreground">
            Competencies nobody can close yet because no course exists for them — resolve by
            mapping or creating a course, or dismiss with a reason.
          </p>
        </div>
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="h-9 w-72 pl-9"
            placeholder="Search competencies…"
            value={filters.search}
            onChange={(event) => setFilter('search', event.target.value)}
          />
        </div>
      </div>

      {actionError && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive">
          {actionError}
        </div>
      )}

      {/* KPI strip — each card is a quick filter, same convention as Assignments. */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-5">
        <Card
          className="cursor-pointer border-border/80 shadow-sm transition-shadow hover:shadow-md"
          onClick={() => setActiveTab('needs_action')}
        >
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-warning/10">
              <Inbox className="size-5 text-warning" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Needs Action
              </span>
              <span className="text-2xl font-black tracking-tight text-foreground">
                {loading ? '—' : (summary?.needs_action ?? 0).toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer border-border/80 shadow-sm transition-shadow hover:shadow-md"
          onClick={() => setActiveTab('resolved')}
        >
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="size-5 text-success" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Auto-assigned
              </span>
              <span className="text-2xl font-black tracking-tight text-foreground">
                {loading ? '—' : (summary?.auto_assigned ?? 0).toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer border-border/80 shadow-sm transition-shadow hover:shadow-md"
          onClick={() => setActiveTab('needs_action')}
        >
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
              <Users className="size-5 text-muted-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                People Affected
              </span>
              <span className="text-2xl font-black tracking-tight text-foreground">
                {loading ? '—' : (summary?.people_affected ?? 0).toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer border-border/80 shadow-sm transition-shadow hover:shadow-md"
          onClick={() => {
            setActiveTab('needs_action')
            setQuickFilter('stale')
          }}
        >
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
              <CalendarClock className="size-5 text-muted-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Avg Days Pending
              </span>
              <span className="text-2xl font-black tracking-tight text-foreground">
                {loading ? '—' : (summary?.avg_days_pending ?? 0).toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer border-border/80 shadow-sm transition-shadow hover:shadow-md"
          onClick={() => setActiveTab('dismissed')}
        >
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
              <XCircle className="size-5 text-muted-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Dismissed
              </span>
              <span className="text-2xl font-black tracking-tight text-foreground">
                {loading ? '—' : (summary?.dismissed ?? 0).toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status tabs */}
      <div className="mb-4 flex items-center gap-6 border-b border-border/60">
        {TABS.map((tab) => (
          <div
            key={tab.id}
            className={cn(
              'flex cursor-pointer items-center gap-2 border-b-2 pb-3 text-sm font-bold transition-colors',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none',
                activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
              )}
            >
              {tabCounts[tab.id]}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-stretch gap-6 xl:flex-row">
        <div className="flex min-w-0 w-full flex-1 flex-col">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'h-8 gap-2 font-bold',
                  showFilterSidebar
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-primary/5 border-primary/20 text-primary',
                )}
                onClick={() => setShowFilterSidebar((v) => !v)}
              >
                <Filter className="size-3.5" /> Filter
                {activeFilterCount > 0 && (
                  <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
              {selectedIds.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">
                    {selectedIds.length} selected
                  </span>
                  <span
                    className="cursor-pointer text-sm font-semibold text-primary hover:underline"
                    onClick={() => setSelectedIds([])}
                  >
                    Clear
                  </span>
                </div>
              )}
              {filters.quickFilter && (
                <Badge
                  variant="outline"
                  className="cursor-pointer gap-1 border-primary/20 bg-primary/5 font-semibold text-primary"
                  onClick={() => setQuickFilter('')}
                >
                  {filters.quickFilter} <X className="size-3" />
                </Badge>
              )}
            </div>

            {activeTab === 'needs_action' && selectedIds.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 font-bold"
                  onClick={() =>
                    setMapTarget({
                      ids: selectedRows.map((r) => r.competency_id),
                      label: `${selectedRows.length} selected competencies`,
                    })
                  }
                >
                  <Link2 className="size-3.5" /> Map to one course
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 font-bold text-destructive border-destructive/20"
                  onClick={() =>
                    setDismissTarget({
                      ids: selectedRows.map((r) => r.id),
                      label: `${selectedRows.length} selected requests`,
                    })
                  }
                >
                  <XCircle className="size-3.5" /> Dismiss selected
                </Button>
              </div>
            )}
          </div>

          {activeChips.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {activeChips.map((chip) => (
                <Badge
                  key={chip.key}
                  variant="outline"
                  className="cursor-pointer gap-1.5 border-border bg-muted/40 font-semibold text-foreground"
                  onClick={chip.onClear}
                >
                  {chip.label}
                  <X className="size-3 text-muted-foreground" />
                </Badge>
              ))}
              <button
                type="button"
                className="text-xs font-semibold text-primary hover:underline"
                onClick={resetFilters}
              >
                Clear all
              </button>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
            <DataTable
              columns={columns}
              data={rows}
              isLoading={loading}
              selectable={activeTab === 'needs_action'}
              getRowId={(row) => String(row.id)}
              selectedIds={selectedIds}
              onSelectChange={setSelectedIds}
              onRowClick={(row) => setOpenRequestId(row.id)}
              emptyState={
                <div className="flex flex-col items-center gap-2 py-6">
                  <CheckCircle2 className="size-8 text-success" />
                  <p className="font-semibold text-foreground">
                    {activeTab === 'needs_action'
                      ? 'Nothing waiting on a course right now'
                      : activeTab === 'dismissed'
                        ? 'Nothing has been dismissed'
                        : 'Nothing resolved yet'}
                  </p>
                  {activeTab === 'needs_action' && (
                    <p className="max-w-sm text-center text-sm text-muted-foreground">
                      Every flagged competency either has a course mapped or has resolved on its
                      own.
                    </p>
                  )}
                </div>
              }
              className="rounded-none border-0 shadow-none [&_th]:text-[13px] [&_th]:font-bold [&_th]:normal-case [&_th]:text-foreground"
            />
          </div>
        </div>

        {/* Filter sidebar */}
        {showFilterSidebar && (
          <div className="flex w-full shrink-0 flex-col rounded-xl border border-border/80 bg-card shadow-sm xl:w-[300px]">
            <div className="flex items-center justify-between border-b border-border/40 p-4">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-foreground">Filters</h3>
                {activeFilterCount > 0 && (
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-black text-primary">
                    {activeFilterCount}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground"
                onClick={() => setShowFilterSidebar(false)}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex flex-1 flex-col gap-6 p-5">
              {/* Scope — WHERE the gap sits */}
              <div className="flex flex-col gap-4">
                <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Scope
                </h4>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <Building2 className="size-3.5 text-muted-foreground" /> Department
                  </label>
                  <Select
                    options={[
                      { label: 'All', value: 'All' },
                      ...departmentOptions.map((value) => ({ label: value, value })),
                    ]}
                    value={filters.department}
                    onChange={(value) => setFilter('department', String(value))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <GraduationCap className="size-3.5 text-muted-foreground" /> Competency
                  </label>
                  <Select
                    options={[
                      { label: 'All', value: 'All' },
                      ...competencyOptions.map((c) => ({ label: c.name, value: String(c.id) })),
                    ]}
                    value={filters.competency}
                    onChange={(value) => setFilter('competency', String(value))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <Briefcase className="size-3.5 text-muted-foreground" /> Job Role
                  </label>
                  <Select
                    options={[
                      { label: 'All', value: 'All' },
                      ...jobroleOptions.map((r) => ({ label: r.name, value: String(r.id) })),
                    ]}
                    value={filters.jobrole}
                    onChange={(value) => setFilter('jobrole', String(value))}
                  />
                </div>
              </div>

              <div className="border-t border-border/40" />

              {/* Priority — HOW URGENT */}
              <div className="flex flex-col gap-4">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Priority
                </h4>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <Gauge className="size-3.5 text-muted-foreground" /> Severity
                  </label>
                  <Select
                    options={[
                      { label: 'All', value: 'All' },
                      { label: 'Severe (mandatory, 5+ affected)', value: 'severe' },
                      { label: 'Moderate', value: 'moderate' },
                    ]}
                    value={filters.severity}
                    onChange={(value) => setFilter('severity', String(value))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <CalendarClock className="size-3.5 text-muted-foreground" /> Days Pending (at most)
                  </label>
                  <Select
                    options={[
                      { label: 'All', value: 'All' },
                      { label: '7', value: '7' },
                      { label: '30', value: '30' },
                      { label: '90', value: '90' },
                    ]}
                    value={filters.daysPending}
                    onChange={(value) => setFilter('daysPending', String(value))}
                  />
                </div>

                <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={filters.mandatoryOnly}
                    onChange={(event) => setFilter('mandatoryOnly', event.target.checked)}
                  />
                  Mandatory only
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border/40 p-5">
              <span className="text-xs font-medium text-muted-foreground">
                {rows.length} of {tabCounts[activeTab]} shown
              </span>
              <Button
                variant="outline"
                className="rounded-full px-6 font-bold"
                disabled={activeFilterCount === 0}
                onClick={resetFilters}
              >
                Reset
              </Button>
            </div>
          </div>
        )}
      </div>

      <GapDetailDrawer
        requestId={openRequestId}
        onClose={() => setOpenRequestId(null)}
        onChanged={retry}
      />

      {mapTarget && (
        <MapExistingCourseDialog
          open
          onClose={() => setMapTarget(null)}
          competencyIds={mapTarget.ids}
          competencyLabel={mapTarget.label}
          onMapped={() => {
            setSelectedIds([])
            retry()
          }}
        />
      )}

      <DismissReasonDialog
        open={dismissTarget !== null}
        onOpenChange={(open) => !open && setDismissTarget(null)}
        label={dismissTarget?.label ?? ''}
        busy={acting}
        onConfirm={(reason) => {
          if (!dismissTarget) return
          void (dismissTarget.ids.length === 1
            ? dismiss(dismissTarget.ids[0], reason)
            : bulkDismiss(dismissTarget.ids, reason)
          ).then((result) => {
            if (result.ok) setDismissTarget(null)
          })
        }}
      />
    </div>
  )
}
