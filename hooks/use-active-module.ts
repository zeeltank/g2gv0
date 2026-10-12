'use client'

/**
 * Which module the user is actually inside, and the AI Stack that belongs to it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The AI Stack used to be reached at `/platform-services/ai-stack?module=<key>`, and
 * `?module=` chose the module. Two things were wrong with that for somebody who opened
 * the stack from inside a module:
 *
 *  1. The page then offered a row of six module pills, because it could not tell the
 *     difference between "I was told which module" and "nobody told me" — both arrived
 *     as the same component with the same props.
 *
 *  2. The module came from a URL string looked up in a table, so a module the sidebar
 *     actually serves had no way to reach a stack, and the only way to be sure the right
 *     module's rows were on screen was to trust a query parameter.
 *
 * So the module is resolved from the LIVE menu tree instead. `useSidebarNavigation` is
 * the one source of what modules exist for this caller (it is already rights-filtered
 * server-side), so the answer is "the module whose row this is" rather than "the module
 * whose key somebody typed".
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * NO MODULE MEANS NO STACK — NEVER SOME OTHER MODULE'S
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A stack is scoped by an `ai_modules` key, and only a module that has one can be
 * scoped at all. A module with no descriptor returns `stack: null` and the caller shows
 * an honest empty state. Falling back to a neighbouring module's stack is the exact leak
 * this whole design exists to prevent, so there is no fallback anywhere in this file.
 *
 * `useSearchParams` is NOT used here. `useCurrentPlatformModule` already reads `?module=`
 * for the five other Platform Services consoles, and this hook has to work on ordinary
 * module screens, which never carry a query string at all.
 */

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'

import { ADDITIONAL_AI_STACKS, CENTRAL_AI_STACKS } from '@/lib/ai-stack/central'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import type { DecentralizedModuleKey } from '@/lib/platform/access-links'
import type { NavModule } from '@/lib/gtg-navigation'
import type { AiStackModule } from '@/components/ai-stack/ai-stack-module'

export interface ActiveModuleResult {
  /** True while the menu tree is still in flight. A caller must show a skeleton, not a guess. */
  loading: boolean
  /** The level-1 `tblmenumaster_g2g` row the current route belongs to, or null. */
  navModule: NavModule | null
  /** That row's id, which is what a `/module/{moduleId}/…` route is addressed by. */
  moduleId: string | null
  /** The label to show, taken from the live row rather than from a constant. */
  label: string | null
  /** The decentralised-navigations key, when this module has one. Null otherwise. */
  platformKey: DecentralizedModuleKey | null
  /** This module's own AI Stack, or null when it has no `ai_modules` row to scope by. */
  stack: AiStackModule | null
}

/**
 * The first path segment of a module access link: `/module/hrit-solutions/leave` → `hrit-solutions`.
 *
 * The level-1 row's own `access_link` is the reliable half of the match, but a tenant may
 * point it somewhere deeper or leave it empty, and the level-2 slug below is what every
 * descriptor already declares. Matching on the segment as well is what lets a module
 * resolved from a real menu row find its stack without anybody hardcoding a row id.
 */
function moduleSlug(accessLink: string | null | undefined): string | null {
  if (!accessLink) return null
  const match = /^\/module\/([^/?#]+)/.exec(accessLink)
  return match ? match[1] : null
}

/**
 * The stack belonging to this menu row, matched on the access link the backend itself
 * resolves a report from (`descriptor.route` is the module's LEVEL-1 access link), then on
 * the slug in it. Returns null rather than a neighbour when nothing matches.
 */
function stackFor(navModule: NavModule): { key: DecentralizedModuleKey | null; stack: AiStackModule } | null {
  const link = navModule.accessLink ?? null
  const slug = moduleSlug(link)

  for (const [key, stack] of Object.entries(CENTRAL_AI_STACKS)) {
    if (stack && link && link === stack.route) return { key: key as DecentralizedModuleKey, stack }
  }

  for (const [key, stack] of Object.entries(CENTRAL_AI_STACKS)) {
    if (stack && slug && slug === stack.menuSlug) return { key: key as DecentralizedModuleKey, stack }
  }

  // Modules outside Platform Services (Main Dashboard, Agentic AI): an AI Stack, but no Platform Services key.
  for (const stack of Object.values(ADDITIONAL_AI_STACKS)) {
    if ((link && link === stack.route) || (slug && slug === stack.menuSlug)) return { key: null, stack }
  }

  return null
}

/**
 * The module id this app's own route carries, when the path is not a menu row.
 *
 * `/module/{moduleId}/…` is the shape `GtgAppShell` addresses every module screen by, and
 * the id segment is the `tblmenumaster_g2g` level-1 row id — the same id the sidebar hands
 * the shell. `parseRoutePath` resolves the ordinary case (a real access link from the
 * tree), but a path that is NOT a menu row — this module's AI Stack page, for one — cannot
 * be looked up there at all, and the module would come back as "none".
 *
 * The id is only ever used to LOOK UP a row in the live tree below, never as an answer by
 * itself, so a hand-typed `/module/999/ai-stack` resolves to nothing and the page says so.
 * A slug in that position (`/module/hrit-solutions/…`, which is what an access link looks
 * like) matches no row, and is already handled by `parseRoutePath` anyway.
 */
function moduleIdFromRoute(pathname: string): string | null {
  const match = /^\/module\/([^/?#]+)(?:[/?#]|$)/.exec(pathname);
  return match ? match[1] : null
}

/**
 * Resolves the module at `pathname`, or at an explicit `moduleId` when the caller has one
 * from its route.
 *
 * The explicit id is checked against the live tree rather than trusted: a hand-typed
 * `/module/999/ai-stack` resolves to nothing, and the page says so instead of opening
 * whichever module happened to be first in the sidebar.
 */
export function useActiveModule(explicitModuleId?: string | null): ActiveModuleResult {
  const pathname = usePathname()
  const { modules, loading, parseRoutePath } = useSidebarNavigation()

  return useMemo<ActiveModuleResult>(() => {
    const empty: ActiveModuleResult = {
      loading,
      navModule: null,
      moduleId: null,
      label: null,
      platformKey: null,
      stack: null,
    }

    if (loading) return empty

    const wantedId =
      explicitModuleId ?? parseRoutePath(pathname)?.moduleId ?? moduleIdFromRoute(pathname)

    if (!wantedId) return empty

    const navModule = modules.find((candidate) => candidate.id === wantedId)
    if (!navModule) return empty

    const resolved = stackFor(navModule)

    return {
      loading: false,
      navModule,
      moduleId: navModule.id,
      label: navModule.label,
      platformKey: resolved ? resolved.key : null,
      stack: resolved ? resolved.stack : null,
    }
  }, [explicitModuleId, loading, modules, parseRoutePath, pathname])
}
