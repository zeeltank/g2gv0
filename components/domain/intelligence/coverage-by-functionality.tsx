'use client'

import { useId, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AVAILABILITY } from '@/lib/intelligence-center/availability'
import { displayState, registryRows, reportedUnder, summarise, type RegistryState } from '@/lib/intelligence-center/coverage-registry'
import { DETECTOR_TITLE } from '@/lib/intelligence-center/domains'
import { LINK_CLASS, SURFACE } from '@/lib/intelligence-center/tones'
import { ConditionChip, ScreenLink, Section } from './ui'

type Filter = RegistryState | 'all'

const FILTER_LABEL: Record<Filter, string> = {
  all: 'All',
  partial: 'Partially covered',
  not_assessed: 'Not yet assessed',
  excluded: 'Excluded',
}

/**
 * "Coverage by functionality": the ONE section every module page renders. Every functionality of the module is listed with its availability state in the
 * standard wording, so none is silently absent; a functionality with no verified screen is shown without a link (see ScreenLink), and an excluded one never has
 * a link, a metric or a summary. The state filter narrows the list; "All" is the default and every row exists in the page either way.
 */
export function CoverageByFunctionality({ moduleKey, reported }: { moduleKey: string; reported: ReadonlySet<string> }) {
  const rows = registryRows(moduleKey)
  const shown = rows.map((row) => ({ row, state: displayState(row, reported) }))
  const summary = summarise(shown.map(({ row, state }) => ({ ...row, state })))
  const total = summary.total
  const [filter, setFilter] = useState<Filter>('all')
  const listId = useId()
  const visible = filter === 'all' ? shown : shown.filter((entry) => entry.state === filter)
  const options = (['all', 'partial', 'not_assessed', 'excluded'] as const).filter((option) => option === 'all' || (option === 'partial' ? summary.partial : option === 'not_assessed' ? summary.not_assessed : summary.excluded) > 0)

  return (
    <Section
      title="Coverage by functionality"
      description="Every functionality of this module is listed, so none is silently absent. Nothing is inferred for a functionality that no check assesses."
      id="module-coverage-registry"
    >
      <details className={cn(SURFACE, 'group')} data-coverage-registry data-registry-total={total} data-registry-partial={summary.partial} data-registry-not-assessed={summary.not_assessed} data-registry-excluded={summary.excluded}>
        <summary className="cursor-pointer list-none rounded-xl p-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="font-medium">{total} {total === 1 ? 'functionality' : 'functionalities'}</span>
          <span className="text-muted-foreground"> · {summary.partial} partially covered · {summary.not_assessed} not yet assessed{summary.excluded > 0 ? ` · ${summary.excluded} excluded` : ''}. Show the list.</span>
        </summary>
        <div className="space-y-3 border-t border-border p-4">
          {options.length > 2 && (
            <div role="group" aria-label="Filter functionality by coverage" aria-controls={listId} className="flex flex-wrap gap-2" data-registry-filter>
              {options.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={filter === option}
                  onClick={() => setFilter(option)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                    filter === option ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-border bg-card text-foreground hover:bg-muted',
                  )}
                >
                  {FILTER_LABEL[option]} <span className="tabular-nums">({option === 'all' ? total : summary[option]})</span>
                </button>
              ))}
            </div>
          )}
          <ul id={listId} className="grid gap-2 sm:grid-cols-2" data-registry-list>
            {visible.map(({ row: r, state }) => {
              const elsewhere = state === 'partial' ? reportedUnder(r) : []
              return (
                <li key={r.id} className="space-y-1 rounded-lg border border-dashed border-border bg-card p-3" data-registry-row={r.id} data-registry-state={state}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium"><span className="text-muted-foreground">{r.id}</span> {r.name}</p>
                    <ConditionChip condition={state} />
                  </div>
                  {state === 'excluded' && <p className="text-xs text-muted-foreground">{AVAILABILITY.excluded.meaning}</p>}
                  {state === 'not_assessed' && <p className="text-xs text-muted-foreground">{AVAILABILITY.not_assessed.meaning}</p>}
                  {state === 'partial' && <p className="text-xs text-muted-foreground">Assessed in part by: {r.detectors.map((id) => DETECTOR_TITLE[id] ?? id).join(', ')}.{elsewhere.length > 0 ? ` Reported under ${elsewhere.join(', ')}.` : ''}</p>}
                  {state !== 'excluded' && (
                    <ScreenLink route={r.route} className={LINK_CLASS}>Open the screen <ArrowRight className="size-3.5" aria-hidden="true" /></ScreenLink>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </details>
    </Section>
  )
}
