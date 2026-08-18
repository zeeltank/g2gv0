/**
 * Competency DEFINITIONS service — `/api/competency/definitions`.
 *
 * A competency is a NAMED BUNDLE OF KASBA ITEMS (Q-A2). This is deliberately
 * separate from `services/competency/command-center.ts`, whose `competency`
 * endpoint (`/competency/competencies`) writes a flat SKILL row into
 * `s_users_skills` — a different concept wearing a similar name (G-RBAC-02b).
 *
 * TARGET vs HOLDING, the distinction this service exposes to the UI:
 *   item_id populated → resolved BY KEY. The target state.
 *   item_label only   → a HOLDING state. Counted as unresolved in coverage.
 *
 * ALL FIVE dimensions have a canonical table and all five resolve by key. The
 * server validates each `item_id` against its own table inside the caller's
 * tenant, and drops it to a label if it does not exist there.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

export const KASBA_TYPES = ['skill', 'knowledge', 'ability', 'attitude', 'behaviour'] as const
export type KasbaType = (typeof KASBA_TYPES)[number]

/**
 * Every dimension has a canonical table, and every one of them resolves.
 *
 * CORRECTED - this used to read `['skill']` with the comment "the only dimension
 * with a canonical table today", and the header above said the other four "have
 * none". THAT WAS NEVER TRUE OF THE DATA (G-SEED-01). The four library tabs have
 * been writing their tables all along:
 *
 *     s_user_knowledge 6,950 · s_user_ability 6,175
 *     s_user_attitude    655 · s_user_behaviour  694     = 14,474 rows
 *
 * What was missing was anything pointing AT them, and a server branch that
 * validated `item_id` only when `kasba_type === 'skill'` - so an id sent for the
 * other four was stored unchecked into a column with no foreign key. It had
 * already produced one dangling pointer.
 *
 * WIDENED ONLY AFTER THAT BRANCH LANDED AND WAS PROVED 12/12 - a real id stored
 * as a key and a nonexistent id dropped to a label, for all five dimensions.
 * Widening first would have manufactured dangling rows at scale.
 */
export const RESOLVABLE_KASBA_TYPES: readonly KasbaType[] = [
  'skill', 'knowledge', 'ability', 'attitude', 'behaviour',
]

export function isResolvable(kind: KasbaType): boolean {
  return RESOLVABLE_KASBA_TYPES.includes(kind)
}

export interface KasbaItem {
  kasba_type: KasbaType
  /** Populated = resolved by key. Null = held by label. */
  item_id: number | null
  item_label: string | null
  weight: number
  resolved: boolean
}

export interface CompetencyDefinition {
  id: number
  code: string | null
  name: string
  type: string | null
  criticality: string | null
  status: string
  items: KasbaItem[]
  /** Feeds the capability-coverage metric. */
  unresolved_items: number
}

export interface CompetencyDefinitionInput {
  name: string
  code?: string | null
  description?: string | null
  /**
   * The framework this competency is filed under, or null.
   *
   * NULLABLE END TO END and permanently valid - a competency with no framework is
   * a normal competency, not an incomplete one. The server verifies any id against
   * the CALLER'S OWN TENANT rather than with a bare exists rule, which would have
   * accepted a valid id belonging to another organisation.
   */
  framework_id?: number | null
  competency_type?: string | null
  criticality?: string | null
  items: Array<{
    kasba_type: KasbaType
    item_id?: number | null
    item_label?: string | null
    weight: number
  }>
}

interface Envelope<T> {
  status: number
  message: string
  data: T
}

export const competencyDefinitionsService = {
  list: (context: LaravelContext) =>
    apiClient.get<Envelope<CompetencyDefinition[]>>(
      '/competency/definitions',
      withLaravelParams(context),
    ),

  /**
   * HR/Admin only — the route carries `profile:admin,hr`, matched on exact
   * role_key since G-AUTH-02. An employee receives 403 from the server; the UI
   * hides the action but the server is what enforces it.
   */
  create: (context: LaravelContext, input: CompetencyDefinitionInput) =>
    apiClient.post<Envelope<{ id: number }>>('/competency/definitions', {
      ...withLaravelParams(context),
      ...input,
    }),
}
