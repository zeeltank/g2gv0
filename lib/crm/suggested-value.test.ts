import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { notAddedSentence, suggestedValue, type OpportunityPricedRow } from './suggested-value'

/**
 * The Suggested value of an opportunity (S16, 25 Nov 2026): quantity x price of the Sub-products priced in the OPPORTUNITY'S currency, and nothing else. A row in another
 * currency, with no price or with a price that has no currency is listed as not added and never converted. The rule is pure, so it is proved here on rows; the screen that
 * draws it, and the proof that it never writes the Amount, are in opportunity-suggested-value.test.tsx.
 */

const row = (id: string, quantity: number, unitPrice: number | null | undefined, currency: string | null | undefined, name = `Sub-product ${id}`): OpportunityPricedRow => {
  const out: OpportunityPricedRow = { id, name, quantity }
  if (unitPrice !== undefined) out.unitPrice = unitPrice
  if (currency !== undefined) out.currency = currency
  return out
}

describe('the suggested value adds only the rows priced in the opportunity\'s currency', () => {
  it('adds quantity x price of every row in that currency and lists the others as not added, with the reason', () => {
    const rows = [row('1', 2, 1000, 'INR'), row('2', 1, 250.5, 'INR'), row('3', 3, 99, 'USD', 'Scholar Cloud'), row('4', 1, null, 'INR', 'Fee ERP'), row('5', 1, 500, null, 'Old price')]
    const value = suggestedValue('INR', rows)
    assert.equal(value.state, 'ready')
    assert.equal(value.currency, 'INR')
    assert.equal(value.total, 2250.5, '2 x 1000 + 1 x 250.50, and nothing from the USD row')
    assert.deepEqual(value.added.map((a) => [a.id, a.amount]), [['1', 2000], ['2', 250.5]])
    assert.deepEqual(value.notAdded.map((n) => [n.id, n.reason]), [['3', 'other-currency'], ['4', 'no-price'], ['5', 'no-currency']])
    assert.deepEqual(value.notAdded.map((n) => notAddedSentence(n, 'INR')), [
      'Scholar Cloud: priced in USD, not INR.', 'Fee ERP: no price yet.', 'Old price: its price has no currency.',
    ])
  })

  it('never adds a row in another currency, however large: no conversion', () => {
    const value = suggestedValue('INR', [row('1', 1, 1000000, 'USD'), row('2', 5, 9, 'EUR')])
    assert.equal(value.total, 0)
    assert.deepEqual(value.added, [])
    assert.equal(value.notAdded.length, 2)
  })

  it('reads a currency in any case and with spaces, for the opportunity and for the row', () => {
    const value = suggestedValue(' inr ', [row('1', 1, 10, 'Inr'), row('2', 1, 5, ' INR')])
    assert.equal(value.currency, 'INR')
    assert.equal(value.total, 15)
    assert.deepEqual(value.notAdded, [])
  })

  it('rounds to the currency\'s own digits, half up, and is not thrown by float noise (3 x 0.1, 1.005)', () => {
    assert.equal(suggestedValue('INR', [row('1', 3, 0.1, 'INR')]).total, 0.3)
    assert.equal(suggestedValue('USD', [row('1', 1, 1.005, 'USD')]).total, 1.01)
    assert.equal(suggestedValue('JPY', [row('1', 3, 100.5, 'JPY')]).total, 302, 'yen has no digits after the point: 301.5 rounds up')
    assert.equal(suggestedValue('INR', [row('1', 1, 0.1, 'INR'), row('2', 1, 0.2, 'INR')]).total, 0.3, '0.1 + 0.2 is 0.3, not 0.30000000000000004')
  })

  it('says "needs a currency" for an opportunity with none, and adds nothing', () => {
    for (const none of [null, undefined, '', '   ']) {
      const value = suggestedValue(none, [row('1', 1, 1000, 'INR')])
      assert.equal(value.state, 'needs-currency')
      assert.equal(value.total, 0)
      assert.deepEqual(value.added, [])
    }
  })

  it('draws nothing when there are no rows, or when the answer carries no prices at all (a viewer who may not see them)', () => {
    assert.equal(suggestedValue('INR', []).state, 'hidden')
    assert.equal(suggestedValue('INR', [row('1', 1, undefined, undefined), row('2', 2, undefined, undefined)]).state, 'hidden')
    assert.equal(suggestedValue(null, [row('1', 1, undefined, undefined)]).state, 'hidden', 'and with no currency either: still nothing to say')
  })

  it('treats "no price yet" (null) as a price the answer carries: the row is listed, the section is drawn', () => {
    const value = suggestedValue('INR', [row('1', 1, null, 'INR', 'Fee ERP')])
    assert.equal(value.state, 'ready')
    assert.deepEqual(value.notAdded.map((n) => n.reason), ['no-price'])
  })

  it('changes nothing it was given', () => {
    const rows = [row('1', 2, 10, 'INR'), row('2', 1, 5, 'USD')]
    const before = JSON.stringify(rows)
    suggestedValue('INR', rows)
    assert.equal(JSON.stringify(rows), before)
  })
})
