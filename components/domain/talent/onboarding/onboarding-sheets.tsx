'use client'

/**
 * Every side panel and dialog on the Onboarding & Employee Lifecycle Center.
 *
 * Each one owns its own draft state and hands a finished payload back to the
 * screen, which is where the mutation and the refresh live - the same split the
 * Performance Center uses.
 */

import * as React from 'react'
import { AlertTriangle, FileText, Search, Trash2, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  ALL,
  Initials,
  PaginationBar,
  TableMessageRow,
  TableSkeleton,
  confirmationVariant,
  documentStatusVariant,
  journeyStageVariant,
  journeyStatusVariant,
} from './onboarding-shared'
import type {
  DocumentPayload,
  JourneyFilters,
  JourneyPayload,
  NotePayload,
  OnbContact,
  OnbDocument,
  OnbFilterOptions,
  OnbJourney,
  OnbNote,
  OnbOption,
  OnbPagination,
  OnbProbation,
  OnbTask,
  TaskCategory,
  TaskPayload,
  TaskStatus,
} from '@/services/talent/onboarding'

/** Prefixes an option list with the screen's "no filter" entry. */
export function withAll(options: OnbOption[], label: string) {
  return [{ value: ALL, label }, ...options]
}

/** Empty string is what an untouched date/select field holds; the API wants null. */
function orNull(value: string | undefined | null) {
  return value && value !== ALL ? value : null
}

function dateValue(value?: Date | string) {
  if (!value) return ''
  if (typeof value === 'string') return value.slice(0, 10)
  const offset = value.getTimezoneOffset()
  return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

/* ------------------------------------------------------------------ *
 * Add / Edit Task
 * ------------------------------------------------------------------ */

const EMPTY_TASK = {
  title: '',
  description: '',
  category: ALL,
  owner: ALL,
  due_date: '',
  status: 'pending' as TaskStatus,
}

export function TaskSheet({
  open,
  task,
  journeyId,
  journeyName,
  options,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean
  task: OnbTask | null
  journeyId: number | null
  journeyName: string | null
  options: OnbFilterOptions | null
  saving: boolean
  onClose: () => void
  onSubmit: (payload: TaskPayload) => void
}) {
  const [form, setForm] = React.useState(EMPTY_TASK)
  const [error, setError] = React.useState<string | null>(null)

  // Re-seed the draft each time the sheet opens on a different task, so a
  // cancelled edit is dropped. Derived during render rather than in an effect -
  // the same pattern the Performance Center's sheets use.
  const signature = open ? `open:${task?.id ?? 'new'}` : 'closed'
  const [lastSignature, setLastSignature] = React.useState(signature)

  if (signature !== lastSignature) {
    setLastSignature(signature)
    if (open) {
      setError(null)
      setForm(
        task
          ? {
              title: task.title,
              description: task.description ?? '',
              category: task.category ?? ALL,
              owner: task.owner_id ? String(task.owner_id) : task.owner_label ? `label:${task.owner_label}` : ALL,
              due_date: task.due_date ?? '',
              status: task.status,
            }
          : EMPTY_TASK,
      )
    }
  }

  // Owners are people plus the free-text team owners the API already knows about.
  const ownerOptions = React.useMemo(
    () => withAll(options?.owners?.length ? options.owners : options?.employees ?? [], 'Unassigned'),
    [options],
  )

  const submit = () => {
    if (!form.title.trim()) {
      setError('Task title is required.')
      return
    }

    if (!journeyId) {
      setError('Select a hire before adding a task.')
      return
    }

    const owner = form.owner
    const isLabel = owner.startsWith('label:')

    onSubmit({
      journey_id: journeyId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category === ALL ? null : (form.category as TaskCategory),
      owner_id: !isLabel && owner !== ALL ? Number(owner) : null,
      owner_label: isLabel ? owner.slice(6) : null,
      due_date: orNull(form.due_date),
      status: form.status,
    })
  }

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent side="right" className="w-full max-w-md sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{task ? 'Edit Task' : 'Add Task'}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 py-4">
          {journeyName && (
            <p className="text-xs text-muted-foreground">
              For <span className="font-semibold text-foreground">{journeyName}</span>
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              Task<span className="ml-0.5 text-destructive">*</span>
            </Label>
            <Input
              value={form.title}
              onChange={(event) => setForm((state) => ({ ...state, title: event.target.value }))}
              placeholder="e.g. Upload Identity Proof"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Description</Label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(event) => setForm((state) => ({ ...state, description: event.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Category</Label>
              <Select
                value={form.category}
                options={withAll(options?.categories ?? [], 'Uncategorised')}
                onChange={(value) => setForm((state) => ({ ...state, category: value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Status</Label>
              <Select
                value={form.status}
                options={options?.task_statuses ?? []}
                onChange={(value) => setForm((state) => ({ ...state, status: value as TaskStatus }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Owner</Label>
            <Select
              value={form.owner}
              options={ownerOptions}
              onChange={(value) => setForm((state) => ({ ...state, owner: value }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Due date</Label>
            <DatePicker
              value={form.due_date || undefined}
              onChange={(value) => setForm((state) => ({ ...state, due_date: dateValue(value) }))}
            />
          </div>

          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {task ? 'Save changes' : 'Add task'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ *
 * New Journey (manual) / Start from an accepted offer
 * ------------------------------------------------------------------ */

const EMPTY_JOURNEY = {
  candidate_name: '',
  candidate_email: '',
  candidate_phone: '',
  position: '',
  location: '',
  department_id: ALL,
  manager_id: ALL,
  buddy_id: ALL,
  joining_date: '',
  probation_start: '',
  probation_end: '',
}

export function JourneySheet({
  open,
  journey,
  options,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean
  journey: OnbJourney | null
  options: OnbFilterOptions | null
  saving: boolean
  onClose: () => void
  onSubmit: (payload: JourneyPayload) => void
}) {
  const [form, setForm] = React.useState(EMPTY_JOURNEY)
  const [error, setError] = React.useState<string | null>(null)

  const signature = open ? `open:${journey?.id ?? 'new'}` : 'closed'
  const [lastSignature, setLastSignature] = React.useState(signature)

  if (signature !== lastSignature) {
    setLastSignature(signature)
    if (open) {
      setError(null)
      setForm(
        journey
          ? {
            candidate_name: journey.candidate_name ?? journey.name ?? '',
            candidate_email: journey.candidate_email ?? journey.email ?? '',
            candidate_phone: journey.candidate_phone ?? '',
            position: journey.position ?? '',
            location: journey.location ?? '',
            department_id: journey.department_id ? String(journey.department_id) : ALL,
            manager_id: journey.manager_id ? String(journey.manager_id) : ALL,
            buddy_id: journey.buddy_id ? String(journey.buddy_id) : ALL,
            joining_date: journey.joining_date ?? '',
            probation_start: journey.probation_start ?? '',
              probation_end: journey.probation_end ?? '',
            }
          : EMPTY_JOURNEY,
      )
    }
  }

  const submit = () => {
    if (!form.candidate_name.trim()) {
      setError('Hire name is required.')
      return
    }

    if (form.probation_start && form.probation_end && form.probation_end < form.probation_start) {
      setError('Probation end must be on or after the start date.')
      return
    }

    onSubmit({
      candidate_name: form.candidate_name.trim(),
      candidate_email: form.candidate_email.trim() || null,
      candidate_phone: form.candidate_phone.trim() || null,
      position: form.position.trim() || null,
      location: form.location.trim() || null,
      department_id: form.department_id === ALL ? null : Number(form.department_id),
      manager_id: form.manager_id === ALL ? null : Number(form.manager_id),
      buddy_id: form.buddy_id === ALL ? null : Number(form.buddy_id),
      joining_date: orNull(form.joining_date),
      probation_start: orNull(form.probation_start),
      probation_end: orNull(form.probation_end),
    })
  }

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent side="right" className="w-full max-w-lg sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{journey ? 'Edit Journey' : 'New Onboarding Journey'}</SheetTitle>
        </SheetHeader>

        <div className="flex max-h-[calc(100vh-12rem)] flex-col gap-4 overflow-y-auto py-4 pr-1 custom-scrollbar">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              Hire name<span className="ml-0.5 text-destructive">*</span>
            </Label>
            <Input
              value={form.candidate_name}
              onChange={(event) => setForm((state) => ({ ...state, candidate_name: event.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Email</Label>
              <Input
                type="email"
                value={form.candidate_email}
                onChange={(event) => setForm((state) => ({ ...state, candidate_email: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Phone</Label>
              <Input
                value={form.candidate_phone}
                onChange={(event) => setForm((state) => ({ ...state, candidate_phone: event.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Position</Label>
              <Input
                value={form.position}
                onChange={(event) => setForm((state) => ({ ...state, position: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Location</Label>
              <Input
                value={form.location}
                onChange={(event) => setForm((state) => ({ ...state, location: event.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Department</Label>
            <Select
              value={form.department_id}
              options={withAll(options?.departments ?? [], 'Not set')}
              onChange={(value) => setForm((state) => ({ ...state, department_id: value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Reporting manager</Label>
              <Select
                value={form.manager_id}
                options={withAll(options?.employees ?? [], 'Not set')}
                onChange={(value) => setForm((state) => ({ ...state, manager_id: value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Onboarding buddy</Label>
              <Select
                value={form.buddy_id}
                options={withAll(options?.employees ?? [], 'Not set')}
                onChange={(value) => setForm((state) => ({ ...state, buddy_id: value }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Date of joining</Label>
            <DatePicker
              value={form.joining_date || undefined}
              onChange={(value) => setForm((state) => ({ ...state, joining_date: dateValue(value) }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Probation start</Label>
              <DatePicker
                value={form.probation_start || undefined}
                onChange={(value) => setForm((state) => ({ ...state, probation_start: dateValue(value) }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Probation end</Label>
              <DatePicker
                value={form.probation_end || undefined}
                onChange={(value) => setForm((state) => ({ ...state, probation_end: dateValue(value) }))}
              />
            </div>
          </div>

          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {journey ? 'Save changes' : 'Create journey'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/**
 * "Start from Accepted Offer" - the same handoff the Recruitment Center's offer
 * row triggers. Only offers with no journey yet are listed, which is what
 * GET /onboarding/filters already filters for.
 */
export function StartFromOfferDialog({
  open,
  options,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean
  options: OnbFilterOptions | null
  saving: boolean
  onClose: () => void
  onSubmit: (offerId: number) => void
}) {
  const [offerId, setOfferId] = React.useState('')
  const [lastOpen, setLastOpen] = React.useState(open)

  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) setOfferId('')
  }

  const offers = options?.offers ?? []
  const selected = offers.find((offer) => offer.value === offerId)

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Start Onboarding from an Offer</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {offers.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              Every open offer already has an onboarding journey.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Offer</Label>
                <Select
                  value={offerId}
                  options={offers}
                  placeholder="Select an offer"
                  onChange={setOfferId}
                />
              </div>

              {selected && (
                <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Candidate</p>
                    <p className="font-semibold text-foreground">{selected.candidate_name ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Position</p>
                    <p className="font-semibold text-foreground">{selected.position ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Joining date</p>
                    <p className="font-semibold text-foreground">{selected.start_date ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-semibold text-foreground">{selected.candidate_email ?? '—'}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => offerId && onSubmit(Number(offerId))} disabled={!offerId || saving}>
            Start onboarding
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ *
 * Journey list - the search box and the KPI drill-downs open this
 * ------------------------------------------------------------------ */

export function JourneyListSheet({
  open,
  title,
  journeys,
  pagination,
  loading,
  error,
  filters,
  options,
  selectedId,
  onFilterChange,
  onSelect,
  onEdit,
  onDelete,
  onClose,
  onRetry,
}: {
  open: boolean
  title: string
  journeys: OnbJourney[]
  pagination: OnbPagination
  loading: boolean
  error: string | null
  filters: JourneyFilters
  options: OnbFilterOptions | null
  selectedId: number | null
  onFilterChange: (patch: Partial<JourneyFilters>) => void
  onSelect: (journey: OnbJourney) => void
  onEdit: (journey: OnbJourney) => void
  onDelete: (journey: OnbJourney) => void
  onClose: () => void
  onRetry: () => void
}) {
  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent side="right" className="w-full max-w-3xl sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-3 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search hires, codes, positions..."
                value={filters.search ?? ''}
                onChange={(event) => onFilterChange({ search: event.target.value, page: 1 })}
              />
            </div>
            <div className="w-[170px]">
              <Select
                value={filters.stage ?? ALL}
                options={withAll(options?.stages ?? [], 'All Stages')}
                onChange={(value) => onFilterChange({ stage: value, page: 1 })}
              />
            </div>
            <div className="w-[170px]">
              <Select
                value={filters.status ?? ALL}
                options={withAll(options?.journey_statuses ?? [], 'All Statuses')}
                onChange={(value) => onFilterChange({ status: value, page: 1 })}
              />
            </div>
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Hire</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Joining</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableSkeleton columns={7} />}

                {!loading && error && (
                  <TableMessageRow
                    colSpan={7}
                    tone="error"
                    title="Could not load journeys"
                    description={error}
                    action={
                      <Button variant="outline" size="sm" onClick={onRetry}>
                        Retry
                      </Button>
                    }
                  />
                )}

                {!loading && !error && journeys.length === 0 && (
                  <TableMessageRow
                    colSpan={7}
                    title="No onboarding journeys"
                    description="Start one from an accepted offer, or create it manually."
                  />
                )}

                {!loading &&
                  !error &&
                  journeys.map((journey) => (
                    <TableRow
                      key={journey.id}
                      className={cn(
                        'cursor-pointer hover:bg-muted/30',
                        selectedId === journey.id && 'bg-primary/5',
                      )}
                      onClick={() => onSelect(journey)}
                    >
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <Initials value={journey.initials} />
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-foreground">{journey.name}</span>
                            <span className="text-[10px] text-muted-foreground">{journey.journey_code}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">
                        {journey.position ?? '—'}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">
                        {journey.joining_date_label ?? '—'}
                      </TableCell>
                      <TableCell className="py-3">
                        <StatusBadge variant={journeyStageVariant(journey.stage)} size="sm">
                          {journey.stage_label}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="py-3">
                        <StatusBadge variant={journeyStatusVariant(journey.status)} size="sm">
                          {journey.status_label}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">
                        {journey.task_completed}/{journey.task_total} ({journey.progress_pct}%)
                      </TableCell>
                      <TableCell className="py-3 text-right" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => onEdit(journey)}>
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive"
                            onClick={() => onDelete(journey)}
                            aria-label={`Delete ${journey.name}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>

            <PaginationBar
              page={pagination.page}
              perPage={pagination.per_page}
              total={pagination.total}
              lastPage={pagination.last_page}
              onPageChange={(page) => onFilterChange({ page })}
              onPerPageChange={(per_page) => onFilterChange({ per_page, page: 1 })}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ *
 * More Filters (the funnel button next to the task filters)
 * ------------------------------------------------------------------ */

export interface TaskMoreFilters {
  owner_id: string
  status: string
  due_from: string
  due_to: string
  overdue_only: boolean
}

export function TaskFiltersSheet({
  open,
  value,
  options,
  onApply,
  onReset,
  onClose,
}: {
  open: boolean
  value: TaskMoreFilters
  options: OnbFilterOptions | null
  onApply: (filters: TaskMoreFilters) => void
  onReset: () => void
  onClose: () => void
}) {
  const [draft, setDraft] = React.useState(value)
  const [lastOpen, setLastOpen] = React.useState(open)

  // Re-seed the draft each time the sheet opens, so a cancelled edit is dropped.
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) setDraft(value)
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="w-full max-w-md sm:max-w-md">
        <SheetHeader>
          <SheetTitle>More Filters</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Owner</Label>
            <Select
              value={draft.owner_id}
              options={withAll(options?.owners ?? [], 'All Owners')}
              onChange={(next) => setDraft((state) => ({ ...state, owner_id: next }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Status</Label>
            <Select
              value={draft.status}
              options={withAll(options?.task_statuses ?? [], 'All Statuses')}
              onChange={(next) => setDraft((state) => ({ ...state, status: next }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Due from</Label>
              <DatePicker
                value={draft.due_from || undefined}
                onChange={(next) => setDraft((state) => ({ ...state, due_from: dateValue(next) }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Due to</Label>
              <DatePicker
                value={draft.due_to || undefined}
                onChange={(next) => setDraft((state) => ({ ...state, due_to: dateValue(next) }))}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={draft.overdue_only}
              onCheckedChange={(checked) => setDraft((state) => ({ ...state, overdue_only: checked === true }))}
            />
            Overdue tasks only
          </label>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={onReset}>
            Reset all
          </Button>
          <Button onClick={() => onApply(draft)}>Apply filters</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ *
 * Documents ("View all" on the sidebar card)
 * ------------------------------------------------------------------ */

export function DocumentsSheet({
  open,
  documents,
  options,
  saving,
  journeyName,
  onClose,
  onCreate,
  onUpload,
  onStatusChange,
  onDelete,
}: {
  open: boolean
  documents: OnbDocument[]
  options: OnbFilterOptions | null
  saving: boolean
  journeyName: string | null
  onClose: () => void
  onCreate: (payload: DocumentPayload) => void
  onUpload: (documentId: number, file: File) => void
  onStatusChange: (documentId: number, status: OnbDocument['status']) => void
  onDelete: (documentId: number) => void
}) {
  const [title, setTitle] = React.useState('')
  const [typeId, setTypeId] = React.useState(ALL)
  const [dueDate, setDueDate] = React.useState('')
  const fileInputs = React.useRef<Record<number, HTMLInputElement | null>>({})

  const [lastOpen, setLastOpen] = React.useState(open)

  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setTitle('')
      setTypeId(ALL)
      setDueDate('')
    }
  }

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent side="right" className="w-full max-w-2xl sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Documents{journeyName ? ` — ${journeyName}` : ''}</SheetTitle>
        </SheetHeader>

        <div className="flex max-h-[calc(100vh-9rem)] flex-col gap-4 overflow-y-auto py-4 pr-1 custom-scrollbar">
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3">
            <p className="text-xs font-semibold text-foreground">Request a document</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input
                placeholder="Document title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <Select
                value={typeId}
                options={withAll(options?.document_types ?? [], 'No type')}
                onChange={setTypeId}
              />
              <DatePicker
                value={dueDate || undefined}
                placeholder="Due date"
                onChange={(value) => setDueDate(dateValue(value))}
              />
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={!title.trim() || saving}
                onClick={() => {
                  onCreate({
                    title: title.trim(),
                    document_type_id: typeId === ALL ? null : Number(typeId),
                    due_date: dueDate || null,
                  })
                  setTitle('')
                  setTypeId(ALL)
                  setDueDate('')
                }}
              >
                Add request
              </Button>
            </div>
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Document</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-40 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.length === 0 && (
                  <TableMessageRow
                    colSpan={4}
                    title="No documents requested yet"
                    description="Add a request above to start tracking it."
                  />
                )}

                {documents.map((document) => (
                  <TableRow key={document.id}>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                        <div className="flex flex-col">
                          {document.url ? (
                            <a
                              href={document.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              {document.file_name ?? document.title}
                            </a>
                          ) : (
                            <span className="text-sm font-medium text-foreground">{document.title}</span>
                          )}
                          {document.document_type && (
                            <span className="text-[10px] text-muted-foreground">{document.document_type}</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-sm text-muted-foreground">
                      {document.due_date_label ?? '—'}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="w-[140px]">
                        <Select
                          size="sm"
                          value={document.status}
                          options={options?.document_statuses ?? []}
                          onChange={(value) => onStatusChange(document.id, value as OnbDocument['status'])}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="file"
                          className="hidden"
                          ref={(element) => {
                            fileInputs.current[document.id] = element
                          }}
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            if (file) onUpload(document.id, file)
                            event.target.value = ''
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          disabled={saving}
                          onClick={() => fileInputs.current[document.id]?.click()}
                          aria-label={`Upload ${document.title}`}
                        >
                          <Upload className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive"
                          disabled={saving}
                          onClick={() => onDelete(document.id)}
                          aria-label={`Delete ${document.title}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ *
 * Key Contacts ("View all" on the sidebar card)
 * ------------------------------------------------------------------ */

export function ContactsSheet({
  open,
  contacts,
  journeyName,
  onClose,
  onAssign,
}: {
  open: boolean
  contacts: OnbContact[]
  journeyName: string | null
  onClose: () => void
  onAssign: () => void
}) {
  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent side="right" className="w-full max-w-md sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Key Contacts{journeyName ? ` — ${journeyName}` : ''}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-3 py-4">
          {contacts.length === 0 && (
            <div className="rounded-lg border border-dashed px-4 py-10 text-center">
              <p className="text-sm font-semibold text-foreground">No contacts assigned</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Contacts come from the journey&apos;s reporting manager, buddy and HR owner.
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={onAssign}>
                Assign manager or buddy
              </Button>
            </div>
          )}

          {contacts.map((contact) => (
            <div key={contact.id} className="flex items-start justify-between rounded-lg border p-3">
              <div className="flex items-start gap-3">
                <Initials value={contact.initials} className="size-9 text-xs" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-medium text-muted-foreground">{contact.role}</span>
                  <span className="text-sm font-semibold text-foreground">{contact.name}</span>
                  {contact.designation && (
                    <span className="text-[10px] text-muted-foreground">{contact.designation}</span>
                  )}
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} className="text-[11px] text-primary hover:underline">
                      {contact.email}
                    </a>
                  )}
                  {contact.mobile && (
                    <a href={`tel:${contact.mobile}`} className="text-[11px] text-muted-foreground hover:underline">
                      {contact.mobile}
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}

          {contacts.length > 0 && (
            <Button variant="outline" size="sm" onClick={onAssign}>
              Change manager or buddy
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ *
 * Notes ("View all" / "Add Note" on the sidebar card)
 * ------------------------------------------------------------------ */

export function NotesSheet({
  open,
  notes,
  saving,
  journeyName,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: {
  open: boolean
  notes: OnbNote[]
  saving: boolean
  journeyName: string | null
  onClose: () => void
  onCreate: (payload: NotePayload) => void
  onUpdate: (id: number, payload: NotePayload) => void
  onDelete: (id: number) => void
}) {
  const [draft, setDraft] = React.useState('')
  const [visibility, setVisibility] = React.useState<'internal' | 'shared'>('internal')
  const [editingId, setEditingId] = React.useState<number | null>(null)
  const [editingBody, setEditingBody] = React.useState('')

  const [lastOpen, setLastOpen] = React.useState(open)

  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setDraft('')
      setVisibility('internal')
      setEditingId(null)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent side="right" className="w-full max-w-md sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Notes{journeyName ? ` — ${journeyName}` : ''}</SheetTitle>
        </SheetHeader>

        <div className="flex max-h-[calc(100vh-9rem)] flex-col gap-4 overflow-y-auto py-4 pr-1 custom-scrollbar">
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3">
            <Textarea
              rows={3}
              placeholder="Add a note about this hire..."
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <div className="flex items-center justify-between gap-2">
              <div className="w-[150px]">
                <Select
                  size="sm"
                  value={visibility}
                  options={[
                    { value: 'internal', label: 'Internal' },
                    { value: 'shared', label: 'Shared with hire' },
                  ]}
                  onChange={(value) => setVisibility(value as 'internal' | 'shared')}
                />
              </div>
              <Button
                size="sm"
                disabled={!draft.trim() || saving}
                onClick={() => {
                  onCreate({ note: draft.trim(), visibility })
                  setDraft('')
                }}
              >
                Add note
              </Button>
            </div>
          </div>

          {notes.length === 0 && (
            <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              No notes added yet.
            </p>
          )}

          {notes.map((note) => (
            <div key={note.id} className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Initials value={note.initials} />
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-foreground">{note.author_name ?? 'Unknown'}</span>
                    <span className="text-[10px] text-muted-foreground">{note.created_label}</span>
                  </div>
                </div>
                <StatusBadge variant={note.visibility === 'shared' ? 'processing' : 'default'} size="sm">
                  {note.visibility === 'shared' ? 'Shared' : 'Internal'}
                </StatusBadge>
              </div>

              {editingId === note.id ? (
                <>
                  <Textarea
                    rows={3}
                    value={editingBody}
                    onChange={(event) => setEditingBody(event.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={!editingBody.trim() || saving}
                      onClick={() => {
                        onUpdate(note.id, { note: editingBody.trim() })
                        setEditingId(null)
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-sm text-foreground">{note.note}</p>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingId(note.id)
                        setEditingBody(note.note)
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive"
                      disabled={saving}
                      onClick={() => onDelete(note.id)}
                      aria-label="Delete note"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ *
 * Probation decision (confirm / extend / terminate)
 * ------------------------------------------------------------------ */

export function ProbationDecisionDialog({
  open,
  row,
  decision,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean
  row: OnbProbation | null
  decision: 'confirm' | 'extend' | 'terminate'
  saving: boolean
  onClose: () => void
  onSubmit: (payload: { effective_date?: string | null; notes?: string | null; extension_end?: string }) => void
}) {
  const [effectiveDate, setEffectiveDate] = React.useState('')
  const [extensionEnd, setExtensionEnd] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const signature = open ? `open:${row?.id ?? 'none'}:${decision}` : 'closed'
  const [lastSignature, setLastSignature] = React.useState(signature)

  if (signature !== lastSignature) {
    setLastSignature(signature)
    if (open) {
      setEffectiveDate('')
      setExtensionEnd('')
      setNotes('')
      setError(null)
    }
  }

  const heading =
    decision === 'confirm' ? 'Confirm Employee' : decision === 'extend' ? 'Extend Probation' : 'Terminate Probation'

  const submit = () => {
    // Mirrors the Laravel rule: extension_end is required and must be after the
    // current probation end.
    if (decision === 'extend') {
      if (!extensionEnd) {
        setError('A new probation end date is required.')
        return
      }
      if (row?.probation_end && extensionEnd <= row.probation_end) {
        setError(`The new end date must be after ${row.probation_end}.`)
        return
      }
    }

    onSubmit({
      effective_date: effectiveDate || null,
      notes: notes.trim() || null,
      ...(decision === 'extend' ? { extension_end: extensionEnd } : {}),
    })
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {row && (
            <div className="rounded-lg border bg-muted/20 p-3 text-xs">
              <p className="font-semibold text-foreground">{row.name}</p>
              <p className="text-muted-foreground">
                {row.position ?? '—'} · Probation {row.probation_label ?? '—'}
              </p>
            </div>
          )}

          {decision === 'terminate' && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <p className="text-xs text-destructive">
                This closes the journey as cancelled and cannot be undone from this screen.
              </p>
            </div>
          )}

          {decision === 'extend' && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                New probation end<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <DatePicker
                value={extensionEnd || undefined}
                onChange={(value) => setExtensionEnd(dateValue(value))}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Effective date</Label>
            <DatePicker
              value={effectiveDate || undefined}
              placeholder="Defaults to today"
              onChange={(value) => setEffectiveDate(dateValue(value))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Notes</Label>
            <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>

          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={decision === 'terminate' ? 'destructive' : 'default'} onClick={submit} disabled={saving}>
            {heading}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ *
 * Probation window editor
 * ------------------------------------------------------------------ */

export function ProbationWindowDialog({
  open,
  row,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean
  row: OnbProbation | OnbJourney | null
  saving: boolean
  onClose: () => void
  onSubmit: (payload: { probation_start: string; probation_end: string }) => void
}) {
  const [start, setStart] = React.useState('')
  const [end, setEnd] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const signature = open ? `open:${row?.id ?? 'none'}` : 'closed'
  const [lastSignature, setLastSignature] = React.useState(signature)

  if (signature !== lastSignature) {
    setLastSignature(signature)
    if (open) {
      setStart(row?.probation_start ?? '')
      setEnd(row?.probation_end ?? '')
      setError(null)
    }
  }

  const submit = () => {
    if (!start || !end) {
      setError('Both dates are required.')
      return
    }
    if (end < start) {
      setError('Probation end must be on or after the start date.')
      return
    }
    onSubmit({ probation_start: start, probation_end: end })
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Set Probation Window</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Start<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <DatePicker value={start || undefined} onChange={(value) => setStart(dateValue(value))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                End<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <DatePicker value={end || undefined} onChange={(value) => setEnd(dateValue(value))} />
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            For a hire who already has an employee record, this also updates their probation dates on the HR master.
          </p>

          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            Save window
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ *
 * Journey stage editor
 * ------------------------------------------------------------------ */

export function StageDialog({
  open,
  stage,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean
  stage: { id: number; title: string; start_date: string | null; end_date: string | null; status: string; notes: string | null } | null
  saving: boolean
  onClose: () => void
  onSubmit: (payload: { title: string; start_date: string | null; end_date: string | null; notes: string | null }) => void
}) {
  const [title, setTitle] = React.useState('')
  const [start, setStart] = React.useState('')
  const [end, setEnd] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const signature = open ? `open:${stage?.id ?? 'none'}` : 'closed'
  const [lastSignature, setLastSignature] = React.useState(signature)

  if (signature !== lastSignature) {
    setLastSignature(signature)
    if (open) {
      setTitle(stage?.title ?? '')
      setStart(stage?.start_date ?? '')
      setEnd(stage?.end_date ?? '')
      setNotes(stage?.notes ?? '')
      setError(null)
    }
  }

  const submit = () => {
    if (!title.trim()) {
      setError('Stage title is required.')
      return
    }
    if (start && end && end < start) {
      setError('End date must be on or after the start date.')
      return
    }
    onSubmit({
      title: title.trim(),
      start_date: start || null,
      end_date: end || null,
      notes: notes.trim() || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Journey Stage</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              Stage<span className="ml-0.5 text-destructive">*</span>
            </Label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Start</Label>
              <DatePicker value={start || undefined} onChange={(value) => setStart(dateValue(value))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">End</Label>
              <DatePicker value={end || undefined} onChange={(value) => setEnd(dateValue(value))} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Notes</Label>
            <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>

          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            Save stage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ *
 * Reusable confirm dialog (deletes and bulk actions)
 * ------------------------------------------------------------------ */

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive,
  saving,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  destructive?: boolean
  saving: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {description && <p className="py-2 text-sm text-muted-foreground">{description}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={destructive ? 'destructive' : 'default'} onClick={onConfirm} disabled={saving}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Loading placeholder for the sidebar cards. */
export function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  )
}

export { confirmationVariant, documentStatusVariant }
