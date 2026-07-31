'use client'

/**
 * The three views behind the tabs the original screen declared but never
 * rendered: Onboarding Journey, Probation & Confirmation and Lifecycle Timeline.
 * The Preboarding tab stays in onboarding-center.tsx, since it is the layout the
 * design leads with.
 */

import * as React from 'react'
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  History,
  Pencil,
  RotateCcw,
  Search,
  ShieldCheck,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
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
import { cn } from '@/lib/utils'
import {
  ALL,
  Initials,
  PaginationBar,
  TableMessageRow,
  TableSkeleton,
  confirmationVariant,
  stageStatusVariant,
} from './onboarding-shared'
import { withAll } from './onboarding-sheets'
import type {
  OnbFilterOptions,
  OnbJourney,
  OnbPagination,
  OnbProbation,
  OnbStage,
  OnbTimeline,
  ProbationFilters,
  ProbationSummary,
} from '@/services/talent/onboarding'

/* ------------------------------------------------------------------ *
 * Tab 2 - Onboarding Journey
 * ------------------------------------------------------------------ */

export function JourneyTab({
  journey,
  stages,
  progress,
  loading,
  error,
  saving,
  onEditStage,
  onToggleStage,
  onRetry,
  onPickJourney,
}: {
  journey: OnbJourney | null
  stages: OnbStage[]
  progress: number
  loading: boolean
  error: string | null
  saving: boolean
  onEditStage: (stage: OnbStage) => void
  onToggleStage: (stage: OnbStage) => void
  onRetry: () => void
  onPickJourney: () => void
}) {
  if (!journey && !loading) {
    return (
      <Card className="shadow-sm">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <CalendarDays className="size-8 text-muted-foreground/40" />
          <p className="text-sm font-semibold text-foreground">No hire selected</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Pick an onboarding journey to see its stage-by-stage plan.
          </p>
          <Button variant="outline" size="sm" onClick={onPickJourney}>
            Browse journeys
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="shadow-sm lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 p-4">
          <CardTitle className="text-base">Journey Stages</CardTitle>
          <span className="text-xs text-muted-foreground">
            {stages.filter((stage) => stage.status === 'completed').length} of {stages.length} complete
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10 pl-4" />
                <TableHead>Stage</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-16 pr-4 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableSkeleton columns={6} rows={7} />}

              {!loading && error && (
                <TableMessageRow
                  colSpan={6}
                  tone="error"
                  title="Could not load journey stages"
                  description={error}
                  action={
                    <Button variant="outline" size="sm" onClick={onRetry}>
                      Retry
                    </Button>
                  }
                />
              )}

              {!loading && !error && stages.length === 0 && (
                <TableMessageRow colSpan={6} title="This journey has no stages yet" />
              )}

              {!loading &&
                !error &&
                stages.map((stage) => (
                  <TableRow key={stage.id}>
                    <TableCell className="py-3 pl-4">
                      <Checkbox
                        checked={stage.status === 'completed'}
                        disabled={saving}
                        onCheckedChange={() => onToggleStage(stage)}
                        aria-label={`Mark ${stage.title} complete`}
                      />
                    </TableCell>
                    <TableCell className="py-3 text-sm font-medium text-foreground">{stage.title}</TableCell>
                    <TableCell className="py-3 text-sm text-muted-foreground">{stage.date_label ?? '—'}</TableCell>
                    <TableCell className="py-3">
                      <StatusBadge variant={stageStatusVariant(stage.status)} size="sm">
                        {stage.status_label}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="py-3 text-xs text-muted-foreground">{stage.notes ?? '—'}</TableCell>
                    <TableCell className="py-3 pr-4 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => onEditStage(stage)}
                        aria-label={`Edit ${stage.title}`}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="flex flex-col shadow-sm">
        <CardHeader className="border-b border-border/40 p-4 pb-3">
          <CardTitle className="text-base">Progress</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Stages complete</span>
              <span className="text-xl font-bold text-primary">{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-border/40 pt-4 text-xs">
            <Row label="Hire" value={journey?.name ?? '—'} />
            <Row label="Journey" value={journey?.journey_code ?? '—'} />
            <Row label="Position" value={journey?.position ?? '—'} />
            <Row label="Department" value={journey?.department ?? '—'} />
            <Row label="Joining" value={journey?.joining_date_label ?? '—'} />
            <Row label="Manager" value={journey?.manager_name ?? '—'} />
            <Row label="Buddy" value={journey?.buddy_name ?? '—'} />
            <Row label="Tasks" value={journey ? `${journey.task_completed}/${journey.task_total}` : '—'} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-semibold text-foreground">{value}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Tab 3 - Probation & Confirmation
 * ------------------------------------------------------------------ */

export function ProbationTab({
  rows,
  pagination,
  summary,
  loading,
  error,
  saving,
  filters,
  options,
  onFilterChange,
  onDecide,
  onEditWindow,
  onRetry,
}: {
  rows: OnbProbation[]
  pagination: OnbPagination
  summary: ProbationSummary | null
  loading: boolean
  error: string | null
  saving: boolean
  filters: ProbationFilters
  options: OnbFilterOptions | null
  onFilterChange: (patch: Partial<ProbationFilters>) => void
  onDecide: (row: OnbProbation, decision: 'confirm' | 'extend' | 'terminate') => void
  onEditWindow: (row: OnbProbation) => void
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryTile label="Total" value={summary?.total} icon={<ShieldCheck className="size-4" />} />
        <SummaryTile label="Pending" value={summary?.pending} icon={<Clock className="size-4" />} />
        <SummaryTile label="Confirmed" value={summary?.confirmed} icon={<CheckCircle2 className="size-4" />} />
        <SummaryTile label="Extended" value={summary?.extended} icon={<RotateCcw className="size-4" />} />
        <SummaryTile label="Terminated" value={summary?.terminated} icon={<Circle className="size-4" />} />
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-col gap-3 border-b border-border/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Probation & Confirmation</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-56">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search hires..."
                value={filters.search ?? ''}
                onChange={(event) => onFilterChange({ search: event.target.value, page: 1 })}
              />
            </div>
            <div className="w-[170px]">
              <Select
                value={filters.confirmation_status ?? ALL}
                options={withAll(options?.confirmation_statuses ?? [], 'All Decisions')}
                onChange={(value) => onFilterChange({ confirmation_status: value, page: 1 })}
              />
            </div>
            <div className="w-[170px]">
              <Select
                value={filters.due_in_days ?? ALL}
                options={[
                  { value: ALL, label: 'Any due date' },
                  { value: '7', label: 'Due in 7 days' },
                  { value: '30', label: 'Due in 30 days' },
                  { value: '90', label: 'Due in 90 days' },
                ]}
                onChange={(value) => onFilterChange({ due_in_days: value, page: 1 })}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Employee</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Joining</TableHead>
                <TableHead>Probation</TableHead>
                <TableHead>Days Left</TableHead>
                <TableHead>Decision</TableHead>
                <TableHead className="pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableSkeleton columns={7} />}

              {!loading && error && (
                <TableMessageRow
                  colSpan={7}
                  tone="error"
                  title="Could not load probation records"
                  description={error}
                  action={
                    <Button variant="outline" size="sm" onClick={onRetry}>
                      Retry
                    </Button>
                  }
                />
              )}

              {!loading && !error && rows.length === 0 && (
                <TableMessageRow
                  colSpan={7}
                  title="No probation records"
                  description="A journey appears here once it has a probation window."
                />
              )}

              {!loading &&
                !error &&
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="py-3 pl-4">
                      <div className="flex items-center gap-2">
                        <Initials value={row.initials} />
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-foreground">{row.name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {row.employee_no ?? row.journey_code}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-sm text-muted-foreground">{row.position ?? '—'}</TableCell>
                    <TableCell className="py-3 text-sm text-muted-foreground">
                      {row.joining_date_label ?? '—'}
                    </TableCell>
                    <TableCell className="py-3 text-sm text-muted-foreground">{row.probation_label ?? '—'}</TableCell>
                    <TableCell className="py-3">
                      <span
                        className={cn(
                          'text-sm font-semibold',
                          row.is_overdue ? 'text-destructive' : 'text-foreground',
                        )}
                      >
                        {row.days_remaining === null
                          ? '—'
                          : row.days_remaining < 0
                            ? `${Math.abs(row.days_remaining)} overdue`
                            : row.days_remaining}
                      </span>
                    </TableCell>
                    <TableCell className="py-3">
                      <StatusBadge variant={confirmationVariant(row.confirmation_status)} size="sm">
                        {row.confirmation_label}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="py-3 pr-4 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" disabled={saving} onClick={() => onEditWindow(row)}>
                          Window
                        </Button>
                        {row.confirmation_status !== 'confirmed' && row.confirmation_status !== 'terminated' && (
                          <>
                            <Button variant="outline" size="sm" disabled={saving} onClick={() => onDecide(row, 'confirm')}>
                              Confirm
                            </Button>
                            <Button variant="ghost" size="sm" disabled={saving} onClick={() => onDecide(row, 'extend')}>
                              Extend
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              disabled={saving}
                              onClick={() => onDecide(row, 'terminate')}
                            >
                              Terminate
                            </Button>
                          </>
                        )}
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
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryTile({ label, value, icon }: { label: string; value?: number; icon: React.ReactNode }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex items-center gap-3 p-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>
        <div className="flex flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
          {value === undefined ? (
            <Skeleton className="mt-1 h-5 w-8" />
          ) : (
            <span className="text-lg font-bold text-foreground">{value}</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ *
 * Tab 4 - Lifecycle Timeline
 * ------------------------------------------------------------------ */

export function TimelineTab({
  journey,
  timeline,
  loading,
  error,
  onRetry,
  onPickJourney,
}: {
  journey: OnbJourney | null
  timeline: OnbTimeline | null
  loading: boolean
  error: string | null
  onRetry: () => void
  onPickJourney: () => void
}) {
  if (!journey && !loading) {
    return (
      <Card className="shadow-sm">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <History className="size-8 text-muted-foreground/40" />
          <p className="text-sm font-semibold text-foreground">No hire selected</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Pick an onboarding journey to see its full employment lifecycle.
          </p>
          <Button variant="outline" size="sm" onClick={onPickJourney}>
            Browse journeys
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="shadow-sm">
        <CardHeader className="border-b border-border/40 p-4">
          <CardTitle className="text-base">Lifecycle Milestones</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          {loading && (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <p className="text-sm font-semibold text-destructive">Could not load the timeline</p>
              <p className="text-xs text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={onRetry}>
                Retry
              </Button>
            </div>
          )}

          {!loading && !error && (timeline?.milestones.length ?? 0) === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No milestones recorded yet.</p>
          )}

          {!loading && !error && (timeline?.milestones.length ?? 0) > 0 && (
            <div className="relative flex flex-col gap-5 pl-6">
              <div className="absolute bottom-2 left-[7px] top-2 w-0.5 bg-border/60" />
              {timeline?.milestones.map((entry) => (
                <div key={entry.id} className="relative">
                  <div className="absolute -left-6 top-1 size-3.5 rounded-full border-2 border-primary bg-background" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-foreground">{entry.title}</span>
                    <span className="text-xs text-muted-foreground">{entry.date_label}</span>
                    {entry.detail && <span className="text-xs text-muted-foreground">{entry.detail}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="border-b border-border/40 p-4">
          <CardTitle className="text-base">Activity Trail</CardTitle>
        </CardHeader>
        <CardContent className="max-h-[560px] overflow-y-auto p-5 custom-scrollbar">
          {loading && (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-8 w-full" />
              ))}
            </div>
          )}

          {!loading && (timeline?.activity.length ?? 0) === 0 && !error && (
            <p className="py-8 text-center text-sm text-muted-foreground">Nothing has happened on this journey yet.</p>
          )}

          {!loading &&
            timeline?.activity.map((entry) => (
              <div key={entry.id} className="flex flex-col gap-0.5 border-b border-border/30 py-2.5 last:border-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">{entry.title}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{entry.date_label}</span>
                </div>
                {entry.detail && <span className="text-xs text-muted-foreground">{entry.detail}</span>}
                {entry.actor && <span className="text-[10px] text-muted-foreground">by {entry.actor}</span>}
                {entry.changes?.map((change) => (
                  <span key={change.field} className="text-[10px] text-muted-foreground">
                    {change.label}: {String(change.old ?? '—')} → {String(change.new ?? '—')}
                  </span>
                ))}
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  )
}
