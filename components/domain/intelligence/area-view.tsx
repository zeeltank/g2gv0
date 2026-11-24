'use client'

import { useId, useMemo, useState } from 'react'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Insight, InsightSeverity } from '@/services/intelligence/types'
import { areaById, CROSS_DOMAIN_ID, domainById, domainHref, HOME_HREF, insightPageFor } from '@/lib/intelligence-center/domains'
import { buildAreaView, emptyText, filterBySeverity, type Snapshot } from '@/lib/intelligence-center/derive'
import { confidenceLabel, coverageText, formatAsOf, openLabel, safeDeepLink, SEVERITY_LABEL, SEVERITY_ORDER } from '@/lib/intelligence-center/model'
import { CHIP_BASE, confidenceChip, COVERAGE_CHIP, HEADER_BAND, LINK_BUTTON, LINK_CLASS, SEVERITY_EDGE, SURFACE } from '@/lib/intelligence-center/tones'
import { CoverageBlock } from './coverage-block'
import { CrossPage } from './cross-view'
import { EvidenceList } from './evidence'
import { BackLink, ConditionChip, IntelLink, IntelligencePage, NotFoundState, ProvisionalPill, RefreshBar, Section, SeverityChip, SuppressedLine } from './ui'

type Filter = InsightSeverity | 'all'

/** One area: its findings as expandable cards, most urgent first, a severity filter, coverage, and a plain statement that trends are not available. */
export function AreaPage({ domainId, areaId }: { domainId: string; areaId: string }) {
  if (domainId === CROSS_DOMAIN_ID) return <CrossPage />
  const domain = domainById(domainId)
  const area = areaById(domainId, areaId)
  const crumbs = [
    { label: 'Intelligence', to: HOME_HREF },
    { label: domain?.title ?? 'Not found', to: domain ? domainHref(domain.id) : undefined },
    ...(domain ? [{ label: area?.title ?? 'Not found' }] : []),
  ]
  return (
    <IntelligencePage crumbs={crumbs} page="area">
      {(snapshot) =>
        domain && area ? (
          <AreaContent snapshot={snapshot} domainId={domain.id} areaId={area.id} />
        ) : (
          <NotFoundState
            title="That page does not exist"
            detail="The address may be out of date or mistyped."
            backTo={domain ? domainHref(domain.id) : HOME_HREF}
            backLabel={domain ? `Back to ${domain.title}` : 'Back to Intelligence'}
          />
        )
      }
    </IntelligencePage>
  )
}

function AreaContent({ snapshot, domainId, areaId }: { snapshot: Snapshot; domainId: string; areaId: string }) {
  const domain = domainById(domainId)
  const def = areaById(domainId, areaId)
  const view = useMemo(() => (def ? buildAreaView(snapshot, def) : null), [snapshot, def])
  const [filter, setFilter] = useState<Filter>('all')
  if (!domain || !def || !view) return null
  const shown = filterBySeverity(view.insights, filter)
  const empty = emptyText(view, def.domain === 'other')

  return (
    <div className="space-y-6">
      <header className={cn(HEADER_BAND, 'flex flex-wrap items-start justify-between gap-4 p-5')}>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{def.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{def.monitors}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {!(def.domain === 'other' && view.insights.length === 0) && <ConditionChip condition={view.condition} />}
            {view.coverage.checks > 0 && <span className={cn(CHIP_BASE, COVERAGE_CHIP.enough)} data-chip="coverage">{view.coverage.headline}</span>}
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <ProvisionalPill snapshot={snapshot} />
          <RefreshBar snapshot={snapshot} />
        </div>
      </header>

      <Section title="Findings" id="findings" description={view.insights.length > 0 ? 'Most urgent first. Open a card to read it; open the page for everything about a finding.' : undefined}>
        {view.insights.length > 0 && (
          <div role="group" aria-label="Filter by severity" className="flex flex-wrap gap-2" data-severity-filter>
            <FilterButton label="All" count={view.insights.length} active={filter === 'all'} onClick={() => setFilter('all')} />
            {SEVERITY_ORDER.slice().reverse().map((s) => (
              <FilterButton key={s} label={SEVERITY_LABEL[s]} count={view.counts[s]} active={filter === s} onClick={() => setFilter(s)} />
            ))}
          </div>
        )}
        {view.insights.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-8 text-center" data-intelligence-state="empty">
            <p className="text-sm font-medium">{empty.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{empty.detail}</p>
          </div>
        ) : shown.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-filter-empty>No findings match this filter.</p>
        ) : (
          <ul className="space-y-3" data-findings>
            {shown.map((insight) => (
              <li key={insight.key}>
                <ExpandableFinding insight={insight} />
              </li>
            ))}
          </ul>
        )}
        <SuppressedLine snapshot={snapshot} />
      </Section>

      {def.domain !== 'other' && <CoverageBlock unit={view} id="coverage" />}

      {def.modules.length > 0 && (
        <Section title="Open in the module" id="modules">
          <div className="flex flex-wrap gap-2" data-module-links>
            {def.modules.map((m) => (
              <IntelLink key={m.href} to={m.href} className={LINK_BUTTON}>
                Open {m.label}
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </IntelLink>
            ))}
          </div>
        </Section>
      )}

      <BackLink to={domainHref(domain.id)}>Back to {domain.title}</BackLink>
    </div>
  )
}

function FilterButton({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-muted',
      )}
    >
      {label} <span className="tabular-nums">({count})</span>
    </button>
  )
}

function ExpandableFinding({ insight }: { insight: Insight }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const confidence = confidenceLabel(insight.confidence)
  const coverage = coverageText(insight.coverage)
  const link = safeDeepLink(insight.deep_link)
  return (
    <article className={cn(SURFACE, 'border-l-4', SEVERITY_EDGE[insight.severity])} data-finding={insight.key} data-severity={insight.severity}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 rounded-xl p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0 space-y-1">
          <span className="flex flex-wrap items-center gap-2">
            <SeverityChip severity={insight.severity} />
            <span className={cn(CHIP_BASE, confidenceChip(insight.confidence))} data-chip="confidence">{confidence.label}</span>
          </span>
          <span className="block text-sm font-semibold">{insight.title}</span>
          <span className="block text-sm text-muted-foreground">{insight.what_happened}</span>
        </span>
        <ChevronDown className={cn('mt-1 size-4 shrink-0 transition-transform motion-reduce:transition-none', open && 'rotate-180')} aria-hidden="true" />
      </button>
      <div id={panelId} hidden={!open} className="space-y-3 border-t border-border px-4 pb-4 pt-3 text-sm">
        <p><span className="font-medium">Why it matters: </span>{insight.why_it_matters}</p>
        {insight.evidence.length > 0 && <EvidenceList evidence={insight.evidence} fallbackLink={link} parts="measures" />}
        <p className="text-xs text-muted-foreground">{coverage.headline}{coverage.reason ? `. ${coverage.reason}` : ''} · {formatAsOf(insight.as_of)}</p>
        {insight.suggested_action && <p className="rounded-md border border-border bg-muted px-3 py-2"><span className="font-medium">What to do: </span>{insight.suggested_action}</p>}
        <div className="flex flex-wrap items-center gap-4">
          <IntelLink to={insightPageFor(insight)} className={LINK_CLASS}>
            Open the full finding
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </IntelLink>
          {link && <IntelLink to={link} className={LINK_CLASS}>{openLabel(link)}</IntelLink>}
        </div>
      </div>
    </article>
  )
}
