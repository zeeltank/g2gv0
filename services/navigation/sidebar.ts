/**
 * Sidebar navigation service
 * Fetches the Modules -> Menus -> Submenus hierarchy from tblmenumaster_g2g,
 * pre-filtered server-side to what the caller's profile_id can view.
 */

import { webClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

/**
 * A single tblmenumaster_g2g row, at any depth (module, menu, submenu, or
 * deeper). The API is free to either nest children inline (under `menus`,
 * `submenus`, or `children` — whichever key it uses at a given level) or
 * stamp each row with its own `parent_id`; the tree builder in
 * useSidebarNavigation reads both and prefers the explicit `parent_id` when
 * present, so neither the field name nor the nesting depth is assumed here.
 */
export interface SidebarMenuNode {
  id: number
  parent_id?: number | null
  level?: number
  label: string
  icon: string | null
  access_link: string | null
  page_type: string | null
  sort_order: number
  menus?: SidebarMenuNode[]
  submenus?: SidebarMenuNode[]
  children?: SidebarMenuNode[]
}

export interface SidebarMenuResponse {
  status_code: number
  message: string
  data: SidebarMenuNode[]
}

export const sidebarService = {
  getMenu: (context: LaravelContext) =>
    webClient.get<SidebarMenuResponse>('/user/ajax_sidebar_menu_g2g', withLaravelParams(context)),
}
