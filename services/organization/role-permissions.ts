import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

/**
 * ROLE & PERMISSIONS — reading and writing tblgroupwise_rights_g2g.
 *
 * THE BACKEND WAS ALREADY COMPLETE AND THE SCREEN CALLED NOTHING. Three routes
 * have existed in routes/user.php the whole time; role-permissions.tsx rendered
 * a matrix and talked to no one. Same shape as the assessment workspace before
 * it was wired.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WHY THIS MATTERS MORE THAN A NORMAL SCREEN
 * ═══════════════════════════════════════════════════════════════════════
 *
 * A PROFILE WITH NO RIGHTS ROWS IS NOT DENIED — IT IS UNFILTERED. The system
 * has nothing to filter the menu by, so it shows everything. That is exactly
 * what happened on live: HR and Employee had zero rows and could open every
 * module, silently, looking entirely normal.
 *
 * So this screen is not a convenience. Until an admin can set these, every new
 * organization starts with its non-admin roles able to see everything.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * TENANT SAFETY IS THE SERVER'S, AND IT IS GOOD
 * ═══════════════════════════════════════════════════════════════════════
 *
 *   - the tenant comes from apiTenantId() — the token, never the request
 *   - every submitted menu_id is validated with FIND_IN_SET against the
 *     caller's OWN tenant, so an admin cannot grant rights on a menu their
 *     organization does not have
 *   - the delete/insert runs in one transaction
 *
 * The save deletes by profile_id alone, without a tenant clause. MEASURED AND
 * SAFE: profile ids are allocated per tenant (1,2,3 = tenant 1; 4,5,6 = tenant
 * 2), and zero profiles have rights rows spanning more than one tenant. It is
 * redundant rather than dangerous — but it holds because of how ids happen to
 * be allocated, not because the query says so.
 */

export interface RightsRow {
  menu_id: number
  can_view: 0 | 1
  can_add: 0 | 1
  can_edit: 0 | 1
  can_delete: 0 | 1
  dashboard_right?: 0 | 1
  is_mobile?: 0 | 1
}

export interface RightsMenu extends RightsRow {
  menu_name: string
  parent_id: number
  children?: RightsMenu[]
}

export interface UserProfile {
  id: number
  name: string
  role_key?: string | null
  data_scope?: string | null
}

export const rolePermissionsService = {
  /** Every profile in the caller's own organization. */
  async profiles(context: LaravelContext): Promise<UserProfile[]> {
    const res = await apiClient.get<{ status_code: number; data: UserProfile[] }>(
      'ajax_user_profiles_g2g',
      withLaravelParams(context),
    )
    return res.data ?? []
  },

  /**
   * The full menu tree for one profile, with its current rights on each node.
   *
   * A menu the profile has NO row for comes back with all flags 0 — which is
   * the correct reading of "no row": not granted. The screen must show that as
   * an unticked box, never as an absent row, or an admin cannot grant it.
   */
  async rightsFor(profileId: number, context: LaravelContext): Promise<RightsMenu[]> {
    const res = await apiClient.get<{ status_code: number; data: RightsMenu[] }>(
      'ajax_groupwiserights_g2g',
      withLaravelParams(context, { profile_id: String(profileId) }),
    )
    return res.data ?? []
  },

  /**
   * Replace this profile's rights with exactly what is sent.
   *
   * THIS IS A REPLACE, NOT A MERGE. Anything omitted is removed. The screen
   * must therefore send the WHOLE matrix, not just what changed — sending only
   * the ticked boxes of one module would silently revoke every other module.
   *
   * The server drops rows where every flag is 0, so an all-unticked menu is
   * stored as absent rather than as a row of zeros. Both mean the same thing to
   * the menu builder.
   */
  async save(
    profileId: number,
    rights: RightsRow[],
    context: LaravelContext,
  ): Promise<{ saved: boolean; message: string }> {
    const res = await apiClient.post<{ status_code: number; message: string }>(
      'save_groupwiserights_g2g',
      {
        ...withLaravelParams(context),
        profile_id: profileId,
        rights,
      },
    )
    return { saved: res.status_code === 1, message: res.message ?? '' }
  },
}
