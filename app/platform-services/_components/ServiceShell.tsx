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
import { ArrowUpRight } from 'lucide-react'

import { getPlatformServiceBySlug } from '@shared/platform-services-core'
import { StatusChip } from '@/components/shared/console-ui'
import { PlatformServiceIcon } from '@/lib/platform/icons'
import { usePlatformDestination } from '@/hooks/use-platform-destination'
import { PLATFORM_SECTION_LABEL, PlatformShell } from '@/components/shell/platform-shell'

export function ServiceShell({ slug, children }: { slug: string; children?: React.ReactNode }) {
  const service = getPlatformServiceBySlug(slug)
  const resolve = usePlatformDestination()

  if (!service) return null

  const { href, isRealScreen } = resolve(service)

  return (
    <PlatformShell
      backHref="/platform-services"
      eyebrow={PLATFORM_SECTION_LABEL[service.section] ?? 'Platform Services'}
      title={service.name}
      description={service.purpose}
      icon={
        <PlatformServiceIcon slug={service.slug} className="size-6 shrink-0 text-indigo-300" />
      }
      status={<StatusChip status={service.status} />}
      activeSlug={service.slug}
      /* A service whose screen is somewhere else says so at the top. Burying the link
         under the description would make a working feature look like a plan.

         `isRealScreen` is false when the access link did not resolve for this profile,
         so somebody without rights to the screen gets no button rather than a button
         that answers 404 — or worse, one that quietly opens the dashboard. */
      actions={
        isRealScreen ? (
          <Link
            href={href}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-white/20"
          >
            Open {service.name}
            <ArrowUpRight className="size-4" />
          </Link>
        ) : undefined
      }
    >
      {children}
    </PlatformShell>
  )
}
