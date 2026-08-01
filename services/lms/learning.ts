/**
 * My Learning Service — the course player.
 *
 * Backed by /api/lms/learning/* (App\Http\Controllers\Api\LmsLearningController).
 *
 * Progress and notes are new server-side entities. The previous frontend kept
 * lesson completion in localStorage and notes in React state, so both were lost
 * on refresh and invisible to any other device.
 *
 * Chapter/content writes go to the API rather than /lms/chapter_master and
 * /lms/content_master: those are web routes, and a cross-origin POST is
 * rejected by Laravel's CSRF guard with 419.
 */

import { apiClient, buildApiUrl } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

export interface LearningApiResponse<T> {
  status: boolean
  message?: string
  data: T
}

export type ContentStatus = 'not-started' | 'in-progress' | 'completed'

/**
 * A lesson. `filename` holds the media URL (DigitalOcean CDN); `file_type` is
 * one of mp4 / pdf / link / jpg / jpeg and decides how it renders.
 */
export interface LearningContent {
  id: number
  chapter_id: number | null
  title: string | null
  description: string | null
  filename: string | null
  file_type: string | null
  file_size: string | null
  url: string | null
  content_category: string | null
  sort_order: number | null
  show_hide: number | null
  status: ContentStatus
  last_position_seconds: number | null
  time_spent_seconds: number
  completed_at: string | null
  /**
   * Sequential unlocking: a lesson opens once every lesson before it is
   * complete. Computed server-side, so the rule can change without a backfill.
   */
  is_locked: boolean
}

export interface LearningChapter {
  id: number
  chapter_name: string | null
  chapter_desc: string | null
  standard_id: number | null
  subject_id: number | null
  sort_order: number | null
  show_hide: number | null
  content: LearningContent[]
  total_content: number
  completed_content: number
}

export interface LearningCourseSummary {
  id: number
  display_name: string | null
  display_image: string | null
  subject_category: string | null
  subject_type: string | null
  standard_id: number | null
  standard_name: string | null
  enrollment_id: number | null
  enrollment_status: string | null
  start_date: string | null
  end_date: string | null
  total_content: number
  completed_content: number
  progress_percent: number
}

export interface LearningEnrollment {
  id: number
  status: string | null
  start_date: string | null
  end_date: string | null
}

export interface LearningCourseDetail {
  course: {
    id: number
    display_name: string | null
    display_image: string | null
    subject_category: string | null
    subject_type: string | null
    subject_code: string | null
    short_name: string | null
    jobrole: string | null
    standard_id: number | null
    standard_name: string | null
  }
  enrollment: LearningEnrollment | null
  chapters: LearningChapter[]
  total_content: number
  completed_content: number
  progress_percent: number
  time_spent_seconds: number
  content_categories: string[]
}

export interface SaveProgressPayload {
  course_id: number
  content_id: number
  chapter_id?: number | null
  status: ContentStatus
  last_position_seconds?: number | null
  /** Seconds to add to the running total for this item. */
  time_spent_delta?: number
}

export interface SaveProgressResult {
  content_id: number
  status: ContentStatus
  total_content: number
  completed_content: number
  progress_percent: number
}

export interface LearningAttempt {
  id: number
  question_paper_id: number
  total_right: number | null
  total_wrong: number | null
  obtain_marks: number | null
  start_time: string | null
  created_at: string | null
}

/** A question paper for this course, plus the caller's own attempts. */
export interface LearningAssessment {
  id: number
  paper_name: string | null
  paper_desc: string | null
  total_ques: number | null
  total_marks: number | null
  time_allowed: number | null
  timelimit_enable: number | null
  attempt_allowed: string | null
  open_date: string | null
  close_date: string | null
  exam_type: string | null
  show_hide: number | null
  attempts: LearningAttempt[]
  attempt_count: number
  best_score: number | null
  last_attempt_at: string | null
  status: 'not-started' | 'completed'
}

export interface LearningNote {
  id: number
  course_id: number
  chapter_id: number | null
  content_id: number | null
  note: string
  timestamp_seconds: number | null
  content_title: string | null
  created_at: string | null
  updated_at: string | null
}

export interface CreateNotePayload {
  course_id: number
  chapter_id?: number | null
  content_id?: number | null
  note: string
  timestamp_seconds?: number | null
}

export interface ChapterPayload {
  subject_id?: number
  chapter_name: string
  chapter_desc?: string | null
  sort_order?: number | null
}

export interface ContentPayload {
  chapter_id?: number
  title: string
  description?: string | null
  filename?: string | null
  file_type?: string | null
  content_category?: string | null
  sort_order?: number | null
}

function params(
  context: LaravelContext,
  profileName?: string,
  extra?: Record<string, string>,
) {
  return withLaravelParams(context, {
    ...(profileName ? { user_profile_name: profileName } : {}),
    ...extra,
  }) as Record<string, string>
}

export const lmsLearningService = {
  /** GET /api/lms/learning/courses - enrolled courses with real progress %. */
  getMyCourses: (context: LaravelContext) =>
    apiClient.get<LearningApiResponse<LearningCourseSummary[]>>(
      '/lms/learning/courses',
      params(context),
    ),

  /** GET /api/lms/learning/courses/{id} - chapters, content and my progress. */
  getCourse: (context: LaravelContext, courseId: number) =>
    apiClient.get<LearningApiResponse<LearningCourseDetail>>(
      `/lms/learning/courses/${courseId}`,
      params(context),
    ),

  /** POST /api/lms/learning/progress - upsert progress on one lesson. */
  saveProgress: (context: LaravelContext, payload: SaveProgressPayload) =>
    apiClient.post<LearningApiResponse<SaveProgressResult>>('/lms/learning/progress', {
      ...params(context),
      ...payload,
    }),

  /** GET /api/lms/learning/assessments - this course's papers + my attempts. */
  getAssessments: (context: LaravelContext, courseId: number) =>
    apiClient.get<LearningApiResponse<LearningAssessment[]>>(
      '/lms/learning/assessments',
      params(context, undefined, { course_id: String(courseId) }),
    ),

  getNotes: (context: LaravelContext, courseId: number) =>
    apiClient.get<LearningApiResponse<LearningNote[]>>(
      '/lms/learning/notes',
      params(context, undefined, { course_id: String(courseId) }),
    ),

  createNote: (context: LaravelContext, payload: CreateNotePayload) =>
    apiClient.post<LearningApiResponse<LearningNote>>('/lms/learning/notes', {
      ...params(context),
      ...payload,
    }),

  updateNote: (context: LaravelContext, id: number, note: string, timestampSeconds?: number | null) =>
    apiClient.put<LearningApiResponse<LearningNote>>(`/lms/learning/notes/${id}`, {
      ...params(context),
      note,
      timestamp_seconds: timestampSeconds ?? null,
    }),

  deleteNote: (context: LaravelContext, id: number) =>
    apiClient.delete<LearningApiResponse<{ id: number }>>(
      `/lms/learning/notes/${id}`,
      params(context),
    ),

  /* Authoring - admin/HR only, enforced server-side too. */

  createChapter: (context: LaravelContext, payload: ChapterPayload, profileName?: string) =>
    apiClient.post<LearningApiResponse<unknown>>('/lms/learning/chapters', {
      ...params(context, profileName),
      ...payload,
    }),

  updateChapter: (context: LaravelContext, id: number, payload: ChapterPayload, profileName?: string) =>
    apiClient.put<LearningApiResponse<unknown>>(`/lms/learning/chapters/${id}`, {
      ...params(context, profileName),
      ...payload,
    }),

  deleteChapter: (context: LaravelContext, id: number, profileName?: string) =>
    apiClient.delete<LearningApiResponse<{ id: number }>>(
      `/lms/learning/chapters/${id}`,
      params(context, profileName),
    ),

  createContent: (context: LaravelContext, payload: ContentPayload, profileName?: string) =>
    apiClient.post<LearningApiResponse<unknown>>('/lms/learning/content', {
      ...params(context, profileName),
      ...payload,
    }),

  updateContent: (context: LaravelContext, id: number, payload: ContentPayload, profileName?: string) =>
    apiClient.put<LearningApiResponse<unknown>>(`/lms/learning/content/${id}`, {
      ...params(context, profileName),
      ...payload,
    }),

  deleteContent: (context: LaravelContext, id: number, profileName?: string) =>
    apiClient.delete<LearningApiResponse<{ id: number }>>(
      `/lms/learning/content/${id}`,
      params(context, profileName),
    ),
}

/* ─── Certificates ─────────────────────────────────────────────────────────── */

export type CertificateExpiryState = 'active' | 'expiring' | 'expired'

export interface LearningCertificate {
  user_id: number
  learner_name: string | null
  employee_no: string | null
  /** Negative once expired. Null when the certificate never expires. */
  days_to_expiry: number | null
  id: number
  course_id: number
  /** s_users_skills.id when the course maps to a competency skill. */
  skill_id: number | null
  certificate_number: string
  course_title: string | null
  /** Credential title. Falls back to course_title when never customised. */
  name: string | null
  description: string | null
  /** Stored as JSON server-side; the controller decodes it before sending. */
  tags: string[] | null
  /** Public code for the verify endpoint. Null on rows issued before renewals. */
  verification_code: string | null
  /** Renewal chain: the certificate this replaces, and the one replacing it. */
  supersedes: number | null
  superseded_by: number | null
  reissued_at: string | null
  issued_at: string | null
  expires_at: string | null
  status: string
  display_image: string | null
  subject_category: string | null
  skill_title: string | null
  expiry_state: CertificateExpiryState
}

/**
 * Public payload from the verify endpoint — only what the certificate itself
 * prints, never the wider learner record.
 *
 * `valid` and `message` come from the envelope rather than `data`; the hook
 * flattens them onto this shape. A certificate can be genuine yet not valid:
 * `is_superseded` means it was replaced by a newer issue, `is_expired` means it
 * lapsed. The message says which.
 */
export interface CertificateVerification {
  valid: boolean
  message: string
  certificate_number: string | null
  name: string | null
  course_title: string | null
  learner_name: string | null
  issued_at: string | null
  expires_at: string | null
  is_expired: boolean
  is_superseded: boolean
}

/* ─── Discussions ──────────────────────────────────────────────────────────── */

export interface DiscussionReply {
  id: number
  discussion_id: number
  user_id: number
  message: string
  is_instructor: boolean | number
  author_name: string | null
  created_at: string | null
}

export interface Discussion {
  id: number
  course_id: number
  chapter_id: number | null
  content_id: number | null
  user_id: number
  title: string | null
  message: string
  is_instructor: boolean
  is_resolved: boolean
  author_name: string | null
  content_title: string | null
  created_at: string | null
  replies: DiscussionReply[]
  reply_count: number
}

export interface CreateDiscussionPayload {
  course_id: number
  chapter_id?: number | null
  content_id?: number | null
  title?: string | null
  message: string
}

/** Whose certificates to return. `all` is admin/HR only and is enforced server-side. */
export interface CertificateQuery {
  scope?: 'mine' | 'all'
  search?: string
  courseId?: number
  profileName?: string
}

export interface CertificateListResponse {
  status: boolean
  data: LearningCertificate[]
  meta: { scope: 'mine' | 'all'; warning_days: number }
}

export const lmsCertificateService = {
  /**
   * GET /api/lms/learning/certificates
   *
   * `meta.warning_days` is the server's "expiring soon" window, so the UI
   * labels it rather than hardcoding a number that could drift from the API.
   */
  list: (context: LaravelContext, query: CertificateQuery = {}) =>
    apiClient.get<CertificateListResponse>(
      '/lms/learning/certificates',
      params(context, query.profileName, {
        ...(query.scope ? { scope: query.scope } : {}),
        ...(query.search ? { search: query.search } : {}),
        ...(query.courseId ? { course_id: String(query.courseId) } : {}),
      }),
    ),

  /** POST /api/lms/learning/certificates - idempotent; 422 until every lesson is done. */
  issue: (context: LaravelContext, courseId: number) =>
    apiClient.post<LearningApiResponse<LearningCertificate>>('/lms/learning/certificates', {
      ...params(context),
      course_id: courseId,
    }),

  /**
   * Absolute URL for the rendered PDF.
   *
   * Returned as a URL rather than fetched: the response is a binary body, and
   * letting the browser navigate to it hands the file to the download manager
   * with the server's filename intact. The token rides in the query string
   * because a download navigation carries no Authorization header.
   */
  downloadUrl: (context: LaravelContext, certificateId: number) =>
    buildApiUrl(`/lms/learning/certificates/${certificateId}/download`, params(context)),

  /**
   * GET /api/lms/learning/certificates/verify/{code}
   *
   * Public by design — checking a credential must not require the checker to
   * hold an account — so no context is sent.
   */
  verify: (code: string) =>
    apiClient.get<
      LearningApiResponse<Omit<CertificateVerification, 'valid' | 'message'>> & {
        valid: boolean
        message: string
      }
    >(`/lms/learning/certificates/verify/${encodeURIComponent(code)}`),

  /**
   * POST /api/lms/learning/certificates/{id}/reissue - admin/HR only.
   *
   * Non-destructive: the original is marked superseded and kept, and the
   * learner's course progress is untouched.
   */
  reissue: (
    context: LaravelContext,
    certificateId: number,
    profileName?: string,
  ) =>
    apiClient.post<LearningApiResponse<LearningCertificate>>(
      `/lms/learning/certificates/${certificateId}/reissue`,
      params(context, profileName),
    ),
}

export const lmsDiscussionService = {
  list: (context: LaravelContext, courseId: number) =>
    apiClient.get<LearningApiResponse<Discussion[]>>(
      '/lms/learning/discussions',
      params(context, undefined, { course_id: String(courseId) }),
    ),

  create: (context: LaravelContext, payload: CreateDiscussionPayload, profileName?: string) =>
    apiClient.post<LearningApiResponse<Discussion>>('/lms/learning/discussions', {
      ...params(context, profileName),
      ...payload,
    }),

  reply: (context: LaravelContext, discussionId: number, message: string, profileName?: string) =>
    apiClient.post<LearningApiResponse<DiscussionReply>>(
      `/lms/learning/discussions/${discussionId}/replies`,
      { ...params(context, profileName), message },
    ),

  remove: (context: LaravelContext, discussionId: number, profileName?: string) =>
    apiClient.delete<LearningApiResponse<{ id: number }>>(
      `/lms/learning/discussions/${discussionId}`,
      params(context, profileName),
    ),
}
