/**
 * Skill matching explanation - `/api/skill-matching/explain`.
 *
 * Reuses the SAME deterministic gap comparison `/competency/gap` already
 * exposes (SkillMatchingController::explainMatch() calls the shared
 * `ResolvesCompetencyGap` trait, not a second implementation of it - see
 * that trait's own header on why a second implementation of this comparison
 * once produced an 85.9% wrong-answer rate). This module shapes types and
 * nothing else; no arithmetic lives here.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'
import type { CompetencyGap } from '@/services/competency/gap'

interface Envelope<T> {
  status: number
  message?: string
  data: T
}

export interface SkillMatchExplanation {
  user_id: number
  jobrole_id: number
  /** The same shape `/competency/gap` returns - required vs measured. */
  gap_summary: CompetencyGap
  /**
   * NULL is a normal state (nothing to explain, or no AI model configured) -
   * never render null as an error. The server returns a plain 503/502 for a
   * genuine failure to generate one; this field is only ever null for the
   * "nothing to explain yet" case `explainMatch()` itself documents.
   */
  explanation: string | null
}

export const skillMatchingService = {
  /**
   * Why one employee does or does not match one job role's competency
   * requirements, grounded in the graph (KASBA items behind each
   * requirement) and the same SQL gap numbers `/competency/gap` uses.
   *
   * CAN FAIL WHERE THE GAP ITSELF WOULD SUCCEED - no AI model configured
   * (503), or generation failing (502). Callers should treat that as "no
   * explanation available", never as "the match is wrong".
   */
  explain: (context: LaravelContext, userId: number, jobroleId: number) =>
    apiClient.get<Envelope<SkillMatchExplanation>>(
      '/skill-matching/explain',
      withLaravelParams(context, {
        user_id: String(userId),
        jobrole_id: String(jobroleId),
      }),
    ),
}
