'use client'

/**
 * What's Coming — the cross-platform roadmap.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THERE IS NO ROADMAP REGISTRY BEHIND THIS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * LMS K-12 has one: `lib/roadmap/registry.ts`, ~60 rows, and its header makes the case
 * well — a roadmap page assembled from the same rows the placeholders render cannot
 * drift from what the product actually shows a customer.
 *
 * That argument is right, and it is an argument for deriving the roadmap rather than for
 * keeping a second list. The placeholders in this product already read
 * `PLATFORM_SERVICES` and `AI_CAPABILITIES`; a roadmap file beside them would be a third
 * place to record the same claim, and the one that goes stale is always the one nobody
 * opens. So this page is a query over those two registries: everything whose status is
 * not `live`.
 *
 * The consequence to keep in mind: a thing appears here by being marked unbuilt in its
 * own registry, and disappears by being marked `live` there. There is no way to put
 * something on this page without also changing what its own screen says, which is the
 * point.
 *
 * ── WHAT IS DELIBERATELY NOT HERE ───────────────────────────────────────────
 *
 * Dates. The registries carry a delivery phase, not a quarter. A product screen that
 * commits to timing is making a commitment on behalf of people who did not agree to it,
 * and it is read as a promise however it is hedged.
 */

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { AI_CAPABILITIES } from '@shared/ai-intelligence-core'
import { PLATFORM_SERVICES } from '@shared/platform-services-core'
import { StatusChip, type ConsoleStatus } from '@/components/shared/console-ui'

interface RoadmapRow {
  key: string
  name: string
  purpose: string
  status: ConsoleStatus
  href: string
  /** Only platform services carry one; an AI capability has no phase field. */
  phase?: 1 | 2 | 3
}

function upcomingServices(): RoadmapRow[] {
  return PLATFORM_SERVICES.filter((service) => service.status !== 'live').map((service) => ({
    key: service.id,
    name: service.name,
    purpose: service.purpose,
    status: service.status,
    href: `/platform-services/${service.slug}`,
    phase: service.phase,
  }))
}

function upcomingCapabilities(): RoadmapRow[] {
  return AI_CAPABILITIES.filter((capability) => capability.status !== 'live').map((capability) => ({
    key: capability.id,
    name: capability.name,
    purpose: capability.purpose,
    status: capability.status,
    href: `/ai/${capability.slug}`,
  }))
}

export default function WhatsComingPage() {
  const services = upcomingServices()
  const capabilities = upcomingCapabilities()
  const total = services.length + capabilities.length

  return (
    <div className="mx-auto max-w-[1100px]">
      <Link
        href="/platform-services"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Platform Services
      </Link>

      <header className="mt-3">
        <h1 className="text-2xl font-semibold text-foreground">What&rsquo;s Coming</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Everything across the platform services and the AI capabilities that is not finished
          yet. This list is not maintained by hand — it is every record that its own screen also
          reports as unbuilt, so the two cannot disagree. Open any row to read what exists in
          this organisation today and what is still missing.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          {total === 0
            ? 'Nothing outstanding — every service and capability is live.'
            : `${total} in progress or planned.`}
        </p>
      </header>

      <RoadmapSection
        title="Platform services"
        blurb="Services the platform provides, and the screens that configure this organisation."
        rows={services}
      />

      <RoadmapSection
        title="AI &amp; Intelligence"
        blurb="Capabilities the platform serves once and every module calls."
        rows={capabilities}
      />
    </div>
  )
}

function RoadmapSection({
  title,
  blurb,
  rows,
}: {
  title: string
  blurb: string
  rows: RoadmapRow[]
}) {
  if (rows.length === 0) return null

  return (
    <section className="mt-6">
      <h2 className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{blurb}</p>

      <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <Link
                href={row.href}
                className="text-sm font-medium text-card-foreground hover:underline"
              >
                {row.name}
              </Link>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                {row.purpose}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {row.phase && (
                <span className="text-[10px] tracking-wider text-muted-foreground/70 uppercase">
                  Phase {row.phase}
                </span>
              )}
              <StatusChip status={row.status} size="sm" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
