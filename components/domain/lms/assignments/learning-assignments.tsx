'use client'

import React, { useState, useRef } from 'react'
import {
  Search,
  MoreVertical,
  Users,
  Clock,
  PlayCircle,
  CheckCircle2,
  CalendarDays,
  Filter,
  MonitorPlay,
  FileUp,
  UserPlus,
  Mail,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  AlertCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { DataTable, type Column } from '@/components/ui/data-table'
import { StatusBadge } from '@/components/ui/status-badge'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { useAssignments } from '@/hooks/use-assignments'
import {
  assignmentService,
  assignmentPickerService,
  assignmentApprovalService,
  type AssignmentLearner,
  type CourseEnrollment,
  type ImportResult,
  type LmsAssignment,
} from '@/services/lms/assignment'
import { lmsCatalogService, type CatalogCourse } from '@/services/lms'

/* ------------------------------------------------------------------ *
 * Assign Learning Modal (inline dialog)
 * ------------------------------------------------------------------ */

/**
 * Assign Learning.
 *
 * Learners come from /api/lmsAssignment/learners and courses from the catalog
 * endpoint, so both pickers resolve real ids for POST /api/lmsAssignment.
 * Previously these were free-text boxes and Assign only closed the dialog.
 */
function AssignLearningDialog({
  open,
  onClose,
  onAssigned,
}: {
  open: boolean
  onClose: () => void
  onAssigned: () => void
}) {
  const { user } = useAuth()
  const resolveContext = React.useCallback(() => getLaravelContext(user), [user])

  const [learnerQuery, setLearnerQuery] = useState('')
  const [learners, setLearners] = useState<AssignmentLearner[]>([])
  const [selectedLearners, setSelectedLearners] = useState<AssignmentLearner[]>([])

  const [courseQuery, setCourseQuery] = useState('')
  const [courses, setCourses] = useState<CatalogCourse[]>([])
  const [selectedCourse, setSelectedCourse] = useState<CatalogCourse | null>(null)

  const [assignmentType, setAssignmentType] = useState('Mandatory')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Reset on open so one assignment never leaks into the next.
  React.useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setLearnerQuery('')
      setSelectedLearners([])
      setCourseQuery('')
      setSelectedCourse(null)
      setAssignmentType('Mandatory')
      setDueDate('')
      setFormError(null)
    })
  }, [open])

  // Debounced so typing does not fire a request per keystroke.
  React.useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      assignmentPickerService
        .searchLearners(resolveContext(), learnerQuery)
        .then((response) => setLearners(response.data ?? []))
        .catch(() => setLearners([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [open, learnerQuery, resolveContext])

  React.useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      lmsCatalogService
        .getCourses(resolveContext(), { search: courseQuery || undefined, perPage: 20, status: 1 })
        .then((response) => setCourses(response.data ?? []))
        .catch(() => setCourses([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [open, courseQuery, resolveContext])

  if (!open) return null

  const toggleLearner = (learner: AssignmentLearner) =>
    setSelectedLearners((current) =>
      current.some((l) => l.id === learner.id)
        ? current.filter((l) => l.id !== learner.id)
        : [...current, learner],
    )

  const handleAssign = async () => {
    if (selectedLearners.length === 0) {
      setFormError('Select at least one learner.')
      return
    }
    if (!selectedCourse) {
      setFormError('Select a course.')
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      await assignmentService.createAssignments(resolveContext(), {
        user_ids: selectedLearners.map((l) => l.id),
        course_id: selectedCourse.id,
        assignment_type: assignmentType,
        due_date: dueDate || undefined,
      })
      onAssigned()
      onClose()
    } catch (assignError) {
      setFormError(
        assignError instanceof Error && assignError.message
          ? assignError.message
          : 'Failed to assign the course.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg p-6 mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-foreground">Assign Learning</h2>
          <Button variant="ghost" size="icon" className="size-8" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        {formError && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            {formError}
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-foreground">
              Select Learner(s) <span className="text-destructive">*</span>
            </label>
            <Input
              value={learnerQuery}
              onChange={(event) => setLearnerQuery(event.target.value)}
              placeholder="Search by name, employee no or email..."
              className="h-9"
            />
            {selectedLearners.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selectedLearners.map((learner) => (
                  <button
                    key={learner.id}
                    type="button"
                    onClick={() => toggleLearner(learner)}
                    className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
                  >
                    {learner.name} <X className="size-3" />
                  </button>
                ))}
              </div>
            )}
            <div className="max-h-32 overflow-y-auto rounded-lg border border-border/60">
              {learners.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">No learners found.</p>
              ) : (
                learners.map((learner) => (
                  <button
                    key={learner.id}
                    type="button"
                    onClick={() => toggleLearner(learner)}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-muted/40',
                      selectedLearners.some((l) => l.id === learner.id) && 'bg-primary/5',
                    )}
                  >
                    <span className="truncate font-medium text-foreground">{learner.name}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {learner.employee_no || learner.email}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-foreground">
              Select Course <span className="text-destructive">*</span>
            </label>
            <Input
              value={selectedCourse ? (selectedCourse.display_name ?? '') : courseQuery}
              onChange={(event) => {
                setSelectedCourse(null)
                setCourseQuery(event.target.value)
              }}
              placeholder="Search courses..."
              className="h-9"
            />
            {!selectedCourse && (
              <div className="max-h-32 overflow-y-auto rounded-lg border border-border/60">
                {courses.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">No courses found.</p>
                ) : (
                  courses.map((course) => (
                    <button
                      key={course.id}
                      type="button"
                      onClick={() => setSelectedCourse(course)}
                      className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-muted/40"
                    >
                      <span className="truncate font-medium text-foreground">
                        {course.display_name}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {course.subject_code || course.subject_type}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-foreground">Assignment Type</label>
              <Select
                options={[
                  { label: 'Mandatory', value: 'Mandatory' },
                  { label: 'Optional', value: 'Optional' },
                ]}
                value={assignmentType}
                onChange={(value) => setAssignmentType(String(value))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-foreground">Due Date</label>
              <Input
                type="date"
                className="h-9"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border/40">
          <Button variant="outline" className="font-bold" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button className="font-bold gap-2" onClick={() => void handleAssign()} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Assign
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Import Enrollments Modal
 * ------------------------------------------------------------------ */

/**
 * Import Enrollments.
 *
 * Posts a CSV to /api/lmsAssignment/import. The backend resolves learners by
 * employee_no / email / id and courses by code / name / id, and reports failures
 * per line — those are surfaced here rather than collapsed into one message.
 *
 * Strict by default: one bad row aborts the whole file. "Skip invalid rows"
 * imports the good ones instead.
 */
function ImportEnrollmentsDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean
  onClose: () => void
  onImported: () => void
}) {
  const { user } = useAuth()
  const resolveContext = React.useCallback(() => getLaravelContext(user), [user])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [skipInvalid, setSkipInvalid] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<ImportResult['errors']>([])

  React.useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setFile(null)
      setSkipInvalid(false)
      setResult(null)
      setImportError(null)
      setRowErrors([])
    })
  }, [open])

  if (!open) return null

  const handleUpload = async () => {
    if (!file) {
      setImportError('Choose a CSV file first.')
      return
    }

    setUploading(true)
    setImportError(null)
    setRowErrors([])
    setResult(null)

    try {
      const response = await assignmentPickerService.importCsv(resolveContext(), file, skipInvalid)
      setResult(response.data)
      setRowErrors(response.data?.errors ?? [])
      if ((response.data?.imported ?? 0) > 0) onImported()
    } catch (uploadError) {
      const apiError = uploadError as { message?: string; errors?: unknown }
      setImportError(apiError?.message || 'Failed to import the file.')

      // The 422 body carries the per-line failures; surface them verbatim.
      const detail = (uploadError as { data?: ImportResult })?.data
      if (detail?.errors) setRowErrors(detail.errors)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-foreground">Import Enrollments</h2>
          <Button variant="ghost" size="icon" className="size-8" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div
          className="border-2 border-dashed border-border/80 rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <FileUp className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-bold text-foreground">
            {file ? file.name : 'Click to upload a CSV file'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Columns: employee_no (or email), course_code (or course_name), due_date, type
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null)
              setResult(null)
              setImportError(null)
              setRowErrors([])
            }}
          />
        </div>

        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
          <input
            type="checkbox"
            checked={skipInvalid}
            onChange={(event) => setSkipInvalid(event.target.checked)}
          />
          Skip invalid rows and import the rest
        </label>

        {importError && (
          <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            {importError}
          </div>
        )}

        {result && (result.imported > 0 || result.skipped > 0) && (
          <div className="mt-3 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs font-medium text-success">
            {result.imported} imported
            {result.skipped > 0 ? `, ${result.skipped} skipped` : ''}.
          </div>
        )}

        {rowErrors.length > 0 && (
          <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-border/60">
            {rowErrors.map((rowError) => (
              <div
                key={rowError.line}
                className="flex gap-2 border-b border-border/40 px-3 py-1.5 text-[11px] last:border-b-0"
              >
                <span className="shrink-0 font-bold text-muted-foreground">Line {rowError.line}</span>
                <span className="text-foreground">{rowError.message}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border/40">
          <Button variant="outline" className="font-bold" onClick={onClose} disabled={uploading}>
            {result?.imported ? 'Done' : 'Cancel'}
          </Button>
          <Button
            className="font-bold gap-2"
            onClick={() => void handleUpload()}
            disabled={uploading || !file}
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
            Upload &amp; Import
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Main Component
 * ------------------------------------------------------------------ */

export function LearningAssignments() {
  const {
    loading,
    error,
    assignments,
    stats,
    filters,
    selectedIds,
    activeTab,
    setActiveTab,
    setSelectedIds,
    setFilter,
    applyFilters,
    resetFilters,
    setQuickFilter,
    handleBulkUpdate,
    handleSearch,
    retry,
  } = useAssignments()

  // The list endpoint returns the tenant's assignments in full, so paging is
  // applied here. "Rows per page" previously had no effect at all.
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)

  const pageCount = Math.max(1, Math.ceil(assignments.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pagedAssignments = assignments.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  )

  // Filtering or searching changes the result set, so snap back to page 1.
  React.useEffect(() => {
    queueMicrotask(() => setPage(1))
  }, [assignments.length, activeTab])

  const { user } = useAuth()
  const resolveContext = React.useCallback(() => getLaravelContext(user), [user])
  const canReview = user?.role === 'admin' || user?.role === 'hr'

  // The Approval Queue and Enrollments tabs are different entities from the
  // assignment queue, so each has its own feed rather than re-rendering the
  // same table (which is what all four tabs used to do).
  const [pending, setPending] = useState<LmsAssignment[]>([])
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([])
  const [tabLoading, setTabLoading] = useState(false)
  const [tabError, setTabError] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState(false)

  const loadTab = React.useCallback(async () => {
    if (activeTab !== 'approval' && activeTab !== 'enrollments') return

    setTabLoading(true)
    setTabError(null)

    try {
      const context = resolveContext()
      if (activeTab === 'approval') {
        const response = await assignmentApprovalService.getPending(context)
        setPending(response.data ?? [])
      } else {
        const response = await assignmentApprovalService.getEnrollments(context)
        setEnrollments(response.data ?? [])
      }
    } catch (loadError) {
      setTabError(
        loadError instanceof Error && loadError.message
          ? loadError.message
          : 'Failed to load this tab.',
      )
    } finally {
      setTabLoading(false)
    }
  }, [activeTab, resolveContext])

  React.useEffect(() => {
    queueMicrotask(() => {
      void loadTab()
    })
  }, [loadTab])

  const handleReview = async (ids: number[], decision: 'approved' | 'rejected') => {
    if (ids.length === 0) return
    setReviewing(true)
    try {
      await assignmentApprovalService.bulkReview(resolveContext(), ids, decision, user?.profileName)
      setSelectedIds([])
      await loadTab()
      retry() // stats + the live queue both change once a request is approved.
    } catch (reviewError) {
      setTabError(
        reviewError instanceof Error && reviewError.message
          ? reviewError.message
          : 'Failed to record the decision.',
      )
    } finally {
      setReviewing(false)
    }
  }

  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showFilterSidebar, setShowFilterSidebar] = useState(true)

  // Debounced search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setFilter('search', value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => handleSearch(value), 400)
  }

  /* ---------------------------------------------------------------- *
   * Table columns
   * ---------------------------------------------------------------- */

  /** Approval queue: who asked for what, and the decision buttons. */
  const approvalColumns: Column<LmsAssignment>[] = [
    {
      id: 'learner_name',
      header: 'Learner',
      render: (_, row) => (
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
            {row.initials}
          </span>
          <span className="truncate text-sm font-semibold text-foreground">{row.learner_name}</span>
        </div>
      ),
    },
    { id: 'course_name', header: 'Course' },
    { id: 'assignment_type', header: 'Type' },
    {
      id: 'due_date',
      header: 'Requested Due',
      render: (val) => (val ? String(val) : '—'),
    },
    {
      id: 'id',
      header: '',
      render: (_, row) =>
        canReview ? (
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              className="h-7 font-bold"
              disabled={reviewing}
              onClick={() => void handleReview([row.id], 'approved')}
            >
              Approve
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 font-bold text-destructive border-destructive/20"
              disabled={reviewing}
              onClick={() => void handleReview([row.id], 'rejected')}
            >
              Reject
            </Button>
          </div>
        ) : null,
    },
  ]

  /** Enrollments: learner-initiated, so it shows enrolment dates not progress. */
  const enrollmentColumns: Column<CourseEnrollment>[] = [
    {
      id: 'learner_name',
      header: 'Learner',
      render: (_, row) => (
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
            {row.initials}
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-foreground">
              {row.learner_name}
            </span>
            {row.employee_no && (
              <span className="text-[11px] text-muted-foreground">{row.employee_no}</span>
            )}
          </div>
        </div>
      ),
    },
    { id: 'course_name', header: 'Course' },
    { id: 'type', header: 'Type', render: (val) => (val ? String(val) : '—') },
    {
      id: 'status',
      header: 'Status',
      render: (val) => (
        <StatusBadge
          variant={val === 'completed' ? 'success' : val === 'in-progress' ? 'processing' : 'inactive'}
          className="text-[10px] font-bold uppercase tracking-wider"
        >
          {String(val ?? '—')}
        </StatusBadge>
      ),
    },
    { id: 'start_date', header: 'Start', render: (val) => (val ? String(val) : '—') },
    { id: 'end_date', header: 'Due', render: (val) => (val ? String(val) : '—') },
  ]

  const columns: Column<LmsAssignment>[] = [
    {
      id: 'learner_name',
      header: 'Learner / Group',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0 border border-border/50">
            {row.learner_name?.substring(0, 2).toUpperCase() || 'U'}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-foreground leading-snug">{row.learner_name}</span>
          </div>
        </div>
      ),
    },
    {
      id: 'course_name',
      header: 'Course / Learning Path',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <MonitorPlay className="size-4 text-muted-foreground shrink-0" />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-foreground leading-snug">{row.course_name}</span>
            <span className="text-xs text-muted-foreground">{row.type}</span>
          </div>
        </div>
      ),
    },
    {
      id: 'assignment_type',
      header: 'Assignment Type',
      render: (_, row) => (
        <StatusBadge variant={row.assignment_type === 'Mandatory' ? 'error' : 'active'} className="bg-opacity-10 shadow-none border-none">
          {row.assignment_type}
        </StatusBadge>
      ),
    },
    {
      id: 'due_date',
      header: 'Due Date ↓',
      render: (_, row) => {
        const isOverdue = row.due_date && new Date(row.due_date) < new Date()
        const daysLeft = row.due_date
          ? Math.ceil((new Date(row.due_date).getTime() - Date.now()) / 86400000)
          : null
        return (
          <div className="flex flex-col">
            <span className="text-sm font-bold text-foreground leading-snug">
              {row.due_date
                ? new Date(row.due_date).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : '-'}
            </span>
            <span
              className={cn(
                'text-xs font-semibold',
                isOverdue ? 'text-destructive' : 'text-warning',
              )}
            >
              {isOverdue
                ? 'Overdue'
                : daysLeft != null && daysLeft >= 0
                  ? `${daysLeft} days left`
                  : ''}
            </span>
          </div>
        )
      },
    },
    {
      id: 'status',
      header: 'Status',
      render: (val) => {
        const v = val as string
        let variant: 'default' | 'error' | 'processing' | 'inactive' | 'active' = 'default'
        if (v === 'Overdue') variant = 'error'
        if (v === 'In Progress') variant = 'processing'
        if (v === 'Not Started') variant = 'inactive'
        if (v === 'Completed') variant = 'active'

        return (
          <StatusBadge variant={variant} className="bg-opacity-10 shadow-none border-none">
            {v}
          </StatusBadge>
        )
      },
    },
    {
      id: 'progress',
      header: 'Progress',
      render: (val) => (
        <div className="flex items-center gap-2 w-full max-w-[100px]">
          <span className="text-xs font-bold w-8">{val}%</span>
          <Progress value={val as number} className="h-1.5 flex-1" />
        </div>
      ),
    },
    {
      id: 'assigned_by',
      header: 'Assigned By',
      render: (val) => <span className="text-sm font-medium">{val as string}</span>,
    },
    {
      id: 'assigned_on',
      header: 'Assigned On',
      render: (_, row) => (
        <span className="text-sm font-medium">
          {row.assigned_on
            ? new Date(row.assigned_on).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : '-'}
        </span>
      ),
    },
    {
      id: 'id',
      header: '',
      render: () => (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
          <MoreVertical className="size-4" />
        </Button>
      ),
    },
  ]

  /* ---------------------------------------------------------------- *
   * Quick filter badges - derive active state from hook
   * ---------------------------------------------------------------- */

  const quickFilterBadges = [
    { key: 'Overdue', label: 'Overdue', dotClass: 'bg-destructive', badgeClass: 'bg-destructive/5 text-destructive border-destructive/20 hover:bg-destructive/10' },
    { key: 'Due Today', label: 'Due Today', dotClass: 'bg-warning', badgeClass: 'bg-warning/5 text-warning border-warning/20 hover:bg-warning/10' },
    { key: 'Due This Week', label: 'Due This Week', dotClass: 'bg-primary', badgeClass: 'bg-primary/5 text-primary border-primary/20 hover:bg-primary/10' },
    { key: 'Not Started', label: 'Not Started', dotClass: 'bg-muted-foreground/40', badgeClass: 'bg-secondary text-foreground hover:bg-secondary/80' },
    { key: 'In Progress', label: 'In Progress', dotClass: 'bg-muted-foreground/50', badgeClass: 'bg-muted text-muted-foreground hover:bg-muted/80' },
    { key: 'Completed', label: 'Completed', dotClass: 'bg-success/50', badgeClass: 'bg-muted text-muted-foreground hover:bg-muted/80' },
  ]

  /* ---------------------------------------------------------------- *
   * Error state
   * ---------------------------------------------------------------- */

  if (error && !loading && assignments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle className="size-12 text-destructive" />
        <p className="text-lg font-bold text-foreground">Failed to load assignments</p>
        <p className="text-sm text-muted-foreground max-w-md text-center">{error}</p>
        <Button className="font-bold gap-2" onClick={retry}>
          <RefreshCw className="size-4" /> Try Again
        </Button>
      </div>
    )
  }

  /* ---------------------------------------------------------------- *
   * Render
   * ---------------------------------------------------------------- */

  return (
    <div className="flex flex-col w-full bg-background pb-12">
      {/* Modals */}
      <AssignLearningDialog
        open={showAssignDialog}
        onClose={() => setShowAssignDialog(false)}
        onAssigned={retry}
      />
      <ImportEnrollmentsDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImported={retry}
      />

      {/* Top Navigation & Actions */}
      <div className="flex items-center justify-between pb-4 border-b border-border/60 mb-6 shrink-0">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Learning Assignment & Enrollment</h1>
          <p className="text-sm text-muted-foreground font-medium mt-0.5">Assign courses, enroll learners, and manage enrollment approvals.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              className="w-72 pl-9 h-9"
              placeholder="Search courses, learners, groups..."
              value={filters.search}
              onChange={onSearchChange}
            />
          </div>
          <div className="flex items-center gap-3 border-l border-border/60 pl-4">
            <Button
              variant="outline"
              className="font-semibold gap-2 shadow-sm"
              onClick={() => setShowImportDialog(true)}
            >
              <FileUp className="size-4" /> Import Enrollments
            </Button>
            <div className="flex rounded-md shadow-sm">
              <Button
                className="rounded-r-none font-semibold gap-2 border-r border-primary-foreground/20"
                onClick={() => setShowAssignDialog(true)}
              >
                <Plus className="size-4" /> Assign Learning
              </Button>
              <Button
                className="rounded-l-none px-2 shrink-0"
                onClick={() => setShowAssignDialog(true)}
              >
                <ChevronDown className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6 shrink-0">
        <Card className="shadow-sm border-border/80 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setQuickFilter('')}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Users className="size-5 text-muted-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Assigned</span>
              <span className="text-2xl font-black tracking-tight text-foreground">{loading ? '—' : (stats?.total_assigned ?? 0).toLocaleString()}</span>
              <span className="text-xs text-muted-foreground font-medium">Users</span>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border/80 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setQuickFilter('')}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Clock className="size-5 text-muted-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pending Approval</span>
              <span className="text-2xl font-black tracking-tight text-foreground">{loading ? '—' : (stats?.pending_approval ?? 0).toLocaleString()}</span>
              <span className="text-xs text-muted-foreground font-medium">Requests</span>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border/80 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setQuickFilter('In Progress')}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <PlayCircle className="size-5 text-muted-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">In Progress</span>
              <span className="text-2xl font-black tracking-tight text-foreground">{loading ? '—' : (stats?.in_progress ?? 0).toLocaleString()}</span>
              <span className="text-xs text-muted-foreground font-medium">Enrollments</span>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border/80 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setQuickFilter('Completed')}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <CheckCircle2 className="size-5 text-muted-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Completed</span>
              <span className="text-2xl font-black tracking-tight text-foreground">{loading ? '—' : (stats?.completed ?? 0).toLocaleString()}</span>
              <span className="text-xs text-muted-foreground font-medium">Enrollments</span>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border/80 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setQuickFilter('Overdue')}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <CalendarDays className="size-5 text-muted-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Overdue</span>
              <span className="text-2xl font-black tracking-tight text-foreground">{loading ? '—' : (stats?.overdue ?? 0).toLocaleString()}</span>
              <span className="text-xs text-muted-foreground font-medium">Enrollments</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-border/60 mb-4 shrink-0">
        {[
          { id: 'queue', label: 'Assignment Queue' },
          { id: 'enrollments', label: 'Enrollments' },
          { id: 'approval', label: 'Approval Queue', badge: stats?.pending_approval },
          { id: 'bulk', label: 'Bulk Operations' },
        ].map((tab) => (
          <div
            key={tab.id}
            className={cn(
              'pb-3 cursor-pointer text-sm font-bold flex items-center gap-2 border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none',
                  activeTab === tab.id
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {tab.badge}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Main Content Area (Table + Filters Sidebar) */}
      <div className="flex flex-col xl:flex-row gap-6 items-stretch">
        {/* Table Area */}
        <div className="flex-1 flex flex-col w-full min-w-0">
          {/* Table Actions Bar */}
          <div className="flex items-center justify-between mb-4 shrink-0">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'gap-2 h-8 font-bold',
                  showFilterSidebar
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-primary/5 border-primary/20 text-primary',
                )}
                onClick={() => setShowFilterSidebar(!showFilterSidebar)}
              >
                <Filter className="size-3.5" /> Filter
              </Button>
              {selectedIds.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">
                    {selectedIds.length} item{selectedIds.length > 1 ? 's' : ''} selected
                  </span>
                  <span
                    className="text-sm font-semibold text-primary cursor-pointer hover:underline"
                    onClick={() => setSelectedIds([])}
                  >
                    Clear
                  </span>
                </div>
              )}
              {filters.quickFilter && (
                <Badge
                  variant="outline"
                  className="gap-1 font-semibold bg-primary/5 text-primary border-primary/20 cursor-pointer"
                  onClick={() => setQuickFilter('')}
                >
                  {filters.quickFilter} <X className="size-3" />
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 font-bold bg-background shadow-sm"
                disabled={selectedIds.length === 0}
                onClick={() => setShowAssignDialog(true)}
              >
                Assign
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 font-bold bg-background shadow-sm"
                disabled={selectedIds.length === 0}
                onClick={() => handleBulkUpdate('In Progress')}
              >
                Enroll
              </Button>
              {/*
                These previously called handleBulkUpdate('Completed') and
                ('Rejected') - which set progress status, not an approval, and
                'Rejected' was not even a valid progress value. Approvals now go
                to the review endpoint, and the buttons only appear where an
                approval decision actually applies.
              */}
              {activeTab === 'approval' && canReview && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 font-bold bg-background shadow-sm"
                    disabled={selectedIds.length === 0 || reviewing}
                    onClick={() => void handleReview(selectedIds.map(Number), 'approved')}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 font-bold bg-background shadow-sm text-destructive hover:bg-destructive hover:text-destructive-foreground border-destructive/20"
                    disabled={selectedIds.length === 0 || reviewing}
                    onClick={() => void handleReview(selectedIds.map(Number), 'rejected')}
                  >
                    Reject
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-8 font-bold bg-background shadow-sm gap-2 ml-2"
                disabled={selectedIds.length === 0}
              >
                More <ChevronDown className="size-3" />
              </Button>
            </div>
          </div>

          {/* Data Table */}
          {tabError && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive">
              {tabError}
            </div>
          )}

          {/* Approval Queue — learner-requested enrolments awaiting a decision. */}
          {activeTab === 'approval' && (
            <div className="rounded-xl border border-border/80 shadow-sm bg-card overflow-hidden">
              {canReview && pending.length > 0 && (
                <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-4 py-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {selectedIds.length} selected
                  </span>
                  <Button
                    size="sm"
                    className="h-7 font-bold"
                    disabled={selectedIds.length === 0 || reviewing}
                    onClick={() => void handleReview(selectedIds.map(Number), 'approved')}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 font-bold text-destructive border-destructive/20"
                    disabled={selectedIds.length === 0 || reviewing}
                    onClick={() => void handleReview(selectedIds.map(Number), 'rejected')}
                  >
                    Reject
                  </Button>
                  {reviewing && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                </div>
              )}
              <DataTable
                columns={approvalColumns}
                data={pending}
                isLoading={tabLoading}
                selectable={canReview}
                selectedIds={selectedIds}
                onSelectChange={setSelectedIds}
                emptyState={
                  <p className="py-4 text-muted-foreground font-medium">
                    No enrolment requests awaiting approval.
                  </p>
                }
                className="border-0 shadow-none rounded-none [&_th]:normal-case [&_th]:text-[13px] [&_th]:text-foreground [&_th]:font-bold"
              />
            </div>
          )}

          {/* Enrollments — what learners took up themselves (lms_course_enroll). */}
          {activeTab === 'enrollments' && (
            <div className="rounded-xl border border-border/80 shadow-sm bg-card overflow-hidden">
              <DataTable
                columns={enrollmentColumns}
                data={enrollments}
                isLoading={tabLoading}
                emptyState={
                  <p className="py-4 text-muted-foreground font-medium">No enrolments yet.</p>
                }
                className="border-0 shadow-none rounded-none [&_th]:normal-case [&_th]:text-[13px] [&_th]:text-foreground [&_th]:font-bold"
              />
            </div>
          )}

          {/* Bulk Operations — the actions that work on many rows at once. */}
          {activeTab === 'bulk' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="rounded-xl border-border/80 shadow-sm">
                <CardContent className="flex flex-col gap-3 p-5">
                  <h3 className="text-sm font-bold text-foreground">Import enrolments</h3>
                  <p className="text-xs text-muted-foreground">
                    Upload a CSV of learners and courses. Rows are matched by employee number,
                    email or id, and every failure is reported with its line number.
                  </p>
                  <Button className="gap-2 self-start" onClick={() => setShowImportDialog(true)}>
                    <FileUp className="size-4" /> Import CSV
                  </Button>
                </CardContent>
              </Card>

              <Card className="rounded-xl border-border/80 shadow-sm">
                <CardContent className="flex flex-col gap-3 p-5">
                  <h3 className="text-sm font-bold text-foreground">Assign to many learners</h3>
                  <p className="text-xs text-muted-foreground">
                    Pick several learners and one course to create assignments in a single step.
                  </p>
                  <Button className="gap-2 self-start" onClick={() => setShowAssignDialog(true)}>
                    <UserPlus className="size-4" /> Assign learning
                  </Button>
                </CardContent>
              </Card>

              <Card className="rounded-xl border-border/80 shadow-sm sm:col-span-2">
                <CardContent className="flex flex-col gap-3 p-5">
                  <h3 className="text-sm font-bold text-foreground">Bulk status update</h3>
                  <p className="text-xs text-muted-foreground">
                    Select rows on the Assignment Queue tab, then set them all to the same
                    progress status. {selectedIds.length} row(s) currently selected.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(['Not Started', 'In Progress', 'Completed'] as const).map((status) => (
                      <Button
                        key={status}
                        variant="outline"
                        size="sm"
                        className="font-bold"
                        disabled={selectedIds.length === 0}
                        onClick={() => handleBulkUpdate(status)}
                      >
                        Mark {status}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div
            className={cn(
              'rounded-xl border border-border/80 shadow-sm bg-card overflow-hidden relative',
              activeTab !== 'queue' && 'hidden',
            )}
          >
            <DataTable
              columns={columns}
              data={pagedAssignments}
              isLoading={loading}
              selectable={true}
              selectedIds={selectedIds}
              onSelectChange={setSelectedIds}
              emptyState={
                <div className="flex flex-col items-center gap-2 py-4">
                  <p className="text-muted-foreground font-medium">No assignments found</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-bold gap-2"
                    onClick={() => setShowAssignDialog(true)}
                  >
                    <Plus className="size-4" /> Create Assignment
                  </Button>
                </div>
              }
              className="border-0 shadow-none rounded-none [&_th]:normal-case [&_th]:text-[13px] [&_th]:text-foreground [&_th]:font-bold"
            />
          </div>

          {/* Pagination — only the Assignment Queue is paged. */}
          <div
            className={cn(
              'flex items-center justify-between mt-4 text-sm text-muted-foreground font-medium shrink-0',
              activeTab !== 'queue' && 'hidden',
            )}
          >
            <span>
              {assignments.length === 0
                ? 'No results'
                : `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, assignments.length)} of ${assignments.length}`}
            </span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <Select
                  options={[
                    { label: '10', value: '10' },
                    { label: '25', value: '25' },
                    { label: '50', value: '50' },
                  ]}
                  value={String(pageSize)}
                  onChange={(value) => {
                    setPageSize(Number(value))
                    setPage(1)
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="tabular-nums">
                  {currentPage} / {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>

          {/* Bottom Feature Cards */}
          <Card className="shadow-sm border-border/80 bg-card mt-6 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border/60 overflow-hidden">
            <div
              className="flex-1 flex items-start gap-5 p-8 hover:bg-muted/5 transition-colors cursor-pointer group"
              onClick={() => setShowAssignDialog(true)}
            >
              <div className="size-12 rounded-full bg-muted/40 flex items-center justify-center shrink-0">
                <UserPlus className="size-5 text-foreground/70" />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-foreground">Assign to Individuals or Groups</span>
                <span className="text-[13px] text-muted-foreground leading-snug">Assign learning to employees, teams, or departments.</span>
                <span className="text-sm font-bold text-primary mt-2 flex items-center gap-1 group-hover:underline">
                  Assign Now <ChevronRight className="size-4" />
                </span>
              </div>
            </div>

            <div
              className="flex-1 flex items-start gap-5 p-8 hover:bg-muted/5 transition-colors cursor-pointer group"
              onClick={() => setActiveTab('approval')}
            >
              <div className="size-12 rounded-full bg-muted/40 flex items-center justify-center shrink-0">
                <Mail className="size-5 text-foreground/70" />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-foreground">Pending Approvals</span>
                <span className="text-[13px] text-muted-foreground leading-snug">Review and act on learner enrollment requests.</span>
                <span className="text-sm font-bold text-primary mt-2 flex items-center gap-1 group-hover:underline">
                  View Approvals <ChevronRight className="size-4" />
                </span>
              </div>
            </div>

            <div
              className="flex-1 flex items-start gap-5 p-8 hover:bg-muted/5 transition-colors cursor-pointer group"
              onClick={() => setShowImportDialog(true)}
            >
              <div className="size-12 rounded-full bg-muted/40 flex items-center justify-center shrink-0">
                <FileUp className="size-5 text-foreground/70" />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-foreground">Bulk Operations</span>
                <span className="text-[13px] text-muted-foreground leading-snug">Upload CSV to assign or enroll multiple learners.</span>
                <span className="text-sm font-bold text-primary mt-2 flex items-center gap-1 group-hover:underline">
                  Upload CSV <ChevronRight className="size-4" />
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters Sidebar */}
        {showFilterSidebar && (
          <div className="w-full xl:w-[320px] shrink-0 flex flex-col bg-card rounded-xl border border-border/80 shadow-sm">
            <div className="p-4 border-b border-border/40 flex items-center justify-between">
              <h3 className="font-bold text-foreground">Filters</h3>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground"
                onClick={() => setShowFilterSidebar(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="p-5 flex flex-col gap-6 flex-1">
              <div className="space-y-3">
                <label className="text-sm font-bold text-foreground">Quick Filters</label>
                <div className="flex flex-wrap gap-2">
                  {quickFilterBadges.map((badge) => (
                    <Badge
                      key={badge.key}
                      variant="outline"
                      className={cn(
                        'font-semibold gap-1.5 cursor-pointer rounded-full px-3 py-1',
                        filters.quickFilter === badge.key
                          ? 'bg-primary/15 text-primary border-primary/40 ring-1 ring-primary/20'
                          : badge.badgeClass,
                      )}
                      onClick={() => setQuickFilter(badge.key)}
                    >
                      <div className={cn('size-1.5 rounded-full', badge.dotClass)} />
                      {badge.label}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Assignment Type</label>
                <Select
                  options={[
                    { label: 'All', value: 'All' },
                    { label: 'Mandatory', value: 'Mandatory' },
                    { label: 'Optional', value: 'Optional' },
                  ]}
                  value={filters.assignmentType}
                  onChange={(val) => setFilter('assignmentType', val)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Learning Type</label>
                <Select
                  options={[
                    { label: 'All', value: 'All' },
                    { label: 'Course', value: 'Course' },
                    { label: 'Learning Path', value: 'Learning Path' },
                  ]}
                  value={filters.learningType}
                  onChange={(val) => setFilter('learningType', val)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</label>
                <Select
                  options={[
                    { label: 'All', value: 'All' },
                    { label: 'Not Started', value: 'Not Started' },
                    { label: 'In Progress', value: 'In Progress' },
                    { label: 'Completed', value: 'Completed' },
                    { label: 'Overdue', value: 'Overdue' },
                  ]}
                  value={filters.status}
                  onChange={(val) => setFilter('status', val)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Department</label>
                <Select
                  options={[{ label: 'All', value: 'All' }]}
                  value={filters.department}
                  onChange={(val) => setFilter('department', val)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Due Date</label>
                <Input
                  type="date"
                  className="h-9 text-muted-foreground"
                  value={filters.dueDate}
                  onChange={(e) => setFilter('dueDate', e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Assigned By</label>
                <Select
                  options={[{ label: 'All', value: 'All' }]}
                  value={filters.assignedBy}
                  onChange={(val) => setFilter('assignedBy', val)}
                />
              </div>
            </div>
            <div className="p-5 pt-0 flex items-center justify-between mt-auto">
              <Button variant="outline" className="font-bold shadow-sm rounded-full px-6" onClick={resetFilters}>
                Reset
              </Button>
              <Button className="font-bold shadow-sm px-8 rounded-full" onClick={applyFilters}>
                Apply Filters
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
