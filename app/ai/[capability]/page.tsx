'use client'

/**
 * One AI capability, described from the shared registry and filled from G2G's data.
 *
 * WHAT THIS REPLACES
 *
 * The generic "under construction" placeholder that every unimplemented menu entry
 * used to point at — the same eleven words for every capability, telling a customer
 * nothing about any of them.
 *
 * This page leads with what the capability actually holds for the signed-in
 * organisation, then the registry record: what it is for, why it has to be shared
 * rather than rebuilt per product, what G2G does about it today, and what is left.
 * Every capability gets the same structure, because every capability has the same
 * record behind it.
 *
 * The four capabilities with management screens of their own — providers, models,
 * prompts, policies — have static routes that Next resolves ahead of this one, so
 * this page serves the other eight.
 */

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, LayoutGrid } from 'lucide-react'

import { getCapabilityBySlug } from '@shared/ai-intelligence-core'

import { CapabilityShell } from '../_components/CapabilityShell'
import { PointList, SectionCard } from '../_components/console-ui'

export default function AiCapabilityPage() {
  const params = useParams<{ capability: string }>()
  const slug = Array.isArray(params?.capability) ? params.capability[0] : params?.capability
  const capability = slug ? getCapabilityBySlug(slug) : undefined

  if (!capability) return <UnknownCapability slug={slug} />

  return (
    <CapabilityShell slug={capability.slug}>
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Where this stands today" description={capability.todayInG2g} />
        <SectionCard title="Why it is one shared service" description={capability.whyCentral} />
        <SectionCard title="What is left to do">
          <PointList points={capability.toCentralise} />
        </SectionCard>
        <SectionCard title="What the platform gains">
          <PointList points={capability.afterCentralisation} />
        </SectionCard>
      </div>
    </CapabilityShell>
  )
}

/**
 * A slug the registry does not know.
 *
 * Says which name failed rather than showing a generic empty state — a renamed
 * capability leaves bookmarks behind, and the person following one needs to know that
 * the name changed, not that something broke.
 */
function UnknownCapability({ slug }: { slug?: string }) {
  return (
    <div className="flex h-full items-center justify-center py-10">
      <div className="flex max-w-md flex-col items-center rounded-lg border border-dashed border-border bg-card p-8 text-center">
        <span
          className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
          aria-hidden="true"
        >
          <LayoutGrid className="size-5" />
        </span>
        <h1 className="text-lg font-semibold text-foreground">No such AI capability</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {slug ? `"${slug}" is not in the AI capability registry.` : 'No capability was named.'} It may
          have been renamed.
        </p>
        <Link
          href="/ai"
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
          All AI capabilities
        </Link>
      </div>
    </div>
  )
}
