'use client'

/**
 * Turning a service's declared destination into a path THIS user can actually open.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS IS A HOOK AND NOT A FUNCTION IN THE PACKAGE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `platformServiceHref()` can resolve two of the four destination kinds on its own,
 * because `existing-route` and `own-route` carry real URLs. It cannot resolve
 * `existing-screen`: G2G's module routes are `/module/{moduleId}/{menuId}/{submenuId}`
 * built from menu-row ids, and those ids differ between deployments. Hard-coding one
 * would send half the estate to a screen that does not exist.
 *
 * The `access_link` is the stable identifier, and `useSidebarNavigation()` is what turns
 * it into this user's real path — which also means a service the signed-in profile has
 * no rights to resolves to nothing rather than to a 404.
 *
 * ── THE `/dashboard` FALLBACK IS DROPPED, DELIBERATELY ──────────────────────
 *
 * `resolveAccessLink()` answers `'/dashboard'` when the caller cannot see the screen.
 * Sending somebody to the dashboard from a button labelled "Open Role & Permissions" is
 * worse than not offering the button: it looks like the product lost the page. So that
 * answer is treated as "no", and the caller falls back to the service's own page, which
 * at least explains what the service is.
 *
 * `CapabilityShell` makes the same call for the same reason.
 */

import { useCallback } from 'react'

import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { platformServiceHref, type PlatformService } from '@shared/platform-services-core'

export interface PlatformDestinationResult {
  /** Where the entry should navigate. Never null — worst case, the service's own page. */
  href: string
  /**
   * Whether that href is the real screen rather than the explanatory page.
   *
   * The menu uses this to decide nothing; the service page uses it to decide whether to
   * offer an "Open X" button at all. A button that leads back to the page you are
   * already on is a dead control.
   */
  isRealScreen: boolean
}

export function usePlatformDestination(): (service: PlatformService) => PlatformDestinationResult {
  const { resolveAccessLink } = useSidebarNavigation()

  return useCallback(
    (service: PlatformService): PlatformDestinationResult => {
      const own = `/platform-services/${service.slug}`
      const { destination } = service

      if (destination.kind === 'existing-route' || destination.kind === 'own-route') {
        return { href: destination.href, isRealScreen: destination.href !== own }
      }

      if (destination.kind === 'existing-screen') {
        const resolved = resolveAccessLink(destination.accessLink)

        // See the note above: '/dashboard' is this function's way of saying "you cannot
        // see that screen", not a destination anybody asked for.
        if (resolved && resolved !== '/dashboard') {
          return { href: resolved, isRealScreen: true }
        }

        return { href: own, isRealScreen: false }
      }

      // not-built — the service page is the whole destination, and it says so.
      return { href: platformServiceHref(service), isRealScreen: false }
    },
    [resolveAccessLink],
  )
}
