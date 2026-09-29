'use client'

/**
 * The Platform Services / Setup & Configuration frame.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every page under `app/platform-services/` used to write its own
 * `mx-auto max-w-[1100px]` — copied independently into `ServiceShell`, the index page,
 * `whats-coming`, and the `[service]` fallback. Four copies of one decision is why it was
 * safe to change in only one of them and forget the rest. This is that one place.
 *
 * `GtgPageShell` (`components/shell/gtg-page-shell.tsx`) already renders page content as
 * `w-full p-6` — it does not cap width itself. The cap was always a choice made by this
 * section, not something inherited from the app shell. Removing it here is enough to make
 * every built console use the space a wide monitor actually has.
 *
 * ── THE BANNER IS THE VISUAL SIGNATURE, AND IT FOLLOWS THE SITE'S THEME ─────
 *
 * Full width alone does not read as "a distinct area" — it reads as a normal page that
 * forgot to constrain itself. The gradient band, unique to this section, is what makes
 * Platform Services recognisable as its own control plane at a glance, the same way
 * Settings and Organization already have their own visual identity elsewhere in the
 * product. Nothing else in the app uses this treatment.
 *
 * It is NOT hardcoded dark. The first version always rendered a near-black band — a
 * light indigo tint in light mode, `dark:` overrides to the deeper gradient in dark mode
 * — because a screen forcing a dark band onto somebody who has chosen the light theme
 * reads as broken, not as a signature. Every colour below is a token (`text-foreground`,
 * `border-border`, …) or a light/`dark:` pair for the same reason; nothing in this
 * component hardcodes `text-white` the way the first version did.
 *
 * The band bleeds past `GtgPageShell`'s own `p-6` via negative margins so it reaches the
 * edges of the content area rather than floating inside it with a border on every side.
 */

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { cn } from '@/lib/utils'
import { PLATFORM_SERVICES } from '@shared/platform-services-core'
import { MODULE_LANDING_HREF } from '@/lib/platform/access-links'

/** The two groups a platform service belongs to — shared so no page re-declares it. */
export const PLATFORM_SECTION_LABEL: Record<string, string> = {
  services: 'Platform service',
  setup: 'Setup & configuration',
}

/**
 * The six consoles with a real screen today, derived from the registry rather than a
 * second hand-kept list — `decentralizedModules` lives there too, which is what lets a
 * scoped view below filter to the consoles that actually have a tab for its module,
 * instead of drifting out of step with which services the registry marks decentralizable.
 *
 * Deliberately not all twelve platform services — the other six route into the module
 * navigation or are not built yet, and a quick-nav strip listing destinations that are not
 * "another console in this control plane" would misrepresent what switching does.
 */
const OWN_ROUTE_SERVICES = PLATFORM_SERVICES.filter(
  (service): service is typeof service & { destination: { kind: 'own-route'; href: string } } =>
    service.destination.kind === 'own-route',
)

export function PlatformShell({
  backHref,
  backLabel = 'Platform Services',
  eyebrow,
  title,
  description,
  icon,
  status,
  actions,
  activeSlug,
  module,
  children,
}: {
  backHref?: string
  backLabel?: string
  eyebrow: string
  title: string
  description?: string
  icon?: ReactNode
  status?: ReactNode
  actions?: ReactNode
  /** Slug of the console this page IS, so the quick-nav can mark it current rather than a link to itself. */
  activeSlug?: string
  /**
   * Set when this page is a decentralized, module-scoped view (`?module=` present) — the
   * seam between the centralized hub and each module's own navigation. Swaps the back
   * link to that module's own landing page, and narrows the quick-nav to the OTHER
   * consoles decentralized for the SAME module, each still `?module=`-scoped, plus one
   * explicit link back to this console's unscoped, central view.
   */
  module?: { key: string; label: string } | null
  children?: ReactNode
}) {
  const effectiveBackHref = module ? (MODULE_LANDING_HREF[module.key] ?? backHref) : backHref
  const effectiveBackLabel = module ? module.label : backLabel

  const quickNav = module
    ? OWN_ROUTE_SERVICES.filter((service) => service.decentralizedModules?.includes(module.key))
    : OWN_ROUTE_SERVICES

  return (
    <div className="w-full">
      <div className="-mx-6 -mt-6 border-b border-border bg-gradient-to-r from-indigo-50 via-white to-slate-50 px-6 pt-6 pb-6 dark:border-white/10 dark:from-indigo-950 dark:via-slate-900 dark:to-slate-950 xl:-mx-10 xl:px-10 2xl:-mx-14 2xl:px-14">
        {effectiveBackHref && (
          <Link
            href={effectiveBackHref}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            {effectiveBackLabel}
          </Link>
        )}

        <div className={cn('flex flex-wrap items-start justify-between gap-4', effectiveBackHref && 'mt-3')}>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-widest text-indigo-600 uppercase dark:text-indigo-300/80">
              {eyebrow}
            </p>
            <h1 className="mt-1 flex items-center gap-2.5 text-2xl font-semibold text-foreground">
              {icon}
              {title}
            </h1>
            {description && (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
            )}
          </div>

          {(status || actions) && (
            <div className="flex shrink-0 flex-col items-end gap-2">
              {status}
              {actions}
            </div>
          )}
        </div>

        <nav className="mt-5 flex flex-wrap items-center gap-1.5" aria-label="Platform Services consoles">
          {quickNav.map((service) => (
            <Link
              key={service.slug}
              href={module ? `${service.destination.href}?module=${module.key}` : service.destination.href}
              aria-current={service.slug === activeSlug ? 'page' : undefined}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                service.slug === activeSlug
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {service.name}
            </Link>
          ))}

          {/* The seam back to the unscoped view — this SAME console, every module. */}
          {module && activeSlug && (
            <Link
              href={`/platform-services/${activeSlug}`}
              className="ml-1 text-xs font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-300"
            >
              Browse every module →
            </Link>
          )}
        </nav>
      </div>

      {children}
    </div>
  )
}

/**
 * A responsive multi-column body grid for panel-heavy consoles.
 *
 * Use with `SectionCard`'s `span` prop so a panel can opt into taking more than one
 * column — otherwise every card defaults to the narrowest slot and full width buys
 * nothing but wider gutters.
 */
export function PlatformGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3', className)}>
      {children}
    </div>
  )
}

/** A main column plus a fixed-width side rail, for consoles with KPIs or quick actions beside their primary content. */
export function PlatformSidebarGrid({
  side,
  children,
  className,
}: {
  side: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]', className)}>
      <div className="min-w-0 space-y-4">{children}</div>
      <div className="space-y-4">{side}</div>
    </div>
  )
}
