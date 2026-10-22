'use client'

/**
 * YOUR REQUIRED LEARNING — the employee side of Capability-Driven Auto Course
 * Assignment.
 *
 * Sits directly under <CmMyCapability> in cm-my-capability-screen.tsx, reading
 * the SAME `/competency/gap` payload rather than a second fetch: the backend
 * attaches `assigned_course` / `no_course_available` to each
 * `CompetencyGapRow` precisely so one call answers both "where do I stand"
 * and "what is being done about it".
 *
 * TWO HONEST STATES, NEVER COLLAPSED INTO EACH OTHER:
 *
 *   assigned_course     a course exists and was handed to you, with a due
 *                       date (or an honest "no deadline set" — never styled
 *                       as on track).
 *   no_course_available the reactor looked and found nothing to assign. This
 *                       is NOT an error and NOT your problem to solve — HR
 *                       has already been told, and the copy says so.
 *
 * DEGRADES GRACEFULLY. Both fields are optional on `CompetencyGapRow` because
 * the backend may not carry them on every tenant/deployment yet — a gap row
 * with neither is simply not shown here, not treated as a fetch failure.
 */

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, BookOpen, CheckCircle2, ChevronDown, ChevronUp, Clock, Info, Users } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { LMS_MY_LEARNING_ACCESS_LINK } from '@/lib/gtg-navigation'
import type { CompetencyGap, CompetencyGapRow, GapRemediationAssignment } from '@/services/competency/gap'

const VISIBLE_CAP = 3

type DueUrgency = 'overdue' | 'soon' | 'later' | 'none'

function dueUrgency(dueDate: string | null): DueUrgency {
  if (!dueDate) return 'none'
  const due = new Date(dueDate)
  if (Number.isNaN(due.getTime())) return 'none'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)

  const daysLeft = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (daysLeft < 0) return 'overdue'
  if (daysLeft <= 7) return 'soon'
  return 'later'
}

function formatDate(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function DueBadge({ dueDate }: { dueDate: string | null }) {
  const urgency = dueUrgency(dueDate)

  if (urgency === 'none') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground">
        <Clock className="size-3.5" /> No deadline set
      </span>
    )
  }

  const styles: Record<Exclude<DueUrgency, 'none'>, string> = {
    overdue: 'border-destructive/30 bg-destructive/10 text-destructive',
    soon: 'border-warning/30 bg-warning/10 text-warning',
    later: 'border-border bg-muted/40 text-muted-foreground',
  }
  const labels: Record<Exclude<DueUrgency, 'none'>, string> = {
    overdue: 'Overdue',
    soon: 'Due soon',
    later: 'Due',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
        styles[urgency],
      )}
    >
      <Clock className="size-3.5" />
      {labels[urgency]} · {formatDate(dueDate as string)}
    </span>
  )
}

function AssignedCourseCard({
  row,
  assignment,
  onOpen,
}: {
  row: CompetencyGapRow
  assignment: GapRemediationAssignment
  onOpen: (courseId: number) => void
}) {
  const [showWhy, setShowWhy] = useState(false)

  const typeStyles =
    assignment.assignment_type === 'Mandatory'
      ? 'border-destructive/30 bg-destructive/10 text-destructive'
      : assignment.assignment_type === 'Recommended'
        ? 'border-primary/30 bg-primary/10 text-primary'
        : 'border-border bg-muted text-muted-foreground'

  const progressVariant =
    assignment.progress >= 100 ? 'success' : dueUrgency(assignment.due_date) === 'overdue' ? 'destructive' : 'default'

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <BookOpen className="size-4" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-bold text-foreground">{assignment.course_name}</span>
            <span className="text-xs text-muted-foreground">
              Closes your gap in <span className="font-medium text-foreground">{row.competency_name}</span>
              {row.measured_level !== null
                ? ` · you ${row.measured_level} of ${row.required_proficiency} required`
                : ` · ${row.required_proficiency} required`}
            </span>
          </div>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
            typeStyles,
          )}
        >
          {assignment.assignment_type}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Progress value={assignment.progress} variant={progressVariant} className="h-1.5 flex-1" />
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
          {assignment.progress}%
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <DueBadge dueDate={assignment.due_date} />
        <Button size="sm" className="h-8 font-semibold" onClick={() => onOpen(assignment.course_id)}>
          Open course
        </Button>
      </div>

      <button
        type="button"
        className="flex w-fit items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        onClick={() => setShowWhy((v) => !v)}
      >
        <Info className="size-3" />
        Why was I assigned this?
      </button>
      {showWhy && (
        <p className="-mt-1 rounded-lg bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          {row.measured_level !== null ? (
            <>
              Assigned because your <span className="font-medium text-foreground">{row.competency_name}</span>{' '}
              rating was measured at <span className="font-medium text-foreground tabular-nums">{row.measured_level}</span>,
              below the <span className="font-medium text-foreground tabular-nums">{row.required_proficiency}</span> your
              role requires.
            </>
          ) : (
            <>
              Assigned because your role requires{' '}
              <span className="font-medium text-foreground">{row.competency_name}</span> at level{' '}
              <span className="font-medium text-foreground tabular-nums">{row.required_proficiency}</span>.
            </>
          )}
        </p>
      )}
    </Card>
  )
}

function NoCourseRow({ row }: { row: CompetencyGapRow }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-semibold text-foreground">{row.competency_name}</span>
        <span className="text-xs text-muted-foreground">
          No course covers this yet. Your HR team has been told.
        </span>
      </div>
    </div>
  )
}

export function CmGapLearningPanel({ gap }: { gap: CompetencyGap | null }) {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const [expanded, setExpanded] = useState(false)

  const assignedRows = useMemo(
    () => (gap?.competencies ?? []).filter((row) => row.assigned_course),
    [gap],
  )
  const noCourseRows = useMemo(
    () => (gap?.competencies ?? []).filter((row) => !row.assigned_course && row.no_course_available),
    [gap],
  )

  const openCourse = (courseId: number) => {
    const route = resolveAccessLink(LMS_MY_LEARNING_ACCESS_LINK)
    router.push(`${route}?course_id=${courseId}`)
  }

  if (assignedRows.length === 0 && noCourseRows.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-bold text-foreground">Your required learning</h3>
        <EmptyState
          icon={<CheckCircle2 className="size-8 text-success" />}
          title="You're meeting every requirement for your role"
          description="Nothing has been assigned because there is no gap to close right now. If that changes, a course will show up here automatically."
        />
      </div>
    )
  }

  const visibleAssigned = expanded ? assignedRows : assignedRows.slice(0, VISIBLE_CAP)
  const hiddenCount = assignedRows.length - visibleAssigned.length

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-foreground">Your required learning</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Courses assigned automatically to close a gap on your record.
        </p>
      </div>

      {assignedRows.length > 0 && (
        <div className="flex flex-col gap-3">
          {visibleAssigned.map((row) => (
            <AssignedCourseCard
              key={row.competency_id}
              row={row}
              assignment={row.assigned_course as GapRemediationAssignment}
              onOpen={openCourse}
            />
          ))}

          {assignedRows.length > VISIBLE_CAP && (
            <Button
              variant="ghost"
              size="sm"
              className="w-fit gap-1.5 self-start text-xs font-semibold text-primary"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? (
                <>
                  Show fewer <ChevronUp className="size-3.5" />
                </>
              ) : (
                <>
                  +{hiddenCount} more <ChevronDown className="size-3.5" />
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {noCourseRows.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Users className="size-3.5" /> Waiting on a course
          </h4>
          {noCourseRows.map((row) => (
            <NoCourseRow key={row.competency_id} row={row} />
          ))}
        </div>
      )}
    </div>
  )
}
