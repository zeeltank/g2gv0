'use client'

/**
 * The Employee Overview sidebar.
 *
 * Every field is real: the employee bundle, the 5-step stepper, the draft
 * ratings, the details grid, the Quick Actions and the Team Comparison panel all
 * come from GET /performance/reviews/{id} and GET /performance/team-comparison.
 * The panel's inner tabs (Overview / Goals / Reviews / Compensation / Docs /
 * Activity) use explicit id constants - deriving ids from the visible labels is
 * what silently broke two sibling screens' tabs.
 */

import * as React from 'react'
import {
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Edit2,
  Eye,
  LayoutList,
  MapPin,
  Send,
  UserCheck,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type {
  PerfAttachment,
  PerfCompensation,
  PerfGoal,
  PerfNote,
  PerfReviewDetail,
  TeamComparison,
} from '@/services/talent/performance'

import {
  RatingCell,
  StatusBadge,
  decisionStatusVariant,
  formatMoney,
  formatPct,
  goalStatusVariant,
  reviewStatusVariant,
  stageVariant,
} from './performance-shared'

/** Explicit ids - never derived from the labels. */
export const SIDEBAR_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'goals', label: 'Goals' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'compensation', label: 'Compensation' },
  { id: 'docs', label: 'Docs' },
] as const

export type SidebarTabId = (typeof SIDEBAR_TABS)[number]['id']

interface PerformanceSidebarProps {
  detail: PerfReviewDetail | null
  team: TeamComparison | null
  loading: boolean
  error: string | null
  activeTab: SidebarTabId
  onTabChange: (tab: SidebarTabId) => void
  onClose: () => void
  /** Panel-scoped data, fetched by the parent when the matching tab opens. */
  goals: PerfGoal[]
  goalsLoading: boolean
  compensation: PerfCompensation[]
  compensationLoading: boolean
  attachments: PerfAttachment[]
  attachmentsLoading: boolean
  notes: PerfNote[]
  onSendReminder: () => void
  onViewReview: () => void
  onAddNote: (body: string) => void
  onAdvanceStage: () => void
  onOpenTeamDetails: () => void
  onSelectReview: (reviewId: number) => void
  saving: boolean
}

export function PerformanceSidebar({
  detail,
  team,
  loading,
  error,
  activeTab,
  onTabChange,
  onClose,
  goals,
  goalsLoading,
  compensation,
  compensationLoading,
  attachments,
  attachmentsLoading,
  notes,
  onSendReminder,
  onViewReview,
  onAddNote,
  onAdvanceStage,
  onOpenTeamDetails,
  onSelectReview,
  saving,
}: PerformanceSidebarProps) {
  const [noteDraft, setNoteDraft] = React.useState('')
  const [noteOpen, setNoteOpen] = React.useState(false)
  const [moreOpen, setMoreOpen] = React.useState(false)

  if (loading) {
    return (
      <Card className="flex flex-1 flex-col gap-4 p-5 shadow-sm">
        <Skeleton className="h-4 w-32" />
        <div className="flex items-start gap-3">
          <Skeleton className="size-12 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-24 w-full" />
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center shadow-sm">
        <p className="text-sm font-semibold text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </Card>
    )
  }

  if (!detail) {
    return (
      <Card className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center shadow-sm">
        <LayoutList className="size-6 text-muted-foreground" />
        <p className="text-sm font-semibold text-foreground">No employee selected</p>
        <p className="text-xs text-muted-foreground">
          Pick a row in the table to see that employee&apos;s review, ratings and quick actions.
        </p>
      </Card>
    )
  }

  const canAdvance = detail.stage !== 'completed'

  return (
    <Card className="relative flex flex-1 flex-col overflow-hidden shadow-sm">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-6 w-6 text-muted-foreground"
        onClick={onClose}
        aria-label="Close employee overview"
      >
        <X className="size-4" />
      </Button>

      <div className="flex flex-col gap-4 overflow-y-auto p-5 custom-scrollbar">
        <h2 className="text-sm font-semibold text-foreground">Employee Overview</h2>

        {/* Identity */}
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-bold text-muted-foreground">
            {detail.employee.initials}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <h3 className="truncate text-base font-bold text-foreground">{detail.employee.name}</h3>
            <span className="text-xs text-muted-foreground">{detail.employee.employee_no ?? '—'}</span>
            <span className="mt-0.5 text-sm font-medium text-foreground">{detail.jobrole ?? 'Role not mapped'}</span>
          </div>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <LayoutList className="size-3.5" /> {detail.department ?? 'No department'}
          </span>
          {detail.employee.location && (
            <>
              <span className="text-border">|</span>
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5" /> {detail.employee.location}
              </span>
            </>
          )}
          {detail.employee.joined_label && (
            <>
              <span className="text-border">|</span>
              <span className="flex items-center gap-1.5">
                <Calendar className="size-3.5" /> Joined {detail.employee.joined_label}
              </span>
            </>
          )}
        </div>

        {/* Panel tabs */}
        <div className="mt-2 flex items-center gap-4 overflow-x-auto border-b border-border custom-scrollbar">
          {SIDEBAR_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'flex shrink-0 items-center gap-1 pb-2 text-xs font-semibold transition-colors',
                activeTab === tab.id
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
              {tab.id === 'goals' && detail.counts.goals > 0 && ` (${detail.counts.goals})`}
              {tab.id === 'docs' && detail.counts.documents > 0 && ` (${detail.counts.documents})`}
              {tab.id === 'reviews' && detail.counts.reviews > 0 && ` (${detail.counts.reviews})`}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <OverviewTab
            detail={detail}
            team={team}
            canAdvance={canAdvance}
            saving={saving}
            noteOpen={noteOpen}
            noteDraft={noteDraft}
            moreOpen={moreOpen}
            onNoteOpenChange={setNoteOpen}
            onNoteDraftChange={setNoteDraft}
            onMoreOpenChange={setMoreOpen}
            onSendReminder={onSendReminder}
            onViewReview={onViewReview}
            onAdvanceStage={onAdvanceStage}
            onOpenTeamDetails={onOpenTeamDetails}
            onSubmitNote={() => {
              const body = noteDraft.trim()
              if (!body) return
              onAddNote(body)
              setNoteDraft('')
              setNoteOpen(false)
            }}
            notes={notes}
          />
        )}

        {activeTab === 'goals' && <GoalsTab goals={goals} loading={goalsLoading} />}

        {activeTab === 'reviews' && (
          <div className="flex flex-col gap-2">
            {detail.review_history.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No review history yet.</p>
            ) : (
              detail.review_history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectReview(item.id)}
                  className={cn(
                    'flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors hover:bg-muted/30',
                    item.is_current && 'border-primary/40 bg-primary/5',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-foreground">{item.cycle ?? 'Cycle'}</span>
                    <StatusBadge variant={stageVariant(item.stage)} size="sm">
                      {item.stage_label}
                    </StatusBadge>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <RatingCell rating={item.overall_rating} label={item.overall_rating_label} />
                    <span className="text-[10px] text-muted-foreground">{item.due_label ?? '—'}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {activeTab === 'compensation' && <CompensationTab revisions={compensation} loading={compensationLoading} />}

        {activeTab === 'docs' && <DocsTab attachments={attachments} loading={attachmentsLoading} />}
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */

function OverviewTab({
  detail,
  team,
  canAdvance,
  saving,
  noteOpen,
  noteDraft,
  moreOpen,
  onNoteOpenChange,
  onNoteDraftChange,
  onMoreOpenChange,
  onSendReminder,
  onViewReview,
  onAdvanceStage,
  onOpenTeamDetails,
  onSubmitNote,
  notes,
}: {
  detail: PerfReviewDetail
  team: TeamComparison | null
  canAdvance: boolean
  saving: boolean
  noteOpen: boolean
  noteDraft: string
  moreOpen: boolean
  onNoteOpenChange: (open: boolean) => void
  onNoteDraftChange: (value: string) => void
  onMoreOpenChange: (open: boolean) => void
  onSendReminder: () => void
  onViewReview: () => void
  onAdvanceStage: () => void
  onOpenTeamDetails: () => void
  onSubmitNote: () => void
  notes: PerfNote[]
}) {
  // Progress along the stepper track: the share of stages already cleared.
  const completedSteps = detail.steps.filter((step) => step.status === 'completed').length
  const trackPct = detail.steps.length > 1 ? (completedSteps / (detail.steps.length - 1)) * 100 : 0

  return (
    <div className="mt-2 flex flex-col gap-3">
      <h4 className="text-sm font-semibold text-foreground">Review Cycle Progress</h4>

      {/* Stepper */}
      <div className="relative mb-4 mt-2 flex items-start justify-between px-2">
        <div className="absolute left-6 right-6 top-3 z-0 h-[2px] bg-border">
          <div className="h-full bg-primary transition-all" style={{ width: `${trackPct}%` }} />
        </div>

        {detail.steps.map((step) => (
          <div key={step.key} className="z-10 flex w-16 flex-col items-center gap-2" title={step.due_label ?? ''}>
            <div
              className={cn(
                'flex size-6 items-center justify-center rounded-full border-2 bg-background text-[10px] font-bold',
                step.status === 'completed'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : step.status === 'current'
                    ? 'border-primary text-primary'
                    : 'border-muted bg-muted text-muted-foreground',
              )}
            >
              {step.status === 'completed' ? <Check className="size-3" /> : step.step}
            </div>
            <span
              className={cn(
                'text-center text-[9px] font-semibold leading-tight',
                step.status === 'current' ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {/* Ratings */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-lg border bg-muted/20 p-3">
          <span className="text-[10px] font-semibold text-muted-foreground">
            Overall Rating {detail.is_draft && '(Draft)'}
          </span>
          <div className="mt-2 border-t border-dashed pt-2">
            {detail.overall_rating === null ? (
              <span className="text-xs text-foreground">Not yet rated</span>
            ) : (
              <RatingCell rating={detail.overall_rating} label={detail.overall_rating_label} />
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border bg-muted/20 p-3">
          <span className="text-[10px] font-semibold text-muted-foreground">
            Potential Rating {detail.is_draft && '(Draft)'}
          </span>
          <div className="mt-2 border-t border-dashed pt-2">
            {detail.potential_rating === null ? (
              <span className="text-xs text-foreground">Not yet rated</span>
            ) : (
              <RatingCell rating={detail.potential_rating} label={detail.potential_rating_label} />
            )}
          </div>
        </div>
      </div>

      {/* Details grid */}
      <div className="mt-4 grid grid-cols-2 gap-x-2 gap-y-4 text-xs">
        <Detail
          icon={
            <span className="flex size-4 items-center justify-center rounded bg-primary/10">
              <LayoutList className="size-2.5 text-primary" />
            </span>
          }
          label="Current Stage"
        >
          <span className="font-semibold text-primary">{detail.stage_label}</span>
        </Detail>

        <Detail
          icon={
            <span className="flex size-4 items-center justify-center rounded bg-success/10">
              <CheckCircle2 className="size-2.5 text-success" />
            </span>
          }
          label="Status"
        >
          <StatusBadge variant={reviewStatusVariant(detail.status)} size="sm">
            {detail.status_label}
          </StatusBadge>
        </Detail>

        <Detail icon={<Calendar className="size-3.5" />} label="Due Date">
          <span className={cn('font-semibold', detail.is_overdue ? 'text-destructive' : 'text-foreground')}>
            {detail.due_label ?? '—'}
            {detail.is_overdue && ' (overdue)'}
          </span>
        </Detail>

        <Detail icon={<UserCheck className="size-3.5" />} label="Manager">
          {detail.manager ? (
            <span className="flex items-center gap-1.5">
              <span className="flex size-4 items-center justify-center rounded-full bg-muted text-[8px] font-bold">
                {detail.manager_initials}
              </span>
              <span className="font-semibold text-foreground">{detail.manager}</span>
            </span>
          ) : (
            <span className="text-foreground/60">Not assigned</span>
          )}
        </Detail>

        <Detail icon={<Clock className="size-3.5" />} label="Last Updated">
          <span className="font-medium text-foreground">{detail.updated_label ?? '—'}</span>
        </Detail>

        <Detail icon={<Edit2 className="size-3.5" />} label="Last Updated By">
          {detail.updated_by ? (
            <span className="flex items-center gap-1.5">
              <span className="flex size-4 items-center justify-center rounded-full bg-muted text-[8px] font-bold">
                {detail.updated_by_initials}
              </span>
              <span className="font-semibold text-foreground">{detail.updated_by}</span>
            </span>
          ) : (
            <span className="text-foreground/60">—</span>
          )}
        </Detail>
      </div>

      {/* Quick Actions */}
      <div className="mt-4 flex flex-col gap-2 border-t pt-4">
        <h4 className="mb-1 text-sm font-semibold text-foreground">Quick Actions</h4>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={onSendReminder}
            disabled={saving}
          >
            <Send className="size-3" /> Send Reminder
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onViewReview}>
            <Eye className="size-3" /> View Review
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => onNoteOpenChange(!noteOpen)}
          >
            <Edit2 className="size-3" /> Add Note
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => onMoreOpenChange(!moreOpen)}
          >
            More <ChevronDown className="size-3" />
          </Button>
        </div>

        {moreOpen && (
          <div className="flex flex-col gap-1 rounded-lg border bg-muted/20 p-2">
            <button
              type="button"
              disabled={!canAdvance || saving}
              onClick={onAdvanceStage}
              className="rounded px-2 py-1.5 text-left text-xs font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Advance to next stage
            </button>
            <button
              type="button"
              onClick={onOpenTeamDetails}
              className="rounded px-2 py-1.5 text-left text-xs font-medium text-foreground hover:bg-muted"
            >
              View rating distribution
            </button>
          </div>
        )}

        {noteOpen && (
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3">
            <Textarea
              value={noteDraft}
              onChange={(event) => onNoteDraftChange(event.target.value)}
              placeholder="Add an HR note on this review…"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onNoteOpenChange(false)}>
                Cancel
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={onSubmitNote} disabled={saving || !noteDraft.trim()}>
                Save Note
              </Button>
            </div>
          </div>
        )}

        {notes.length > 0 && (
          <div className="mt-1 flex flex-col gap-2">
            {notes.slice(0, 3).map((note) => (
              <div key={note.id} className="rounded-lg border bg-background p-2.5">
                <p className="text-xs text-foreground">{note.body}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {note.author_name} · {note.created_label}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team Comparison */}
      <div className="mt-4 flex flex-col gap-3 border-t pt-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-foreground">
            Team Comparison{team?.department ? ` (${team.department})` : ''}
          </h4>
          <button
            type="button"
            onClick={onOpenTeamDetails}
            className="shrink-0 text-[10px] font-semibold text-primary hover:underline"
          >
            View Details
          </button>
        </div>

        {!team ? (
          <p className="text-xs text-muted-foreground">
            No department comparison available for this employee&apos;s cycle.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-muted-foreground">Average Rating</span>
              <span className="flex items-baseline gap-1 text-base font-bold text-foreground">
                {team.average_rating ?? '—'}
                {team.average_label && (
                  <span className="text-[10px] font-normal text-muted-foreground">({team.average_label})</span>
                )}
              </span>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${Math.min(100, ((team.average_rating ?? 0) / 5) * 100)}%` }}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-muted-foreground">Top Performer %</span>
              <span className="text-base font-bold text-foreground">{team.top_performer_pct}%</span>
              <span className="text-[9px] text-muted-foreground">{team.top_performers} of {team.rated_count} rated</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-muted-foreground">Low Performer %</span>
              <span className="text-base font-bold text-foreground">{team.low_performer_pct}%</span>
              <div className="mt-2 flex flex-col gap-0.5">
                <span className="text-[9px] font-semibold text-muted-foreground">Calibration Status</span>
                {team.calibration ? (
                  <span className="flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-primary" />
                    <span className="text-[10px] text-foreground">{team.calibration.status_label}</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">Not scheduled</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Detail({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {icon} {label}
      </span>
      <span className="pl-5">{children}</span>
    </div>
  )
}

function GoalsTab({ goals, loading }: { goals: PerfGoal[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (goals.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">No goals set for this cycle yet.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {goals.map((goal) => (
        <div key={goal.id} className="flex flex-col gap-2 rounded-lg border p-3">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-semibold text-foreground">{goal.title}</span>
            <StatusBadge variant={goalStatusVariant(goal.status)} size="sm">
              {goal.status_label}
            </StatusBadge>
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              {goal.category_label} · {formatPct(goal.weightage)} weight
            </span>
            <span>{goal.due_label ?? '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: `${goal.progress}%` }} />
            </div>
            <span className="text-[10px] font-semibold text-foreground">{goal.progress}%</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function CompensationTab({ revisions, loading }: { revisions: PerfCompensation[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (revisions.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">No compensation revisions on record.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {revisions.map((revision) => (
        <div key={revision.id} className="flex flex-col gap-1.5 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground">{revision.revision_type_label}</span>
            <StatusBadge variant={decisionStatusVariant(revision.status)} size="sm">
              {revision.status_label}
            </StatusBadge>
          </div>
          <div className="flex items-baseline gap-2 text-xs">
            <span className="text-muted-foreground">{formatMoney(revision.current_ctc, revision.currency)}</span>
            <span className="text-muted-foreground">→</span>
            <span className="font-bold text-foreground">{formatMoney(revision.proposed_ctc, revision.currency)}</span>
            {revision.increment_pct !== null && (
              <span className="text-[10px] font-semibold text-success">+{formatPct(revision.increment_pct)}</span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {revision.cycle ?? 'No cycle'} · effective {revision.effective_label ?? '—'}
          </span>
        </div>
      ))}
    </div>
  )
}

function DocsTab({ attachments, loading }: { attachments: PerfAttachment[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (attachments.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">No documents attached to this review.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-xs font-semibold text-foreground">
              {attachment.title ?? attachment.file_name}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {attachment.document_type_label}
              {attachment.file_size_label ? ` · ${attachment.file_size_label}` : ''}
            </span>
          </div>
          {attachment.url ? (
            <a
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-[10px] font-semibold text-primary hover:underline"
            >
              Open
            </a>
          ) : (
            <span className="shrink-0 text-[10px] text-muted-foreground">No file</span>
          )}
        </div>
      ))}
    </div>
  )
}
