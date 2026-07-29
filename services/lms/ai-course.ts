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

export interface AiOutlineRequest {
  industry?: string
  department?: string
  job_role?: string
  critical_work_function?: string
  tasks?: string[]
  skills?: string[]
  proficiency?: string
  modality?: { selfPaced?: boolean; instructorLed?: boolean }
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
