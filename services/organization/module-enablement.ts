import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'

/**
 * Which modules this organisation uses.
 *
 * Replaces the only "persistence" the setup screens had: a `Map` living in the
 * Next.js process (`app/api/onboarding/route.ts`), keyed by user rather than
 * tenant, unauthenticated, and emptied on every redeploy. Two administrators of
 * one organisation each had their own copy, and nothing either of them chose
 * reached the product.
 *
 * These are routes/api.php routes, so apiClient - which attaches the bearer
 * token from the stored session, keeping it out of the query string.
 */

export type OrganizationModule = {
  /** tblmenumaster_g2g id of the level-1 module row. */
  id: number
  name: string
  icon: string | null
  access_link: string | null
  /** Real counts from the real menu catalogue, not the invented "15 / 48". */
  screens: number
  menus: number
  enabled: boolean
  /**
   * Main Dashboard and Organizational Management. Switching either off would
   * leave the organisation unable to reach the screens it needs to switch them
   * back on, so the server refuses and the UI does not offer it.
   */
  always_on: boolean
}

export type ModuleEnablementResponse = {
  status: boolean
  data: {
    modules: OrganizationModule[]
    profile: { id: number; name: string }
    /** The server's own words on what enabling does. Rendered, not paraphrased. */
    note: string
  }
}

export type ModuleSaveResponse = {
  status: boolean
  message: string
  data: { enabled: number[]; disabled: number[] }
}

function params(context: LaravelContext) {
  return {
    sub_institute_id: context.subInstituteId,
    ...(context.token ? { type: 'api', token: context.token } : {}),
  }
}

export const moduleEnablementService = {
  list: (context: LaravelContext) =>
    apiClient.get<ModuleEnablementResponse>('/organization/modules', params(context)),

  /**
   * Send the COMPLETE set that should be on - anything absent is switched off.
   *
   * A complete set rather than a delta because the screen shows a complete set
   * of switches; a delta would let the two disagree about what "off" meant.
   */
  save: (context: LaravelContext, moduleIds: number[]) =>
    apiClient.post<ModuleSaveResponse>('/organization/modules', {
      ...params(context),
      module_ids: moduleIds,
    }),
}
