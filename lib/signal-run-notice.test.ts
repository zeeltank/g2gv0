/**
 * What a finished run says: failed is not a zero-result success, unavailable stage numbers are not zeros, sources are not pages, and a signal
 * seen again on a later date is not called new. Executes the real helpers; no React, no network.
 */
import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { describeFinishedRun, discoveryLabel } from './signal-run-notice'
import type { ResearchRun, RunStageStats } from '../services/signals/opportunities'

const stats = (over: Partial<RunStageStats> = {}): RunStageStats => ({
  queries: { planned: 18, attempted: 16, succeeded: 16, with_results: 12, empty: 4, failed: 0, cache_hits: 1, skipped: 1, skipped_by_reason: { searched_within_cache_window: 1, time_budget: 1 } },
  results: { returned: 90, dropped_too_old: 4, screened_out: 46, kept: 40 },
  pages: { fetched: 8, failed: 2 },
  candidates: { proposed: 1, rejected_before_gate: 1, rejected_by_gate: 0 },
  outcome: { new: 0, updated: 0, unchanged_existing: 0, qualified_total: 0 },
  errors_by_stage: {},
  zero_reasons: [{ code: 'quote_not_in_source', label: 'The quote is not in the source.', count: 1 }],
  next_action: 'Add direct sources.',
  registry: { selected: 2, eligible: 80, attempted: 1, searched: 1, succeeded_with_results: 1, succeeded_empty: 0, failed: 0, served_from_cache: 1, skipped_other: 0, not_selected_reason: null, verified: false },
  name_search: { skipped_missing_context: 0, schools_selected: 2, searches_run: 2, schools_with_candidate_site: 1, candidate_sites: 1, candidate_sites_verified: 0 },
  ...over,
})

const run = (over: Partial<ResearchRun> = {}): ResearchRun => ({
  id: 1, report_date: '2026-10-26', trigger: 'manual', status: 'success', started_at: null, completed_at: null, duration_ms: 1,
  queries_run: 16, queries_failed: 0, sources_found: 40, companies_researched: 1, opportunities_qualified: 0, opportunities_new: 0, opportunities_rejected: 1,
  search_provider: 'tavily', error_code: null, error_message: null, stage_stats: stats(), stage_stats_persisted: true, ...over,
})

describe('describeFinishedRun', () => {
  it('shows a failed or skipped run as an error, never as a zero-result success', () => {
    for (const status of ['failed', 'skipped'] as const) {
      const n = describeFinishedRun(run({ status, error_message: 'All search queries failed to reach provider.' }))
      assert.equal(n.tone, 'error')
      assert.match(n.text, /All search queries failed/)
      assert.doesNotMatch(n.text, /enough evidence to qualify/)
    }
  })

  it('keeps sources and pages read as different numbers on a zero-qualified run', () => {
    const n = describeFinishedRun(run())
    assert.equal(n.tone, 'info')
    assert.match(n.text, /40 sources found/)
    assert.match(n.text, /8 pages read in full/)
    assert.match(n.text, /16 of 16 searches worked \(12 with results, 4 empty\), 1 reused from the cache/)
    assert.match(n.text, /The quote is not in the source\. \(1\)/)
    assert.equal(n.nextStep, 'Add direct sources.')
  })

  it('says the breakdown is unavailable when the run kept none, instead of printing zeros', () => {
    const n = describeFinishedRun(run({ stage_stats: null, stage_stats_persisted: false }))
    assert.match(n.text, /not available for this run/)
    assert.doesNotMatch(n.text, /0 pages/)
    assert.doesNotMatch(n.text, /0 of 0/)
  })

  it('states that selected registry sources are not the same as searched, and that searching does not verify', () => {
    const n = describeFinishedRun(run())
    assert.match(n.text, /1 of 2 chosen registry sources were searched \(searching does not verify a source\)/)
    assert.match(n.text, /2 schools without a verified website were searched by name/)
  })

  it('says how many new items were read directly from verified sources, and nothing when the run did not', () => {
    const withDirect = describeFinishedRun(run({ stage_stats: stats({ direct: { sources_selected: 3, listings_read: 3, items_found: 12, items_read: 7, items_skipped_seen: 2, refused_robots: 0, failed_by_category: {} } }) }))
    assert.match(withDirect.text, /7 new items read directly from 3 verified sources\./)
    assert.doesNotMatch(describeFinishedRun(run({ stage_stats: stats({ direct: null }) })).text, /directly/)
    assert.doesNotMatch(describeFinishedRun(run({ stage_stats: stats({ direct: { sources_selected: 0, listings_read: 0, items_found: 0, items_read: 0, items_skipped_seen: 0, refused_robots: 0, failed_by_category: {} } }) })).text, /directly/)
  })

  it('omits registry and name-search sentences when the run has no record of them (unavailable, not zero)', () => {
    const n = describeFinishedRun(run({ stage_stats: stats({ registry: null, name_search: null }) }))
    assert.doesNotMatch(n.text, /registry/)
    assert.doesNotMatch(n.text, /searched by name/)
  })

  it('marks a partial run as limited and still shows the numbers it has', () => {
    const n = describeFinishedRun(run({ status: 'partial', stage_message: 'Stopped early.', opportunities_qualified: 2, opportunities_new: 1 }))
    assert.equal(n.tone, 'warning')
    assert.match(n.text, /Finished with limits: Stopped early\./)
    assert.match(n.text, /2 qualified \(1 new\)/)
  })

  it('keeps new, updated and unchanged apart on a successful run', () => {
    const n = describeFinishedRun(run({
      opportunities_qualified: 4, opportunities_new: 1,
      stage_stats: stats({ outcome: { new: 1, updated: 1, unchanged_existing: 2, qualified_total: 4 } }),
    }))
    assert.equal(n.tone, 'success')
    assert.match(n.text, /4 qualified \(1 new, 1 updated, 2 unchanged\)/)
  })
})

describe('discoveryLabel', () => {
  it('calls a signal first found on the listed day new, and a re-observed one earlier', () => {
    assert.equal(discoveryLabel(true, '26 Oct 2026'), 'New in the 26 Oct 2026 run')
    assert.equal(discoveryLabel(false, '26 Oct 2026'), 'Earlier signal, seen again in the 26 Oct 2026 run')
  })

  it('does not claim either when the API could not tell', () => {
    assert.equal(discoveryLabel(null, '26 Oct 2026'), 'Found in the 26 Oct 2026 run')
    assert.equal(discoveryLabel(undefined, null), null)
  })
})
