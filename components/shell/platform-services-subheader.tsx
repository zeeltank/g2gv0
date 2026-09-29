'use client'

/**
 * The navbar's Platform Services strip — a full-width bar, in normal
 * document flow, toggled from the navbar.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THIRD REVISION — BACK TO PUSH-DOWN, AND STAYS OPEN ACROSS NAVIGATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Two earlier shapes, both corrected after being seen live:
 *  1. Push-down, full-width — the original build.
 *  2. A compact floating card (matching K12's "Master"/"AI Stack" panels) —
 *     built after that was explicitly requested, then reverted: the actual
 *     ask was K12's OUTER bar shape (full length, like its "FEES" strip),
 *     not either of K12's own floating overlays.
 *
 * This is (1) again, full width, sitting between the header and `<main>` in
 * `GtgAppShell`/`GtgPageShell` — mounting/collapsing it is what pushes page
 * content down, the same "page goes down a little" effect asked for from
 * the start.
 *
 * ── OPEN STATE SURVIVES NAVIGATION, ON PURPOSE ───────────────────────────────
 *
 * The previous revision remounted this component on every `pathname` change
 * specifically to auto-close it — which closed it on EVERY navigation,
 * including a click on one of its own links to switch between, say, Workflow
 * and Scheduler. Reported directly: it should stay open while moving between
 * these consoles, closing only on an explicit user action (the toggle
 * button, an outside click, or Escape) — never because the route changed.
 * So `open` lives in `GtgAppShell`/`GtgPageShell` (passed down as a prop),
 * the same place `sidebarCollapsed`/`toolbarOpen` already live, both of
 * which already survive navigation for the same reason: those shells mount
 * once and persist across client-side route changes.
 *
 * ── NO LONGER DUPLICATES `PlatformShell`'s OWN QUICK-NAV ─────────────────────
 *
 * Every one of the 5 console pages used to render its own near-identical tab
 * strip (`PlatformShell`'s `quickNav`) — showing this bar there too would be
 * the same switcher twice. That strip is removed from `PlatformShell`; this
 * bar is the one place that navigation lives now, including the "Browse
 * every module" link that strip used to carry.
 *
 * ── SCOPED TO THE SAME 5 CONSOLES THE SIDEBAR ALREADY OFFERS ────────────────
 *
 * Event Bus and What's Coming are deliberately not in this list: neither has
 * a real per-module concept (confirmed by reading their actual data — Event
 * Bus's consumers are mostly cross-cutting across several modules, and
 * What's Coming's gaps are prose per SERVICE, not per module), so scoping
 * either here would mean inventing something fake.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PlatformServiceIcon } from '@/lib/platform/icons'
import { MODULE_LABEL } from '@/lib/platform/access-links'
import { useCurrentPlatformModule } from '@/hooks/use-current-platform-module'
import { OWN_ROUTE_SERVICES } from '@/components/shell/platform-shell'
import { cn } from '@/lib/utils'

const DECENTRALIZABLE_SERVICES = OWN_ROUTE_SERVICES.filter(
  (service) => service.decentralizedModules !== undefined,
)

export function PlatformServicesSubheader({ open }: { open: boolean }) {
  return (
    <div
      id="platform-services-subheader"
      aria-hidden={!open}
      className="grid shrink-0 transition-[grid-template-rows] duration-200 ease-out"
      style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
    >
      <div className="overflow-hidden">
        {/* `useSearchParams()` (inside useCurrentPlatformModule) needs a
            Suspense boundary — the same requirement ServiceShell already
            satisfies for the sidebar-scoped consoles this mirrors. */}
        <Suspense fallback={null}>
          <PlatformServicesSubheaderContent inert={!open} />
        </Suspense>
      </div>
    </div>
  )
}

function PlatformServicesSubheaderContent({ inert }: { inert: boolean }) {
  const pathname = usePathname()
  const moduleKey = useCurrentPlatformModule()

  const items = moduleKey
    ? DECENTRALIZABLE_SERVICES.filter((service) => service.decentralizedModules?.includes(moduleKey))
    : DECENTRALIZABLE_SERVICES

  return (
    <nav
      aria-label="Platform services"
      // Collapsed content is still in the DOM for the height transition,
      // so it must not be reachable by keyboard or a screen reader while closed.
      inert={inert}
      className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2.5 md:px-6"
    >
      <span className="shrink-0 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
        {moduleKey ? MODULE_LABEL[moduleKey] : 'Platform Services'}
      </span>

      {items.map((service) => {
        const href = moduleKey
          ? `${service.destination.href}?module=${moduleKey}`
          : service.destination.href
        const isActive = pathname === service.destination.href

        return (
          <Link
            key={service.slug}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <PlatformServiceIcon slug={service.slug} className="size-3.5" />
            {service.name}
          </Link>
        )
      })}

      <Link
        href="/platform-services"
        className="ml-1 shrink-0 text-xs font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-300"
      >
        Browse every module →
      </Link>
    </nav>
  )
}
