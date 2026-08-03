'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/components/auth/gtg-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { sidebarService } from '@/services/navigation/sidebar'
import type { SidebarModuleNode, SidebarMenuNode, SidebarSubmenuNode } from '@/services/navigation/sidebar'
import { HOME_NAV, getRouteByAccessLink, type NavModule, type NavMenu, type NavSubmenu, type ActiveNav } from '@/lib/gtg-navigation'

const HOME_MODULE: NavModule = {
  id: HOME_NAV.moduleId,
  label: 'Main Dashboard',
  short: 'Home',
  icon: 'mdi mdi-view-dashboard-outline',
  accessLink: '/dashboard',
  standalone: true,
  menus: [],
}

function toSubmenu(node: SidebarSubmenuNode): NavSubmenu {
  return { id: String(node.id), label: node.label, icon: node.icon, accessLink: node.access_link }
}

function toMenu(node: SidebarMenuNode): NavMenu {
  return {
    id: String(node.id),
    label: node.label,
    icon: node.icon,
    accessLink: node.access_link,
    submenus: (node.submenus ?? []).map(toSubmenu),
  }
}

function toModule(node: SidebarModuleNode): NavModule {
  return {
    id: String(node.id),
    label: node.label,
    short: node.label,
    icon: node.icon,
    accessLink: node.access_link,
    menus: (node.menus ?? []).map(toMenu),
  }
}

export interface SidebarNavigationResult {
  modules: NavModule[]
  loading: boolean
  error: string | null
  getRoutePath: (active: ActiveNav) => string
  parseRoutePath: (pathname: string) => ActiveNav | null
  /** Resolves a known tblmenumaster_g2g access_link against the caller's live, rights-filtered tree; falls back to '/dashboard' if the profile can't see it. */
  resolveAccessLink: (accessLink: string) => string
}

/**
 * Loads Modules -> Menus -> Submenus from tblmenumaster_g2g (via
 * ajax_sidebar_menu_g2g), already filtered server-side to the caller's
 * profile rights. Cached by react-query so every consumer (GtgAppShell,
 * GtgPageShell) shares a single fetch.
 */
export function useSidebarNavigation(): SidebarNavigationResult {
  const { user } = useAuth()
  const context = getLaravelContext(user)
  const ready = isLaravelContextReady(context)

  const query = useQuery({
    queryKey: ['sidebar-navigation', context.token, context.subInstituteId, context.profileId],
    queryFn: () => sidebarService.getMenu(context),
    enabled: ready,
    staleTime: 5 * 60 * 1000,
  })

  const modules = useMemo(() => {
    const apiModules = (query.data?.data ?? []).map(toModule)
    return [HOME_MODULE, ...apiModules]
  }, [query.data])

  // `${moduleId}:${menuId}:${submenuId}` -> access_link, and the reverse lookup.
  const { pathByKey, keyByPath } = useMemo(() => {
    const pathByKey = new Map<string, string>()
    const keyByPath = new Map<string, ActiveNav>()

    const record = (active: ActiveNav, accessLink: string | null | undefined) => {
      if (!accessLink) return
      pathByKey.set(`${active.moduleId}:${active.menuId}:${active.submenuId}`, accessLink)
      keyByPath.set(accessLink, active)
    }

    for (const mod of modules) {
      record({ moduleId: mod.id, menuId: mod.id, submenuId: mod.id }, mod.accessLink)
      for (const menu of mod.menus) {
        record({ moduleId: mod.id, menuId: menu.id, submenuId: menu.id }, menu.accessLink)
        for (const submenu of menu.submenus) {
          record({ moduleId: mod.id, menuId: menu.id, submenuId: submenu.id }, submenu.accessLink)
        }
      }
    }

    return { pathByKey, keyByPath }
  }, [modules])

  const getRoutePath = (active: ActiveNav): string => {
    if (active.moduleId === 'm0') return '/dashboard'
    return pathByKey.get(`${active.moduleId}:${active.menuId}:${active.submenuId}`) ?? '/dashboard'
  }

  const parseRoutePath = (pathname: string): ActiveNav | null => {
    if (pathname === '/dashboard') return HOME_NAV
    return keyByPath.get(pathname) ?? null
  }

  const resolveAccessLink = (accessLink: string): string => {
    return getRouteByAccessLink(modules, accessLink) ?? '/dashboard'
  }

  return {
    modules,
    loading: ready && query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    getRoutePath,
    parseRoutePath,
    resolveAccessLink,
  }
}
