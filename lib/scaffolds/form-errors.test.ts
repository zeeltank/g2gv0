import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { splitFieldErrors } from '../../components/shared/scaffolds/form-errors'
import { readTab, writeTab } from '../../components/shared/scaffolds/url-tab'

describe('splitFieldErrors', () => {
  const fields = ['name', 'offerId', 'about.needsSolved', 'sell', 'sell.taxRateId']

  it('puts a message next to its field when the key is that field', () => {
    assert.deepEqual(splitFieldErrors({ offerId: ['An offer with this ID already exists.'] }, fields), {
      byField: { offerId: ['An offer with this ID already exists.'] }, unplaced: [],
    })
  })

  it('puts "about.needsSolved.2" with the field "about.needsSolved"', () => {
    assert.deepEqual(splitFieldErrors({ 'about.needsSolved.2': ['Too long.'] }, fields).byField, { 'about.needsSolved': ['Too long.'] })
  })

  it('chooses the most specific field when several match', () => {
    assert.deepEqual(splitFieldErrors({ 'sell.taxRateId': ['That tax rate was not found.'] }, fields).byField, { 'sell.taxRateId': ['That tax rate was not found.'] })
    assert.deepEqual(splitFieldErrors({ 'sell.type': ['Bad.'] }, fields).byField, { sell: ['Bad.'] })
  })

  it('does not match a key that only starts with a field name', () => {
    const out = splitFieldErrors({ names: ['x'], 'sellers.0': ['y'] }, fields)
    assert.deepEqual(out.byField, {})
    assert.deepEqual(out.unplaced, ['x', 'y'])
  })

  it('collects what the form has no field for (a refusal, a clash) so it can be shown at the top', () => {
    const out = splitFieldErrors({ kind: ['Only an administrator can create a product.'], id: ['Product not found'], name: ['Required.'] }, fields)
    assert.deepEqual(out.byField, { name: ['Required.'] })
    assert.deepEqual(out.unplaced, ['Only an administrator can create a product.', 'Product not found'])
  })

  it('shows a repeated message once', () => {
    assert.deepEqual(splitFieldErrors({ name: ['Required.', 'Required.'], 'about.needsSolved.0': ['A.'], 'about.needsSolved.1': ['A.'] }, fields).byField, {
      name: ['Required.'], 'about.needsSolved': ['A.'],
    })
  })

  it('gives nothing for no errors', () => {
    assert.deepEqual(splitFieldErrors(undefined, fields), { byField: {}, unplaced: [] })
    assert.deepEqual(splitFieldErrors(null, fields), { byField: {}, unplaced: [] })
    assert.deepEqual(splitFieldErrors({}, fields), { byField: {}, unplaced: [] })
  })
})

describe('the open tab in the URL', () => {
  const ids = ['overview', 'sell', 'prices']

  it('reads the tab the URL names, and the first one when it names none or a tab that does not exist', () => {
    assert.equal(readTab(new URLSearchParams('tab=prices'), ids, 'overview'), 'prices')
    assert.equal(readTab(new URLSearchParams(''), ids, 'overview'), 'overview')
    assert.equal(readTab(new URLSearchParams('tab=admin'), ids, 'overview'), 'overview')
    assert.equal(readTab(new URLSearchParams('tab='), ids, 'overview'), 'overview')
  })

  it('can use another parameter name', () => {
    assert.equal(readTab(new URLSearchParams('section=sell'), ids, 'overview', 'section'), 'sell')
    assert.equal(writeTab(new URLSearchParams(), 'sell', 'overview', 'section').toString(), 'section=sell')
  })

  it('writes the tab, leaves the first one out of the URL and keeps every other parameter', () => {
    assert.equal(writeTab(new URLSearchParams('q=abc'), 'prices', 'overview').toString(), 'q=abc&tab=prices')
    assert.equal(writeTab(new URLSearchParams('q=abc&tab=prices'), 'overview', 'overview').toString(), 'q=abc')
    assert.equal(writeTab(new URLSearchParams('tab=sell'), 'prices', 'overview').toString(), 'tab=prices')
  })
})
