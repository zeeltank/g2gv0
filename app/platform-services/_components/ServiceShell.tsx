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

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowUpRight } from 'lucide-react'

import { getPlatformServiceBySlug } from '@shared/platform-services-core'
import { StatusChip } from '@/components/shared/console-ui'
import { PlatformServiceIcon } from '@/lib/platform/icons'
import { usePlatformDestination } from '@/hooks/use-platform-destination'
import { isDecentralizedModule, MODULE_LABEL } from '@/lib/platform/access-links'
import { PLATFORM_SECTION_LABEL, PlatformShell } from '@/components/shell/platform-shell'

/**
 * `useSearchParams()` (read below, for the `?module=` decentralized seam) requires a
 * Suspense boundary during static generation, or the build fails/opts every page using
 * this shell out of static rendering. Wrapping it HERE, once, means none of the five-plus
 * pages that render `<ServiceShell>` have to know that or add their own boundary.
 */
export function ServiceShell(props: { slug: string; children?: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ServiceShellContent {...props} />
    </Suspense>
  )
}

function ServiceShellContent({ slug, children }: { slug: string; children?: React.ReactNode }) {
  const service = getPlatformServiceBySlug(slug)
  const resolve = usePlatformDestination()
  const searchParams = useSearchParams()

  if (!service) return null

  const { href, isRealScreen } = resolve(service)

  // The decentralized seam: `?module=hrms` on any of the five scoped consoles' own
  // route means this render IS that module's own tab, not the central hub.
  const moduleKey = searchParams.get('module')
  const scopeModule = isDecentralizedModule(moduleKey) ? { key: moduleKey, label: MODULE_LABEL[moduleKey] } : null

  return (
    <PlatformShell
      backHref="/platform-services"
      eyebrow={
        scopeModule
          ? `${scopeModule.label} · ${PLATFORM_SECTION_LABEL[service.section] ?? 'Platform Services'}`
          : (PLATFORM_SECTION_LABEL[service.section] ?? 'Platform Services')
      }
      module={scopeModule}
      title={service.name}
      description={service.purpose}
      icon={
        <PlatformServiceIcon
          slug={service.slug}
          className="size-6 shrink-0 text-indigo-600 dark:text-indigo-300"
        />
      }
      status={<StatusChip status={service.status} />}
      /* A service whose screen is somewhere else says so at the top. Burying the link
         under the description would make a working feature look like a plan.

         `isRealScreen` is false when the access link did not resolve for this profile,
         so somebody without rights to the screen gets no button rather than a button
         that answers 404 — or worse, one that quietly opens the dashboard. */
      actions={
        isRealScreen ? (
          <Link
            href={href}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted dark:border-white/15 dark:bg-white/10 dark:hover:bg-white/20"
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
