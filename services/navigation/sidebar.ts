/**
 * Sidebar navigation service
 * Fetches the Modules -> Menus -> Submenus hierarchy from tblmenumaster_g2g,
 * pre-filtered server-side to what the caller's profile_id can view.
 */

import { webClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

export interface SidebarSubmenuNode {
  id: number
  label: string
  icon: string | null
  access_link: string | null
  page_type: string | null
  sort_order: number
}

export interface SidebarMenuNode extends SidebarSubmenuNode {
  submenus: SidebarSubmenuNode[]
}

export interface SidebarModuleNode extends SidebarSubmenuNode {
  menus: SidebarMenuNode[]
}

export interface SidebarMenuResponse {
  status_code: number
  message: string
  data: SidebarModuleNode[]
}

export const sidebarService = {
  getMenu: (context: LaravelContext) =>
    webClient.get<SidebarMenuResponse>('/user/ajax_sidebar_menu_g2g', withLaravelParams(context)),
}
