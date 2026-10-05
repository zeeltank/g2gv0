'use client'

/**
 * The page for one platform service.
 *
 * Serves every service that has no console of its own. A service that grows one gets a
 * static route beside this file — `app/platform-services/scheduler/page.tsx`, say —
 * which Next resolves in preference to this dynamic segment, and which renders the same
 * `ServiceShell` with its console inside. So building a console is adding a file, never
 * editing this one.
 *
 * ── AN UNKNOWN SLUG IS NOT A 404 ────────────────────────────────────────────
 *
 * Slugs get bookmarked. Somebody following an old link to a renamed service should be
 * told what happened and handed the console, not shown the platform's generic
 * not-found page, which looks like the product is broken rather than like the address
 * moved.
 */

import { use } from 'react'
import Link from 'next/link'

import { getPlatformServiceBySlug } from '@shared/platform-services-core'
import { PlatformShell } from '@/components/shell/platform-shell'

import { ServiceDetail } from '../_components/ServiceDetail'
import { ServiceShell } from '../_components/ServiceShell'

export default function PlatformServicePage({
  params,
}: {
  params: Promise<{ service: string }>
}) {
  const { service: slug } = use(params)
  const service = getPlatformServiceBySlug(slug)

  if (!service) {
    return (
      <PlatformShell backHref="/platform-services" eyebrow="Platform Services" title="Not found">
        <div className="mt-6 rounded-lg border border-border bg-card p-6">
          <p className="text-lg font-semibold text-foreground">
            There is no platform service called &ldquo;{slug}&rdquo;
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            It may have been renamed, or this link may predate it. The console lists every
            service the platform has.
          </p>
          <Link
            href="/platform-services"
            className="mt-4 inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            Open Platform Services
          </Link>
        </div>
      </PlatformShell>
    )
  }

  return (
    <ServiceShell slug={slug}>
      <ServiceDetail service={service} />
    </ServiceShell>
  )
}
