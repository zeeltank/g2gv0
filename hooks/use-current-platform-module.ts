'use client'

/**
 * Which of the 6 decentralizable modules the user is currently looking at,
 * from anywhere in the app — not just Platform Services pages. `null` means
 * "not in any of them" (dashboard, settings, AI, ...), which the caller
 * should treat as the unscoped/central view, never a guess.
 *
 * Neither `GtgAppShell` nor `GtgPageShell` has a reliable "current module"
 * signal of its own today — `GtgAppShell`'s `active.moduleId` is a numeric
 * `tblmenumaster_g2g` row id resolved through `parseRoutePath`, which has a
 * separate, confirmed bug (`usePathname()` strips query strings, so it can
 * never match a `?module=`-scoped access link); `GtgPageShell` computes no
 * module at all. Rather than depend on either, this reads two signals that
 * are already correct on their own:
 *
 *  1. `?module=` on the current URL — already how every Platform Services
 *     page marks its own scope (`ServiceShell`, the 5 console pages).
 *  2. The real landing path each of the 6 modules resolves to in
 *     `tblmenumaster_g2g` (`MODULE_LANDING_HREF` — already verified there,
 *     it drives the "Back to {module}" link on every scoped console) —
 *     covers ordinary module screens, which never carry `?module=` at all.
 *
 * `useSearchParams()` requires a Suspense boundary — callers must render
 * whatever uses this hook inside one, the same way `ServiceShell` does.
 */

import { usePathname, useSearchParams } from 'next/navigation'
import { DECENTRALIZED_MODULES } from '@shared/platform-services-core'
import { MODULE_LANDING_HREF, isDecentralizedModule, type DecentralizedModuleKey } from '@/lib/platform/access-links'

export function useCurrentPlatformModule(): DecentralizedModuleKey | null {
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const fromQuery = searchParams.get('module')
  if (isDecentralizedModule(fromQuery)) {
    return fromQuery
  }

  for (const key of DECENTRALIZED_MODULES) {
    if (pathname?.startsWith(MODULE_LANDING_HREF[key])) {
      return key
    }
  }

  return null
}
