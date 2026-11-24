import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildPayload, checkValues, emptySell, emptyValues, type ProductValues } from './form-model'

/**
 * Two rules the old S1 form model pinned (lib/product-master/model.test.ts, removed with the old Products screens, slice 15, track WPD) that the form model which
 * stays carries but no other test names: text that is not a number reaches the server as it was typed (so the server can say what is wrong), and an ID is 1 to
 * 50 characters. Every row is in `Docs/agentic-crm/_evidence/s15/wpd-test-map-2026-11-23.md`.
 */

const create = (over: Partial<ProductValues> = {}): ProductValues => ({ ...emptyValues({ productId: 4, assignedTo: '2' }), ...over })

describe('the form model: what the old form model pinned', () => {
  it('sends text that is not a number as the text, so the server can say so', () => {
    const v = create({ name: 'Fee Desk', sell: { ...emptySell('product', '2'), on: true, sku: 'FD-1', unitPrice: 'twelve', qtyInStock: '7', weight: '' } })
    const body = buildPayload({ mode: 'create', initial: v, values: v, standing: 'none', hasAbout: false })
    const sell = body.sell as Record<string, unknown>
    assert.equal(sell.unitPrice, 'twelve', 'the text is not turned into NaN or dropped')
    assert.equal(sell.qtyInStock, 7, 'a number typed as text is a number')
    assert.equal('weight' in sell, false, 'a blank number on a create is not sent')
  })

  it('accepts an ID of 50 characters and refuses one of 51', () => {
    const about = (offerId: string): ProductValues => {
      const v = create({ name: 'Fee Desk' })
      return { ...v, about: { ...v.about, offerId, readiness: 'concept' } }
    }
    const check = (offerId: string) => checkValues(about(offerId), { mode: 'create', hasAbout: false })
    assert.equal(check('A'.repeat(50)).offerId, undefined, '50 characters are allowed')
    assert.match(check('A'.repeat(51)).offerId ?? '', /up to 50 characters/, '51 are refused, with the reason')
    assert.match(check('SCH 11').offerId ?? '', /letters, digits/, 'a space is refused')
    assert.equal(check('SCH-11.a_b').offerId, undefined, 'letters, digits, dot, dash and underscore are allowed')
  })
})
