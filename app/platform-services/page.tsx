'use client'

/**
 * The Platform Services console — and the Platform Administration screen.
 *
 * One screen listing every platform service, what state it is in, and where its screen
 * actually lives. It is a view over `packages/platform-services-core` — nothing is
 * written here — so this page cannot disagree with the menu or the service pages.
 *
 * ── WHY THE MENU ITEM AND THE SECTION HEADING BOTH POINT HERE ───────────────
 *
 * "Platform Administration" is not a second screen that summarises this one; it IS this
 * one. LMS K-12 makes the same call — its section heading and its Platform Administration
 * entry share a route — and the alternative is two pages describing the same twelve rows,
 * which is two places to update and one of them always stale.
 *
 * ── NO NETWORK CALLS, ON PURPOSE ────────────────────────────────────────────
 *
 * Everything on this page comes from the registry, which is compiled in. That makes it
 * the one screen in the section that cannot fail to load — which matters, because it is
 * where somebody lands when another screen has just failed them.
 */

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

import { PLATFORM_SERVICES, platformStatusCounts } from '@shared/platform-services-core'
import { StatusChip } from '@/components/shared/console-ui'
import { PlatformServiceIcon } from '@/lib/platform/icons'
import { usePlatformDestination } from '@/hooks/use-platform-destination'

const SECTION_LABEL: Record<string, string> = {
  services: 'Platform service',
  setup: 'Setup & configuration',
}

export default function PlatformServicesConsolePage() {
  const counts = platformStatusCounts()
  const resolve = usePlatformDestination()

  return (
    <div className="mx-auto max-w-[1100px]">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Platform Services</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          The services this platform provides once and every module uses, and the screens an
          administrator operates to configure this organisation. Each row says where its screen
          is today — some are reached through the module navigation, some are their own page, and
          the ones that are not built yet say so rather than showing an empty screen.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          {PLATFORM_SERVICES.length} services — {counts.live} live, {counts['in-progress']} in
          progress, {counts['coming-soon']} coming soon.
        </p>
      </header>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
          <thead>
            <tr>
              <th className="border-b border-border px-4 py-2.5 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                Service
              </th>
              <th className="border-b border-border px-4 py-2.5 text-[11px] font-semibold tracking-widest whitespace-nowrap text-muted-foreground uppercase">
                Group
              </th>
              <th className="border-b border-border px-4 py-2.5 text-[11px] font-semibold tracking-widest whitespace-nowrap text-muted-foreground uppercase">
                Status
              </th>
              <th className="border-b border-border px-4 py-2.5 text-[11px] font-semibold tracking-widest whitespace-nowrap text-muted-foreground uppercase">
                Where it is
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {PLATFORM_SERVICES.map((service) => {
              const { isRealScreen } = resolve(service)

              return (
                <tr key={service.id} className="transition-colors hover:bg-muted/40">
                  <td className="px-4 py-3 align-top">
                    <Link
                      href={`/platform-services/${service.slug}`}
                      className="group inline-flex items-center gap-2 font-medium text-card-foreground hover:underline"
                    >
                      <PlatformServiceIcon
                        slug={service.slug}
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                      {service.name}
                      <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                    <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
                      {service.purpose}
                    </p>
                  </td>
                  <td className="px-4 py-3 align-top text-xs whitespace-nowrap text-muted-foreground">
                    {SECTION_LABEL[service.section]}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <StatusChip status={service.status} size="sm" />
                  </td>
                  <td className="px-4 py-3 align-top text-xs leading-5 text-muted-foreground">
                    <WhereItIs service={service} isRealScreen={isRealScreen} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <section className="mt-6 rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-card-foreground">
          Why these are not in the module navigation
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The module menu is this organisation&rsquo;s own navigation, built from its menu
          catalogue and filtered by each profile&rsquo;s rights. These screens configure the
          platform that every module then runs on, so they hang off the account menu instead —
          which also means an administrator can reach them without rights rows having been
          written for every profile first. The server enforces the same rule independently:
          the endpoints behind them are administrator-only.
        </p>
      </section>
    </div>
  )
}

/**
 * Where a service's screen actually is, in a sentence.
 *
 * `isRealScreen` is resolved against the signed-in user's own menu, so a service whose
 * screen exists but which THIS profile cannot reach reads "not available to your role"
 * rather than claiming a destination that would answer 404.
 */
function WhereItIs({
  service,
  isRealScreen,
}: {
  service: (typeof PLATFORM_SERVICES)[number]
  isRealScreen: boolean
}) {
  const { destination } = service

  if (destination.kind === 'not-built') {
    return <span className="text-muted-foreground/70">Not built yet — phase {service.phase}</span>
  }

  if (destination.kind === 'existing-screen') {
    return isRealScreen ? (
      <span>In the module navigation</span>
    ) : (
      <span className="text-muted-foreground/70">Not available to your role</span>
    )
  }

  if (destination.kind === 'existing-route') {
    return <span>{destination.href}</span>
  }

  return <span>{destination.href}</span>
}
