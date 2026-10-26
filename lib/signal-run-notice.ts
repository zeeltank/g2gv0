import type { ResearchRun } from '@/services/signals/opportunities'

export type RunNotice = { tone: 'error' | 'info' | 'warning' | 'success'; text: string; missing?: string[]; nextStep?: string | null }

/**
 * What a finished run honestly says, from the run row the backend holds (never from invented results).
 *
 * - A failed or skipped run is an error, never a "zero results" success.
 * - "Sources" are search results; "pages read" are the ones whose content was really retrieved. They are different numbers and are never merged.
 * - When the run kept no stage breakdown (an older run, or the column is not migrated) the text says the breakdown is unavailable. It does not
 *   print zeros, because unavailable and zero are different facts.
 */
export function describeFinishedRun(run: ResearchRun): RunNotice {
  if (run.status === 'failed' || run.status === 'skipped') {
    return { tone: 'error', text: run.error_message ?? run.stage_message ?? 'The run did not complete.' }
  }
  const stats = run.stage_stats ?? null
  const breakdown = stats
    ? ` ${stats.queries.succeeded} of ${stats.queries.attempted} searches worked${stats.queries.with_results !== null && stats.queries.empty !== null ? ` (${stats.queries.with_results} with results, ${stats.queries.empty} empty)` : ''}${stats.queries.cache_hits > 0 ? `, ${stats.queries.cache_hits} reused from the cache` : ''}, ${stats.results.returned} results, ${stats.pages.fetched} pages read in full.`
    : ' The stage-by-stage breakdown is not available for this run.'
  const registry = stats?.registry
    ? ` ${stats.registry.searched} of ${stats.registry.selected} chosen registry sources were searched (searching does not verify a source).`
    : ''
  const direct = stats?.direct && stats.direct.sources_selected > 0
    ? ` ${stats.direct.items_read} new item${stats.direct.items_read === 1 ? '' : 's'} read directly from ${stats.direct.sources_selected} verified source${stats.direct.sources_selected === 1 ? '' : 's'}.`
    : ''
  const named = stats?.name_search && stats.name_search.schools_selected > 0
    ? ` ${stats.name_search.schools_selected} school${stats.name_search.schools_selected === 1 ? '' : 's'} without a verified website ${stats.name_search.schools_selected === 1 ? 'was' : 'were'} searched by name.`
    : ''

  if (run.status === 'partial') {
    return {
      tone: 'warning',
      text: `Finished with limits: ${run.stage_message ?? 'some searches or sources could not be read.'} ${run.opportunities_qualified} qualified (${run.opportunities_new} new).${breakdown}${registry}${direct}${named}`,
      nextStep: stats?.next_action ?? null,
    }
  }
  if (run.opportunities_qualified === 0) {
    // The run's own reasons, biggest first, only when the backend recorded them.
    const why = stats?.zero_reasons?.slice(0, 3).map((r) => `${r.label} (${r.count})`).join(' ') ?? ''

    return {
      tone: 'info',
      text: `Finished: ${run.sources_found} sources found, but no opportunity had enough evidence to qualify.${breakdown}${registry}${direct}${named}${why ? ` Why: ${why}` : ''}`,
      nextStep: stats?.next_action ?? null,
    }
  }

  return {
    tone: 'success',
    text: `Finished: ${run.opportunities_qualified} qualified (${run.opportunities_new} new${stats ? `, ${stats.outcome.updated} updated, ${stats.outcome.unchanged_existing} unchanged` : ''}) from ${run.sources_found} sources.${registry}${direct}${named}`,
  }
}

/** The label a saved signal carries under the research date it is listed on: found by that day's run, or only seen again by it. */
export function discoveryLabel(discoveredOnReportDate: boolean | null | undefined, runDateLabel?: string | null): string | null {
  if (discoveredOnReportDate === true) return runDateLabel ? `New in the ${runDateLabel} run` : 'New in this run'
  if (discoveredOnReportDate === false) return runDateLabel ? `Earlier signal, seen again in the ${runDateLabel} run` : 'Earlier signal, seen again'
  return runDateLabel ? `Found in the ${runDateLabel} run` : null
}
