/**
 * Role requirements — `jobrole_competency_map`, the table the whole chain
 * resolves against.
 *
 * WHY THIS FILE EXISTS
 *
 * Every gap, every 9-box position and every recommendation resolves against
 * `jobrole_competency_map`. It held 23 rows, because the ONLY writer in the
 * product — `POST /competency/role-map`, guarded `profile:admin,hr` — was
 * reachable from exactly one place: the Command Center quick-create menu. The
 * Framework screen and the role/skill matrix, the two screens a person would
 * actually look in, could not write it.
 *
 * This service does not add a writer. It gives the existing guarded one a typed
 * client so a screen can call it. ONE WRITER, ALREADY GUARDED, ALREADY PROBED.
 *
 * SYNC SEMANTICS — READ THIS BEFORE CALLING `save`
 *
 * `POST /competency/role-map` is a SYNC, not an append. Rows absent from
 * `items` are DELETED for that role in that tenant. That is deliberate on the
 * server (a competency dropped from a role's list used to survive forever and
 * inflate every later gap calculation), and it means:
 *
 *   ALWAYS SEND THE ROLE'S COMPLETE LIST. Sending one changed item wipes the
 *   rest.
 *
 * The server also refuses an empty `items` array (`min:1`), so clearing a role
 * entirely is `remove()` per row, never `save([])`.
 *
 * IDS, NOT TEXT. `competency_id` must be a row in the `competency` table (209
 * rows — the KASBA model proper), NOT `s_users_skills` (5,171 rows, the flat
 * skill library). They are different populations wearing similar names, and the
 * server validates against `competency` and rejects the rest with a 422 naming
 * the unknown ids.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

/** One competency requirement on a job role. */
export interface RoleRequirement {
  id: number
  competency_id: number
  competency_name: string
  competency_code: string | null
  required_proficiency: number
  is_mandatory: boolean
}

/** What `save` sends per row. */
export interface RoleRequirementInput {
  competency_id: number
  /** 1–5. The server rejects anything outside that range. */
  required_proficiency: number
  is_mandatory: boolean
}

export interface RoleRequirementsResponse {
  status: number
  data: RoleRequirement[]
}

/**
 * The server answers 201 with the counts nested under `data` — verified by
 * running it, after the first version of this type assumed they were top-level
 * and `res.removed` would have been silently `undefined` in the UI.
 *
 *   { status, message, data: { jobrole_id, written, removed } }
 */
export interface SaveResult {
  status: number
  message: string
  data: {
    jobrole_id: number
    /** Rows written or updated. */
    written: number
    /**
     * Rows REMOVED because they were absent from the payload. Surfaced because
     * a silent deletion is worse than no deletion — the screen shows this
     * number back to the user.
     */
    removed: number
  }
}

export const roleRequirementsService = {
  /** GET /competency/role-map — the requirements already set on one role. */
  list: (context: LaravelContext, jobroleId: number) =>
    apiClient.get<RoleRequirementsResponse>(
      '/competency/role-map',
      withLaravelParams(context, { jobrole_id: String(jobroleId) }),
    ),

  /**
   * POST /competency/role-map — SYNC a role's complete requirement list.
   *
   * HR/Admin only; the route carries `profile:admin,hr` matched on exact
   * role_key. The UI hides the action for everyone else, but the server is what
   * enforces it.
   */
  save: (context: LaravelContext, jobroleId: number, items: RoleRequirementInput[]) =>
    apiClient.post<SaveResult>('/competency/role-map', {
      ...withLaravelParams(context),
      jobrole_id: jobroleId,
      items,
    }),

  /** DELETE /competency/role-map/{id} — drop one requirement row. */
  remove: (context: LaravelContext, id: number) =>
    apiClient.delete<{ status: number; message: string }>(
      `/competency/role-map/${id}`,
      withLaravelParams(context),
    ),
}
