/**
 * How somebody's capability got to where it is — `/api/competency/capability-progress`.
 *
 * Every capability screen in this product showed a current number and nothing
 * behind it: a person reading "your level is 3 of 4 required" could not tell
 * whether that 3 came from their own self-rating, a manager's judgement two
 * years ago, or an AI-marked quiz. And there was no history at all —
 * competency_kasba_rating holds one row per (person, item), so a re-rating
 * overwrote what came before, and the one "history" view an employee could
 * reach was fabricated: the server stamped both its entries with the CURRENT
 * level, so it always drew a flat line.
 *
 * This reads competency_rating_history, which records every change with the
 * value it replaced and what caused it.
 *
 * NO ARITHMETIC HERE. Levels come from ProficiencyService, the one named
 * roll-up; this module shapes types and nothing else.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

/** Three states, kept apart deliberately. `unmeasured` is not a score. */
export type CapabilityState = 'met' | 'gap' | 'unmeasured'

export interface CapabilityProgressRow {
  competency_id: number
  competency_name: string
  competency_code: string | null
  /** NULL when the role states no level, which is not the same as a bar of 0. */
  required_proficiency: number | null
  is_mandatory: boolean
  /** NULL means UNMEASURED — never render this as 0. */
  measured_level: number | null
  coverage: number
  state: CapabilityState
  /** How many recorded movements there have been. */
  changes: number
  last_changed_at: string | null
  /**
   * The rating held before the earliest recorded change — where the trend
   * starts. NULL means the first record WAS the first measurement, so there is
   * no earlier point to draw from rather than a starting point of zero.
   */
  started_from: number | null
}

export interface CapabilityChange {
  id: number
  kasba_item_id: number | null
  kasba_type: string | null
  item_label: string | null
  competency_id: number | null
  competency_name: string | null
  course_id: number | null
  /** Named, so "you improved" is attributable rather than asserted. */
  course_title: string | null
  /** NULL means this was the first measurement, not a rise from zero. */
  old_rating: number | null
  new_rating: number
  source: string
  source_ref_id: number | null
  assessor_name: string | null
  note: string | null
  changed_at: string
}

export interface CapabilityProgress {
  user: { id: number; name: string }
  competencies: CapabilityProgressRow[]
  history: CapabilityChange[]
  is_self: boolean
}

/** Plain-English names for the `source` column, which is stored as a slug. */
export const CAPABILITY_SOURCE_LABELS: Record<string, string> = {
  lms_quiz: 'Passed a course quiz',
  assessment: 'Capability assessment, approved',
  manual: 'Set by an assessor',
  self: 'Self-assessed',
  kasba_library: 'Recorded against the capability library',
  import: 'Imported',
}

export const capabilityProgressService = {
  /**
   * @param userId omit for the caller's own record. The endpoint defaults to
   *   the caller and applies the module's subject rule, so passing somebody
   *   else's id without the standing to read it is a 403 — and a cross-tenant
   *   id is a 404, never a 403, so existence cannot be probed.
   */
  get: (context: LaravelContext, userId?: number, competencyId?: number) =>
    apiClient.get<{ status: number; data: CapabilityProgress }>(
      '/competency/capability-progress',
      withLaravelParams(context, {
        ...(userId ? { user_id: String(userId) } : {}),
        ...(competencyId ? { competency_id: String(competencyId) } : {}),
      }),
    ),
}
