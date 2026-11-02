import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  addableItemTypes, createPayload, emptyForm, FORM_FIELDS, formatPrice, formFromRecord, isDirty, kindLabel, listSummary, maxOfferIdLength,
  newChoices, productChoices, readinessTone, sellPayload, splitLines, updatePayload, type ProductForm, type SellForm,
} from '../../components/domain/crm/product-master-model'
import type { PmCan, PmOption, PmRecord } from '../../services/product-master/types'

const about = { whatItDoes: 'Runs the school office.', modulesComponents: null, deploymentModel: null, proofPoints: null, notes: null, needsSolved: ['Fee collection', 'Attendance'], primarySegments: [], triggerSignals: [] }
const crm = { id: 3, productNo: 'PRD-AB12CD34', name: 'Scholar Core', sku: 'P2', type: 'product' as const, glAccount: '4000', unitPrice: 1500, currency: 'INR', taxRateId: 7, active: true }

const subProduct = (over: Partial<PmRecord> = {}): PmRecord => ({
  id: 11, key: 'scholarclone/p2', name: 'Scholar Core', kind: 'sub_product', status: 'active', origin: 'portfolio', shared: false, signalKey: null, portfolioName: null,
  parent: { id: 1, key: 'scholarclone', name: 'ScholarClone' }, subProducts: [],
  offer: { id: 5, offerId: 'P2', name: 'Scholar Core', product: 'Scholar K-12', readiness: 'Live – with client', readinessConfirmed: false, about },
  crmProduct: crm, createdAt: null, updatedAt: null, ...over,
})

const can = (over: Partial<PmCan> = {}): PmCan => ({
  createProduct: true, createSubProduct: true, createItem: { product: true, service: true }, sellInCrm: { product: true, service: true },
  editSubProduct: true, editItem: { product: true, service: true }, archive: true, archiveProduct: true, ...over,
})

describe('the form for a new record and for an existing one', () => {
  it('starts empty, with Sell switched on only for a catalogue item', () => {
    assert.equal(emptyForm('sub_product').sell.enabled, false)
    assert.equal(emptyForm('product').sell.enabled, false)
    assert.equal(emptyForm('item').sell.enabled, true)
  })

  it('can start with the product chosen and a given item type', () => {
    assert.equal(emptyForm('sub_product', { productId: 4 }).productId, '4')
    assert.equal(emptyForm('sub_product', { productId: null }).productId, '')
    assert.equal(emptyForm('item', { itemType: 'service' }).sell.type, 'service')
    assert.equal(emptyForm('item').sell.type, 'product')
  })

  it('is filled from what a sub-product already holds', () => {
    const f = formFromRecord(subProduct())
    assert.deepEqual(f, {
      kind: 'sub_product', name: 'Scholar Core', key: '', productId: '1', offerId: 'P2', readiness: 'Live – with client',
      whatItDoes: 'Runs the school office.', needsSolved: 'Fee collection\nAttendance',
      sell: { enabled: true, type: 'product', sku: 'P2', glAccount: '4000', taxRateId: '7', basePrice: '1500', currency: 'INR' },
    })
  })

  it('shows Sell as off when the sub-product is not in the catalogue, and tolerates missing text', () => {
    const f = formFromRecord(subProduct({
      crmProduct: null,
      offer: { id: 5, offerId: 'P2', name: 'x', product: null, readiness: null, readinessConfirmed: false, about: { ...about, whatItDoes: null, needsSolved: [] } },
    }))
    assert.equal(f.sell.enabled, false)
    assert.equal(f.readiness, '')
    assert.equal(f.whatItDoes, '')
    assert.equal(f.needsSolved, '')
  })

  it('keeps a product\'s key, and a catalogue item is always selling', () => {
    assert.equal(formFromRecord(subProduct({ kind: 'product', key: 'payroll', parent: null, offer: null, crmProduct: null })).key, 'payroll')
    assert.equal(formFromRecord(subProduct()).key, '', 'a sub-product has no key of its own to edit')
    const item = formFromRecord(subProduct({ kind: 'item', parent: null, offer: null }))
    assert.equal(item.sell.enabled, true)
    assert.equal(formFromRecord(subProduct({ kind: 'item', parent: null, offer: null, crmProduct: null })).sell.enabled, true)
  })

  it('writes a missing price as blank, not as "null"', () => {
    const f = formFromRecord(subProduct({ crmProduct: { ...crm, unitPrice: null, currency: null, taxRateId: null, sku: null, glAccount: null } }))
    assert.deepEqual(f.sell, { enabled: true, type: 'product', sku: '', glAccount: '', taxRateId: '', basePrice: '', currency: '' })
  })
})

describe('splitLines', () => {
  it('gives one entry per line, trimmed, without blank lines, for both kinds of line ending', () => {
    assert.deepEqual(splitLines('  a  \r\n\n b\n   \nc'), ['a', 'b', 'c'])
    assert.deepEqual(splitLines(''), [])
  })
})

describe('the Sell part of a request', () => {
  it('sends a blank field as null and trims the rest', () => {
    const f = emptyForm('item')
    f.sell = { enabled: true, type: 'service', sku: ' TRN-1 ', glAccount: '', taxRateId: '', basePrice: ' ', currency: ' INR ' }
    assert.deepEqual(sellPayload(f.sell), { enabled: true, type: 'service', sku: 'TRN-1', glAccount: null, taxRateId: null, basePrice: null, currency: 'INR' })
  })

  it('sends numbers as numbers, and keeps text that is not a number so the server can say so', () => {
    const s = { ...emptyForm('item').sell, taxRateId: '7', basePrice: '1500.50' }
    assert.equal(sellPayload(s).taxRateId, 7)
    assert.equal(sellPayload(s).basePrice, 1500.5)
    assert.equal(sellPayload({ ...s, basePrice: '12abc' }).basePrice, '12abc')
    assert.equal(sellPayload({ ...s, basePrice: '0' }).basePrice, 0, 'a price of zero is a price')
  })
})

describe('creating', () => {
  it('a product sends only its name and key', () => {
    const f = { ...emptyForm('product'), name: ' Payroll ', key: ' payroll ' }
    assert.deepEqual(createPayload(f), { kind: 'product', name: 'Payroll', key: 'payroll' })
  })

  it('a catalogue item always sends its Sell part', () => {
    const f = { ...emptyForm('item'), name: 'Training day' }
    f.sell = { ...f.sell, type: 'service', sku: 'TRN-1' }
    assert.deepEqual(createPayload(f), {
      kind: 'item', name: 'Training day',
      sell: { enabled: true, type: 'service', sku: 'TRN-1', glAccount: null, taxRateId: null, basePrice: null, currency: null },
    })
  })

  it('a sub-product sends its identity and About, and Sell only when switched on', () => {
    const f: ProductForm = { ...emptyForm('sub_product', { productId: 1 }), name: ' Scholar Seven ', offerId: ' P7 ', readiness: 'Prototype', whatItDoes: '  ', needsSolved: 'Fees\n\n Attendance ' }
    assert.deepEqual(createPayload(f), {
      kind: 'sub_product', name: 'Scholar Seven', productId: 1, offerId: 'P7', readiness: 'Prototype',
      about: { whatItDoes: null, needsSolved: ['Fees', 'Attendance'] },
    })
    f.sell = { ...f.sell, enabled: true, sku: 'P7' }
    assert.equal((createPayload(f).sell as { sku: string }).sku, 'P7')
  })

  it('a sub-product with no product chosen sends null, so the server says which field is missing', () => {
    assert.equal(createPayload(emptyForm('sub_product')).productId, null)
  })
})

describe('saving changes', () => {
  const start = () => formFromRecord(subProduct())

  it('sends nothing when nothing changed, and ignores spaces around the text', () => {
    assert.deepEqual(updatePayload(start(), start()), {})
    assert.deepEqual(updatePayload(start(), { ...start(), name: '  Scholar Core ', whatItDoes: ' Runs the school office. ', needsSolved: 'Fee collection\n\n Attendance' }), {})
  })

  it('sends only the fields that changed', () => {
    assert.deepEqual(updatePayload(start(), { ...start(), name: 'Scholar Core Plus' }), { name: 'Scholar Core Plus' })
    assert.deepEqual(updatePayload(start(), { ...start(), readiness: 'Prototype' }), { readiness: 'Prototype' })
    assert.deepEqual(updatePayload(start(), { ...start(), whatItDoes: 'New text.' }), { about: { whatItDoes: 'New text.' } })
    assert.deepEqual(updatePayload(start(), { ...start(), needsSolved: 'Attendance\nFee collection' }), { about: { needsSolved: ['Attendance', 'Fee collection'] } }, 'a new order is a change')
  })

  it('clears the About text when it is emptied', () => {
    assert.deepEqual(updatePayload(start(), { ...start(), whatItDoes: '' }), { about: { whatItDoes: null } })
    assert.deepEqual(updatePayload(start(), { ...start(), needsSolved: '' }), { about: { needsSolved: [] } })
  })

  it('sends the whole Sell part when any of it changed, and none of it when nothing there changed', () => {
    const changed = updatePayload(start(), { ...start(), sell: { ...start().sell, basePrice: '1800' } })
    assert.deepEqual(changed, { sell: { enabled: true, type: 'product', sku: 'P2', glAccount: '4000', taxRateId: 7, basePrice: 1800, currency: 'INR' } })
    assert.equal(updatePayload(start(), { ...start(), name: 'x' }).sell, undefined)
  })

  it('notices a change to any single Sell field, and switching Sell on with nothing filled in', () => {
    const initial = formFromRecord(subProduct())
    const edits: Array<[string, Partial<SellForm>]> = [
      ['SKU', { sku: 'X' }], ['GL account', { glAccount: '5000' }], ['tax rate', { taxRateId: '8' }],
      ['base price', { basePrice: '1' }], ['currency', { currency: 'USD' }], ['type', { type: 'service' }],
    ]
    for (const [label, edit] of edits) {
      assert.ok(updatePayload(initial, { ...initial, sell: { ...initial.sell, ...edit } }).sell, `${label} on its own`)
    }
    const off = formFromRecord(subProduct({ crmProduct: null }))
    assert.ok(updatePayload(off, { ...off, sell: { ...off.sell, enabled: true } }).sell, 'switched on with every field blank')
  })

  it('switches Sell on for a sub-product that was not in the catalogue', () => {
    const initial = formFromRecord(subProduct({ crmProduct: null }))
    const body = updatePayload(initial, { ...initial, sell: { ...initial.sell, enabled: true, sku: 'P2' } })
    assert.equal((body.sell as { sku: string }).sku, 'P2')
  })

  it('never sends Sell when it is off', () => {
    const initial = formFromRecord(subProduct({ crmProduct: null }))
    assert.deepEqual(updatePayload(initial, { ...initial, name: 'x', sell: { ...initial.sell, sku: 'typed but switched off' } }), { name: 'x' })
  })

  it('a catalogue item sends its name and Sell, and nothing about a Portfolio offer it does not have', () => {
    const initial = formFromRecord(subProduct({ kind: 'item', parent: null, offer: null }))
    const body = updatePayload(initial, { ...initial, name: 'Renamed', readiness: 'Prototype', whatItDoes: 'ignored', sell: { ...initial.sell, sku: 'NEW' } })
    assert.deepEqual(Object.keys(body).sort(), ['name', 'sell'])
  })

  it('a product can change nothing here', () => {
    const initial = formFromRecord(subProduct({ kind: 'product', key: 'payroll', parent: null, offer: null, crmProduct: null }))
    assert.deepEqual(updatePayload(initial, { ...initial, readiness: 'Prototype', whatItDoes: 'x', sell: { ...initial.sell, enabled: true, sku: 'x' } }), {})
  })
})

describe('has the form been changed', () => {
  it('is false for the form as it started, even with spaces or blank lines added', () => {
    const f = emptyForm('sub_product', { productId: 1 })
    assert.equal(isDirty(f, { ...f }), false)
    assert.equal(isDirty(f, { ...f, name: '   ', needsSolved: '\n\n' }), false)
  })

  it('is true as soon as something is typed or switched', () => {
    const f = emptyForm('sub_product', { productId: 1 })
    assert.equal(isDirty(f, { ...f, name: 'a' }), true)
    assert.equal(isDirty(f, { ...f, productId: '2' }), true)
    assert.equal(isDirty(f, { ...f, readiness: 'Prototype' }), true)
    assert.equal(isDirty(f, { ...f, sell: { ...f.sell, enabled: true } }), true)
    assert.equal(isDirty(f, { ...f, sell: { ...f.sell, taxRateId: '7' } }), true)
    assert.equal(isDirty(f, { ...f, needsSolved: 'x' }), true)
  })

  it('is false again when a change is undone', () => {
    const f = formFromRecord(subProduct())
    assert.equal(isDirty(f, { ...f, name: 'Other' }), true)
    assert.equal(isDirty(f, { ...f, name: f.name }), false)
  })
})

describe('words and choices', () => {
  it('keeps a sub-product\'s key within 50 characters', () => {
    assert.equal(maxOfferIdLength(null), 50)
    assert.equal(maxOfferIdLength('scholarclone'), 37)
    assert.equal(maxOfferIdLength('x'.repeat(49)), 1, 'never below one')
    assert.equal(maxOfferIdLength('x'.repeat(60)), 1)
    assert.equal(maxOfferIdLength('a'), 48)
  })

  it('draws every readiness state in its colour', () => {
    const expected: Record<string, string> = {
      'Live – with client': 'success', 'Proven on real client data (pilot)': 'success', 'Built – no production client': 'primary',
      'In development': 'pending', 'Pilot planned': 'pending', 'Prototype': 'pending', 'Proposal / concept': 'inactive', 'Deferred': 'inactive',
    }
    for (const [state, tone] of Object.entries(expected)) assert.equal(readinessTone(state), tone, state)
    assert.equal(readinessTone(null), 'default')
    assert.equal(readinessTone(undefined), 'default')
    assert.equal(readinessTone('Something new'), 'default')
  })

  it('summarises the list, in the singular where it is one', () => {
    assert.equal(listSummary({ products: 5, subProducts: 22, items: 0 }), '22 sub-products in 5 products.')
    assert.equal(listSummary({ products: 1, subProducts: 1, items: 0 }), '1 sub-product in 1 product.')
    assert.equal(listSummary({ products: 0, subProducts: 0, items: 0 }), '0 sub-products in 0 products.')
    assert.equal(listSummary({ products: 5, subProducts: 22, items: 3 }), '22 sub-products in 5 products, and 3 other catalogue items.')
    assert.equal(listSummary({ products: 5, subProducts: 22, items: 1 }), '22 sub-products in 5 products, and 1 other catalogue item.')
  })

  it('offers "New…" only what the server says this person may create', () => {
    assert.deepEqual(newChoices(null), [])
    assert.deepEqual(newChoices(can()).map((c) => c.kind), ['product', 'sub_product', 'item'])
    assert.deepEqual(newChoices(can({ createProduct: false })).map((c) => c.kind), ['sub_product', 'item'], 'no "product" for someone who is not an administrator')
    assert.deepEqual(newChoices(can({ createItem: { product: false, service: true } })).map((c) => c.kind), ['product', 'sub_product', 'item'])
    assert.deepEqual(newChoices(can({ createItem: { product: false, service: false } })).map((c) => c.kind), ['product', 'sub_product'])
    assert.deepEqual(newChoices(can({ createProduct: false, createSubProduct: false, createItem: { product: false, service: false } })), [])
  })

  it('lists the item types a person may add, for a new item and for switching Sell on', () => {
    assert.deepEqual(addableItemTypes(null, 'create'), [])
    assert.deepEqual(addableItemTypes(can(), 'create'), ['product', 'service'])
    assert.deepEqual(addableItemTypes(can({ createItem: { product: false, service: true } }), 'create'), ['service'])
    assert.deepEqual(addableItemTypes(can({ sellInCrm: { product: true, service: false } }), 'sell'), ['product'])
    assert.deepEqual(addableItemTypes(can({ createItem: { product: false, service: false }, sellInCrm: { product: true, service: true } }), 'sell'), ['product', 'service'], 'the two lists are separate')
  })

  it('picks only products for the "Product" choice', () => {
    const options: PmOption[] = [
      { id: 1, key: 'scholarclone', name: 'ScholarClone', kind: 'product', parentId: null, label: 'ScholarClone' },
      { id: 2, key: 'scholarclone/p1', name: 'Scholar One', kind: 'sub_product', parentId: 1, label: 'ScholarClone › Scholar One' },
      { id: 3, key: 'crm/prd-1', name: 'Setup fee', kind: 'item', parentId: null, label: 'Setup fee' },
    ]
    assert.deepEqual(productChoices(options), [{ id: 1, key: 'scholarclone', name: 'ScholarClone' }])
  })

  it('shows a price with its currency, and a dash when there is none', () => {
    assert.equal(formatPrice(1500, 'INR'), 'INR 1500.00')
    assert.equal(formatPrice(1500, null), '1500.00')
    assert.equal(formatPrice(0, 'INR'), 'INR 0.00')
    assert.equal(formatPrice(null, 'INR'), '—')
    assert.equal(formatPrice(undefined, null), '—')
  })

  it('names the kinds', () => {
    assert.equal(kindLabel('product'), 'Product')
    assert.equal(kindLabel('sub_product'), 'Sub-product')
    assert.equal(kindLabel('item'), 'Catalogue item')
  })

  it('names every field a server error can be keyed by', () => {
    for (const path of ['name', 'key', 'productId', 'offerId', 'readiness', 'about.needsSolved', 'sell.taxRateId', 'sell.basePrice']) {
      assert.ok((FORM_FIELDS as readonly string[]).includes(path), path)
    }
  })
})
