/**
 * My capability gap — `/api/competency/gap`.
 *
 * The API returns TWO numbers per Q-E2: the weighted roll-up level, and the list
 * of mandatory ITEMS below required. An average can sit above the bar while an
 * item inside it does not, so both travel together and neither is derived here.
 *
 * NO ARITHMETIC IN THE CLIENT. Every level comes from ProficiencyService, the one
 * named roll-up. This module shapes types and nothing else.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

/** Three states, kept apart deliberately. `unmeasured` is not a score. */
export type CompetencyState = 'met' | 'gap' | 'unmeasured'

export interface CompetencyGapRow {
  competency_id: number
  competency_name: string
  competency_code: string | null
  required_proficiency: number
  is_mandatory: boolean
  /** NULL means UNMEASURED — never render this as 0. */
  measured_level: number | null
  state: CompetencyState
  /** Only meaningful where something was measured. */
  gap: number | null
  /** 0–1. How much of the competency's weight the level speaks for. */
  coverage: number
}

export interface MandatoryItemBelow {
  competency_id: number
  competency_name: string
  kasba_item_id: number
  kasba_type: string
  item_label: string | null
  rating: number
  required: number
}

export interface CompetencyGap {
  user_id: number
  jobrole_id: number
  competencies: CompetencyGapRow[]
  mandatory_below_required: MandatoryItemBelow[]
  coverage: {
    competencies_required: number
    competencies_unmeasured: number
  }
}

interface Envelope<T> {
  status: number
  message: string
  data: T
}

/**
 * `GET /competency/gap/narrative`'s own data shape — the same gap payload
 * `mine()` returns, plus one extra field. Kept as a separate type rather than
 * widening `CompetencyGap` itself: a narrative is a GENERATED explanation,
 * never a fact the gap computation produces, and that distinction is worth
 * keeping visible in the type, not folded into the number-bearing shape.
 */
export interface CompetencyGapWithNarrative extends CompetencyGap {
  /**
   * NULL is a normal state (no competencies to explain, or the server
   * chose not to fabricate one) — never render null as an error, and never
   * render it as "no gap". It is the narrative that's absent, not the data.
   */
  narrative: string | null
}

export const competencyGapService = {
  /**
   * An employee may read THEIR OWN gap. Anyone else needs an elevated role_key —
   * the server returns 403 for a colleague and 404 for a stranger, verified
   * through the real request path. The UI does not police this; the server does.
   */
  mine: (context: LaravelContext, userId: number) =>
    apiClient.get<Envelope<CompetencyGap>>(
      '/competency/gap',
      withLaravelParams(context, { user_id: String(userId) }),
    ),

  /**
   * The same gap, plus a short graph-grounded narrative for a manager
   * (Phase 7.4). Same auth shape as `mine()` — own gap, or an elevated role.
   * `jobroleId` is optional, same as the server's own `show()`: the server
   * resolves it from the employee's record when omitted.
   *
   * CAN FAIL WHERE `mine()` SUCCEEDS — no AI model configured (503), or the
   * narrative generation itself failing (502). Callers should treat a
   * narrative failure as "no narrative available", never as "the gap data
   * is wrong" — the two are fetched and can fail independently on purpose.
   */
  narrative: (context: LaravelContext, userId: number, jobroleId?: number) =>
    apiClient.get<Envelope<CompetencyGapWithNarrative>>(
      '/competency/gap/narrative',
      withLaravelParams(context, {
        user_id: String(userId),
        ...(jobroleId ? { jobrole_id: String(jobroleId) } : {}),
      }),
    ),
}
