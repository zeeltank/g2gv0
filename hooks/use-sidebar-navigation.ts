'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/components/auth/gtg-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { sidebarService } from '@/services/navigation/sidebar'
import type { SidebarMenuNode } from '@/services/navigation/sidebar'
import {
  getRouteByAccessLink,
  type NavNode,
  type NavModule,
  type ActiveNav,
} from '@/lib/gtg-navigation'

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
    /*
     * Id breaks a sort_order tie, so the menu never reorders itself between
     * loads. Talent had three pairs sharing a number (3, 4 and 8 each used
     * twice), and with a plain numeric comparator those positions were decided
     * by whatever order MySQL happened to return - stable in practice,
     * guaranteed by nothing. The migration removed today's ties; this makes a
     * future one harmless instead of intermittent.
     */
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
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
  // A MODULE WITH NO SUBMENUS IS STANDALONE. The sidebar uses `standalone` to
  // decide between "navigate straight there" and "expand a list", so a module
  // built from the database without it renders a chevron for children it does
  // not have — which is what Main Dashboard did once it became a real
  // tblmenumaster_g2g row instead of a frontend constant.
  //
  // Derived from the children rather than hardcoded for Home, so any module a
  // tenant creates without submenus behaves correctly too.
  return buildChildren(flat, null).map((node) => ({
    ...node,
    short: node.label,
    standalone: node.children.length === 0,
  }))
}

/**
 * Top-level modules kept out of the rendered sidebar list, by their stable
 * `access_link` rather than a numeric id — dev and live have been observed to
 * disagree on a row's id for the same menu_name/access_link (see the hide
 * migrations' own matching style), so an id would silently target the wrong
 * row on one host.
 *
 * This does NOT hide the screens themselves or touch any right: it only
 * drops the entry from `sidebarModules` (what `<GtgSidebar>` renders).
 * `modules` (full, unfiltered) is still what `resolveAccessLink` searches, so
 * a deep link into one of these modules — e.g. "Agent Management" in the AI
 * & Intelligence launcher, which resolves `/module/agentic-ai/agentic-library`
 * — keeps working for whoever already has rights to it. Someone with no
 * rights to the module still can't reach it either way; nothing about
 * can_view enforcement changes.
 */
const SIDEBAR_HIDDEN_ACCESS_LINKS = new Set<string>(['/module/agentic-ai'])

export interface SidebarNavigationResult {
  /** Full tree, rights-filtered but otherwise complete — what resolution (resolveAccessLink, getRoutePath) reads. */
  modules: NavModule[]
  /** `modules` minus `SIDEBAR_HIDDEN_ACCESS_LINKS` — what `<GtgSidebar>` should render. */
  sidebarModules: NavModule[]
  loading: boolean
  error: string | null
  /** null when nothing is mapped — the caller must decline to navigate, not guess. */
  getRoutePath: (active: ActiveNav) => string | null
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

  /*
   * THE SIDEBAR IS WHAT THE SERVER SENT. NOTHING IS ADDED TO IT.
   *
   * This used to inject a hardcoded HOME_MODULE whenever no module in the
   * response carried '/dashboard':
   *
   *     const hasDbHome = fromDb.some((m) => m.accessLink === '/dashboard')
   *     return hasDbHome ? fromDb : [HOME_MODULE, ...fromDb]
   *
   * It was meant for tenants whose menu tree predated the dashboard row. It
   * could not do that job, because REVOCATION IN THIS SYSTEM IS ROW ABSENCE —
   * there is not one can_view = 0 row in either database; saving rights deletes
   * the profile's set and re-inserts only what was ticked. So "this tenant is
   * old" and "an administrator revoked this" arrive as byte-identical payloads,
   * and the fallback restored the menu in both cases.
   *
   * The result was a menu that no permission could hide. An admin would untick
   * Main Dashboard, the server would correctly drop it, and this line put an
   * identical-looking copy back — same label, same icon, same destination.
   *
   * It also concealed outright failure: a 401 or a network error leaves
   * `query.data` undefined, so `fromDb` is empty, so the sidebar rendered as
   * though the user simply had one menu. A broken fetch displayed as a working
   * sidebar is the worst of the three.
   *
   * A profile with no dashboard right now has no dashboard link — which is what
   * revoking it is supposed to mean. /dashboard itself stays reachable by URL,
   * so this removes the link, not the page.
   */
  const modules = useMemo(() => {
    // Signals, Ingestion Engine, Product Portfolio and Partner Network used to be injected here as
    // standalone sidebar links. They are intentionally no longer added; their routes and pages
    // are untouched (see parseRoutePath below), and Intelligence Loop comes from the server menu.
    return buildModuleTree(query.data?.data ?? [])
  }, [query.data])

  const sidebarModules = useMemo(
    () => modules.filter((module) => !SIDEBAR_HIDDEN_ACCESS_LINKS.has(module.accessLink ?? '')),
    [modules],
  )

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

  const getRoutePath = (active: ActiveNav): string | null => {
    return pathByKey.get(`${active.moduleId}:${active.menuId}:${active.submenuId}`) ?? null
  }

  const parseRoutePath = (pathname: string): ActiveNav | null => {
    if (pathname.startsWith('/signals')) {
      return { moduleId: 'signals', menuId: 'signals', submenuId: 'signals' }
    }
    if (pathname.startsWith('/ingestion')) {
      return { moduleId: 'ingestion', menuId: 'ingestion', submenuId: 'ingestion' }
    }
    if (pathname.startsWith('/portfolio')) {
      return { moduleId: 'portfolio', menuId: 'portfolio', submenuId: 'portfolio' }
    }
    if (pathname.startsWith('/partners')) {
      return { moduleId: 'partners', menuId: 'partners', submenuId: 'partners' }
    }
    return keyByPath.get(pathname) ?? null
  }

  const resolveAccessLink = (accessLink: string): string => {
    if (accessLink === '/signals') return '/signals'
    if (accessLink === '/ingestion') return '/ingestion'
    if (accessLink === '/portfolio') return '/portfolio'
    if (accessLink === '/partners') return '/partners'
    return getRouteByAccessLink(modules, accessLink) ?? '/dashboard'
  }

  return {
    modules,
    sidebarModules,
    loading: ready && query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    getRoutePath,
    parseRoutePath,
    resolveAccessLink,
  }
}
