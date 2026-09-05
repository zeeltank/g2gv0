/**
 * Build with AI Service
 *
 * Backed by /api/lms/ai/* (App\Http\Controllers\Api\AiCourseController).
 *
 * Outline generation runs on DeepSeek server-side. The previous frontend called
 * OpenRouter from its own Next.js route with the key in the Node process; this
 * frontend never sees a provider key at all.
 *
 * Presentation rendering is asynchronous: `generatePresentation` returns a
 * generationId straight away and the caller polls `getGenerationStatus`, rather
 * than holding a request open for the several minutes Gamma can take.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

export interface AiApiResponse<T> {
  status: boolean
  message?: string
  data: T
}

export interface AiProviderStatus {
  deepseek_configured: boolean
  deepseek_model: string
  gamma_configured: boolean
}

export interface AiSlide {
  slide_number: number
  title: string
  bullets: string[]
  speaker_notes: string
}

export interface AiOutline {
  title: string
  summary: string
  learning_objectives: string[]
  slides: AiSlide[]
  requested_slide_count: number
}

export interface AiOutlineResult {
  outline: AiOutline
  /** The flattened outline that gets handed to Gamma as slide input. */
  plain_text: string
  model: string
  slide_count: number
}

/* ─── Scope options ──────────────────────────────────────────────────── */

/**
 * What the Build-with-AI form is made of.
 *
 * Every field on that form used to be a free-text input — industry,
 * department, job role, proficiency, and a comma-separated "target skills"
 * box — so the generator was fed whatever somebody typed and the outline could
 * not be traced back to anything in the system. All of it exists as real,
 * related data; this is that data.
 */
export interface AiScopeJobRole {
  id: number
  jobrole: string
  department_id: number | null
  department: string | null
  industries: string | null
}

export interface AiScopeCompetency {
  id: number
  name: string
  code: string | null
  required_proficiency: number | null
  is_mandatory: number
  jobrole_id: number
}

/** knowledge / skill / behaviour / attitude / ability, per competency. */
export interface AiScopeKasbaItem {
  id: number
  competency_id: number
  kasba_type: string
  item_label: string
  weight: string | number | null
}

export interface AiScopeOptions {
  industries: string[]
  departments: { id: number; department: string }[]
  jobroles: AiScopeJobRole[]
  /**
   * Only populated when jobrole_ids are supplied — a course is scoped by the
   * competencies of the roles it is for, not by a global list.
   */
  competencies: AiScopeCompetency[]
  kasba_items: AiScopeKasbaItem[]
  kasba_types: string[]
}

/**
 * What the generator is told about the course.
 *
 * `department`, `job_role` and `skills` are ARRAYS now. They were single
 * strings, which forced a course aimed at three roles to name one of them and
 * drop the rest.
 *
 * `modality` is gone. It was a pair of checkboxes labelled with a word the
 * people using this form do not use, it changed nothing the model could act
 * on, and its only visible effect was a line in the generated deck reading
 * "Modality Instructions".
 */
export interface AiOutlineRequest {
  industry?: string
  /** hrms_departments.id values. */
  department_ids?: number[]
  /** s_user_jobrole.id values. */
  jobrole_ids?: number[]
  critical_work_function?: string
  tasks?: string[]
  /**
   * How the course is scoped: by whole competencies, or by individual KASBA
   * items. Only 9 of tenant 6's 266 job roles have competencies mapped, so a
   * form offering competencies alone would be empty for almost every role.
   */
  scope_mode?: 'competency' | 'kasba'
  competency_ids?: number[]
  kasba_item_ids?: number[]
  proficiency?: string
  course_title?: string
  slide_count?: number
  model?: string
}

export interface AiPresentationRequest {
  outline: AiOutline
  input_fields?: Record<string, unknown>
  configure_fields?: Record<string, unknown>
  course_type?: string
  slide_count?: number
  ai_model?: string
}

export interface AiPresentationStarted {
  outline_id: number
  generation_id: string
  status: string
}

/** Gamma's own statuses, plus the local `draft` for an unrendered outline. */
export type AiGenerationStatus = 'draft' | 'pending' | 'completed' | 'failed' | string

export interface AiGenerationStatusResult {
  outline_id: number | null
  generation_id: string
  generation_status: AiGenerationStatus
  gamma_url: string | null
  export_url: string | null
}

export interface AiSavedOutline {
  id: number
  course_type: string
  outline: AiOutline | null
  input_fields: Record<string, unknown> | null
  configure_fields: Record<string, unknown> | null
  presentation_platform: string | null
  ai_model: string | null
  slide_count: number | null
  generation_id: string | null
  gamma_url: string | null
  export_url: string | null
  status: AiGenerationStatus | null
  course_id: number | null
  created_at: string | null
}

export interface AiPublishRequest {
  display_name: string
  standard_id: number
  subject_category?: string | null
  subject_type?: string | null
  jobrole?: string | null
  status?: number
  /**
   * The full scope, so the published course carries what it was generated for.
   *
   * sub_std_map has one free-text `jobrole` column and one `standard_id`, so a
   * course for three roles in two departments could only ever record one of
   * each. These go to lms_course_settings and course_competency_map, where a
   * set can actually be stored.
   */
  department_ids?: number[]
  jobrole_ids?: number[]
  competency_ids?: number[]
}

export interface AiPublishResult {
  course_id: number
  outline_id: number
  gamma_url: string | null
  export_url: string | null
}

/**
 * The backend gates authoring on `user_profile_name`, so it rides along on
 * every write. It is the raw Laravel profile, not this frontend's mapped Role.
 */
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

export const aiCourseService = {
  /** GET /api/lms/ai/status - whether DeepSeek and Gamma are configured. */
  /**
   * GET /lms/ai/scope-options
   *
   * Pass jobrole_ids to get the competencies those roles map to and the KASBA
   * items underneath them; omit them for just the industry/department/role
   * lists.
   */
  getScopeOptions: (context: LaravelContext, jobroleIds: number[] = []) =>
    apiClient.get<AiApiResponse<AiScopeOptions>>(
      '/lms/ai/scope-options',
      params(
        context,
        undefined,
        jobroleIds.length
          ? Object.fromEntries(jobroleIds.map((id, i) => [`jobrole_ids[${i}]`, String(id)]))
          : undefined,
      ),
    ),

  getStatus: (context: LaravelContext) =>
    apiClient.get<AiApiResponse<AiProviderStatus>>('/lms/ai/status', params(context)),

  /** POST /api/lms/ai/outline - DeepSeek generates the slide outline. */
  generateOutline: (
    context: LaravelContext,
    payload: AiOutlineRequest,
    profileName?: string,
  ) =>
    apiClient.post<AiApiResponse<AiOutlineResult>>('/lms/ai/outline', {
      ...params(context, profileName),
      ...payload,
    }),

  /** POST /api/lms/ai/presentation - hand the outline to Gamma (202 + id). */
  generatePresentation: (
    context: LaravelContext,
    payload: AiPresentationRequest,
    profileName?: string,
  ) =>
    apiClient.post<AiApiResponse<AiPresentationStarted>>('/lms/ai/presentation', {
      ...params(context, profileName),
      ...payload,
    }),

  /** GET /api/lms/ai/presentation/{generationId} - poll the render. */
  getGenerationStatus: (context: LaravelContext, generationId: string) =>
    apiClient.get<AiApiResponse<AiGenerationStatusResult>>(
      `/lms/ai/presentation/${generationId}`,
      params(context),
    ),

  /** GET /api/lms/ai/outlines - previously generated outlines for this tenant. */
  getOutlines: (context: LaravelContext, limit = 25) =>
    apiClient.get<AiApiResponse<AiSavedOutline[]>>(
      '/lms/ai/outlines',
      params(context, undefined, { limit: String(limit) }),
    ),

  /** POST /api/lms/ai/outlines/{id}/publish - turn an outline into a course. */
  publishOutline: (
    context: LaravelContext,
    outlineId: number,
    payload: AiPublishRequest,
    profileName?: string,
  ) =>
    apiClient.post<AiApiResponse<AiPublishResult>>(`/lms/ai/outlines/${outlineId}/publish`, {
      ...params(context, profileName),
      ...payload,
    }),
}
