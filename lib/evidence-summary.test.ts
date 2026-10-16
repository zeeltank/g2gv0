import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { summariseEvidence } from './evidence-summary'
import type { Opportunity } from '../services/signals/opportunities'

const base = { id: 1, company_name: 'X' } as Opportunity

describe('summariseEvidence', () => {
  it('puts what the source shows under verified, our reading under inferred, and gaps under not established', () => {
    const s = summariseEvidence({
      ...base,
      source_published_at: '2026-10-14',
      assessment: {
        evidence: { quote_verified: true, read_as: 'page_text', sources_naming_school: 1, stated_or_inferred: 'inferred', date_status: 'source_date_only', source_published_at: '2026-10-14', inference_reasoning: 'Several campuses imply one system is needed.' },
        identity: { status: 'target_exact', account_id: 3, account_name: 'Podar World School', crm_ref: null, reasons: [] },
        buying_intent: { level: 'weak', meaning: '', indicators: [] },
        product_fit: { part: 'school_erp', what_it_does: 'ERP', reason: 'A new campus needs admissions and fees.' },
        unverified: ['Budget is not stated.'],
      },
    } as Opportunity)

    assert.ok(s.verified.includes('The quoted wording was found in the source text.'))
    assert.ok(s.verified.includes('The full page was read.'))
    assert.ok(s.verified.some((l) => l.includes('14 Oct 2026')))
    assert.ok(s.verified.some((l) => l.includes('Podar World School')))
    assert.deepEqual(s.inferred, ['Several campuses imply one system is needed.', 'Fit with the product: A new campus needs admissions and fees.'])
    assert.ok(s.missing.includes('Nothing in the source shows a purchase process: this is a possible need.'))
    assert.ok(s.missing.includes('Budget is not stated.'))
  })

  it('says a missing date is missing, and never turns an absent field into a verified line', () => {
    const s = summariseEvidence({ ...base, source_published_at: null, assessment: { evidence: { quote_verified: false, read_as: 'search_snippet', sources_naming_school: 1, stated_or_inferred: 'stated', date_status: 'undated', inference_reasoning: null } } } as Opportunity)
    assert.deepEqual(s.verified, [])
    assert.ok(s.missing.some((l) => l.includes('No publication date')))
    assert.ok(s.missing.some((l) => l.includes('search snippet')))
  })

  it('flags an unconfirmed or unrelated identity as not established', () => {
    const possible = summariseEvidence({ ...base, assessment: { identity: { status: 'target_possible', account_id: 1, account_name: 'A', crm_ref: null, reasons: [] } } } as Opportunity)
    assert.ok(possible.missing.includes('Which school this is has not been confirmed.'))
    const unrelated = summariseEvidence({ ...base, assessment: { identity: { status: 'unrelated', account_id: null, account_name: null, crm_ref: null, reasons: [] } } } as Opportunity)
    assert.ok(unrelated.missing.includes('It is not on your target list.'))
  })

  it('handles an older record with no assessment without inventing anything', () => {
    const s = summariseEvidence({ ...base, source_published_at: null, confirmed_facts: ['Opened a campus in Surat'] } as Opportunity)
    assert.deepEqual(s.verified, ['Opened a campus in Surat'])
    assert.deepEqual(s.inferred, [])
    assert.deepEqual(s.missing, ['No publication date on the source, so how recent this is is unknown.'])
  })

  it('does not repeat a gap that two fields both state', () => {
    const s = summariseEvidence({ ...base, assessment: { unverified: ['Budget is not stated.'] }, unverified_claims: ['Budget is not stated.'] } as Opportunity)
    assert.equal(s.missing.filter((l) => l === 'Budget is not stated.').length, 1)
  })
})
