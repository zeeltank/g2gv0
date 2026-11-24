'use client'

import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UnitView } from '@/lib/intelligence-center/derive'
import { coverageText, formatAsOf, normalizeState, sortDetectors, stateLabel } from '@/lib/intelligence-center/model'
import { CHIP_BASE, STATE_CHIP, SURFACE } from '@/lib/intelligence-center/tones'
import { Section } from './ui'

/**
 * Evidence & coverage for one domain or area: every check that feeds it and this person may see, whether it could assess, the server's own reason when it
 * could not, and how much data stands behind it. A check that could not assess is listed FIRST. Checks this person may not see are named, not hidden.
 */
export const TRENDS_STATEMENT = 'Trends: not available yet. Trend lines need stored history, and that history does not exist.'
export const OPPORTUNITIES_STATEMENT = 'The current checks look for things that need attention; they do not look for opportunities.'

export function CoverageBlock({ unit, id, showTrends = false }: { unit: Pick<UnitView, 'detectors' | 'coverage' | 'unavailable'>; id: string; showTrends?: boolean }) {
  const { detectors, coverage, unavailable } = unit
  // Progressive disclosure: the checks behind a picture open on click, but a gap (a check that could not assess) is open from the start so it is never hidden.
  const hasGap = detectors.some((d) => d.state !== 'ok' && d.state !== 'not_applicable')
  return (
    <Section title="Evidence & coverage" description={detectors.length > 0 ? `${coverage.headline}.` : undefined} id={id}>
      <details className={cn(SURFACE, 'group')} open={hasGap || detectors.length === 0} data-coverage-details>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span>{detectors.length > 0 ? `The ${detectors.length} ${detectors.length === 1 ? 'check' : 'checks'} behind this` : 'No check is open to your role'}</span>
        <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
      </summary>
      <div className="space-y-3 border-t border-border p-4" data-coverage-block>
        {coverage.items.length > 1 && (
          <p className="text-xs text-muted-foreground" data-coverage-basis>
            Based on {coverage.items.length} checks, each with its own basis. Their figures are shown separately and are not added together.
          </p>
        )}
        {detectors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No check for this is open to your role, so there is nothing to report on its coverage.</p>
        ) : (
          <ul className="divide-y divide-border">
            {sortDetectors(detectors).map((d) => {
              const text = d.coverage ? coverageText(d.coverage) : null
              return (
                <li key={d.detector} className="space-y-1 py-2 first:pt-0 last:pb-0" data-detector={d.detector}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn(CHIP_BASE, STATE_CHIP[normalizeState(d.state)])} data-chip="state" data-state={normalizeState(d.state)}>{stateLabel(d.state)}</span>
                    <span className="text-sm font-medium">{d.title}</span>
                  </div>
                  {text && <p className="text-sm">{text.headline}</p>}
                  {d.reason && <p className="text-sm text-muted-foreground">{d.reason}</p>}
                  <p className="text-xs text-muted-foreground">
                    {d.state === 'ok' ? `${d.insight_count} open ${d.insight_count === 1 ? 'finding' : 'findings'} · ` : ''}
                    {formatAsOf(d.as_of)}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
        {unavailable.length > 0 && (
          <p className="text-xs text-muted-foreground" data-unavailable>
            No result from these checks (not available to your role, or did not run): {unavailable.join(', ')}.
          </p>
        )}
        <p className="text-xs text-muted-foreground" data-opportunities-note>{OPPORTUNITIES_STATEMENT}</p>
        {showTrends && <p className="text-xs text-muted-foreground" data-trends>{TRENDS_STATEMENT}</p>}
      </div>
      </details>
    </Section>
  )
}
