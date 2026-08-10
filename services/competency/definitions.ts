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
 * Today only `skill` has a canonical table (`s_users_skills`). Knowledge,
 * ability, attitude and behaviour have none, so every item in those four
 * dimensions is a label — and the UI must say so rather than offering a picker
 * with nothing behind it.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

export const KASBA_TYPES = ['skill', 'knowledge', 'ability', 'attitude', 'behaviour'] as const
export type KasbaType = (typeof KASBA_TYPES)[number]

/** The only dimension with a canonical table today. */
export const RESOLVABLE_KASBA_TYPES: readonly KasbaType[] = ['skill']

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
