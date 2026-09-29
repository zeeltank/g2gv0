'use client'

/**
 * The navbar's Platform Services toggle — a floating dropdown, not a bar.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * REVISION: FLOATING, NOT PUSH-DOWN — AND SELF-CONTAINED, NOT SPLIT ACROSS SHELLS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The first version of this put the trigger in the header and the panel as a
 * flex sibling in `GtgAppShell`/`GtgPageShell`, sitting in normal document
 * flow so it pushed page content down — built that way because the request at
 * the time was explicitly "page go little down". Seeing it built, the actual
 * ask was corrected: a floating panel, copying K12's own "Master"/"AI Stack"
 * style — `position: fixed`-shaped, a rounded card with a border and shadow,
 * not a full-width bar in flow. This version does that, and — since the
 * trigger and the panel now genuinely belong together — folds both into ONE
 * component, the same shape `gtg-user-menu.tsx` already uses for the account
 * menu (a `relative` wrapper, an `absolute right-0 top-full` panel). That
 * also removes the three-prop threading (`subheaderOpen`/`onSubheaderToggle`/
 * `subheaderButtonRef`) the split version needed across two shells and two
 * headers, and the duplicated outside-click/Escape wiring in each shell.
 *
 * No transition on the panel itself, matching K12's own Master panel — it
 * mounts and unmounts, it does not animate open. (No animation library in
 * either codebase.)
 *
 * ── CLOSES ON NAVIGATION, NOT JUST OUTSIDE-CLICK/ESCAPE ──────────────────────
 *
 * The first version left it open after clicking one of its own links, since
 * the shells that rendered it never unmount on a client-side route change —
 * reported directly. Rather than an effect that calls `setState` on every
 * `pathname` change (flagged by this codebase's own purity rule, and a real
 * cascading-render smell besides), the callers key this component on the
 * current pathname (`gtg-header.tsx`/`gtg-header-base.tsx`) — a route change
 * remounts it, which resets `open` to its initial `false` for free.
 *
 * ── NO LONGER DUPLICATES `PlatformShell`'s OWN QUICK-NAV ─────────────────────
 *
 * Every one of the 5 console pages used to render its own near-identical tab
 * strip (`PlatformShell`'s `quickNav`) — once this toggle existed anywhere in
 * the app, a page showing both was showing the same switcher twice. That
 * strip is removed from `PlatformShell`; this toggle is the one place that
 * navigation lives now, including the "Browse every module" link that strip
 * used to carry.
 *
 * ── SCOPED TO THE SAME 5 CONSOLES THE SIDEBAR ALREADY OFFERS ────────────────
 *
 * Event Bus and What's Coming are deliberately not in this list: neither has
 * a real per-module concept (confirmed by reading their actual data — Event
 * Bus's consumers are mostly cross-cutting across several modules, and
 * What's Coming's gaps are prose per SERVICE, not per module), so scoping
 * either here would mean inventing something fake.
 */

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { PlatformServiceIcon } from '@/lib/platform/icons'
import { MODULE_LABEL } from '@/lib/platform/access-links'
import { useCurrentPlatformModule } from '@/hooks/use-current-platform-module'
import { OWN_ROUTE_SERVICES } from '@/components/shell/platform-shell'
import { cn } from '@/lib/utils'

const DECENTRALIZABLE_SERVICES = OWN_ROUTE_SERVICES.filter(
  (service) => service.decentralizedModules !== undefined,
)

export function PlatformServicesSubheader() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Outside-click and Escape close it — the exact pattern `gtg-user-menu.tsx`
  // already establishes for a disclosure control in this codebase, Escape
  // included returning focus to the trigger.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen((wasOpen) => {
        if (wasOpen) triggerRef.current?.focus()
        return false
      })
    }

    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Toggle platform services"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 outline-none hover:bg-secondary hover:text-secondary-foreground focus-visible:ring-2 focus-visible:ring-ring',
          open && 'bg-secondary text-secondary-foreground',
        )}
      >
        <ChevronDown
          className={cn('size-5 transition-transform duration-200', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label="Platform services"
          className="absolute right-0 top-full z-50 mt-2 w-[min(30rem,calc(100vw-1.5rem))] rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-lg"
        >
          <Suspense fallback={null}>
            <PlatformServicesPanelContent onNavigate={() => setOpen(false)} />
          </Suspense>
        </div>
      )}
    </div>
  )
}

function PlatformServicesPanelContent({ onNavigate }: { onNavigate: () => void }) {
  const moduleKey = useCurrentPlatformModule()

  const items = moduleKey
    ? DECENTRALIZABLE_SERVICES.filter((service) => service.decentralizedModules?.includes(moduleKey))
    : DECENTRALIZABLE_SERVICES

  return (
    <>
      <p className="mb-3 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
        {moduleKey ? MODULE_LABEL[moduleKey] : 'Platform Services'}
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((service) => {
          const href = moduleKey
            ? `${service.destination.href}?module=${moduleKey}`
            : service.destination.href

          return (
            <Link
              key={service.slug}
              href={href}
              onClick={onNavigate}
              className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-left text-sm font-semibold text-muted-foreground shadow-xs transition-all outline-none hover:border-muted-foreground/30 hover:bg-muted/60 hover:text-foreground hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring"
            >
              <PlatformServiceIcon slug={service.slug} className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{service.name}</span>
            </Link>
          )
        })}
      </div>

      <Link
        href="/platform-services"
        onClick={onNavigate}
        className="mt-3 inline-block text-xs font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-300"
      >
        Browse every module →
      </Link>
    </>
  )
}
