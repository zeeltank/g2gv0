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
}
