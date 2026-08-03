'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  Info,
  Search,
  Filter,
  MoreVertical,
  Target,
  Route,
  FileText,
  Plus,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  BookOpen,
  ClipboardList,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  History,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { useCompetencyFocus } from '@/hooks/use-competency-focus'
import { CompetencyFocusBanner } from './competency-focus-banner'
import { ErrorState } from '@/components/ui/error-state'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  useCareerExplorer,
  useCareerPathDetail,
  useCareerPaths,
  useCourseOptions,
  useDevelopmentPlans,
  useLearningAssignments,
  usePlanDetail,
  usePlanMetrics,
  useRoleOptions,
  useWorkspaceLookups,
} from '@/hooks/use-development-career'
import type {
  CareerPathPayload,
  CareerPathSummary,
  DevelopmentPlan,
  DevelopmentPlanDetail,
  DevelopmentPlanPayload,
  EmployeeOption,
  ExplorerNode,
  LearningAssignment,
  PlanAction,
  PlanActionPayload,
  PlanSortField,
} from '@/services/competency'

/* ------------------------------------------------------------------ *
 * Option maps - values are the raw ones the Laravel API filters on
 * ------------------------------------------------------------------ */

const TAB_PLANS = 'development'
const TAB_CAREER = 'career'
const TAB_LEARNING = 'learning'

const TABS = [
  { id: TAB_PLANS, label: 'Development Plans' },
  { id: TAB_CAREER, label: 'Career Paths' },
  { id: TAB_LEARNING, label: 'Learning Assignments' },
]

const PLAN_TAB_OVERVIEW = 'overview'
const PLAN_TAB_GAPS = 'gaps'
const PLAN_TAB_ACTIONS = 'actions'
const PLAN_TAB_HISTORY = 'history'

const PLAN_TABS = [
  { id: PLAN_TAB_OVERVIEW, label: 'Plan Overview' },
  { id: PLAN_TAB_GAPS, label: 'Competency Gaps' },
  { id: PLAN_TAB_ACTIONS, label: 'Actions' },
  { id: PLAN_TAB_HISTORY, label: 'Notes & History' },
]

/** s_competency_development_plans.status */
const PLAN_STATUS_OPTIONS = [
  { label: 'Status: All', value: 'all' },
  { label: 'In Progress', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'On Hold', value: 'on_hold' },
]

const PLAN_STATUS_FORM_OPTIONS = [
  { label: 'In Progress', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'On Hold', value: 'on_hold' },
]

const ACTION_TYPE_OPTIONS = [
  { label: 'Milestone', value: 'milestone' },
  { label: 'Training', value: 'training' },
  { label: 'Mentoring', value: 'mentoring' },
  { label: 'Project', value: 'project' },
  { label: 'Reading', value: 'reading' },
  { label: 'Other', value: 'other' },
]

const ACTION_STATUS_OPTIONS = [
  { label: 'Pending', value: 'pending' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Blocked', value: 'blocked' },
]

const LEARNING_STATUS_OPTIONS = [
  { label: 'Status: All', value: 'all' },
  { label: 'Not Started', value: 'Not Started' },
  { label: 'In Progress', value: 'In Progress' },
  { label: 'Completed', value: 'Completed' },
  { label: 'Overdue', value: 'Overdue' },
]

const LEARNING_TYPE_OPTIONS = [
  { label: 'Mandatory', value: 'Mandatory' },
  { label: 'Optional', value: 'Optional' },
  { label: 'Recommended', value: 'Recommended' },
]

const CAREER_PATH_STATUS_OPTIONS = [
  { label: 'Draft', value: 'draft' },
  { label: 'Active', value: 'active' },
  { label: 'Archived', value: 'archived' },
]

const PER_PAGE_OPTIONS = [
  { label: '10 / page', value: '10' },
  { label: '25 / page', value: '25' },
  { label: '50 / page', value: '50' },
]

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function dash(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim()
  return trimmed === '' ? '—' : trimmed
}

function planStatusVariant(status: string): 'success' | 'error' | 'pending' | 'processing' {
  if (status === 'completed') return 'success'
  if (status === 'overdue') return 'error'
  if (status === 'on_hold') return 'pending'
  return 'processing'
}

function learningStatusVariant(status: string): 'success' | 'error' | 'default' | 'processing' {
  if (status === 'Completed') return 'success'
  if (status === 'Overdue') return 'error'
  if (status === 'In Progress') return 'processing'
  return 'default'
}

function actionStatusVariant(status: string): 'success' | 'error' | 'pending' | 'processing' {
  if (status === 'completed') return 'success'
  if (status === 'blocked') return 'error'
  if (status === 'in_progress') return 'processing'
  return 'pending'
}

function actionStatusLabel(status: string): string {
  return ACTION_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status
}

/** Windowed page list with ellipsis for the pager. */
function pageWindow(current: number, last: number): (number | 'gap')[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1)
  const pages: (number | 'gap')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(last - 1, current + 1)
  if (start > 2) pages.push('gap')
  for (let p = start; p <= end; p++) pages.push(p)
  if (end < last - 1) pages.push('gap')
  pages.push(last)
  return pages
}

/* ------------------------------------------------------------------ *
 * Small presentational pieces
 * ------------------------------------------------------------------ */

function DeltaLabel({ value }: { value: number }) {
  if (!value) {
    return <p className="text-xs font-semibold text-muted-foreground mb-0.5">no change vs last month</p>
  }
  const up = value > 0
  return (
    <p className={cn('text-xs font-semibold mb-0.5', up ? 'text-success' : 'text-destructive')}>
      {up ? '↗' : '↘'} {Math.abs(value)} vs last month
    </p>
  )
}

function KpiCard({
  icon,
  tone,
  label,
  value,
  delta,
  loading,
}: {
  icon: React.ReactNode
  tone: 'primary' | 'success' | 'warning'
  label: string
  value: number
  delta: number
  loading: boolean
}) {
  const toneClasses =
    tone === 'success'
      ? 'bg-success/10 text-success'
      : tone === 'warning'
        ? 'bg-warning/10 text-warning'
        : 'bg-primary/10 text-primary'

  return (
    <Card className="shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-2">
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', toneClasses)}>{icon}</div>
          {!loading && (delta >= 0 ? <TrendingUp className="w-4 h-4 text-success" /> : <TrendingDown className="w-4 h-4 text-destructive" />)}
        </div>
        <p className="text-sm font-semibold text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="h-7 w-20 mt-1" />
        ) : (
          <div className="flex items-end gap-2 mt-1">
            <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
            <DeltaLabel value={delta} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ProgressCell({ progress }: { progress: number }) {
  return (
    <div className="flex items-center gap-2 w-full max-w-[120px]">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full', progress >= 100 ? 'bg-success' : 'bg-primary')}
          style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
        />
      </div>
      <span className="text-[10px] font-bold w-7 text-right">{progress}%</span>
    </div>
  )
}

function Avatar({ initials, tone = 'primary' }: { initials: string | null; tone?: 'primary' | 'secondary' }) {
  return (
    <div
      className={cn(
        'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
        tone === 'primary'
          ? 'bg-primary/10 text-primary'
          : 'bg-secondary text-secondary-foreground border border-border',
      )}
    >
      {initials || '—'}
    </div>
  )
}

function SortableHead({
  label,
  field,
  activeField,
  direction,
  onSort,
  className,
}: {
  label: string
  field: PlanSortField
  activeField: PlanSortField
  direction: 'asc' | 'desc'
  onSort: (field: PlanSortField) => void
  className?: string
}) {
  const active = activeField === field
  return (
    <TableHead className={cn('px-4 py-3 font-bold text-foreground', className)}>
      <button type="button" onClick={() => onSort(field)} className="inline-flex items-center gap-1 hover:text-primary transition-colors">
        {label}
        {active ? (
          direction === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
        )}
      </button>
    </TableHead>
  )
}

function TableSkeleton({ columns, rows = 6 }: { columns: number; rows?: number }) {
  return (
    <TableBody>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={rowIndex} className="hover:bg-transparent">
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <TableCell key={columnIndex} className="px-4 py-4">
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  )
}

function Pager({
  page,
  lastPage,
  total,
  count,
  perPage,
  onPage,
  onPerPage,
  noun,
}: {
  page: number
  lastPage: number
  total: number
  count: number
  perPage: number
  onPage: (page: number) => void
  onPerPage: (perPage: number) => void
  noun: string
}) {
  const from = total === 0 ? 0 : (page - 1) * perPage + 1
  const to = total === 0 ? 0 : from + count - 1

  return (
    <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-card shrink-0">
      <div className="flex items-center gap-3">
        <span>
          Showing {from} to {to} of {total} {noun}
        </span>
        <Select
          value={String(perPage)}
          onChange={(value) => onPerPage(Number(value))}
          options={PER_PAGE_OPTIONS}
          className="h-7 w-28 bg-background"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        {pageWindow(page, Math.max(lastPage, 1)).map((entry, index) =>
          entry === 'gap' ? (
            <span key={`gap-${index}`} className="px-1">
              …
            </span>
          ) : (
            <Button
              key={entry}
              variant="outline"
              size="sm"
              className={cn('h-7 min-w-7 p-0 px-1', entry === page && 'bg-primary text-primary-foreground border-primary')}
              onClick={() => onPage(entry)}
            >
              {entry}
            </Button>
          ),
        )}
        <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= lastPage} onClick={() => onPage(page + 1)}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Development plan create / edit dialog
 * ------------------------------------------------------------------ */

/**
 * Editing from the detail panel passes the full DevelopmentPlanDetail, which
 * carries objective / focus_areas; editing from a table row only has the list
 * shape. Both are accepted so the form pre-fills whatever is available.
 */
type EditablePlan = DevelopmentPlan & Partial<Pick<DevelopmentPlanDetail, 'objective' | 'focus_areas'>>

interface PlanFormProps {
  initial: EditablePlan | null
  employees: EmployeeOption[]
  owners: { value: string; label: string }[]
  departments: { value: string; label: string }[]
  careerPaths: CareerPathSummary[]
  saving: boolean
  onSubmit: (payload: DevelopmentPlanPayload) => Promise<{ ok: boolean; message: string }>
  onCancel: () => void
  onSaved: () => void
}

function PlanForm({ initial, employees, owners, departments, careerPaths, saving, onSubmit, onCancel, onSaved }: PlanFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [employeeId, setEmployeeId] = useState(initial?.user_id ? String(initial.user_id) : '')
  const [ownerId, setOwnerId] = useState(initial?.approver_id ? String(initial.approver_id) : '')
  const [departmentId, setDepartmentId] = useState(initial?.department_id ? String(initial.department_id) : '')
  const [careerPathId, setCareerPathId] = useState(initial?.career_path_id ? String(initial.career_path_id) : '')
  const [status, setStatus] = useState(initial?.status ?? 'active')
  const [startDate, setStartDate] = useState(initial?.start_date ?? '')
  const [dueDate, setDueDate] = useState(initial?.due_date ?? '')
  const [objective, setObjective] = useState(initial?.objective ?? '')
  const [focusAreas, setFocusAreas] = useState((initial?.focus_areas ?? []).join(', '))
  const [error, setError] = useState<string | null>(null)

  // The employee's own job role travels with the plan so gaps can be computed.
  const selectedEmployee = employees.find((employee) => String(employee.id) === employeeId)

  const employeeOptions = useMemo(
    () => [
      { label: 'Select employee', value: '' },
      ...employees.map((employee) => ({
        label: employee.jobrole ? `${employee.name} — ${employee.jobrole}` : employee.name,
        value: String(employee.id),
      })),
    ],
    [employees],
  )

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Plan name is required.')
      return
    }
    if (!employeeId) {
      setError('Select the employee this plan is for.')
      return
    }
    setError(null)

    const editing = initial !== null
    const parsedFocusAreas = focusAreas.split(',').map((area) => area.trim()).filter(Boolean)

    const payload: DevelopmentPlanPayload = {
      title: title.trim(),
      user_id_target: employeeId,
      status: status as DevelopmentPlanPayload['status'],
      ...(selectedEmployee?.jobrole ? { jobrole: selectedEmployee.jobrole } : {}),
      ...(departmentId ? { department_id: departmentId } : {}),
      ...(ownerId ? { approver_id: ownerId } : {}),
      ...(careerPathId ? { career_path_id: careerPathId } : {}),
      ...(startDate ? { start_date: startDate } : {}),
      ...(dueDate ? { due_date: dueDate } : {}),
      // When editing, these are sent even if emptied so the user can clear
      // them; on create an omitted key just leaves the column null.
      ...(editing || objective.trim() ? { objective: objective.trim() } : {}),
      ...(editing || parsedFocusAreas.length ? { focus_areas: parsedFocusAreas } : {}),
    }

    const result = await onSubmit(payload)
    if (result.ok) onSaved()
    else setError(result.message)
  }

  return (
    <>
      <DialogHeader className="p-6 pb-4 border-b border-primary/10 m-0">
        <DialogTitle className="text-xl font-bold text-foreground">
          {initial ? 'Edit Development Plan' : 'Create Development Plan'}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {initial ? 'Update this development plan.' : 'Create a development plan for an employee.'}
        </DialogDescription>
      </DialogHeader>

      <div className="p-6 flex flex-col gap-5 max-h-[70vh] overflow-y-auto g2g-scrollbar">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">
            Plan Name<span className="text-destructive"> *</span>
          </label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Systems Leadership Development Plan" className="bg-background border-border" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">
              Employee<span className="text-destructive"> *</span>
            </label>
            <Select value={employeeId} onChange={setEmployeeId} options={employeeOptions} placeholder="Select employee" className="bg-background border-border h-9" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Plan Owner</label>
            <Select
              value={ownerId}
              onChange={setOwnerId}
              options={[{ label: 'Unassigned', value: '' }, ...owners]}
              placeholder="Select owner"
              className="bg-background border-border h-9"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Department</label>
            <Select
              value={departmentId}
              onChange={setDepartmentId}
              options={[{ label: 'Not set', value: '' }, ...departments]}
              placeholder="Select department"
              className="bg-background border-border h-9"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Status</label>
            <Select value={status} onChange={setStatus} options={PLAN_STATUS_FORM_OPTIONS} className="bg-background border-border h-9" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Start Date</label>
            <Input type="date" value={startDate ?? ''} onChange={(e) => setStartDate(e.target.value)} className="bg-background border-border" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Due Date</label>
            <Input type="date" value={dueDate ?? ''} onChange={(e) => setDueDate(e.target.value)} className="bg-background border-border" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Linked Career Path</label>
          <Select
            value={careerPathId}
            onChange={setCareerPathId}
            options={[
              { label: 'No linked path', value: '' },
              ...careerPaths.map((path) => ({ label: path.name, value: String(path.id) })),
            ]}
            placeholder="Select career path"
            className="bg-background border-border h-9"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Objective</label>
          <Textarea
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="What should this plan achieve?"
            className="min-h-[90px] bg-background border-border"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Key Focus Areas</label>
          <Input
            value={focusAreas}
            onChange={(e) => setFocusAreas(e.target.value)}
            placeholder="Comma separated, e.g. Strategic Leadership, Communication"
            className="bg-background border-border"
          />
        </div>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      </div>

      <DialogFooter className="p-6 pt-4 border-t border-primary/5 bg-muted/10 m-0">
        <Button variant="outline" onClick={onCancel} disabled={saving} className="h-9 px-6 rounded-lg font-bold border-border bg-background">
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={saving} className="h-9 px-6 rounded-lg font-bold">
          {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Plan'}
        </Button>
      </DialogFooter>
    </>
  )
}

/* ------------------------------------------------------------------ *
 * Career path create / edit dialog
 * ------------------------------------------------------------------ */

interface CareerPathFormProps {
  initialId: number | null
  saving: boolean
  departments: { value: string; label: string }[]
  onSubmit: (payload: CareerPathPayload) => Promise<{ ok: boolean; message: string }>
  onCancel: () => void
  onSaved: () => void
}

function CareerPathForm({ initialId, saving, departments, onSubmit, onCancel, onSaved }: CareerPathFormProps) {
  const { roles, loading: rolesLoading } = useRoleOptions()
  const { detail, loading: detailLoading } = useCareerPathDetail(initialId)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [status, setStatus] = useState('active')
  const [steps, setSteps] = useState<string[]>(['', ''])
  const [error, setError] = useState<string | null>(null)

  // Seed the form once the existing path arrives. Keyed on the record's id
  // and adjusted during render rather than in an effect: opening a different
  // path re-seeds, but the user's own edits to the one on screen are never
  // overwritten by a refetch returning the same record.
  const [seededId, setSeededId] = useState<number | null>(null)

  if (detail && seededId !== detail.id) {
    setSeededId(detail.id)
    setName(detail.name)
    setDescription(detail.description ?? '')
    setDepartmentId(detail.department_id ? String(detail.department_id) : '')
    setStatus(detail.status)
    setSteps(detail.steps.length ? detail.steps.map((step) => step.jobrole) : ['', ''])
  }

  const roleOptions = useMemo(
    () => [{ label: 'Select role', value: '' }, ...roles.map((role) => ({ label: role.jobrole, value: role.jobrole }))],
    [roles],
  )

  const setStep = (index: number, value: string) => {
    setSteps((current) => current.map((step, stepIndex) => (stepIndex === index ? value : step)))
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Path name is required.')
      return
    }
    const filled = steps.map((step) => step.trim()).filter(Boolean)
    if (filled.length < 2) {
      setError('A career path needs at least two roles.')
      return
    }
    setError(null)

    const payload: CareerPathPayload = {
      name: name.trim(),
      status: status as CareerPathPayload['status'],
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(departmentId ? { department_id: departmentId } : {}),
      steps: filled.map((jobrole, index) => ({
        jobrole,
        step_type: index === 0 ? 'current' : index === 1 ? 'next' : 'future',
      })),
    }

    const result = await onSubmit(payload)
    if (result.ok) onSaved()
    else setError(result.message)
  }

  const busy = saving || (initialId !== null && detailLoading)

  return (
    <>
      <DialogHeader className="p-6 pb-4 border-b border-primary/10 m-0">
        <DialogTitle className="text-xl font-bold text-foreground">{initialId ? 'Edit Career Path' : 'Create Career Path'}</DialogTitle>
        <DialogDescription className="sr-only">Define an ordered progression of job roles.</DialogDescription>
      </DialogHeader>

      <div className="p-6 flex flex-col gap-5 max-h-[70vh] overflow-y-auto g2g-scrollbar">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">
            Path Name<span className="text-destructive"> *</span>
          </label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Engineering Leadership Path" className="bg-background border-border" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Department</label>
            <Select
              value={departmentId}
              onChange={setDepartmentId}
              options={[{ label: 'Not set', value: '' }, ...departments]}
              placeholder="Select department"
              className="bg-background border-border h-9"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Status</label>
            <Select value={status} onChange={setStatus} options={CAREER_PATH_STATUS_OPTIONS} className="bg-background border-border h-9" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Description</label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this path represent?" className="min-h-[70px] bg-background border-border" />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-foreground">
              Role Steps<span className="text-destructive"> *</span>
            </label>
            <span className="text-xs text-muted-foreground">First step is the entry role</span>
          </div>

          {rolesLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            steps.map((step, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground w-6 shrink-0">{index + 1}.</span>
                <Select value={step} onChange={(value) => setStep(index, value)} options={roleOptions} placeholder="Select role" className="bg-background border-border h-9 flex-1" />
                <Button
                  variant="ghost"
                  className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive shrink-0"
                  disabled={steps.length <= 2}
                  onClick={() => setSteps((current) => current.filter((_, stepIndex) => stepIndex !== index))}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}

          <Button variant="outline" className="h-9 gap-2 text-xs border-dashed" onClick={() => setSteps((current) => [...current, ''])}>
            <Plus className="w-3.5 h-3.5" /> Add Role Step
          </Button>
        </div>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      </div>

      <DialogFooter className="p-6 pt-4 border-t border-primary/5 bg-muted/10 m-0">
        <Button variant="outline" onClick={onCancel} disabled={busy} className="h-9 px-6 rounded-lg font-bold border-border bg-background">
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={busy} className="h-9 px-6 rounded-lg font-bold">
          {saving ? 'Saving…' : initialId ? 'Save Changes' : 'Create Path'}
        </Button>
      </DialogFooter>
    </>
  )
}

/* ------------------------------------------------------------------ *
 * Assign learning dialog
 * ------------------------------------------------------------------ */

interface AssignLearningFormProps {
  employees: EmployeeOption[]
  presetEmployeeId?: number | null
  presetPlanId?: number | null
  saving: boolean
  onSubmit: (payload: {
    course_id: number
    user_ids: number[]
    assignment_type: 'Mandatory' | 'Optional' | 'Recommended'
    due_date?: string
    development_plan_id?: number
  }) => Promise<{ ok: boolean; message: string }>
  onCancel: () => void
  onSaved: () => void
}

function AssignLearningForm({ employees, presetEmployeeId, presetPlanId, saving, onSubmit, onCancel, onSaved }: AssignLearningFormProps) {
  const { options: courseOptions, loading: coursesLoading } = useCourseOptions()

  const [courseId, setCourseId] = useState('')
  const [selected, setSelected] = useState<number[]>(presetEmployeeId ? [presetEmployeeId] : [])
  const [assignmentType, setAssignmentType] = useState('Mandatory')
  const [dueDate, setDueDate] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return employees
    return employees.filter(
      (employee) =>
        employee.name.toLowerCase().includes(needle) || (employee.jobrole ?? '').toLowerCase().includes(needle),
    )
  }, [employees, search])

  const toggle = (id: number) => {
    setSelected((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]))
  }

  const handleSubmit = async () => {
    if (!courseId) {
      setError('Select a course to assign.')
      return
    }
    if (!selected.length) {
      setError('Select at least one employee.')
      return
    }
    setError(null)

    const result = await onSubmit({
      course_id: Number(courseId),
      user_ids: selected,
      assignment_type: assignmentType as 'Mandatory' | 'Optional' | 'Recommended',
      ...(dueDate ? { due_date: dueDate } : {}),
      ...(presetPlanId ? { development_plan_id: presetPlanId } : {}),
    })
    if (result.ok) onSaved()
    else setError(result.message)
  }

  return (
    <>
      <DialogHeader className="p-6 pb-4 border-b border-primary/10 m-0">
        <DialogTitle className="text-xl font-bold text-foreground">Assign Learning</DialogTitle>
        <DialogDescription className="sr-only">Assign a course to one or more employees.</DialogDescription>
      </DialogHeader>

      <div className="p-6 flex flex-col gap-5 max-h-[70vh] overflow-y-auto g2g-scrollbar">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">
            Course<span className="text-destructive"> *</span>
          </label>
          {coursesLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <Select
              value={courseId}
              onChange={setCourseId}
              options={[{ label: 'Select course', value: '' }, ...courseOptions]}
              placeholder="Select course"
              className="bg-background border-border h-9"
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Assignment Type</label>
            <Select value={assignmentType} onChange={setAssignmentType} options={LEARNING_TYPE_OPTIONS} className="bg-background border-border h-9" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Due Date</label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="bg-background border-border" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-foreground">
              Employees<span className="text-destructive"> *</span>
            </label>
            <span className="text-xs text-muted-foreground">{selected.length} selected</span>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employees…" className="h-9 pl-8 bg-background border-border" />
          </div>
          <div className="max-h-52 overflow-y-auto g2g-scrollbar rounded-lg border border-border divide-y divide-border">
            {visible.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">No employees found.</p>
            ) : (
              visible.map((employee) => (
                <label key={employee.id} className="flex items-center gap-3 p-2.5 hover:bg-muted/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.includes(employee.id)}
                    onChange={() => toggle(employee.id)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <Avatar initials={employee.initials} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{employee.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{dash(employee.jobrole)}</p>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      </div>

      <DialogFooter className="p-6 pt-4 border-t border-primary/5 bg-muted/10 m-0">
        <Button variant="outline" onClick={onCancel} disabled={saving} className="h-9 px-6 rounded-lg font-bold border-border bg-background">
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={saving} className="h-9 px-6 rounded-lg font-bold">
          {saving ? 'Assigning…' : 'Assign Learning'}
        </Button>
      </DialogFooter>
    </>
  )
}

/* ------------------------------------------------------------------ *
 * Plan action create / edit dialog
 * ------------------------------------------------------------------ */

interface ActionFormProps {
  initial: PlanAction | null
  saving: boolean
  onSubmit: (payload: PlanActionPayload) => Promise<{ ok: boolean; message: string }>
  onCancel: () => void
  onSaved: () => void
}

function ActionForm({ initial, saving, onSubmit, onCancel, onSaved }: ActionFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [actionType, setActionType] = useState(initial?.action_type ?? 'milestone')
  const [status, setStatus] = useState(initial?.status ?? 'pending')
  const [dueDate, setDueDate] = useState(initial?.due_date ?? '')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Action title is required.')
      return
    }
    setError(null)

    const result = await onSubmit({
      title: title.trim(),
      action_type: actionType as PlanActionPayload['action_type'],
      status: status as PlanActionPayload['status'],
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(dueDate ? { due_date: dueDate } : {}),
    })
    if (result.ok) onSaved()
    else setError(result.message)
  }

  return (
    <>
      <DialogHeader className="p-6 pb-4 border-b border-primary/10 m-0">
        <DialogTitle className="text-xl font-bold text-foreground">{initial ? 'Edit Action' : 'Add Action'}</DialogTitle>
        <DialogDescription className="sr-only">Plan action items drive the plan&apos;s progress.</DialogDescription>
      </DialogHeader>

      <div className="p-6 flex flex-col gap-5">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">
            Title<span className="text-destructive"> *</span>
          </label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lead a cross-functional project" className="bg-background border-border" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Type</label>
            <Select value={actionType} onChange={setActionType} options={ACTION_TYPE_OPTIONS} className="bg-background border-border h-9" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Status</label>
            <Select value={status} onChange={setStatus} options={ACTION_STATUS_OPTIONS} className="bg-background border-border h-9" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Due Date</label>
            <Input type="date" value={dueDate ?? ''} onChange={(e) => setDueDate(e.target.value)} className="bg-background border-border" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Description</label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[80px] bg-background border-border" />
        </div>

        <p className="text-xs text-muted-foreground">
          Plan progress is recalculated from completed actions each time this list changes.
        </p>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      </div>

      <DialogFooter className="p-6 pt-4 border-t border-primary/5 bg-muted/10 m-0">
        <Button variant="outline" onClick={onCancel} disabled={saving} className="h-9 px-6 rounded-lg font-bold border-border bg-background">
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={saving} className="h-9 px-6 rounded-lg font-bold">
          {saving ? 'Saving…' : initial ? 'Save Changes' : 'Add Action'}
        </Button>
      </DialogFooter>
    </>
  )
}

/* ------------------------------------------------------------------ *
 * Career Path Explorer card
 * ------------------------------------------------------------------ */

const EXPLORER_SOURCE_NOTE: Record<string, string> = {
  career_path: 'From the linked career path',
  career_journey: 'Derived from the configured role progression',
  related: 'Derived from related roles on the current job role',
  department: 'Derived from other roles in the same department',
  none: 'No progression configured for this role yet',
}

/** Roles the employee has already passed through are rendered muted. */
const NODE_LABELS: Record<string, string> = {
  current: '(Current Role)',
  next: '(Next Role)',
  past: '(Previous Role)',
  future: '(Future Role)',
}

function ExplorerNodeCard({ node }: { node: ExplorerNode }) {
  const isCurrent = node.is_current
  const isPast = node.step_type === 'past'
  const match = node.match_percent

  return (
    <div
      className={cn(
        'flex-1 min-w-[200px] p-4 rounded-xl border shadow-sm shrink-0 flex flex-col justify-between h-[112px]',
        isCurrent
          ? 'border-success bg-success/5'
          : node.step_type === 'next'
            ? 'border-primary/30 bg-primary/5'
            : isPast
              ? 'border-border bg-muted/30 opacity-70'
              : 'border-border bg-card',
      )}
    >
      <div>
        <p className="font-bold text-sm text-foreground leading-tight line-clamp-2" title={node.jobrole}>
          {node.jobrole}
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">
          {NODE_LABELS[isCurrent ? 'current' : node.step_type] ?? NODE_LABELS.future}
          {node.required_skills > 0 ? ` · ${node.required_skills} competencies` : ''}
        </p>
      </div>

      {isCurrent ? (
        <div className="flex justify-end">
          <div className="w-5 h-5 rounded-full bg-success flex items-center justify-center text-white">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
        </div>
      ) : isPast ? (
        <p className="text-[10px] font-semibold text-muted-foreground">Already held</p>
      ) : match === null ? (
        <p className="text-[10px] font-semibold text-muted-foreground">Match not available</p>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${match}%` }} />
          </div>
          <span className="text-[10px] font-bold text-foreground whitespace-nowrap">{match}% Match</span>
        </div>
      )}
    </div>
  )
}

function CareerPathExplorerCard({
  planId,
  careerPathId,
  employeeId,
  onViewFullPath,
}: {
  planId?: number | null
  careerPathId?: number | null
  employeeId?: number | null
  onViewFullPath: (pathId: number | null) => void
}) {
  const { explorer, loading, error, retry } = useCareerExplorer({ planId, careerPathId, employeeId })

  return (
    <Card className="mt-2">
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-6 px-6">
        <div className="flex items-center gap-2">
          <CardTitle>Career Path Explorer</CardTitle>
          <Info className="w-4 h-4 text-muted-foreground" />
        </div>
        <Button
          variant="outline"
          className="h-8 gap-2 text-xs"
          disabled={!explorer}
          onClick={() => onViewFullPath(explorer?.career_path_id ?? null)}
        >
          View Full Path <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </CardHeader>

      <CardContent className="px-6 pb-6">
        {loading ? (
          <div className="flex gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-[112px] flex-1 min-w-[200px] rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <ErrorState title="Could not load the career path" description={error} retry={retry} className="py-10" />
        ) : !explorer || explorer.nodes.length === 0 ? (
          <EmptyState
            icon={<Route className="w-8 h-8" />}
            title="No career path to show"
            description="Create a career path, or configure role progression for this employee's job role."
            className="py-10"
          />
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm font-semibold text-muted-foreground">{explorer.name}</p>
              <p className="text-xs text-muted-foreground">{EXPLORER_SOURCE_NOTE[explorer.source] ?? ''}</p>
            </div>

            <div className="flex items-center gap-4 w-full overflow-x-auto g2g-scrollbar pb-4 pt-2">
              {explorer.nodes.map((node, index) => (
                <React.Fragment key={`${node.jobrole}-${index}`}>
                  {index > 0 && (
                    <div className="shrink-0 text-muted-foreground/60">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  )}
                  <ExplorerNodeCard node={node} />
                </React.Fragment>
              ))}
            </div>

            {explorer.lateral_roles.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs font-bold text-muted-foreground uppercase mb-3">Lateral Opportunities</p>
                <div className="flex flex-wrap gap-2">
                  {explorer.lateral_roles.map((role) => (
                    <div key={role.jobrole_id} className="px-3 py-2 rounded-lg border border-border bg-muted/20 text-xs">
                      <span className="font-semibold text-foreground">{role.jobrole}</span>
                      {role.match_percent !== null && (
                        <span className="text-muted-foreground ml-2">{role.match_percent}% match</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ *
 * Plan detail panel
 * ------------------------------------------------------------------ */

function PlanDetailPanel({
  planId,
  onClose,
  onEdit,
  onAssignLearning,
  onOpenCareerPath,
  onChanged,
}: {
  planId: number
  onClose: () => void
  onEdit: (plan: EditablePlan) => void
  onAssignLearning: (plan: DevelopmentPlan) => void
  onOpenCareerPath: (pathId: number) => void
  onChanged: () => void
}) {
  const [tab, setTab] = useState(PLAN_TAB_OVERVIEW)
  const [actionDialog, setActionDialog] = useState<{ open: boolean; action: PlanAction | null }>({ open: false, action: null })

  const { detail, gaps, actions, history, loading, error, saving, retry, createAction, updateAction, deleteAction } =
    usePlanDetail(planId)

  const handleToggleAction = async (action: PlanAction) => {
    await updateAction(action.id, { status: action.status === 'completed' ? 'pending' : 'completed' })
    onChanged()
  }

  if (loading && !detail) {
    return (
      <Card className="flex-1 flex flex-col overflow-hidden h-full">
        <div className="p-5 flex flex-col gap-4">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </Card>
    )
  }

  if (error || !detail) {
    return (
      <Card className="flex-1 flex flex-col overflow-hidden h-full p-5">
        <ErrorState title="Could not load this plan" description={error ?? 'Plan not found.'} retry={retry} />
      </Card>
    )
  }

  return (
    <Card className="flex-1 flex flex-col overflow-hidden h-full">
      <div className="p-5 border-b border-border flex flex-col gap-4 bg-card z-10 shrink-0 relative">
        <Button variant="ghost" className="absolute top-4 right-4 h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>

        <div className="pr-8">
          <h2 className="text-lg font-bold text-foreground leading-tight">{detail.title}</h2>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
              {detail.employee_initials || '—'}
            </div>
            <div>
              <p className="font-bold text-sm text-foreground">{dash(detail.employee_name)}</p>
              <p className="text-xs text-muted-foreground">{dash(detail.jobrole)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-8 text-xs gap-1.5" onClick={() => onEdit(detail)}>
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </Button>
            <Button variant="outline" className="h-8 text-xs gap-1.5" onClick={() => onAssignLearning(detail)}>
              <BookOpen className="w-3.5 h-3.5" /> Assign Learning
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-2 bg-muted/20 p-3 rounded-xl border border-border">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Plan Status</p>
            <StatusBadge variant={planStatusVariant(detail.status)} label={detail.status_label} />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Plan Period</p>
            <p className="text-xs font-semibold text-foreground">
              {dash(detail.start_date_label)} – {dash(detail.due_date_label)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Plan Owner</p>
            {detail.owner_name ? (
              <div className="flex items-center gap-2">
                <Avatar initials={detail.owner_initials} tone="secondary" />
                <span className="text-xs font-semibold">{detail.owner_name}</span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Unassigned</span>
            )}
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Progress</p>
            <ProgressCell progress={detail.progress} />
          </div>
        </div>

        <div className="flex items-center gap-6 mt-2 border-b border-border/50">
          {PLAN_TABS.map((entry) => (
            <button
              key={entry.id}
              onClick={() => setTab(entry.id)}
              className={cn(
                'pb-2 text-xs font-semibold transition-colors relative',
                entry.id === tab ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {entry.label}
              {entry.id === tab && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />}
            </button>
          ))}
        </div>
      </div>

      <CardContent className="flex-1 overflow-auto g2g-scrollbar relative z-10 p-5">
        {tab === PLAN_TAB_OVERVIEW && (
          <div className="flex flex-col gap-6">
            <div>
              <h4 className="text-sm font-bold text-foreground mb-2">Objective</h4>
              {detail.objective ? (
                <p className="text-sm text-muted-foreground leading-relaxed">{detail.objective}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No objective recorded yet. Use Edit to add one.
                </p>
              )}
            </div>

            <div>
              <h4 className="text-sm font-bold text-foreground mb-2">Key Focus Areas</h4>
              {detail.focus_areas.length ? (
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  {detail.focus_areas.map((area) => (
                    <li key={area}>{area}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground italic">No focus areas set.</p>
              )}
            </div>

            <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-foreground mb-1">Next Milestone</h4>
                  {detail.next_milestone ? (
                    <>
                      <p className="text-sm font-semibold text-primary">{detail.next_milestone.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {detail.next_milestone.due_date ? `Due: ${detail.next_milestone.due_date}` : 'No due date'}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {detail.action_counts.total === 0 ? 'No actions added yet.' : 'All actions complete.'}
                    </p>
                  )}
                </div>
                {detail.next_milestone && (
                  <StatusBadge variant={actionStatusVariant(detail.next_milestone.status)} label={actionStatusLabel(detail.next_milestone.status)} />
                )}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold mb-2 uppercase text-muted-foreground">Linked Career Path</h4>
              {detail.career_path ? (
                <Button
                  variant="link"
                  className="p-0 h-auto text-primary font-bold"
                  onClick={() => onOpenCareerPath(detail.career_path!.id)}
                >
                  {detail.career_path.name} <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground italic">Not linked to a career path.</p>
              )}
            </div>
          </div>
        )}

        {tab === PLAN_TAB_GAPS && (
          <div className="flex flex-col gap-4">
            {!gaps ? (
              <EmptyState icon={<Target className="w-8 h-8" />} title="No gap data" description="Gaps are computed from the employee's job role requirements." />
            ) : gaps.items.length === 0 ? (
              <EmptyState
                icon={<Target className="w-8 h-8" />}
                title="No required competencies mapped"
                description={`No competency requirements are mapped to ${dash(gaps.jobrole)} yet.`}
              />
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl border border-border bg-muted/20">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Required</p>
                    <p className="text-lg font-bold text-foreground">{gaps.summary.total}</p>
                  </div>
                  <div className="p-3 rounded-xl border border-success/30 bg-success/5">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Met</p>
                    <p className="text-lg font-bold text-success">{gaps.summary.met}</p>
                  </div>
                  <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/5">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Gaps</p>
                    <p className="text-lg font-bold text-destructive">{gaps.summary.gaps}</p>
                  </div>
                </div>

                <Table className="text-sm">
                  <TableHeader className="bg-muted/30">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-3 py-2 font-bold text-foreground">Competency</TableHead>
                      <TableHead className="px-3 py-2 font-bold text-foreground text-center">Required</TableHead>
                      <TableHead className="px-3 py-2 font-bold text-foreground text-center">Current</TableHead>
                      <TableHead className="px-3 py-2 font-bold text-foreground text-center">Gap</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border">
                    {gaps.items.map((item) => (
                      <TableRow key={item.name} className="hover:bg-muted/30">
                        <TableCell className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{item.name}</span>
                            {item.is_focus && <StatusBadge variant="primary" label="Focus" size="sm" />}
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-2.5 text-center text-muted-foreground">{item.required}</TableCell>
                        <TableCell className="px-3 py-2.5 text-center text-muted-foreground">{item.current}</TableCell>
                        <TableCell className="px-3 py-2.5 text-center">
                          <span className={cn('font-bold', item.gap >= 0 ? 'text-success' : 'text-destructive')}>
                            {item.gap > 0 ? `+${item.gap}` : item.gap}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </div>
        )}

        {tab === PLAN_TAB_ACTIONS && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {detail.action_counts.completed} of {detail.action_counts.total} complete — progress recalculates automatically.
              </p>
              <Button className="h-8 gap-2 text-xs" onClick={() => setActionDialog({ open: true, action: null })}>
                <Plus className="w-3.5 h-3.5" /> Add Action
              </Button>
            </div>

            {actions.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="w-8 h-8" />}
                title="No actions yet"
                description="Add milestones, training or projects that make up this plan."
              />
            ) : (
              <div className="flex flex-col gap-2">
                {actions.map((action) => (
                  <div key={action.id} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/20 transition-colors">
                    <input
                      type="checkbox"
                      checked={action.status === 'completed'}
                      disabled={saving}
                      onChange={() => handleToggleAction(action)}
                      className="mt-0.5 h-4 w-4 rounded border-border accent-primary shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-semibold text-foreground', action.status === 'completed' && 'line-through text-muted-foreground')}>
                        {action.title}
                      </p>
                      {action.description && <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <StatusBadge variant={actionStatusVariant(action.status)} label={actionStatusLabel(action.status)} size="sm" />
                        <span className="text-[11px] text-muted-foreground capitalize">{action.action_type}</span>
                        {action.due_date_label && <span className="text-[11px] text-muted-foreground">· Due {action.due_date_label}</span>}
                        {action.owner_name && <span className="text-[11px] text-muted-foreground">· {action.owner_name}</span>}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground outline-none shrink-0">
                        <MoreVertical className="w-4 h-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setActionDialog({ open: true, action })}>Edit Action</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={async () => {
                            await deleteAction(action.id)
                            onChanged()
                          }}
                        >
                          Delete Action
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === PLAN_TAB_HISTORY && (
          <div className="flex flex-col gap-3">
            {history.length === 0 ? (
              <EmptyState icon={<History className="w-8 h-8" />} title="No history yet" description="Changes to this plan will be recorded here." />
            ) : (
              history.map((entry) => (
                <div key={entry.id} className="flex gap-3 p-3 rounded-xl border border-border bg-card">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <History className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{dash(entry.description)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {entry.by} · {dash(entry.date)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={actionDialog.open} onOpenChange={(open) => setActionDialog({ open, action: open ? actionDialog.action : null })}>
        <DialogContent className="max-w-xl p-0 gap-0 rounded-2xl overflow-hidden">
          <ActionForm
            key={actionDialog.action?.id ?? 'new'}
            initial={actionDialog.action}
            saving={saving}
            onSubmit={async (payload) => {
              const result = actionDialog.action
                ? await updateAction(actionDialog.action.id, payload)
                : await createAction(payload)
              if (result.ok) onChanged()
              return result
            }}
            onCancel={() => setActionDialog({ open: false, action: null })}
            onSaved={() => setActionDialog({ open: false, action: null })}
          />
        </DialogContent>
      </Dialog>
    </Card>
  )
}

/* ------------------------------------------------------------------ *
 * Career Paths tab
 * ------------------------------------------------------------------ */

function CareerPathsTab({
  departments,
  refreshKey,
  onChanged,
  focusedPathId,
  onFocusPath,
}: {
  departments: { value: string; label: string }[]
  refreshKey: number
  onChanged: () => void
  focusedPathId: number | null
  onFocusPath: (id: number | null) => void
}) {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [dialog, setDialog] = useState<{ open: boolean; id: number | null }>({ open: false, id: null })
  const [confirmDelete, setConfirmDelete] = useState<CareerPathSummary | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { paths, loading, error, saving, actionError, retry, create, update, remove, clearMessages } = useCareerPaths(
    { search: search || undefined, status: status === 'all' ? undefined : status },
    refreshKey,
  )

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between bg-card shrink-0">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search career paths..." className="h-9 pl-8 bg-background border-border" />
          </div>
          <div className="flex items-center gap-3">
            <Select
              value={status}
              onChange={setStatus}
              options={[{ label: 'Status: All', value: 'all' }, ...CAREER_PATH_STATUS_OPTIONS]}
              className="h-9 bg-background w-36"
            />
            <Button className="h-9 gap-2 text-sm" onClick={() => setDialog({ open: true, id: null })}>
              <Plus className="w-4 h-4" /> New Career Path
            </Button>
          </div>
        </div>

        {actionError && <p className="px-4 py-2 text-sm font-medium text-destructive bg-destructive/5">{actionError}</p>}

        <div className="overflow-auto g2g-scrollbar bg-card">
          <Table className="w-full text-sm">
            <TableHeader className="bg-muted/30 border-b border-border sticky top-0 z-20">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4 py-3 font-bold text-foreground">Path Name</TableHead>
                <TableHead className="px-4 py-3 font-bold text-foreground">Role Progression</TableHead>
                <TableHead className="px-4 py-3 font-bold text-foreground text-center">Steps</TableHead>
                <TableHead className="px-4 py-3 font-bold text-foreground text-center">Linked Plans</TableHead>
                <TableHead className="px-4 py-3 font-bold text-foreground">Status</TableHead>
                <TableHead className="px-4 py-3 font-bold text-foreground">Created</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>

            {loading ? (
              <TableSkeleton columns={7} />
            ) : (
              <TableBody className="divide-y divide-border">
                {paths.map((path) => (
                  <TableRow
                    key={path.id}
                    className={cn('hover:bg-muted/30 cursor-pointer', focusedPathId === path.id && 'bg-primary/5')}
                    onClick={() => onFocusPath(path.id)}
                  >
                    <TableCell className="px-4 py-4 font-medium text-foreground">{path.name}</TableCell>
                    <TableCell className="px-4 py-4 text-xs text-muted-foreground">
                      {path.roles.length ? path.roles.join('  →  ') : '—'}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-center text-muted-foreground">{path.step_count}</TableCell>
                    <TableCell className="px-4 py-4 text-center text-muted-foreground">{path.linked_plans}</TableCell>
                    <TableCell className="px-4 py-4">
                      <StatusBadge status={path.status} label={path.status} />
                    </TableCell>
                    <TableCell className="px-4 py-4 text-xs text-muted-foreground">{dash(path.created_at)}</TableCell>
                    <TableCell className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground outline-none mx-auto">
                          <MoreVertical className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onFocusPath(path.id)}>View in Explorer</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDialog({ open: true, id: path.id })}>Edit Path</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDelete(path)}>
                            Delete Path
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            )}
          </Table>

          {!loading && error && <ErrorState title="Could not load career paths" description={error} retry={retry} className="m-4" />}

          {!loading && !error && paths.length === 0 && (
            <EmptyState
              icon={<Route className="w-8 h-8" />}
              title="No career paths yet"
              description="Create a named path so development plans can point at a target progression."
              action={
                <Button className="gap-2" onClick={() => setDialog({ open: true, id: null })}>
                  <Plus className="w-4 h-4" /> Create Career Path
                </Button>
              }
              className="m-4 border-0"
            />
          )}
        </div>
      </Card>

      <CareerPathExplorerCard careerPathId={focusedPathId} onViewFullPath={(id) => onFocusPath(id)} />

      <Dialog
        open={dialog.open}
        onOpenChange={(open) => {
          if (!open) clearMessages()
          setDialog({ open, id: open ? dialog.id : null })
        }}
      >
        <DialogContent className="max-w-2xl p-0 gap-0 rounded-2xl overflow-hidden">
          <CareerPathForm
            key={dialog.id ?? 'new'}
            initialId={dialog.id}
            departments={departments}
            saving={saving}
            onSubmit={async (payload) => {
              const result = dialog.id ? await update(dialog.id, payload) : await create(payload)
              if (result.ok) onChanged()
              return result
            }}
            onCancel={() => setDialog({ open: false, id: null })}
            onSaved={() => setDialog({ open: false, id: null })}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Delete career path</DialogTitle>
            <DialogDescription>
              Delete “{confirmDelete?.name}”? {confirmDelete?.linked_plans ? `${confirmDelete.linked_plans} plan(s) will be unlinked.` : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={saving}
              onClick={async () => {
                if (!confirmDelete) return
                const result = await remove(confirmDelete.id)
                if (result.ok) {
                  if (focusedPathId === confirmDelete.id) onFocusPath(null)
                  onChanged()
                  setConfirmDelete(null)
                }
              }}
            >
              {saving ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Learning Assignments tab
 * ------------------------------------------------------------------ */

function LearningTab({
  employees,
  refreshKey,
  onChanged,
  onAssign,
}: {
  employees: EmployeeOption[]
  refreshKey: number
  onChanged: () => void
  onAssign: () => void
}) {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [employeeId, setEmployeeId] = useState('all')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [confirmDelete, setConfirmDelete] = useState<LearningAssignment | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { competencyId } = useCompetencyFocus()

  const params = useMemo(
    () => ({
      search: search || undefined,
      status: status === 'all' ? undefined : status,
      employee_id: employeeId === 'all' ? undefined : employeeId,
      // Set when opened from a competency's detail panel ("Learning Assigned").
      competency_id: competencyId ?? undefined,
      page,
      per_page: perPage,
    }),
    [search, status, employeeId, competencyId, page, perPage],
  )

  const { assignments, pagination, loading, error, saving, actionError, retry, update, remove } = useLearningAssignments(params, refreshKey)

  const employeeOptions = useMemo(
    () => [{ label: 'Employee: All', value: 'all' }, ...employees.map((employee) => ({ label: employee.name, value: String(employee.id) }))],
    [employees],
  )

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between bg-card shrink-0">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search courses..." className="h-9 pl-8 bg-background border-border" />
        </div>
        <div className="flex items-center gap-3">
          <Select value={status} onChange={(value) => { setStatus(value); setPage(1) }} options={LEARNING_STATUS_OPTIONS} className="h-9 bg-background w-36" />
          <Select value={employeeId} onChange={(value) => { setEmployeeId(value); setPage(1) }} options={employeeOptions} className="h-9 bg-background w-44" />
          <Button className="h-9 gap-2 text-sm" onClick={onAssign}>
            <Plus className="w-4 h-4" /> Assign Learning
          </Button>
        </div>
      </div>

      {actionError && <p className="px-4 py-2 text-sm font-medium text-destructive bg-destructive/5">{actionError}</p>}

      <div className="overflow-auto g2g-scrollbar bg-card">
        <Table className="w-full text-sm">
          <TableHeader className="bg-muted/30 border-b border-border sticky top-0 z-20">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4 py-3 font-bold text-foreground">Course</TableHead>
              <TableHead className="px-4 py-3 font-bold text-foreground">Employee</TableHead>
              <TableHead className="px-4 py-3 font-bold text-foreground">Type</TableHead>
              <TableHead className="px-4 py-3 font-bold text-foreground">Status</TableHead>
              <TableHead className="px-4 py-3 font-bold text-foreground">Progress</TableHead>
              <TableHead className="px-4 py-3 font-bold text-foreground">Due Date</TableHead>
              <TableHead className="px-4 py-3 font-bold text-foreground">Linked Plan</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>

          {loading ? (
            <TableSkeleton columns={8} />
          ) : (
            <TableBody className="divide-y divide-border">
              {assignments.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-4">
                    <p className="font-medium text-foreground">{dash(row.course_name)}</p>
                    <p className="text-xs text-muted-foreground">{dash(row.course_type)}</p>
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Avatar initials={row.employee_initials} />
                      <span className="font-semibold text-xs whitespace-nowrap">{dash(row.employee_name)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 text-xs text-muted-foreground">{row.assignment_type}</TableCell>
                  <TableCell className="px-4 py-4">
                    <StatusBadge variant={learningStatusVariant(row.status)} label={row.status} />
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <ProgressCell progress={row.progress} />
                  </TableCell>
                  <TableCell className="px-4 py-4 text-xs text-muted-foreground">{dash(row.due_date_label)}</TableCell>
                  <TableCell className="px-4 py-4 text-xs text-muted-foreground max-w-[200px] truncate" title={row.plan_title ?? ''}>
                    {dash(row.plan_title)}
                  </TableCell>
                  <TableCell className="px-4 py-4 text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground outline-none mx-auto">
                        <MoreVertical className="w-4 h-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {LEARNING_STATUS_OPTIONS.filter((option) => option.value !== 'all' && option.value !== row.status).map((option) => (
                          <DropdownMenuItem
                            key={option.value}
                            onClick={async () => {
                              await update(row.id, { status: option.value as 'Not Started' | 'In Progress' | 'Completed' | 'Overdue' })
                              onChanged()
                            }}
                          >
                            Mark {option.label}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDelete(row)}>
                          Remove Assignment
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          )}
        </Table>

        {!loading && error && <ErrorState title="Could not load learning assignments" description={error} retry={retry} className="m-4" />}

        {!loading && !error && assignments.length === 0 && (
          <EmptyState
            icon={<BookOpen className="w-8 h-8" />}
            title="No learning assigned yet"
            description="Assign courses to employees to close the competency gaps their plans target."
            action={
              <Button className="gap-2" onClick={onAssign}>
                <Plus className="w-4 h-4" /> Assign Learning
              </Button>
            }
            className="m-4 border-0"
          />
        )}
      </div>

      {pagination && pagination.total > 0 && (
        <Pager
          page={pagination.page}
          lastPage={pagination.last_page}
          total={pagination.total}
          count={assignments.length}
          perPage={pagination.per_page}
          onPage={setPage}
          onPerPage={(value) => {
            setPerPage(value)
            setPage(1)
          }}
          noun="assignments"
        />
      )}

      <Dialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Remove assignment</DialogTitle>
            <DialogDescription>
              Remove “{confirmDelete?.course_name}” from {confirmDelete?.employee_name}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={saving}
              onClick={async () => {
                if (!confirmDelete) return
                const result = await remove(confirmDelete.id)
                if (result.ok) {
                  onChanged()
                  setConfirmDelete(null)
                }
              }}
            >
              {saving ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

/* ------------------------------------------------------------------ *
 * Development & Career Path Workspace
 * ------------------------------------------------------------------ */

export function CmDevelopmentCareer() {
  const [activeTab, setActiveTab] = useState(TAB_PLANS)
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
  const [focusedPathId, setFocusedPathId] = useState<number | null>(null)

  // Bumped after any mutation so the KPI cards and sibling tabs refetch.
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = () => setRefreshKey((value) => value + 1)

  /* -- Plans list query state -- */
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [departmentId, setDepartmentId] = useState('all')
  const [ownerId, setOwnerId] = useState('all')
  const [pendingOnly, setPendingOnly] = useState(false)
  const [sort, setSort] = useState<PlanSortField>('created_at')
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  /* -- Dialogs -- */
  const [planDialog, setPlanDialog] = useState<{ open: boolean; plan: EditablePlan | null }>({ open: false, plan: null })
  const [pathDialogOpen, setPathDialogOpen] = useState(false)
  const [learningDialog, setLearningDialog] = useState<{ open: boolean; employeeId: number | null; planId: number | null }>({
    open: false,
    employeeId: null,
    planId: null,
  })
  const [confirmDelete, setConfirmDelete] = useState<DevelopmentPlan | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { competencyId, competencyName, clearFocus } = useCompetencyFocus()

  const listParams = useMemo(
    () => ({
      search: search || undefined,
      status: status === 'all' ? undefined : status,
      department_id: departmentId === 'all' ? undefined : departmentId,
      approver_id: ownerId === 'all' ? undefined : ownerId,
      ...(pendingOnly ? { pending_approval: '1' } : {}),
      // Set when opened from a competency's detail panel ("Development Plans").
      competency_id: competencyId ?? undefined,
      sort,
      direction,
      page,
      per_page: perPage,
    }),
    [search, status, departmentId, ownerId, pendingOnly, competencyId, sort, direction, page, perPage],
  )

  const { metrics, loading: metricsLoading } = usePlanMetrics(refreshKey)
  const { departments, owners, employees } = useWorkspaceLookups()
  const {
    plans,
    pagination,
    loading,
    error,
    saving,
    actionError,
    retry,
    create,
    update,
    remove,
    clearMessages,
  } = useDevelopmentPlans(listParams)

  // Career paths are needed in the plan form's "Linked Career Path" picker.
  const { paths: careerPaths } = useCareerPaths({}, refreshKey)

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? null

  const handleSort = (field: PlanSortField) => {
    if (sort === field) {
      setDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(field)
      setDirection('asc')
    }
    setPage(1)
  }

  const activeFilterCount = [status !== 'all', departmentId !== 'all', ownerId !== 'all', pendingOnly].filter(Boolean).length

  return (
    <div className="flex flex-col gap-6 p-6 min-h-max">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Development &amp; Career Path Workspace <Info className="w-5 h-5 text-muted-foreground" />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage employee development plans, career paths and learning initiatives.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="h-10 px-4 rounded-xl font-semibold border-border bg-background gap-2"
            onClick={() => setPlanDialog({ open: true, plan: null })}
          >
            <FileText className="w-4 h-4" /> Create Development Plan
          </Button>
          <Button
            variant="outline"
            className="h-10 px-4 rounded-xl font-semibold border-border bg-background gap-2"
            onClick={() => setPathDialogOpen(true)}
          >
            <Route className="w-4 h-4" /> Create Career Path
          </Button>
          <Button
            className="h-10 px-4 rounded-xl font-bold gap-2"
            onClick={() => setLearningDialog({ open: true, employeeId: null, planId: null })}
          >
            <BookOpen className="w-4 h-4" /> Assign Learning
          </Button>
        </div>
      </div>

      <CompetencyFocusBanner
        competencyId={competencyId}
        competencyName={competencyName}
        onClear={clearFocus}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4">
        <KpiCard
          icon={<ClipboardList className="w-5 h-5" />}
          tone="primary"
          label="Active Development Plans"
          value={metrics?.active_plans ?? 0}
          delta={metrics?.active_plans_delta ?? 0}
          loading={metricsLoading}
        />

        <Card className="shadow-sm">
          <CardContent className="p-5 flex items-center justify-between h-full">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Plans In Progress</p>
              {metricsLoading ? (
                <Skeleton className="h-7 w-16 mt-1" />
              ) : (
                <p className="text-2xl font-bold text-foreground mt-1">{metrics?.in_progress ?? 0}</p>
              )}
            </div>
            <div className="relative w-14 h-14 rounded-full flex items-center justify-center shrink-0">
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="50%" cy="50%" r="46%" className="stroke-muted fill-none stroke-[4px]" />
                <circle
                  cx="50%"
                  cy="50%"
                  r="46%"
                  className="stroke-primary fill-none stroke-[4px]"
                  strokeDasharray="289"
                  strokeDashoffset={289 - (289 * (metrics?.in_progress_percent ?? 0)) / 100}
                />
              </svg>
              <span className="text-xs font-bold text-foreground z-10">{metrics?.in_progress_percent ?? 0}%</span>
            </div>
          </CardContent>
        </Card>

        <KpiCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          tone="success"
          label="Plans Completed"
          value={metrics?.completed ?? 0}
          delta={metrics?.completed_delta ?? 0}
          loading={metricsLoading}
        />

        <KpiCard
          icon={<Route className="w-5 h-5" />}
          tone="primary"
          label="Career Paths Created"
          value={metrics?.career_paths ?? 0}
          delta={metrics?.career_paths_delta ?? 0}
          loading={metricsLoading}
        />

        <KpiCard
          icon={<BookOpen className="w-5 h-5" />}
          tone="warning"
          label="Learning Assigned"
          value={metrics?.learning_assigned ?? 0}
          delta={metrics?.learning_delta ?? 0}
          loading={metricsLoading}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-8 border-b border-border px-2 mt-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id)
              setSelectedPlanId(null)
            }}
            className={cn(
              'pb-3 text-sm font-semibold transition-colors relative',
              tab.id === activeTab ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
            {tab.id === activeTab && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />}
          </button>
        ))}
      </div>

      {activeTab === TAB_PLANS && (
        <div className="w-full flex flex-col gap-6">
          <div className="flex gap-6 items-stretch min-w-[1000px] h-[600px]">
            {/* Plans list */}
            <Card className={cn('flex flex-col overflow-hidden h-full transition-all duration-300', selectedPlanId ? 'w-1/2' : 'w-full')}>
              <div className="p-4 border-b border-border flex items-center justify-between bg-card z-10 shrink-0 gap-3">
                <div className="relative flex-1 max-w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search plans..."
                    className="h-9 pl-8 bg-background border-border"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Select
                    value={status}
                    onChange={(value) => {
                      setStatus(value)
                      setPage(1)
                    }}
                    options={PLAN_STATUS_OPTIONS}
                    className="h-9 bg-background w-32"
                  />
                  {!selectedPlanId && (
                    <>
                      <Select
                        value={departmentId}
                        onChange={(value) => {
                          setDepartmentId(value)
                          setPage(1)
                        }}
                        options={[{ label: 'Department: All', value: 'all' }, ...departments]}
                        className="h-9 bg-background w-40"
                      />
                      <Select
                        value={ownerId}
                        onChange={(value) => {
                          setOwnerId(value)
                          setPage(1)
                        }}
                        options={[{ label: 'Plan Owner: All', value: 'all' }, ...owners]}
                        className="h-9 bg-background w-40"
                      />
                    </>
                  )}

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="h-9 px-3 gap-2 bg-background border-border text-sm">
                        <Filter className="w-3.5 h-3.5" /> More Filters
                        {activeFilterCount > 0 && (
                          <span className="ml-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1.5">
                            {activeFilterCount}
                          </span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-72 p-4 flex flex-col gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-foreground uppercase">Department</label>
                        <Select
                          value={departmentId}
                          onChange={(value) => {
                            setDepartmentId(value)
                            setPage(1)
                          }}
                          options={[{ label: 'All departments', value: 'all' }, ...departments]}
                          className="h-9 bg-background w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-foreground uppercase">Plan Owner</label>
                        <Select
                          value={ownerId}
                          onChange={(value) => {
                            setOwnerId(value)
                            setPage(1)
                          }}
                          options={[{ label: 'All owners', value: 'all' }, ...owners]}
                          className="h-9 bg-background w-full"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pendingOnly}
                          onChange={(e) => {
                            setPendingOnly(e.target.checked)
                            setPage(1)
                          }}
                          className="h-4 w-4 rounded border-border accent-primary"
                        />
                        Pending my approval only
                      </label>
                      <Button
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => {
                          setStatus('all')
                          setDepartmentId('all')
                          setOwnerId('all')
                          setPendingOnly(false)
                          setPage(1)
                        }}
                      >
                        Clear all filters
                      </Button>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {actionError && <p className="px-4 py-2 text-sm font-medium text-destructive bg-destructive/5 shrink-0">{actionError}</p>}

              <div className="flex-1 overflow-auto g2g-scrollbar relative z-10 bg-card">
                <Table className="w-full text-sm">
                  <TableHeader className="bg-muted/30 border-b border-border sticky top-0 z-20">
                    <TableRow className="hover:bg-transparent">
                      <SortableHead label="Plan Name" field="title" activeField={sort} direction={direction} onSort={handleSort} />
                      <TableHead className="px-4 py-3 font-bold text-foreground">Employee</TableHead>
                      {!selectedPlanId && <TableHead className="px-4 py-3 font-bold text-foreground">Role</TableHead>}
                      <SortableHead label="Status" field="status" activeField={sort} direction={direction} onSort={handleSort} />
                      {!selectedPlanId && (
                        <SortableHead label="Due Date" field="due_date" activeField={sort} direction={direction} onSort={handleSort} />
                      )}
                      <SortableHead label="Progress" field="progress" activeField={sort} direction={direction} onSort={handleSort} />
                      {!selectedPlanId && <TableHead className="px-4 py-3 font-bold text-foreground text-center">Plan Owner</TableHead>}
                      <TableHead className="w-12 text-center" />
                    </TableRow>
                  </TableHeader>

                  {loading ? (
                    <TableSkeleton columns={selectedPlanId ? 5 : 8} />
                  ) : (
                    <TableBody className="divide-y divide-border">
                      {plans.map((row) => (
                        <TableRow
                          key={row.id}
                          className={cn('hover:bg-muted/30 cursor-pointer', selectedPlanId === row.id && 'bg-primary/5')}
                          onClick={() => setSelectedPlanId(row.id)}
                        >
                          <TableCell className="px-4 py-4 font-medium text-foreground">{row.title}</TableCell>
                          <TableCell className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <Avatar initials={row.employee_initials} />
                              <span className="font-semibold text-xs whitespace-nowrap">{dash(row.employee_name)}</span>
                            </div>
                          </TableCell>
                          {!selectedPlanId && (
                            <TableCell className="px-4 py-4 text-muted-foreground text-xs max-w-[220px] truncate" title={row.jobrole ?? ''}>
                              {dash(row.jobrole)}
                            </TableCell>
                          )}
                          <TableCell className="px-4 py-4">
                            <StatusBadge variant={planStatusVariant(row.status)} label={row.status_label} />
                          </TableCell>
                          {!selectedPlanId && (
                            <TableCell className="px-4 py-4 text-muted-foreground text-xs">{dash(row.due_date_label)}</TableCell>
                          )}
                          <TableCell className="px-4 py-4">
                            <ProgressCell progress={row.progress} />
                          </TableCell>
                          {!selectedPlanId && (
                            <TableCell className="px-4 py-4 text-center">
                              <div className="mx-auto w-fit" title={row.owner_name ?? 'Unassigned'}>
                                <Avatar initials={row.owner_initials} tone="secondary" />
                              </div>
                            </TableCell>
                          )}
                          <TableCell className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground outline-none transition-colors mx-auto">
                                <MoreVertical className="w-4 h-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setSelectedPlanId(row.id)}>View Details</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setPlanDialog({ open: true, plan: row })}>Edit Plan</DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setLearningDialog({ open: true, employeeId: row.user_id, planId: row.id })}
                                >
                                  Assign Learning
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDelete(row)}>
                                  Delete Plan
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  )}
                </Table>

                {!loading && error && <ErrorState title="Could not load development plans" description={error} retry={retry} className="m-4" />}

                {!loading && !error && plans.length === 0 && (
                  <EmptyState
                    icon={<ClipboardList className="w-8 h-8" />}
                    title="No development plans found"
                    description={
                      activeFilterCount > 0 || search
                        ? 'No plans match the current filters.'
                        : 'Create the first development plan for an employee.'
                    }
                    action={
                      <Button className="gap-2" onClick={() => setPlanDialog({ open: true, plan: null })}>
                        <Plus className="w-4 h-4" /> Create Development Plan
                      </Button>
                    }
                    className="m-4 border-0"
                  />
                )}
              </div>

              {pagination && pagination.total > 0 && (
                <Pager
                  page={pagination.page}
                  lastPage={pagination.last_page}
                  total={pagination.total}
                  count={plans.length}
                  perPage={pagination.per_page}
                  onPage={setPage}
                  onPerPage={(value) => {
                    setPerPage(value)
                    setPage(1)
                  }}
                  noun="plans"
                />
              )}
            </Card>

            {/* Detail panel */}
            {selectedPlanId !== null && (
              <PlanDetailPanel
                key={selectedPlanId}
                planId={selectedPlanId}
                onClose={() => setSelectedPlanId(null)}
                onEdit={(plan) => setPlanDialog({ open: true, plan })}
                onAssignLearning={(plan) => setLearningDialog({ open: true, employeeId: plan.user_id, planId: plan.id })}
                onOpenCareerPath={(pathId) => {
                  setFocusedPathId(pathId)
                  setActiveTab(TAB_CAREER)
                  setSelectedPlanId(null)
                }}
                onChanged={refresh}
              />
            )}
          </div>

          {/* Career Path Explorer */}
          <CareerPathExplorerCard
            planId={selectedPlanId}
            employeeId={selectedPlan?.user_id ?? null}
            onViewFullPath={(pathId) => {
              setFocusedPathId(pathId)
              setActiveTab(TAB_CAREER)
            }}
          />
        </div>
      )}

      {activeTab === TAB_CAREER && (
        <CareerPathsTab
          departments={departments}
          refreshKey={refreshKey}
          onChanged={refresh}
          focusedPathId={focusedPathId}
          onFocusPath={setFocusedPathId}
        />
      )}

      {activeTab === TAB_LEARNING && (
        <LearningTab
          employees={employees}
          refreshKey={refreshKey}
          onChanged={refresh}
          onAssign={() => setLearningDialog({ open: true, employeeId: null, planId: null })}
        />
      )}

      {/* ---------- Dialogs ---------- */}

      <Dialog
        open={planDialog.open}
        onOpenChange={(open) => {
          if (!open) clearMessages()
          setPlanDialog({ open, plan: open ? planDialog.plan : null })
        }}
      >
        <DialogContent className="max-w-2xl p-0 gap-0 rounded-2xl overflow-hidden">
          <PlanForm
            key={planDialog.plan?.id ?? 'new'}
            initial={planDialog.plan}
            employees={employees}
            owners={owners}
            departments={departments}
            careerPaths={careerPaths}
            saving={saving}
            onSubmit={async (payload) => {
              const result = planDialog.plan ? await update(planDialog.plan.id, payload) : await create(payload)
              if (result.ok) refresh()
              return result
            }}
            onCancel={() => setPlanDialog({ open: false, plan: null })}
            onSaved={() => setPlanDialog({ open: false, plan: null })}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={pathDialogOpen} onOpenChange={setPathDialogOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0 rounded-2xl overflow-hidden">
          <CareerPathFormStandalone
            departments={departments}
            onDone={() => {
              setPathDialogOpen(false)
              refresh()
            }}
            onCancel={() => setPathDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={learningDialog.open}
        onOpenChange={(open) => setLearningDialog({ open, employeeId: open ? learningDialog.employeeId : null, planId: open ? learningDialog.planId : null })}
      >
        <DialogContent className="max-w-2xl p-0 gap-0 rounded-2xl overflow-hidden">
          <AssignLearningStandalone
            employees={employees}
            presetEmployeeId={learningDialog.employeeId}
            presetPlanId={learningDialog.planId}
            onDone={() => {
              setLearningDialog({ open: false, employeeId: null, planId: null })
              refresh()
            }}
            onCancel={() => setLearningDialog({ open: false, employeeId: null, planId: null })}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Delete development plan</DialogTitle>
            <DialogDescription>
              Delete “{confirmDelete?.title}”? This removes it from {dash(confirmDelete?.employee_name)}&apos;s profile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={saving}
              onClick={async () => {
                if (!confirmDelete) return
                const result = await remove(confirmDelete.id)
                if (result.ok) {
                  if (selectedPlanId === confirmDelete.id) setSelectedPlanId(null)
                  refresh()
                  setConfirmDelete(null)
                }
              }}
            >
              {saving ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Standalone dialog wrappers
 *
 * The header's "Create Career Path" / "Assign Learning" buttons are available
 * from every tab, so they own their own mutation hook instead of borrowing the
 * tab-scoped one (which only exists while that tab is mounted).
 * ------------------------------------------------------------------ */

function CareerPathFormStandalone({
  departments,
  onDone,
  onCancel,
}: {
  departments: { value: string; label: string }[]
  onDone: () => void
  onCancel: () => void
}) {
  const { saving, create } = useCareerPaths({}, 0)

  return (
    <CareerPathForm
      initialId={null}
      departments={departments}
      saving={saving}
      onSubmit={create}
      onCancel={onCancel}
      onSaved={onDone}
    />
  )
}

function AssignLearningStandalone({
  employees,
  presetEmployeeId,
  presetPlanId,
  onDone,
  onCancel,
}: {
  employees: EmployeeOption[]
  presetEmployeeId: number | null
  presetPlanId: number | null
  onDone: () => void
  onCancel: () => void
}) {
  const { saving, assign } = useLearningAssignments({ per_page: 1 }, 0)

  return (
    <AssignLearningForm
      employees={employees}
      presetEmployeeId={presetEmployeeId}
      presetPlanId={presetPlanId}
      saving={saving}
      onSubmit={assign}
      onCancel={onCancel}
      onSaved={onDone}
    />
  )
}
