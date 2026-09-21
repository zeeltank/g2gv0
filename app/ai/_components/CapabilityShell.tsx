'use client'

/**
 * The capability page's frame, extracted so a managed capability keeps it.
 *
 * `/ai/providers`, `/ai/models`, `/ai/prompts` and `/ai/policies` are static routes
 * with their own management UI, which in Next takes precedence over
 * `app/ai/[capability]/page.tsx`. Without this component each would have to re-create
 * the header, the back link, the status chip and the live-data panel — five copies of
 * a layout that has to stay identical across twelve capabilities, and the first one
 * that drifts is the one nobody notices.
 *
 * So the dynamic page and the managed pages render the same shell and differ only in
 * what they put inside it.
 */

import Link from 'next/link'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'

import { getCapabilityBySlug } from '@shared/ai-intelligence-core'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'

import { CapabilityLiveData } from './CapabilityLiveData'
import { StatusChip } from './console-ui'

export function CapabilityShell({
  slug,
  children,
}: {
  slug: string
  children?: React.ReactNode
}) {
  const capability = getCapabilityBySlug(slug)
  /*
   * A capability whose screen lives inside the module shell carries an access link
   * rather than a URL, because G2G's module routes are built from menu-row ids that
   * differ between deployments. Resolving it against the signed-in user's own tree
   * is also what makes the link honest: a profile with no rights to that screen gets
   * no button, instead of a button that answers 404.
   */
  const { resolveAccessLink } = useSidebarNavigation()

  if (!capability) return null

  const resolved = capability.accessLink ? resolveAccessLink(capability.accessLink) : null
  // `resolveAccessLink` falls back to '/dashboard' when the caller cannot see the
  // screen. Sending someone to the dashboard from a button labelled "Open Agent
  // Management" is worse than not offering the button, so that answer is dropped.
  const openHref = capability.href ?? (resolved && resolved !== '/dashboard' ? resolved : null)

  return (
    <div className="mx-auto max-w-[1100px]">
      <Link
        href="/ai"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        AI &amp; Intelligence
      </Link>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-foreground">{capability.name}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{capability.purpose}</p>
        </div>
        <StatusChip status={capability.status} />
      </header>

      {/* A capability whose screen is somewhere else says so at the top. Burying the
          link under the data would make a live feature look like a description. */}
      {openHref && openHref !== `/ai/${capability.slug}` && (
        <Link
          href={openHref}
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
        >
          Open {capability.name}
          <ArrowUpRight className="size-4" />
        </Link>
      )}

      {/* Live records lead — what the capability holds for this organisation is what
          an administrator opened the screen for. The controls below act on the same
          rows. */}
      <CapabilityLiveData slug={capability.slug} name={capability.name} />

      {children}
    </div>
  )
}
