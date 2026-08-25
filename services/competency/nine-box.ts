/**
 * The 9-box grid — `/api/competency/nine-box`.
 *
 * ── WHY THIS FILE DID NOT EXIST ────────────────────────────────────────────
 *
 * `NineBoxController` has been correct, routed and guarded for some time: it
 * reads `ProficiencyService` over `jobrole_competency_map`, excludes unmeasured
 * competencies rather than scoring them zero, and reports how many people it
 * cannot place. **Nothing in this app ever called it** — there was no reference
 * to `nine-box` anywhere in the frontend. The same orphaned-endpoint pattern
 * that left `jobrole_task_competency_map` empty on live.
 *
 * NO ARITHMETIC IN THE CLIENT. Both axes, both bandings and the box assignment
 * are decided server-side.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

export type NineBoxBand = 'low' | 'medium' | 'high'

/** `"<performance>:<capability>"`, e.g. `"high:medium"`. NULL means unplaceable. */
export type NineBoxKey = string

export interface NineBoxEmployee {
  user_id: number
  /** A manager's 1–5 rating. */
  performance: number
  /**
   * ProficiencyService's weighted level, or NULL when nothing was measured.
   *
   * NULL IS NOT THE BOTTOM OF THE GRID. An employee nobody has assessed does
   * not belong at low-capability — that would assert a measurement that was
   * never taken.
   */
  capability: number | null
  /** NULL means unplaceable, which is its own outcome, not a position. */
  box: NineBoxKey | null
  competencies_required: number
}

export interface NineBox {
  employees: NineBoxEmployee[]
  /** Counts per box key. Boxes with nobody in them are absent, not zero. */
  grid: Record<NineBoxKey, number>
  /** People the grid cannot describe. Rendered, never quietly dropped. */
  unplaced: number
  placed: number
  /**
   * The thresholds that produced each position, so a reader can see WHY
   * somebody sits where they do rather than trusting the box.
   */
  bands: {
    performance: { low: number; medium: number }
    capability: { low: number; medium: number }
  }
  /** Present when there is no grid to draw at all. */
  note?: string
}

interface Envelope {
  status: number
  data: NineBox
}

export const nineBoxService = {
  /**
   * Guarded `profile:admin,hr` server-side — this reads every employee's
   * performance rating, so it is not a self-service view. The UI does not
   * police that; the server returns 403.
   */
  get: (context: LaravelContext) =>
    apiClient.get<Envelope>('/competency/nine-box', withLaravelParams(context)),
}
