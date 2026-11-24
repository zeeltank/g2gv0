import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import type { SignalRow } from '../../services/signal-review/signal-types'
import { signalRow } from './signal-fixtures'

/**
 * The two parts that say what a decision on a signal rests on (the source's wording, link and date; the fit with the product and the score), drawn on their
 * own. They used to be proved only through the Signal Review's drawer and its "Fit and score" tab; that screen was removed on 13 Nov 2026 (P1-C), and these
 * parts live on in the "Evidence and details" of every Company Opportunities card, so what the drawer tests pinned about them is pinned here. The rule they
 * share: a field the server did not record says so, and nothing is guessed or filled in.
 */

const PRODUCTS = [{ value: 'scholar', label: 'Scholar', business_fit: 'scholar' }]

/** Every `part` is in `text`; the message names the part, so a failure says which one is missing. */
const says = (text: string, ...parts: string[]) => { for (const part of parts) assert.ok(text.includes(part), `it says: ${part}`) }
const saysNot = (text: string, ...parts: string[]) => { for (const part of parts) assert.ok(!text.includes(part), `it does not say: ${part}`) }

async function evidence(signal: SignalRow) {
  const k = await kit()
  const { SignalEvidence } = await import('../../components/domain/signals/signal-parts')
  await k.render(k.h(SignalEvidence, { signal, products: PRODUCTS }))
  return { k, text: () => k.bodyText() }
}

async function fit(signal: SignalRow) {
  const k = await kit()
  const { SignalFitScore } = await import('../../components/domain/signals/signal-fit')
  await k.render(k.h(SignalFitScore, { signal, products: PRODUCTS }))
  const scoreRows = () => k.all('ul[aria-label="The parts of the score"] li').map((li) => li.textContent)
  return { k, text: () => k.bodyText(), scoreRows }
}

/** A signal that records everything the Fit and score parts can show. */
function richSignal(over: Partial<SignalRow> = {}): SignalRow {
  const base = signalRow()
  return signalRow({
    scores: { total: 24, buying_signal: 4, problem_fit: 4, product_fit: 3, accessibility: 3, urgency: 4, potential_value: 3, evidence_quality: 3 },
    score_reasoning: 'A live tender with a closing date and fourteen named schools.',
    confidence: 'High',
    claim_level: 'confirmed',
    candidate_need_codes: ['N05', 'N07'],
    relevant_offer_name: 'Scholar Core',
    matched_offers: [
      { offer_id: 'scholar-core', offer_name: 'Scholar Core', offer_category: 'Scholar', match_score: 78, rationale: 'Admissions and fees are named in the notice.', matched_need_codes: ['N05'] },
      { offer_id: 'scholar-lite', offer_name: 'Scholar Lite', match_score: null, rationale: null, matched_need_codes: [] },
    ],
    assessment: {
      ...base.assessment,
      fit: {
        total: 80,
        band: 'High',
        components: {
          product: { score: 20, max: 20, why: 'a stored part of the product' },
          icp: { score: 10, max: 15, why: 'a buyer type the ICP targets' },
          geography: { score: 8, max: 10, why: 'inside the places the ICP aims at' },
          evidence: { score: 18, max: 25, why: 'the quote was found in the page that was read' },
          intent: { score: 15, max: 20, why: 'buying intent: strong' },
          freshness: { score: 9, max: 10, why: '12 days old' },
        },
      },
    },
    ...over,
  })
}

describe('SignalEvidence: the source, the wording and the date', () => {
  afterEach(disposeAll)

  it('shows the wording copied from the source, how the date was found, when it was first seen, the product, the fit and how sure the finding is', async () => {
    const { text } = await evidence(signalRow())
    says(text(),
      '“invites sealed bids for the supply and rollout of a school management system across 14 schools”',
      'Event 12 Oct 2026',
      'The source states the date the event happens or happened.',
      '2 Nov 2026 by run #81',
      'Scholar',
      'Score 24',
      'Confirmed',
    )
  })

  it('opens the source in a new tab without handing it the page, and tells a screen reader so', async () => {
    const { k } = await evidence(signalRow())
    const link = k.all('a').find((a) => a.textContent?.includes('Tender notice 42'))
    assert.ok(link, 'the source is a link')
    assert.equal(link.getAttribute('href'), 'https://district-notices.example/tenders/42')
    assert.equal(link.getAttribute('target'), '_blank')
    assert.match(link.getAttribute('rel') ?? '', /noopener/)
    assert.ok(link.textContent!.includes('opens in a new tab'), 'a screen reader is told it leaves the page')
  })

  it('does not turn an unsafe stored address into a link, and says what is missing instead of leaving it out', async () => {
    const { k, text } = await evidence(signalRow({ source_url: 'javascript:alert(1)', primary_source: null, assessment: null, date_info: { status: 'undated', date: null }, scores: null, business_fit: null, product_master_name: null }))
    assert.equal(k.all('a').filter((a) => a.getAttribute('href')?.startsWith('javascript')).length, 0, 'no link runs a script')
    assert.equal(k.all('a').length, 0, 'and with no safe address there is no link at all')
    says(text(),
      'No web address recorded.',
      'No wording from the source was kept for this signal.',
      'Date unknown',
      'No date could be found on the source',
      'No product',
      'Not recorded',
    )
  })

})

describe('SignalFitScore: the fit with the product and the score', () => {
  afterEach(disposeAll)

  it('shows what the server recorded: the score and its parts, the fit and its parts, the reasoning, the needs and the matched offers', async () => {
    const { text, scoreRows } = await fit(richSignal())
    says(text(), '24', 'total score')
    assert.deepEqual(scoreRows(), ['Buying signal4', 'Problem fit4', 'Product fit3', 'Accessibility3', 'Urgency4', 'Potential value3', 'Evidence quality3'])
    says(text(),
      'A live tender with a closing date and fourteen named schools.',
      '80 of 100', 'band: High', '20 of 20', '18 of 25',
      'A stored part of the product', 'The quote was found in the page that was read',
      'Scholar', 'matched offer: Scholar Core', 'Confirmed: the source itself says this', 'High', 'N05, N07',
      'Scholar Core', 'Match score 78', 'Admissions and fees are named in the notice.', 'Shared needs: N05',
      'Scholar Lite', 'Match score not recorded', 'No reason was stored for this match.',
    )
  })

  it('says plainly when a part was not recorded, and fills nothing in', async () => {
    const { k, text, scoreRows } = await fit(signalRow({
      scores: { total: 24, buying_signal: 4 }, assessment: null, score_reasoning: null, strength_reason: null, confidence: null, claim_level: null,
      candidate_need_codes: [], matched_offers: [], business_fit: null, product_master_name: null, relevant_offer_name: null,
    }))
    assert.deepEqual(scoreRows(), ['Buying signal4', 'Problem fitNot recorded', 'Product fitNot recorded', 'AccessibilityNot recorded', 'UrgencyNot recorded', 'Potential valueNot recorded', 'Evidence qualityNot recorded'])
    says(text(),
      'The parts marked “Not recorded” were not stored with this signal.',
      'No reasoning was recorded for the score.',
      'No fit assessment was recorded for this signal.',
      'No product offer was matched to this signal.',
      'No product',
    )
    // Business fit, Fit total, How sure, Confidence and Need codes are each "Not recorded" in the definition lists.
    const lists = k.all('dl').map((d) => d.textContent ?? '')
    says(lists[0], 'Business fitNot recorded', 'Fit totalNot recorded', 'How sureNot recorded', 'ConfidenceNot recorded')
    says(lists[1], 'Need codesNot recorded')
  })

  it('says a signal that was never scored was not scored, and shows no score number', async () => {
    const { k, text } = await fit(signalRow({ scores: null }))
    says(text(), 'This signal was not scored.')
    assert.equal(k.all('ul[aria-label="The parts of the score"]').length, 0, 'no list of score parts')
    saysNot(text(), 'total score')
  })

  it('says when only the total was recorded', async () => {
    const { text, scoreRows } = await fit(signalRow({ scores: { total: 24 } }))
    says(text(), 'Only the total was recorded; the parts it is made of were not.')
    assert.equal(scoreRows().filter((row) => row?.endsWith('Not recorded')).length, 7, 'all seven parts say they were not recorded')
  })

  it('invents no strength word and no band: the band is the server\'s or nothing', async () => {
    const withoutBand = richSignal()
    withoutBand.assessment = { ...withoutBand.assessment!, fit: { ...withoutBand.assessment!.fit!, band: undefined } }
    const { text } = await fit(withoutBand)
    says(text(), '80 of 100')
    saysNot(text(), 'band:')
    assert.ok(!/\b(Strong|Weak)\b/.test(text()), 'no made-up label')
  })

  it('claims no maximum for the score, which has no scale in the data', async () => {
    const { k } = await fit(richSignal())
    const heading = k.one('#sr-score-heading')
    assert.ok(heading, 'the score section is there')
    const score = heading.parentElement!.textContent!
    assert.ok(!/\bof \d+/.test(score), `the score section carries no "of N": ${score}`)
    assert.ok(!score.includes('out of'), `the score section never says "out of": ${score}`)
  })

  it('shows only the fit total when its parts were not recorded', async () => {
    const signal = richSignal()
    signal.assessment = { ...signal.assessment!, fit: { total: 61, band: 'Medium' } }
    const { text } = await fit(signal)
    says(text(), '61', 'band: Medium', 'The parts of this fit were not recorded.')
    saysNot(text(), '61 of')
  })
})
