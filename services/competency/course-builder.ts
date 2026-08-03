/**
 * Course generation from a competency.
 *
 * Wires to the endpoints that already exist rather than adding any:
 *   GET  /lms/ai/status                    is DeepSeek / Gamma configured
 *   POST /lms/ai/outline                   DeepSeek writes the outline
 *   POST /lms/ai/presentation              Gamma renders it to slides
 *   GET  /lms/ai/presentation/{id}         poll until the render finishes
 *
 * The previous app called OpenRouter from the browser with the key in the
 * client bundle. Here the model runs server-side, so the key never leaves the
 * backend and the model can be swapped in config without a frontend release.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

export interface AiStatus {
  deepseek_configured: boolean
  deepseek_model: string
  gamma_configured: boolean
}

export interface OutlineSlide {
  title: string
  bullets?: string[]
  notes?: string
  [key: string]: unknown
}

export interface CourseOutline {
  course_title?: string
  summary?: string
  learning_objectives?: string[]
  slides: OutlineSlide[]
  [key: string]: unknown
}

export interface OutlineResult {
  outline: CourseOutline
  /** The outline flattened to text — what Gamma is handed. */
  plain_text: string
  model: string
  slide_count: number
}

/** What the popup knows about the competency, shaped for the outline prompt. */
export interface OutlineRequest {
  course_title?: string
  job_role?: string
  department?: string
  industry?: string
  skills?: string[]
  proficiency?: string
  critical_work_function?: string
  tasks?: string[]
  slide_count?: number
}

export interface PresentationStart {
  outline_id: number
  generation_id: string
  status: string
}

export interface PresentationStatus {
  outline_id: number | null
  generation_id: string
  /** Gamma's own state: pending / completed / failed. */
  generation_status: string
  gamma_url: string | null
  export_url: string | null
}

interface Envelope<T> {
  status: boolean
  message?: string
  data: T
}

export const courseBuilderService = {
  status: (context: LaravelContext) =>
    apiClient.get<Envelope<AiStatus>>('/lms/ai/status', withLaravelParams(context)),

  /** DeepSeek writes the outline. Slow by nature — this is one long completion. */
  generateOutline: (context: LaravelContext, payload: OutlineRequest) =>
    apiClient.post<Envelope<OutlineResult>>('/lms/ai/outline', {
      ...withLaravelParams(context),
      ...payload,
    }),

  /**
   * Hands the approved outline to Gamma and returns an id to poll. The whole
   * outline object goes over, not flattened text, so the server keeps the
   * structure it stores against the generated record.
   */
  generatePresentation: (
    context: LaravelContext,
    outline: CourseOutline,
    slideCount: number,
    courseType?: string,
  ) =>
    apiClient.post<Envelope<PresentationStart>>('/lms/ai/presentation', {
      ...withLaravelParams(context),
      outline,
      slide_count: slideCount,
      ...(courseType ? { course_type: courseType } : {}),
    }),

  presentationStatus: (context: LaravelContext, generationId: string) =>
    apiClient.get<Envelope<PresentationStatus>>(
      `/lms/ai/presentation/${generationId}`,
      withLaravelParams(context),
    ),
}
