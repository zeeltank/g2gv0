'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/components/auth/gtg-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { sidebarService } from '@/services/navigation/sidebar'
import type { SidebarMenuNode, SidebarMenuResponse } from '@/services/navigation/sidebar'

/**
 * The rights the person holds on the Contacts menu rows (S18): the server sends `can_view`, `can_add`, `can_edit` and `can_delete` on every row of
 * `ajax_sidebar_menu_g2g`, the same rows its `platformright:/module/crm/marketing/contacts|/module/crm/support/contacts` middleware enforces. Either row grants
 * (the `|` is "or"), so the rights are the union of the two.
 *
 * The rows are read from the RAW answer, not from the sidebar's tree: the tree is what the sidebar draws, and the Contacts rows are folded out of it (they stay
 * in the menu, status 1, so a person keeps the rights they hold). A row that is absent means the person has no right at all (revoking deletes the row).
 * A row that arrives without the `can_*` flags (an older server) grants view only: the server still answers 403 to a write it does not allow.
 */
export const CONTACTS_ACCESS_LINKS: readonly string[] = ['/module/crm/marketing/contacts', '/module/crm/support/contacts']

export interface PeopleRights {
  view: boolean
  add: boolean
  edit: boolean
  delete: boolean
}

type RightsNode = SidebarMenuNode & { can_view?: number | boolean; can_add?: number | boolean; can_edit?: number | boolean; can_delete?: number | boolean }

const NONE: PeopleRights = { view: false, add: false, edit: false, delete: false }
const norm = (value: string | null | undefined) => (value ?? '').trim().toLowerCase().replace(/\/+$/, '')
const held = (flag: number | boolean | undefined) => flag === 1 || flag === true

/** The rights the raw menu answer gives on the Contacts rows. Pure. */
export function peopleRightsFrom(nodes: readonly SidebarMenuNode[] | undefined): PeopleRights {
  const rights = { ...NONE }
  const walk = (list: readonly SidebarMenuNode[] | undefined) => {
    for (const raw of list ?? []) {
      const node = raw as RightsNode
      if (CONTACTS_ACCESS_LINKS.includes(norm(node.access_link))) {
        // A row that names no can_view flag at all is a row the server already filtered to "viewable".
        if (node.can_view === undefined || held(node.can_view)) rights.view = true
        if (held(node.can_add)) rights.add = true
        if (held(node.can_edit)) rights.edit = true
        if (held(node.can_delete)) rights.delete = true
      }
      walk(node.children ?? node.submenus ?? node.menus)
    }
  }
  walk(nodes)
  return rights
}

export interface PeopleRightsResult extends PeopleRights {
  /** The menu has not been read yet: the answer above is "no" only because nothing is known. */
  loading: boolean
}

/**
 * The signed-in person's rights on people. Shares react-query's cached menu answer with `useSidebarNavigation` (same key, same call), so it costs no request
 * of its own once the shell has loaded the sidebar.
 */
export function usePeopleRights(): PeopleRightsResult {
  const { user } = useAuth()
  const context = getLaravelContext(user)
  const ready = isLaravelContextReady(context)
  const cacheKey = context.subInstituteId && context.profileId ? `gtg-sidebar-cache-v3:${context.subInstituteId}:${context.profileId}` : null

  const initialData = useMemo(() => {
    if (!cacheKey || typeof window === 'undefined') return undefined
    try {
      const stored = window.sessionStorage.getItem(cacheKey)
      return stored ? (JSON.parse(stored) as SidebarMenuResponse) : undefined
    } catch {
      return undefined
    }
  }, [cacheKey])

  const query = useQuery({
    queryKey: ['sidebar-navigation-v3', context.token, context.subInstituteId, context.profileId],
    queryFn: () => sidebarService.getMenu(context),
    initialData,
    enabled: ready,
    staleTime: 5 * 60 * 1000,
  })

  const rights = useMemo(() => peopleRightsFrom(query.data?.data), [query.data])
  return { ...rights, loading: ready && query.isLoading }
}
