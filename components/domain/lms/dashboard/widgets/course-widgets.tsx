'use client'

import React, { useMemo, useState } from 'react'
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Image as ImageIcon,
  Loader2,
  MoreVertical,
  Trash2,
} from 'lucide-react'
import { format, isAfter, startOfMonth, startOfQuarter, startOfYear } from 'date-fns'
import { CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import type { CourseBucket, DashboardCourse } from '@/hooks/use-lms-dashboard'
import type { EnrollmentUpdateStatus } from '@/services/lms'
import {
  DonutChart,
  DonutLegendRow,
  WidgetLink,
  WidgetLoading,
  WidgetMessage,
  WidgetShell,
} from './shared'

const BUCKET_BADGE: Record<
  CourseBucket,
  { label: string; variant: 'inactive' | 'processing' | 'success' | 'error' }
> = {
  'not-started': { label: 'Not Started', variant: 'inactive' },
  'in-progress': { label: 'In Progress', variant: 'processing' },
  completed: { label: 'Completed', variant: 'success' },
  overdue: { label: 'Overdue', variant: 'error' },
}

/* ------------------------------------------------------------------ *
 * My Learning
 * ------------------------------------------------------------------ */

export function MyLearningWidget({
  courses,
  loading,
  error,
  retry,
  updatingCourseId,
  onSetStatus,
  onUnenroll,
  onViewAll,
}: {
  courses: DashboardCourse[]
  loading: boolean
  error: string | null
  retry: () => void
  updatingCourseId: number | null
  onSetStatus: (course: DashboardCourse, status: EnrollmentUpdateStatus) => void
  onUnenroll: (course: DashboardCourse) => void
  onViewAll: () => void
}) {
  const [pendingUnenroll, setPendingUnenroll] = useState<DashboardCourse | null>(null)
  const [activeTab, setActiveTab] = useState<CourseBucket>('in-progress')

  const buckets = useMemo(() => {
    return {
      'in-progress': courses.filter((course) => course.bucket === 'in-progress'),
      'not-started': courses.filter((course) => course.bucket === 'not-started'),
      completed: courses.filter((course) => course.bucket === 'completed'),
      overdue: courses.filter((course) => course.bucket === 'overdue'),
    } satisfies Record<CourseBucket, DashboardCourse[]>
  }, [courses])

  const tabs: { id: CourseBucket; label: string }[] = [
    { id: 'in-progress', label: `In Progress (${buckets['in-progress'].length})` },
    { id: 'not-started', label: `Not Started (${buckets['not-started'].length})` },
    { id: 'completed', label: `Completed (${buckets.completed.length})` },
    { id: 'overdue', label: `Overdue (${buckets.overdue.length})` },
  ]

  const visible = buckets[activeTab]

  return (
    <>
    <WidgetShell
      title="My Learning"
      headerAction={<WidgetLink label="View All" onClick={onViewAll} />}
      footerAction={<WidgetLink label="Go to My Learning" onClick={onViewAll} variant="footer" />}
    >
      <div className="px-5 pt-3">
        <div className="flex items-center gap-4 overflow-x-auto border-b border-border/60">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'relative -mb-px whitespace-nowrap pb-2 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                activeTab === tab.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <WidgetLoading />
      ) : error ? (
        <WidgetMessage
          icon={AlertTriangle}
          tone="danger"
          title="Couldn't load your courses"
          description={error}
          action={
            <Button variant="outline" size="sm" className="mt-2" onClick={retry}>
              Retry
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <WidgetMessage
          icon={BookOpen}
          title="Nothing here yet"
          description={
            activeTab === 'completed'
              ? 'Courses you finish will be listed here.'
              : 'Enrol in a course from the learning catalogue to get started.'
          }
        />
      ) : (
        <CardContent className="flex-1 overflow-auto p-0">
          <div className="flex flex-col">
            {visible.map((course) => {
              const badge = BUCKET_BADGE[course.bucket]
              const isUpdating = updatingCourseId === course.id
              const canComplete = course.enrollment_status !== 'completed'
              const canStart = course.enrollment_status !== 'in-progress'

              return (
                <div
                  key={course.enrollment_id ?? course.id}
                  className="flex items-center gap-3 border-b border-border/50 px-5 py-3.5 hover:bg-muted/30"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/50 bg-muted">
                    {course.display_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={course.display_image}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="size-5 text-muted-foreground/40" />
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <h4 className="truncate text-sm font-semibold leading-tight text-foreground">
                      {course.title}
                    </h4>
                    <p className="truncate text-[11px] font-medium text-muted-foreground">
                      {course.dueDate
                        ? `Due: ${format(course.dueDate, 'dd MMM yyyy')}`
                        : course.category || 'No due date'}
                    </p>
                  </div>

                  <StatusBadge
                    variant={badge.variant}
                    size="sm"
                    className="shrink-0 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider"
                  >
                    {badge.label}
                  </StatusBadge>

                  {course.enrollment_id ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-7 shrink-0 p-0"
                          disabled={isUpdating}
                          aria-label={`Update ${course.title}`}
                        >
                          {isUpdating ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <MoreVertical className="size-4 text-muted-foreground" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canStart && (
                          <DropdownMenuItem onSelect={() => onSetStatus(course, 'in-progress')}>
                            <BookOpen className="mr-2 size-4" /> Move to in progress
                          </DropdownMenuItem>
                        )}
                        {canComplete && (
                          <DropdownMenuItem onSelect={() => onSetStatus(course, 'completed')}>
                            <CheckCircle2 className="mr-2 size-4" /> Mark as completed
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onSelect={() => setPendingUnenroll(course)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 size-4" /> Unenroll
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <span className="w-7 shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      )}
    </WidgetShell>

    <AlertDialog
      open={pendingUnenroll !== null}
      onOpenChange={(next: boolean) => {
        if (!next) setPendingUnenroll(null)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unenroll from this course?</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingUnenroll
              ? `"${pendingUnenroll.title}" will be removed from your learning. You can enrol again from the catalogue.`
              : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => setPendingUnenroll(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (pendingUnenroll) onUnenroll(pendingUnenroll)
              setPendingUnenroll(null)
            }}
          >
            Unenroll
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}

/* ------------------------------------------------------------------ *
 * Upcoming deadlines
 * ------------------------------------------------------------------ */

export function UpcomingDeadlinesWidget({
  courses,
  loading,
  error,
  onViewAll,
}: {
  courses: DashboardCourse[]
  loading: boolean
  error: string | null
  onViewAll: () => void
}) {
  const deadlines = useMemo(
    () =>
      courses
        .filter((course) => course.dueDate && course.bucket !== 'completed')
        .sort((a, b) => (a.dueDate as Date).getTime() - (b.dueDate as Date).getTime())
        .slice(0, 6),
    [courses],
  )

  return (
    <WidgetShell
      title="Upcoming Deadlines"
      headerAction={<WidgetLink label="View All" onClick={onViewAll} />}
      footerAction={<WidgetLink label="View All Deadlines" onClick={onViewAll} variant="footer" />}
    >
      {loading ? (
        <WidgetLoading />
      ) : error ? (
        <WidgetMessage icon={AlertTriangle} tone="danger" title="Couldn't load deadlines" description={error} />
      ) : deadlines.length === 0 ? (
        <WidgetMessage
          icon={CalendarDays}
          title="No upcoming deadlines"
          description="None of your open courses has a due date."
        />
      ) : (
        <CardContent className="flex-1 overflow-auto p-0">
          <div className="flex flex-col divide-y divide-border/50">
            {deadlines.map((course) => {
              const due = course.dueDate as Date
              const overdue = course.bucket === 'overdue'

              return (
                <div
                  key={course.enrollment_id ?? course.id}
                  className="flex items-start gap-3 p-4 hover:bg-muted/30"
                >
                  <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-border/80 bg-background py-1.5 shadow-sm">
                    <span className="text-base font-bold leading-none">{format(due, 'dd')}</span>
                    <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      {format(due, 'MMM')}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
                    <h4 className="truncate text-sm font-semibold leading-tight text-foreground">
                      {course.title}
                    </h4>
                    <p className="truncate text-[11px] font-medium text-muted-foreground">
                      {course.category || 'Course'}
                    </p>
                  </div>
                  <StatusBadge
                    variant={overdue ? 'error' : 'pending'}
                    size="sm"
                    className="shrink-0 text-[10px] font-bold uppercase tracking-wider"
                  >
                    {overdue ? 'Overdue' : 'Due Soon'}
                  </StatusBadge>
                </div>
              )
            })}
          </div>
        </CardContent>
      )}
    </WidgetShell>
  )
}

/* ------------------------------------------------------------------ *
 * Learning progress
 * ------------------------------------------------------------------ */

type ProgressRange = 'month' | 'quarter' | 'year' | 'all'

const RANGE_LABELS: Record<ProgressRange, string> = {
  month: 'This Month',
  quarter: 'This Quarter',
  year: 'This Year',
  all: 'All Time',
}

/** Filters by enrolment date, the only time dimension enrolled_courses returns. */
function rangeStart(range: ProgressRange, now: Date): Date | null {
  switch (range) {
    case 'month':
      return startOfMonth(now)
    case 'quarter':
      return startOfQuarter(now)
    case 'year':
      return startOfYear(now)
    default:
      return null
  }
}

export function LearningProgressWidget({
  courses,
  loading,
  error,
}: {
  courses: DashboardCourse[]
  loading: boolean
  error: string | null
}) {
  const [range, setRange] = useState<ProgressRange>('month')

  const scoped = useMemo(() => {
    const from = rangeStart(range, new Date())
    if (!from) return courses

    return courses.filter((course) => {
      if (!course.enrolled_at) return false
      const enrolledAt = new Date(course.enrolled_at)
      return !Number.isNaN(enrolledAt.getTime()) && isAfter(enrolledAt, from)
    })
  }, [courses, range])

  const total = scoped.length
  const completed = scoped.filter((course) => course.bucket === 'completed').length
  const inProgress = scoped.filter((course) => course.bucket === 'in-progress').length
  const overdue = scoped.filter((course) => course.bucket === 'overdue').length
  const notStarted = scoped.filter((course) => course.bucket === 'not-started').length

  const share = (value: number) => (total > 0 ? Math.round((value / total) * 100) : 0)

  return (
    <WidgetShell
      title="Learning Progress"
      headerAction={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs font-semibold">
              {RANGE_LABELS[range]} <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.keys(RANGE_LABELS) as ProgressRange[]).map((key) => (
              <DropdownMenuItem key={key} onSelect={() => setRange(key)}>
                {RANGE_LABELS[key]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      {loading ? (
        <WidgetLoading rows={3} />
      ) : error ? (
        <WidgetMessage icon={AlertTriangle} tone="danger" title="Couldn't load progress" description={error} />
      ) : total === 0 ? (
        <WidgetMessage
          icon={BookOpen}
          title="No courses in this period"
          description={`You have no enrolments dated within "${RANGE_LABELS[range]}".`}
        />
      ) : (
        <CardContent className="flex flex-1 flex-col p-6">
          <div className="flex items-center justify-center gap-6 lg:justify-start">
            <DonutChart
              centerValue={`${share(completed)}%`}
              centerLabel="Complete"
              segments={[
                { value: completed, colorClass: 'text-success', label: 'Completed' },
                { value: inProgress, colorClass: 'text-primary', label: 'In Progress' },
                { value: overdue, colorClass: 'text-destructive', label: 'Overdue' },
                { value: notStarted, colorClass: 'text-muted-foreground/40', label: 'Not Started' },
              ]}
            />
            <div className="flex max-w-[200px] flex-1 flex-col gap-2.5">
              <DonutLegendRow colorClass="bg-success" label="Completed" count={completed} percentage={share(completed)} />
              <DonutLegendRow colorClass="bg-primary" label="In Progress" count={inProgress} percentage={share(inProgress)} />
              <DonutLegendRow colorClass="bg-destructive" label="Overdue" count={overdue} percentage={share(overdue)} />
              <DonutLegendRow
                colorClass="bg-muted-foreground/40"
                label="Not Started"
                count={notStarted}
                percentage={share(notStarted)}
              />
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between rounded-lg border border-border/50 bg-muted/40 p-4">
            <span className="text-sm font-semibold text-muted-foreground">Courses in this period</span>
            <span className="text-lg font-black text-foreground">{total}</span>
          </div>
        </CardContent>
      )}
    </WidgetShell>
  )
}
