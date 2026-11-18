import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { SignalRun } from '../../services/signal-review/runs-service'
import {
  decidedByText, decisionLabel, dialogTitle, formatCount, formatDateTime, formatDuration, formatMoney, isManual, reasonText, relativeTime,
  runNeedsReason, runReason, runStatusLabel, sortRunsNewestFirst, statusLabel, submitLabel, sumCostByCurrency, sumKnown, summariseRuns, totalTokens, viaTag,
} from './format'

function run(over: Partial<SignalRun> = {}): SignalRun {
  return {
    id: 1, trigger: 'manual', status: 'success', started_at: '2026-11-03T10:00:00+05:30', completed_at: null, duration_seconds: 60,
    product_key: null, product_master_id: null, product_name: null, signals_found: 0, signals_new: 0,
    ai_input_tokens: null, ai_output_tokens: null, ai_cost: null, ai_cost_currency: null, search_requests: null, search_credits: null,
    error_code: null, error_message: null, stage_message: null, ...over,
  }
}

describe('decision words', () => {
  it('calls Follow-up "Contacted" and a dismissal "Not relevant" everywhere', () => {
    assert.equal(decisionLabel('follow_up'), 'Contacted')
    assert.equal(decisionLabel('dismissed'), 'Not relevant')
    assert.equal(decisionLabel('reviewed'), 'Reviewed')
    assert.equal(decisionLabel('reopened'), 'Reopened')
    assert.equal(decisionLabel('promoted'), 'Promoted to lead')
    assert.equal(statusLabel('Follow-up'), 'Contacted')
    assert.equal(statusLabel('Dismissed'), 'Not relevant')
    assert.equal(statusLabel('New'), 'Needs decision')
  })

  it('titles the dialog and its button for each way of opening it', () => {
    assert.deepEqual((['dismissed', 'follow_up', 'reviewed', 'reopened'] as const).map(dialogTitle), ['Not relevant', 'Contacted', 'Reviewed', 'Reopen'])
    assert.equal(submitLabel('dismissed'), 'Mark not relevant')
    assert.equal(submitLabel('reopened'), 'Reopen')
  })

  it('shows the reason label, else the raw code, else nothing', () => {
    assert.equal(reasonText({ reason_code: 'stale', reason_label: 'Too old to act on' }), 'Too old to act on')
    assert.equal(reasonText({ reason_code: 'retired_code', reason_label: null }), 'retired_code')
    assert.equal(reasonText({ reason_code: null, reason_label: null }), null)
    assert.equal(reasonText({ reason_code: '  ', reason_label: ' ' }), null)
  })

  it('tags only rows that did not come from this screen', () => {
    assert.equal(viaTag('legacy_screen')?.label, 'original screen')
    assert.equal(viaTag('backfill')?.label, 'earlier record')
    assert.equal(viaTag('signal_review'), null)
    assert.equal(viaTag('promote'), null)
  })

  it('says "not recorded" for an unknown decider and never guesses', () => {
    assert.equal(decidedByText('Milan Baldaniya'), 'by Milan Baldaniya')
    assert.equal(decidedByText(null), 'by someone (not recorded)')
    assert.equal(decidedByText('   '), 'by someone (not recorded)')
  })
})

describe('dates', () => {
  it('writes an absolute date and time in the given zone', () => {
    assert.equal(formatDateTime('2026-11-03T10:15:00+05:30', { timeZone: 'Asia/Kolkata' }), '3 Nov 2026, 10:15')
    assert.equal(formatDateTime('2026-11-03T10:15:00+05:30', { timeZone: 'UTC' }), '3 Nov 2026, 04:45')
    assert.equal(formatDateTime('2026-11-03T00:05:00Z', { timeZone: 'UTC' }), '3 Nov 2026, 00:05', 'midnight is 00, not 24')
  })

  it('shows a dash for no date, and a string that is not a date as it came', () => {
    assert.equal(formatDateTime(null), '—')
    assert.equal(formatDateTime('last Tuesday'), 'last Tuesday')
  })

  it('writes how long ago, in the largest sensible unit', () => {
    const now = new Date('2026-11-03T12:00:00Z')
    const ago = (iso: string) => relativeTime(iso, now)
    assert.equal(ago('2026-11-03T11:59:40Z'), 'just now')
    assert.equal(ago('2026-11-03T11:55:00Z'), '5 minutes ago')
    assert.equal(ago('2026-11-03T11:00:00Z'), '1 hour ago')
    assert.equal(ago('2026-11-03T09:00:00Z'), '3 hours ago')
    assert.equal(ago('2026-11-02T12:00:00Z'), '1 day ago')
    assert.equal(ago('2026-10-20T12:00:00Z'), '14 days ago')
    assert.equal(ago('2026-08-01T12:00:00Z'), '3 months ago')
    assert.equal(ago('2024-11-01T12:00:00Z'), '2 years ago')
    assert.equal(ago('2026-11-05T12:00:00Z'), 'in 2 days')
    assert.equal(relativeTime(null, now), null)
    assert.equal(relativeTime('nonsense', now), null)
  })
})

describe('numbers', () => {
  it('writes rupees with the rupee sign and Indian grouping', () => {
    assert.equal(formatMoney(123456.78, 'INR'), '₹1,23,456.78')
    assert.equal(formatMoney(1234567.5, 'INR'), '₹12,34,567.50')
    assert.equal(formatMoney(999, 'INR'), '₹999.00')
    assert.equal(formatMoney(1.5, 'INR'), '₹1.50')
  })

  it('keeps four decimals under one rupee, so a small run does not read ₹0.00', () => {
    assert.equal(formatMoney(0.0042, 'INR'), '₹0.0042')
    assert.equal(formatMoney(0.5, 'INR'), '₹0.5000')
    assert.equal(formatMoney(0.99996, 'INR'), '₹1.00', 'rounding up to one does not print 1.0000')
    assert.equal(formatMoney(0.00001, 'INR'), '<₹0.0001', 'a positive amount is never printed as zero')
  })

  it('shows an unknown cost as a dash and a recorded zero as zero, never the other way round', () => {
    assert.equal(formatMoney(null, 'INR'), '—')
    assert.equal(formatMoney(undefined, 'INR'), '—')
    assert.equal(formatMoney(Number.NaN, 'INR'), '—')
    assert.equal(formatMoney(0, 'INR'), '₹0.00')
    assert.equal(formatMoney(0, 'USD'), '$0.00')
  })

  it('writes dollars with the dollar sign and the same small-amount rule', () => {
    assert.equal(formatMoney(1234.5, 'USD'), '$1,234.50')
    assert.equal(formatMoney(0.0412, 'USD'), '$0.0412')
    assert.equal(formatMoney(0.00001, 'USD'), '<$0.0001')
    assert.equal(formatMoney(1.5, 'usd'), '$1.50', 'the code is not case sensitive')
  })

  it('writes the code before the number for a currency it has no symbol for, and a dash with no currency at all', () => {
    assert.equal(formatMoney(12.5, 'EUR'), 'EUR 12.50')
    assert.equal(formatMoney(0.0042, 'EUR'), 'EUR 0.0042')
    assert.equal(formatMoney(12.5, null), '—', 'an amount nobody can read as money is not shown as one')
    assert.equal(formatMoney(12.5, ''), '—')
  })

  it('shows an unknown count as a dash and a recorded zero as 0', () => {
    assert.equal(formatCount(null), '—')
    assert.equal(formatCount(0), '0')
    assert.equal(formatCount(96214), '96,214')
  })

  it('writes durations, and a dash when there is none', () => {
    assert.equal(formatDuration(null), '—')
    assert.equal(formatDuration(0), '0 s')
    assert.equal(formatDuration(42), '42 s')
    assert.equal(formatDuration(185), '3 min 05 s')
    assert.equal(formatDuration(3720), '1 h 02 min')
    assert.equal(formatDuration(-5), '—')
  })

  it('sums only the known values and counts the unknown ones', () => {
    assert.deepEqual(sumKnown([1.5, null, 2, undefined]), { total: 3.5, known: 2, unknown: 2 })
    assert.deepEqual(sumKnown([null, null]), { total: null, known: 0, unknown: 2 })
    assert.deepEqual(sumKnown([0, 0]), { total: 0, known: 2, unknown: 0 })
    assert.deepEqual(sumKnown([]), { total: null, known: 0, unknown: 0 })
  })

  it('totals tokens only when both halves are known', () => {
    assert.equal(totalTokens({ ai_input_tokens: 90, ai_output_tokens: 6 }), 96)
    assert.equal(totalTokens({ ai_input_tokens: 90, ai_output_tokens: null }), null)
    assert.equal(totalTokens({ ai_input_tokens: 0, ai_output_tokens: 0 }), 0)
  })
})

describe('runs', () => {
  it('knows a manual run whatever its case', () => {
    assert.equal(isManual({ trigger: 'manual' }), true)
    assert.equal(isManual({ trigger: ' Manual ' }), true)
    assert.equal(isManual({ trigger: 'scheduled' }), false)
  })

  it('names statuses and says which ones need their reason spelled out', () => {
    assert.equal(runStatusLabel('timed_out'), 'Timed out')
    assert.equal(runStatusLabel('weird'), 'weird')
    assert.deepEqual(['failed', 'skipped', 'timed_out', 'success', 'partial', 'running'].map(runNeedsReason), [true, true, true, false, false, false])
  })

  it('gives the recorded reason, the next best thing, or says none was recorded', () => {
    assert.equal(runReason({ error_message: 'Quota used up', stage_message: 'x', error_code: 'c' }), 'Quota used up')
    assert.equal(runReason({ error_message: null, stage_message: 'Another run held the slot', error_code: 'c' }), 'Another run held the slot')
    assert.equal(runReason({ error_message: null, stage_message: null, error_code: 'busy' }), 'busy')
    assert.equal(runReason({ error_message: null, stage_message: null, error_code: null }), 'No reason recorded.')
  })

  it('sorts newest first, runs with no start time last, ties by id', () => {
    const sorted = sortRunsNewestFirst([
      run({ id: 1, started_at: '2026-11-01T10:00:00Z' }),
      run({ id: 2, started_at: null }),
      run({ id: 3, started_at: '2026-11-02T10:00:00Z' }),
      run({ id: 4, started_at: '2026-11-02T10:00:00Z' }),
    ])
    assert.deepEqual(sorted.map((r) => r.id), [4, 3, 1, 2])
  })

  it('summarises counts, the last run, manual-only and the sums that ignore unknowns', () => {
    const summary = summariseRuns([
      run({ id: 1, status: 'success', ai_cost: 0.04, ai_cost_currency: 'INR', ai_input_tokens: 90, ai_output_tokens: 6, search_requests: 38 }),
      run({ id: 2, status: 'failed', started_at: '2026-11-03T12:00:00Z', ai_cost: null }),
      run({ id: 3, status: 'partial', ai_cost: 0.01, ai_cost_currency: 'INR', ai_input_tokens: 10, ai_output_tokens: 0, search_requests: 0 }),
      run({ id: 4, status: 'running' }),
    ])
    assert.equal(summary.total, 4)
    assert.equal(summary.last?.id, 2)
    assert.deepEqual(summary.counts, { success: 1, partial: 1, failed: 1, skipped: 0, other: 1 })
    assert.equal(summary.allManual, true)
    assert.equal(summary.scheduled, 0)
    assert.deepEqual(summary.cost, { byCurrency: [{ currency: 'INR', total: 0.05, runs: 2 }], known: 2, unknown: 2 })
    assert.deepEqual(summary.tokens, { total: 106, known: 2, unknown: 2 })
    assert.deepEqual(summary.searches, { total: 38, known: 2, unknown: 2 })
  })

  it('is not "all manual" with a scheduled run, or with no runs at all', () => {
    assert.equal(summariseRuns([run({ id: 1 }), run({ id: 2, trigger: 'scheduled' })]).allManual, false)
    assert.equal(summariseRuns([run({ id: 1 }), run({ id: 2, trigger: 'scheduled' })]).scheduled, 1)
    const none = summariseRuns([])
    assert.equal(none.allManual, false)
    assert.equal(none.last, null)
    assert.deepEqual(none.cost, { byCurrency: [], known: 0, unknown: 0 })
  })
})

describe('the cost sum', () => {
  const cost = (amount: number | null, currency: string | null) => ({ ai_cost: amount, ai_cost_currency: currency })

  it('keeps a total per currency and never adds rupees to dollars', () => {
    const sum = sumCostByCurrency([cost(0.5, 'INR'), cost(2, 'USD'), cost(1.25, 'INR'), cost(1, 'USD')])
    assert.deepEqual(sum.byCurrency, [{ currency: 'INR', total: 1.75, runs: 2 }, { currency: 'USD', total: 3, runs: 2 }])
    assert.equal(sum.known, 4)
  })

  it('lists rupees first, then dollars, then other codes alphabetically, whatever order the runs come in', () => {
    const sum = sumCostByCurrency([cost(1, 'USD'), cost(1, 'GBP'), cost(1, 'EUR'), cost(1, 'INR')])
    assert.deepEqual(sum.byCurrency.map((entry) => entry.currency), ['INR', 'USD', 'EUR', 'GBP'])
  })

  it('leaves runs with no cost, and an amount with no currency, out of every total and counts them as unknown', () => {
    const sum = sumCostByCurrency([cost(1, 'INR'), cost(null, null), cost(5, null), cost(null, 'INR')])
    assert.deepEqual(sum.byCurrency, [{ currency: 'INR', total: 1, runs: 1 }])
    assert.deepEqual([sum.known, sum.unknown], [1, 3])
  })

  it('treats a recorded zero as a known cost of zero', () => {
    const sum = sumCostByCurrency([cost(0, 'INR')])
    assert.deepEqual(sum.byCurrency, [{ currency: 'INR', total: 0, runs: 1 }])
    assert.equal(sum.unknown, 0)
  })

  it('has no currency at all when no run has a cost', () => {
    assert.deepEqual(sumCostByCurrency([cost(null, null), cost(null, null)]), { byCurrency: [], known: 0, unknown: 2 })
  })

  it('does not leave floating point dust in a total', () => {
    assert.equal(sumCostByCurrency([cost(0.1, 'INR'), cost(0.2, 'INR')]).byCurrency[0].total, 0.3)
  })
})
