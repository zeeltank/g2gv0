'use client'

import { useMemo } from 'react'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildModuleView, emptyText, type AreaView, type Snapshot } from '@/lib/intelligence-center/derive'
import { MODULE_INTELLIGENCE, moduleIntelligenceByKey } from '@/lib/intelligence-center/modules'
import { registryRows, summarise } from '@/lib/intelligence-center/coverage-registry'
import { HOME_HREF } from '@/lib/intelligence-center/domains'
import { confidenceLabel, coverageText, formatAsOf, openLabel, safeDeepLink } from '@/lib/intelligence-center/model'
import { CHIP_BASE, CONDITION_EDGE, COVERAGE_CHIP, HEADER_BAND, KICKER, LINK_BUTTON, LINK_CLASS, SEVERITY_EDGE, SURFACE, SURFACE_LIFT } from '@/lib/intelligence-center/tones'
import { CoverageBlock } from './coverage-block'
import { CoverageByFunctionality } from './coverage-by-functionality'
import { ConditionChip, DomainIconTile, IntelLink, IntelligencePage, NotFoundState, ProvisionalPill, RefreshBar, Section, SeverityChip, SuppressedLine } from './ui'
import { EvidenceList } from './evidence'

export function ModuleIntelligencePage({ moduleKey }: { moduleKey: string }) {
  const moduleDef = moduleIntelligenceByKey(moduleKey)
  // Module context only: no link back to Global Intelligence (the two levels are never mixed).
  const crumbs = moduleDef ? [{ label: moduleDef.title }, { label: 'Intelligence' }] : [{ label: 'Intelligence', to: HOME_HREF }, { label: 'Not found' }]

  return (
    <IntelligencePage crumbs={crumbs} page="module">
      {(snapshot) => moduleDef ? (
        <ModuleContent snapshot={snapshot} moduleKey={moduleDef.key} />
      ) : (
        <NotFoundState title="That module Intelligence page does not exist" detail="The module may not be enabled for Intelligence." backTo={HOME_HREF} backLabel="Back to Global Intelligence" />
      )}
    </IntelligencePage>
  )
}

function ModuleContent({ snapshot, moduleKey }: { snapshot: Snapshot; moduleKey: ModuleIntelligenceDefKey }) {
  const definition = moduleIntelligenceByKey(moduleKey)
  const view = useMemo(() => definition ? buildModuleView(snapshot, definition) : null, [snapshot, definition])
  if (!definition || !view) return null

  const top = view.insights.slice(0, 5)
  const summary = summarise(registryRows(definition.key))
  const reported = new Set(snapshot.detectors.map((detector) => detector.detector))
  const notCovered = summary.not_assessed + summary.excluded
  const screens = view.areas.flatMap((area) => area.area.modules).filter((link, index, links) => links.findIndex((other) => other.href === link.href) === index)

  return (
    <div className="space-y-6">
      <header className={cn(HEADER_BAND, 'flex flex-wrap items-start justify-between gap-4 p-5')}>
        <div className="flex min-w-0 items-start gap-3">
          <DomainIconTile icon="layers" accent="indigo" size="lg" />
          <div className="min-w-0">
            <p className={KICKER}>Module Intelligence</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{definition.title} Intelligence</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{definition.monitors}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <ConditionChip condition={view.condition} />
              <span className={cn(CHIP_BASE, view.coverage.enough === view.coverage.checks && view.coverage.checks > 0 && notCovered === 0 ? COVERAGE_CHIP.enough : COVERAGE_CHIP.thin)} data-module-coverage-summary>
                {view.coverage.checks > 0 ? `${view.coverage.headline} in connected checks` : 'No connected checks'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <ProvisionalPill snapshot={snapshot} />
          <RefreshBar snapshot={snapshot} />
        </div>
      </header>

      <Section title="Module-wide summary" description="Every detector-backed submodule below is combined here. No score and no cause is inferred." id="module-summary">
        <div className="grid gap-3 md:grid-cols-3" data-module-summary>
          <SummaryCard title="What is happening">
            {top.length > 0 ? (
              <p>Showing the {top.length} most urgent of {view.insights.length} loaded findings. {view.counts.critical} critical and {view.counts.high} high-priority findings are loaded.</p>
            ) : (
              <p>{emptyText(view).title}. {emptyText(view).detail}</p>
            )}
          </SummaryCard>
          <SummaryCard title="What it means">
            <p>{view.condition === 'needs_attention' ? 'At least one high-priority or critical finding needs review.' : view.condition === 'watch' ? 'Findings are open, but none is high priority or critical.' : 'No risk rating is inferred from missing or incomplete checks.'}</p>
            {view.note && <p className="mt-1 text-muted-foreground">{view.note}</p>}
            {view.gapReason && <p className="mt-1 text-muted-foreground">{view.gapReason}</p>}
          </SummaryCard>
          <SummaryCard title="Why it matters">
            <p>{top[0]?.why_it_matters ?? 'No evidence-backed impact statement is available until a connected check produces a finding.'}</p>
            {view.coverage.errored > 0 && <p className="mt-1 text-muted-foreground">{view.coverage.errored} check(s) could not run; this is not a zero-record result.</p>}
          </SummaryCard>
        </div>
      </Section>

      {top.length > 0 && (
        <Section title="Management priorities" description="The most urgent findings. Open a submodule below for the evidence." id="module-priorities">
          <ol className="grid gap-3 lg:grid-cols-2">
            {top.map((insight) => {
              const actionLink = safeDeepLink(insight.deep_link)
              return (
                <li key={insight.key}>
                  <article className={cn(SURFACE, SURFACE_LIFT, 'flex h-full flex-col gap-2 border-l-4 p-4', SEVERITY_EDGE[insight.severity])} data-module-priority={insight.key}>
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityChip severity={insight.severity} />
                      <span className={cn(CHIP_BASE, 'border-border bg-muted text-muted-foreground')}>{confidenceLabel(insight.confidence).label}</span>
                    </div>
                    <h3 className="text-sm font-semibold leading-snug">{insight.title}</h3>
                    <p className="text-sm text-muted-foreground">{insight.what_happened}</p>
                    <p className="text-sm"><span className="font-medium">Why it matters: </span>{insight.why_it_matters}</p>
                    {insight.suggested_action && <p className="text-sm"><span className="font-medium">Next: </span>{insight.suggested_action}</p>}
                    <p className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
                      <span>{formatAsOf(insight.as_of)}</span>
                      {actionLink && <IntelLink to={actionLink} className={LINK_CLASS}>{openLabel(actionLink)} <ArrowRight className="size-3.5" aria-hidden="true" /></IntelLink>}
                    </p>
                  </article>
                </li>
              )
            })}
          </ol>
        </Section>
      )}

      {view.areas.length > 0 && <Section title="Submodule Intelligence" description="Open a submodule to see its findings, evidence, data coverage and available actions in this module context." id="submodules">
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {view.areas.map((area) => <li key={`${area.area.domain}/${area.area.id}`}><SubmoduleCard area={area} /></li>)}
        </ul>
      </Section>}

      <CoverageByFunctionality moduleKey={definition.key} reported={reported} />

      {view.areas.length > 0 && <CoverageBlock unit={view} id="module-coverage" showTrends />}
      <SuppressedLine snapshot={snapshot} />

      {screens.length > 0 && (
        <Section title="Module screens" description="Open an existing screen to review or act on its records." id="module-screens">
          <div className="flex flex-wrap gap-2">
            {screens.map((link) => (
              <IntelLink key={link.href} to={link.href} className={LINK_BUTTON}>Open {link.label} <ArrowRight className="size-3.5" aria-hidden="true" /></IntelLink>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

type ModuleIntelligenceDefKey = (typeof MODULE_INTELLIGENCE)[number]['key']

function SummaryCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className={cn(SURFACE, 'p-4')}><h3 className="text-sm font-semibold">{title}</h3><div className="mt-2 text-sm">{children}</div></div>
}

function SubmoduleCard({ area }: { area: AreaView }) {
  const empty = emptyText(area)
  return (
    <details className={cn(SURFACE, SURFACE_LIFT, 'group h-full overflow-hidden border-l-4', CONDITION_EDGE[area.condition])} data-submodule={area.area.id} data-condition={area.condition}>
      <summary className="cursor-pointer list-none p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold">{area.area.title}</span>
          <ConditionChip condition={area.condition} />
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">{area.area.monitors}</span>
        <span className="mt-2 block text-sm">{area.top ? area.top.title : `${empty.title}. ${empty.detail}`}</span>
        <span className="mt-2 flex items-center justify-between border-t border-border pt-2 text-xs text-muted-foreground">
          <span>{area.coverage.headline}</span>          <span>{area.insights.length} loaded finding(s)</span>
        </span>
      </summary>
      <div className="space-y-3 border-t border-border p-4" data-submodule-detail>
        {area.insights.length > 0 ? area.insights.map((insight) => {
          const link = safeDeepLink(insight.deep_link)
          return (
            <article key={insight.key} className="space-y-2 border-b border-border pb-3 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2"><SeverityChip severity={insight.severity} /><span className={cn(CHIP_BASE, 'border-border bg-muted text-muted-foreground')}>{confidenceLabel(insight.confidence).label}</span></div>
              <h3 className="text-sm font-semibold">{insight.title}</h3>
              <p className="text-sm">{insight.what_happened}</p>
              <p className="text-sm text-muted-foreground">{insight.why_it_matters}</p>
              {insight.evidence.length > 0 && <EvidenceList evidence={insight.evidence} fallbackLink={link} />}
              <p className="text-xs text-muted-foreground">{coverageText(insight.coverage).headline}{insight.coverage.reason ? `. ${insight.coverage.reason}` : ''} · {formatAsOf(insight.as_of)}</p>
              {insight.suggested_action && <p className="text-sm"><span className="font-medium">Next action: </span>{insight.suggested_action}</p>}
              {link && <IntelLink to={link} className={LINK_CLASS}>{openLabel(link)} <ArrowRight className="size-3.5" aria-hidden="true" /></IntelLink>}
            </article>
          )
        }) : (
          <p className="text-sm text-muted-foreground">{empty.detail}</p>
        )}
        {area.area.modules.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            {area.area.modules.map((link) => <IntelLink key={link.href} to={link.href} className={LINK_CLASS}>Open {link.label} <ArrowRight className="size-3.5" aria-hidden="true" /></IntelLink>)}
          </div>
        )}
      </div>
    </details>
  )
}
