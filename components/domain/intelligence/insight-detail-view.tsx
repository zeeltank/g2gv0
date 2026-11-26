'use client'

import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Insight } from '@/services/intelligence/types'
import { areaById, areaHref, classifyInsight, CROSS_DOMAIN_ID, decodeSegment, domainById, domainHref, HOME_HREF, isCrossInsight, OTHER_AREA } from '@/lib/intelligence-center/domains'
import { CROSS_SECTION_TITLE, verifiedDeepLink } from '@/lib/intelligence-center/cross'
import { findInsight, SEVERITY_MEANING, type Snapshot } from '@/lib/intelligence-center/derive'
import { AUDIENCE_LABEL, confidenceLabel, coverageText, formatAsOf, openLabel, provisionalNotice, safeDeepLink } from '@/lib/intelligence-center/model'
import { CHIP_BASE, confidenceChip, COVERAGE_CHIP, HEADER_BAND, LINK_BUTTON, SEVERITY_EDGE, SURFACE } from '@/lib/intelligence-center/tones'
import { EvidenceList } from './evidence'
import { BackLink, IntelLink, IntelligencePage, RefreshBar, SeverityChip } from './ui'
import { CROSS_PAGE_HREF, CrossLabel } from './cross-view'

/** The seven questions about one finding, as headed sections. `insightKey` is the (URL-encoded) key from the address. */
export function InsightDetailPage({ domainId, areaId, insightKey }: { domainId: string; areaId: string; insightKey: string }) {
  const key = decodeSegment(insightKey)
  const asked = domainById(domainId)
  const askedArea = areaById(domainId, areaId)
  const isCross = domainId === CROSS_DOMAIN_ID
  const crumbs = isCross
    ? [{ label: 'Intelligence', to: HOME_HREF }, { label: CROSS_SECTION_TITLE, to: CROSS_PAGE_HREF }, { label: 'Finding' }]
    : [
        { label: 'Intelligence', to: HOME_HREF },
        { label: asked?.title ?? 'Not found', to: asked ? domainHref(asked.id) : undefined },
        { label: askedArea?.title ?? 'Not found', to: asked && askedArea ? areaHref(asked.id, askedArea.id) : undefined },
        { label: 'Finding' },
      ]
  return (
    <IntelligencePage crumbs={crumbs} page="insight">
      {(snapshot) => {
        const insight = findInsight(snapshot, key)
        return insight ? (
          <DetailContent snapshot={snapshot} insight={insight} />
        ) : (
          <NoLongerOpen
            area={isCross ? { to: CROSS_PAGE_HREF, label: CROSS_SECTION_TITLE } : asked && askedArea ? { to: areaHref(asked.id, askedArea.id), label: askedArea.title } : null}
            domain={isCross ? null : asked ? { to: domainHref(asked.id), label: asked.title } : null}
          />
        )
      }}
    </IntelligencePage>
  )
}

function NoLongerOpen({ area, domain }: { area: { to: string; label: string } | null; domain: { to: string; label: string } | null }) {
  return (
    <div role="status" data-intelligence-state="no-longer-open" className={cn(SURFACE, 'space-y-3 px-6 py-10 text-center')}>
      <h1 className="text-lg font-semibold">This finding is no longer open</h1>
      <p className="mx-auto max-w-md text-sm text-muted-foreground">This link is out of date, or the finding is no longer reported.</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {area && <IntelLink to={area.to} className={LINK_BUTTON}>Back to {area.label}</IntelLink>}
        {domain && <IntelLink to={domain.to} className={LINK_BUTTON}>Back to {domain.label}</IntelLink>}
        <IntelLink to={HOME_HREF} className={LINK_BUTTON}>Go to Intelligence</IntelLink>
      </div>
    </div>
  )
}

function DetailContent({ snapshot, insight }: { snapshot: Snapshot; insight: Insight }) {
  // The crumbs of the page are the URL's; the back links are where the finding really belongs.
  const place = classifyInsight(insight)
  const domain = domainById(place.domain)
  const area = place.domain === 'other' ? OTHER_AREA : areaById(place.domain, place.area)
  const confidence = confidenceLabel(insight.confidence)
  const coverage = coverageText(insight.coverage)
  const isCross = isCrossInsight(insight)
  // A possible relationship links only to a screen that is verified to exist; every other finding keeps the standard safe-link rule.
  const link = isCross ? verifiedDeepLink(insight.deep_link) : safeDeepLink(insight.deep_link)
  const moduleLinks = (area?.modules ?? []).filter((m) => m.href !== link)

  return (
    <article className="space-y-6" data-insight={insight.key} data-severity={insight.severity}>
      <header className={cn(HEADER_BAND, 'space-y-2 border-l-4 p-5', SEVERITY_EDGE[insight.severity])}>
        <div className="flex flex-wrap items-center gap-2">
          <SeverityChip severity={insight.severity} />
          <span className={cn(CHIP_BASE, confidenceChip(insight.confidence))} data-chip="confidence">{confidence.label}</span>
          {domain && <span className={cn(CHIP_BASE, 'border-border bg-muted text-muted-foreground')} data-chip="domain">{domain.title}</span>}
          {isCross && <CrossLabel />}
        </div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{insight.title}</h1>
        <RefreshBar snapshot={snapshot} />
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Block title="What is happening" id="happening">
          <p>{insight.what_happened}</p>
        </Block>
        <Block title="What it means" id="means">
          <p>{insight.title}</p>
          <p className="mt-1 text-muted-foreground">{isCross ? 'This is a possible relationship between two things that were observed. It needs verification: no cause is established.' : SEVERITY_MEANING[insight.severity]}</p>
        </Block>
        <Block title="Why it matters" id="why">
          <p>{insight.why_it_matters}</p>
        </Block>
        <Block title="What to do next" id="next">
          {insight.suggested_action ? <p>{insight.suggested_action}</p> : <p className="text-muted-foreground">No specific action was suggested for this finding.</p>}
        </Block>
      </div>

      <Block title="Evidence" id="evidence">
        {insight.evidence.length > 0 ? <EvidenceList evidence={insight.evidence} fallbackLink={link} parts="measures" /> : <p className="text-muted-foreground">No evidence items were attached to this finding.</p>}
      </Block>

      <Block title="How reliable is this" id="reliable">
        <ul className="space-y-1.5" data-reliability>
          <li>
            <span className="font-medium">{confidence.label}.</span> {confidence.note}
            {confidence.isEstimate && <span className="font-medium" data-estimate-note> This is an estimate and must not be read as a measured fact.</span>}
          </li>
          <li>
            <span className={cn(CHIP_BASE, coverage.sufficient ? COVERAGE_CHIP.enough : COVERAGE_CHIP.thin)} data-chip="coverage">{coverage.headline}</span>
            {coverage.reason && <span className="ml-2 text-muted-foreground">{coverage.reason}</span>}
          </li>
          <li>Whose data: {AUDIENCE_LABEL[insight.audience]}.</li>
          <li>As of {formatAsOf(insight.as_of)}.</li>
          {insight.provisional && <li data-provisional-note>Provisional: {provisionalNotice(snapshot.meta)}</li>}
        </ul>
      </Block>

      <Block title="Where to act" id="act">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2" data-module-links>
            {link && (
              <IntelLink to={link} className={LINK_BUTTON}>
                {openLabel(link)}
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </IntelLink>
            )}
            {moduleLinks.map((m) => (
              <IntelLink key={m.href} to={m.href} className={LINK_BUTTON}>
                Open {m.label}
              </IntelLink>
            ))}
            {!link && moduleLinks.length === 0 && <p className="text-muted-foreground">This finding does not point at a screen.</p>}
          </div>
          <div data-record-links>
            <EvidenceList evidence={insight.evidence} fallbackLink={link} parts="records" />
          </div>
        </div>
      </Block>

      <div className="flex flex-wrap items-center gap-4">
        {isCross && <BackLink to={CROSS_PAGE_HREF}>Back to {CROSS_SECTION_TITLE}</BackLink>}
        {!isCross && area && domain && <BackLink to={place.domain === 'other' ? domainHref('other') : areaHref(domain.id, area.id)}>Back to {area.title}</BackLink>}
        <BackLink to={HOME_HREF}>Back to Intelligence</BackLink>
      </div>
    </article>
  )
}

function Block({ title, id, children }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`} className={cn(SURFACE, 'p-4')} data-section={id}>
      <h2 id={`${id}-heading`} className="text-sm font-semibold">{title}</h2>
      <div className="mt-2 text-sm">{children}</div>
    </section>
  )
}
