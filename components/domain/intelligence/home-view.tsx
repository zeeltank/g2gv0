'use client'

import { useMemo } from 'react'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Insight, InsightSeverity } from '@/services/intelligence/types'
import {
  areaHref,
  CONNECTED_VIEWS,
  CONNECTED_VIEWS_NOTE,
  domainHref,
  insightPageFor,
  type ChainStage,
} from '@/lib/intelligence-center/domains'
import {
  buildDomainViews,
  buildOverview,
  emptyText,
  isWithheld,
  CONDITION_LABEL,
  CONDITION_MEANING,
  topPriorities,
  type DomainView,
  type Snapshot,
} from '@/lib/intelligence-center/derive'
import { emptyVerdict, emptyWording, formatAsOf, openLabel, safeDeepLink, SEVERITY_LABEL, SEVERITY_ORDER } from '@/lib/intelligence-center/model'
import { CHIP_BASE, COVERAGE_CHIP, HEADER_BAND, LINK_CLASS, SEVERITY_EDGE, CONDITION_EDGE, SURFACE, SURFACE_LIFT } from '@/lib/intelligence-center/tones'
import { ConditionChip, Count, DomainIconTile, IntelLink, IntelligencePage, ProvisionalPill, RefreshBar, Section, SeverityChip, SuppressedLine } from './ui'

const HOME_CRUMBS = [{ label: 'Intelligence' }] as const

/** The central home: the organisation overview, one card per domain, the management priorities and the cross-domain views. */
export function IntelligenceHome() {
  return (
    <IntelligencePage crumbs={HOME_CRUMBS} page="home">
      {(snapshot) => <HomeContent snapshot={snapshot} />}
    </IntelligencePage>
  )
}

function HomeContent({ snapshot }: { snapshot: Snapshot }) {
  const views = useMemo(() => buildDomainViews(snapshot), [snapshot])
  const overview = useMemo(() => buildOverview(snapshot, views), [snapshot, views])
  const priorities = useMemo(() => topPriorities(snapshot, 6), [snapshot])
  const withheld = isWithheld(snapshot)
  const wording =
    withheld && snapshot.insights.length === 0
      ? { title: 'No findings shown', detail: 'Some results may be withheld or not loaded, so this is not an all-clear.' }
      : emptyWording(emptyVerdict(snapshot.detectors.map((d) => d.state)))

  return (
    <div className="space-y-6">
      <header className={cn(HEADER_BAND, 'flex flex-wrap items-start justify-between gap-4 p-5')}>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Intelligence</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            What needs attention across the organisation, what supports it, and how much data stands behind it. You see only what your role and rights allow.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <ProvisionalPill snapshot={snapshot} />
          <RefreshBar snapshot={snapshot} />
        </div>
      </header>

      <Section title="Organisation overview" id="overview">
        <div className={cn(SURFACE, 'space-y-4 p-4')} data-intelligence-state={overview.total === 0 ? 'empty' : 'ready'}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {SEVERITY_ORDER.slice().reverse().map((severity) => (
              <SeverityTile key={severity} severity={severity} value={overview.counts[severity]} />
            ))}
          </div>
          <SuppressedLine snapshot={snapshot} />

          <div className="grid gap-3 border-t border-border pt-4 md:grid-cols-2" data-overview-detail>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Domains</p>
              <div className="flex flex-wrap gap-x-5 gap-y-1" data-domain-tally>
                <Count value={overview.domainTally.needs_attention} label="need attention" />
                <Count value={overview.domainTally.watch} label="to watch" />
                <Count value={overview.domainTally.healthy} label="healthy" />
                <Count value={overview.domainTally.not_enough_data} label="not enough data" />
              </div>
              {(overview.domainTally.no_findings > 0 || overview.domainTally.not_available > 0 || overview.domainTally.not_connected > 0 || overview.domainTally.not_assessed > 0 || overview.domainTally.access_restricted > 0 || overview.domainTally.data_unavailable > 0) && (
                <p className="text-xs text-muted-foreground">
                  {[
                    overview.domainTally.no_findings > 0 && `${overview.domainTally.no_findings} with no findings shown (not an all-clear)`,
                    overview.domainTally.not_connected > 0 && `${overview.domainTally.not_connected} not connected yet`,
                    overview.domainTally.not_available > 0 && `${overview.domainTally.not_available} not available for your role`,
                    overview.domainTally.not_assessed > 0 && `${overview.domainTally.not_assessed} not yet assessed`,
                    overview.domainTally.access_restricted > 0 && `${overview.domainTally.access_restricted} access restricted`,
                    overview.domainTally.data_unavailable > 0 && `${overview.domainTally.data_unavailable} with data unavailable`,
                  ].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">How reliable is this picture</p>
              <p className="text-sm" data-confidence>{overview.confidence}</p>
              <p className="text-xs text-muted-foreground">{overview.coverage.headline}. Thresholds are provisional.</p>
            </div>
          </div>

          <details className="border-t border-border pt-3" data-clear-list>
            <summary className="flex cursor-pointer items-center gap-1.5 rounded-sm text-xs font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              Checked, nothing to flag ({overview.clear.length})
            </summary>
            {overview.clear.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {overview.clear.map((d) => (
                  <li key={d.detector} className={cn(CHIP_BASE, COVERAGE_CHIP.enough)}>{d.title}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                {withheld ? 'Nothing is listed here: some results may be withheld or not loaded, so no check can be called clear.' : 'No check has run with enough data and found nothing to flag.'}
              </p>
            )}
          </details>
        </div>
      </Section>

      <Section title="Management priorities" description="The most urgent open findings across every domain: critical first, then high priority, then newest." id="priorities">
        {priorities.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-8 text-center" data-priorities-empty>
            <p className="text-sm font-medium text-foreground">{wording.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{wording.detail}</p>
          </div>
        ) : (
          <ol className="grid gap-3 lg:grid-cols-2" data-priorities>
            {priorities.map(({ insight, placement }, index) => (
              <li key={insight.key}>
                <PriorityCard insight={insight} rank={index + 1} domainTitle={views.find((v) => v.domain.id === placement.domain)?.domain.title ?? 'Other findings'} to={insightPageFor(insight)} />
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="Domains" description="Each card shows the most urgent finding in plain language and where to go next." id="domains">
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-domain-cards>
          {views.map((view) => (
            <li key={view.domain.id}>
              <DomainCard view={view} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Related screens" description="Checks that are looked at together." id="connected">
        <div className="grid gap-4 lg:grid-cols-2" data-connected-views>
          {CONNECTED_VIEWS.map((chain) => (
            <div key={chain.id} className={cn(SURFACE, 'p-4')} data-chain={chain.id}>
              <h3 className="text-sm font-semibold">{chain.title}</h3>
              <ul className="mt-3 space-y-2">
                {chain.stages.map((stage) => (
                  <li key={stage.label}>
                    <StageRow stage={stage} views={views} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground" data-connected-note>{CONNECTED_VIEWS_NOTE}</p>
      </Section>
    </div>
  )
}

function SeverityTile({ severity, value }: { severity: InsightSeverity; value: number }) {
  return (
    <div className={cn('rounded-lg border border-border border-l-4 bg-card px-3 py-2', SEVERITY_EDGE[severity])} data-summary={severity}>
      <p className="text-xs font-medium text-muted-foreground">{SEVERITY_LABEL[severity]}</p>
      <p className="text-2xl font-semibold tabular-nums">{value.toLocaleString('en-GB')}</p>
    </div>
  )
}

function DomainCard({ view }: { view: DomainView }) {
  const { domain, condition, top, nextAction } = view
  const empty = emptyText(view, domain.id === 'other')
  const sentence =
    condition === 'healthy'
      ? 'Checked, nothing to flag.'
      : condition === 'no_findings'
        ? `${empty.title}. ${empty.detail}`
        : condition === 'not_connected' && domain.id !== 'other'
          ? 'No intelligence source is connected to this area yet.'
          : condition === 'not_available'
            ? 'Not available for your role.'
            : empty.detail
  return (
    <article
      className={cn(SURFACE, SURFACE_LIFT, 'relative flex h-full flex-col gap-3 border-l-4 p-4', CONDITION_EDGE[condition])}
      data-domain-card={domain.id}
      data-condition={condition}
    >
      <div className="flex items-start gap-3">
        <DomainIconTile icon={domain.icon} accent={domain.accent} />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-snug">{domain.title}</h3>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground" title={domain.monitors}>{domain.monitors}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ConditionChip condition={condition} />
        {view.coverage.checks > 0 && <span className={cn(CHIP_BASE, COVERAGE_CHIP.enough)} data-chip="coverage">{view.coverage.headline}</span>}
      </div>

      <div className="flex-1 space-y-2 text-sm">
        {top ? (
          <>
            <p className="font-medium" data-top-finding>{top.title}</p>
            <p className="line-clamp-3 text-muted-foreground"><span className="font-medium text-foreground">Why it matters: </span>{top.why_it_matters}</p>
            {nextAction && <p className="line-clamp-2"><span className="font-medium">Next: </span>{nextAction.text}</p>}
          </>
        ) : (
          <p className="text-muted-foreground">{sentence}</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className="text-sm tabular-nums" data-attention-count>
          {['not_connected', 'not_available', 'not_assessed', 'access_restricted', 'data_unavailable', 'excluded', 'partial'].includes(condition) ? CONDITION_LABEL[condition] : `${view.attention} need${view.attention === 1 ? 's' : ''} attention`}
        </span>
        <IntelLink to={domainHref(domain.id)} className={cn(LINK_CLASS, 'after:absolute after:inset-0 after:rounded-xl')} aria-label={`Open ${domain.title}`}>
          Open
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </IntelLink>
      </div>
    </article>
  )
}

function PriorityCard({ insight, rank, domainTitle, to }: { insight: Insight; rank: number; domainTitle: string; to: string }) {
  const link = safeDeepLink(insight.deep_link)
  return (
    <article
      className={cn(SURFACE, 'flex h-full flex-col gap-2 border-l-4 p-4', SEVERITY_EDGE[insight.severity])}
      data-priority={insight.key}
      data-severity={insight.severity}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs tabular-nums text-muted-foreground" aria-label={`Priority ${rank}`}>#{rank}</span>
        <SeverityChip severity={insight.severity} />
        <span className={cn(CHIP_BASE, 'border-border bg-muted text-muted-foreground')} data-chip="domain">{domainTitle}</span>
      </div>
      <h3 className="text-sm font-semibold leading-snug">
        <IntelLink to={to} className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{insight.title}</IntelLink>
      </h3>
      <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">{insight.why_it_matters}</p>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="text-xs text-muted-foreground">{formatAsOf(insight.as_of)}</span>
        <span className="flex flex-wrap items-center gap-3">
          {link && (
            <IntelLink to={link} className={LINK_CLASS}>
              {openLabel(link)}
            </IntelLink>
          )}
        </span>
      </div>
    </article>
  )
}

function StageRow({ stage, views }: { stage: ChainStage; views: DomainView[] }) {
  const domainView = views.find((v) => v.domain.id === stage.domain)
  const unit = stage.area ? domainView?.areas.find((a) => a.area.id === stage.area) : domainView
  const to = stage.area ? areaHref(stage.domain, stage.area) : domainHref(stage.domain)
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-1.5" data-stage={stage.label}>
      <IntelLink to={to} className={LINK_CLASS}>{stage.label}</IntelLink>
      {unit ? <ConditionChip condition={unit.condition} /> : <span className={cn(CHIP_BASE, 'border-border bg-muted text-muted-foreground')}>Data unavailable</span>}
    </div>
  )
}
