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
 * ── THE BANNER IS THE VISUAL SIGNATURE ──────────────────────────────────────
 *
 * Full width alone does not read as "a distinct area" — it reads as a normal page that
 * forgot to constrain itself. The dark gradient band, unique to this section, is what
 * makes Platform Services recognisable as its own control plane at a glance, the same way
 * Settings and Organization already have their own visual identity elsewhere in the
 * product. Nothing else in the app uses this treatment.
 *
 * The band bleeds past `GtgPageShell`'s own `p-6` via negative margins so it reaches the
 * edges of the content area rather than floating inside it with a border on every side.
 */

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { cn } from '@/lib/utils'

/** The two groups a platform service belongs to — shared so no page re-declares it. */
export const PLATFORM_SECTION_LABEL: Record<string, string> = {
  services: 'Platform service',
  setup: 'Setup & configuration',
}

/**
 * The six consoles with a real screen today.
 *
 * Deliberately not all twelve platform services — the other six route into the module
 * navigation or are not built yet, and a quick-nav strip listing destinations that are not
 * "another console in this control plane" would misrepresent what switching does.
 */
const QUICK_NAV: { slug: string; label: string }[] = [
  { slug: 'workflow', label: 'Workflow' },
  { slug: 'scheduler', label: 'Scheduler' },
  { slug: 'integration', label: 'Integrations' },
  { slug: 'event-bus', label: 'Event Bus' },
  { slug: 'add-process', label: 'Add Process' },
  { slug: 'fields-configuration', label: 'Fields Configuration' },
]

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
  children?: ReactNode
}) {
  return (
    <div className="w-full">
      <div className="-mx-6 -mt-6 border-b border-white/10 bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 px-6 pt-6 pb-6 text-slate-50 xl:-mx-10 xl:px-10 2xl:-mx-14 2xl:px-14">
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-3.5" />
            {backLabel}
          </Link>
        )}

        <div className={cn('flex flex-wrap items-start justify-between gap-4', backHref && 'mt-3')}>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-widest text-indigo-300/80 uppercase">
              {eyebrow}
            </p>
            <h1 className="mt-1 flex items-center gap-2.5 text-2xl font-semibold text-white">
              {icon}
              {title}
            </h1>
            {description && (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{description}</p>
            )}
          </div>

          {(status || actions) && (
            <div className="flex shrink-0 flex-col items-end gap-2">
              {status}
              {actions}
            </div>
          )}
        </div>

        <nav className="mt-5 flex flex-wrap gap-1.5" aria-label="Platform Services consoles">
          {QUICK_NAV.map((item) => (
            <Link
              key={item.slug}
              href={`/platform-services/${item.slug}`}
              aria-current={item.slug === activeSlug ? 'page' : undefined}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                item.slug === activeSlug
                  ? 'bg-white/15 text-white'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white',
              )}
            >
              {item.label}
            </Link>
          ))}
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
