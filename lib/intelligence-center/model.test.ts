import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { classifyIntelligenceError } from '../../services/intelligence/errors'
import { insightsQuery } from '../../services/intelligence/intelligence-service'
import { detector, insight, META } from './fixtures'
import {
  confidenceLabel,
  coverageText,
  emptyVerdict,
  emptyWording,
  evidenceLine,
  evidenceSources,
  formatAsOf,
  formatMetricValue,
  needsAttention,
  openLabel,
  provisionalNotice,
  PROVISIONAL_NOTICE,
  safeDeepLink,
  severityLabel,
  severityRank,
  sortDetectors,
  sortInsights,
  statesOf,
  suppressedNotice,
} from './model'
import { CONFIDENCE_CHIP, SEVERITY_CHIP, TEXT_ON_SURFACE } from './tones'

describe('safeDeepLink (an insight can only ever link inside the app)', () => {
  it('accepts in-app paths, with a query or a hash', () => {
    for (const ok of ['/gtm/deals', '/module/crm/sales/opportunities', '/dashboard/attendance?tab=late', '/intelligence#top', '/gtm?next=http://x']) {
      assert.equal(safeDeepLink(ok), ok, ok)
    }
  })

  it('refuses absolute URLs, protocol-relative URLs, scripts, backslashes, whitespace and control characters', () => {
    const bad = [
      'https://evil.example/x', 'http://evil.example', '//evil.example', '///evil.example', 'javascript:alert(1)', 'JaVaScRiPt:alert(1)',
      'data:text/html,<script>', '/\\evil.example', '\\evil.example', '/javascript:alert(1)', ' /gtm', '/gtm ', '/gt m', '/gtm\n/x', '/gtm\u0000', 'gtm/deals', '', '   ',
    ]
    for (const value of bad) assert.equal(safeDeepLink(value), null, JSON.stringify(value))
  })

  it('refuses a missing or non-string value', () => {
    assert.equal(safeDeepLink(null), null)
    assert.equal(safeDeepLink(undefined), null)
    assert.equal(safeDeepLink(42 as unknown as string), null)
  })
})

describe('confidence labels (measured, rule-based and estimate are different statements)', () => {
  it('names each kind and says an estimate is not a measured fact', () => {
    assert.deepEqual(confidenceLabel('measured'), { label: 'Measured', note: 'Counted from your records.', isEstimate: false })
    assert.equal(confidenceLabel('rule_based').label, 'Rule-based')
    const estimate = confidenceLabel('ai_estimate')
    assert.equal(estimate.label, 'AI estimate')
    assert.equal(estimate.note, 'Estimate, not a measured fact.')
    assert.equal(estimate.isEstimate, true)
  })

  it('treats an unknown value as Unclassified: never measured, and never an AI estimate either', () => {
    const unknown = confidenceLabel('definitely_true' as never)
    assert.equal(unknown.label, 'Unclassified')
    assert.equal(unknown.isEstimate, false)
    assert.equal(confidenceLabel('ai_estimate').label, 'AI estimate')
  })

  it('looks different without relying on colour: the estimate is dashed, the measured one is not', () => {
    assert.match(CONFIDENCE_CHIP.ai_estimate, /border-dashed/)
    assert.doesNotMatch(CONFIDENCE_CHIP.measured, /border-dashed/)
    assert.doesNotMatch(CONFIDENCE_CHIP.rule_based, /border-dashed/)
  })
})

describe('coverage wording (never a zero for "not enough data")', () => {
  it('says "Based on N of M" with the percentage when the data is enough', () => {
    const t = coverageText({ observed: 12, expected: 15, percent: 80, basis: 'active employees', sufficient: true, reason: null })
    assert.equal(t.headline, 'Based on 12 of 15 active employees (80%)')
    assert.equal(t.sufficient, true)
    assert.equal(t.reason, null)
  })

  it('drops "of M" when the expectation is unknown, and never invents one', () => {
    assert.equal(coverageText({ observed: 7, expected: null, percent: null, basis: 'open deals', sufficient: true, reason: null }).headline, 'Based on 7 open deals')
    assert.equal(coverageText({ observed: 7, expected: 0, percent: null, basis: 'open deals', sufficient: true, reason: null }).headline, 'Based on 7 open deals')
  })

  it('answers "Not enough data to assess" with the server reason, and does not print the thin figure as a result', () => {
    const t = coverageText({ observed: 2, expected: 10, percent: 20, basis: 'records', sufficient: false, reason: 'Only 2 record(s) support this; at least 5 are needed.' })
    assert.equal(t.headline, 'Not enough data to assess')
    assert.equal(t.reason, 'Only 2 record(s) support this; at least 5 are needed.')
    assert.doesNotMatch(t.headline, /\d/)
  })

  it('gives a plain reason when the server gave none', () => {
    assert.ok(coverageText({ observed: 0, expected: null, percent: null, basis: '', sufficient: false, reason: null }).reason)
  })
})

describe('severity', () => {
  it('orders info < attention < high < critical and labels each with words', () => {
    assert.ok(severityRank('info') < severityRank('attention'))
    assert.ok(severityRank('attention') < severityRank('high'))
    assert.ok(severityRank('high') < severityRank('critical'))
    assert.deepEqual((['info', 'attention', 'high', 'critical'] as const).map(severityLabel), ['For information', 'Needs a look', 'High priority', 'Critical'])
  })

  it('sorts most urgent first, then newest, then by title', () => {
    const items = [
      insight({ key: 'a', title: 'B', severity: 'attention', as_of: '2026-11-20T00:00:00Z' }),
      insight({ key: 'b', title: 'A', severity: 'critical', as_of: '2026-11-19T00:00:00Z' }),
      insight({ key: 'c', title: 'C', severity: 'attention', as_of: '2026-11-21T00:00:00Z' }),
      insight({ key: 'd', title: 'A2', severity: 'attention', as_of: '2026-11-21T00:00:00Z' }),
    ]
    assert.deepEqual(sortInsights(items).map((i) => i.key), ['b', 'd', 'c', 'a'])
    assert.deepEqual(items.map((i) => i.key), ['a', 'b', 'c', 'd'], 'the input is not mutated')
  })

  it('"needs attention" is high and critical only', () => {
    const items = (['info', 'attention', 'high', 'critical'] as const).map((s) => insight({ key: s, severity: s }))
    assert.deepEqual(needsAttention(items).map((i) => i.key), ['critical', 'high'])
  })

  it('every severity chip carries a word-bearing, solid surface (no status colour as text)', () => {
    for (const { name, classes } of TEXT_ON_SURFACE) {
      const texts = classes.match(/(?:^|\s)text-(?:foreground|muted-foreground)(?=\s|$)/g) ?? []
      assert.equal(texts.length, 1, `${name}: exactly one solid text token`)
      assert.doesNotMatch(classes, /text-(primary|success|destructive|amber|orange|red|green)/, `${name}: no status colour as text`)
      assert.doesNotMatch(classes, /bg-\S+\/\d+/, `${name}: no tinted surface`)
    }
    assert.ok(Object.keys(SEVERITY_CHIP).length === 4)
  })
})

describe('time', () => {
  it('formats the server UTC time and says UTC', () => {
    assert.equal(formatAsOf('2026-11-21T09:30:00Z'), '21 Nov 2026, 09:30 UTC')
  })
  it('says "Time not recorded" instead of inventing one', () => {
    for (const bad of [null, undefined, '', 'yesterday']) assert.equal(formatAsOf(bad as never), 'Time not recorded')
  })
})

describe('evidence', () => {
  it('writes metrics, windows and record references as plain lines', () => {
    assert.equal(evidenceLine({ kind: 'metric', label: 'Due in 30 days', value: 1234, unit: 'certifications' }), 'Due in 30 days: 1,234 certifications')
    assert.equal(evidenceLine({ kind: 'window', label: 'Window', from: '2026-11-21', to: '2026-12-21' }), 'Window: 2026-11-21 to 2026-12-21')
    assert.equal(evidenceLine({ kind: 'entity', label: 'Certification', entity_type: 'certification', entity_id: 91 }), 'Certification (record 91)')
  })

  it('never turns a missing value into zero', () => {
    assert.equal(formatMetricValue(null), 'not recorded')
    assert.equal(formatMetricValue(undefined), 'not recorded')
    assert.equal(formatMetricValue(''), 'not recorded')
    assert.equal(formatMetricValue(Number.NaN), 'not recorded')
    assert.equal(formatMetricValue(0), '0', 'a real zero is still zero')
    assert.equal(evidenceLine({ kind: 'metric', label: 'Overdue', value: null, unit: 'invoices' }), 'Overdue: not recorded')
  })

  it('lists each source once', () => {
    const sources = evidenceSources([
      { kind: 'metric', label: 'a', value: 1, source: 'Deals' },
      { kind: 'metric', label: 'b', value: 2, source: 'Deals' },
      { kind: 'metric', label: 'c', value: 3, source: 'Invoices' },
      { kind: 'window', label: 'w', from: 'x', to: 'y' },
    ])
    assert.deepEqual(sources, ['Deals', 'Invoices'])
  })
})

describe('empty states (an all-clear is only claimed when the checks ran)', () => {
  it('reads both shapes of states and ignores "not applicable"', () => {
    assert.deepEqual(statesOf({ states: ['ok', 'insufficient_data'] }), ['ok', 'insufficient_data'])
    assert.deepEqual(statesOf({ states: { a: 'ok', b: 'error' } }), ['ok', 'error'])
    // What the backend actually sends: a count per state.
    assert.deepEqual(statesOf({ states: { ok: 2, insufficient_data: 1, not_applicable: 0, error: 0 } }), ['ok', 'ok', 'insufficient_data'])
    assert.equal(emptyVerdict(statesOf({ states: { ok: 3, insufficient_data: 0, not_applicable: 2, error: 0 } })), 'all_ok')
    assert.equal(emptyVerdict(statesOf({ states: { ok: 0, insufficient_data: 4, not_applicable: 0, error: 0 } })), 'all_insufficient')
    assert.equal(emptyVerdict(statesOf({ states: { ok: 1, insufficient_data: 1, not_applicable: 0, error: 0 } })), 'mixed')
    assert.deepEqual(statesOf({ states: { unknown_key: 7 } }), [], 'unrecognised keys never become states')
    assert.deepEqual(statesOf({}), [])
    assert.deepEqual(statesOf(undefined), [])
  })

  it('says "Nothing needs attention" only when every relevant check ran', () => {
    assert.equal(emptyVerdict(['ok', 'ok']), 'all_ok')
    assert.equal(emptyVerdict(['ok', 'not_applicable']), 'all_ok')
    assert.equal(emptyWording('all_ok').title, 'Nothing needs attention')
  })

  it('says "Not enough data to assess yet" when none could', () => {
    assert.equal(emptyVerdict(['insufficient_data', 'insufficient_data']), 'all_insufficient')
    assert.equal(emptyWording('all_insufficient').title, 'Not enough data to assess yet')
    assert.match(emptyWording('all_insufficient').detail, /not the same as everything being fine/)
  })

  it('does not claim an all-clear for a mix, for errors, or when it was not told', () => {
    assert.equal(emptyVerdict(['ok', 'insufficient_data']), 'mixed')
    assert.equal(emptyVerdict(['ok', 'error']), 'mixed')
    assert.equal(emptyVerdict(['error']), 'all_error')
    assert.equal(emptyVerdict([]), 'unknown')
    assert.equal(emptyVerdict(['not_applicable']), 'unknown')
    for (const verdict of ['mixed', 'all_error', 'unknown'] as const) assert.notEqual(emptyWording(verdict).title, 'Nothing needs attention')
  })

  it('lists the checks that could not assess first', () => {
    const sorted = sortDetectors([
      detector({ detector: 'a', title: 'A', state: 'ok' }),
      detector({ detector: 'b', title: 'B', state: 'insufficient_data' }),
      detector({ detector: 'c', title: 'C', state: 'error' }),
      detector({ detector: 'd', title: 'D', state: 'not_applicable' }),
    ])
    assert.deepEqual(sorted.map((d) => d.detector), ['c', 'b', 'a', 'd'])
  })
})

describe('links, notices, queries', () => {
  it('names the module a link opens, or says "the record"', () => {
    assert.equal(openLabel('/gtm/deals'), 'Open in GTM')
    assert.equal(openLabel('/signals'), 'Open in Signals')
    assert.equal(openLabel('/module/crm/sales/invoices'), 'Open in CRM')
    assert.equal(openLabel('/dashboard/attendance'), 'Open in Attendance')
    assert.equal(openLabel('/something-else'), 'Open the record')
    assert.equal(openLabel(null), 'Open the record')
  })

  it('always carries the provisional notice, preferring the server wording', () => {
    assert.equal(provisionalNotice(undefined), PROVISIONAL_NOTICE)
    assert.equal(provisionalNotice({ thresholds_note: '  ' }), PROVISIONAL_NOTICE)
    assert.equal(provisionalNotice(META), 'Thresholds are provisional.')
    assert.match(PROVISIONAL_NOTICE, /provisional/)
  })

  it('mentions withheld insights without saying how many or which', () => {
    assert.equal(suppressedNotice({ suppressed_count: 0 }), null)
    assert.equal(suppressedNotice({}), null)
    assert.equal(
      coverageText({ observed: null, expected: null, percent: null, basis: 'people in your team', sufficient: true, reason: null }).headline,
      'Based on people in your team',
      'a withheld count is never shown as a number',
    )
    assert.equal(suppressedNotice({ suppressed_count: null }), null, 'null count and no note: nothing to say')
    assert.equal(suppressedNotice({ suppressed_count: null, suppression_note: 'Some results are withheld to protect small groups.' }), 'Some results are withheld to protect small groups.')
    const text = suppressedNotice({ suppressed_count: 3 })
    assert.ok(text)
    assert.doesNotMatch(text, /\d/)
  })
})

describe('service helpers', () => {
  it('leaves empty values out of the query string entirely', () => {
    assert.equal(insightsQuery(), undefined)
    assert.equal(insightsQuery({ domain: undefined, category: '' }), undefined)
    assert.deepEqual(insightsQuery({ surface: 'gtm_deals', per_page: 10, severity: 'high' }), { surface: 'gtm_deals', per_page: '10', severity: 'high' })
  })

  it('never puts a tenant, user or role into a request', () => {
    const query = insightsQuery({ surface: 'attendance', page: 2 }) ?? {}
    for (const forbidden of ['sub_institute_id', 'tenant', 'user_id', 'role', 'token']) assert.equal(forbidden in query, false)
  })

  it('maps failures to fixed, friendly meanings and never echoes the server text', () => {
    const forbidden = classifyIntelligenceError({ status: 403, message: 'SQLSTATE[42S02]: Base table not found: tbluser' })
    assert.equal(forbidden.kind, 'forbidden')
    assert.equal(forbidden.message, 'Intelligence is not available for your account.')
    assert.equal(forbidden.retryable, false)
    assert.equal(classifyIntelligenceError({ status: 401 }).kind, 'unauthenticated')
    assert.equal(classifyIntelligenceError({ status: 401 }).retryable, false)
    assert.equal(classifyIntelligenceError({ status: 503 }).kind, 'unavailable')
    assert.equal(classifyIntelligenceError({ status: 429 }).kind, 'rate_limited')
    assert.equal(classifyIntelligenceError({ status: 500, message: 'boom with a stack trace' }).kind, 'generic')
    assert.equal(classifyIntelligenceError(new Error('network down')).kind, 'generic')
    assert.equal(classifyIntelligenceError(null).kind, 'generic')
    for (const status of [401, 403, 429, 500, 503]) assert.doesNotMatch(classifyIntelligenceError({ status, message: 'SQLSTATE' }).message, /SQLSTATE/)
  })
})

describe('source scan: the Intelligence components never use the colour patterns that failed contrast before', () => {
  // Tests run from the repository root (npm test), as lib/agent/contrast.test.ts does.
  const root = join(process.cwd(), 'components/domain/intelligence')
  const files = readdirSync(root).filter((f) => f.endsWith('.tsx'))

  it('has components to scan', () => {
    assert.ok(files.length >= 5)
  })

  for (const file of files) {
    it(`${file}: no status colour as text, no tinted status surface, no raw hex`, () => {
      const source = readFileSync(join(root, file), 'utf8')
      assert.doesNotMatch(source, /text-(primary|success|destructive|warning)(?![-\w])/)
      assert.doesNotMatch(source, /bg-(primary|success|destructive|warning)\/\d+/)
      assert.doesNotMatch(source, /#[0-9a-fA-F]{6}\b/)
    })

    it(`${file}: never builds an href from server text except through safeDeepLink`, () => {
      const source = readFileSync(join(root, file), 'utf8')
      const hrefs = source.match(/href=\{[^}]+\}/g) ?? []
      for (const href of hrefs) assert.match(href, /link|INTELLIGENCE_CENTER_PATH/, href)
      assert.doesNotMatch(source, /dangerouslySetInnerHTML/)
    })
  }
})
