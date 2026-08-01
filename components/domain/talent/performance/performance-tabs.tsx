'use client'

/**
 * The five non-review tabs: Goals, Appraisals, Compensation, Bonus, Calibration.
 *
 * Each is a full table with its own filters, sortable columns, server paging,
 * summary counters, row actions and create/edit dialogs - nothing here is a
 * placeholder. The approval workflows call the API's own decision endpoints, so a
 * guard message ("An approved appraisal cannot be edited") surfaces verbatim.
 */

import * as React from 'react'
import { MoreHorizontal, Plus, Search, Scale, Lock, Pencil, Check, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type {
  AppraisalPayload,
  BonusDecisionAction,
  BonusPayload,
  CalibrationGrid,
  CalibrationSessionPayload,
  CompensationPayload,
  DecisionAction,
  EmployeeOption,
  GoalPayload,
  GoalUpdatePayload,
  PerfAppraisal,
  PerfBonus,
  PerfCalibrationSession,
  PerfCompensation,
  PerfFilterOptions,
  PerfGoal,
  PerfOption,
  PerfPagination,
} from '@/services/talent/performance'

import {
  EmployeeCell,
  PaginationBar,
  RatingCell,
  SortableHead,
  StatusBadge,
  SummaryStrip,
  TableLoadingRows,
  TableMessageRow,
  calibrationStatusVariant,
  decisionStatusVariant,
  formatMoney,
  formatPct,
  goalStatusVariant,
  stageVariant,
} from './performance-shared'

const ALL = 'all'

function withAll(options: PerfOption[], allLabel: string) {
  return [{ value: ALL, label: allLabel }, ...options]
}

/** Row action menu. A plain popover - the table row is not a Radix trigger. */
function RowActions({ actions }: { actions: Array<{ label: string; onSelect: () => void; disabled?: boolean; danger?: boolean }> }) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={containerRef} className="relative flex justify-center">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground"
        onClick={() => setOpen((value) => !value)}
        aria-label="Row actions"
      >
        <MoreHorizontal className="size-4" />
      </Button>

      {open && (
        <div className="absolute right-0 top-9 z-30 w-52 overflow-hidden rounded-lg border bg-background shadow-lg">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={action.disabled}
              onClick={() => {
                setOpen(false)
                action.onSelect()
              }}
              className={cn(
                'block w-full px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40',
                action.danger ? 'text-destructive' : 'text-foreground',
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** The filter row every tab shares: a search box plus its own selects. */
function TabFilters({
  search,
  onSearchChange,
  selects,
  action,
}: {
  search: string
  onSearchChange: (value: string) => void
  selects: Array<{ value: string; options: PerfOption[]; onChange: (value: string) => void; label: string }>
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {selects.map((select) => (
        <div key={select.label} className="w-[170px]">
          <Select value={select.value} options={select.options} onChange={select.onChange} aria-label={select.label} />
        </div>
      ))}
      <div className="relative min-w-[200px] flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search employee"
          className="pl-9"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      {action}
    </div>
  )
}

/* ================================================================== *
 * Goals
 * ================================================================== */

export interface GoalsTabProps {
  goals: PerfGoal[]
  summary: { total: number; active: number; achieved: number; missed: number; avg_progress: number; total_weight: number } | null
  pagination: PerfPagination
  loading: boolean
  error: string | null
  retry: () => void
  options: PerfFilterOptions | null
  filters: { search: string; department_id: string; category: string; goal_status: string; sort_by: string; sort_dir: 'asc' | 'desc'; page: number; per_page: number }
  onFilterChange: (patch: Partial<GoalsTabProps['filters']>) => void
  onCreate: (payload: GoalPayload) => void
  onUpdate: (id: number, payload: GoalUpdatePayload) => void
  onDelete: (id: number) => void
  saving: boolean
  cycleId?: string
}

const GOAL_STATUS_OPTIONS: PerfOption[] = [
  { value: ALL, label: 'All Goal Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'In Progress' },
  { value: 'achieved', label: 'Achieved' },
  { value: 'partially_achieved', label: 'Partially Achieved' },
  { value: 'missed', label: 'Missed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export function GoalsTab({
  goals,
  summary,
  pagination,
  loading,
  error,
  retry,
  options,
  filters,
  onFilterChange,
  onCreate,
  onUpdate,
  onDelete,
  saving,
  cycleId,
}: GoalsTabProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<PerfGoal | null>(null)

  const columns = 10

  const sort = (column: string) =>
    onFilterChange({
      sort_by: column,
      sort_dir: filters.sort_by === column && filters.sort_dir === 'asc' ? 'desc' : 'asc',
      page: 1,
    })

  return (
    <div className="flex flex-col gap-4">
      <TabFilters
        search={filters.search}
        onSearchChange={(value) => onFilterChange({ search: value, page: 1 })}
        selects={[
          {
            label: 'Department',
            value: filters.department_id,
            options: withAll(options?.departments ?? [], 'All Departments'),
            onChange: (value) => onFilterChange({ department_id: value, page: 1 }),
          },
          {
            label: 'Category',
            value: filters.category,
            options: withAll(options?.goal_categories ?? [], 'All Categories'),
            onChange: (value) => onFilterChange({ category: value, page: 1 }),
          },
          {
            label: 'Goal status',
            value: filters.goal_status,
            options: GOAL_STATUS_OPTIONS,
            onChange: (value) => onFilterChange({ goal_status: value, page: 1 }),
          },
        ]}
        action={
          <Button
            className="gap-2"
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="size-4" /> Add Goal
          </Button>
        }
      />

      {summary && (
        <SummaryStrip
          items={[
            { label: 'Total', value: summary.total },
            { label: 'In Progress', value: summary.active },
            { label: 'Achieved', value: summary.achieved },
            { label: 'Missed', value: summary.missed },
            { label: 'Avg Progress', value: `${summary.avg_progress}%` },
            { label: 'Total Weight', value: `${summary.total_weight}%` },
          ]}
        />
      )}

      <Card className="overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>
                  <SortableHead label="Goal" column="title" activeColumn={filters.sort_by} direction={filters.sort_dir} onSort={sort} />
                </TableHead>
                <TableHead>
                  <SortableHead label="Category" column="category" activeColumn={filters.sort_by} direction={filters.sort_dir} onSort={sort} />
                </TableHead>
                <TableHead>
                  <SortableHead label="Weightage" column="weightage" activeColumn={filters.sort_by} direction={filters.sort_dir} onSort={sort} />
                </TableHead>
                <TableHead className="font-semibold text-foreground">Target</TableHead>
                <TableHead className="font-semibold text-foreground">Achieved</TableHead>
                <TableHead>
                  <SortableHead label="Progress" column="progress" activeColumn={filters.sort_by} direction={filters.sort_dir} onSort={sort} />
                </TableHead>
                <TableHead>
                  <SortableHead label="Due" column="due_date" activeColumn={filters.sort_by} direction={filters.sort_dir} onSort={sort} />
                </TableHead>
                <TableHead>
                  <SortableHead label="Status" column="status" activeColumn={filters.sort_by} direction={filters.sort_dir} onSort={sort} />
                </TableHead>
                <TableHead className="w-[60px] text-center font-semibold text-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableLoadingRows columns={columns} />}

              {!loading && error && (
                <TableMessageRow
                  columns={columns}
                  tone="error"
                  title={error}
                  description="The goals could not be loaded."
                  action={
                    <Button variant="outline" size="sm" onClick={retry}>
                      Retry
                    </Button>
                  }
                />
              )}

              {!loading && !error && goals.length === 0 && (
                <TableMessageRow
                  columns={columns}
                  title="No goals match these filters"
                  description="Add a goal for an employee in this cycle, or clear the filters."
                />
              )}

              {!loading &&
                !error &&
                goals.map((goal) => (
                  <TableRow key={goal.id} className="hover:bg-muted/10">
                    <TableCell>
                      <EmployeeCell
                        name={goal.employee_name}
                        initials={goal.employee_initials}
                        employeeNo={goal.employee_no}
                        secondary={goal.department}
                      />
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <span className="block truncate text-sm font-medium text-foreground">{goal.title}</span>
                      {goal.metric && <span className="block truncate text-xs text-muted-foreground">{goal.metric}</span>}
                    </TableCell>
                    <TableCell>
                      <StatusBadge variant="default" size="sm">
                        {goal.category_label}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-sm text-foreground/80">{formatPct(goal.weightage)}</TableCell>
                    <TableCell className="text-sm text-foreground/80">
                      {goal.target_value ?? '—'} {goal.unit ?? ''}
                    </TableCell>
                    <TableCell className="text-sm text-foreground/80">
                      {goal.achieved_value ?? '—'} {goal.achieved_value ? (goal.unit ?? '') : ''}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-primary" style={{ width: `${goal.progress}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-foreground">{goal.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell className={cn('text-sm', goal.is_overdue ? 'font-semibold text-destructive' : 'text-foreground/80')}>
                      {goal.due_label ?? '—'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge variant={goalStatusVariant(goal.status)} size="sm">
                        {goal.status_label}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-center">
                      <RowActions
                        actions={[
                          {
                            label: 'Edit goal',
                            onSelect: () => {
                              setEditing(goal)
                              setDialogOpen(true)
                            },
                          },
                          {
                            label: 'Mark achieved',
                            disabled: goal.status === 'achieved' || saving,
                            onSelect: () => onUpdate(goal.id, { status: 'achieved', progress: 100 }),
                          },
                          {
                            label: 'Mark missed',
                            disabled: goal.status === 'missed' || saving,
                            onSelect: () => onUpdate(goal.id, { status: 'missed' }),
                          },
                          { label: 'Delete goal', danger: true, disabled: saving, onSelect: () => onDelete(goal.id) },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>

        <PaginationBar
          page={pagination.page}
          perPage={pagination.per_page}
          total={pagination.total}
          lastPage={pagination.last_page}
          onPageChange={(page) => onFilterChange({ page })}
          onPerPageChange={(perPage) => onFilterChange({ per_page: perPage, page: 1 })}
        />
      </Card>

      <GoalDialog
        open={dialogOpen}
        goal={editing}
        employees={options?.employees ?? []}
        categories={options?.goal_categories ?? []}
        cycleId={cycleId}
        saving={saving}
        onClose={() => setDialogOpen(false)}
        onSubmit={(payload) => {
          if (editing) {
            const { user_id_target: _ignored, ...rest } = payload
            onUpdate(editing.id, rest)
          } else {
            onCreate(payload)
          }
          setDialogOpen(false)
        }}
      />
    </div>
  )
}

function GoalDialog({
  open,
  goal,
  employees,
  categories,
  cycleId,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean
  goal: PerfGoal | null
  employees: EmployeeOption[]
  categories: PerfOption[]
  cycleId?: string
  saving: boolean
  onClose: () => void
  onSubmit: (payload: GoalPayload) => void
}) {
  const [form, setForm] = React.useState({
    user_id_target: '',
    title: '',
    description: '',
    category: 'kra',
    weightage: '',
    metric: '',
    target_value: '',
    achieved_value: '',
    unit: '',
    start_date: '',
    due_date: '',
    progress: '0',
    status: 'draft',
  })
  const [validationError, setValidationError] = React.useState<string | null>(null)

  // Reset whenever the dialog opens, so a previous edit never leaks into a create.
  const openKey = `${open}-${goal?.id ?? 'new'}`
  const [lastKey, setLastKey] = React.useState(openKey)

  if (openKey !== lastKey) {
    setLastKey(openKey)
    setValidationError(null)
    setForm({
      user_id_target: goal ? String(goal.user_id) : '',
      title: goal?.title ?? '',
      description: goal?.description ?? '',
      category: goal?.category ?? 'kra',
      weightage: goal?.weightage !== null && goal?.weightage !== undefined ? String(goal.weightage) : '',
      metric: goal?.metric ?? '',
      target_value: goal?.target_value ?? '',
      achieved_value: goal?.achieved_value ?? '',
      unit: goal?.unit ?? '',
      start_date: goal?.start_date ?? '',
      due_date: goal?.due_date ?? '',
      progress: goal ? String(goal.progress) : '0',
      status: goal?.status ?? 'draft',
    })
  }

  const submit = () => {
    if (!form.title.trim()) {
      setValidationError('A goal title is required.')
      return
    }

    if (!goal && !form.user_id_target) {
      setValidationError('Choose the employee this goal belongs to.')
      return
    }

    onSubmit({
      user_id_target: Number(form.user_id_target),
      title: form.title.trim(),
      description: form.description || null,
      category: form.category as GoalPayload['category'],
      weightage: form.weightage === '' ? null : Number(form.weightage),
      metric: form.metric || null,
      target_value: form.target_value || null,
      achieved_value: form.achieved_value || null,
      unit: form.unit || null,
      start_date: form.start_date || null,
      due_date: form.due_date || null,
      progress: Number(form.progress || 0),
      status: form.status as GoalPayload['status'],
      cycle_id: cycleId ? Number(cycleId) : null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{goal ? 'Edit Goal' : 'Add Goal'}</DialogTitle>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-4 overflow-y-auto py-2 sm:grid-cols-2 custom-scrollbar">
          {!goal && (
            <Field label="Employee" required className="sm:col-span-2">
              <Select
                value={form.user_id_target}
                placeholder="Select employee"
                options={employees.map((employee) => ({
                  value: employee.value,
                  label: employee.employee_no ? `${employee.label} (${employee.employee_no})` : employee.label,
                }))}
                onChange={(value) => setForm((state) => ({ ...state, user_id_target: value }))}
              />
            </Field>
          )}

          <Field label="Goal title" required className="sm:col-span-2">
            <Input
              value={form.title}
              onChange={(event) => setForm((state) => ({ ...state, title: event.target.value }))}
              placeholder="e.g. Deliver the committed roadmap"
            />
          </Field>

          <Field label="Category">
            <Select
              value={form.category}
              options={categories}
              onChange={(value) => setForm((state) => ({ ...state, category: value }))}
            />
          </Field>

          <Field label="Weightage %">
            <Input
              type="number"
              min={0}
              max={100}
              value={form.weightage}
              onChange={(event) => setForm((state) => ({ ...state, weightage: event.target.value }))}
            />
          </Field>

          <Field label="Metric">
            <Input
              value={form.metric}
              onChange={(event) => setForm((state) => ({ ...state, metric: event.target.value }))}
              placeholder="e.g. Roadmap items delivered"
            />
          </Field>

          <Field label="Unit">
            <Input
              value={form.unit}
              onChange={(event) => setForm((state) => ({ ...state, unit: event.target.value }))}
              placeholder="items / days / %"
            />
          </Field>

          <Field label="Target value">
            <Input
              value={form.target_value}
              onChange={(event) => setForm((state) => ({ ...state, target_value: event.target.value }))}
            />
          </Field>

          <Field label="Achieved value">
            <Input
              value={form.achieved_value}
              onChange={(event) => setForm((state) => ({ ...state, achieved_value: event.target.value }))}
            />
          </Field>

          <Field label="Start date">
            <Input
              type="date"
              value={form.start_date}
              onChange={(event) => setForm((state) => ({ ...state, start_date: event.target.value }))}
            />
          </Field>

          <Field label="Due date">
            <Input
              type="date"
              value={form.due_date}
              onChange={(event) => setForm((state) => ({ ...state, due_date: event.target.value }))}
            />
          </Field>

          <Field label="Progress %">
            <Input
              type="number"
              min={0}
              max={100}
              value={form.progress}
              onChange={(event) => setForm((state) => ({ ...state, progress: event.target.value }))}
            />
          </Field>

          <Field label="Status">
            <Select
              value={form.status}
              options={GOAL_STATUS_OPTIONS.filter((option) => option.value !== ALL)}
              onChange={(value) => setForm((state) => ({ ...state, status: value }))}
            />
          </Field>

          <Field label="Description" className="sm:col-span-2">
            <Textarea
              rows={3}
              value={form.description}
              onChange={(event) => setForm((state) => ({ ...state, description: event.target.value }))}
            />
          </Field>
        </div>

        {validationError && <p className="text-xs font-semibold text-destructive">{validationError}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {goal ? 'Save Goal' : 'Add Goal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ================================================================== *
 * Appraisals
 * ================================================================== */

export interface AppraisalsTabProps {
  appraisals: PerfAppraisal[]
  summary: { total: number; draft: number; pending_approval: number; approved: number; rejected: number; promotions: number } | null
  pagination: PerfPagination
  loading: boolean
  error: string | null
  retry: () => void
  options: PerfFilterOptions | null
  filters: { search: string; department_id: string; recommendation: string; status: string; sort_by: string; sort_dir: 'asc' | 'desc'; page: number; per_page: number }
  onFilterChange: (patch: Partial<AppraisalsTabProps['filters']>) => void
  onCreate: (payload: AppraisalPayload) => void
  onUpdate: (id: number, payload: Partial<Omit<AppraisalPayload, 'user_id_target'>>) => void
  onDecide: (id: number, action: DecisionAction) => void
  onBulk: (ids: number[], action: DecisionAction) => void
  onDelete: (id: number) => void
  saving: boolean
  cycleId?: string
}

export function AppraisalsTab({
  appraisals,
  summary,
  pagination,
  loading,
  error,
  retry,
  options,
  filters,
  onFilterChange,
  onCreate,
  onUpdate,
  onDecide,
  onBulk,
  onDelete,
  saving,
  cycleId,
}: AppraisalsTabProps) {
  const [selected, setSelected] = React.useState<number[]>([])
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<PerfAppraisal | null>(null)

  const columns = 10

  const sort = (column: string) =>
    onFilterChange({
      sort_by: column,
      sort_dir: filters.sort_by === column && filters.sort_dir === 'asc' ? 'desc' : 'asc',
      page: 1,
    })

  const allSelected = appraisals.length > 0 && selected.length === appraisals.length

  return (
    <div className="flex flex-col gap-4">
      <TabFilters
        search={filters.search}
        onSearchChange={(value) => onFilterChange({ search: value, page: 1 })}
        selects={[
          {
            label: 'Department',
            value: filters.department_id,
            options: withAll(options?.departments ?? [], 'All Departments'),
            onChange: (value) => onFilterChange({ department_id: value, page: 1 }),
          },
          {
            label: 'Recommendation',
            value: filters.recommendation,
            options: withAll(options?.recommendations ?? [], 'All Recommendations'),
            onChange: (value) => onFilterChange({ recommendation: value, page: 1 }),
          },
          {
            label: 'Status',
            value: filters.status,
            options: withAll(options?.decision_statuses ?? [], 'All Status'),
            onChange: (value) => onFilterChange({ status: value, page: 1 }),
          },
        ]}
        action={
          <Button
            className="gap-2"
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="size-4" /> New Appraisal
          </Button>
        }
      />

      {summary && (
        <SummaryStrip
          items={[
            { label: 'Total', value: summary.total },
            { label: 'Draft', value: summary.draft },
            { label: 'Pending Approval', value: summary.pending_approval },
            { label: 'Approved', value: summary.approved },
            { label: 'Rejected', value: summary.rejected },
            { label: 'Promotions', value: summary.promotions },
          ]}
        />
      )}

      {selected.length > 0 && (
        <BulkBar
          count={selected.length}
          onClear={() => setSelected([])}
          actions={[
            { label: 'Submit for approval', onSelect: () => onBulk(selected, 'submit') },
            { label: 'Approve', onSelect: () => onBulk(selected, 'approve') },
            { label: 'Reject', onSelect: () => onBulk(selected, 'reject') },
          ]}
          saving={saving}
        />
      )}

      <Card className="overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[40px] pl-4">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={() => setSelected(allSelected ? [] : appraisals.map((item) => item.id))}
                    aria-label="Select all appraisals"
                  />
                </TableHead>
                <TableHead className="font-semibold text-foreground">Employee</TableHead>
                <TableHead className="font-semibold text-foreground">Cycle</TableHead>
                <TableHead>
                  <SortableHead label="Final Rating" column="final_rating" activeColumn={filters.sort_by} direction={filters.sort_dir} onSort={sort} />
                </TableHead>
                <TableHead>
                  <SortableHead label="Recommendation" column="recommendation" activeColumn={filters.sort_by} direction={filters.sort_dir} onSort={sort} />
                </TableHead>
                <TableHead className="font-semibold text-foreground">Proposed Designation</TableHead>
                <TableHead>
                  <SortableHead label="Effective" column="effective_date" activeColumn={filters.sort_by} direction={filters.sort_dir} onSort={sort} />
                </TableHead>
                <TableHead>
                  <SortableHead label="Status" column="status" activeColumn={filters.sort_by} direction={filters.sort_dir} onSort={sort} />
                </TableHead>
                <TableHead className="font-semibold text-foreground">Approver</TableHead>
                <TableHead className="w-[60px] text-center font-semibold text-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableLoadingRows columns={columns} />}

              {!loading && error && (
                <TableMessageRow
                  columns={columns}
                  tone="error"
                  title={error}
                  action={
                    <Button variant="outline" size="sm" onClick={retry}>
                      Retry
                    </Button>
                  }
                />
              )}

              {!loading && !error && appraisals.length === 0 && (
                <TableMessageRow
                  columns={columns}
                  title="No appraisals match these filters"
                  description="Create an appraisal from a completed review, or clear the filters."
                />
              )}

              {!loading &&
                !error &&
                appraisals.map((appraisal) => (
                  <TableRow key={appraisal.id} className="hover:bg-muted/10">
                    <TableCell className="pl-4">
                      <Checkbox
                        checked={selected.includes(appraisal.id)}
                        onCheckedChange={() =>
                          setSelected((state) =>
                            state.includes(appraisal.id)
                              ? state.filter((id) => id !== appraisal.id)
                              : [...state, appraisal.id],
                          )
                        }
                        aria-label={`Select ${appraisal.employee_name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <EmployeeCell
                        name={appraisal.employee_name}
                        initials={appraisal.employee_initials}
                        employeeNo={appraisal.employee_no}
                        secondary={appraisal.department}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-foreground/80">{appraisal.cycle ?? '—'}</TableCell>
                    <TableCell>
                      <RatingCell rating={appraisal.final_rating} label={appraisal.final_rating_label} />
                    </TableCell>
                    <TableCell>
                      {appraisal.recommendation ? (
                        <StatusBadge variant={appraisal.is_promotion ? 'success' : 'default'} size="sm">
                          {appraisal.recommendation_label}
                        </StatusBadge>
                      ) : (
                        <span className="text-sm text-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[180px] text-sm text-foreground/80">
                      <span className="block truncate">{appraisal.proposed_designation ?? '—'}</span>
                      {appraisal.proposed_grade && (
                        <span className="block text-xs text-muted-foreground">Grade {appraisal.proposed_grade}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-foreground/80">{appraisal.effective_label ?? '—'}</TableCell>
                    <TableCell>
                      <StatusBadge variant={decisionStatusVariant(appraisal.status)} size="sm">
                        {appraisal.status_label}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-sm text-foreground/80">
                      <span className="block">{appraisal.approver ?? '—'}</span>
                      {appraisal.approved_label && (
                        <span className="block text-xs text-muted-foreground">{appraisal.approved_label}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <RowActions
                        actions={[
                          {
                            label: 'Edit appraisal',
                            disabled: appraisal.status === 'approved',
                            onSelect: () => {
                              setEditing(appraisal)
                              setDialogOpen(true)
                            },
                          },
                          {
                            label: 'Submit for approval',
                            disabled: appraisal.status === 'pending_approval' || saving,
                            onSelect: () => onDecide(appraisal.id, 'submit'),
                          },
                          {
                            label: 'Approve',
                            disabled: appraisal.status === 'approved' || saving,
                            onSelect: () => onDecide(appraisal.id, 'approve'),
                          },
                          {
                            label: 'Reject',
                            disabled: appraisal.status === 'rejected' || saving,
                            onSelect: () => onDecide(appraisal.id, 'reject'),
                          },
                          {
                            label: 'Delete appraisal',
                            danger: true,
                            disabled: appraisal.status === 'approved' || saving,
                            onSelect: () => onDelete(appraisal.id),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>

        <PaginationBar
          page={pagination.page}
          perPage={pagination.per_page}
          total={pagination.total}
          lastPage={pagination.last_page}
          onPageChange={(page) => onFilterChange({ page })}
          onPerPageChange={(perPage) => onFilterChange({ per_page: perPage, page: 1 })}
        />
      </Card>

      <AppraisalDialog
        open={dialogOpen}
        appraisal={editing}
        employees={options?.employees ?? []}
        recommendations={options?.recommendations ?? []}
        statuses={options?.decision_statuses ?? []}
        cycleId={cycleId}
        saving={saving}
        onClose={() => setDialogOpen(false)}
        onSubmit={(payload) => {
          if (editing) {
            const { user_id_target: _ignored, ...rest } = payload
            onUpdate(editing.id, rest)
          } else {
            onCreate(payload)
          }
          setDialogOpen(false)
        }}
      />
    </div>
  )
}

function AppraisalDialog({
  open,
  appraisal,
  employees,
  recommendations,
  statuses,
  cycleId,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean
  appraisal: PerfAppraisal | null
  employees: EmployeeOption[]
  recommendations: PerfOption[]
  statuses: PerfOption[]
  cycleId?: string
  saving: boolean
  onClose: () => void
  onSubmit: (payload: AppraisalPayload) => void
}) {
  const [form, setForm] = React.useState({
    user_id_target: '',
    final_rating: '',
    recommendation: '',
    current_designation: '',
    proposed_designation: '',
    current_grade: '',
    proposed_grade: '',
    effective_date: '',
    status: 'draft',
    remarks: '',
  })
  const [validationError, setValidationError] = React.useState<string | null>(null)

  const openKey = `${open}-${appraisal?.id ?? 'new'}`
  const [lastKey, setLastKey] = React.useState(openKey)

  if (openKey !== lastKey) {
    setLastKey(openKey)
    setValidationError(null)
    setForm({
      user_id_target: appraisal ? String(appraisal.user_id) : '',
      final_rating: appraisal?.final_rating !== null && appraisal?.final_rating !== undefined ? String(appraisal.final_rating) : '',
      recommendation: appraisal?.recommendation ?? '',
      current_designation: appraisal?.current_designation ?? '',
      proposed_designation: appraisal?.proposed_designation ?? '',
      current_grade: appraisal?.current_grade ?? '',
      proposed_grade: appraisal?.proposed_grade ?? '',
      effective_date: appraisal?.effective_date ?? '',
      status: appraisal?.status ?? 'draft',
      remarks: appraisal?.remarks ?? '',
    })
  }

  const submit = () => {
    if (!appraisal && !form.user_id_target) {
      setValidationError('Choose the employee being appraised.')
      return
    }

    onSubmit({
      user_id_target: Number(form.user_id_target),
      cycle_id: cycleId ? Number(cycleId) : null,
      final_rating: form.final_rating === '' ? null : Number(form.final_rating),
      recommendation: (form.recommendation || null) as AppraisalPayload['recommendation'],
      current_designation: form.current_designation || null,
      proposed_designation: form.proposed_designation || null,
      current_grade: form.current_grade || null,
      proposed_grade: form.proposed_grade || null,
      effective_date: form.effective_date || null,
      status: form.status as AppraisalPayload['status'],
      remarks: form.remarks || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{appraisal ? 'Edit Appraisal' : 'New Appraisal'}</DialogTitle>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-4 overflow-y-auto py-2 sm:grid-cols-2 custom-scrollbar">
          {!appraisal && (
            <Field label="Employee" required className="sm:col-span-2">
              <Select
                value={form.user_id_target}
                placeholder="Select employee"
                options={employees.map((employee) => ({
                  value: employee.value,
                  label: employee.employee_no ? `${employee.label} (${employee.employee_no})` : employee.label,
                }))}
                onChange={(value) => setForm((state) => ({ ...state, user_id_target: value }))}
              />
            </Field>
          )}

          <Field label="Final rating (0-5)">
            <Input
              type="number"
              step="0.1"
              min={0}
              max={5}
              value={form.final_rating}
              onChange={(event) => setForm((state) => ({ ...state, final_rating: event.target.value }))}
            />
          </Field>

          <Field label="Recommendation">
            <Select
              value={form.recommendation}
              placeholder="Select recommendation"
              options={recommendations}
              onChange={(value) => setForm((state) => ({ ...state, recommendation: value }))}
            />
          </Field>

          <Field label="Current designation">
            <Input
              value={form.current_designation}
              onChange={(event) => setForm((state) => ({ ...state, current_designation: event.target.value }))}
            />
          </Field>

          <Field label="Proposed designation">
            <Input
              value={form.proposed_designation}
              onChange={(event) => setForm((state) => ({ ...state, proposed_designation: event.target.value }))}
            />
          </Field>

          <Field label="Current grade">
            <Input
              value={form.current_grade}
              onChange={(event) => setForm((state) => ({ ...state, current_grade: event.target.value }))}
            />
          </Field>

          <Field label="Proposed grade">
            <Input
              value={form.proposed_grade}
              onChange={(event) => setForm((state) => ({ ...state, proposed_grade: event.target.value }))}
            />
          </Field>

          <Field label="Effective date">
            <Input
              type="date"
              value={form.effective_date}
              onChange={(event) => setForm((state) => ({ ...state, effective_date: event.target.value }))}
            />
          </Field>

          <Field label="Status">
            <Select
              value={form.status}
              options={statuses}
              onChange={(value) => setForm((state) => ({ ...state, status: value }))}
            />
          </Field>

          <Field label="Remarks" className="sm:col-span-2">
            <Textarea
              rows={3}
              value={form.remarks}
              onChange={(event) => setForm((state) => ({ ...state, remarks: event.target.value }))}
            />
          </Field>
        </div>

        {validationError && <p className="text-xs font-semibold text-destructive">{validationError}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {appraisal ? 'Save Appraisal' : 'Create Appraisal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ================================================================== *
 * Compensation
 * ================================================================== */

export interface CompensationTabProps {
  revisions: PerfCompensation[]
  summary: { total: number; draft: number; pending_approval: number; approved: number; rejected: number; total_increment: number; avg_increment_pct: number } | null
  pagination: PerfPagination
  loading: boolean
  error: string | null
  retry: () => void
  options: PerfFilterOptions | null
  filters: { search: string; department_id: string; revision_type: string; status: string; sort_by: string; sort_dir: 'asc' | 'desc'; page: number; per_page: number }
  onFilterChange: (patch: Partial<CompensationTabProps['filters']>) => void
  onCreate: (payload: CompensationPayload) => void
  onUpdate: (id: number, payload: Partial<Omit<CompensationPayload, 'user_id_target'>>) => void
  onDecide: (id: number, action: DecisionAction) => void
  onBulk: (ids: number[], action: DecisionAction) => void
  onDelete: (id: number) => void
  saving: boolean
  cycleId?: string
}

export function CompensationTab({
  revisions,
  summary,
  pagination,
  loading,
  error,
  retry,
  options,
  filters,
  onFilterChange,
  onCreate,
  onUpdate,
  onDecide,
  onBulk,
  onDelete,
  saving,
  cycleId,
}: CompensationTabProps) {
  const [selected, setSelected] = React.useState<number[]>([])
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<PerfCompensation | null>(null)

  const columns = 10

  const sort = (column: string) =>
    onFilterChange({
      sort_by: column,
      sort_dir: filters.sort_by === column && filters.sort_dir === 'asc' ? 'desc' : 'asc',
      page: 1,
    })

  const allSelected = revisions.length > 0 && selected.length === revisions.length

  return (
    <div className="flex flex-col gap-4">
      <TabFilters
        search={filters.search}
        onSearchChange={(value) => onFilterChange({ search: value, page: 1 })}
        selects={[
          {
            label: 'Department',
            value: filters.department_id,
            options: withAll(options?.departments ?? [], 'All Departments'),
            onChange: (value) => onFilterChange({ department_id: value, page: 1 }),
          },
          {
            label: 'Revision type',
            value: filters.revision_type,
            options: withAll(options?.revision_types ?? [], 'All Revision Types'),
            onChange: (value) => onFilterChange({ revision_type: value, page: 1 }),
          },
          {
            label: 'Status',
            value: filters.status,
            options: withAll(options?.decision_statuses ?? [], 'All Status'),
            onChange: (value) => onFilterChange({ status: value, page: 1 }),
          },
        ]}
        action={
          <Button
            className="gap-2"
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="size-4" /> Propose Revision
          </Button>
        }
      />

      {summary && (
        <SummaryStrip
          items={[
            { label: 'Total', value: summary.total },
            { label: 'Pending Approval', value: summary.pending_approval },
            { label: 'Approved', value: summary.approved },
            { label: 'Rejected', value: summary.rejected },
            { label: 'Total Increment', value: formatMoney(summary.total_increment) },
            { label: 'Avg Increment', value: formatPct(summary.avg_increment_pct) },
          ]}
        />
      )}

      {selected.length > 0 && (
        <BulkBar
          count={selected.length}
          onClear={() => setSelected([])}
          actions={[
            { label: 'Submit for approval', onSelect: () => onBulk(selected, 'submit') },
            { label: 'Approve', onSelect: () => onBulk(selected, 'approve') },
            { label: 'Reject', onSelect: () => onBulk(selected, 'reject') },
          ]}
          saving={saving}
        />
      )}

      <Card className="overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[40px] pl-4">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={() => setSelected(allSelected ? [] : revisions.map((item) => item.id))}
                    aria-label="Select all revisions"
                  />
                </TableHead>
                <TableHead className="font-semibold text-foreground">Employee</TableHead>
                <TableHead>
                  <SortableHead label="Current CTC" column="current_ctc" activeColumn={filters.sort_by} direction={filters.sort_dir} onSort={sort} />
                </TableHead>
                <TableHead>
                  <SortableHead label="Proposed CTC" column="proposed_ctc" activeColumn={filters.sort_by} direction={filters.sort_dir} onSort={sort} />
                </TableHead>
                <TableHead>
                  <SortableHead label="Increment" column="increment_amount" activeColumn={filters.sort_by} direction={filters.sort_dir} onSort={sort} />
                </TableHead>
                <TableHead>
                  <SortableHead label="Increment %" column="increment_pct" activeColumn={filters.sort_by} direction={filters.sort_dir} onSort={sort} />
                </TableHead>
                <TableHead className="font-semibold text-foreground">Type</TableHead>
                <TableHead>
                  <SortableHead label="Effective" column="effective_date" activeColumn={filters.sort_by} direction={filters.sort_dir} onSort={sort} />
                </TableHead>
                <TableHead>
                  <SortableHead label="Status" column="status" activeColumn={filters.sort_by} direction={filters.sort_dir} onSort={sort} />
                </TableHead>
                <TableHead className="w-[60px] text-center font-semibold text-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableLoadingRows columns={columns} />}

              {!loading && error && (
                <TableMessageRow
                  columns={columns}
                  tone="error"
                  title={error}
                  action={
                    <Button variant="outline" size="sm" onClick={retry}>
                      Retry
                    </Button>
                  }
                />
              )}

              {!loading && !error && revisions.length === 0 && (
                <TableMessageRow
                  columns={columns}
                  title="No compensation revisions match these filters"
                  description="Propose a revision for an employee, or clear the filters."
                />
              )}

              {!loading &&
                !error &&
                revisions.map((revision) => (
                  <TableRow key={revision.id} className="hover:bg-muted/10">
                    <TableCell className="pl-4">
                      <Checkbox
                        checked={selected.includes(revision.id)}
                        onCheckedChange={() =>
                          setSelected((state) =>
                            state.includes(revision.id)
                              ? state.filter((id) => id !== revision.id)
                              : [...state, revision.id],
                          )
                        }
                        aria-label={`Select ${revision.employee_name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <EmployeeCell
                        name={revision.employee_name}
                        initials={revision.employee_initials}
                        employeeNo={revision.employee_no}
                        secondary={revision.department}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-foreground/80">
                      {formatMoney(revision.current_ctc, revision.currency)}
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-foreground">
                      {formatMoney(revision.proposed_ctc, revision.currency)}
                    </TableCell>
                    <TableCell className="text-sm text-success">
                      {revision.increment_amount !== null ? `+${formatMoney(revision.increment_amount, revision.currency)}` : '—'}
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-foreground">
                      {formatPct(revision.increment_pct)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge variant="default" size="sm">
                        {revision.revision_type_label}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-sm text-foreground/80">{revision.effective_label ?? '—'}</TableCell>
                    <TableCell>
                      <StatusBadge variant={decisionStatusVariant(revision.status)} size="sm">
                        {revision.status_label}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-center">
                      <RowActions
                        actions={[
                          {
                            label: 'Edit revision',
                            disabled: revision.status === 'approved',
                            onSelect: () => {
                              setEditing(revision)
                              setDialogOpen(true)
                            },
                          },
                          {
                            label: 'Submit for approval',
                            disabled: revision.status === 'pending_approval' || saving,
                            onSelect: () => onDecide(revision.id, 'submit'),
                          },
                          {
                            label: 'Approve',
                            disabled: revision.status === 'approved' || saving,
                            onSelect: () => onDecide(revision.id, 'approve'),
                          },
                          {
                            label: 'Reject',
                            disabled: revision.status === 'rejected' || saving,
                            onSelect: () => onDecide(revision.id, 'reject'),
                          },
                          {
                            label: 'Delete revision',
                            danger: true,
                            disabled: revision.status === 'approved' || saving,
                            onSelect: () => onDelete(revision.id),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>

        <PaginationBar
          page={pagination.page}
          perPage={pagination.per_page}
          total={pagination.total}
          lastPage={pagination.last_page}
          onPageChange={(page) => onFilterChange({ page })}
          onPerPageChange={(perPage) => onFilterChange({ per_page: perPage, page: 1 })}
        />
      </Card>

      <CompensationDialog
        open={dialogOpen}
        revision={editing}
        employees={options?.employees ?? []}
        revisionTypes={options?.revision_types ?? []}
        statuses={options?.decision_statuses ?? []}
        cycleId={cycleId}
        saving={saving}
        onClose={() => setDialogOpen(false)}
        onSubmit={(payload) => {
          if (editing) {
            const { user_id_target: _ignored, ...rest } = payload
            onUpdate(editing.id, rest)
          } else {
            onCreate(payload)
          }
          setDialogOpen(false)
        }}
      />
    </div>
  )
}

function CompensationDialog({
  open,
  revision,
  employees,
  revisionTypes,
  statuses,
  cycleId,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean
  revision: PerfCompensation | null
  employees: EmployeeOption[]
  revisionTypes: PerfOption[]
  statuses: PerfOption[]
  cycleId?: string
  saving: boolean
  onClose: () => void
  onSubmit: (payload: CompensationPayload) => void
}) {
  const [form, setForm] = React.useState({
    user_id_target: '',
    current_ctc: '',
    proposed_ctc: '',
    increment_pct: '',
    revision_type: 'merit',
    effective_date: '',
    status: 'draft',
    remarks: '',
  })
  const [validationError, setValidationError] = React.useState<string | null>(null)

  const openKey = `${open}-${revision?.id ?? 'new'}`
  const [lastKey, setLastKey] = React.useState(openKey)

  if (openKey !== lastKey) {
    setLastKey(openKey)
    setValidationError(null)
    setForm({
      user_id_target: revision ? String(revision.user_id) : '',
      current_ctc: revision?.current_ctc !== null && revision?.current_ctc !== undefined ? String(revision.current_ctc) : '',
      proposed_ctc: revision?.proposed_ctc !== null && revision?.proposed_ctc !== undefined ? String(revision.proposed_ctc) : '',
      increment_pct: revision?.increment_pct !== null && revision?.increment_pct !== undefined ? String(revision.increment_pct) : '',
      revision_type: revision?.revision_type ?? 'merit',
      effective_date: revision?.effective_date ?? '',
      status: revision?.status ?? 'draft',
      remarks: revision?.remarks ?? '',
    })
  }

  const submit = () => {
    if (!revision && !form.user_id_target) {
      setValidationError('Choose the employee this revision is for.')
      return
    }

    if (!form.proposed_ctc && !form.increment_pct) {
      setValidationError('Enter either a proposed CTC or an increment %. The other is calculated.')
      return
    }

    onSubmit({
      user_id_target: Number(form.user_id_target),
      cycle_id: cycleId ? Number(cycleId) : null,
      current_ctc: form.current_ctc === '' ? null : Number(form.current_ctc),
      // Sending only one of these lets the API derive the rest, so the amount
      // and the percentage can never disagree.
      proposed_ctc: form.proposed_ctc === '' ? null : Number(form.proposed_ctc),
      increment_pct: form.proposed_ctc === '' && form.increment_pct !== '' ? Number(form.increment_pct) : undefined,
      revision_type: form.revision_type as CompensationPayload['revision_type'],
      effective_date: form.effective_date || null,
      status: form.status as CompensationPayload['status'],
      remarks: form.remarks || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{revision ? 'Edit Compensation Revision' : 'Propose Compensation Revision'}</DialogTitle>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-4 overflow-y-auto py-2 sm:grid-cols-2 custom-scrollbar">
          {!revision && (
            <Field label="Employee" required className="sm:col-span-2">
              <Select
                value={form.user_id_target}
                placeholder="Select employee"
                options={employees.map((employee) => ({
                  value: employee.value,
                  label: employee.employee_no ? `${employee.label} (${employee.employee_no})` : employee.label,
                }))}
                onChange={(value) => setForm((state) => ({ ...state, user_id_target: value }))}
              />
            </Field>
          )}

          <Field label="Current CTC" hint="Left blank, payroll's salary structure is used if available.">
            <Input
              type="number"
              min={0}
              value={form.current_ctc}
              onChange={(event) => setForm((state) => ({ ...state, current_ctc: event.target.value }))}
            />
          </Field>

          <Field label="Revision type">
            <Select
              value={form.revision_type}
              options={revisionTypes}
              onChange={(value) => setForm((state) => ({ ...state, revision_type: value }))}
            />
          </Field>

          <Field label="Proposed CTC" hint="Enter this OR the increment % - the other is calculated.">
            <Input
              type="number"
              min={0}
              value={form.proposed_ctc}
              onChange={(event) => setForm((state) => ({ ...state, proposed_ctc: event.target.value }))}
            />
          </Field>

          <Field label="Increment %">
            <Input
              type="number"
              step="0.1"
              value={form.increment_pct}
              disabled={form.proposed_ctc !== ''}
              onChange={(event) => setForm((state) => ({ ...state, increment_pct: event.target.value }))}
            />
          </Field>

          <Field label="Effective date">
            <Input
              type="date"
              value={form.effective_date}
              onChange={(event) => setForm((state) => ({ ...state, effective_date: event.target.value }))}
            />
          </Field>

          <Field label="Status">
            <Select
              value={form.status}
              options={statuses}
              onChange={(value) => setForm((state) => ({ ...state, status: value }))}
            />
          </Field>

          <Field label="Remarks" className="sm:col-span-2">
            <Textarea
              rows={3}
              value={form.remarks}
              onChange={(event) => setForm((state) => ({ ...state, remarks: event.target.value }))}
            />
          </Field>
        </div>

        {validationError && <p className="text-xs font-semibold text-destructive">{validationError}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {revision ? 'Save Revision' : 'Propose Revision'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ================================================================== *
 * Bonus
 * ================================================================== */

export interface BonusTabProps {
  awards: PerfBonus[]
  summary: { total: number; draft: number; pending_approval: number; approved: number; rejected: number; paid: number; total_amount: number } | null
  payoutMonths: PerfOption[]
  pagination: PerfPagination
  loading: boolean
  error: string | null
  retry: () => void
  options: PerfFilterOptions | null
  filters: { search: string; department_id: string; bonus_type: string; status: string; payout_month: string; sort_by: string; sort_dir: 'asc' | 'desc'; page: number; per_page: number }
  onFilterChange: (patch: Partial<BonusTabProps['filters']>) => void
  onCreate: (payload: BonusPayload) => void
  onUpdate: (id: number, payload: Partial<Omit<BonusPayload, 'user_id_target'>>) => void
  onDecide: (id: number, action: BonusDecisionAction) => void
  onBulk: (ids: number[], action: BonusDecisionAction) => void
  onDelete: (id: number) => void
  saving: boolean
  cycleId?: string
}

const BONUS_STATUS_OPTIONS: PerfOption[] = [
  { value: ALL, label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'paid', label: 'Paid' },
]

export function BonusTab({
  awards,
  summary,
  payoutMonths,
  pagination,
  loading,
  error,
  retry,
  options,
  filters,
  onFilterChange,
  onCreate,
  onUpdate,
  onDecide,
  onBulk,
  onDelete,
  saving,
  cycleId,
}: BonusTabProps) {
  const [selected, setSelected] = React.useState<number[]>([])
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<PerfBonus | null>(null)

  const columns = 9

  const sort = (column: string) =>
    onFilterChange({
      sort_by: column,
      sort_dir: filters.sort_by === column && filters.sort_dir === 'asc' ? 'desc' : 'asc',
      page: 1,
    })

  const allSelected = awards.length > 0 && selected.length === awards.length

  return (
    <div className="flex flex-col gap-4">
      <TabFilters
        search={filters.search}
        onSearchChange={(value) => onFilterChange({ search: value, page: 1 })}
        selects={[
          {
            label: 'Bonus type',
            value: filters.bonus_type,
            options: withAll(options?.bonus_types ?? [], 'All Bonus Types'),
            onChange: (value) => onFilterChange({ bonus_type: value, page: 1 }),
          },
          {
            label: 'Payout month',
            value: filters.payout_month,
            options: withAll(payoutMonths, 'All Payout Months'),
            onChange: (value) => onFilterChange({ payout_month: value, page: 1 }),
          },
          {
            label: 'Status',
            value: filters.status,
            options: BONUS_STATUS_OPTIONS,
            onChange: (value) => onFilterChange({ status: value, page: 1 }),
          },
        ]}
        action={
          <Button
            className="gap-2"
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="size-4" /> Propose Bonus
          </Button>
        }
      />

      {summary && (
        <SummaryStrip
          items={[
            { label: 'Total', value: summary.total },
            { label: 'Pending Approval', value: summary.pending_approval },
            { label: 'Approved', value: summary.approved },
            { label: 'Paid', value: summary.paid },
            { label: 'Rejected', value: summary.rejected },
            { label: 'Total Amount', value: formatMoney(summary.total_amount) },
          ]}
        />
      )}

      {selected.length > 0 && (
        <BulkBar
          count={selected.length}
          onClear={() => setSelected([])}
          actions={[
            { label: 'Submit for approval', onSelect: () => onBulk(selected, 'submit') },
            { label: 'Approve', onSelect: () => onBulk(selected, 'approve') },
            { label: 'Reject', onSelect: () => onBulk(selected, 'reject') },
            { label: 'Mark paid (approved only)', onSelect: () => onBulk(selected, 'mark_paid') },
          ]}
          saving={saving}
        />
      )}

      <Card className="overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[40px] pl-4">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={() => setSelected(allSelected ? [] : awards.map((item) => item.id))}
                    aria-label="Select all bonus awards"
                  />
                </TableHead>
                <TableHead className="font-semibold text-foreground">Employee</TableHead>
                <TableHead>
                  <SortableHead label="Bonus Type" column="bonus_type" activeColumn={filters.sort_by} direction={filters.sort_dir} onSort={sort} />
                </TableHead>
                <TableHead>
                  <SortableHead label="Amount" column="amount" activeColumn={filters.sort_by} direction={filters.sort_dir} onSort={sort} />
                </TableHead>
                <TableHead>
                  <SortableHead label="% of CTC" column="pct_of_ctc" activeColumn={filters.sort_by} direction={filters.sort_dir} onSort={sort} />
                </TableHead>
                <TableHead>
                  <SortableHead label="Payout" column="payout_month" activeColumn={filters.sort_by} direction={filters.sort_dir} onSort={sort} />
                </TableHead>
                <TableHead>
                  <SortableHead label="Status" column="status" activeColumn={filters.sort_by} direction={filters.sort_dir} onSort={sort} />
                </TableHead>
                <TableHead className="font-semibold text-foreground">Approver</TableHead>
                <TableHead className="w-[60px] text-center font-semibold text-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableLoadingRows columns={columns} />}

              {!loading && error && (
                <TableMessageRow
                  columns={columns}
                  tone="error"
                  title={error}
                  action={
                    <Button variant="outline" size="sm" onClick={retry}>
                      Retry
                    </Button>
                  }
                />
              )}

              {!loading && !error && awards.length === 0 && (
                <TableMessageRow
                  columns={columns}
                  title="No bonus awards match these filters"
                  description="Propose a bonus for an employee, or clear the filters."
                />
              )}

              {!loading &&
                !error &&
                awards.map((award) => (
                  <TableRow key={award.id} className="hover:bg-muted/10">
                    <TableCell className="pl-4">
                      <Checkbox
                        checked={selected.includes(award.id)}
                        onCheckedChange={() =>
                          setSelected((state) =>
                            state.includes(award.id) ? state.filter((id) => id !== award.id) : [...state, award.id],
                          )
                        }
                        aria-label={`Select ${award.employee_name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <EmployeeCell
                        name={award.employee_name}
                        initials={award.employee_initials}
                        employeeNo={award.employee_no}
                        secondary={award.department}
                      />
                    </TableCell>
                    <TableCell>
                      <StatusBadge variant="default" size="sm">
                        {award.bonus_type_label}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-foreground">
                      {formatMoney(award.amount, award.currency)}
                    </TableCell>
                    <TableCell className="text-sm text-foreground/80">{formatPct(award.pct_of_ctc)}</TableCell>
                    <TableCell className="text-sm text-foreground/80">
                      <span className="block">{award.payout_label ?? '—'}</span>
                      {award.payout_date_label && (
                        <span className="block text-xs text-muted-foreground">Paid {award.payout_date_label}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge variant={decisionStatusVariant(award.status)} size="sm">
                        {award.status_label}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-sm text-foreground/80">{award.approver ?? '—'}</TableCell>
                    <TableCell className="text-center">
                      <RowActions
                        actions={[
                          {
                            label: 'Edit bonus',
                            disabled: award.status === 'approved' || award.status === 'paid',
                            onSelect: () => {
                              setEditing(award)
                              setDialogOpen(true)
                            },
                          },
                          {
                            label: 'Submit for approval',
                            disabled: award.status === 'pending_approval' || saving,
                            onSelect: () => onDecide(award.id, 'submit'),
                          },
                          {
                            label: 'Approve',
                            disabled: award.status === 'approved' || saving,
                            onSelect: () => onDecide(award.id, 'approve'),
                          },
                          {
                            label: 'Mark paid',
                            disabled: award.status !== 'approved' || saving,
                            onSelect: () => onDecide(award.id, 'mark_paid'),
                          },
                          {
                            label: 'Reject',
                            disabled: award.status === 'rejected' || saving,
                            onSelect: () => onDecide(award.id, 'reject'),
                          },
                          {
                            label: 'Delete bonus',
                            danger: true,
                            disabled: award.status === 'approved' || award.status === 'paid' || saving,
                            onSelect: () => onDelete(award.id),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>

        <PaginationBar
          page={pagination.page}
          perPage={pagination.per_page}
          total={pagination.total}
          lastPage={pagination.last_page}
          onPageChange={(page) => onFilterChange({ page })}
          onPerPageChange={(perPage) => onFilterChange({ per_page: perPage, page: 1 })}
        />
      </Card>

      <BonusDialog
        open={dialogOpen}
        award={editing}
        employees={options?.employees ?? []}
        bonusTypes={options?.bonus_types ?? []}
        cycleId={cycleId}
        saving={saving}
        onClose={() => setDialogOpen(false)}
        onSubmit={(payload) => {
          if (editing) {
            const { user_id_target: _ignored, ...rest } = payload
            onUpdate(editing.id, rest)
          } else {
            onCreate(payload)
          }
          setDialogOpen(false)
        }}
      />
    </div>
  )
}

function BonusDialog({
  open,
  award,
  employees,
  bonusTypes,
  cycleId,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean
  award: PerfBonus | null
  employees: EmployeeOption[]
  bonusTypes: PerfOption[]
  cycleId?: string
  saving: boolean
  onClose: () => void
  onSubmit: (payload: BonusPayload) => void
}) {
  const [form, setForm] = React.useState({
    user_id_target: '',
    bonus_type: 'performance',
    amount: '',
    pct_of_ctc: '',
    payout_month: '',
    payout_date: '',
    status: 'draft',
    remarks: '',
  })
  const [validationError, setValidationError] = React.useState<string | null>(null)

  const openKey = `${open}-${award?.id ?? 'new'}`
  const [lastKey, setLastKey] = React.useState(openKey)

  if (openKey !== lastKey) {
    setLastKey(openKey)
    setValidationError(null)
    setForm({
      user_id_target: award ? String(award.user_id) : '',
      bonus_type: award?.bonus_type ?? 'performance',
      amount: award?.amount !== null && award?.amount !== undefined ? String(award.amount) : '',
      pct_of_ctc: award?.pct_of_ctc !== null && award?.pct_of_ctc !== undefined ? String(award.pct_of_ctc) : '',
      payout_month: award?.payout_month ?? '',
      payout_date: award?.payout_date ?? '',
      status: award?.status ?? 'draft',
      remarks: award?.remarks ?? '',
    })
  }

  const submit = () => {
    if (!award && !form.user_id_target) {
      setValidationError('Choose the employee this bonus is for.')
      return
    }

    if (!form.amount) {
      setValidationError('A bonus amount is required.')
      return
    }

    onSubmit({
      user_id_target: Number(form.user_id_target),
      cycle_id: cycleId ? Number(cycleId) : null,
      bonus_type: form.bonus_type as BonusPayload['bonus_type'],
      amount: Number(form.amount),
      pct_of_ctc: form.pct_of_ctc === '' ? null : Number(form.pct_of_ctc),
      payout_month: form.payout_month || null,
      payout_date: form.payout_date || null,
      status: form.status as BonusPayload['status'],
      remarks: form.remarks || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{award ? 'Edit Bonus Award' : 'Propose Bonus Award'}</DialogTitle>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-4 overflow-y-auto py-2 sm:grid-cols-2 custom-scrollbar">
          {!award && (
            <Field label="Employee" required className="sm:col-span-2">
              <Select
                value={form.user_id_target}
                placeholder="Select employee"
                options={employees.map((employee) => ({
                  value: employee.value,
                  label: employee.employee_no ? `${employee.label} (${employee.employee_no})` : employee.label,
                }))}
                onChange={(value) => setForm((state) => ({ ...state, user_id_target: value }))}
              />
            </Field>
          )}

          <Field label="Bonus type">
            <Select
              value={form.bonus_type}
              options={bonusTypes}
              onChange={(value) => setForm((state) => ({ ...state, bonus_type: value }))}
            />
          </Field>

          <Field label="Amount" required>
            <Input
              type="number"
              min={0}
              value={form.amount}
              onChange={(event) => setForm((state) => ({ ...state, amount: event.target.value }))}
            />
          </Field>

          <Field label="% of CTC">
            <Input
              type="number"
              step="0.1"
              value={form.pct_of_ctc}
              onChange={(event) => setForm((state) => ({ ...state, pct_of_ctc: event.target.value }))}
            />
          </Field>

          <Field label="Payout month" hint="YYYY-MM">
            <Input
              type="month"
              value={form.payout_month}
              onChange={(event) => setForm((state) => ({ ...state, payout_month: event.target.value }))}
            />
          </Field>

          <Field label="Payout date">
            <Input
              type="date"
              value={form.payout_date}
              onChange={(event) => setForm((state) => ({ ...state, payout_date: event.target.value }))}
            />
          </Field>

          <Field label="Status">
            <Select
              value={form.status}
              options={BONUS_STATUS_OPTIONS.filter((option) => option.value !== ALL)}
              onChange={(value) => setForm((state) => ({ ...state, status: value }))}
            />
          </Field>

          <Field label="Remarks" className="sm:col-span-2">
            <Textarea
              rows={3}
              value={form.remarks}
              onChange={(event) => setForm((state) => ({ ...state, remarks: event.target.value }))}
            />
          </Field>
        </div>

        {validationError && <p className="text-xs font-semibold text-destructive">{validationError}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {award ? 'Save Bonus' : 'Propose Bonus'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ================================================================== *
 * Calibration
 * ================================================================== */

export interface CalibrationTabProps {
  sessions: PerfCalibrationSession[]
  summary: { total: number; scheduled: number; in_progress: number; completed: number; locked: number } | null
  pagination: PerfPagination
  loading: boolean
  error: string | null
  retry: () => void
  options: PerfFilterOptions | null
  filters: { search: string; department_id: string; status: string; sort_by: string; sort_dir: 'asc' | 'desc'; page: number; per_page: number }
  onFilterChange: (patch: Partial<CalibrationTabProps['filters']>) => void
  onCreate: (payload: CalibrationSessionPayload) => void
  onUpdate: (id: number, payload: Partial<Omit<CalibrationSessionPayload, 'cycle_id' | 'attach_reviews'>>) => void
  onLock: (id: number, force: boolean) => void
  onDelete: (id: number) => void
  onCalibrate: (sessionId: number, reviewId: number, rating: number) => void
  grid: CalibrationGrid | null
  gridLoading: boolean
  gridError: string | null
  openSessionId: number | null
  onOpenSession: (id: number | null) => void
  saving: boolean
  cycleId?: string
}

const CALIBRATION_STATUS_OPTIONS: PerfOption[] = [
  { value: ALL, label: 'All Status' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'locked', label: 'Locked' },
]

export function CalibrationTab({
  sessions,
  summary,
  pagination,
  loading,
  error,
  retry,
  options,
  filters,
  onFilterChange,
  onCreate,
  onUpdate,
  onLock,
  onDelete,
  onCalibrate,
  grid,
  gridLoading,
  gridError,
  openSessionId,
  onOpenSession,
  saving,
  cycleId,
}: CalibrationTabProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<PerfCalibrationSession | null>(null)

  const columns = 9

  const sort = (column: string) =>
    onFilterChange({
      sort_by: column,
      sort_dir: filters.sort_by === column && filters.sort_dir === 'asc' ? 'desc' : 'asc',
      page: 1,
    })

  return (
    <div className="flex flex-col gap-4">
      <TabFilters
        search={filters.search}
        onSearchChange={(value) => onFilterChange({ search: value, page: 1 })}
        selects={[
          {
            label: 'Department',
            value: filters.department_id,
            options: withAll(options?.departments ?? [], 'All Departments'),
            onChange: (value) => onFilterChange({ department_id: value, page: 1 }),
          },
          {
            label: 'Status',
            value: filters.status,
            options: CALIBRATION_STATUS_OPTIONS,
            onChange: (value) => onFilterChange({ status: value, page: 1 }),
          },
        ]}
        action={
          <Button
            className="gap-2"
            disabled={!cycleId}
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="size-4" /> New Session
          </Button>
        }
      />

      {summary && (
        <SummaryStrip
          items={[
            { label: 'Total', value: summary.total },
            { label: 'Scheduled', value: summary.scheduled },
            { label: 'In Progress', value: summary.in_progress },
            { label: 'Completed', value: summary.completed },
            { label: 'Locked', value: summary.locked },
          ]}
        />
      )}

      <Card className="overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>
                  <SortableHead label="Session" column="name" activeColumn={filters.sort_by} direction={filters.sort_dir} onSort={sort} />
                </TableHead>
                <TableHead className="font-semibold text-foreground">Cycle</TableHead>
                <TableHead className="font-semibold text-foreground">Department</TableHead>
                <TableHead className="font-semibold text-foreground">Facilitator</TableHead>
                <TableHead>
                  <SortableHead label="Scheduled" column="scheduled_at" activeColumn={filters.sort_by} direction={filters.sort_dir} onSort={sort} />
                </TableHead>
                <TableHead>
                  <SortableHead label="Participants" column="participant_count" activeColumn={filters.sort_by} direction={filters.sort_dir} onSort={sort} />
                </TableHead>
                <TableHead className="font-semibold text-foreground">Avg Rating</TableHead>
                <TableHead>
                  <SortableHead label="Status" column="status" activeColumn={filters.sort_by} direction={filters.sort_dir} onSort={sort} />
                </TableHead>
                <TableHead className="w-[60px] text-center font-semibold text-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableLoadingRows columns={columns} />}

              {!loading && error && (
                <TableMessageRow
                  columns={columns}
                  tone="error"
                  title={error}
                  action={
                    <Button variant="outline" size="sm" onClick={retry}>
                      Retry
                    </Button>
                  }
                />
              )}

              {!loading && !error && sessions.length === 0 && (
                <TableMessageRow
                  columns={columns}
                  title="No calibration sessions yet"
                  description="Create a session for this cycle to start calibrating ratings."
                />
              )}

              {!loading &&
                !error &&
                sessions.map((session) => (
                  <TableRow
                    key={session.id}
                    className="cursor-pointer hover:bg-muted/10"
                    onClick={() => onOpenSession(session.id)}
                  >
                    <TableCell className="max-w-[220px]">
                      <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                        <Scale className="size-3.5 shrink-0 text-muted-foreground" />
                        {session.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-foreground/80">{session.cycle ?? '—'}</TableCell>
                    <TableCell className="text-sm text-foreground/80">{session.department ?? 'All departments'}</TableCell>
                    <TableCell className="text-sm text-foreground/80">{session.facilitator ?? '—'}</TableCell>
                    <TableCell className="text-sm text-foreground/80">{session.scheduled_label ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{session.participant_count}</span>
                        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-primary" style={{ width: `${session.calibrated_pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{session.calibrated_pct}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RatingCell rating={session.average_rating} label={session.average_rating !== null ? String(session.average_rating) : null} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge variant={calibrationStatusVariant(session.status)} size="sm">
                        {session.status_label}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-center" onClick={(event) => event.stopPropagation()}>
                      <RowActions
                        actions={[
                          { label: 'Open calibration grid', onSelect: () => onOpenSession(session.id) },
                          {
                            label: 'Edit session',
                            disabled: session.is_locked,
                            onSelect: () => {
                              setEditing(session)
                              setDialogOpen(true)
                            },
                          },
                          {
                            label: 'Lock session',
                            disabled: session.is_locked || saving,
                            onSelect: () => onLock(session.id, false),
                          },
                          {
                            label: 'Force lock (skip uncalibrated)',
                            disabled: session.is_locked || saving,
                            onSelect: () => onLock(session.id, true),
                          },
                          {
                            label: 'Delete session',
                            danger: true,
                            disabled: session.is_locked || saving,
                            onSelect: () => onDelete(session.id),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>

        <PaginationBar
          page={pagination.page}
          perPage={pagination.per_page}
          total={pagination.total}
          lastPage={pagination.last_page}
          onPageChange={(page) => onFilterChange({ page })}
          onPerPageChange={(perPage) => onFilterChange({ per_page: perPage, page: 1 })}
        />
      </Card>

      <CalibrationSessionDialog
        open={dialogOpen}
        session={editing}
        departments={options?.departments ?? []}
        employees={options?.employees ?? []}
        cycleId={cycleId}
        saving={saving}
        onClose={() => setDialogOpen(false)}
        onSubmit={(payload) => {
          if (editing) {
            const { cycle_id: _cycle, attach_reviews: _attach, ...rest } = payload
            onUpdate(editing.id, rest)
          } else {
            onCreate(payload)
          }
          setDialogOpen(false)
        }}
      />

      <CalibrationGridSheet
        open={openSessionId !== null}
        grid={grid}
        loading={gridLoading}
        error={gridError}
        saving={saving}
        onClose={() => onOpenSession(null)}
        onCalibrate={onCalibrate}
        onLock={(force) => grid?.session && onLock(grid.session.id, force)}
      />
    </div>
  )
}

function CalibrationSessionDialog({
  open,
  session,
  departments,
  employees,
  cycleId,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean
  session: PerfCalibrationSession | null
  departments: PerfOption[]
  employees: EmployeeOption[]
  cycleId?: string
  saving: boolean
  onClose: () => void
  onSubmit: (payload: CalibrationSessionPayload) => void
}) {
  const [form, setForm] = React.useState({
    name: '',
    department_id: '',
    facilitator_id: '',
    scheduled_at: '',
    status: 'scheduled',
    notes: '',
    band5: '10',
    band4: '20',
    band3: '50',
    band2: '15',
    band1: '5',
  })
  const [validationError, setValidationError] = React.useState<string | null>(null)

  const openKey = `${open}-${session?.id ?? 'new'}`
  const [lastKey, setLastKey] = React.useState(openKey)

  if (openKey !== lastKey) {
    setLastKey(openKey)
    setValidationError(null)
    const target = session?.distribution_target ?? {}
    setForm({
      name: session?.name ?? '',
      department_id: session?.department_id ? String(session.department_id) : '',
      facilitator_id: session?.facilitator_id ? String(session.facilitator_id) : '',
      // datetime-local wants "YYYY-MM-DDTHH:mm"; the API returns a space.
      scheduled_at: session?.scheduled_at ? session.scheduled_at.replace(' ', 'T').slice(0, 16) : '',
      status: session?.status ?? 'scheduled',
      notes: session?.notes ?? '',
      band5: String(target['5'] ?? 10),
      band4: String(target['4'] ?? 20),
      band3: String(target['3'] ?? 50),
      band2: String(target['2'] ?? 15),
      band1: String(target['1'] ?? 5),
    })
  }

  const submit = () => {
    if (!form.name.trim()) {
      setValidationError('A session name is required.')
      return
    }

    if (!session && !cycleId) {
      setValidationError('Select a review cycle in the header first.')
      return
    }

    onSubmit({
      name: form.name.trim(),
      cycle_id: Number(cycleId),
      department_id: form.department_id ? Number(form.department_id) : null,
      facilitator_id: form.facilitator_id ? Number(form.facilitator_id) : null,
      scheduled_at: form.scheduled_at ? form.scheduled_at.replace('T', ' ') + ':00' : null,
      status: form.status as CalibrationSessionPayload['status'],
      notes: form.notes || null,
      distribution_target: {
        '5': Number(form.band5 || 0),
        '4': Number(form.band4 || 0),
        '3': Number(form.band3 || 0),
        '2': Number(form.band2 || 0),
        '1': Number(form.band1 || 0),
      },
      attach_reviews: !session,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{session ? 'Edit Calibration Session' : 'New Calibration Session'}</DialogTitle>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-4 overflow-y-auto py-2 sm:grid-cols-2 custom-scrollbar">
          <Field label="Session name" required className="sm:col-span-2">
            <Input
              value={form.name}
              onChange={(event) => setForm((state) => ({ ...state, name: event.target.value }))}
              placeholder="e.g. Product Calibration - FY 2024-25"
            />
          </Field>

          <Field label="Department" hint="Leave blank to include every department in the cycle.">
            <Select
              value={form.department_id}
              placeholder="All departments"
              options={departments}
              onChange={(value) => setForm((state) => ({ ...state, department_id: value }))}
            />
          </Field>

          <Field label="Facilitator">
            <Select
              value={form.facilitator_id}
              placeholder="Select facilitator"
              options={employees.map((employee) => ({ value: employee.value, label: employee.label }))}
              onChange={(value) => setForm((state) => ({ ...state, facilitator_id: value }))}
            />
          </Field>

          <Field label="Scheduled at">
            <Input
              type="datetime-local"
              value={form.scheduled_at}
              onChange={(event) => setForm((state) => ({ ...state, scheduled_at: event.target.value }))}
            />
          </Field>

          <Field label="Status">
            <Select
              value={form.status}
              options={CALIBRATION_STATUS_OPTIONS.filter((option) => option.value !== ALL)}
              onChange={(value) => setForm((state) => ({ ...state, status: value }))}
            />
          </Field>

          <div className="sm:col-span-2">
            <Label className="mb-2 block text-xs font-semibold text-muted-foreground">
              Target rating distribution (%)
            </Label>
            <div className="grid grid-cols-5 gap-2">
              {(['band5', 'band4', 'band3', 'band2', 'band1'] as const).map((band, index) => (
                <div key={band} className="flex flex-col gap-1">
                  <span className="text-[10px] text-muted-foreground">Band {5 - index}</span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={form[band]}
                    onChange={(event) => setForm((state) => ({ ...state, [band]: event.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>

          <Field label="Notes" className="sm:col-span-2">
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(event) => setForm((state) => ({ ...state, notes: event.target.value }))}
            />
          </Field>
        </div>

        {validationError && <p className="text-xs font-semibold text-destructive">{validationError}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {session ? 'Save Session' : 'Create Session'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The calibration grid: proposed vs calibrated rating, plus the distribution. */
function CalibrationGridSheet({
  open,
  grid,
  loading,
  error,
  saving,
  onClose,
  onCalibrate,
  onLock,
}: {
  open: boolean
  grid: CalibrationGrid | null
  loading: boolean
  error: string | null
  saving: boolean
  onClose: () => void
  onCalibrate: (sessionId: number, reviewId: number, rating: number) => void
  onLock: (force: boolean) => void
}) {
  const [editingRow, setEditingRow] = React.useState<number | null>(null)
  const [draftRating, setDraftRating] = React.useState('')

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent side="right" className="w-full max-w-3xl overflow-y-auto custom-scrollbar sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{grid?.session.name ?? 'Calibration Grid'}</SheetTitle>
        </SheetHeader>

        {loading && (
          <div className="flex flex-col gap-3 py-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {!loading && error && <p className="py-8 text-center text-sm font-semibold text-destructive">{error}</p>}

        {!loading && !error && grid && (
          <div className="flex flex-col gap-5 py-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-muted/20 px-4 py-3">
              <Stat label="Participants" value={grid.total_count} />
              <Stat label="Rated" value={grid.rated_count} />
              <Stat label="Calibrated" value={`${grid.session.calibrated_count} (${grid.session.calibrated_pct}%)`} />
              <Stat label="Average" value={grid.session.average_rating ?? '—'} />
              <StatusBadge variant={calibrationStatusVariant(grid.session.status)} size="sm">
                {grid.session.status_label}
              </StatusBadge>
            </div>

            {/* Distribution vs target */}
            <div>
              <h4 className="mb-2 text-sm font-semibold text-foreground">Distribution vs Target</h4>
              <div className="grid grid-cols-5 gap-2">
                {grid.distribution.map((band) => (
                  <div key={band.band} className="flex flex-col gap-1 rounded-lg border p-2.5">
                    <span className="text-[10px] font-semibold text-muted-foreground">Band {band.band}</span>
                    <span className="text-base font-bold text-foreground">{band.actual_pct}%</span>
                    <span className="text-[10px] text-muted-foreground">
                      Target {band.target_pct !== null ? `${band.target_pct}%` : '—'}
                    </span>
                    {band.variance !== null && (
                      <span
                        className={cn(
                          'text-[10px] font-semibold',
                          Math.abs(band.variance) <= 5
                            ? 'text-success'
                            : Math.abs(band.variance) <= 15
                              ? 'text-warning'
                              : 'text-destructive',
                        )}
                      >
                        {band.variance > 0 ? '+' : ''}
                        {band.variance}% vs target
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">{band.count} employee(s)</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Participants */}
            <div className="overflow-hidden rounded-lg border">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-semibold text-foreground">Employee</TableHead>
                      <TableHead className="font-semibold text-foreground">Stage</TableHead>
                      <TableHead className="font-semibold text-foreground">Proposed</TableHead>
                      <TableHead className="font-semibold text-foreground">Calibrated</TableHead>
                      <TableHead className="font-semibold text-foreground">Delta</TableHead>
                      <TableHead className="w-[110px] text-center font-semibold text-foreground">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grid.participants.length === 0 && (
                      <TableMessageRow
                        columns={6}
                        title="No participants attached"
                        description="Reviews in this cycle and department are attached when the session is created."
                      />
                    )}

                    {grid.participants.map((participant) => (
                      <TableRow key={participant.review_id}>
                        <TableCell>
                          <EmployeeCell
                            name={participant.employee_name}
                            initials={participant.employee_initials}
                            employeeNo={participant.employee_no}
                            secondary={participant.jobrole}
                          />
                        </TableCell>
                        <TableCell>
                          <StatusBadge variant={stageVariant(participant.stage)} size="sm">
                            {participant.stage_label}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>
                          <RatingCell rating={participant.proposed_rating} label={participant.proposed_label} />
                        </TableCell>
                        <TableCell>
                          {editingRow === participant.review_id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                step="0.1"
                                min={0}
                                max={5}
                                className="h-8 w-20"
                                value={draftRating}
                                onChange={(event) => setDraftRating(event.target.value)}
                              />
                              <Button
                                size="icon"
                                className="h-8 w-8"
                                disabled={saving || draftRating === ''}
                                onClick={() => {
                                  onCalibrate(grid.session.id, participant.review_id, Number(draftRating))
                                  setEditingRow(null)
                                }}
                              >
                                <Check className="size-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => setEditingRow(null)}
                              >
                                <X className="size-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <RatingCell rating={participant.calibrated_rating} label={participant.calibrated_label} />
                          )}
                        </TableCell>
                        <TableCell>
                          {participant.delta === null ? (
                            <span className="text-sm text-foreground/50">—</span>
                          ) : (
                            <span
                              className={cn(
                                'text-sm font-semibold',
                                participant.delta > 0
                                  ? 'text-success'
                                  : participant.delta < 0
                                    ? 'text-destructive'
                                    : 'text-muted-foreground',
                              )}
                            >
                              {participant.delta > 0 ? '+' : ''}
                              {participant.delta}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            disabled={grid.session.is_locked || saving}
                            onClick={() => {
                              setEditingRow(participant.review_id)
                              setDraftRating(
                                participant.calibrated_rating !== null
                                  ? String(participant.calibrated_rating)
                                  : participant.proposed_rating !== null
                                    ? String(participant.proposed_rating)
                                    : '',
                              )
                            }}
                          >
                            <Pencil className="size-3" /> Calibrate
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {!grid.session.is_locked && (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
                <Button variant="outline" className="gap-2" disabled={saving} onClick={() => onLock(false)}>
                  <Lock className="size-4" /> Lock Session
                </Button>
                <Button variant="outline" className="gap-2" disabled={saving} onClick={() => onLock(true)}>
                  <Lock className="size-4" /> Force Lock
                </Button>
              </div>
            )}

            {grid.session.is_locked && (
              <p className="rounded-lg border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                This session was locked on {grid.session.locked_label}. Ratings can no longer be changed.
              </p>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-bold text-foreground">{value}</span>
    </div>
  )
}

function Field({
  label,
  required,
  hint,
  className,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label className="text-xs font-semibold text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
    </div>
  )
}

/** The selection action bar shown above a tab's table. */
function BulkBar({
  count,
  onClear,
  actions,
  saving,
}: {
  count: number
  onClear: () => void
  actions: Array<{ label: string; onSelect: () => void }>
  saving: boolean
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-foreground">{count} selected</span>
        <button type="button" onClick={onClear} className="text-xs font-medium text-primary hover:underline">
          Clear Selection
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={saving}
            onClick={action.onSelect}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
