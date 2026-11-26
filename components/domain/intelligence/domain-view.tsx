'use client'

import { useMemo } from 'react'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { areaHref, CROSS_DOMAIN_ID, domainById, HOME_HREF, insightPageFor } from '@/lib/intelligence-center/domains'
import { AVAILABILITY } from '@/lib/intelligence-center/availability'
import { buildDomainView, CONDITION_LABEL, CONDITION_MEANING, emptyText, narrativeOf, recommendedActions, type AreaView, type DomainView, type Snapshot } from '@/lib/intelligence-center/derive'
import { CHIP_BASE, COVERAGE_CHIP, CONDITION_EDGE, HEADER_BAND, LINK_BUTTON, LINK_CLASS, SURFACE, SURFACE_LIFT } from '@/lib/intelligence-center/tones'
import { CoverageBlock } from './coverage-block'
import { CrossPage } from './cross-view'
import { AvailabilityPanel, BackLink, ConditionChip, Count, DomainIconTile, IntelLink, IntelligencePage, NotFoundState, ProvisionalPill, RefreshBar, Section, SuppressedLine } from './ui'

/** One domain: what is happening, what it means, why it matters, its areas, the evidence behind it, what to do, and where to open the module. */
export function DomainPage({ domainId }: { domainId: string }) {
  if (domainId === CROSS_DOMAIN_ID) return <CrossPage />
  const domain = domainById(domainId)
  const crumbs = [{ label: 'Intelligence', to: HOME_HREF }, { label: domain?.title ?? 'Not found' }]
  return (
    <IntelligencePage crumbs={crumbs} page="domain">
      {(snapshot) =>
        domain ? (
          <DomainContent snapshot={snapshot} domainId={domain.id} />
        ) : (
          <NotFoundState title="That area of Intelligence does not exist" detail="The address may be out of date or mistyped." backTo={HOME_HREF} backLabel="Back to Intelligence" />
        )
      }
    </IntelligencePage>
  )
}

function DomainContent({ snapshot, domainId }: { snapshot: Snapshot; domainId: string }) {
  const def = domainById(domainId)
  const view = useMemo(() => (def ? buildDomainView(snapshot, def) : null), [snapshot, def])
  if (!def || !view) return null
  const narrative = narrativeOf(view)
  const actions = recommendedActions(view.insights)
  const otherEmpty = def.id === 'other' && view.insights.length === 0
  const notOpen = otherEmpty || NO_FINDINGS_CONDITIONS.includes(view.condition)
  const byKey = new Map(view.insights.map((i) => [i.key, i]))

  return (
    <div className="space-y-6">
      <header className={cn(HEADER_BAND, 'flex flex-wrap items-start justify-between gap-4 p-5')}>
        <div className="flex min-w-0 items-start gap-3">
          <DomainIconTile icon={def.icon} accent={def.accent} size="lg" />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{def.title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{def.monitors}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {!otherEmpty && <ConditionChip condition={view.condition} />}
              {view.coverage.checks > 0 && <span className={cn(CHIP_BASE, COVERAGE_CHIP.enough)} data-chip="coverage">{view.coverage.headline}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <ProvisionalPill snapshot={snapshot} />
          <RefreshBar snapshot={snapshot} />
        </div>
      </header>

      {otherEmpty && (
        <div className={cn(SURFACE, 'p-4')} data-intelligence-state="empty">
          <p className="text-sm font-medium">Nothing here</p>
          <p className="mt-1 text-sm text-muted-foreground">No finding is waiting in this bucket.</p>
        </div>
      )}
      {view.condition === 'not_connected' && !otherEmpty && <NotConnected view={view} />}
      {(view.condition === 'not_assessed' || view.condition === 'access_restricted' || view.condition === 'data_unavailable') && (
        <AvailabilityPanel state={view.condition} detail={CONDITION_MEANING[view.condition]}>
          {view.condition === 'not_assessed' && view.domain.covers.length > 0 && (
            <ul className="flex flex-wrap gap-2" data-covers>
              {view.domain.covers.map((m) => (
                <li key={m.href}><IntelLink to={m.href} className={LINK_BUTTON}>Open {m.label}<ArrowRight className="size-3.5" aria-hidden="true" /></IntelLink></li>
              ))}
            </ul>
          )}
        </AvailabilityPanel>
      )}
      {view.condition === 'not_available' && (
        <div className={cn(SURFACE, 'p-4')} data-intelligence-state="not-available">
          <p className="text-sm font-medium">Not available for your role</p>
          <p className="mt-1 text-sm text-muted-foreground">{CONDITION_MEANING.not_available} This is different from nothing being wrong: these checks are simply not part of what your role can see.</p>
        </div>
      )}

      {!notOpen && (
        <Section title="Summary" id="summary">
          <div className="grid gap-3 md:grid-cols-3" data-summary-blocks>
            <div className={cn(SURFACE, 'p-4')}>
              <h3 className="text-sm font-semibold">What is happening</h3>
              {narrative.happening.length > 0 ? (
                <ul className="mt-2 space-y-2 text-sm">
                  {narrative.happening.map((line) => {
                    const insight = byKey.get(line.key)
                    return (
                      <li key={line.key}>
                        <IntelLink to={insight ? insightPageFor(insight) : null} className="font-medium underline-offset-4 hover:underline">{line.title}</IntelLink>
                        <span className="block text-muted-foreground">{line.text}</span>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No findings are open here.</p>
              )}
            </div>
            <div className={cn(SURFACE, 'p-4')}>
              <h3 className="text-sm font-semibold">What it means</h3>
              <p className="mt-2 text-sm">{narrative.means}</p>
              <p className="mt-1 text-sm text-muted-foreground">{CONDITION_MEANING[view.condition]}</p>
              {view.gapReason && <p className="mt-1 text-sm text-muted-foreground">{view.gapReason}</p>}
              {view.note && <p className="mt-1 text-sm text-muted-foreground" data-note>{view.note}</p>}
            </div>
            <div className={cn(SURFACE, 'p-4')}>
              <h3 className="text-sm font-semibold">Why it matters</h3>
              {narrative.why.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {narrative.why.map((line) => <li key={line.key}>{line.text}</li>)}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Nothing to explain while no finding is open.</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <Count value={view.counts.critical} label="critical" />
            <Count value={view.counts.high} label="high priority" />
            <Count value={view.counts.attention} label="need a look" />
            <Count value={view.counts.info} label="for information" />
          </div>
          <SuppressedLine snapshot={snapshot} />
        </Section>
      )}

      {def.areas.length > 0 && !otherEmpty && (
        <Section title="Areas" id="areas">
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-area-cards>
            {view.areas.map((area) => (
              <li key={area.area.id}>
                <AreaCard area={area} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!def.notConnected && !otherEmpty && view.condition !== 'not_assessed' && <CoverageBlock unit={view} id="coverage" showTrends />}

      {actions.length > 0 && (
        <Section title="Recommended actions" id="actions">
          <ul className={cn(SURFACE, 'divide-y divide-border')} data-actions>
            {actions.map(({ text, insight }) => (
              <li key={`${insight.key}-${text}`} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1">{text}</span>
                <IntelLink to={insightPageFor(insight)} className={LINK_CLASS}>
                  See the finding
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </IntelLink>
              </li>
            ))}
          </ul>
        </Section>
      )}

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

      <BackLink to={HOME_HREF}>Back to Intelligence</BackLink>
    </div>
  )
}

/** Conditions in which the findings summary is not shown (there is nothing assessed to summarise). */
const NO_FINDINGS_CONDITIONS: readonly string[] = ['not_connected', 'not_available', 'not_assessed', 'access_restricted', 'data_unavailable']

function NotConnected({ view }: { view: DomainView }) {
  return (
    <AvailabilityPanel state="not_connected" detail="Nothing here is being checked, so nothing is reported: that is not the same as everything being fine. This is what it covers, with a link to each screen.">
      <ul className="flex flex-wrap gap-2" data-covers>
        {view.domain.covers.map((m) => (
          <li key={m.href}>
            <IntelLink to={m.href} className={LINK_BUTTON}>
              Open {m.label}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </IntelLink>
          </li>
        ))}
      </ul>
    </AvailabilityPanel>
  )
}

function areaEmptyLine(area: AreaView): string {
  const empty = emptyText(area, area.area.domain === 'other')
  if (area.condition === 'healthy') return `${empty.title}.`
  if (area.condition === 'no_findings') return `${empty.title}. ${empty.detail}`
  return empty.detail
}

function AreaCard({ area }: { area: AreaView }) {
  return (
    <article className={cn(SURFACE, SURFACE_LIFT, 'relative flex h-full flex-col gap-2 border-l-4 p-4', CONDITION_EDGE[area.condition])} data-area-card={area.area.id} data-condition={area.condition}>
      <h3 className="text-sm font-semibold">{area.area.title}</h3>
      <p className="text-xs text-muted-foreground">{area.area.monitors}</p>
      <div className="flex flex-wrap items-center gap-2">
        <ConditionChip condition={area.condition} />
        {area.coverage.checks > 0 && <span className={cn(CHIP_BASE, COVERAGE_CHIP.enough)}>{area.coverage.headline}</span>}
      </div>
      <p className="flex-1 text-sm">
        {area.top ? <span data-top-finding>{area.top.title}</span> : <span className="text-muted-foreground">{areaEmptyLine(area)}</span>}
      </p>
      <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
        <span className="text-sm tabular-nums">{area.attention} need{area.attention === 1 ? 's' : ''} attention</span>
        <IntelLink to={areaHref(area.area.domain, area.area.id)} className={cn(LINK_CLASS, 'after:absolute after:inset-0 after:rounded-xl')} aria-label={`Open ${area.area.title}`}>
          Open
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </IntelLink>
      </div>
    </article>
  )
}
