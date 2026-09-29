'use client'

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { GtgSidebar } from '@/components/shell/gtg-sidebar'
import { GtgHeaderBase } from '@/components/shell/gtg-header-base'
import { PlatformServicesSubheader } from '@/components/shell/platform-services-subheader'
import { BreadcrumbItemsProvider } from '@/components/shell/gtg-breadcrumb'
import { resolveBreadcrumb, type ActiveNav } from '@/hooks/use-navigation'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import type { BreadcrumbItem } from '@/lib/gtg-navigation'
import { cn } from '@/lib/utils'
import { consumeSidebarFirstOpenExpansion } from '@/lib/sidebar-first-open'
import { useAppPreferences } from '@/components/providers/preferences-provider'
import { accountService } from '@/services/account'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'

/** Organizational Management > Organization Setup > Organization Profile (tblmenumaster_g2g ids 1/7/12). */
const DEFAULT_ACTIVE: ActiveNav = {
  moduleId: '1',
  menuId: '7',
  submenuId: '12',
}

interface GtgPageShellProps {
  children: ReactNode
  initialActive?: ActiveNav
  breadcrumbItems?: BreadcrumbItem[]
}

export function GtgPageShell({ children, initialActive, breadcrumbItems }: GtgPageShellProps) {
  const router = useRouter()
  const { modules, getRoutePath } = useSidebarNavigation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * THIS SHELL IGNORED THE SIDEBAR PREFERENCE ENTIRELY
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * `useState(true)` — hardcoded collapsed, with `useAppPreferences` appearing
   * nowhere in the file. `GtgAppShell` read the preference; this one did not, and
   * this one is what renders `/settings`, `/profile` and `/organization/*`.
   *
   * So the "Start with the sidebar collapsed" switch was dead on the very screen
   * that offers it: you set it, the sidebar did not move, and there was nothing
   * anywhere to tell you the setting had been stored correctly. That is most of
   * why the whole area felt like it was not working.
   *
   * Applied DURING RENDER, not in an effect, so the sidebar never paints at the
   * wrong width and then jump. `touched` means a person who has moved it
   * themselves this visit outranks the stored value.
   */
  const { preferences, loaded: preferencesLoaded } = useAppPreferences()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [sidebarTouched, setSidebarTouched] = useState(false)
  const [sidebarSynced, setSidebarSynced] = useState(false)

  if (preferencesLoaded && !sidebarSynced && !sidebarTouched) {
    setSidebarSynced(true)
    setSidebarCollapsed(preferences.sidebar_collapsed)
  }

  /**
   * Moving the sidebar is a preference, so it is remembered.
   *
   * Per browser, like the theme — a 13-inch laptop and a wide monitor want
   * different answers. Failure is swallowed: the sidebar has already moved, and
   * an error banner over a cosmetic write would be worse than quietly not
   * persisting it.
   */
  const rememberSidebar = useCallback((collapsed: boolean) => {
    setSidebarTouched(true)
    setSidebarCollapsed(collapsed)

    const context = getLaravelContext(null)

    if (!isLaravelContextReady(context)) return

    void accountService
      .updatePreferences(context, { sidebar_collapsed: collapsed })
      .catch(() => {})
  }, [])

  const active = initialActive ?? DEFAULT_ACTIVE
  const items = breadcrumbItems ?? resolveBreadcrumb(active, modules)

  const [subheaderOpen, setSubheaderOpen] = useState(false)
  const subheaderButtonRef = useRef<HTMLButtonElement>(null)
  const subheaderPanelRef = useRef<HTMLDivElement>(null)

  // Click-outside and Escape close it — see the identical, fuller note in
  // `gtg-app-shell.tsx`'s own copy of this effect. `open` deliberately does
  // not depend on the route — it must survive navigating between this bar's
  // own links (e.g. Workflow to Scheduler), closing only on an explicit
  // user action.
  useEffect(() => {
    if (!subheaderOpen) return

    function onClick(event: MouseEvent) {
      const target = event.target as Node
      if (
        subheaderPanelRef.current && !subheaderPanelRef.current.contains(target) &&
        subheaderButtonRef.current && !subheaderButtonRef.current.contains(target)
      ) {
        setSubheaderOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setSubheaderOpen(false)
      subheaderButtonRef.current?.focus()
    }

    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [subheaderOpen])

  useEffect(() => {
    if (consumeSidebarFirstOpenExpansion()) {
      queueMicrotask(() => {
        // A deliberate post-login expansion outranks the stored default.
        setSidebarTouched(true)
        setSidebarCollapsed(false)
      })
    }
  }, [])

  const handleNavSelect = useCallback((next: ActiveNav) => {
    const path = getRoutePath(next)

    // Nothing mapped means nothing to open. getRoutePath used to answer
    // '/dashboard' here, so an unresolvable selection quietly opened the
    // dashboard instead of revealing that the lookup had missed.
    if (!path) {
      return
    }

    if (path.startsWith('http')) {
      window.open(path, '_blank', 'noopener,noreferrer')
      return
    }

    /*
     * A FULL NAVIGATION, SPECIFICALLY WHEN THE PATHNAME ISN'T CHANGING.
     *
     * The Platform Services pages (Workflow, Scheduler, Add Process, Fields
     * Configuration, Integration) are reached from six different sidebar
     * rows, one per module, all pointing at the SAME pathname with a
     * different `?module=`. `router.push()` to one of those from another —
     * same pathname, different search params — proved to be a silent no-op
     * in production: the URL bar never updated and the page kept the
     * PREVIOUS module's content, verified directly (logged the computed
     * path, confirmed `router.push` was called with the correct target, and
     * confirmed `window.location` never changed across a full second
     * afterward). Every one of these consoles renders itself entirely
     * client-side after reading `?module=` via `useSearchParams()`, with no
     * server-varying content Next can key a soft transition on for this
     * exact pathname-only-differs-by-query case — a full navigation always
     * works, confirmed the same way. Ordinary cross-route sidebar clicks
     * (a different pathname) are unaffected and keep the fast client-side
     * transition.
     */
    const currentPathname = typeof window !== 'undefined' ? window.location.pathname : null
    const nextPathname = path.split('?')[0]

    if (currentPathname !== null && currentPathname === nextPathname) {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- deliberate: router.push() is the no-op being worked around here, confirmed directly (see the note above).
      window.location.href = path
      return
    }

    router.push(path)
  }, [router, getRoutePath])

  return (
    <div role="application" aria-label="GapstoGrowth HRMS" className="flex h-screen w-full overflow-hidden bg-background">
      <GtgSidebar
        active={active}
        onSelect={handleNavSelect}
        modules={modules}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
        collapsed={sidebarCollapsed}
        onCollapsedChange={rememberSidebar}
      />
      <div
        className={cn(
          'flex h-screen w-full flex-col pl-0 transition-[padding-left] duration-200',
          sidebarCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]',
        )}
      >
        <GtgHeaderBase
          onMenuClick={() => setMobileNavOpen(true)}
          subheaderOpen={subheaderOpen}
          onSubheaderToggle={() => setSubheaderOpen((open) => !open)}
          subheaderButtonRef={subheaderButtonRef}
        />
        <div ref={subheaderPanelRef}>
          <PlatformServicesSubheader open={subheaderOpen} />
        </div>
        <BreadcrumbItemsProvider items={items}>
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <div className="flex min-w-0 flex-1 flex-col min-h-0 overflow-hidden">
              <main className="g2g-page-scroll g2g-scrollbar flex-1 overflow-auto bg-background">
                <div className="min-h-full w-full p-6">
                  {children}
                </div>
              </main>
            </div>
          </div>
        </BreadcrumbItemsProvider>
      </div>
    </div>
  )
}
