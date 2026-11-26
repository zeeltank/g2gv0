import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from './scaffolds/dom-test-kit'
import type { ProductOffer, SignalMatchingResponse } from '../services/portfolio/types'

/**
 * The matching modal of an organisation's signal (Business Opportunity Intelligence), after the Partner Network was removed (26 Nov 2026): three steps now (the signal's
 * evidence, the matching offers, the human review), no partner evaluations, and a decision that sends no partner. The service is replaced by a fake that records what the
 * modal asks, so the real requests are not the subject; what a person reads and which payload a decision builds are.
 */

const OFFER = {
  id: 7, offer_id: 'SCH-01', name: 'Fee Suite', parent_product: 'Scholar K-12', readiness_status: 'Live – with client', readiness_confirmed: false, partner_sellable: true,
  what_it_does: 'Collects fees online.', deployment_model: 'cloud',
} as ProductOffer

/** What the server answers for a signal. An older server still sends `partner_evaluations` on every offer; the modal must not read or show it. */
function answer(withOldPartnerField: boolean): { status: number; data: SignalMatchingResponse } {
  const match = {
    offer: OFFER, match_score: 82, matched_needs: ['N07'], matched_segments: ['k12'], matched_signals: ['funding'],
    match_reasons: ['The school collects fees late (need N07)'], satisfied_criteria: [], missing_criteria: [], match_status: 'Matched',
    ...(withOldPartnerField ? { partner_evaluations: [{ partner: { partner_id: 'P-9', partner_name: 'Old Partner Pvt Ltd', partner_type: 'Regional SI' }, eligibility_status: 'eligible', rule_evaluations: {} }] } : {}),
  }
  return {
    status: 1,
    data: { evidence: { identified_needs: ['N07'], target_segments: ['k12'], trigger_signals: ['funding'], geography: 'Gujarat' }, offer_matches: [match] } as unknown as SignalMatchingResponse,
  }
}

async function open(withOldPartnerField: boolean) {
  const k = await kit()
  /* eslint-disable @typescript-eslint/no-require-imports */
  // `require`, not `import()`: the modal reads the auth context through the same loader, and a dynamic import would give this file a second copy of the module.
  const { AuthContext } = require('../components/auth/gtg-auth') as typeof import('../components/auth/gtg-auth')
  /* eslint-enable @typescript-eslint/no-require-imports */
  const { portfolioService } = await import('../services/portfolio/portfolio-service')
  const decisions: Array<Record<string, unknown>> = []
  Object.assign(portfolioService, {
    getSignalMatches: async () => answer(withOldPartnerField),
    actOnMatch: async (_context: unknown, payload: Record<string, unknown>) => { decisions.push(payload); return { status: 1, message: 'Saved.', data: null } },
  })
  const { BusinessOpportunityMatchingModal } = await import('../components/domain/organization/department-management/business-opportunity-matching-modal')
  const context = { token: 'test-token', subInstituteId: '1', syear: '', userId: '2', organizationId: '', orgType: '', profileId: '1' } as never
  await k.render(k.h(AuthContext.Provider, { value: { user: null } as never }, k.h(BusinessOpportunityMatchingModal, { open: true, signalType: 'signal', signalId: 5, signalTitle: 'A school opened a new branch', context })))
  await k.tick(60)
  return { k, decisions }
}

describe('the matching modal without the Partner Network', () => {
  afterEach(disposeAll)

  it('has three steps: the signal evidence, the matching offers and the human review, and says nothing about partners being evaluated', async () => {
    const { k } = await open(false)
    const text = k.bodyText()
    for (const part of ['Step 1: Extracted Signal Evidence', 'Step 2: Matching Portfolio Offers (1)', 'Step 3: Human Review & Follow-up Decision', 'Explainable Match Rationale', 'The school collects fees late (need N07)', '82% fit', 'Fee Suite']) {
      assert.ok(text.includes(part), part)
    }
    assert.ok(text.includes('Signal evidence → Identified Need → Matching Offers → Review & Follow-up'), 'the line under the title lists the steps that are left')
    for (const gone of ['Step 4', 'Partner Eligibility', 'Eligible Partner', 'eligible partner', 'Partner Network', 'workbook eligibility rules', 'partner network']) assert.ok(!text.includes(gone), `no "${gone}"`)
  })

  it('keeps the Partner Sellable badge of an offer: it is a readiness flag of the product, not the registry', async () => {
    const { k } = await open(false)
    assert.ok(k.bodyText().includes('Partner Sellable'))
  })

  it('does not read or show the partner list an older server still sends with every offer', async () => {
    const { k } = await open(true)
    const text = k.bodyText()
    assert.ok(text.includes('Step 3: Human Review & Follow-up Decision'), 'the modal still draws')
    for (const gone of ['Old Partner Pvt Ltd', 'P-9', 'Regional SI', 'Eligible Partner', 'Ineligible']) assert.ok(!text.includes(gone), `no "${gone}"`)
  })

  it('sends a review decision with no partner in it, and shows the new status on the offer', async () => {
    const { k, decisions } = await open(true)
    await k.click(k.withText('Mark Reviewed')!)
    await k.tick(40)
    assert.equal(decisions.length, 1)
    assert.deepEqual(decisions[0], { signal_type: 'signal', signal_id: 5, offer_id: 'SCH-01', action: 'review', review_notes: undefined })
    assert.equal('partner_id' in decisions[0], false, 'no partner id is sent, even when the server sent a partner list')
    assert.ok(k.bodyText().includes('Status: Reviewed'), 'the status of the offer changed on screen')
  })
})
