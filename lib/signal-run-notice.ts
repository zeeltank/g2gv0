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
/**
 * Why there is no stage-by-stage breakdown, said honestly: when the backend reports it cannot store one, that is a missing migration (a person
 * with database access must apply it); otherwise the run is older than breakdowns. The few counters the run row does hold are shown as exactly
 * that, and the reasons for failures are said NOT to have been recorded.
 */
export function missingBreakdown(run: ResearchRun): string {
  const counters = ` Only these counters were recorded: ${run.queries_run} search${run.queries_run === 1 ? '' : 'es'} (${run.queries_failed} failed), ${run.sources_found} source${run.sources_found === 1 ? '' : 's'} found. Why a search failed, and why a candidate was left out, was not recorded.`
  if (run.stage_stats_persisted === false) {
    return ` The stage-by-stage breakdown could not be saved: this database does not have the stage_stats column yet. An administrator must apply the pending migration (add_stage_stats_to_g2g_research_runs) on an approved database before runs can explain themselves.${counters}`
  }
  return ` The stage-by-stage breakdown is not available for this run (it was made before breakdowns were recorded).${counters}`
}

/** Search failures by the category the backend identified; nothing is added when it did not identify one. */
function failureCategories(stats: NonNullable<ResearchRun['stage_stats']>): string {
  const search = stats.errors_by_stage?.search ?? {}
  const parts = Object.entries(search).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k.replace(/_/g, ' ')} ${n}`)
  return parts.length > 0 ? ` Failed searches by recorded reason: ${parts.join(', ')}.` : ''
}

export function describeFinishedRun(run: ResearchRun): RunNotice {
  if (run.status === 'failed' || run.status === 'skipped') {
    return { tone: 'error', text: run.error_message ?? run.stage_message ?? 'The run did not complete.' }
  }
  const stats = run.stage_stats ?? null
  const breakdown = stats
    ? ` ${stats.queries.succeeded} of ${stats.queries.attempted} searches worked${stats.queries.with_results !== null && stats.queries.empty !== null ? ` (${stats.queries.with_results} with results, ${stats.queries.empty} empty)` : ''}${stats.queries.cache_hits > 0 ? `, ${stats.queries.cache_hits} reused from the cache` : ''}, ${stats.results.returned} results, ${stats.pages.fetched} pages read in full.`
    : missingBreakdown(run)
  const failures = stats ? failureCategories(stats) : ''
  const region = stats?.region ? ` Limited to ${stats.region.label}${stats.region.outside > 0 ? ` (${stats.region.outside} candidate${stats.region.outside === 1 ? '' : 's'} left out: the source did not name that place)` : ''}.` : ''
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
      text: `Finished with limits: ${run.stage_message ?? 'some searches or sources could not be read.'} ${run.opportunities_qualified} qualified (${run.opportunities_new} new).${region}${breakdown}${failures}${registry}${direct}${named}`,
      nextStep: stats?.next_action ?? null,
    }
  }
  if (run.opportunities_qualified === 0 && stats?.completion === 'incomplete') {
    // Not the same as "found nothing": the research did not finish, so absence of signals proves nothing.
    return {
      tone: 'warning',
      text: `The research did not finish everything it set out to do (${(stats.completion_reasons ?? []).join(', ').replace(/_/g, ' ') || 'a limit was reached'}), so no signal qualified yet.${region}${breakdown}${failures}${registry}${direct}${named}`,
      nextStep: stats.next_action ?? null,
    }
  }
  if (run.opportunities_qualified === 0) {
    // The run's own reasons, biggest first, only when the backend recorded them.
    const why = stats?.zero_reasons?.slice(0, 3).map((r) => `${r.label} (${r.count})`).join(' ') ?? ''

    return {
      tone: 'info',
      text: `Finished: ${run.sources_found} sources found, but no opportunity had enough evidence to qualify.${region}${breakdown}${failures}${registry}${direct}${named}${why ? ` Why: ${why}` : ''}`,
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
