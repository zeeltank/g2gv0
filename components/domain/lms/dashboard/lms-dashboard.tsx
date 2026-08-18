'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Award,
  BarChart2,
  BookOpen,
  CheckCircle2,
  Clock,
  RefreshCw,
  Trophy,
  X,
} from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { useLmsDashboard } from '@/hooks/use-lms-dashboard'
import { getGreeting } from '@/lib/greeting'
import { KpiCard } from './widgets/shared'
import {
  LearningProgressWidget,
  MyLearningWidget,
  UpcomingDeadlinesWidget,
} from './widgets/course-widgets'
import { LmsCalendarWidget, UpcomingSessionsWidget } from './widgets/calendar-widgets'
import {
  AchievementsWidget,
  LearningStatsWidget,
  RecentActivityWidget,
  SkillProgressWidget,
} from './widgets/insight-widgets'
import { QuickActionsWidget } from './widgets/quick-actions-widget'
import { EnrollCourseSheet } from './widgets/enroll-course-sheet'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import {
  LMS_LEARNING_CATALOG_ACCESS_LINK,
  LMS_MY_LEARNING_ACCESS_LINK,
  LMS_ASSIGNMENTS_ACCESS_LINK,
  LMS_SESSIONS_CALENDAR_ACCESS_LINK,
} from '@/lib/gtg-navigation'

/** Transient banner for the enrolment-status mutation and partial load failures. */
function ActionBanner({
  message,
  tone,
  onDismiss,
  onRetry,
}: {
  message: string
  tone: 'success' | 'error'
  onDismiss?: () => void
  onRetry?: () => void
}) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-sm font-medium',
        tone === 'success'
          ? 'border-success/30 bg-success/10 text-success'
          : 'border-destructive/30 bg-destructive/10 text-destructive',
      )}
    >
      <span className="flex items-center gap-2">
        {tone === 'success' && <CheckCircle2 className="size-4 shrink-0" />}
        {message}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        {onRetry && (
          <Button variant="ghost" size="sm" onClick={onRetry} className="h-7 gap-1.5 text-xs font-semibold">
            <RefreshCw className="size-3.5" /> Retry
          </Button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss message"
            className="rounded-md p-1 transition-opacity hover:opacity-70"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

export function LmsDashboard() {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const { user } = useAuth()
  const {
    loading,
    error,
    retry,
    courses,
    skillProgress,
    achievements,
    streak,
    weeklyGoal,
    peerComparison,
    activities,
    calendarMonth,
    setCalendarMonth,
    calendarEvents,
    calendarLoading,
    calendarError,
    upcomingSessions,
    updatingCourseId,
    actionMessage,
    actionError,
    dismissAction,
    setCourseStatus,
    unenroll,
    enroll,
  } = useLmsDashboard()

  const [enrollOpen, setEnrollOpen] = useState(false)

  // Success and failure banners are transient - clear them after a few seconds.
  useEffect(() => {
    if (!actionMessage && !actionError) return
    const timer = setTimeout(dismissAction, 5000)
    return () => clearTimeout(timer)
  }, [actionMessage, actionError, dismissAction])

  const kpis = useMemo(() => {
    const total = courses.length
    const inProgress = courses.filter((course) => course.bucket === 'in-progress').length
    const notStarted = courses.filter((course) => course.bucket === 'not-started').length
    const overdue = courses.filter((course) => course.bucket === 'overdue').length
    const completed = courses.filter((course) => course.bucket === 'completed').length

    const allAchievements = achievements?.achievements ?? []
    const earnedAchievements = allAchievements.filter((achievement) => achievement.earned).length

    return { total, inProgress, notStarted, overdue, completed, allAchievements, earnedAchievements }
  }, [courses, achievements])

  const greetingName =
    (user as { first_name?: string } | null)?.first_name || user?.name || 'there'

  // A hard load failure means none of the widgets has data worth rendering.
  if (error && !loading && courses.length === 0) {
    return (
      <div className="p-6">
        <ErrorState
          title="Couldn't load your learning dashboard"
          description={error}
          retry={retry}
        />
      </div>
    )
  }

  return (
    <div className="relative space-y-5 p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {getGreeting(greetingName)}
          </h1>
          <p className="text-sm font-medium text-muted-foreground">
            Here&apos;s what&apos;s happening with your learning today.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push(resolveAccessLink(LMS_LEARNING_CATALOG_ACCESS_LINK))}
          className="h-10 justify-center gap-2 rounded-lg border-border/80 bg-card px-4 text-sm font-semibold shadow-sm"
        >
          <BookOpen className="size-4 text-muted-foreground" />
          Browse Catalog
        </Button>
      </header>

      {actionMessage && (
        <ActionBanner message={actionMessage} tone="success" onDismiss={dismissAction} />
      )}
      {actionError && <ActionBanner message={actionError} tone="error" onDismiss={dismissAction} />}
      {error && courses.length > 0 && (
        <ActionBanner message={error} tone="error" onRetry={retry} />
      )}

      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          title="Courses Assigned"
          value={kpis.total}
          subtext={`${kpis.notStarted} not started`}
          icon={BookOpen}
          trend="primary"
          loading={loading}
        />
        <KpiCard
          title="In Progress"
          value={kpis.inProgress}
          subtext={kpis.overdue > 0 ? `${kpis.overdue} overdue` : 'Nothing overdue'}
          icon={Clock}
          trend={kpis.overdue > 0 ? 'warning' : 'success'}
          loading={loading}
        />
        <KpiCard
          title="Upcoming Sessions"
          value={upcomingSessions.length}
          subtext={`${format(new Date(), 'MMMM')} onwards`}
          icon={BarChart2}
          trend="primary"
          loading={loading}
        />
        <KpiCard
          title="Achievements Earned"
          value={kpis.earnedAchievements}
          subtext={`${kpis.allAchievements.length} available`}
          icon={Award}
          trend="success"
          loading={loading}
        />
        <KpiCard
          title="Learning Hours"
          value={weeklyGoal ? `${weeklyGoal.current_hours}h` : '0h'}
          subtext={
            weeklyGoal
              ? `This week · goal ${weeklyGoal.goal_hours}h`
              : 'This week'
          }
          icon={Trophy}
          trend="primary"
          loading={loading}
        />
        <KpiCard
          title="Completed Courses"
          value={kpis.completed}
          subtext="All time"
          icon={CheckCircle2}
          trend="success"
          loading={loading}
        />
      </section>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <MyLearningWidget
          courses={courses}
          loading={loading}
          error={error}
          retry={retry}
          updatingCourseId={updatingCourseId}
          onSetStatus={(course, status) => void setCourseStatus(course, status)}
          onUnenroll={(course) => void unenroll(course)}
          onViewAll={() => router.push(resolveAccessLink(LMS_MY_LEARNING_ACCESS_LINK))}
        />
        <UpcomingDeadlinesWidget
          courses={courses}
          loading={loading}
          error={error}
          onViewAll={() => router.push(resolveAccessLink(LMS_ASSIGNMENTS_ACCESS_LINK))}
        />
        <UpcomingSessionsWidget
          sessions={upcomingSessions}
          loading={loading}
          error={error}
          onViewCalendar={() => router.push(resolveAccessLink(LMS_SESSIONS_CALENDAR_ACCESS_LINK))}
        />
        <QuickActionsWidget
          courses={courses}
          onBrowseCatalog={() => router.push(resolveAccessLink(LMS_LEARNING_CATALOG_ACCESS_LINK))}
          onEnrollClick={() => setEnrollOpen(true)}
        />

        <LearningProgressWidget courses={courses} loading={loading} error={error} />
        <AchievementsWidget achievements={achievements} loading={loading} error={error} />
        <RecentActivityWidget activities={activities} loading={loading} error={error} />
        <LmsCalendarWidget
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          events={calendarEvents}
          loading={calendarLoading}
          error={calendarError}
        />

        <div className="md:col-span-2">
          <SkillProgressWidget skillProgress={skillProgress} loading={loading} error={error} />
        </div>
        <div className="md:col-span-2">
          <LearningStatsWidget
            streak={streak}
            weeklyGoal={weeklyGoal}
            peerComparison={peerComparison}
            loading={loading}
            error={error}
          />
        </div>
      </section>

      <EnrollCourseSheet
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        onEnroll={enroll}
        enrollingCourseId={updatingCourseId}
      />
    </div>
  )
}
