import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { PickerRow } from '../../services/product-master/picker-service'
import {
  cutMessage, DEFAULT_LIMIT, emptyMessage, failureOf, groupByProduct, limitFor, MAX_LIMIT, moveActive, NO_PRODUCT_TITLE, notOfferedWords, pickedFromRow,
  priceText, SEARCH_DEBOUNCE_MS, searchText, valueKey, withoutExcluded,
} from './model'

const row = (over: Partial<PickerRow> = {}): PickerRow => ({
  crmProductId: 10, masterId: 23, name: 'Scholar Nine', productName: 'ScholarClone', sku: 'SCH-09', unitPrice: 999, currency: 'INR', taxRateId: 4, type: 'product', ...over,
})

describe('what a chosen row hands to the form', () => {
  it('keeps the CATALOGUE id as a string, exactly as the old picker\'s product.id was, and never the master id', () => {
    const picked = pickedFromRow(row({ crmProductId: 10, masterId: 23 }))
    assert.equal(picked.productId, '10', 'the id a document stores is the catalogue id, as a string')
    assert.equal(picked.crmProductId, 10)
    assert.equal(picked.masterId, 23, 'the master id is carried for the page address only')
    assert.notEqual(picked.productId, String(picked.masterId))
  })

  it('hands the price, the currency and the default tax rate over as the old picker did (the tax rate as a string id)', () => {
    const picked = pickedFromRow(row({ unitPrice: 1250.5, currency: 'INR', taxRateId: 4 }))
    assert.equal(picked.unitPrice, 1250.5)
    assert.equal(picked.currency, 'INR')
    assert.equal(picked.taxRateId, '4')
    assert.equal(pickedFromRow(row({ taxRateId: null })).taxRateId, null, 'no tax rate stays null, never the word null')
    assert.equal(pickedFromRow(row({ unitPrice: null })).unitPrice, null, 'a price the server did not send is not invented')
  })
})

describe('the value a document holds', () => {
  it('reads null, blank and zero as nothing chosen, and a number as the string the picker compares on', () => {
    assert.equal(valueKey(null), '')
    assert.equal(valueKey(undefined), '')
    assert.equal(valueKey('  '), '')
    assert.equal(valueKey(0), '')
    assert.equal(valueKey('0'), '')
    assert.equal(valueKey(10), '10')
    assert.equal(valueKey(' 10 '), '10')
  })
})

describe('the request a typed text becomes', () => {
  it('trims and collapses white space, and waits a short while after the last key', () => {
    assert.equal(searchText('  Scholar   Nine '), 'Scholar Nine')
    assert.equal(searchText('   '), '')
    assert.ok(SEARCH_DEBOUNCE_MS >= 150 && SEARCH_DEBOUNCE_MS <= 400, `the wait after the last key is a fraction of a second, not ${SEARCH_DEBOUNCE_MS} ms`)
  })

  it('asks for 20 rows, a few more when the form hides some of its own, and never more than the server\'s 50', () => {
    assert.equal(limitFor(0), DEFAULT_LIMIT)
    assert.equal(limitFor(5), DEFAULT_LIMIT + 5)
    assert.equal(limitFor(500), MAX_LIMIT)
    assert.equal(limitFor(-3), DEFAULT_LIMIT)
  })

  it('drops the rows the form hides, by catalogue id, and keeps the order', () => {
    const rows = [row({ crmProductId: 1 }), row({ crmProductId: 2 }), row({ crmProductId: 3 })]
    assert.deepEqual(withoutExcluded(rows, new Set(['2'])).map((r) => r.crmProductId), [1, 3])
    assert.deepEqual(withoutExcluded(rows, new Set()).map((r) => r.crmProductId), [1, 2, 3])
  })
})

describe('the list as a person reads it', () => {
  it('groups the rows by the Product above them, in the server\'s order, with the ones that have no Product yet last', () => {
    const groups = groupByProduct([
      row({ crmProductId: 1, productName: 'ScholarClone' }), row({ crmProductId: 2, productName: null, name: 'Stray' }),
      row({ crmProductId: 3, productName: 'ScholarClone' }), row({ crmProductId: 4, productName: 'LMS-PAL' }),
    ])
    assert.deepEqual(groups.map((g) => g.title), ['ScholarClone', 'LMS-PAL', NO_PRODUCT_TITLE])
    assert.deepEqual(groups[0].rows.map((r) => r.crmProductId), [1, 3])
    assert.equal(groups[2].rows[0].name, 'Stray')
  })

  it('words the price only when the server sent one: no price is not "0.00"', () => {
    assert.match(priceText(999, 'INR') ?? '', /^INR 999\.00$/)
    assert.equal(priceText(null, 'INR'), null, 'a person who may not see prices is shown none')
    assert.equal(priceText(undefined, 'INR'), null)
    assert.equal(priceText(0, 'INR')?.endsWith('0.00'), true, 'a real zero price is shown as a price')
    assert.equal(priceText(10, null), '10.00', 'no currency, no stray space')
  })

  it('says why a document\'s Sub-product is no longer offered, in the owner\'s words', () => {
    assert.equal(notOfferedWords('paused'), 'Paused')
    assert.equal(notOfferedWords('binned'), 'Not sold')
    assert.equal(notOfferedWords('not_sold'), 'Not sold')
    assert.equal(notOfferedWords('sold'), null)
    assert.equal(notOfferedWords(null), null)
  })

  it('has a sentence for an empty list, one for a list cut at its limit, and none for a short list', () => {
    assert.equal(emptyMessage('nine'), 'No sold sub-product matches')
    assert.notEqual(emptyMessage(''), emptyMessage('nine'))
    assert.match(cutMessage(20, 20) ?? '', /first 20/)
    assert.equal(cutMessage(7, 20), null)
  })

  it('moves the highlight inside the list: arrows clamp, Home and End jump, an empty list stays at the top', () => {
    assert.equal(moveActive(0, 'ArrowUp', 5), 0)
    assert.equal(moveActive(4, 'ArrowDown', 5), 4)
    assert.equal(moveActive(1, 'ArrowDown', 5), 2)
    assert.equal(moveActive(3, 'Home', 5), 0)
    assert.equal(moveActive(1, 'End', 5), 4)
    assert.equal(moveActive(2, 'ArrowDown', 0), 0)
    assert.equal(moveActive(2, 'a', 5), 2, 'another key does not move it')
  })
})

describe('a refusal', () => {
  it('says a 403 is "no right" (no Retry) and anything else "could not load" (Retry)', () => {
    assert.equal(failureOf({ status: 403 }).kind, 'forbidden')
    assert.equal(failureOf({ status: 500 }).kind, 'error')
    assert.equal(failureOf(new Error('network')).kind, 'error')
    assert.equal(failureOf(null).kind, 'error')
    assert.match(failureOf({ status: 403 }).message, /right/)
  })
})
