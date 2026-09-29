'use client'

/**
 * The navbar-attached, module-scoped Platform Services strip.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A SECOND, FASTER WAY IN — NOT A REPLACEMENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The sidebar already carries one "Platform Services" row per module, landing
 * on that module's Workflow console with a tab strip to the other four. This
 * is additive: a toggle on the navbar itself, reachable without first
 * navigating into a module's own sidebar section.
 *
 * ── WHY THIS SITS IN NORMAL DOCUMENT FLOW, NOT AN OVERLAY ───────────────────
 *
 * Checked directly against LMS K12's own "Level 3" reference before building
 * this: its outer bar sits in normal flow under the header, which is what
 * pushes page content down when it mounts — its INNER "Master" panel (and,
 * separately, its "AI Stack" card) are `position: fixed`, portaled overlays
 * with no transition, floating over content rather than moving it. This
 * component copies the outer bar's behaviour, not either overlay's.
 *
 * `GtgAppShell`/`GtgPageShell` render this conditionally between the header
 * and `<main>` — an ordinary flex sibling, so mounting/collapsing it grows or
 * shrinks the space `<main>` gets, exactly the "page goes down a little"
 * effect asked for. The open/close transition itself is a plain CSS
 * `grid-template-rows` 0fr/1fr animation on an always-mounted wrapper (no
 * animation library in this codebase or K12's), so the row's real height is
 * never needed up front and nothing pops.
 *
 * ── SCOPED TO THE SAME 5 CONSOLES THE SIDEBAR ALREADY OFFERS ────────────────
 *
 * Reuses `OWN_ROUTE_SERVICES` and the identical `?module=` href construction
 * `PlatformShell`'s own quick-nav strip already uses — not re-derived here,
 * so the two can't drift. Event Bus and What's Coming are deliberately not
 * in this list: neither has a real per-module concept (confirmed by reading
 * their actual data — Event Bus's consumers are mostly cross-cutting across
 * several modules, and What's Coming's gaps are prose per SERVICE, not per
 * module), so scoping either here would mean inventing something fake.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PlatformServiceIcon } from '@/lib/platform/icons'
import { MODULE_LABEL } from '@/lib/platform/access-links'
import { useCurrentPlatformModule } from '@/hooks/use-current-platform-module'
import { OWN_ROUTE_SERVICES } from '@/components/shell/platform-shell'
import { cn } from '@/lib/utils'

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

/*
 * The 5 consoles this panel offers — Event Bus and What's Coming are
 * `own-route` too but carry no `decentralizedModules` (neither has a real
 * per-module concept — see the module docblock), so they're excluded here
 * unconditionally, not just when a module is resolved. The bug this fixes:
 * filtering only in the scoped branch left the unscoped (dashboard, etc.)
 * view showing all 7 own-route services instead of these 5.
 */
const DECENTRALIZABLE_SERVICES = OWN_ROUTE_SERVICES.filter(
  (service) => service.decentralizedModules !== undefined,
)

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
    </nav>
  )
}
