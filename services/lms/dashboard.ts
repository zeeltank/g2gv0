/**
 * LMS Learning Dashboard Service
 *
 * Backed by the Laravel endpoints that power `lms → learning → dashboard`:
 *   - App\Http\Controllers\lms_course_enroll\LmsCourseEnrollController  (/api/enroll*)
 *   - App\Http\Controllers\Api\SkillDevelopmentController               (/api/skill-development/*)
 *
 * Every call carries the standard Laravel context (token, sub_institute_id,
 * syear, user_id, type=API) via withLaravelParams, exactly like the leave and
 * attendance services.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

/** Shared envelope for both controllers: `status` is a boolean, not an HTTP code. */
export interface LmsApiResponse<T> {
  status: boolean
  message?: string
  data: T
}

/* ------------------------------------------------------------------ *
 * Enrolled courses
 * ------------------------------------------------------------------ */

/**
 * The three values LmsCourseEnrollController@store accepts. Note that @update
 * only accepts 'completed' | 'in-progress' - 'enrolled' is create-only.
 */
export type EnrollmentStatus = 'enrolled' | 'in-progress' | 'completed'
export type EnrollmentUpdateStatus = Extract<EnrollmentStatus, 'in-progress' | 'completed'>

/**
 * A row from GET /api/enrolled_courses: the whole `sub_std_map` record plus the
 * joined subject/standard names and the learner's enrolment state.
 *
 * `display_name` is the course title - sub_std_map has no subject_name, and its
 * `subject_id` is polymorphic (a task, skill or jobrole row depending on
 * subject_category), so it does not resolve to the `subject` table.
 * `standard_name` is joined from hrms_departments via standard_id.
 */
export interface EnrolledCourse {
  id: number
  enrollment_id: number | null
  subject_id: number | null
  standard_id: number | null
  display_name: string | null
  display_image: string | null
  subject_category: string | null
  subject_type: string | null
  subject_code: string | null
  standard_name: string | null
  jobrole: string | null
  proficiency: string | null
  enrollment_status: EnrollmentStatus | null
  start_date: string | null
  end_date: string | null
  enrolled_at: string | null
}

/** A catalogue row from GET /api/available_courses. */
export interface AvailableCourse {
  id: number
  display_name: string | null
  display_image: string | null
  subject_type: string | null
  subject_category: string | null
  jobrole: string | null
  proficiency: string | null
  standard_id: number | null
  standard_name: string | null
  is_enrolled: boolean
}

export interface AvailableCoursesFilters {
  search?: string
  /** Defaults to true - only courses the learner can still enrol in. */
  excludeEnrolled?: boolean
  limit?: number
}

export interface EnrollPayload {
  user_id: string | number
  course_id: number
  status: EnrollmentStatus
  start_date?: string | null
  end_date?: string | null
  sub_institute_id?: string | number | null
}

export interface EnrollmentUpdatePayload {
  user_id: string | number
  course_id: number
  status: EnrollmentUpdateStatus
  start_date?: string | null
  end_date?: string | null
  sub_institute_id: string | number
}

/** Both mutations answer with a bare {message, data} - no `status` flag. */
export interface EnrollmentMutationResponse {
  message: string
  data: unknown
  /**
   * True when the course's enrollment_rule is 'approval': the row was created
   * with status 'pending' and the learner does not have access yet.
   */
  requires_approval?: boolean
}

/* ------------------------------------------------------------------ *
 * Skill development
 * ------------------------------------------------------------------ */

export type ProficiencyLevel = 'Beginner' | 'Intermediate' | 'Advanced'

export interface SkillProgressItem {
  skill_name: string
  sub_category: string | null
  progress_percentage: number
  proficiency_level: ProficiencyLevel
  courses_completed: number
  total_courses: number
  status: 'in-progress' | 'completed'
}

export interface SkillProgressOverall {
  overall_progress_percentage: number
  total_skills: number
  skills_in_progress: number
  average_progress: number
}

export interface SkillProgressData {
  skill_progress: SkillProgressItem[]
  overall: SkillProgressOverall
}

/**
 * calendar_events carries a date but no time columns, so an event is a
 * whole-day marker. `priority` is populated from event_type by the controller.
 */
export interface LearningCalendarEvent {
  title: string | null
  description: string | null
  current_datetime: string | null
  school_date: string | null
  priority: string | null
  event_type: string | null
  standard: string | null
}

export interface LearningCalendarData {
  month: string | number
  year: string | number
  events: LearningCalendarEvent[]
}

export interface LearningAchievement {
  title: string
  description: string
  earned: boolean
  earned_date: string | null
  progress: string
}

export interface AchievementsData {
  achievements: LearningAchievement[]
  overall_progress: number
}

export interface LearningStreakData {
  current_streak: number
  goal: number
  progress_percentage: number
  best_streak: number
  days_to_go: number
}

export interface WeeklyGoalData {
  current_hours: number
  goal_hours: number
  remaining_hours: number
  progress_percentage: number
  week_start: string
  week_end: string
}

export interface PeerComparisonData {
  rank: number
  total_peers: number
  your_progress: number
  peer_average: number
  percentile: number
  message: string
}

export type LearningActivityType =
  | 'course_completed'
  | 'course_enrolled'
  | 'deadline_due'
  | 'session_upcoming'

export type LearningActivityTone = 'success' | 'primary' | 'warning' | 'neutral'

export interface LearningActivity {
  id: string
  text: string
  time: string
  type: LearningActivityType | string
  tone: LearningActivityTone | string
  timestamp: string | null
}

/* ------------------------------------------------------------------ *
 * Service
 * ------------------------------------------------------------------ */

function params(context: LaravelContext, extra?: Record<string, string>) {
  return withLaravelParams(context, extra) as Record<string, string>
}

export const lmsDashboardService = {
  /** GET /api/enrolled_courses - the learner's courses with enrolment state. */
  getEnrolledCourses: (context: LaravelContext) =>
    apiClient.get<LmsApiResponse<EnrolledCourse[]>>('/enrolled_courses', params(context)),

  /**
   * GET /api/available_courses - the enrollable catalogue for this tenant,
   * flagged with the caller's existing enrolments.
   */
  getAvailableCourses: (context: LaravelContext, filters: AvailableCoursesFilters = {}) =>
    apiClient.get<LmsApiResponse<AvailableCourse[]>>(
      '/available_courses',
      params(context, {
        ...(filters.search ? { search: filters.search } : {}),
        exclude_enrolled: filters.excludeEnrolled === false ? '0' : '1',
        limit: String(filters.limit ?? 50),
      }),
    ),

  /** POST /api/enroll - enrol the learner in a sub_std_map course. */
  enroll: (context: LaravelContext, payload: EnrollPayload) =>
    apiClient.post<EnrollmentMutationResponse>('/enroll', {
      ...params(context),
      ...payload,
    }),

  /**
   * DELETE /api/enroll/{courseId} - unenrol. Note the path segment is the
   * COURSE id here, not the enrolment id that PUT takes; that asymmetry is the
   * existing route contract.
   */
  unenroll: (context: LaravelContext, courseId: number) =>
    apiClient.delete<EnrollmentMutationResponse>(`/enroll/${courseId}`, params(context)),

  /**
   * PUT /api/enroll/{enrollmentId} - move an existing enrolment between
   * 'in-progress' and 'completed'. `{id}` is the enrolment row id, which is why
   * enrolled_courses now returns `enrollment_id`.
   */
  updateEnrollment: (
    context: LaravelContext,
    enrollmentId: number,
    payload: EnrollmentUpdatePayload,
  ) =>
    apiClient.put<EnrollmentMutationResponse>(`/enroll/${enrollmentId}`, {
      ...params(context),
      ...payload,
    }),

  /** GET /api/skill-development/progress - per-skill-category progress. */
  getSkillProgress: (context: LaravelContext) =>
    apiClient.get<LmsApiResponse<SkillProgressData>>(
      '/skill-development/progress',
      params(context),
    ),

  /** GET /api/skill-development/calendar - events for one month. */
  getCalendar: (context: LaravelContext, month: number, year: number) =>
    apiClient.get<LmsApiResponse<LearningCalendarData>>(
      '/skill-development/calendar',
      params(context, { month: String(month), year: String(year) }),
    ),

  /** GET /api/skill-development/achievements - badge definitions + earned state. */
  getAchievements: (context: LaravelContext) =>
    apiClient.get<LmsApiResponse<AchievementsData>>(
      '/skill-development/achievements',
      params(context),
    ),

  /** GET /api/skill-development/streak - consecutive learning-day streak. */
  getStreak: (context: LaravelContext) =>
    apiClient.get<LmsApiResponse<LearningStreakData>>(
      '/skill-development/streak',
      params(context),
    ),

  /** GET /api/skill-development/weekly-goal - hours logged this week vs. goal. */
  getWeeklyGoal: (context: LaravelContext) =>
    apiClient.get<LmsApiResponse<WeeklyGoalData>>(
      '/skill-development/weekly-goal',
      params(context),
    ),

  /**
   * GET /api/skill-development/peer-comparison - rank within the sub-institute.
   * Answers 404 when no peer has any progress yet; callers treat that as empty.
   */
  getPeerComparison: (context: LaravelContext) =>
    apiClient.get<LmsApiResponse<PeerComparisonData>>(
      '/skill-development/peer-comparison',
      params(context),
    ),

  /** GET /api/skill-development/recent-activity - derived enrolment/calendar feed. */
  getRecentActivity: (context: LaravelContext, limit = 8) =>
    apiClient.get<LmsApiResponse<LearningActivity[]>>(
      '/skill-development/recent-activity',
      params(context, { limit: String(limit) }),
    ),
}
