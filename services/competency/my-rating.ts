import { apiClient } from '@/services/core'
import { withLaravelParams, getLaravelContext } from '@/lib/laravel-context'
import type { LaravelContext } from '@/lib/laravel-context'

/**
 * THE EMPLOYEE'S OWN CAPABILITY, AND THEIR OWN RATING OF IT.
 *
 * ── WHY THIS IS NOT kasba-rating.ts ─────────────────────────────────────────
 *
 * `kasbaRatingService` takes a `user_id`, because HR rating somebody else must
 * name them — and every route behind it is `profile:admin,hr`, so an employee
 * calling it gets a 403. It is reachable only from the Employee Directory,
 * which employees do not have.
 *
 * These endpoints accept NO SUBJECT AT ALL. The server resolves the caller from
 * the token, so there is no id in this file that could ask about, or write to,
 * anybody else's record. That is the same structural guarantee
 * `/competency/my-capability` already makes for reading.
 */

export interface MyCapabilityItem {
  kasba_item_id: number
  kasba_type: string
  item_label: string
  weight: number | string | null
  competency_id: number | null
  competency_name: string | null
  required_proficiency: number | string | null
  is_mandatory: boolean
  /** null = nobody has rated this yet. NOT a score of zero. */
  rating: number | null
  rated_at: string | null
  /** Present when the row was written by an assessor rather than the employee. */
  source?: string | null
}

export interface MyCapabilityCompetency {
  competency_id: number | null
  competency_name: string | null
  competency_description: string | null
  required_proficiency: number | string | null
  is_mandatory: boolean
  items_total: number
  items_rated: number
  /** Types present in THIS competency, not the full vocabulary. */
  by_type: Record<string, MyCapabilityItem[]>
}

export interface MyCapabilityResponse {
  status: number
  data: {
    user_id: number
    jobrole_id: number | null
    jobrole: string | null
    department: string | null
    competencies: MyCapabilityCompetency[]
    items_total: number
    items_rated: number
    /** Counted, never presented as a score. */
    items_unrated: number
  }
  empty_is_expected: boolean
  empty_reason: string | null
  scope: string
}

export const myRatingService = {
  /** GET /competency/my-capability — my role, my competencies, my ratings. */
  capability: (context?: LaravelContext) =>
    apiClient.get<MyCapabilityResponse>(
      '/competency/my-capability',
      withLaravelParams(context ?? getLaravelContext()),
    ),

  /**
   * POST /competency/my-rating — rate one of MY OWN items.
   *
   * No user_id is sent and none may be added. The server ignores one if it
   * arrives, so a stale value in localStorage cannot misdirect a save.
   */
  rate: (kasbaItemId: number, rating: number, note?: string, context?: LaravelContext) =>
    apiClient.post<{ status: number; message: string }>(
      '/competency/my-rating',
      withLaravelParams(context ?? getLaravelContext(), {
        kasba_item_id: String(kasbaItemId),
        rating: String(rating),
        ...(note ? { note } : {}),
      }),
    ),

  /** DELETE /competency/my-rating — withdraw my own rating, returning it to unrated. */
  clear: (kasbaItemId: number, context?: LaravelContext) =>
    apiClient.delete<{ status: number; message: string }>(
      '/competency/my-rating',
      withLaravelParams(context ?? getLaravelContext(), {
        kasba_item_id: String(kasbaItemId),
      }),
    ),
}
