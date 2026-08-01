'use client'

import React, { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  Download,
  GraduationCap,
  Image as ImageIcon,
  Layers,
  ListFilter,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SearchInput } from '@/components/ui/search-input'
import { Select } from '@/components/ui/select'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/ui/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { useCourseCatalog } from '@/hooks/use-course-catalog'
import type { CatalogCourse, CatalogSortBy } from '@/services/lms'
import { CourseDetailsSheet } from './course-details-sheet'
import { CourseFormSheet, type CourseFormMode } from './course-form-sheet'
import { AiCourseSheet } from './ai-course-sheet'

function KpiCard({
  title,
  value,
  icon: Icon,
  loading,
}: {
  title: string
  value: string | number
  icon: React.ElementType
  loading: boolean
}) {
  return (
    <Card className="rounded-xl border-border/80 bg-card shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground">
            <Icon className="size-4" /> {title}
          </p>
          {loading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <h3 className="text-2xl font-black tracking-tight text-foreground">{value}</h3>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

const SORT_OPTIONS: { value: CatalogSortBy; label: string }[] = [
  { value: 'updated_at', label: 'Last updated' },
  { value: 'title', label: 'Course name' },
  { value: 'category', label: 'Category' },
  { value: 'type', label: 'Type' },
  { value: 'learners', label: 'Learners' },
  { value: 'completion', label: 'Completion' },
  { value: 'status', label: 'Status' },
]

/** Client-side CSV of the current page - there is no export endpoint. */
function exportCsv(courses: CatalogCourse[]) {
  const headers = [
    'ID',
    'Course',
    'Category',
    'Type',
    'Course code',
    'Department',
    'Job role',
    'Learners',
    'Completed',
    'Completion %',
    'Status',
    'Last updated',
  ]

  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`

  const rows = courses.map((course) =>
    [
      course.id,
      course.display_name,
      course.subject_category,
      course.subject_type,
      course.subject_code,
      course.standard_name,
      course.jobrole,
      course.learners,
      course.completed_learners,
      course.completion_rate,
      course.status === 1 ? 'Active' : 'Inactive',
      course.updated_at,
    ]
      .map(escape)
      .join(','),
  )

  const blob = new Blob([[headers.map(escape).join(','), ...rows].join('\n')], {
    type: 'text/csv;charset=utf-8;',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `learning-catalog-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function LearningCatalog() {
  const { user } = useAuth()
  // Course authoring was admin/HR-only in the previous frontend; the API
  // enforces the same rule, so the UI hides what the server would reject.
  const canAuthor = user?.role === 'admin' || user?.role === 'hr'

  const catalog = useCourseCatalog(10)
  const {
    courses,
    meta,
    kpis,
    filterOptions,
    loading,
    error,
    retry,
    filters,
    setFilter,
    clearFilters,
    hasActiveFilters,
    sortBy,
    sortDir,
    toggleSort,
    page,
    setPage,
    perPage,
    saving,
    actionMessage,
    actionError,
    dismissAction,
    createCourse,
    updateCourse,
    deleteCourse,
    bulkAction,
  } = catalog

  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [detailsCourse, setDetailsCourse] = useState<CatalogCourse | null>(null)
  const [formMode, setFormMode] = useState<CourseFormMode>('create')
  const [formCourse, setFormCourse] = useState<CatalogCourse | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<CatalogCourse | null>(null)
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)

  const selectedIds = useMemo(() => selectedRows.map(Number), [selectedRows])

  const openCreate = () => {
    setFormMode('create')
    setFormCourse(null)
    setFormOpen(true)
  }

  const openEdit = (course: CatalogCourse) => {
    setFormMode('edit')
    setFormCourse(course)
    setFormOpen(true)
    setDetailsCourse(null)
  }

  const runBulk = async (action: 'activate' | 'deactivate' | 'delete') => {
    const result = await bulkAction(action, selectedIds)
    if (result.ok) setSelectedRows([])
  }

  const columns: Column<CatalogCourse>[] = [
    {
      id: 'display_name',
      header: 'Course',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/50 bg-muted">
            {row.display_image && row.display_image !== '/' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.display_image} alt="" className="size-full object-cover" />
            ) : (
              <ImageIcon className="size-5 text-muted-foreground/50" />
            )}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-foreground">
              {row.display_name ?? 'Untitled course'}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {[row.subject_code, row.standard_name].filter(Boolean).join(' · ') || '—'}
            </span>
          </div>
        </div>
      ),
    },
    { id: 'subject_category', header: 'Category', render: (val) => (val as string) || '—' },
    { id: 'subject_type', header: 'Type', render: (val) => (val as string) || '—' },
    { id: 'jobrole', header: 'Job Role', render: (val) => (val as string) || '—' },
    {
      id: 'learners',
      header: 'Learners',
      render: (val) => <span className="font-medium">{(val as number).toLocaleString()}</span>,
    },
    {
      id: 'completion_rate',
      header: 'Completion',
      render: (val) => (
        <div className="flex w-24 flex-col gap-1.5">
          <span className="text-[11px] font-bold leading-none text-foreground">
            {val as number}%
          </span>
          <Progress
            value={val as number}
            className="h-1.5 w-full bg-muted-foreground/20 [&>div]:bg-primary"
          />
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      render: (val) => (
        <StatusBadge
          variant={val === 1 ? 'active' : 'inactive'}
          className="text-[10px] font-bold uppercase tracking-wider"
        >
          {val === 1 ? 'Active' : 'Inactive'}
        </StatusBadge>
      ),
    },
    {
      id: 'updated_at',
      header: 'Updated',
      render: (val) => {
        if (!val) return <span className="text-muted-foreground">—</span>
        const parsed = new Date(val as string)
        return Number.isNaN(parsed.getTime()) ? '—' : format(parsed, 'dd MMM yyyy')
      },
    },
    {
      id: 'id',
      header: '',
      render: (_, row) => (
        <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label="Course actions">
                <ListFilter className="size-4 rotate-90 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setDetailsCourse(row)}>
                <BookOpen className="mr-2 size-4" /> View details
              </DropdownMenuItem>
              {canAuthor && (
                <>
                  <DropdownMenuItem onSelect={() => openEdit(row)}>
                    <Pencil className="mr-2 size-4" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      void bulkAction(row.status === 1 ? 'deactivate' : 'activate', [row.id])
                    }
                  >
                    {row.status === 1 ? (
                      <>
                        <Archive className="mr-2 size-4" /> Deactivate
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 size-4" /> Activate
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setPendingDelete(row)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 size-4" /> Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  // A hard failure with nothing cached means there is no table worth showing.
  if (error && !loading && courses.length === 0) {
    return (
      <div className="p-6">
        <ErrorState title="Couldn't load the learning catalog" description={error} retry={retry} />
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col gap-6 pb-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Learning Catalog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the courses available to your organisation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => exportCsv(courses)}
            disabled={courses.length === 0}
          >
            <Download className="size-4" /> Export
          </Button>
          {canAuthor && (
            <>
              <Button variant="outline" className="gap-2" onClick={() => setAiOpen(true)}>
                <Sparkles className="size-4 text-primary" /> Build with AI
              </Button>
              <Button className="shrink-0 gap-2" onClick={openCreate}>
                <Plus className="size-4" /> New Course
              </Button>
            </>
          )}
        </div>
      </div>

      {actionMessage && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-success/30 bg-success/10 px-4 py-2.5 text-sm font-medium text-success"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            {actionMessage}
          </span>
          <button type="button" onClick={dismissAction} aria-label="Dismiss message">
            <X className="size-3.5" />
          </button>
        </div>
      )}
      {(actionError || (error && courses.length > 0)) && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive"
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            {actionError ?? error}
          </span>
          <button type="button" onClick={dismissAction} aria-label="Dismiss message">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard title="Total Courses" value={kpis?.total_courses ?? 0} icon={BookOpen} loading={loading} />
        <KpiCard title="Active" value={kpis?.active_courses ?? 0} icon={CheckCircle2} loading={loading} />
        <KpiCard title="Inactive" value={kpis?.inactive_courses ?? 0} icon={Archive} loading={loading} />
        <KpiCard title="Categories" value={kpis?.categories ?? 0} icon={Layers} loading={loading} />
        <KpiCard
          title="Total Learners"
          value={(kpis?.total_learners ?? 0).toLocaleString()}
          icon={Users}
          loading={loading}
        />
        <KpiCard
          title="Avg Completion"
          value={`${kpis?.avg_completion_rate ?? 0}%`}
          icon={TrendingUp}
          loading={loading}
        />
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="w-full sm:w-64">
            <SearchInput
              value={filters.search}
              onChange={(event) => setFilter('search', event.target.value)}
              placeholder="Search courses, codes, job roles..."
            />
          </div>
          <div className="w-40">
            <Select
              value={filters.category}
              onChange={(value) => setFilter('category', String(value))}
              placeholder="Category"
              aria-label="Filter by category"
              options={[
                { value: '', label: 'All categories' },
                ...(filterOptions?.categories ?? []).map((category) => ({
                  value: category,
                  label: category,
                })),
              ]}
            />
          </div>
          <div className="w-40">
            <Select
              value={filters.subjectType}
              onChange={(value) => setFilter('subjectType', String(value))}
              placeholder="Type"
              aria-label="Filter by type"
              options={[
                { value: '', label: 'All types' },
                ...(filterOptions?.subject_types ?? []).map((type) => ({
                  value: type,
                  label: type,
                })),
              ]}
            />
          </div>
          <div className="w-40">
            <Select
              value={filters.jobrole}
              onChange={(value) => setFilter('jobrole', String(value))}
              placeholder="Job role"
              aria-label="Filter by job role"
              options={[
                { value: '', label: 'All job roles' },
                ...(filterOptions?.jobroles ?? []).map((jobrole) => ({
                  value: jobrole,
                  label: jobrole,
                })),
              ]}
            />
          </div>
          <div className="w-36">
            <Select
              value={filters.status}
              onChange={(value) => setFilter('status', String(value))}
              placeholder="Status"
              aria-label="Filter by status"
              options={[
                { value: '', label: 'Any status' },
                { value: '1', label: 'Active' },
                { value: '0', label: 'Inactive' },
              ]}
            />
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-9 shrink-0 gap-2 text-muted-foreground"
            >
              <X className="size-4" /> Clear All
            </Button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Sort</span>
          <div className="w-40">
            <Select
              value={sortBy}
              onChange={(value) => toggleSort(value as CatalogSortBy)}
              options={SORT_OPTIONS}
              aria-label="Sort by"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="size-9 shrink-0"
            aria-label={sortDir === 'asc' ? 'Sort ascending' : 'Sort descending'}
            onClick={() => toggleSort(sortBy)}
          >
            {sortDir === 'asc' ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
          </Button>
        </div>
      </div>

      {canAuthor && selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/80 bg-card p-2 px-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-[80px] text-sm font-medium text-muted-foreground">
              {selectedRows.length} selected
            </span>
            <div className="mx-2 h-4 w-px bg-border" />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-2"
              disabled={saving}
              onClick={() => void runBulk('activate')}
            >
              <CheckCircle2 className="size-4" /> Activate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-2"
              disabled={saving}
              onClick={() => void runBulk('deactivate')}
            >
              <Archive className="size-4" /> Deactivate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={saving}
              onClick={() => setPendingBulkDelete(true)}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {saving && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            <Button variant="ghost" size="sm" className="h-8" onClick={() => setSelectedRows([])}>
              Clear selection
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 rounded-xl bg-card">
        <DataTable
          columns={columns}
          data={courses}
          isLoading={loading}
          selectable={canAuthor}
          selectedIds={selectedRows}
          onSelectChange={setSelectedRows}
          onRowClick={(row) => setDetailsCourse(row)}
          emptyState={
            <EmptyState
              icon={<GraduationCap className="size-8" />}
              title={hasActiveFilters ? 'No matching courses' : 'No courses yet'}
              description={
                hasActiveFilters
                  ? 'Try adjusting or clearing your filters.'
                  : 'Create your first course to build out the catalog.'
              }
              action={
                hasActiveFilters ? (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : canAuthor ? (
                  <Button size="sm" onClick={openCreate}>
                    New Course
                  </Button>
                ) : undefined
              }
            />
          }
          pagination={{
            page,
            pageSize: perPage,
            total: meta.total,
            onPageChange: setPage,
          }}
          className={cn('border-border/80 shadow-sm')}
        />
      </div>

      <CourseDetailsSheet
        course={detailsCourse}
        open={detailsCourse !== null}
        onOpenChange={(open) => !open && setDetailsCourse(null)}
        canAuthor={canAuthor}
        onEdit={openEdit}
        onDelete={(course) => {
          setDetailsCourse(null)
          setPendingDelete(course)
        }}
      />

      <AiCourseSheet
        open={aiOpen}
        onOpenChange={setAiOpen}
        filterOptions={filterOptions}
        onPublished={retry}
      />

      <CourseFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        course={formCourse}
        filterOptions={filterOptions}
        saving={saving}
        onCreate={createCourse}
        onUpdate={updateCourse}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open: boolean) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this course?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `"${pendingDelete.display_name ?? 'This course'}" will be removed from the catalog. Existing enrolments are kept.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDelete) void deleteCourse(pendingDelete)
                setPendingDelete(null)
              }}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingBulkDelete}
        onOpenChange={(open: boolean) => !open && setPendingBulkDelete(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedRows.length} course(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              The selected courses will be removed from the catalog. Existing enrolments are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setPendingBulkDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void runBulk('delete')
                setPendingBulkDelete(false)
              }}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
