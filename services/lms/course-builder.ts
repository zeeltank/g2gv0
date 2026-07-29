/**
 * Course Builder — the 5-step authoring wizard.
 *
 * Built on the existing course endpoints rather than a parallel set: a course
 * is still a sub_std_map row, so create/update/read go through
 * /api/lms/courses. The wizard's extra configuration lives in a `settings`
 * block on the same request, which the controller persists to
 * lms_course_settings. Requests without that block behave exactly as before,
 * which is what keeps the catalogue's simpler course form working.
 *
 * Chapters and content reuse the My Learning authoring endpoints — the module
 * tree in step 2 is the same chapter_master/content_master data the course
 * player reads, so authoring it twice would mean two sources of truth.
 */

import { apiClient } from '@/services/core'
import { withLaravelParams, type LaravelContext } from '@/lib/laravel-context'

export interface BuilderApiResponse<T> {
  status: boolean
  message?: string
  data: T
}

/* ─── Settings ─────────────────────────────────────────────────────────────── */

export type CourseVisibility = 'all' | 'restricted'
export type EnrollmentRule = 'open' | 'approval'

/**
 * The wizard fields that have no column on sub_std_map.
 *
 * Sent as a nested `settings` object and stored one-row-per-course in
 * lms_course_settings, so sub_std_map — which the competency module, jobrole
 * library and enrolment all read — is not widened for LMS-only concerns.
 */
export interface CourseSettings {
  description: string | null
  duration_minutes: number | null
  language: string | null
  is_mandatory: boolean
  discussion_enabled: boolean
  visibility: CourseVisibility
  passing_score: number | null
  max_attempts: number | null
  issue_certificate: boolean
  certificate_template: string | null
  recert_alerts: boolean
  enrollment_rule: EnrollmentRule
  /** hrms_departments.id values. Null means no restriction at all. */
  restrict_departments: number[] | null
  restrict_roles: string[] | null
  available_from: string | null
  available_until: string | null
}

/** A prerequisite as returned by the API — id plus the course's title. */
export interface CoursePrerequisite {
  id: number
  title: string | null
}

/* ─── Modules and content ──────────────────────────────────────────────────── */

/** A chapter_master row. The wizard calls these "modules". */
export interface BuilderModule {
  id: number
  chapter_name: string
  chapter_desc: string | null
  sort_order: number | null
  /** The API returns this key as `content`, singular. */
  content: BuilderContent[]
}

/**
 * content_master.file_type. The wizard's four buttons map onto this column,
 * which is the same discriminator the course player already branches on.
 */
export type ContentKind = 'video' | 'document' | 'scorm' | 'session'

export interface BuilderContent {
  id: number
  title: string | null
  description: string | null
  file_type: string | null
  url: string | null
  filename: string | null
  sort_order: number | null
}

/* ─── Assessments ──────────────────────────────────────────────────────────── */

/** A question_paper row scoped to this course. */
export interface BuilderAssessment {
  id: number
  paper_name: string
  paper_desc: string | null
  attempt_allowed: number | null
  time_allowed: number | null
  timelimit_enable: number | null
  open_date: string | null
  close_date: string | null
  shuffle_question: number | null
  show_feedback: number | null
  result_show_ans: number | null
  exam_type: string | null
  total_ques: number
  total_marks: number
  question_ids: number[]
}

export interface AssessmentPayload {
  course_id: number
  paper_name: string
  paper_desc?: string | null
  attempt_allowed?: number | null
  time_allowed?: number | null
  timelimit_enable?: boolean
  open_date?: string | null
  close_date?: string | null
  shuffle_question?: boolean
  show_feedback?: boolean
  result_show_ans?: boolean
  exam_type?: string | null
  question_ids?: number[]
}

/** A row from the course's question bank, for picking quiz questions. */
export interface BankQuestion {
  id: number
  question_title: string | null
  points: number | null
  question_type_id: number | null
  chapter_id: number | null
  chapter_name: string | null
}

/* ─── Course payload ───────────────────────────────────────────────────────── */

/** The sub_std_map columns the wizard writes, plus its settings block. */
export interface BuilderCoursePayload {
  display_name: string
  standard_id: number
  subject_category?: string | null
  subject_code?: string | null
  subject_type?: string | null
  short_name?: string | null
  jobrole?: string | null
  sort_order?: number | null
  certificate_validity_months?: number | null
  /** 0 = draft, 1 = published. The same flag the catalogue toggles. */
  status: number
  settings?: Partial<CourseSettings>
  prerequisites?: number[]
}

/** store/update/show all return the settings alongside the course row. */
export interface BuilderCourseResponse {
  status: boolean
  message?: string
  data: Record<string, unknown>
  course_id?: number
  settings: CourseSettings | null
  prerequisites: CoursePrerequisite[]
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

export const lmsCourseBuilderService = {
  /** GET /api/lms/courses/{id} — course row + settings + prerequisites. */
  load: (context: LaravelContext, courseId: number) =>
    apiClient.get<BuilderCourseResponse>(`/lms/courses/${courseId}`, params(context)),

  /**
   * POST /api/lms/courses — create the draft.
   *
   * The wizard saves on leaving step 1 because steps 2 and 3 attach chapters
   * and quizzes to a course_id, which does not exist until the row does.
   */
  create: (context: LaravelContext, payload: BuilderCoursePayload, profileName?: string) =>
    apiClient.post<BuilderCourseResponse>('/lms/courses', {
      ...params(context, profileName),
      ...payload,
    }),

  /** PUT /api/lms/courses/{id} — save later steps onto the existing draft. */
  update: (
    context: LaravelContext,
    courseId: number,
    payload: BuilderCoursePayload,
    profileName?: string,
  ) =>
    apiClient.put<BuilderCourseResponse>(`/lms/courses/${courseId}`, {
      ...params(context, profileName),
      ...payload,
    }),

  /**
   * POST /api/lms/courses (multipart) — create with a thumbnail.
   *
   * A separate call because display_image is a File: it cannot ride in the JSON
   * body, and FormData cannot express the nested settings object, so the
   * settings block is JSON-encoded into a single field the controller decodes.
   */
  createWithImage: (
    context: LaravelContext,
    payload: BuilderCoursePayload,
    image: File,
    profileName?: string,
  ) => {
    const form = new FormData()
    Object.entries(params(context, profileName)).forEach(([key, value]) => {
      form.append(key, value)
    })

    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null) return
      if (key === 'settings' || key === 'prerequisites') {
        form.append(key, JSON.stringify(value))
        return
      }
      form.append(key, String(value))
    })

    form.append('display_image', image)
    return apiClient.postForm<BuilderCourseResponse>('/lms/courses', form)
  },

  /* ── Modules (chapter_master) ── */

  /** GET /api/lms/learning/courses/{id} — the module tree with its content. */
  modules: (context: LaravelContext, courseId: number) =>
    apiClient.get<BuilderApiResponse<{ chapters?: BuilderModule[] }>>(
      `/lms/learning/courses/${courseId}`,
      params(context),
    ),

  createModule: (
    context: LaravelContext,
    courseId: number,
    body: { chapter_name: string; chapter_desc?: string | null; sort_order?: number },
    profileName?: string,
  ) =>
    apiClient.post<BuilderApiResponse<BuilderModule>>('/lms/learning/chapters', {
      ...params(context, profileName),
      subject_id: courseId,
      ...body,
    }),

  updateModule: (
    context: LaravelContext,
    moduleId: number,
    body: { chapter_name: string; chapter_desc?: string | null; sort_order?: number },
    profileName?: string,
  ) =>
    apiClient.put<BuilderApiResponse<BuilderModule>>(`/lms/learning/chapters/${moduleId}`, {
      ...params(context, profileName),
      ...body,
    }),

  deleteModule: (context: LaravelContext, moduleId: number, profileName?: string) =>
    apiClient.delete<BuilderApiResponse<null>>(`/lms/learning/chapters/${moduleId}`, {
      ...params(context, profileName),
    }),

  /* ── Content (content_master) ── */

  createContent: (
    context: LaravelContext,
    body: {
      chapter_id: number
      title: string
      description?: string | null
      file_type: string
      url?: string | null
      sort_order?: number
    },
    profileName?: string,
  ) =>
    apiClient.post<BuilderApiResponse<BuilderContent>>('/lms/learning/content', {
      ...params(context, profileName),
      ...body,
    }),

  deleteContent: (context: LaravelContext, contentId: number, profileName?: string) =>
    apiClient.delete<BuilderApiResponse<null>>(`/lms/learning/content/${contentId}`, {
      ...params(context, profileName),
    }),

  /* ── Assessments (question_paper) ── */

  assessments: (context: LaravelContext, courseId: number) =>
    apiClient.get<BuilderApiResponse<BuilderAssessment[]>>(
      '/lms/assessments',
      params(context, undefined, { course_id: String(courseId) }),
    ),

  /** The question bank available to this course, for choosing quiz questions. */
  questionBank: (context: LaravelContext, courseId: number) =>
    apiClient.get<BuilderApiResponse<BankQuestion[]>>(
      '/lms/assessments/questions',
      params(context, undefined, { course_id: String(courseId) }),
    ),

  createAssessment: (context: LaravelContext, payload: AssessmentPayload, profileName?: string) =>
    apiClient.post<BuilderApiResponse<BuilderAssessment>>('/lms/assessments', {
      ...params(context, profileName),
      ...payload,
    }),

  updateAssessment: (
    context: LaravelContext,
    id: number,
    payload: AssessmentPayload,
    profileName?: string,
  ) =>
    apiClient.put<BuilderApiResponse<BuilderAssessment>>(`/lms/assessments/${id}`, {
      ...params(context, profileName),
      ...payload,
    }),

  deleteAssessment: (context: LaravelContext, id: number, profileName?: string) =>
    apiClient.delete<BuilderApiResponse<null>>(`/lms/assessments/${id}`, {
      ...params(context, profileName),
    }),
}
