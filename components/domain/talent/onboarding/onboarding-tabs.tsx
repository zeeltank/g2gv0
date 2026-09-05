'use client'

/**
 * The three views behind the tabs the original screen declared but never
 * rendered: Onboarding Journey, Probation & Confirmation and Lifecycle Timeline.
 * The Preboarding tab stays in onboarding-center.tsx, since it is the layout the
 * design leads with.
 */

import * as React from 'react'
import {
  BookOpen,
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
  OnbAssetPayload,
  OnbBenefitPayload,
  OnbFilterOptions,
  OnbJourney,
  OnbPagination,
  OnbProbation,
  OnbStage,
  OnbTimeline,
  OnbWorkstreamData,
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
    /*
     * NO PICKER HERE. The centre renders ONE "no hire selected" state above the
     * tabs, so this returns nothing rather than repeating the same card and the
     * same Browse button in every tab. Four identical empty states, each with
     * its own copy of a control the header dropdown already carries, is the
     * duplication this removes.
     */
    return null
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
    /*
     * NO PICKER HERE. The centre renders ONE "no hire selected" state above the
     * tabs, so this returns nothing rather than repeating the same card and the
     * same Browse button in every tab. Four identical empty states, each with
     * its own copy of a control the header dropdown already carries, is the
     * duplication this removes.
     */
    return null
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

/* ------------------------------------------------------------------ *
 * The five onboarding workstreams
 *
 * The cards on the Preboarding tab report task COUNTS - "3 of 4 done".
 * This is the evidence behind them: which laptop and its serial, which
 * policy version was signed, whether payroll can actually run.
 *
 * HR completes everything; `owner_label` on the seeded tasks names the
 * accountable team as information, so nothing here is gated on a role.
 * ------------------------------------------------------------------ */

/** The policies a new hire signs, and the version they are signing. */
const ONBOARDING_POLICIES: Array<{ key: string; title: string; version: string }> = [
  { key: 'handbook', title: 'Employee handbook', version: '1.0' },
  { key: 'code_of_conduct', title: 'Code of conduct', version: '1.0' },
  { key: 'it_acceptable_use', title: 'IT acceptable use policy', version: '1.0' },
  { key: 'data_protection', title: 'Data protection and confidentiality', version: '1.0' },
  { key: 'posh', title: 'Prevention of sexual harassment (POSH)', version: '1.0' },
  { key: 'leave_attendance', title: 'Leave and attendance policy', version: '1.0' },
]

/** The nine payroll columns, in the order a finance team fills them. */
const PAYROLL_FIELDS: Array<{ name: string; label: string; hint?: string }> = [
  { name: 'bank_name', label: 'Bank name' },
  { name: 'branch_name', label: 'Branch' },
  { name: 'account_no', label: 'Account number' },
  { name: 'ifsc_code', label: 'IFSC code' },
  { name: 'pan_no', label: 'PAN', hint: 'ABCDE1234F' },
  { name: 'aadhar_no', label: 'Aadhaar', hint: '12 digits' },
  { name: 'uan_no', label: 'UAN', hint: '12 digits' },
  { name: 'pf_no', label: 'PF number' },
  { name: 'esic_no', label: 'ESIC number', hint: 'if applicable' },
]

const PAYROLL_FLAGS: Array<{ name: string; label: string }> = [
  { name: 'pf_deduction', label: 'Deduct PF' },
  { name: 'tds_deduction', label: 'Deduct TDS' },
  { name: 'pt_deduction', label: 'Deduct professional tax' },
]

const WORKSTREAM_COPY: Record<WorkstreamKey, { title: string; owner: string; blurb: string }> = {
  it: {
    title: 'IT Provisioning',
    owner: 'IT',
    blurb: 'Devices, accounts and access, recorded by serial number so they can be reclaimed at exit.',
  },
  payroll: {
    title: 'Payroll Setup',
    owner: 'Finance',
    blurb: 'Bank, PAN, Aadhaar and UAN. These write to the employee record the Directory reads.',
  },
  benefits: {
    title: 'Benefits Enrollment',
    owner: 'HR',
    blurb: 'Cover, policy number and nominee, recorded per benefit.',
  },
  compliance: {
    title: 'Compliance',
    owner: 'HR',
    blurb: 'Policy acknowledgements, stamped with the version signed - v1 signed is not v3 signed.',
  },
  learning: {
    title: 'Learning & Training',
    owner: 'Manager',
    blurb: "Assigned automatically from the hire's job role. Shown here; managed in Learning.",
  },
}

export type WorkstreamKey = 'it' | 'payroll' | 'benefits' | 'compliance' | 'learning'

/** A labelled field, so the four capture forms stay visually identical. */
function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-foreground">
        {label}
        {hint && <span className="ml-1 font-normal text-muted-foreground">({hint})</span>}
      </span>
      {children}
    </label>
  )
}

function dash(value: string | null | undefined) {
  return value && String(value).trim() !== '' ? String(value) : '—'
}

export function WorkstreamPanel({
  panel,
  data,
  journeyId,
  saving,
  onIssueAsset,
  onReturnAsset,
  onEnrolBenefit,
  onAcknowledgePolicy,
  onSavePayroll,
}: {
  panel: WorkstreamKey
  data: OnbWorkstreamData
  journeyId: number
  saving: boolean
  onIssueAsset: (journeyId: number, payload: OnbAssetPayload) => void
  onReturnAsset: (assetId: number) => void
  onEnrolBenefit: (journeyId: number, payload: OnbBenefitPayload) => void
  onAcknowledgePolicy: (journeyId: number, payload: { policy_key: string; policy_title: string; policy_version: string }) => void
  onSavePayroll: (journeyId: number, payload: Record<string, string | boolean>) => void
}) {
  const copy = WORKSTREAM_COPY[panel]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
        <div className="flex flex-col">
          <h4 className="text-sm font-bold text-foreground">{copy.title}</h4>
          <p className="text-[11px] text-muted-foreground">{copy.blurb}</p>
        </div>
        <span className="rounded bg-muted/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          Owner: {copy.owner}
        </span>
      </div>

      {panel === 'it' && (
        <AssetsPanel
          assets={data.assets}
          types={data.options.asset_types}
          journeyId={journeyId}
          saving={saving}
          onIssue={onIssueAsset}
          onReturn={onReturnAsset}
        />
      )}

      {panel === 'benefits' && (
        <BenefitsPanel
          benefits={data.benefits}
          types={data.options.benefit_types}
          journeyId={journeyId}
          saving={saving}
          onEnrol={onEnrolBenefit}
        />
      )}

      {panel === 'compliance' && (
        <CompliancePanel
          policies={data.policies}
          journeyId={journeyId}
          saving={saving}
          onAcknowledge={onAcknowledgePolicy}
        />
      )}

      {panel === 'payroll' && (
        /* Remounts when the saved values change, so the inputs re-seed from
           the server without an effect that writes state during render. */
        <PayrollPanel
          key={JSON.stringify(data.payroll.fields)}
          payroll={data.payroll}
          journeyId={journeyId}
          saving={saving}
          onSave={onSavePayroll}
        />
      )}

      {panel === 'learning' && <LearningPanel learning={data.learning} />}
    </div>
  )
}

/* ---- IT Provisioning ---------------------------------------------- */

function AssetsPanel({
  assets,
  types,
  journeyId,
  saving,
  onIssue,
  onReturn,
}: {
  assets: OnbWorkstreamData['assets']
  types: Record<string, string>
  journeyId: number
  saving: boolean
  onIssue: (journeyId: number, payload: OnbAssetPayload) => void
  onReturn: (assetId: number) => void
}) {
  const [assetType, setAssetType] = React.useState('laptop')
  const [makeModel, setMakeModel] = React.useState('')
  const [serialNo, setSerialNo] = React.useState('')
  const [issuedOn, setIssuedOn] = React.useState('')

  const typeOptions = Object.entries(types).map(([value, label]) => ({ value, label }))

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 rounded-md border border-border/60 bg-muted/20 p-3 md:grid-cols-5">
        <Field label="Asset">
          <Select size="sm" value={assetType} options={typeOptions} onChange={setAssetType} />
        </Field>
        <Field label="Make / model">
          <Input
            className="h-8 text-xs"
            value={makeModel}
            placeholder="ThinkPad T14"
            onChange={(event) => setMakeModel(event.target.value)}
          />
        </Field>
        <Field label="Serial number" hint="what makes this a register">
          <Input
            className="h-8 text-xs"
            value={serialNo}
            placeholder="SN-000000"
            onChange={(event) => setSerialNo(event.target.value)}
          />
        </Field>
        <Field label="Issued on">
          <Input
            type="date"
            className="h-8 text-xs"
            value={issuedOn}
            onChange={(event) => setIssuedOn(event.target.value)}
          />
        </Field>
        <div className="flex items-end">
          <Button
            size="sm"
            className="h-8 w-full"
            disabled={saving || !assetType}
            onClick={() => {
              onIssue(journeyId, {
                asset_type: assetType,
                make_model: makeModel || undefined,
                serial_no: serialNo || undefined,
                issued_on: issuedOn || undefined,
              })
              setMakeModel('')
              setSerialNo('')
            }}
          >
            Issue asset
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Asset</TableHead>
            <TableHead className="text-xs">Make / model</TableHead>
            <TableHead className="text-xs">Serial</TableHead>
            <TableHead className="text-xs">Issued</TableHead>
            <TableHead className="text-xs">Status</TableHead>
            <TableHead className="w-20 text-right text-xs">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.length === 0 && <TableMessageRow colSpan={6} title="Nothing issued to this hire yet." />}
          {assets.map((asset) => (
            <TableRow key={asset.id}>
              <TableCell className="text-xs font-semibold">{asset.type_label}</TableCell>
              <TableCell className="text-xs">{dash(asset.make_model)}</TableCell>
              <TableCell className="font-mono text-xs">{dash(asset.serial_no)}</TableCell>
              <TableCell className="text-xs">{dash(asset.issued_on)}</TableCell>
              <TableCell>
                <StatusBadge variant={asset.status === 'issued' ? 'active' : 'inactive'}>{asset.status}</StatusBadge>
              </TableCell>
              <TableCell className="text-right">
                {asset.status === 'issued' ? (
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={saving} onClick={() => onReturn(asset.id)}>
                    <RotateCcw className="mr-1 size-3" />
                    Return
                  </Button>
                ) : (
                  <span className="text-[11px] text-muted-foreground">{dash(asset.returned_on)}</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/* ---- Benefits Enrollment ------------------------------------------ */

function BenefitsPanel({
  benefits,
  types,
  journeyId,
  saving,
  onEnrol,
}: {
  benefits: OnbWorkstreamData['benefits']
  types: Record<string, string>
  journeyId: number
  saving: boolean
  onEnrol: (journeyId: number, payload: OnbBenefitPayload) => void
}) {
  const [benefitType, setBenefitType] = React.useState('health')
  const [provider, setProvider] = React.useState('')
  const [policyNo, setPolicyNo] = React.useState('')
  const [coverage, setCoverage] = React.useState('')
  const [effectiveFrom, setEffectiveFrom] = React.useState('')
  const [nomineeName, setNomineeName] = React.useState('')
  const [nomineeRelation, setNomineeRelation] = React.useState('')

  const typeOptions = Object.entries(types).map(([value, label]) => ({ value, label }))

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 rounded-md border border-border/60 bg-muted/20 p-3 md:grid-cols-4">
        <Field label="Benefit">
          <Select size="sm" value={benefitType} options={typeOptions} onChange={setBenefitType} />
        </Field>
        <Field label="Provider">
          <Input className="h-8 text-xs" value={provider} onChange={(event) => setProvider(event.target.value)} />
        </Field>
        <Field label="Policy number">
          <Input className="h-8 text-xs" value={policyNo} onChange={(event) => setPolicyNo(event.target.value)} />
        </Field>
        <Field label="Coverage">
          <Input
            className="h-8 text-xs"
            inputMode="decimal"
            value={coverage}
            placeholder="500000"
            onChange={(event) => setCoverage(event.target.value)}
          />
        </Field>
        <Field label="Effective from">
          <Input
            type="date"
            className="h-8 text-xs"
            value={effectiveFrom}
            onChange={(event) => setEffectiveFrom(event.target.value)}
          />
        </Field>
        <Field label="Nominee">
          <Input className="h-8 text-xs" value={nomineeName} onChange={(event) => setNomineeName(event.target.value)} />
        </Field>
        <Field label="Relationship">
          <Input
            className="h-8 text-xs"
            value={nomineeRelation}
            placeholder="Spouse"
            onChange={(event) => setNomineeRelation(event.target.value)}
          />
        </Field>
        <div className="flex items-end">
          <Button
            size="sm"
            className="h-8 w-full"
            disabled={saving || !benefitType}
            onClick={() => {
              onEnrol(journeyId, {
                benefit_type: benefitType,
                provider: provider || undefined,
                policy_no: policyNo || undefined,
                coverage_amount: coverage || undefined,
                effective_from: effectiveFrom || undefined,
                nominee_name: nomineeName || undefined,
                nominee_relation: nomineeRelation || undefined,
              })
              setProvider('')
              setPolicyNo('')
              setCoverage('')
              setNomineeName('')
              setNomineeRelation('')
            }}
          >
            Enrol
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Benefit</TableHead>
            <TableHead className="text-xs">Provider</TableHead>
            <TableHead className="text-xs">Policy</TableHead>
            <TableHead className="text-xs">Coverage</TableHead>
            <TableHead className="text-xs">Nominee</TableHead>
            <TableHead className="text-xs">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {benefits.length === 0 && <TableMessageRow colSpan={6} title="No benefits enrolled yet." />}
          {benefits.map((benefit) => (
            <TableRow key={benefit.id}>
              <TableCell className="text-xs font-semibold">{benefit.type_label}</TableCell>
              <TableCell className="text-xs">{dash(benefit.provider)}</TableCell>
              <TableCell className="font-mono text-xs">{dash(benefit.policy_no)}</TableCell>
              <TableCell className="text-xs">{dash(benefit.coverage_amount)}</TableCell>
              <TableCell className="text-xs">
                {dash(benefit.nominee_name)}
                {benefit.nominee_relation && (
                  <span className="ml-1 text-muted-foreground">({benefit.nominee_relation})</span>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge variant={benefit.status === 'enrolled' ? 'success' : 'pending'}>
                  {benefit.status}
                </StatusBadge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/* ---- Compliance ---------------------------------------------------- */

function CompliancePanel({
  policies,
  journeyId,
  saving,
  onAcknowledge,
}: {
  policies: OnbWorkstreamData['policies']
  journeyId: number
  saving: boolean
  onAcknowledge: (journeyId: number, payload: { policy_key: string; policy_title: string; policy_version: string }) => void
}) {
  /*
   * Signed is signed FOR A VERSION. Looking the acknowledgement up by key
   * alone would show a re-issued handbook as already signed, which is the
   * failure the version column exists to prevent.
   */
  const signed = new Map(policies.map((row) => [`${row.policy_key}@${row.policy_version}`, row]))

  return (
    <div className="flex flex-col gap-2">
      {ONBOARDING_POLICIES.map((policy) => {
        const ack = signed.get(`${policy.key}@${policy.version}`)
        return (
          <div
            key={policy.key}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-2">
              {ack ? (
                <CheckCircle2 className="size-4 shrink-0 text-success" />
              ) : (
                <Circle className="size-4 shrink-0 text-muted-foreground/50" />
              )}
              <div className="flex min-w-0 flex-col">
                <span className="text-xs font-semibold text-foreground">{policy.title}</span>
                <span className="text-[10px] text-muted-foreground">
                  Version {policy.version}
                  {ack?.acknowledged_at && ` · signed ${ack.acknowledged_at}`}
                </span>
              </div>
            </div>
            {ack ? (
              <StatusBadge variant="success">Acknowledged</StatusBadge>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                disabled={saving}
                onClick={() =>
                  onAcknowledge(journeyId, {
                    policy_key: policy.key,
                    policy_title: policy.title,
                    policy_version: policy.version,
                  })
                }
              >
                <ShieldCheck className="mr-1 size-3" />
                Record acknowledgement
              </Button>
            )}
          </div>
        )
      })}

      {/* Acknowledgements of versions no longer offered above still happened,
          and hiding them would lose the audit trail. */}
      {policies
        .filter((row) => !ONBOARDING_POLICIES.some((p) => p.key === row.policy_key && p.version === row.policy_version))
        .map((row) => (
          <div
            key={row.id}
            className="flex items-center justify-between gap-2 rounded-md border border-dashed border-border/60 px-3 py-2"
          >
            <span className="text-xs text-muted-foreground">
              {row.policy_title || row.policy_key} · v{row.policy_version}
            </span>
            <span className="text-[10px] text-muted-foreground">{dash(row.acknowledged_at)}</span>
          </div>
        ))}
    </div>
  )
}

/* ---- Payroll Setup -------------------------------------------------- */

function PayrollPanel({
  payroll,
  journeyId,
  saving,
  onSave,
}: {
  payroll: OnbWorkstreamData['payroll']
  journeyId: number
  saving: boolean
  onSave: (journeyId: number, payload: Record<string, string | boolean>) => void
}) {
  const seed = payroll.fields ?? {}
  const seeded = (name: string) => String(seed[name] ?? '')
  /* tbluser stores the deduction flags as 1/0, but older rows hold '1'/''. */
  const seededFlag = (name: string) => ['1', 'true', 'yes'].includes(seeded(name).toLowerCase())

  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(PAYROLL_FIELDS.map((field) => [field.name, seeded(field.name)])),
  )
  const [flags, setFlags] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(PAYROLL_FLAGS.map((flag) => [flag.name, seededFlag(flag.name)])),
  )

  const set = (name: string, value: string) => setValues((current) => ({ ...current, [name]: value }))

  /*
   * Only what CHANGED is sent, so an untouched field cannot blank a value
   * captured elsewhere - the Employee Directory writes these same columns.
   */
  const changes: Record<string, string | boolean> = {}
  for (const field of PAYROLL_FIELDS) {
    const next = (values[field.name] ?? '').trim()
    if (next !== seeded(field.name)) changes[field.name] = next
  }
  for (const flag of PAYROLL_FLAGS) {
    const next = flags[flag.name] ?? false
    if (next !== seededFlag(flag.name)) changes[flag.name] = next
  }
  const dirty = Object.keys(changes).length > 0

  return (
    <div className="flex flex-col gap-3">
      {payroll.employee_id ? (
        <div
          className={cn(
            'rounded-md px-3 py-2 text-[11px]',
            payroll.complete ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning-foreground',
          )}
        >
          {payroll.complete
            ? 'Payroll can run for this hire: bank, account, IFSC and PAN are all recorded.'
            : `Payroll cannot run yet - still missing ${payroll.missing.join(', ')}.`}
        </div>
      ) : (
        <div className="rounded-md bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
          This journey has no employee record yet, so payroll details have nowhere to be written. Convert the offer
          first.
        </div>
      )}

      <div className="grid gap-2 md:grid-cols-3">
        {PAYROLL_FIELDS.map((field) => (
          <Field key={field.name} label={field.label} hint={field.hint}>
            <Input
              className="h-8 text-xs"
              value={values[field.name] ?? ''}
              disabled={!payroll.employee_id}
              onChange={(event) => set(field.name, event.target.value)}
            />
          </Field>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {PAYROLL_FLAGS.map((flag) => (
          <label key={flag.name} className="flex items-center gap-2 text-xs text-foreground">
            <Checkbox
              checked={flags[flag.name] ?? false}
              disabled={!payroll.employee_id}
              onCheckedChange={(checked) => setFlags((current) => ({ ...current, [flag.name]: checked === true }))}
            />
            {flag.label}
          </label>
        ))}
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={saving || !payroll.employee_id || !dirty}
          onClick={() => onSave(journeyId, changes)}
        >
          {dirty ? `Save ${Object.keys(changes).length} change${Object.keys(changes).length === 1 ? '' : 's'}` : 'Saved'}
        </Button>
      </div>
    </div>
  )
}

/* ---- Learning & Training -------------------------------------------- */

function LearningPanel({ learning }: { learning: OnbWorkstreamData['learning'] }) {
  return (
    <div className="flex flex-col gap-3">
      {/* READ-ONLY on purpose. A second list of "what this person must learn"
          would drift from the role mapping that produced the first one. */}
      <div className="flex items-center gap-3 rounded-md bg-muted/30 px-3 py-2">
        <BookOpen className="size-4 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">
          {learning.total === 0
            ? "No courses assigned yet. They are assigned automatically from the hire's job role once it is set."
            : `${learning.completed} of ${learning.total} assigned course${learning.total === 1 ? '' : 's'} completed.`}
        </span>
      </div>

      {learning.courses.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Course</TableHead>
              <TableHead className="w-32 text-xs">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {learning.courses.map((course) => (
              <TableRow key={course.id}>
                <TableCell className="text-xs">{course.course}</TableCell>
                <TableCell>
                  <StatusBadge variant={course.status.toLowerCase() === 'completed' ? 'success' : 'processing'}>
                    {course.status}
                  </StatusBadge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
