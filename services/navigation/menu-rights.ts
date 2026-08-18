/**
 * Menu rights service
 * Backs the Role & Permissions screen: the complete tblmenumaster_g2g tree
 * (levels 1, 2 and 3) stamped with one profile's rights, the roles that can be
 * edited, and the save call that rewrites tblgroupwise_rights_g2g.
 *
 * Deliberately NOT the sidebar endpoint: ajax_sidebar_menu_g2g hides anything
 * the profile cannot view, which is exactly the rows an admin needs to see
 * unticked here.
 */

import { webClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

/** Laravel returns rights as 0/1 ints, one column per action. */
export interface MenuRightFlags {
  can_view: number
  can_add: number
  can_edit: number
  can_delete: number
  dashboard_right: number
  is_mobile: number
}

export interface MenuRightsSubmenuNode extends MenuRightFlags {
  id: number
  label: string
  icon: string | null
  access_link: string | null
  page_type: string | null
  sort_order: number
}

export interface MenuRightsMenuNode extends MenuRightsSubmenuNode {
  submenus: MenuRightsSubmenuNode[]
}

export interface MenuRightsModuleNode extends MenuRightsSubmenuNode {
  menus: MenuRightsMenuNode[]
}

export interface MenuRightsResponse {
  status_code: number
  message: string
  data: MenuRightsModuleNode[]
}

/** A row of tbluserprofilemaster - "role" in the UI, "profile" in Laravel. */
export interface RoleProfile {
  id: number
  name: string
  description: string | null
  sort_order: number | null
  user_count: number
}

export interface RoleProfilesResponse {
  status_code: number
  message: string
  data: RoleProfile[]
}

export interface MenuRightPayload extends MenuRightFlags {
  menu_id: number
}

export interface SaveRightsResponse {
  status_code: number
  message: string
  data?: { saved: number }
}

export interface CreateRoleResponse {
  status_code: number
  message: string
  data: RoleProfile
}

export const menuRightsService = {
  getRoles: (context: LaravelContext) =>
    webClient.get<RoleProfilesResponse>('/user/ajax_user_profiles_g2g', withLaravelParams(context)),

  /** `profileId` is the role being edited, which is not the caller's own profile. */
  getRights: (context: LaravelContext, profileId: string) =>
    webClient.get<MenuRightsResponse>(
      '/user/ajax_groupwiserights_g2g',
      withLaravelParams(context, { profile_id: profileId }),
    ),

  saveRights: (context: LaravelContext, profileId: string, rights: MenuRightPayload[]) =>
    webClient.post<SaveRightsResponse>('/user/save_groupwiserights_g2g', {
      ...withLaravelParams(context, { profile_id: profileId }),
      rights,
    }),

  createRole: (context: LaravelContext, role: { name: string; description?: string }) =>
    webClient.post<CreateRoleResponse>('/user/save_user_profile_g2g', {
      ...withLaravelParams(context),
      name: role.name,
      description: role.description ?? '',
    }),
}
