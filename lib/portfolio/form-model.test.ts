import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  aboutFilled, buildPayload, checkValues, emptySell, emptyValues, isDirty, sectionOf, standingOf, valuesFromRecord, type ProductValues,
} from './form-model'
import { fullRecord, sellRow } from './fixtures'

const create = (over: Partial<ProductValues> = {}): ProductValues => ({ ...emptyValues({ productId: 4, assignedTo: '2' }), ...over })
const filledAbout = (v: ProductValues): ProductValues => ({ ...v, name: 'Fee Desk', about: { ...v.about, offerId: 'SCH-09', readiness: 'concept', whatItDoes: ' Collects fees. ' } })

describe('the form model: what a create sends', () => {
  it('sends an About only: the identity, the ID, the readiness and all 13 About fields, and no Sell, no ICP', () => {
    const v = filledAbout(create())
    const body = buildPayload({ mode: 'create', initial: v, values: v, standing: 'none', hasAbout: false })
    assert.equal(body.kind, 'sub_product')
    assert.equal(body.name, 'Fee Desk')
    assert.equal(body.productId, 4)
    assert.equal(body.offerId, 'SCH-09')
    assert.equal(body.readiness, 'concept')
    assert.equal('sell' in body, false, 'no Sell section was switched on')
    assert.equal('icp' in body, false, 'no ideal customer was filled in')
    const about = body.about as Record<string, unknown>
    assert.deepEqual(Object.keys(about).sort(), [
      'deliveryOwner', 'deploymentModel', 'implementationEffort', 'modulesComponents', 'needsSolved', 'notes', 'oftenSoldTogether', 'pricingModel', 'primarySegments',
      'proofPoints', 'triggerSignals', 'typicalDealBand', 'whatItDoes',
    ])
    assert.equal(about.whatItDoes, 'Collects fees.', 'text is trimmed')
    assert.equal(about.notes, null, 'a blank text is null')
  })

  it('sends a Sell only: no About keys at all, so the server makes a Sell-only record', () => {
    const v = create({ name: 'Training day', sell: { ...emptySell('service', '2'), on: true, sku: 'TRN-1', unitPrice: '1500.50', vendor: 'ignored', weight: '3' } })
    const body = buildPayload({ mode: 'create', initial: v, values: v, standing: 'none', hasAbout: false })
    for (const key of ['offerId', 'readiness', 'about', 'icp']) assert.equal(key in body, false, `${key} is not sent`)
    const sell = body.sell as Record<string, unknown>
    assert.equal(sell.enabled, true)
    assert.equal(sell.type, 'service')
    assert.equal(sell.sku, 'TRN-1')
    assert.equal(sell.unitPrice, 1500.5, 'a price is a number')
    assert.equal(sell.assignedTo, 2, 'the person defaults to the signed-in one')
    assert.equal('vendor' in sell, false, 'a Service has no vendor')
    assert.equal('weight' in sell, false, 'a Service has no weight')
    assert.equal('isActive' in sell, false, 'before the first save there is no second switch')
  })

  it('sends EVERY Sell field of the old Products form, each under the key the server reads', () => {
    const sell = {
      ...emptySell('product', '2'), on: true, sku: 'S-1', category: 'Software', glAccount: '4000', taxRateId: '3', unitPrice: '10', costPrice: '6', currency: 'INR', commissionRate: '2.5',
      vendor: 'Acme', usageUnit: 'licence', qtyInStock: '7', qtyInDemand: '2', reorderLevel: '3', weight: '1.5', descriptionOnQuotes: 'On the quote',
    }
    const v = create({ name: 'Everything', sell })
    const body = buildPayload({ mode: 'create', initial: v, values: v, standing: 'none', hasAbout: false })
    assert.deepEqual(body.sell, {
      enabled: true, type: 'product', sku: 'S-1', category: 'Software', glAccount: '4000', currency: 'INR', vendor: 'Acme', usageUnit: 'licence', descriptionOnQuotes: 'On the quote',
      taxRateId: 3, unitPrice: 10, costPrice: 6, commissionRate: 2.5, qtyInStock: 7, qtyInDemand: 2, reorderLevel: 3, weight: 1.5, assignedTo: 2,
    })
  })

  it('sends every field of the About, each under the key the server reads, with the lists as lists', () => {
    const v = filledAbout(create())
    const full = { ...v, about: { ...v.about, modulesComponents: 'Modules', problems: 'One\nTwo', legacyNeeds: ['N07'], primarySegments: ['k12'], triggerSignals: ['funding'], proofPoints: 'Proof', pricingModel: 'Per seat', typicalDealBand: '1-5 lakh', deploymentModel: 'cloud', implementationEffort: '4 weeks', deliveryOwner: 'Team', notes: 'Note', oftenSoldTogether: ['SCH-12'] } }
    const about = buildPayload({ mode: 'create', initial: full, values: full, standing: 'none', hasAbout: false }).about
    assert.deepEqual(about, {
      whatItDoes: 'Collects fees.', modulesComponents: 'Modules', deploymentModel: 'cloud', proofPoints: 'Proof', notes: 'Note', needsSolved: ['N07', 'One', 'Two'], primarySegments: ['k12'],
      triggerSignals: ['funding'], pricingModel: 'Per seat', typicalDealBand: '1-5 lakh', implementationEffort: '4 weeks', deliveryOwner: 'Team', oftenSoldTogether: ['SCH-12'],
    })
  })

  it('sends both sections together, and the ICP when given', () => {
    const v = filledAbout(create({ sell: { ...emptySell('product', '2'), on: true, sku: 'S-1' } }))
    const body = buildPayload({ mode: 'create', initial: v, values: v, standing: 'none', hasAbout: false, icp: { b2b: { label: 'x' } } })
    assert.ok(body.about && body.sell && body.icp, 'About, Sell and ICP are all in one body')
  })
})

describe('the form model: what an edit sends', () => {
  const record = fullRecord()
  const initial = valuesFromRecord(record)
  const standing = standingOf(record.sell)

  it('sends nothing when nothing changed', () => {
    assert.deepEqual(buildPayload({ mode: 'edit', initial, values: initial, standing, hasAbout: true }), {})
  })

  it('sends only the About keys that changed, never the ID, and not Sell', () => {
    const v = { ...initial, about: { ...initial.about, whatItDoes: 'New words' } }
    const body = buildPayload({ mode: 'edit', initial, values: v, standing, hasAbout: true })
    assert.deepEqual(body, { about: { whatItDoes: 'New words' } })
  })

  it('sends only the Sell fields that changed, and the one switch as isActive, never enabled', () => {
    const v = { ...initial, sell: { ...initial.sell, unitPrice: '999', offered: false } }
    const body = buildPayload({ mode: 'edit', initial, values: v, standing, hasAbout: true })
    assert.deepEqual(body, { sell: { unitPrice: 999, isActive: false } })
  })

  it('a save that leaves the switch alone cannot resume a paused row', () => {
    const paused = fullRecord({ sell: sellRow({ state: 'paused', isActive: false }) })
    const start = valuesFromRecord(paused)
    const v = { ...start, sell: { ...start.sell, sku: 'NEW' } }
    const body = buildPayload({ mode: 'edit', initial: start, values: v, standing: 'live', hasAbout: true })
    const sell = body.sell as Record<string, unknown>
    assert.equal('enabled' in sell, false, 'enabled is not sent')
    assert.equal('isActive' in sell, false, 'the switch was not touched')
  })

  it('a field the person emptied is cleared (null), except the person it is assigned to', () => {
    const v = { ...initial, sell: { ...initial.sell, sku: '', assignedTo: '' } }
    const body = buildPayload({ mode: 'edit', initial, values: v, standing, hasAbout: true })
    assert.deepEqual(body, { sell: { sku: null } })
  })

  it('a row in the Recycle Bin is brought back by switching Sell in CRM on, and not otherwise', () => {
    const binned = fullRecord({ sell: sellRow({ state: 'binned' }) })
    const start = valuesFromRecord(binned)
    assert.equal(start.sell.on, false, 'a binned row opens switched off')
    assert.equal(buildPayload({ mode: 'edit', initial: start, values: start, standing: 'binned', hasAbout: true }).sell, undefined)
    const on = { ...start, sell: { ...start.sell, on: true } }
    assert.deepEqual(buildPayload({ mode: 'edit', initial: start, values: on, standing: 'binned', hasAbout: true }).sell, { enabled: true })
  })

  it('adds an About to a record that has none: the ID, the readiness, the Product and every field', () => {
    const itemRecord = fullRecord({ offer: null, about: null, parent: null })
    const start = valuesFromRecord(itemRecord)
    const v = { ...start, productId: '4', about: { ...start.about, offerId: 'SCH-10', readiness: 'concept' } }
    const body = buildPayload({ mode: 'edit', initial: start, values: v, standing: 'live', hasAbout: false })
    assert.equal(body.offerId, 'SCH-10')
    assert.equal(body.readiness, 'concept')
    assert.equal(body.productId, 4)
    assert.ok(body.about, 'the About is sent whole')
  })

  it('renames and moves under another Product only when they changed', () => {
    const v = { ...initial, name: 'Renamed', productId: '9' }
    assert.deepEqual(buildPayload({ mode: 'edit', initial, values: v, standing, hasAbout: true }), { name: 'Renamed', productId: 9 })
  })
})

describe('the form model: what is checked before the server is asked', () => {
  it('needs a name, and for a new About a Product, an ID and a readiness', () => {
    const e = checkValues(create({ productId: '', about: { ...emptyValues().about, whatItDoes: 'x' } }), { mode: 'create', hasAbout: false })
    assert.ok(e.name, 'a name is needed')
    assert.ok(e.productId, 'a Product is needed with an About')
    assert.ok(e.offerId, 'an ID is needed with an About')
    assert.ok(e.readiness, 'a readiness is needed with an About')
  })

  it('refuses a create with no section at all', () => {
    const e = checkValues(create({ name: 'Only a name' }), { mode: 'create', hasAbout: false })
    assert.match(e.sections ?? '', /at least one section/)
  })

  it('accepts a Sell-only create: no Product, ID or readiness needed', () => {
    const e = checkValues(create({ productId: '', name: 'Training day', sell: { ...emptySell('service'), on: true } }), { mode: 'create', hasAbout: false })
    assert.deepEqual(e, {})
  })

  it('does not ask for the ID of a record that has one (it never changes)', () => {
    const record = fullRecord()
    const e = checkValues({ ...valuesFromRecord(record), about: { ...valuesFromRecord(record).about, offerId: '' } }, { mode: 'edit', hasAbout: true })
    assert.equal(e.offerId, undefined)
  })

  it('knows when an About has been started', () => {
    assert.equal(aboutFilled(emptyValues().about), false)
    assert.equal(aboutFilled({ ...emptyValues().about, readiness: 'concept' }), true)
    assert.equal(aboutFilled({ ...emptyValues().about, primarySegments: ['k12'] }), true)
  })
})

describe('the form model: the dirty guard and the field map', () => {
  it('is dirty after a change, an ICP change or a picked picture, and clean otherwise', () => {
    const a = create()
    assert.equal(isDirty(a, a), false)
    assert.equal(isDirty(a, { ...a, name: 'x' }), true)
    assert.equal(isDirty(a, a, true), true)
    assert.equal(isDirty(a, { ...a, sell: { ...a.sell, image: new File(['x'], 'p.png') } }), true)
  })

  it('files every server key under its section', () => {
    assert.equal(sectionOf('about.whatItDoes'), 'about')
    assert.equal(sectionOf('offerId'), 'about')
    assert.equal(sectionOf('sell.unitPrice'), 'sell')
    assert.equal(sectionOf('sell'), 'sell')
    assert.equal(sectionOf('icp'), 'icp')
  })
})
