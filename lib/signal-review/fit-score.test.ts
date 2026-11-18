import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { SignalAssessment, SignalScores } from '../../services/signal-review/signal-types'
import { fitModel, fitScoreModel, offerViews, SCORE_PARTS, scoreModel } from './fit-score'
import { signalRow } from './signal-fixtures'

const FULL_SCORES: SignalScores = { total: 24, buying_signal: 4, problem_fit: 4, product_fit: 3, accessibility: 3, urgency: 4, potential_value: 3, evidence_quality: 3 }

const FIT_COMPONENTS = {
  product: { score: 20, max: 20, why: 'a stored part of the product' },
  icp: { score: 10, max: 15, why: 'a buyer type the ICP targets' },
  geography: { score: 8, max: 10, why: 'inside the places the ICP aims at' },
  evidence: { score: 18, max: 25, why: 'the quote was found in the page that was read' },
  intent: { score: 15, max: 20, why: 'buying intent: strong' },
  freshness: { score: 9, max: 10, why: '12 days old' },
}

describe('the score', () => {
  it('lists the seven parts in the order the server names them, with the total', () => {
    const model = scoreModel(FULL_SCORES)!
    assert.equal(model.total, 24)
    assert.deepEqual(model.parts.map((p) => p.key), SCORE_PARTS.map((p) => p.key))
    assert.deepEqual(model.parts.map((p) => p.value), [4, 4, 3, 3, 4, 3, 3])
    assert.equal(model.recorded, 7)
  })

  it('keeps a part the server did not record as null, never as 0', () => {
    const model = scoreModel({ total: 9, buying_signal: 4, urgency: null })!
    assert.equal(model.parts.find((p) => p.key === 'buying_signal')!.value, 4)
    assert.equal(model.parts.find((p) => p.key === 'urgency')!.value, null)
    assert.equal(model.parts.find((p) => p.key === 'problem_fit')!.value, null)
    assert.equal(model.recorded, 1)
  })

  it('treats a recorded 0 as a value, not as missing', () => {
    const model = scoreModel({ total: 3, urgency: 0 })!
    assert.equal(model.parts.find((p) => p.key === 'urgency')!.value, 0)
    assert.equal(model.recorded, 1)
  })

  it('is null for a signal that was never scored, or whose total is not a number', () => {
    assert.equal(scoreModel(null), null)
    assert.equal(scoreModel(undefined), null)
    assert.equal(scoreModel({ total: Number.NaN }), null)
    assert.equal(scoreModel({ total: '24' as unknown as number }), null)
  })

  it('claims no maximum', () => {
    assert.ok(!('max' in scoreModel(FULL_SCORES)!))
  })
})

describe('the fit with the product', () => {
  const assessment = (fit: unknown): SignalAssessment => ({ fit } as SignalAssessment)

  it('reads the total, the server band and the parts, with the maximum added up from the parts', () => {
    const model = fitModel(assessment({ total: 80, band: 'High', components: FIT_COMPONENTS, version: 1 }))!
    assert.equal(model.total, 80)
    assert.equal(model.max, 100)
    assert.equal(model.band, 'High')
    assert.deepEqual(model.parts.map((p) => p.label), ['Product', 'Buyer and trigger', 'Place', 'Evidence', 'Buying intent', 'Freshness'])
    assert.deepEqual(model.parts[3], { key: 'evidence', label: 'Evidence', score: 18, max: 25, why: 'The quote was found in the page that was read' })
  })

  it('states no band when the server stated none', () => {
    assert.equal(fitModel(assessment({ total: 80, components: FIT_COMPONENTS }))!.band, null)
    assert.equal(fitModel(assessment({ total: 80, band: '  ', components: FIT_COMPONENTS }))!.band, null)
    assert.equal(fitModel(assessment({ total: 80, band: null, components: FIT_COMPONENTS }))!.band, null)
  })

  it('claims no maximum when the parts are missing or one of them is broken', () => {
    assert.equal(fitModel(assessment({ total: 80 }))!.max, null)
    assert.deepEqual(fitModel(assessment({ total: 80 }))!.parts, [])
    const broken = fitModel(assessment({ total: 80, components: { ...FIT_COMPONENTS, icp: { score: 'ten', max: 15 } } }))!
    assert.equal(broken.max, null, 'a sum over a missing part would be a smaller, wrong number')
    assert.equal(broken.parts.length, 5)
  })

  it('puts the known parts first in the server order and names an unknown one in words', () => {
    const model = fitModel(assessment({ total: 5, components: { extra_check: { score: 1, max: 2 }, freshness: { score: 1, max: 10 }, product: { score: 4, max: 20 } } }))!
    assert.deepEqual(model.parts.map((p) => [p.key, p.label]), [['product', 'Product'], ['freshness', 'Freshness'], ['extra_check', 'Extra check']])
    assert.equal(model.parts[0].why, null)
  })

  it('is null when the signal carries no fit assessment', () => {
    assert.equal(fitModel(null), null)
    assert.equal(fitModel({}), null)
    assert.equal(fitModel(assessment(null)), null)
    assert.equal(fitModel(assessment({ band: 'High' })), null, 'a band without a total is not a fit')
    assert.equal(fitModel(assessment({ total: 'high' })), null)
  })
})

describe('matched offers', () => {
  it('keeps the server order, the match score and the reason', () => {
    const offers = offerViews([
      { offer_id: 'a', offer_name: 'Scholar Core', offer_category: 'Scholar', match_score: 78, rationale: 'Admissions and fees are named.', matched_need_codes: ['N05', 'N07'] },
      { offer_id: 'b', offer_name: 'Scholar Lite', match_score: 40, rationale: '' },
    ])
    assert.deepEqual(offers.map((o) => o.name), ['Scholar Core', 'Scholar Lite'])
    assert.equal(offers[0].score, 78)
    assert.equal(offers[0].rationale, 'Admissions and fees are named.')
    assert.deepEqual(offers[0].needCodes, ['N05', 'N07'])
    assert.equal(offers[1].rationale, null, 'an empty reason is a missing reason')
  })

  it('leaves a match score the server did not store as null, never 0', () => {
    assert.equal(offerViews([{ offer_id: 'a', offer_name: 'X', match_score: null }])[0].score, null)
    assert.equal(offerViews([{ offer_id: 'a', offer_name: 'X' }])[0].score, null)
    assert.equal(offerViews([{ offer_id: 'a', offer_name: 'X', match_score: 0 }])[0].score, 0)
  })

  it('names an offer by its id when the name is missing, and says so when both are', () => {
    assert.equal(offerViews([{ offer_id: 'scholar-core', offer_name: null }])[0].name, 'scholar-core')
    assert.match(offerViews([{ offer_id: null, offer_name: null }])[0].name, /name was not recorded/)
  })

  it('is empty for no offers', () => {
    assert.deepEqual(offerViews(undefined), [])
    assert.deepEqual(offerViews(null), [])
    assert.deepEqual(offerViews([]), [])
  })
})

describe('the whole tab', () => {
  it('reads only the signal: nothing is filled in for a signal that records none of it', () => {
    const bare = signalRow({
      product_master_name: null, relevant_offer_name: null, business_fit: null, assessment: null, scores: null, score_reasoning: null, strength_reason: null,
      confidence: null, claim_level: null, candidate_need_codes: [], matched_offers: [],
    })
    assert.deepEqual(fitScoreModel(bare), {
      product: null, offerName: null, businessFit: null, fit: null, score: null, reasoning: null, confidence: null, claim: null, needCodes: [], offers: [],
    })
  })

  it('reads the reasoning from either name the server uses, score_reasoning first', () => {
    assert.equal(fitScoreModel(signalRow({ score_reasoning: 'A live tender.', strength_reason: 'Older name.' })).reasoning, 'A live tender.')
    assert.equal(fitScoreModel(signalRow({ score_reasoning: null, strength_reason: 'Older name.' })).reasoning, 'Older name.')
    assert.equal(fitScoreModel(signalRow({ score_reasoning: '  ', strength_reason: undefined })).reasoning, null)
  })

  it('names the business fit in the product\'s own words, and the claim level in words', () => {
    const model = fitScoreModel(signalRow({ business_fit: 'scholar', claim_level: 'inference', confidence: 'Medium' }), [{ value: 'scholar', label: 'Scholar ERP', business_fit: 'scholar' }])
    assert.equal(model.businessFit, 'Scholar ERP')
    assert.equal(model.claim, 'Inferred: our reading of what the source says')
    assert.equal(model.confidence, 'Medium')
  })

  it('keeps only real need codes', () => {
    const model = fitScoreModel(signalRow({ candidate_need_codes: ['N05', '', 7 as unknown as string, ' N09 '] }))
    assert.deepEqual(model.needCodes, ['N05', 'N09'])
  })
})
