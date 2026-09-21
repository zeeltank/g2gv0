'use client'

/**
 * The AI & Intelligence console.
 *
 * One screen listing every AI capability, what state it is in, how much of it this
 * organisation actually has, and which of the three products consume it today. The
 * description half is a view over `packages/ai-intelligence-core` — nothing is
 * written here — so this page cannot disagree with the menu or the capability pages.
 *
 * TWO COLUMNS THAT ANSWER DIFFERENT QUESTIONS
 *
 * `Status` is a product statement: is this built. `In this organisation` is a count
 * of rows the signed-in organisation holds. They are kept side by side rather than
 * merged because a capability can honestly be in progress and already holding
 * thousands of records — Knowledge Graph is exactly that — and a single column would
 * have to pick one of those truths and drop the other.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

import { fetchCapabilities, type CapabilitySummary } from '@/lib/intelligence/ai-capabilities'
import { AI_CAPABILITIES, SOLUTIONS, capabilityStatusCounts } from '@shared/ai-intelligence-core'

import { ConsumptionPill, StatusChip } from './_components/console-ui'

export default function AiConsolePage() {
  const counts = capabilityStatusCounts()

  /**
   * Live record counts for the signed-in organisation, keyed by capability slug.
   *
   * Failure is silent by design — the table is useful without the counts, and an
   * error banner over a working list would overstate what went wrong.
   */
  const [live, setLive] = useState<Record<string, CapabilitySummary>>({})

  useEffect(() => {
    let cancelled = false

    fetchCapabilities()
      .then((data) => {
        if (cancelled) return
        setLive(Object.fromEntries(data.capabilities.map((row) => [row.key, row])))
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-[1100px]">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">AI &amp; Intelligence</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          The AI capabilities this platform provides once and every module calls. G2G serves them from
          its own database, so what you see below is this organisation&rsquo;s own configuration and its
          own records — nothing here is shared with, or read from, another product.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          {AI_CAPABILITIES.length} capabilities — {counts.live} live, {counts['in-progress']} in progress,{' '}
          {counts['coming-soon']} coming soon.
        </p>
      </header>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
          <thead>
            <tr>
              <th className="border-b border-border px-4 py-2.5 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                Capability
              </th>
              <th className="border-b border-border px-4 py-2.5 text-[11px] font-semibold tracking-widest whitespace-nowrap text-muted-foreground uppercase">
                Status
              </th>
              <th className="border-b border-border px-4 py-2.5 text-[11px] font-semibold tracking-widest whitespace-nowrap text-muted-foreground uppercase">
                In this organisation
              </th>
              {SOLUTIONS.map((solution) => (
                <th
                  key={solution.id}
                  className="border-b border-border px-4 py-2.5 text-[11px] font-semibold tracking-widest whitespace-nowrap text-muted-foreground uppercase"
                >
                  {solution.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {AI_CAPABILITIES.map((capability) => (
              <tr key={capability.id} className="transition-colors hover:bg-muted/40">
                <td className="px-4 py-3 align-top">
                  <Link
                    href={`/ai/${capability.slug}`}
                    className="group inline-flex items-center gap-1.5 font-medium text-card-foreground hover:underline"
                  >
                    {capability.name}
                    <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                  <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
                    {capability.purpose}
                  </p>
                </td>
                <td className="px-4 py-3 align-top">
                  <StatusChip status={capability.status} size="sm" />
                </td>
                <td className="px-4 py-3 align-top tabular-nums whitespace-nowrap">
                  <LiveCount summary={live[capability.slug]} />
                </td>
                {SOLUTIONS.map((solution) => (
                  <td key={solution.id} className="px-4 py-3 align-top">
                    <ConsumptionPill state={capability.solutions[solution.id].today} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-6 rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-card-foreground">How the three products share these</h2>
        <ul className="mt-3 space-y-3">
          {SOLUTIONS.map((solution) => (
            <li key={solution.id} className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
              <span className="w-40 shrink-0 text-sm font-medium text-card-foreground">
                {solution.label}
              </span>
              <span className="text-sm leading-6 text-muted-foreground">
                {solution.description}{' '}
                {solution.kind === 'host'
                  ? 'Serves these capabilities itself; a caller’s scope rides on the signed-in user.'
                  : 'Identifies itself with the x-project-id header and a service token.'}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

/**
 * One capability's live record count for the signed-in organisation.
 *
 * Renders a dash rather than a zero until the counts arrive, because "0" is a claim
 * about the data and an unanswered request is not one.
 */
function LiveCount({ summary }: { summary?: CapabilitySummary }) {
  if (!summary) return <span className="text-muted-foreground/50">—</span>

  if (summary.state === 'unavailable') {
    return (
      <span
        className="text-xs text-muted-foreground"
        title={`Not installed: ${(summary.missing_tables ?? []).join(', ')}`}
      >
        Not installed
      </span>
    )
  }

  if (summary.count === 0) {
    return <span className="text-xs text-muted-foreground">No records</span>
  }

  return (
    <span className="text-sm font-medium text-foreground">{summary.count.toLocaleString('en-IN')}</span>
  )
}
