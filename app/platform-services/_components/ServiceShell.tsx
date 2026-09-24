'use client'

/**
 * The service page's frame, extracted so a built service keeps it.
 *
 * `/platform-services/scheduler` and `/platform-services/event-bus` become static routes
 * with their own console, which in Next takes precedence over
 * `app/platform-services/[service]/page.tsx`. Without this component each would have to
 * re-create the header, the back link, the status chip and the "Open X" button — copies
 * of a layout that has to stay identical across twelve services, and the first one that
 * drifts is the one nobody notices.
 *
 * So the dynamic page and the built consoles render the same shell and differ only in
 * what they put inside it. `CapabilityShell` does the same job for the AI console.
 */

import Link from 'next/link'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'

import { getPlatformServiceBySlug } from '@shared/platform-services-core'
import { StatusChip } from '@/components/shared/console-ui'
import { PlatformServiceIcon } from '@/lib/platform/icons'
import { usePlatformDestination } from '@/hooks/use-platform-destination'

export function ServiceShell({ slug, children }: { slug: string; children?: React.ReactNode }) {
  const service = getPlatformServiceBySlug(slug)
  const resolve = usePlatformDestination()

  if (!service) return null

  const { href, isRealScreen } = resolve(service)

  return (
    <div className="mx-auto max-w-[1100px]">
      <Link
        href="/platform-services"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Platform Services
      </Link>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold text-foreground">
            <PlatformServiceIcon
              slug={service.slug}
              className="size-6 shrink-0 text-muted-foreground"
            />
            {service.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {service.purpose}
          </p>
        </div>
        <StatusChip status={service.status} />
      </header>

      {/* A service whose screen is somewhere else says so at the top. Burying the link
          under the description would make a working feature look like a plan.

          `isRealScreen` is false when the access link did not resolve for this profile,
          so somebody without rights to the screen gets no button rather than a button
          that answers 404 — or worse, one that quietly opens the dashboard. */}
      {isRealScreen && (
        <Link
          href={href}
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
        >
          Open {service.name}
          <ArrowUpRight className="size-4" />
        </Link>
      )}

      {children}
    </div>
  )
}
