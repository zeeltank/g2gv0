'use client'

import { useMemo } from 'react'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Insight } from '@/services/intelligence/types'
import { CROSS_AREA_ID, CROSS_DOMAIN_ID, HOME_HREF, insightPageFor } from '@/lib/intelligence-center/domains'
import { buildCrossView, crossEmptyText, type CrossView, type Snapshot } from '@/lib/intelligence-center/derive'
import { CROSS_LABEL, CROSS_SECTION_NOTE, CROSS_SECTION_TITLE, observedSetCount, verifiedDeepLink } from '@/lib/intelligence-center/cross'
import { AVAILABILITY } from '@/lib/intelligence-center/availability'
import { confidenceLabel, coverageText, formatAsOf, openLabel } from '@/lib/intelligence-center/model'
import { CHIP_BASE, confidenceChip, COVERAGE_CHIP, HEADER_BAND, KICKER, LINK_CLASS, SURFACE } from '@/lib/intelligence-center/tones'
import { CoverageBlock } from './coverage-block'
import { EvidenceList } from './evidence'
import { AvailabilityPanel, BackLink, IntelLink, IntelligencePage, ProvisionalPill, RefreshBar, Section, SeverityChip } from './ui'

export const CROSS_PAGE_HREF = `${HOME_HREF}/${CROSS_DOMAIN_ID}/${CROSS_AREA_ID}`

/** The mandated label, on every possible relationship, in words (the dashed border only helps). */
export function CrossLabel() {
  return (
    <span className={cn(CHIP_BASE, 'border-dashed border-indigo-400 bg-indigo-50 text-foreground')} data-cross-label>
      {CROSS_LABEL}
    </span>
  )
}

/**
 * One possible relationship. Always labelled; the two observed sets are the evidence; coverage, confidence, why it matters and the next action follow; the
 * link is drawn only when it is an in-app path that resolves to a verified screen. Nothing here says one thing caused another.
 */
export function CrossFindingCard({ insight, compact = false }: { insight: Insight; compact?: boolean }) {
  const confidence = confidenceLabel(insight.confidence)
  const coverage = coverageText(insight.coverage)
  const link = verifiedDeepLink(insight.deep_link)
  const sets = observedSetCount(insight)
  return (
    <article className={cn(SURFACE, 'space-y-3 border-l-4 border-l-indigo-400 p-4')} data-cross-finding={insight.key} data-severity={insight.severity}>
      <div className="flex flex-wrap items-center gap-2">
        <CrossLabel />
        <SeverityChip severity={insight.severity} />
        <span className={cn(CHIP_BASE, confidenceChip(insight.confidence))} data-chip="confidence">{confidence.label}</span>
      </div>
      <h3 className="text-sm font-semibold leading-snug">
        <IntelLink to={insightPageFor(insight)} className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{insight.title}</IntelLink>
      </h3>
      <p className="text-sm">{insight.what_happened}</p>

      <div data-observed-sets={sets} className="rounded-lg border border-border bg-muted/50 p-3">
        <p className="text-xs font-medium text-muted-foreground">What was observed{sets > 1 ? ` (${sets} separate sets, listed side by side)` : ''}</p>
        <div className="mt-1">
          <EvidenceList evidence={insight.evidence} fallbackLink={link} parts={compact ? 'measures' : 'all'} />
        </div>
      </div>

      <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Why it matters: </span>{insight.why_it_matters}</p>
      {insight.suggested_action && <p className="text-sm"><span className="font-medium">Next action: </span>{insight.suggested_action}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
        <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className={cn(CHIP_BASE, coverage.sufficient ? COVERAGE_CHIP.enough : COVERAGE_CHIP.thin)} data-chip="coverage">{coverage.headline}</span>
          {coverage.reason && <span>{coverage.reason}</span>}
          <span>{formatAsOf(insight.as_of)}</span>
        </span>
        {link ? (
          <IntelLink to={link} className={LINK_CLASS}>
            {openLabel(link)}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </IntelLink>
        ) : (
          <span className="text-xs text-muted-foreground" data-no-screen>No screen to open for this finding</span>
        )}
      </div>
    </article>
  )
}

/** What the section shows when there is nothing to list: the availability state in its one standard presentation, or the honest "none observed". */
function CrossEmpty({ view }: { view: CrossView }) {
  const empty = crossEmptyText(view)
  const state = view.condition
  if (state === 'partial' || state === 'not_enough_data' || state === 'data_unavailable' || state === 'access_restricted' || state === 'not_connected' || state === 'not_assessed' || state === 'excluded') {
    return <AvailabilityPanel state={state} detail={state === 'not_assessed' ? empty.detail : view.gapReason ?? AVAILABILITY[state].meaning} stateAttr="cross-empty" />
  }
  return (
    <div className={cn(SURFACE, 'border-dashed p-4')} data-intelligence-state="cross-empty" data-condition={state}>
      <p className="text-sm font-medium">{empty.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{empty.detail}</p>
    </div>
  )
}

/** The "Possible relationships" section of Global Intelligence (home): up to three findings, a link to all of them, or the honest availability state. */
export function CrossSection({ snapshot }: { snapshot: Snapshot }) {
  const view = useMemo(() => buildCrossView(snapshot), [snapshot])
  const shown = view.findings.slice(0, 3)
  return (
    <Section title={CROSS_SECTION_TITLE} description={CROSS_SECTION_NOTE} id="possible-relationships" action={view.findings.length > 0 ? <IntelLink to={CROSS_PAGE_HREF} className={LINK_CLASS}>See all {view.findings.length}<ArrowRight className="size-3.5" aria-hidden="true" /></IntelLink> : undefined}>
      <div data-cross-section data-cross-count={view.findings.length}>
        {shown.length > 0 ? (
          <ul className="grid gap-3 lg:grid-cols-2" data-cross-findings>
            {shown.map((insight) => <li key={insight.key}><CrossFindingCard insight={insight} compact /></li>)}
          </ul>
        ) : (
          <CrossEmpty view={view} />
        )}
      </div>
    </Section>
  )
}

/** /intelligence/cross-functional[/possible-relationships]: every possible relationship, with the checks behind them. Global level only. */
export function CrossPage() {
  const crumbs = [{ label: 'Intelligence', to: HOME_HREF }, { label: CROSS_SECTION_TITLE }]
  return (
    <IntelligencePage crumbs={crumbs} page="cross">
      {(snapshot) => <CrossContent snapshot={snapshot} />}
    </IntelligencePage>
  )
}

function CrossContent({ snapshot }: { snapshot: Snapshot }) {
  const view = useMemo(() => buildCrossView(snapshot), [snapshot])
  return (
    <div className="space-y-6">
      <header className={cn(HEADER_BAND, 'flex flex-wrap items-start justify-between gap-4 p-5')}>
        <div className="min-w-0">
          <p className={KICKER}>Global Intelligence</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{CROSS_SECTION_TITLE}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{CROSS_SECTION_NOTE}</p>
          <div className="mt-2"><CrossLabel /></div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <ProvisionalPill snapshot={snapshot} />
          <RefreshBar snapshot={snapshot} />
        </div>
      </header>

      {view.findings.length > 0 ? (
        <Section title="Findings" description="Most urgent first. Each is a possible relationship to verify, not a conclusion." id="cross-findings">
          <ul className="grid gap-3 lg:grid-cols-2" data-cross-findings>
            {view.findings.map((insight) => <li key={insight.key}><CrossFindingCard insight={insight} /></li>)}
          </ul>
        </Section>
      ) : (
        <CrossEmpty view={view} />
      )}

      {view.detectors.length > 0 && <CoverageBlock unit={view} id="cross-coverage" />}
      <BackLink to={HOME_HREF}>Back to Intelligence</BackLink>
    </div>
  )
}
