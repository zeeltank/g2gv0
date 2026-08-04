'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/components/auth/gtg-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { sidebarService } from '@/services/navigation/sidebar'
import type { SidebarMenuNode } from '@/services/navigation/sidebar'
import {
  HOME_NAV,
  getRouteByAccessLink,
  type NavNode,
  type NavModule,
  type ActiveNav,
} from '@/lib/gtg-navigation'

const HOME_MODULE: NavModule = {
  id: HOME_NAV.moduleId,
  label: 'Main Dashboard',
  short: 'Home',
  icon: 'mdi mdi-view-dashboard-outline',
  accessLink: '/dashboard',
  standalone: true,
  children: [],
}

type FlatNode = {
  id: number
  parentId: number | null
  label: string
  icon: string | null
  accessLink: string | null
  sortOrder: number
}

/**
 * Flattens whatever nesting shape the API sends (children under `menus`,
 * `submenus`, or `children`, at any depth) into a single list, resolving
 * each row's parent purely from tblmenumaster_g2g's own `parent_id` column
 * when the row carries one — falling back to wherever it was structurally
 * nested only if it doesn't. This means a row that's nested in the wrong
 * place in the raw response (as Task Management's Administration children
 * currently are — see content-map-m6.ts) still ends up under its real
 * parent, without any menu id/name ever being hardcoded here. Top-level
 * `data[]` entries are always modules, regardless of any parent_id they
 * might carry.
 */
function flattenMenuNodes(rawNodes: SidebarMenuNode[] | undefined, structuralParentId: number | null, isRoot: boolean, out: FlatNode[]) {
  for (const raw of rawNodes ?? []) {
    const parentId = isRoot ? null : raw.parent_id ?? structuralParentId
    out.push({
      id: raw.id,
      parentId,
      label: raw.label,
      icon: raw.icon,
      accessLink: raw.access_link,
      sortOrder: raw.sort_order ?? 0,
    })
    flattenMenuNodes(raw.children ?? raw.submenus ?? raw.menus, raw.id, false, out)
  }
}

function buildChildren(flat: FlatNode[], parentId: number | null): NavNode[] {
  return flat
    .filter((node) => node.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((node) => ({
      id: String(node.id),
      label: node.label,
      icon: node.icon,
      accessLink: node.accessLink,
      children: buildChildren(flat, node.id),
    }))
}

/** Builds the full Modules -> Menus -> Submenus -> ... tree from tblmenumaster_g2g id/parent_id relationships, to any depth. */
function buildModuleTree(rawModules: SidebarMenuNode[]): NavModule[] {
  const flat: FlatNode[] = []
  flattenMenuNodes(rawModules, null, true, flat)
  return buildChildren(flat, null).map((node) => ({ ...node, short: node.label }))
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
    return [HOME_MODULE, ...buildModuleTree(query.data?.data ?? [])]
  }, [query.data])

  // `${moduleId}:${menuId}:${submenuId}` -> access_link, and the reverse lookup.
  // ActiveNav only carries 3 ids, so for a node deeper than module->menu->submenu,
  // menuId is its immediate parent and submenuId is the node itself — the tree
  // itself (walked via findNodePath) is what actually carries full depth.
  const { pathByKey, keyByPath } = useMemo(() => {
    const pathByKey = new Map<string, string>()
    const keyByPath = new Map<string, ActiveNav>()

    const record = (active: ActiveNav, accessLink: string | null | undefined) => {
      if (!accessLink) return
      pathByKey.set(`${active.moduleId}:${active.menuId}:${active.submenuId}`, accessLink)
      keyByPath.set(accessLink, active)
    }

    const walk = (moduleId: string, node: NavNode, parent: NavNode | null) => {
      const menuId = parent ? parent.id : node.id
      record({ moduleId, menuId, submenuId: node.id }, node.accessLink)
      for (const child of node.children) {
        walk(moduleId, child, node)
      }
    }

    for (const mod of modules) {
      record({ moduleId: mod.id, menuId: mod.id, submenuId: mod.id }, mod.accessLink)
      for (const menu of mod.children) {
        walk(mod.id, menu, null)
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
