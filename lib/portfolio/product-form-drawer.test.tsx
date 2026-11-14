import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import type { PmFullRecord } from '../../services/product-master/record-types'
import { fullRecord, hrCan, hrRecord, sellRow } from './fixtures'
import { controlOf, fill, installWorld, openTab, press, refusal, switchOf, tabLabels, type World } from './screen-kit'

/** The one Add / Edit form in a fake browser: the services replaced by fakes that record what the form asks, and the real form, drawer and tabs. */
async function open(mode: 'create-sub-product' | 'create-product' | 'edit', world: World = {}, extra: { recordId?: number; defaultProductId?: number } = {}) {
  const k = await kit()
  const calls = await installWorld(k, world)
  const { ProductFormDrawer } = await import('../../components/domain/portfolio/product-form-drawer')
  const events = { saved: [] as Array<{ id: number }>, open: [] as boolean[] }
  await k.render(k.h(ProductFormDrawer, {
    open: true, onOpenChange: (o: boolean) => events.open.push(o), mode, recordId: extra.recordId, defaultProductId: extra.defaultProductId, onSaved: (s: { id: number }) => events.saved.push(s),
  }))
  await k.tick(40)
  return { k, calls, events }
}

const edit = (record: PmFullRecord, world: World = {}) => open('edit', { ...world, record }, { recordId: record.id })

describe('the form: create', () => {
  afterEach(disposeAll)

  it('opens under a Product with its next ID suggested, and three sections', async () => {
    const { k } = await open('create-sub-product', {}, { defaultProductId: 1 })
    assert.deepEqual(tabLabels(k), ['About', 'Sell in CRM', 'Ideal customer'])
    assert.equal((controlOf(k, 'ID') as HTMLInputElement).value, 'SCH-14', 'the next number after SCH-11, SCH-12 and SCH-13')
    assert.equal((controlOf(k, 'Product') as HTMLSelectElement).value, '1')
  })

  it('creates with an About only: the About, no Sell, no ICP', async () => {
    const { k, calls, events } = await open('create-sub-product', {}, { defaultProductId: 1 })
    await fill(k, 'Name', 'Fee Desk')
    await fill(k, 'Readiness', 'Proposal / concept')
    await fill(k, 'What it does', 'Collects fees.')
    await press(k, 'Save')
    await k.tick(30)
    assert.equal(calls.create.length, 1, 'one save')
    const body = calls.create[0]
    assert.equal(body.kind, 'sub_product')
    assert.equal(body.name, 'Fee Desk')
    assert.equal(body.offerId, 'SCH-14')
    assert.equal(body.readiness, 'Proposal / concept')
    assert.equal((body.about as Record<string, unknown>).whatItDoes, 'Collects fees.')
    assert.equal('sell' in body, false, 'Sell was not switched on')
    assert.equal('icp' in body, false, 'no ideal customer was filled in')
    assert.deepEqual(events.saved, [{ id: 77 }], 'the screen is told which record was made')
    assert.deepEqual(events.open, [false], 'the drawer closes after a save')
  })

  it('creates with a Sell only (a sales person: no About typed)', async () => {
    const { k, calls } = await open('create-sub-product')
    await fill(k, 'Name', 'Training day')
    await openTab(k, 'Sell in CRM')
    await k.click(switchOf(k, 'Sell in CRM')!)
    await fill(k, 'SKU', 'TRN-1')
    await fill(k, 'Unit price', '1500')
    await press(k, 'Save')
    await k.tick(30)
    const body = calls.create[0]
    for (const key of ['offerId', 'readiness', 'about', 'icp']) assert.equal(key in body, false, `${key} is not sent`)
    const sell = body.sell as Record<string, unknown>
    assert.equal(sell.enabled, true)
    assert.equal(sell.unitPrice, 1500)
    assert.equal(sell.sku, 'TRN-1')
    assert.equal(sell.assignedTo, 2, 'assigned to the signed-in person by default')
  })

  it('creates with both, and an ideal customer', async () => {
    const { k, calls } = await open('create-sub-product', {}, { defaultProductId: 1 })
    await fill(k, 'Name', 'Fee Desk')
    await fill(k, 'Readiness', 'Proposal / concept')
    await openTab(k, 'Sell in CRM')
    await k.click(switchOf(k, 'Sell in CRM')!)
    await fill(k, 'SKU', 'FD-1')
    await openTab(k, 'Ideal customer')
    await fill(k, 'ICP name', 'Fee Desk B2B')
    await fill(k, 'Ideal customer and organisation profile', 'Private schools with 500 or more students.')
    await press(k, 'Save')
    await k.tick(40)
    const body = calls.create[0]
    assert.ok(body.about, 'the About is in the body')
    assert.ok(body.sell, 'the Sell is in the body')
    const icp = body.icp as Record<string, { label: string; customer_model: string }>
    assert.deepEqual(Object.keys(icp), ['b2b'], 'only the model that was filled in')
    assert.equal(icp.b2b.customer_model, 'b2b')
    assert.equal(calls.checkConfig.length, 1, 'the ICP is checked before anything is saved')
  })

  it('names the three ideal customer models as today\'s Portfolio form does', async () => {
    const { k } = await open('create-sub-product')
    await openTab(k, 'Ideal customer')
    const labels = k.all('[role="tab"]').map((t) => (t.textContent ?? '').trim())
    for (const label of ['B2B Customer Acquisition', 'B2G ICP', 'B2B Partner Acquisition']) assert.ok(labels.includes(label), label)
  })

  it('refuses a save with no section at all, and says so', async () => {
    const { k, calls } = await open('create-sub-product')
    await fill(k, 'Name', 'Only a name')
    await press(k, 'Save')
    await k.tick(20)
    assert.equal(calls.create.length, 0, 'nothing was sent')
    assert.ok(k.bodyText().includes('at least one section'), 'the person is told')
  })

  it('shows the ID as typeable on a create and keeps the Sell switch single before the first save', async () => {
    const { k } = await open('create-sub-product')
    assert.equal((controlOf(k, 'ID') as HTMLInputElement).disabled, false, 'an ID is typed once')
    await openTab(k, 'Sell in CRM')
    assert.ok(switchOf(k, 'Sell in CRM'), 'before the first save there is the Sell in CRM switch')
    assert.ok(switchOf(k, 'Offered on new documents') === null, 'and not the second one')
  })
})

describe('the form: edit', () => {
  afterEach(disposeAll)

  it('fills every field of the record, and an ID that cannot be changed', async () => {
    const { k } = await edit(fullRecord())
    assert.equal((controlOf(k, 'Name') as HTMLInputElement).value, 'Fee Collection')
    const id = controlOf(k, 'ID') as HTMLInputElement
    assert.equal(id.value, 'SCH-11')
    assert.equal(id.disabled, true, 'the ID is fixed after the first save')
    assert.equal((controlOf(k, 'What it does') as HTMLTextAreaElement).value, 'Collects school fees online.')
    assert.equal((controlOf(k, 'Implementation effort') as HTMLInputElement).value, '4 weeks')
    assert.ok(k.bodyText().includes('Fees are collected late'), 'an older problem code is kept and named')
    assert.ok(k.bodyText().includes('Admissions (SCH-12)'), 'Often sold together names the Sub-product behind each ID')
  })

  it('sends nothing for a record nobody changed: Save is off', async () => {
    const { k, calls } = await edit(fullRecord())
    const save = k.withText('Save') as HTMLButtonElement
    assert.equal(save.disabled, true, 'nothing to save')
    assert.equal(calls.update.length, 0)
  })

  it('edits the About alone: only the changed About key is sent, and no Sell', async () => {
    const { k, calls } = await edit(fullRecord())
    await fill(k, 'What it does', 'New words')
    await press(k, 'Save')
    await k.tick(30)
    assert.deepEqual(calls.update, [{ id: 11, body: { about: { whatItDoes: 'New words' } } }])
  })

  it('edits the Sell alone: only the changed fields, and the picked picture goes up right after, keyed by the returned catalogue id', async () => {
    const { k, calls } = await edit(fullRecord())
    await openTab(k, 'Sell in CRM')
    await fill(k, 'Unit price', '1750')
    const file = new k.w.File(['x'], 'photo.png', { type: 'image/png' })
    await k.act(async () => {
      const input = controlOf(k, 'Image') as HTMLInputElement
      Object.defineProperty(input, 'files', { value: [file], configurable: true })
      input.dispatchEvent(new k.w.Event('change', { bubbles: true }))
    })
    await press(k, 'Save')
    await k.tick(40)
    assert.deepEqual(calls.update[0].body, { sell: { unitPrice: 1750 } })
    assert.equal(calls.uploads.length, 1, 'the picture is uploaded after the save')
    assert.equal(calls.uploads[0].productId, '301', 'keyed by sell.crmProductId')
  })

  it('edits the ideal customer alone', async () => {
    const { k, calls } = await edit(fullRecord())
    await openTab(k, 'Ideal customer')
    await fill(k, 'ICP name', 'Fee Collection B2B')
    await fill(k, 'Ideal customer and organisation profile', 'Schools.')
    await press(k, 'Save')
    await k.tick(40)
    const body = calls.update[0].body
    assert.deepEqual(Object.keys(body), ['icp'], 'nothing but the ICP')
    assert.deepEqual(Object.keys(body.icp as object), ['b2b'])
  })

  it('has ONE switch once the record is saved, Offered on new documents, and sends it as isActive alone', async () => {
    const { k, calls } = await edit(fullRecord())
    await openTab(k, 'Sell in CRM')
    assert.ok(switchOf(k, 'Sell in CRM') === null, 'no second switch')
    const offered = switchOf(k, 'Offered on new documents')!
    assert.equal(offered.checked, true)
    await k.click(offered)
    await press(k, 'Save')
    await k.tick(30)
    assert.deepEqual(calls.update[0].body, { sell: { isActive: false } }, 'one key; enabled is never sent')
  })

  it('shows a paused record as paused and saving another field does not resume it', async () => {
    const paused = fullRecord({ sell: sellRow({ state: 'paused', isActive: false }) })
    const { k, calls } = await edit(paused)
    await openTab(k, 'Sell in CRM')
    assert.equal(switchOf(k, 'Offered on new documents')!.checked, false, 'it opens paused')
    await fill(k, 'SKU', 'NEW-SKU')
    await press(k, 'Save')
    await k.tick(30)
    assert.deepEqual(calls.update[0].body, { sell: { sku: 'NEW-SKU' } })
  })

  it('brings a binned record back only when Sell in CRM is switched on', async () => {
    const binned = fullRecord({ sell: sellRow({ state: 'binned' }) })
    const { k, calls } = await edit(binned)
    await openTab(k, 'Sell in CRM')
    assert.ok(k.bodyText().includes('Recycle Bin'), 'the person is told it is in the Recycle Bin')
    await k.click(switchOf(k, 'Sell in CRM')!)
    await press(k, 'Save')
    await k.tick(30)
    assert.deepEqual(calls.update[0].body, { sell: { enabled: true } })
  })

  it('shows a stored category that is not in the picklist as an extra option, never blank', async () => {
    const odd = fullRecord({ sell: sellRow({ category: 'Fee software 2025' }) })
    const { k } = await edit(odd)
    await openTab(k, 'Sell in CRM')
    const select = controlOf(k, 'Category') as HTMLSelectElement
    assert.equal(select.value, 'Fee software 2025')
    const options = Array.from(select.options).map((o) => o.value)
    assert.ok(options.includes('Software') && options.includes('Training'), 'the picklist is offered for a new choice')
  })

  it('a Service has no vendor, stock, demand, reorder level or weight', async () => {
    const service = fullRecord({ sell: sellRow({ type: 'service', vendor: null, qtyInStock: null, qtyInDemand: null, reorderLevel: null, weight: null }) })
    const { k } = await edit(service)
    await openTab(k, 'Sell in CRM')
    const labels = k.all('label').map((l) => (l.textContent ?? '').trim())
    for (const gone of ['Vendor', 'Stock', 'Stock in demand', 'Reorder level', 'Weight (kg)']) assert.equal(labels.includes(gone), false, `${gone} is hidden for a Service`)
    for (const kept of ['SKU', 'Unit price', 'Cost price', 'Commission %', 'Tax rate', 'GL account', 'Usage unit', 'Assigned to', 'Description on quotes']) assert.ok(labels.includes(kept), `${kept} stays`)
  })

  it('a Sub-product shows every field of the old Products form on the Sell section', async () => {
    const { k } = await edit(fullRecord())
    await openTab(k, 'Sell in CRM')
    const labels = k.all('label').map((l) => (l.textContent ?? '').trim())
    for (const f of ['Type', 'SKU', 'Category', 'GL account', 'Unit price', 'Currency', 'Cost price', 'Commission %', 'Tax rate', 'Usage unit', 'Vendor', 'Stock', 'Stock in demand', 'Reorder level', 'Weight (kg)', 'Assigned to', 'Image', 'Description on quotes']) {
      assert.ok(labels.includes(f), `${f} is on the form`)
    }
  })
})

describe('the form: refusals', () => {
  afterEach(disposeAll)

  it('shows a 422 next to its field and opens the section that holds it', async () => {
    const { k } = await edit(fullRecord(), { refuse: refusal(422, 'The given data was invalid.', { 'sell.unitPrice': ['The unit price must be a number.'] }) })
    await fill(k, 'What it does', 'x')
    await press(k, 'Save')
    await k.tick(30)
    const selected = k.one('[role="tab"][aria-selected="true"]')!.textContent ?? ''
    assert.ok(selected.startsWith('Sell in CRM'), 'the Sell section is opened')
    const field = controlOf(k, 'Unit price')
    assert.equal(field.getAttribute('aria-invalid'), 'true', 'the field is marked')
    assert.ok(k.bodyText().includes('The unit price must be a number.'), 'its message is shown beside it')
    assert.ok(k.one('[role="dialog"]'), 'the drawer stays open')
  })

  it('shows a 422 on the one switch under that switch', async () => {
    const { k } = await edit(fullRecord(), { refuse: refusal(422, 'Contradiction.', { 'sell.isActive': ['Sell in CRM and Offered on new documents are one switch.'] }) })
    await openTab(k, 'Sell in CRM')
    await k.click(switchOf(k, 'Offered on new documents')!)
    await press(k, 'Save')
    await k.tick(30)
    assert.ok(k.bodyText().includes('are one switch'), 'the message is shown')
  })

  it('names the refused section on a 403', async () => {
    const { k } = await edit(fullRecord(), { refuse: refusal(403, 'You do not have the right to do this.', { about: ['You do not have the right to edit the Product Portfolio (the About section).'] }) })
    await fill(k, 'What it does', 'x')
    await press(k, 'Save')
    await k.tick(30)
    const alerts = k.all('[role="alert"]').map((a) => a.textContent ?? '')
    assert.ok(alerts.some((a) => a.includes('the About section')), 'the About section is named')
    assert.ok(k.one('[role="tab"][aria-selected="true"]')!.textContent!.startsWith('About'))
  })

  it('opens the Sell section and names it when the server refuses that section on a 403', async () => {
    const { k } = await edit(fullRecord(), { refuse: refusal(403, 'You do not have the right to do this.', { sell: ['You do not have the right to edit the CRM catalogue (the Sell section).'] }) })
    await openTab(k, 'Sell in CRM')
    await fill(k, 'Unit price', '1999')
    await openTab(k, 'About')
    await press(k, 'Save')
    await k.tick(30)
    assert.ok(k.one('[role="tab"][aria-selected="true"]')!.textContent!.startsWith('Sell in CRM'), 'the refused section is opened')
    const panel = k.one('[role="tabpanel"]:not([hidden])')!
    assert.ok(panel.textContent!.includes('the Sell section'), 'the section names its own refusal')
    assert.equal(k.all('[role="alert"]').filter((a) => a.closest('[role="tabpanel"]') === null && (a.textContent ?? '').includes('Sell section')).length, 0, 'it is on the section, not only in a banner')
  })

  it('shows the ID taken on its field after a 422', async () => {
    const { k } = await open('create-sub-product', { refuse: refusal(422, 'Invalid.', { offerId: ['This ID is already used by another sub-product.'] }) }, { defaultProductId: 1 })
    await fill(k, 'Name', 'Fee Desk')
    await fill(k, 'Readiness', 'Proposal / concept')
    await press(k, 'Save')
    await k.tick(30)
    assert.ok(k.bodyText().includes('already used'), 'the message sits by the ID')
  })

  it('stops before saving when the ideal customer check fails: "Nothing was saved"', async () => {
    const { k, calls } = await open('create-sub-product', { icpProblems: ['The ICP needs at least one trigger.'] }, { defaultProductId: 1 })
    await fill(k, 'Name', 'Fee Desk')
    await fill(k, 'Readiness', 'Proposal / concept')
    await openTab(k, 'Ideal customer')
    await fill(k, 'ICP name', 'Fee Desk B2B')
    await fill(k, 'Ideal customer and organisation profile', 'Schools.')
    await press(k, 'Save')
    await k.tick(30)
    assert.equal(calls.create.length, 0, 'nothing was sent')
    assert.ok(k.bodyText().includes('Nothing was saved'), 'the person is told')
  })

  it('keeps the saved record and says out loud when only the picture failed', async () => {
    const { k, calls, events } = await edit(fullRecord(), { uploadFails: true })
    await openTab(k, 'Sell in CRM')
    await fill(k, 'Unit price', '1800')
    const file = new k.w.File(['x'], 'photo.png', { type: 'image/png' })
    await k.act(async () => {
      const input = controlOf(k, 'Image') as HTMLInputElement
      Object.defineProperty(input, 'files', { value: [file], configurable: true })
      input.dispatchEvent(new k.w.Event('change', { bubbles: true }))
    })
    await press(k, 'Save')
    await k.tick(40)
    assert.equal(calls.update.length, 1, 'the record was saved')
    assert.ok(k.bodyText().includes('Details: saved.') && k.bodyText().includes('Picture: not uploaded'), 'a status per section, none silent')
    assert.deepEqual(events.saved, [], 'the screen is told when the person closes this panel')
    await press(k, 'Close')
    assert.deepEqual(events.saved, [{ id: 11 }])
  })
})

describe('the form: who sees what', () => {
  afterEach(disposeAll)

  it('shows HR the About and the Ideal customer only: no Sell section, no price anywhere', async () => {
    const { k } = await edit(hrRecord(), { meta: (await import('./fixtures')).meta({}, hrCan) })
    assert.deepEqual(tabLabels(k), ['About', 'Ideal customer'])
    const text = k.bodyText()
    for (const word of ['Unit price', 'Cost price', 'Commission', 'SKU', '1500', '900']) assert.equal(text.includes(word), false, `${word} is not shown to HR`)
  })

  it('shows HR a create form with no Sell section either', async () => {
    const { k } = await open('create-sub-product', { meta: (await import('./fixtures')).meta({}, hrCan) })
    assert.deepEqual(tabLabels(k), ['About', 'Ideal customer'])
  })

  it('shows a sales-like caller (Sell only) the Sell section on a record that has none yet', async () => {
    const { k } = await edit(hrRecord())
    assert.deepEqual(tabLabels(k), ['About', 'Sell in CRM', 'Ideal customer'], 'the right to sell is what opens the section')
  })
})

describe('the form: closing, keys, vocabulary', () => {
  afterEach(disposeAll)

  it('closes at once when nothing was typed', async () => {
    const { k, events } = await open('create-sub-product')
    await press(k, 'Cancel')
    await k.tick(10)
    assert.deepEqual(events.open, [false])
  })

  it('asks before throwing typed changes away, and keeps the form when the person says no', async () => {
    const { k, events } = await open('create-sub-product')
    await fill(k, 'Name', 'Half typed')
    await press(k, 'Cancel')
    await k.tick(10)
    assert.ok(k.bodyText().includes('Discard your changes?'), 'the guard asks')
    assert.deepEqual(events.open, [], 'nothing closed yet')
    await press(k, 'Cancel')
    await k.tick(10)
    assert.deepEqual(events.open, [], 'saying no keeps the form')
    assert.equal((controlOf(k, 'Name') as HTMLInputElement).value, 'Half typed')
  })

  it('discards when the person agrees', async () => {
    const { k, events } = await open('create-sub-product')
    await fill(k, 'Name', 'Half typed')
    await press(k, 'Cancel')
    await k.tick(10)
    await press(k, 'Discard changes')
    await k.tick(10)
    assert.deepEqual(events.open, [false])
  })

  it('moves between the sections with the arrow keys', async () => {
    const { k } = await open('create-sub-product')
    const first = k.one('[role="tab"][aria-selected="true"]')!
    first.focus()
    await k.press('ArrowRight', first)
    assert.ok(k.one('[role="tab"][aria-selected="true"]')!.textContent!.startsWith('Sell in CRM'))
    await k.press('End')
    assert.ok(k.one('[role="tab"][aria-selected="true"]')!.textContent!.startsWith('Ideal customer'))
  })

  it('adds a Product with a name and a key only, as an administrator', async () => {
    const { k, calls, events } = await open('create-product')
    await fill(k, 'Name', 'Payroll Cloud')
    assert.equal((controlOf(k, 'Key') as HTMLInputElement).value, 'payroll_cloud', 'the key follows the name')
    await press(k, 'Save')
    await k.tick(30)
    assert.deepEqual(calls.create, [{ kind: 'product', name: 'Payroll Cloud', key: 'payroll_cloud' }])
    assert.deepEqual(events.saved, [{ id: 77 }])
  })

  it('asks before throwing away a half typed new Product too', async () => {
    const { k, events } = await open('create-product')
    await fill(k, 'Name', 'Payroll')
    await press(k, 'Cancel')
    await k.tick(10)
    assert.ok(k.bodyText().includes('Discard your changes?'))
    assert.deepEqual(events.open, [])
  })

  it('shows a refused key on the key field', async () => {
    const { k } = await open('create-product', { refuse: refusal(422, 'Invalid.', { key: ['That key is already used.'] }) })
    await fill(k, 'Name', 'Payroll Cloud')
    await press(k, 'Save')
    await k.tick(30)
    assert.ok(k.bodyText().includes('That key is already used.'))
  })

  it('has no accessibility violation on any of its three sections', async () => {
    const { k } = await open('create-sub-product', {}, { defaultProductId: 1 })
    for (const name of ['About', 'Sell in CRM', 'Ideal customer']) {
      await openTab(k, name)
      await k.click(switchOf(k, 'Sell in CRM') ?? k.one('body')!)
      const root = k.one('[role="dialog"]')!
      assert.deepEqual(await axeViolations(root), [], `${name} has no axe violation`)
    }
  })

  it('says Product and Sub-product everywhere and never Catalogue, Offer, Item or Product line', async () => {
    const { k } = await edit(fullRecord())
    for (const name of ['About', 'Sell in CRM', 'Ideal customer']) {
      await openTab(k, name)
      const text = k.bodyText()
      assert.equal(/\b(catalogues?|offers?|items?|product lines?)\b/i.test(text), false, `${name}: ${(text.match(/\b(catalogues?|offers?|items?|product lines?)\b/i) ?? [''])[0]} is on screen`)
    }
  })
})
