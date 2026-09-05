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
  auto_apply_rating: boolean
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
/**
 * THE VOCABULARY THE PLAYER ACTUALLY UNDERSTANDS.
 *
 * This was 'video' | 'document' | 'scorm' | 'session'. The player switches on
 * file_type, and it knew none of those but the first — so three types in four
 * rendered as "unknown" and only video ever worked. These values are the ones
 * lessonKind actually branches on, which is why lessons made in the other
 * authoring surface play and lessons made in the wizard did not.
 *
 * pptx and docx are rendered in place through the Office viewer. They had no
 * type anywhere before, so the only way to put a slide deck in a course was to
 * add it as an external link and send the learner out of the course to read it.
 *
 * `scorm` and `session` are gone deliberately. Nothing in this stack can play
 * SCORM, and a live session is a lms_virtual_classroom row, not a lesson —
 * offering them promised capabilities that do not exist in any layer.
 */
export type ContentKind = 'mp4' | 'pdf' | 'pptx' | 'docx' | 'jpg' | 'link'

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

/* ─── Quiz questions ───────────────────────────────────────────────────────── */

/**
 * One option on a multiple-choice question, AS THE AUTHOR SEES IT.
 *
 * `correct` is present here and NOWHERE on the learner path. The authoring
 * endpoint is admin-gated precisely so this field can exist; QuizQuestion in
 * services/lms/quiz.ts deliberately has no equivalent, and the server does not
 * select the column for a learner.
 */
export interface QuestionOptionDraft {
  id?: number
  answer: string
  correct: boolean
}

/** A question on a paper, with its options and which of them are right. */
export interface PaperQuestion {
  id: number
  question_title: string | null
  description: string | null
  points: number
  hint_text: string | null
  options: { id: number; answer: string; correct: boolean }[]
}

export interface PaperQuestionsResponse {
  status: boolean
  data: PaperQuestion[]
  total_marks: number
}

/**
 * What the author submits.
 *
 * An empty `options` array means a WRITTEN answer, marked by the AI marker and
 * held for a human when it cannot be. Options with none marked correct are
 * refused by the server — that combination can never be marked by anything.
 */
export interface QuestionPayload {
  question_title: string
  description?: string | null
  points?: number
  hint_text?: string | null
  options?: QuestionOptionDraft[]
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
      /**
       * The canonical media column, and what the player reads first. The
       * wizard sent only `url`, which the server did not accept — so every
       * lesson it made was stored with no media at all.
       */
      filename?: string | null
      url?: string | null
      sort_order?: number
    },
    profileName?: string,
  ) =>
    apiClient.post<BuilderApiResponse<BuilderContent>>('/lms/learning/content', {
      ...params(context, profileName),
      ...body,
    }),

  /**
   * POST /lms/learning/content/upload — put a lesson file where the player can
   * open it.
   *
   * Until this existed a lesson could only ever be a public URL: both authoring
   * surfaces asked for one, and course-authoring.tsx said "Uploads are handled
   * by the content library" — a content library that does not exist anywhere in
   * this codebase. An author with a PDF on their laptop had no way in.
   *
   * The response carries the `file_type` the player switches on, derived
   * server-side from the real extension rather than guessed here.
   */
  uploadContent: (context: LaravelContext, file: File, courseId?: number) => {
    const form = new FormData()

    Object.entries(params(context)).forEach(([key, value]) => form.append(key, value))
    form.append('file', file)
    if (courseId) form.append('course_id', String(courseId))

    return apiClient.postForm<
      BuilderApiResponse<{ url: string; file_type: string; filename: string; size: number }>
    >('/lms/learning/content/upload', form)
  },

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

  /* ── Questions on a paper ──────────────────────────────────────────────
   *
   * THE HALF OF QUIZ AUTHORING THAT DID NOT EXIST.
   *
   * Until these, a quiz could be created, named, given a pass mark and an
   * attempt limit — and never asked a question. There was no API path that
   * wrote lms_question_master or answer_master at all, so every quiz authored
   * in this product had total_ques = 0 and the wizard reported it without
   * comment. The scorer, the competency rating and the certificate gate were
   * all finished and unreachable by any admin.
   *
   * The server keeps question_ids, total_ques and total_marks in step on every
   * write, so the paper can never disagree with its own contents.
   */

  /** GET — the paper's own questions, WITH which option is correct (admin). */
  paperQuestions: (context: LaravelContext, paperId: number) =>
    apiClient.get<PaperQuestionsResponse>(
      `/lms/assessments/${paperId}/questions`,
      params(context),
    ),

  /**
   * Write questions from the course's own modules, lessons and capabilities.
   *
   * Appends - it never replaces what an author already wrote. The response
   * says how many were kept, how many were unusable and how many are tied to a
   * capability, because "generated 5" and "generated 7, discarded 2" are
   * different facts and only one of them is honest.
   */
  generateQuestions: (
    context: LaravelContext,
    paperId: number,
    payload: { count: number; formats: string[] },
    profileName?: string,
  ) =>
    apiClient.post<
      BuilderApiResponse<{
        created: number
        dropped: number
        cited: number
        modules_used: number
        capabilities_available: number
      }>
    >(`/lms/assessments/${paperId}/questions/generate`, {
      ...params(context, profileName),
      ...payload,
    }),

  addQuestion: (
    context: LaravelContext,
    paperId: number,
    payload: QuestionPayload,
    profileName?: string,
  ) =>
    apiClient.post<BuilderApiResponse<{ id: number }>>(
      `/lms/assessments/${paperId}/questions`,
      { ...params(context, profileName), ...payload },
    ),

  updateQuestion: (
    context: LaravelContext,
    paperId: number,
    questionId: number,
    payload: QuestionPayload,
    profileName?: string,
  ) =>
    apiClient.put<BuilderApiResponse<null>>(
      `/lms/assessments/${paperId}/questions/${questionId}`,
      { ...params(context, profileName), ...payload },
    ),

  deleteQuestion: (
    context: LaravelContext,
    paperId: number,
    questionId: number,
    profileName?: string,
  ) =>
    apiClient.delete<BuilderApiResponse<null>>(
      `/lms/assessments/${paperId}/questions/${questionId}`,
      { ...params(context, profileName) },
    ),

  /**
   * How many people the current audience would reach, before committing to it.
   *
   * The count is computed by the same server code that does the writing, so
   * the number shown cannot disagree with the number assigned. Expanding
   * "everyone in Nursing" in the browser was not an option: the learner
   * endpoint caps at 200 rows, so a large department would have been silently
   * half-assigned.
   */
  previewAudience: (context: LaravelContext, courseId: number, audience: AudiencePayload) =>
    apiClient.get<BuilderApiResponse<AudiencePreview>>(
      `/lms/courses/${courseId}/audience/preview`,
      { ...params(context), ...audienceQuery(audience) },
    ),

  /** Assign the course to everyone the audience resolves to. Idempotent. */
  assignAudience: (
    context: LaravelContext,
    courseId: number,
    audience: AudiencePayload,
    profileName?: string,
  ) =>
    apiClient.post<BuilderApiResponse<AudienceResult>>(`/lms/courses/${courseId}/audience`, {
      ...params(context, profileName),
      ...audience,
    }),
}

export interface AudiencePayload {
  user_ids: number[]
  department_ids: number[]
  jobrole_ids: number[]
  assignment_type?: string
  due_date?: string | null
}

export interface AudiencePreview {
  count: number
  already_enrolled: number
  will_assign: number
  sample: { id: number; name: string; department: string | null; jobrole: string | null }[]
}

export interface AudienceResult {
  assigned: number
  already_had_it: number
  reached: number
}

/** Arrays have to go over the query string as repeated keys. */
function audienceQuery(audience: AudiencePayload): Record<string, string> {
  const query: Record<string, string> = {}
  audience.user_ids.forEach((id, index) => { query[`user_ids[${index}]`] = String(id) })
  audience.department_ids.forEach((id, index) => { query[`department_ids[${index}]`] = String(id) })
  audience.jobrole_ids.forEach((id, index) => { query[`jobrole_ids[${index}]`] = String(id) })
  return query
}
