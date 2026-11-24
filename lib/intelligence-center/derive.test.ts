import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { areaById, domainById } from './domains'
import {
  buildAreaView,
  buildDomainView,
  buildDomainViews,
  buildModuleView,
  buildOverview,
  conditionOf,
  emptyText,
  isWithheld,
  countBySeverity,
  meansSentence,
  narrativeOf,
  recommendedActions,
  rollUpCoverage,
  topPriorities,
  type Snapshot,
} from './derive'
import { moduleIntelligenceByKey } from './modules'
import { registryRows } from './coverage-registry'
import { AVAILABILITY, EXCLUDED_LABEL } from './availability'
import { CONDITION_CHIP } from './tones'
import { CONDITION_LABEL, CONDITION_MEANING, type Condition } from './derive'
import { ALL_DETECTOR_IDS, COVERAGE, detector, detectorList, insightOf, META, PLATFORM_DETECTOR_IDS, THIN_COVERAGE } from './fixtures'
import { fakeIntelligenceService, pagedInsights } from './fake-service'
import { loadSnapshot, MAX_PAGES } from './load-all'

const snap = (insights = [] as ReturnType<typeof insightOf>[], detectors = detectorList(), extra: Partial<Snapshot> = {}): Snapshot => ({
  insights,
  detectors,
  meta: META,
  truncated: false,
  total: insights.length,
  ...extra,
})

describe('condition of a unit', () => {
  const ok = [detector({ state: 'ok' })]

  it('critical or high -> Needs attention', () => {
    assert.equal(conditionOf({ insights: [insightOf('hr.leave_attention', { severity: 'critical' })], detectors: ok, connected: true }), 'needs_attention')
    assert.equal(conditionOf({ insights: [insightOf('hr.leave_attention', { severity: 'high' }), insightOf('hr.leave_attention', { key: 'b', severity: 'info' })], detectors: ok, connected: true }), 'needs_attention')
  })

  it('attention or info only -> Watch', () => {
    assert.equal(conditionOf({ insights: [insightOf('hr.leave_attention', { severity: 'attention' })], detectors: ok, connected: true }), 'watch')
    assert.equal(conditionOf({ insights: [insightOf('hr.leave_attention', { severity: 'info' })], detectors: ok, connected: true }), 'watch')
  })

  it('every authorised check ok and no findings -> Healthy', () => {
    assert.equal(conditionOf({ insights: [], detectors: [detector({ state: 'ok' }), detector({ detector: 'b', state: 'ok' })], connected: true }), 'healthy')
  })

  it('every check insufficient_data -> Not enough data', () => {
    assert.equal(conditionOf({ insights: [], detectors: [detector({ state: 'insufficient_data' }), detector({ detector: 'b', state: 'insufficient_data' })], connected: true }), 'not_enough_data')
  })

  it('never says Healthy when any check could not assess (a mix, or an error)', () => {
    assert.equal(conditionOf({ insights: [], detectors: [detector({ state: 'ok' }), detector({ detector: 'b', state: 'insufficient_data' })], connected: true }), 'not_enough_data')
    assert.equal(conditionOf({ insights: [], detectors: [detector({ state: 'error' })], connected: true }), 'not_enough_data')
  })

  it('no authorised check (or only not-applicable ones) -> Not available, distinct from Not connected', () => {
    assert.equal(conditionOf({ insights: [], detectors: [], connected: true }), 'not_available')
    assert.equal(conditionOf({ insights: [], detectors: [detector({ state: 'not_applicable' })], connected: true }), 'not_available')
    assert.equal(conditionOf({ insights: [], detectors: [], connected: false }), 'not_connected')
  })
})

describe('domain and area views', () => {
  it('derives counts, attention, condition and top finding from the loaded insights', () => {
    const insights = [
      insightOf('hr.attendance_health', { key: 'a1', severity: 'attention', surfaces: ['attendance'] }),
      insightOf('hr.leave_attention', { key: 'l1', severity: 'critical', surfaces: ['leave'], title: 'Leave stuck' }),
      insightOf('hr.leave_attention', { key: 'l2', severity: 'high', surfaces: ['leave'] }),
    ]
    const view = buildDomainView(snap(insights), domainById('people-workforce')!)
    assert.equal(view.condition, 'needs_attention')
    assert.deepEqual(view.counts, { info: 0, attention: 1, high: 1, critical: 1 })
    assert.equal(view.attention, 2)
    assert.equal(view.top?.title, 'Leave stuck')
    assert.deepEqual(view.areas.map((a) => [a.area.id, a.condition]), [['attendance', 'watch'], ['leave', 'needs_attention'], ['organisation-structure', 'healthy']])
  })

  describe('parent-module views', () => {
    it('combines every configured HRIT submodule rather than only the current screen', () => {
      const insights = [
        insightOf('hr.attendance_health', { key: 'att', surfaces: ['attendance'], severity: 'attention' }),
        insightOf('hr.leave_attention', { key: 'leave', surfaces: ['leave'], severity: 'critical' }),
      ]
      const view = buildModuleView(snap(insights), moduleIntelligenceByKey('hrms')!)
      assert.deepEqual(view.areas.map((a) => a.area.id), ['attendance', 'leave'])
      assert.deepEqual(view.insights.map((i) => i.key), ['leave', 'att'])
      assert.equal(view.condition, 'needs_attention')
      // The old ad-hoc `gaps` list is replaced by the coverage registry: payroll is listed there as EXCLUDED (decision D2), not as a gap or a finding.
      assert.equal(registryRows('hrms').some((r) => r.id === 'H9' && r.state === 'excluded'), true)
    })

    it('never calls an incomplete parent module healthy, and retains detector errors as coverage gaps', () => {
      const detectors = detectorList({
        'hr.attendance_health': { state: 'error', reason: 'Check could not run.' },
        'hr.leave_attention': { state: 'ok' },
      })
      const view = buildModuleView(snap([], detectors), moduleIntelligenceByKey('hrms')!)
      assert.equal(view.condition, 'not_enough_data')
      assert.equal(view.coverage.errored, 1)
      assert.equal(view.coverage.enough, 1)
      assert.match(view.gapReason ?? '', /Check could not run/)
    })
  })

  it('a domain with no detector at all stays not connected whatever the data says (conditionOf, not connected)', () => {
    assert.equal(conditionOf({ insights: [], detectors: detectorList(), connected: false }), 'not_connected')
  })

  it('Platform, AI & Governance is Not Yet Assessed (not Not Connected) until its new detectors report, then derived from their states', () => {
    const before = buildDomainView(snap(), domainById('platform-governance')!)
    assert.equal(before.condition, 'not_assessed')
    assert.deepEqual(before.areas.map((a) => a.condition), Array(6).fill('not_assessed'))
    const reported = buildDomainView(snap([], detectorList({}, PLATFORM_DETECTOR_IDS)), domainById('platform-governance')!)
    assert.equal(reported.condition, 'healthy')
    const thin = buildDomainView(snap([], detectorList({ 'platform.event_delivery': { state: 'insufficient_data', reason: 'Too few events.' } }, PLATFORM_DETECTOR_IDS)), domainById('platform-governance')!)
    assert.equal(thin.condition, 'not_enough_data')
  })

  it('Agentic AI is Not Yet Assessed until agentic.run_health reports, then derived from its state', () => {
    const agentic = moduleIntelligenceByKey('agentic-ai')!
    assert.equal(buildModuleView(snap(), agentic).condition, 'not_assessed')
    assert.equal(buildModuleView(snap([], detectorList({}, ['agentic.run_health'])), agentic).condition, 'no_findings', 'ok and nothing found, but other functionality is not assessed: never Healthy')
    assert.equal(buildModuleView(snap([], detectorList({ 'agentic.run_health': { state: 'insufficient_data' } }, ['agentic.run_health'])), agentic).condition, 'not_enough_data')
    assert.equal(buildModuleView(snap([], detectorList({ 'agentic.run_health': { state: 'error', reason: 'Source failed.' } }, ['agentic.run_health'])), agentic).condition, 'not_enough_data', 'an error is never zero or healthy')
  })

  it('Capability Intelligence has no detector: Not Yet Assessed, not Not Connected', () => {
    assert.equal(buildModuleView(snap(), moduleIntelligenceByKey('competency')!).condition, 'not_assessed')
  })

  it('a domain whose detectors are defined but none is in the viewer list is Not available for the role', () => {
    const detectors = detectorList({}, ['hr.attendance_health', 'commercial.invoice_attention'])
    const views = buildDomainViews(snap([], detectors))
    const by = (id: string) => views.find((v) => v.domain.id === id)!
    assert.equal(by('people-workforce').condition, 'healthy', 'one authorised check, ok, no findings')
    assert.deepEqual(by('people-workforce').unavailable, ['Leave approvals', 'Organisation structure'])
    assert.equal(by('talent-onboarding').condition, 'not_available')
    assert.equal(by('work-execution').condition, 'not_available')
    assert.equal(by('platform-governance').condition, 'not_assessed')
    assert.deepEqual(by('talent-onboarding').unavailable, ['Recruitment', 'Onboarding and probation'])
  })

  it('splits deal health between CRM opportunities and GTM deals by surface, and keeps the two areas independent', () => {
    const insights = [
      insightOf('commercial.deal_health', { key: 'c', surfaces: ['crm_opportunities'], severity: 'high' }),
      insightOf('commercial.deal_health', { key: 'g', surfaces: ['gtm_deals'], severity: 'info' }),
      insightOf('commercial.pipeline_attention', { key: 'p', surfaces: ['gtm_forecast'], severity: 'attention' }),
    ]
    const domain = domainById('revenue-pipeline')!
    const crm = buildAreaView(snap(insights), areaById('revenue-pipeline', 'crm-opportunities')!)
    const gtm = buildAreaView(snap(insights), areaById('revenue-pipeline', 'gtm-deals-pipeline')!)
    assert.deepEqual(crm.insights.map((i) => i.key), ['c'])
    assert.deepEqual(gtm.insights.map((i) => i.key), ['p', 'g'])
    assert.equal(crm.condition, 'needs_attention')
    assert.equal(gtm.condition, 'watch')
    assert.equal(buildDomainView(snap(insights), domain).insights.length, 3)
  })

  it('an insight from an unknown detector is kept under Other findings, never dropped', () => {
    const insights = [insightOf('x.brand_new', { key: 'n', surfaces: ['hr_dashboard'], severity: 'attention' })]
    const views = buildDomainViews(snap(insights, [...detectorList(), detector({ detector: 'x.brand_new' })]))
    const other = views.find((v) => v.domain.id === 'other')
    assert.ok(other, 'the Other findings card appears')
    assert.deepEqual(other.insights.map((i) => i.key), ['n'])
    assert.equal(other.condition, 'watch')
    assert.equal(buildDomainViews(snap()).some((v) => v.domain.id === 'other'), false, 'and is absent when empty')
  })

  it('carries the server reason when the condition is Not enough data', () => {
    const detectors = detectorList({ 'hr.leave_attention': { state: 'insufficient_data', reason: 'Only 3 requests; at least 10 needed.' } })
    const view = buildAreaView(snap([], detectors), areaById('people-workforce', 'leave')!)
    assert.equal(view.condition, 'not_enough_data')
    assert.equal(view.gapReason, 'Only 3 requests; at least 10 needed.')
  })
})

describe('Healthy is never said when something may be missing', () => {
  const DEALS = (extra = {}) => insightOf('commercial.deal_health', { key: 'g', surfaces: ['gtm_deals'], ...extra })

  it('an empty result of ok checks is Healthy when nothing is in doubt', () => {
    assert.equal(buildDomainView(snap(), domainById('people-workforce')!).condition, 'healthy')
  })

  it('suppressed_count above zero: No findings shown, with a note, never Healthy (domain, area and overview list)', () => {
    const s = snap([], detectorList(), { meta: { ...META, suppressed_count: 3 } })
    const view = buildDomainView(s, domainById('people-workforce')!)
    assert.equal(view.condition, 'no_findings')
    assert.equal(buildAreaView(s, areaById('people-workforce', 'leave')!).condition, 'no_findings')
    assert.match(view.note ?? '', /withheld/)
    assert.deepEqual(buildOverview(s).clear, [], 'nothing is listed as clear')
    assert.equal(buildOverview(s).domainTally.healthy, 0)
  })

  it('a suppression note (small-group viewer) is enough, even with a null count', () => {
    const s = snap([], detectorList(), { meta: { ...META, suppressed_count: null, suppression_note: 'Some results are withheld.' } })
    assert.equal(buildDomainView(s, domainById('talent-onboarding')!).condition, 'no_findings')
    assert.equal(isWithheld(s), true)
  })

  it('a truncated load is never Healthy', () => {
    const s = snap([], detectorList(), { truncated: true })
    assert.equal(buildDomainView(s, domainById('work-execution')!).condition, 'no_findings')
  })

  it('a check that reports more findings than were loaded is never Healthy (may be incomplete)', () => {
    const s = snap([], detectorList({ 'hr.task_workflow': { insight_count: 4 } }))
    const view = buildDomainView(s, domainById('work-execution')!)
    assert.equal(view.condition, 'no_findings')
    assert.match(view.note ?? '', /may be incomplete/)
    assert.equal(buildDomainView(s, domainById('people-workforce')!).condition, 'healthy', 'other domains are unaffected')
  })

  it('an area fed by a detector it shares with another area says so, and is not Healthy', () => {
    const crm = buildAreaView(snap([DEALS()]), areaById('revenue-pipeline', 'crm-opportunities')!)
    assert.equal(crm.condition, 'no_findings')
    assert.equal(crm.note, 'No findings in this area (this check also covers GTM deals & pipeline).')
    const gtm = buildAreaView(snap(), areaById('revenue-pipeline', 'gtm-deals-pipeline')!)
    assert.equal(gtm.condition, 'no_findings')
    assert.match(gtm.note ?? '', /also covers CRM opportunities/)
    assert.equal(buildAreaView(snap(), areaById('revenue-pipeline', 'invoices')!).condition, 'healthy', 'an unshared area is Healthy')
    assert.equal(buildDomainView(snap(), domainById('revenue-pipeline')!).condition, 'healthy', 'the domain holds both areas')
  })

  it('findings and real gaps still win over the caveat', () => {
    const s = snap([insightOf('hr.leave_attention', { surfaces: ['leave'], severity: 'high' })], detectorList(), { truncated: true })
    assert.equal(buildAreaView(s, areaById('people-workforce', 'leave')!).condition, 'needs_attention')
    const thin = snap([], detectorList({ 'hr.leave_attention': { state: 'insufficient_data' } }), { truncated: true })
    assert.equal(buildAreaView(thin, areaById('people-workforce', 'leave')!).condition, 'not_enough_data')
  })

  it('emptyText names each case', () => {
    assert.equal(emptyText({ condition: 'healthy', gapReason: null, note: null }).title, 'Checked, nothing to flag')
    assert.equal(emptyText({ condition: 'no_findings', gapReason: null, note: 'May be incomplete.' }).title, 'No findings shown')
    assert.equal(emptyText({ condition: 'not_connected', gapReason: null, note: null }, true).title, 'Nothing here')
  })
})

describe('priorities', () => {
  it('ranks critical > high > attention > info, then newest, across all domains, and caps at 6', () => {
    const insights = [
      insightOf('hr.leave_attention', { key: 'i', severity: 'info', as_of: '2026-11-22T00:00:00Z' }),
      insightOf('commercial.invoice_attention', { key: 'h-old', severity: 'high', as_of: '2026-11-10T00:00:00Z' }),
      insightOf('hr.task_workflow', { key: 'c', severity: 'critical', as_of: '2026-11-01T00:00:00Z' }),
      insightOf('hr.task_workflow', { key: 'h-new', severity: 'high', as_of: '2026-11-20T00:00:00Z' }),
      insightOf('hr.leave_attention', { key: 'a', severity: 'attention' }),
      insightOf('hr.attendance_health', { key: 'a2', severity: 'attention', as_of: '2026-11-01T00:00:00Z' }),
      insightOf('hr.attendance_health', { key: 'last', severity: 'info', as_of: '2026-01-01T00:00:00Z' }),
    ]
    const top = topPriorities(snap(insights), 6)
    assert.deepEqual(top.map((p) => p.insight.key), ['c', 'h-new', 'h-old', 'a', 'a2', 'i'])
    assert.equal(top[0].placement.domain, 'work-execution')
  })
})

describe('coverage aggregation', () => {
  it('counts the checks that had enough data, and leaves not-applicable ones out', () => {
    const roll = rollUpCoverage([detector({ state: 'ok' }), detector({ detector: 'b', state: 'insufficient_data' }), detector({ detector: 'c', state: 'error' }), detector({ detector: 'd', state: 'not_applicable' })])
    assert.equal(roll.checks, 3)
    assert.equal(roll.enough, 1)
    assert.equal(roll.insufficient, 1)
    assert.equal(roll.errored, 1)
    assert.equal(roll.headline, '1 of 3 checks had enough data')
  })

  it('never adds figures across checks, even with the same basis: each check keeps its own figure', () => {
    const roll = rollUpCoverage([
      detector({ detector: 'a', coverage: { ...COVERAGE, observed: 12, expected: 15, basis: 'people' } }),
      detector({ detector: 'b', coverage: { ...COVERAGE, observed: 8, expected: 10, basis: 'people' } }),
    ])
    assert.equal('ratio' in roll, false, 'there is no summed ratio')
    assert.deepEqual(roll.items.map((i) => [i.observed, i.expected]), [[12, 15], [8, 10]])
    assert.deepEqual(roll.items.map((i) => i.headline), ['Based on 12 of 15 people (80%)', 'Based on 8 of 10 people (80%)'])
  })

  it('differing bases and withheld figures (small-group viewers) are also listed one by one', () => {
    const mixed = rollUpCoverage([
      detector({ detector: 'a', coverage: { ...COVERAGE, observed: 12, expected: 15, basis: 'people' } }),
      detector({ detector: 'b', coverage: { ...COVERAGE, observed: 8, expected: 10, basis: 'invoices' } }),
    ])
    assert.deepEqual(mixed.items.map((i) => i.headline), ['Based on 12 of 15 people (80%)', 'Based on 8 of 10 invoices (80%)'])
    const withheld = rollUpCoverage([detector({ coverage: { ...COVERAGE, observed: null, expected: null, percent: null, basis: 'people in your team' } })])
    assert.equal(withheld.items[0].headline, 'Based on people in your team')
  })

  it('never invents a figure for a check with insufficient data', () => {
    const roll = rollUpCoverage([detector({ state: 'insufficient_data', coverage: THIN_COVERAGE, reason: THIN_COVERAGE.reason })])
    assert.equal(roll.items[0].headline, 'Not enough data to assess')
    assert.equal(roll.items[0].reason, THIN_COVERAGE.reason)
  })

  it('the overview says what the whole picture rests on, without a percentage the server did not send', () => {
    const detectors = detectorList({ 'hr.leave_attention': { state: 'insufficient_data' }, 'hr.task_workflow': { state: 'error' } })
    const o = buildOverview(snap([], detectors))
    assert.equal(o.confidence, 'This picture rests on 13 of 15 checks that had enough data; 1 did not have enough data and 1 could not run.')
    assert.equal(buildOverview(snap([], [])).confidence, 'No checks are open to your role, so nothing here can be assessed.')
  })
})

describe('overview', () => {
  it('counts findings by severity and domains by condition', () => {
    const insights = [insightOf('hr.leave_attention', { key: 'a', severity: 'critical' }), insightOf('hr.attendance_health', { key: 'b', severity: 'info' })]
    const o = buildOverview(snap(insights))
    assert.deepEqual(o.counts, { info: 1, attention: 0, high: 0, critical: 1 })
    assert.equal(o.total, 2)
    assert.equal(o.domainTally.needs_attention, 1)
    assert.equal(o.domainTally.not_connected, 0)
    assert.equal(o.domainTally.not_assessed, 1, 'Platform, AI & Governance: its new checks have not reported yet')
    assert.equal(o.domainTally.healthy, 5)
  })

  it('lists "checked, nothing to flag" ONLY from ok checks with no findings', () => {
    const detectors = detectorList({
      'hr.leave_attention': { state: 'ok', insight_count: 1 },
      'hr.attendance_health': { state: 'insufficient_data' },
      'hr.task_workflow': { state: 'not_applicable' },
    })
    const o = buildOverview(snap([insightOf('hr.leave_attention', { surfaces: ['leave'] })], detectors))
    assert.equal(o.clear.some((d) => d.detector === 'hr.leave_attention'), false)
    assert.equal(o.clear.some((d) => d.detector === 'hr.attendance_health'), false)
    assert.equal(o.clear.some((d) => d.detector === 'hr.task_workflow'), false)
    assert.equal(o.clear.length, 12)
  })

  it('last updated is the server generated_at, else the newest as_of', () => {
    assert.equal(buildOverview(snap()).lastUpdated, '2026-11-21T09:30:00Z')
    const noMeta = snap([insightOf('hr.leave_attention', { as_of: '2026-11-25T00:00:00Z' })], detectorList(), { meta: {} })
    assert.equal(buildOverview(noMeta).lastUpdated, '2026-11-25T00:00:00Z')
  })
})

describe('narrative, composed only from the insights own words', () => {
  it('uses what_happened and why_it_matters verbatim, once each', () => {
    const insights = [
      insightOf('hr.leave_attention', { key: 'a', severity: 'high', what_happened: 'A happened.', why_it_matters: 'Same reason.' }),
      insightOf('hr.leave_attention', { key: 'b', severity: 'attention', what_happened: 'B happened.', why_it_matters: 'Same reason.' }),
    ]
    const n = narrativeOf({ insights, counts: countBySeverity(insights) })
    assert.deepEqual(n.happening.map((l) => l.text), ['A happened.', 'B happened.'])
    assert.deepEqual(n.why.map((l) => l.text), ['Same reason.'])
    assert.equal(n.means, '2 open findings: 1 high priority or critical, 1 needs a look.')
  })

  it('meansSentence is honest about none', () => {
    assert.equal(meansSentence({ info: 0, attention: 0, high: 0, critical: 0 }), 'No open findings.')
  })

  it('recommended actions are distinct and most urgent first', () => {
    const insights = [
      insightOf('hr.leave_attention', { key: 'a', severity: 'info', suggested_action: 'Do X' }),
      insightOf('hr.leave_attention', { key: 'b', severity: 'critical', suggested_action: 'Do Y' }),
      insightOf('hr.leave_attention', { key: 'c', severity: 'high', suggested_action: 'Do X' }),
      insightOf('hr.leave_attention', { key: 'd', severity: 'high', suggested_action: null }),
    ]
    assert.deepEqual(recommendedActions(insights).map((a) => a.text), ['Do Y', 'Do X'])
  })
})

describe('loading every page', () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => insightOf('hr.leave_attention', { key: `k${i}`, surfaces: ['leave'] }))

  it('follows the pagination until total_pages, 50 per page, and answers the detectors too', async () => {
    const { service, calls } = fakeIntelligenceService({ insights: pagedInsights(many(120)) })
    const snapshot = await loadSnapshot(service)
    assert.equal(snapshot.insights.length, 120)
    assert.deepEqual(calls.insights, [{ per_page: 50, page: 1 }, { per_page: 50, page: 2 }, { per_page: 50, page: 3 }])
    assert.equal(calls.detectors, 1)
    assert.equal(snapshot.truncated, false)
    assert.equal(snapshot.total, 120)
  })

  it('stops at the 10 page cap and says the list was cut', async () => {
    const { service, calls } = fakeIntelligenceService({ insights: pagedInsights(many(620)) })
    const snapshot = await loadSnapshot(service)
    assert.equal(calls.insights.length, MAX_PAGES)
    assert.equal(MAX_PAGES, 4)
    assert.equal(snapshot.insights.length, 200)
    assert.equal(snapshot.truncated, true)
    assert.equal(snapshot.total, 620)
  })

  it('does not list one finding twice if a page overlaps', async () => {
    const dup = pagedInsights(many(60))
    const { service } = fakeIntelligenceService({ insights: async (p) => (p?.page === 2 ? dup({ per_page: 50, page: 1 }).then((r) => ({ ...r, data: { ...r.data, pagination: { page: 2, per_page: 50, total: 60, total_pages: 2 } } })) : dup(p)) })
    const snapshot = await loadSnapshot(service)
    assert.equal(snapshot.insights.length, 50)
  })

  it('a failure on any request rejects, so the screen shows an error state', async () => {
    const { service } = fakeIntelligenceService({ detectors: async () => { throw Object.assign(new Error('x'), { status: 403 }) } })
    await assert.rejects(loadSnapshot(service))
  })
})

describe('fixtures', () => {
  it('the 15 detector ids the backend registers are the ones used in tests', () => {
    assert.equal(ALL_DETECTOR_IDS.length, 15)
  })
})

describe('availability states are distinct and never confused', () => {
  const NEW: Condition[] = ['partial', 'not_enough_data', 'data_unavailable', 'access_restricted', 'not_connected', 'not_assessed', 'excluded']

  it('each of the seven has its own wording, meaning, border and icon', () => {
    const labels = NEW.map((c) => CONDITION_LABEL[c])
    assert.equal(new Set(labels).size, 7)
    assert.equal(new Set(NEW.map((c) => CONDITION_MEANING[c])).size, 7)
    assert.equal(new Set(NEW.map((c) => CONDITION_CHIP[c])).size, 7)
    assert.equal(new Set(Object.values(AVAILABILITY).map((a) => a.icon)).size, 7)
    assert.equal(CONDITION_LABEL.excluded, 'Excluded — pending separate approval and security review')
    assert.equal(CONDITION_LABEL.excluded, EXCLUDED_LABEL)
    assert.notEqual(CONDITION_LABEL.excluded, CONDITION_LABEL.not_enough_data)
    assert.notEqual(CONDITION_LABEL.excluded, CONDITION_LABEL.not_assessed)
  })

  it('the API states map to their own conditions: restricted, unavailable and error are never zero, healthy or "not enough data"', () => {
    const only = (state: 'access_restricted' | 'data_unavailable' | 'error' | 'insufficient_data') => conditionOf({ insights: [], detectors: [detector({ state, insight_count: 0 })], connected: true })
    assert.equal(only('access_restricted'), 'access_restricted')
    assert.equal(only('data_unavailable'), 'data_unavailable')
    assert.equal(only('insufficient_data'), 'not_enough_data')
    assert.notEqual(only('error'), 'healthy')
    assert.notEqual(only('error'), 'no_findings')
    for (const state of ['access_restricted', 'data_unavailable', 'error'] as const) {
      const c = only(state)
      assert.notEqual(c, 'healthy', state)
    }
  })

  it('a state this screen does not know is never healthy and never crashes the rollup', () => {
    const weird = detector({ state: 'quantum' as never, insight_count: 0 })
    assert.notEqual(conditionOf({ insights: [], detectors: [weird], connected: true }), 'healthy')
    const roll = rollUpCoverage([weird])
    assert.equal(roll.enough, 0)
    assert.equal(roll.checks, 1)
  })

  it('findings still win over an availability state', () => {
    assert.equal(conditionOf({ insights: [insightOf('hr.leave_attention', { severity: 'high' })], detectors: [detector({ state: 'data_unavailable' })], connected: true }), 'needs_attention')
  })
})
