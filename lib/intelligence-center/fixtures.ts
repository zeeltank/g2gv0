import type { DetectorSummary, Insight, InsightCoverage, InsightsData, InsightsMeta, OverviewData } from '../../services/intelligence/types'

/**
 * Test data for the Intelligence screens. Every value is made up for the test (no real organisation, person or amount); nothing here is shown by the product.
 */
export const META: InsightsMeta = {
  generated_at: '2026-11-21T09:30:00Z',
  scope: 'organization',
  provisional: true,
  thresholds_note: 'Thresholds are provisional.',
  suppressed_count: 0,
  detectors_run: 3,
  states: { 'hr.certification_expiry': 'ok', 'commercial.deal_health': 'ok' },
}

export const COVERAGE: InsightCoverage = { observed: 12, expected: 15, percent: 80, basis: 'active employees with a recorded expiry date', sufficient: true, reason: null }

export function insight(overrides: Partial<Insight> = {}): Insight {
  return {
    key: 'hr.certification_expiry:org:2026-11',
    detector: 'hr.certification_expiry',
    domain: 'hr',
    category: 'certifications',
    severity: 'high',
    title: 'Certifications expire within 30 days',
    what_happened: '4 certifications are due to expire in the next 30 days.',
    why_it_matters: 'An expired certification can stop a person from doing the work it covers.',
    evidence: [
      { kind: 'metric', label: 'Certifications due in 30 days', value: 4, unit: 'certifications', source: 'Certifications register' },
      { kind: 'window', label: 'Window', from: '2026-11-21', to: '2026-12-21' },
      { kind: 'entity', label: 'Certification', entity_type: 'certification', entity_id: 91 },
    ],
    coverage: COVERAGE,
    as_of: '2026-11-21T09:30:00Z',
    suggested_action: 'Ask the holders to book their renewal.',
    deep_link: '/module/lms/learning/my-learning',
    confidence: 'measured',
    audience: 'organization',
    surfaces: ['hr_dashboard', 'certifications'],
    status: 'open',
    provisional: true,
    ...overrides,
  }
}

export function detector(overrides: Partial<DetectorSummary> = {}): DetectorSummary {
  return {
    detector: 'hr.certification_expiry',
    domain: 'hr',
    title: 'Certification expiry',
    state: 'ok',
    insight_count: 1,
    coverage: COVERAGE,
    as_of: '2026-11-21T09:30:00Z',
    reason: null,
    ...overrides,
  }
}

export function insightsData(insights: Insight[] = [insight()], meta: InsightsMeta = META): InsightsData {
  return { insights, pagination: { page: 1, per_page: 50, total: insights.length, total_pages: 1 }, meta }
}

export function overviewData(top: Insight[] = [insight()], meta: InsightsMeta = META): OverviewData {
  const bySeverity = { info: 0, attention: 0, high: 0, critical: 0 }
  const byDomain: Record<string, number> = { hr: 0, commercial: 0 }
  for (const i of top) {
    bySeverity[i.severity] += 1
    byDomain[i.domain] = (byDomain[i.domain] ?? 0) + 1
  }
  return { summary: { total: top.length, by_severity: bySeverity, by_domain: byDomain }, top, meta }
}

/* ── scenarios for the Intelligence screens (TEST ONLY: made-up data, never shown by the product) ───────────────── */

export const TEST_ONLY = 'Test data only: nothing here is shown by the product.'

/** The 15 detector ids the backend registers. */
export const ALL_DETECTOR_IDS: readonly string[] = [
  'hr.attendance_health',
  'hr.leave_attention',
  'hr.certification_expiry',
  'hr.recruitment_funnel',
  'hr.onboarding_probation',
  'hr.organisation_structure',
  'hr.task_workflow',
  'hr.learning_assignments',
  'hr.capability_development',
  'commercial.signal_evidence_quality',
  'commercial.signal_yield',
  'commercial.deal_health',
  'commercial.pipeline_attention',
  'commercial.customer_renewals',
  'commercial.invoice_attention',
]

/** The detectors the backend is adding for Platform Services and Agentic AI (a contract; they are not in ALL_DETECTOR_IDS, which is the original 15). */
export const PLATFORM_DETECTOR_IDS: readonly string[] = [
  'platform.scheduler_reliability',
  'platform.integration_status',
  'platform.event_delivery',
  'platform.ai_usage',
  'platform.governance',
  'agentic.run_health',
]

/** Cross-functional detector ids, made up for tests: the backend contract fixes only the prefix `cross.`, not the ids. */
export const CROSS_TEST_DETECTOR_IDS: readonly string[] = ['cross.test_learning_and_capability', 'cross.test_deal_and_invoice']

const domainOf = (id: string): 'hr' | 'commercial' | 'platform' | 'cross' =>
  id.startsWith('hr.') ? 'hr' : id.startsWith('commercial.') ? 'commercial' : id.startsWith('cross.') ? 'cross' : 'platform'

/** The detectors a viewer is authorised for: every id in `ids`, `ok` unless an override says otherwise. */
export function detectorList(overrides: Record<string, Partial<DetectorSummary>> = {}, ids: readonly string[] = ALL_DETECTOR_IDS): DetectorSummary[] {
  return ids.map((id) => detector({ detector: id, domain: domainOf(id), title: `Check ${id}`, insight_count: 0, ...overrides[id] }))
}

/** An insight of a given detector, with a key that is unique to the test. */
export function insightOf(detectorId: string, overrides: Partial<Insight> = {}): Insight {
  return insight({
    key: `${detectorId}:test`,
    detector: detectorId,
    domain: domainOf(detectorId),
    surfaces: [],
    title: `Finding of ${detectorId}`,
    what_happened: `What happened for ${detectorId}.`,
    why_it_matters: `Why ${detectorId} matters.`,
    suggested_action: `Act on ${detectorId}.`,
    deep_link: null,
    evidence: [],
    ...overrides,
  })
}

export const THIN_COVERAGE: InsightCoverage = { observed: 3, expected: null, percent: null, basis: 'records', sufficient: false, reason: 'Only 3 record(s) support this; at least 10 are needed.' }

/** Entity evidence: `count` references of one type, ids 1..count. */
export function entities(entityType: string, count: number, label = 'Record'): Insight['evidence'] {
  return Array.from({ length: count }, (_, i) => ({ kind: 'entity' as const, label, entity_type: entityType, entity_id: i + 1 }))
}

/** A cross-functional finding as the contract describes it: domain `cross`, category `cross_*`, rule-based, two observed sets as entity evidence. */
export function crossInsight(overrides: Partial<Insight> = {}): Insight {
  return insightOf('cross.test_learning_and_capability', {
    key: 'cross.test_learning_and_capability:org:2026-11',
    domain: 'cross',
    category: 'cross_learning_capability',
    severity: 'attention',
    confidence: 'rule_based',
    title: 'Overdue learning and open capability gaps involve the same people',
    what_happened: '3 people have an overdue learning assignment and an open capability gap request.',
    why_it_matters: 'If the two are connected, learning that is late may be delaying a known capability gap. This has not been verified.',
    suggested_action: 'Check whether the late assignments are the ones that address the gaps.',
    evidence: [
      { kind: 'metric', label: 'People in both sets', value: 3, unit: 'people', source: 'Learning assignments and capability gap requests' },
      ...entities('learning_assignment', 3, 'Overdue learning assignment'),
      ...entities('capability_gap_request', 3, 'Open capability gap request'),
    ],
    deep_link: '/module/lms/training-and-records/assignments',
    ...overrides,
  })
}
