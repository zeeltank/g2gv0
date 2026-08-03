'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { ApiError } from '@/services/core'
import {
  lmsDashboardService,
  lmsSessionService,
  type AchievementsData,
  type AvailableCourse,
  type EnrolledCourse,
  type EnrollmentUpdateStatus,
  type LearningActivity,
  type LearningCalendarEvent,
  type LearningStreakData,
  type PeerComparisonData,
  type SkillProgressData,
  type TrainingSession,
  type WeeklyGoalData,
} from '@/services/lms'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/**
 * Default enrolment window, in days.
 *
 * sub_std_map carries no course duration, so a new enrolment has nothing to
 * derive a real due date from. 60 days is what the previous frontend used and
 * is preserved here so migrated and new enrolments stay consistent.
 */
const ENROLLMENT_WINDOW_DAYS = 60

/** Laravel's `date` validation rule expects Y-m-d, not an ISO timestamp. */
function toDateParam(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** The Laravel context is rebuilt per call - it reads live storage, not React state. */
function useLaravelContext() {
  const { user } = useAuth()
  return useCallback(() => getLaravelContext(user), [user])
}

/**
 * A course's effective state on the dashboard.
 *
 * Laravel stores only `enrollment_status`; 'overdue' is derived here from
 * `end_date`, matching how the deadline widgets read the same rows.
 */
export type CourseBucket = 'in-progress' | 'not-started' | 'completed' | 'overdue'

export interface DashboardCourse extends EnrolledCourse {
  /** sub_std_map.display_name - the course title in this schema. */
  title: string
  /** Delivery type, falling back to the course's domain category. */
  category: string | null
  dueDate: Date | null
  bucket: CourseBucket
}

function toDashboardCourse(course: EnrolledCourse, now: Date): DashboardCourse {
  const dueDate = course.end_date ? new Date(course.end_date) : null
  const validDue = dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : null
  const status = course.enrollment_status

  let bucket: CourseBucket
  if (status === 'completed') {
    bucket = 'completed'
  } else if (validDue && validDue < now) {
    bucket = 'overdue'
  } else if (status === 'in-progress') {
    bucket = 'in-progress'
  } else {
    // 'enrolled' means accepted but not yet started, and so does a null status.
    bucket = 'not-started'
  }

  return {
    ...course,
    title: course.display_name || 'Untitled course',
    category: course.subject_type || course.subject_category || null,
    dueDate: validDue,
    bucket,
  }
}

export interface LmsDashboardState {
  loading: boolean
  error: string | null
  retry: () => void

  courses: DashboardCourse[]
  skillProgress: SkillProgressData | null
  achievements: AchievementsData | null
  streak: LearningStreakData | null
  weeklyGoal: WeeklyGoalData | null
  /** Null when the tenant has no peers with progress (the API answers 404). */
  peerComparison: PeerComparisonData | null
  activities: LearningActivity[]

  /** Calendar is month-scoped and refetches whenever the browsed month changes. */
  calendarMonth: Date
  setCalendarMonth: (date: Date) => void
  calendarEvents: LearningCalendarEvent[]
  calendarLoading: boolean
  calendarError: string | null

  /**
   * Still-to-come events across this month and next, pinned to today. Kept
   * separate from `calendarEvents` so browsing the calendar back through past
   * months does not empty the Upcoming Sessions widget or its KPI.
   */
  upcomingEvents: LearningCalendarEvent[]

  /**
   * Scheduled sessions from today through the end of next month, feeding the
   * Upcoming Sessions widget. Real sessions rather than calendar_events, so the
   * widget can show time, venue and seat state.
   */
  upcomingSessions: TrainingSession[]

  /** PUT /api/enroll/{enrollment_id} - move a course between in-progress and completed. */
  updatingCourseId: number | null
  actionMessage: string | null
  actionError: string | null
  dismissAction: () => void
  setCourseStatus: (
    course: DashboardCourse,
    status: EnrollmentUpdateStatus,
  ) => Promise<{ ok: boolean; message: string }>
  /** DELETE /api/enroll/{course_id} - unenrol from a course. */
  unenroll: (course: DashboardCourse) => Promise<{ ok: boolean; message: string }>
  /** POST /api/enroll - enrol in a catalogue course. */
  enroll: (course: AvailableCourse) => Promise<{ ok: boolean; message: string }>
}

/** Catalogue picker state, loaded on demand by the enrol sheet. */
export interface AvailableCoursesState {
  courses: AvailableCourse[]
  loading: boolean
  error: string | null
  search: string
  setSearch: (value: string) => void
  reload: () => void
}

/**
 * Loads the enrollable catalogue. Kept out of useLmsDashboard so the dashboard
 * does not pay for a catalogue fetch nobody has asked for yet - the enrol sheet
 * mounts this only when it opens.
 */
export function useAvailableCourses(enabled: boolean): AvailableCoursesState {
  const resolveContext = useLaravelContext()
  const [courses, setCourses] = useState<AvailableCourse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (!enabled) return

    const context = resolveContext()
    if (!isLaravelContextReady(context)) {
      setError('Your session has expired. Sign in again to browse courses.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await lmsDashboardService.getAvailableCourses(context, {
        search: search.trim() || undefined,
        excludeEnrolled: true,
      })
      setCourses(response.data ?? [])
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the course catalogue.'))
      setCourses([])
    } finally {
      setLoading(false)
    }
  }, [enabled, resolveContext, search])

  useEffect(() => {
    if (!enabled) return
    // Debounced so typing in the picker's search box does not fire a request
    // per keystroke.
    const timer = setTimeout(() => {
      void load()
    }, 250)
    return () => clearTimeout(timer)
  }, [enabled, load])

  return {
    courses,
    loading,
    error,
    search,
    setSearch,
    // Explicit refetch (retry, or after a successful enrolment) bypasses the
    // search debounce and fires immediately.
    reload: () => void load(),
  }
}

export function useLmsDashboard(): LmsDashboardState {
  const resolveContext = useLaravelContext()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [courses, setCourses] = useState<EnrolledCourse[]>([])
  const [skillProgress, setSkillProgress] = useState<SkillProgressData | null>(null)
  const [achievements, setAchievements] = useState<AchievementsData | null>(null)
  const [streak, setStreak] = useState<LearningStreakData | null>(null)
  const [weeklyGoal, setWeeklyGoal] = useState<WeeklyGoalData | null>(null)
  const [peerComparison, setPeerComparison] = useState<PeerComparisonData | null>(null)
  const [activities, setActivities] = useState<LearningActivity[]>([])

  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date())
  const [calendarEvents, setCalendarEvents] = useState<LearningCalendarEvent[]>([])
  const [calendarLoading, setCalendarLoading] = useState(true)
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [upcomingEvents, setUpcomingEvents] = useState<LearningCalendarEvent[]>([])
  const [upcomingSessions, setUpcomingSessions] = useState<TrainingSession[]>([])

  const [updatingCourseId, setUpdatingCourseId] = useState<number | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const loadCourses = useCallback(async () => {
    const context = resolveContext()
    const response = await lmsDashboardService.getEnrolledCourses(context)
    setCourses(response.data ?? [])
  }, [resolveContext])

  const load = useCallback(async () => {
    const context = resolveContext()

    if (!isLaravelContextReady(context)) {
      setLoading(false)
      setCalendarLoading(false)
      setError('Your session has expired. Sign in again to load your learning dashboard.')
      return
    }

    setLoading(true)
    setError(null)

    const today = new Date()
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)

    try {
      const [
        coursesResponse,
        progressResponse,
        achievementsResponse,
        streakResponse,
        weeklyGoalResponse,
        activityResponse,
        thisMonthEvents,
        nextMonthEvents,
      ] = await Promise.all([
        lmsDashboardService.getEnrolledCourses(context),
        lmsDashboardService.getSkillProgress(context),
        lmsDashboardService.getAchievements(context),
        lmsDashboardService.getStreak(context),
        lmsDashboardService.getWeeklyGoal(context),
        lmsDashboardService.getRecentActivity(context, 20),
        lmsDashboardService.getCalendar(context, today.getMonth() + 1, today.getFullYear()),
        lmsDashboardService.getCalendar(context, nextMonth.getMonth() + 1, nextMonth.getFullYear()),
      ])

      setCourses(coursesResponse.data ?? [])
      setSkillProgress(progressResponse.data ?? null)
      setAchievements(achievementsResponse.data ?? null)
      setStreak(streakResponse.data ?? null)
      setWeeklyGoal(weeklyGoalResponse.data ?? null)
      setActivities(activityResponse.data ?? [])

      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())

      // "Upcoming Sessions" reads lms_virtual_classroom, not calendar_events:
      // scheduled sessions are what the widget claims to show, and they carry the
      // time, venue and seat state that make a row actionable. Settled separately
      // so a failing schedule greys out one widget instead of the dashboard.
      // Last day of next month — day 0 of the month after rolls back one day.
      const windowEnd = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0)
      const sessionWindow = await lmsSessionService
        .list(context, toDateParam(startOfToday), toDateParam(windowEnd))
        .catch(() => null)

      setUpcomingSessions(
        (sessionWindow?.data ?? [])
          .filter((session) => Boolean(session.event_date))
          .sort((a, b) => {
            const byDate =
              new Date(a.event_date as string).getTime() -
              new Date(b.event_date as string).getTime()
            return byDate !== 0 ? byDate : (a.from_time ?? '').localeCompare(b.from_time ?? '')
          }),
      )

      setUpcomingEvents(
        [...(thisMonthEvents.data?.events ?? []), ...(nextMonthEvents.data?.events ?? [])]
          .filter((event) => {
            if (!event.school_date) return false
            const eventDate = new Date(event.school_date)
            return !Number.isNaN(eventDate.getTime()) && eventDate >= startOfToday
          })
          .sort(
            (a, b) =>
              new Date(a.school_date as string).getTime() -
              new Date(b.school_date as string).getTime(),
          ),
      )
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load your learning dashboard.'))
      setCourses([])
      setSkillProgress(null)
      setAchievements(null)
      setStreak(null)
      setWeeklyGoal(null)
      setActivities([])
      setUpcomingEvents([])
      setUpcomingSessions([])
    } finally {
      setLoading(false)
    }

    // Peer comparison answers 404 when nobody in the tenant has progress yet.
    // That is an empty state, not a dashboard-level failure, so it is loaded
    // outside the Promise.all above.
    try {
      const peerResponse = await lmsDashboardService.getPeerComparison(context)
      setPeerComparison(peerResponse.data ?? null)
    } catch (peerError) {
      if (!(peerError instanceof ApiError) || peerError.status !== 404) {
        // Any other failure still leaves the widget empty rather than blocking
        // the page, but is worth surfacing in the console for diagnosis.
        console.error('[lms-dashboard] peer comparison failed', peerError)
      }
      setPeerComparison(null)
    }
  }, [resolveContext])

  const loadCalendar = useCallback(async () => {
    const context = resolveContext()

    if (!isLaravelContextReady(context)) {
      setCalendarLoading(false)
      return
    }

    setCalendarLoading(true)
    setCalendarError(null)

    try {
      const response = await lmsDashboardService.getCalendar(
        context,
        calendarMonth.getMonth() + 1,
        calendarMonth.getFullYear(),
      )
      setCalendarEvents(response.data?.events ?? [])
    } catch (calendarLoadError) {
      setCalendarError(toMessage(calendarLoadError, 'Failed to load the learning calendar.'))
      setCalendarEvents([])
    } finally {
      setCalendarLoading(false)
    }
  }, [resolveContext, calendarMonth])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  useEffect(() => {
    queueMicrotask(() => {
      void loadCalendar()
    })
  }, [loadCalendar])

  const setCourseStatus = useCallback(
    async (course: DashboardCourse, status: EnrollmentUpdateStatus) => {
      const context = resolveContext()
      setActionError(null)
      setActionMessage(null)

      if (!course.enrollment_id) {
        const message = 'This enrolment cannot be updated because it has no enrolment id.'
        setActionError(message)
        return { ok: false, message }
      }

      setUpdatingCourseId(course.id)

      try {
        // LmsCourseEnrollController@update revalidates every field, so the full
        // record has to be resent - a partial payload fails validation.
        await lmsDashboardService.updateEnrollment(context, course.enrollment_id, {
          user_id: context.userId,
          course_id: course.id,
          status,
          start_date: course.start_date,
          end_date: course.end_date,
          sub_institute_id: context.subInstituteId,
        })

        await loadCourses()

        const message =
          status === 'completed'
            ? `"${course.title}" marked as completed.`
            : `"${course.title}" moved to in progress.`
        setActionMessage(message)
        return { ok: true, message }
      } catch (updateError) {
        const message = toMessage(updateError, 'Failed to update this course.')
        setActionError(message)
        return { ok: false, message }
      } finally {
        setUpdatingCourseId(null)
      }
    },
    [resolveContext, loadCourses],
  )

  const unenroll = useCallback(
    async (course: DashboardCourse) => {
      const context = resolveContext()
      setActionError(null)
      setActionMessage(null)
      setUpdatingCourseId(course.id)

      try {
        // The DELETE route keys on the course id, not the enrolment id.
        await lmsDashboardService.unenroll(context, course.id)
        await loadCourses()

        const message = `Unenrolled from "${course.title}".`
        setActionMessage(message)
        return { ok: true, message }
      } catch (unenrollError) {
        const message = toMessage(unenrollError, 'Failed to unenrol from this course.')
        setActionError(message)
        return { ok: false, message }
      } finally {
        setUpdatingCourseId(null)
      }
    },
    [resolveContext, loadCourses],
  )

  const enroll = useCallback(
    async (course: AvailableCourse) => {
      const context = resolveContext()
      setActionError(null)
      setActionMessage(null)
      setUpdatingCourseId(course.id)

      try {
        // lms_course_enroll.start_date is NOT NULL despite the controller
        // validating it as nullable, so dates must always be sent. The 60-day
        // window matches what the previous frontend used in production - there
        // is no course-duration column to derive a real end date from.
        const today = new Date()
        const due = new Date(today)
        due.setDate(due.getDate() + ENROLLMENT_WINDOW_DAYS)

        const response = await lmsDashboardService.enroll(context, {
          user_id: context.userId,
          course_id: course.id,
          // 'enrolled' is the create-only starting state; the learner moves it
          // to in-progress or completed from My Learning afterwards.
          status: 'enrolled',
          start_date: toDateParam(today),
          end_date: toDateParam(due),
          sub_institute_id: context.subInstituteId,
        })
        await loadCourses()

        // A course the Course Builder marked "Approval Required" comes back
        // pending rather than enrolled. Saying "Enrolled" there would tell the
        // learner they have access they do not yet have.
        const message = response?.requires_approval
          ? `Enrolment requested for "${course.display_name ?? 'course'}". An administrator will review it.`
          : `Enrolled in "${course.display_name ?? 'course'}".`
        setActionMessage(message)
        return { ok: true, message }
      } catch (enrollError) {
        const message = toMessage(enrollError, 'Failed to enrol in this course.')
        setActionError(message)
        return { ok: false, message }
      } finally {
        setUpdatingCourseId(null)
      }
    },
    [resolveContext, loadCourses],
  )

  const dismissAction = useCallback(() => {
    setActionMessage(null)
    setActionError(null)
  }, [])

  const dashboardCourses = useMemo(() => {
    const now = new Date()
    return courses.map((course) => toDashboardCourse(course, now))
  }, [courses])

  return {
    loading,
    error,
    retry: () => void load(),

    courses: dashboardCourses,
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
    upcomingEvents,
    upcomingSessions,

    updatingCourseId,
    actionMessage,
    actionError,
    dismissAction,
    setCourseStatus,
    unenroll,
    enroll,
  }
}
