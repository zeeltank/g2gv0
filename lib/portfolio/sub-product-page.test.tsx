import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import { routerHarness } from '../signals/router-harness'
import { axeViolations } from '../agent/a11y'
import { fullRecord, hrCan, hrRecord, listRow, meta, productRecord, sellRow } from './fixtures'
import { installWorld, openTab, press, tabLabels, type World } from './screen-kit'

/** One Sub-product page in a fake browser: the tab kept in the address, every service replaced by a fake that records what the page asks. */
async function openPage(world: World = {}, opts: { search?: string } = {}) {
  const k = await kit()
  const router = await routerHarness(opts.search ?? '', '/portfolio/products/11')
  const calls = await installWorld(k, { record: fullRecord(), ...world })
  const { SubProductPage } = await import('../../components/domain/portfolio/sub-product-page')
  const backs = { n: 0 }
  const names: string[] = []
  await k.render(router.wrap(k.h(SubProductPage, { id: '11', onBack: () => { backs.n += 1 }, onNameKnown: (n: string) => names.push(n) })))
  await k.tick(80)
  return { k, router, calls, backs, names }
}

const hr = (over: World = {}): World => ({ record: hrRecord(), meta: meta({}, hrCan), viewSell: false, listRow: listRow({ state: 'sold' }), usageRefused: true, ...over })

describe('a Sub-product page: the tabs', () => {
  afterEach(disposeAll)

  it('shows its name, where it sits and the six tabs of both old modules, opening on the Overview', async () => {
    const { k, names } = await openPage()
    assert.equal(k.one('h1')!.textContent, 'Fee Collection')
    assert.ok(k.bodyText().includes('Sub-product · ScholarClone · SCH-11'))
    assert.deepEqual(tabLabels(k), ['Overview', 'Details', 'Bundle', 'Usage', 'History', 'Signals & ICP'])
    assert.equal(k.one('[role="tab"][aria-selected="true"]')!.textContent, 'Overview')
    assert.deepEqual(names, ['Fee Collection'], 'the breadcrumb is told the name')
  })

  it('shows the state chips: Sold in CRM, the readiness and the signals found (read from the list, not from usage)', async () => {
    const { k, calls } = await openPage()
    const text = k.bodyText()
    for (const word of ['Sold in CRM', 'Live – with client', '4 signals']) assert.ok(text.includes(word), word)
    assert.equal(calls.usage.length, 0, 'usage is not read for the header')
  })

  it('shows Paused for a paused record and Not sold for a binned one', async () => {
    const paused = await openPage({ record: fullRecord({ sell: sellRow({ state: 'paused', isActive: false }) }) })
    assert.ok(paused.k.bodyText().includes('Paused'))
    await disposeAll()
    const binned = await openPage({ record: fullRecord({ sell: sellRow({ state: 'binned' }) }) })
    assert.ok(binned.k.bodyText().includes('Not sold'))
  })

  it('adds the Custom Fields tab only when the organisation has definitions', async () => {
    const without = await openPage()
    assert.equal(tabLabels(without.k).includes('Custom Fields'), false)
    await disposeAll()
    const withFields = await openPage({ customFields: true })
    assert.ok(tabLabels(withFields.k).includes('Custom Fields'))
  })

  it('has no Bundle tab for a Service, and no Custom Fields or Details tabs for a record with no Sell section', async () => {
    const service = await openPage({ record: fullRecord({ sell: sellRow({ type: 'service' }) }) })
    assert.equal(tabLabels(service.k).includes('Bundle'), false, 'a Service is not a bundle')
    await disposeAll()
    const about = await openPage({ record: fullRecord({ sell: null, crmProduct: null }), customFields: true })
    assert.deepEqual(tabLabels(about.k), ['Overview', 'History', 'Signals & ICP'], 'a seller sees History but no Sell tab on an About-only record')
  })

  it('opens the tab named in the address, and moves between tabs with the arrow keys', async () => {
    const { k } = await openPage({}, { search: 'tab=usage' })
    assert.equal(k.one('[role="tab"][aria-selected="true"]')!.textContent, 'Usage')
    const tab = k.one('[role="tab"][aria-selected="true"]')!
    tab.focus()
    await k.press('ArrowRight', tab)
    assert.equal(k.one('[role="tab"][aria-selected="true"]')!.textContent, 'History')
    await k.press('Home')
    assert.equal(k.one('[role="tab"][aria-selected="true"]')!.textContent, 'Overview')
  })

  it('says it cannot be found for an unknown record, and goes back', async () => {
    const { k, backs } = await openPage({ record: null })
    assert.ok(k.bodyText().includes('could not be found'))
    await press(k, 'Back to Product Portfolio')
    assert.equal(backs.n, 1)
  })

  it('sends a level-1 Product to its own page', async () => {
    const { router } = await openPage({ record: productRecord() })
    assert.ok(router.written.includes('/portfolio/scholarclone'), `the Product page, not this one (wrote ${router.written.join(', ')})`)
  })
})

describe('a Sub-product page: what each tab reads and shows', () => {
  afterEach(disposeAll)

  it('Overview: the whole About, the Product as a link, and nothing from Sell', async () => {
    const { k } = await openPage()
    const text = k.bodyText()
    for (const part of ['Collects school fees online.', 'Invoices, receipts', 'Late fee collection', 'K-12 schools', 'Funding or budget', 'Used by 12 schools', 'Per student', '1-5 lakh', '4 weeks', 'Delivery team', 'Admissions (SCH-12)', 'Fees are collected late']) {
      assert.ok(text.includes(part), part)
    }
    const link = k.all('a').find((a) => a.textContent === 'ScholarClone')
    assert.equal(link?.getAttribute('href'), '/portfolio/scholarclone', 'the Product opens its own page')
  })

  it('Overview: says whether partners can sell it, by the readiness rule of the Portfolio', async () => {
    const live = await openPage()
    assert.ok(live.k.bodyText().includes('Partners can sell it'), 'Live with a client is open to partners')
    await disposeAll()
    const early = await openPage({ record: fullRecord({ offer: { ...fullRecord().offer!, readiness: 'Prototype' } }) })
    assert.ok(early.k.bodyText().includes('Not open to partners yet'), 'a prototype is not')
  })

  it('Overview: an administrator confirms readiness with a note of what was verified, and the confirmation is logged', async () => {
    const { k, calls } = await openPage()
    await press(k, 'Confirm readiness')
    await k.tick(10)
    const dialog = k.one('[role="dialog"]')!
    assert.ok(dialog.textContent!.includes('What was verified'), 'the dialog asks')
    const confirm = k.all('button').filter((b) => b.textContent?.trim() === 'Confirm readiness').pop()!
    await k.click(confirm)
    assert.equal(calls.readiness.length, 0, 'a note of 5 characters is required')
    const note = k.one('#readiness-note') as HTMLTextAreaElement
    await k.act(async () => {
      Object.getOwnPropertyDescriptor(k.w.HTMLTextAreaElement.prototype, 'value')!.set!.call(note, 'Checked on a live school')
      note.dispatchEvent(new k.w.Event('input', { bubbles: true }))
    })
    await k.click(k.all('button').filter((b) => b.textContent?.trim() === 'Confirm readiness').pop()!)
    await k.tick(20)
    assert.deepEqual(calls.readiness, [{ id: 501, confirmed: true, note: 'Checked on a live school' }])
    assert.ok(k.bodyText().includes('Checked on site'), 'the readiness log is listed')
  })

  it('Overview: a person who is not an administrator is told who confirms, and has no button', async () => {
    const { k } = await openPage({ meta: meta({}, { createProduct: false }) })
    assert.ok(k.withText('Confirm readiness') === null, 'no Confirm readiness button for a non-administrator')
    assert.ok(k.bodyText().includes('Only an administrator can confirm readiness'))
  })

  it('Details: every Sell field of the old Products page, the picture beside the name and who it is assigned to', async () => {
    const { k } = await openPage({ record: fullRecord({ sell: sellRow({ imageUrl: 'https://img.example/fee.png' }) }) })
    await openTab(k, 'Details')
    const labels = k.all('dt').map((d) => d.textContent)
    for (const f of ['SKU', 'Category', 'GL account', 'Unit price', 'Cost price', 'Commission %', 'Tax rate', 'Offered on new documents', 'Usage unit', 'Vendor', 'Stock', 'Stock in demand', 'Reorder level', 'Weight (kg)', 'Description on quotes', 'Assigned to']) {
      assert.ok(labels.includes(f), `${f} is on the Details tab`)
    }
    const text = k.bodyText()
    for (const v of ['SCH-FEE', 'INR 1,500.00', 'INR 900.00', '5%', 'GST', 'Acme', 'Fee collection licence', 'Asha Rao']) assert.ok(text.includes(v), v)
    assert.equal(k.one('img[alt="Fee Collection picture"]')!.getAttribute('src'), 'https://img.example/fee.png')
  })

  it('Details: a Service hides stock, stock in demand, reorder level, vendor and weight', async () => {
    const { k } = await openPage({ record: fullRecord({ sell: sellRow({ type: 'service' }) }) })
    await openTab(k, 'Details')
    const labels = k.all('dt').map((d) => d.textContent)
    for (const gone of ['Vendor', 'Stock', 'Stock in demand', 'Reorder level', 'Weight (kg)']) assert.equal(labels.includes(gone), false, gone)
    assert.ok(labels.includes('SKU') && labels.includes('Unit price'))
  })

  it('Bundle: lists the priced parts with their quantity, and adds and removes one with the calls the old page used', async () => {
    const { k, calls } = await openPage({
      bundle: [{ id: '9', productId: '400', name: 'Receipt printer', itemType: 'product', unitPrice: 200, quantity: 3 }],
      pickerRows: [{ crmProductId: 450, masterId: 15, name: 'Barcode scanner', productName: 'ScholarClone', sku: 'BC-1', unitPrice: 80, currency: 'INR', taxRateId: null, type: 'product' }],
    })
    await openTab(k, 'Bundle')
    await k.tick(20)
    assert.ok(k.bodyText().includes('Receipt printer'))
    assert.ok(k.bodyText().includes('INR 600.00'), 'the parts total is the sum of price times quantity')
    await press(k, 'Add a part')
    await k.tick(300)
    const select = k.one('[role="dialog"] select') as HTMLSelectElement
    await k.act(async () => {
      Object.getOwnPropertyDescriptor(k.w.HTMLSelectElement.prototype, 'value')!.set!.call(select, '450')
      select.dispatchEvent(new k.w.Event('change', { bubbles: true }))
    })
    await press(k, 'Add')
    await k.tick(30)
    assert.deepEqual(calls.bundleAdds, [{ productId: '301', componentProductId: '450', quantity: 1 }], 'keyed by the Sell entry\'s id')
    await k.click(k.one('button[aria-label="Remove Receipt printer"]')!)
    await k.tick(10)
    await press(k, 'Remove')
    await k.tick(20)
    assert.deepEqual(calls.bundleRemoves, [{ productId: '301', rowId: '9' }])
  })

  it('Bundle: a person who may not edit sees the parts and no buttons', async () => {
    const { k } = await openPage({ meta: meta({}, { editItem: { product: false, service: false } }), bundle: [{ id: '9', productId: '400', name: 'Receipt printer', itemType: 'product', unitPrice: 200, quantity: 3 }] })
    await openTab(k, 'Bundle')
    await k.tick(20)
    assert.ok(k.bodyText().includes('Receipt printer'))
    assert.ok(k.withText('Add a part') === null, 'no Add a part button without the right to edit')
    assert.ok(k.one('button[aria-label="Remove Receipt printer"]') === null, 'no Remove button without the right to edit')
  })

  it('Usage: reads only when opened, counts every kind of use and links the latest quotes, orders and invoices to their pages', async () => {
    const { k, calls } = await openPage()
    assert.equal(calls.usage.length, 0, 'not read before the tab is opened')
    await openTab(k, 'Usage')
    await k.tick(20)
    assert.deepEqual(calls.usage, [11])
    const hrefs = k.all('a').map((a) => a.getAttribute('href'))
    for (const h of ['/module/crm/sales/quotes/91', '/module/crm/sales/sales-orders/41', '/module/crm/sales/invoices/17', '/module/crm/sales/price-books']) assert.ok(hrefs.includes(h), h)
    const text = k.bodyText()
    for (const part of ['Q-0091', 'SO-0041', 'INV-0017', 'Standard 2026', 'Opportunities', 'Sales orders']) assert.ok(text.includes(part), part)
  })

  it('History: reads only when opened, newest first, with the Sell lines and who changed what', async () => {
    const { k, calls } = await openPage()
    assert.equal(calls.history.length, 0)
    await openTab(k, 'History')
    await k.tick(20)
    assert.equal(calls.history.length, 1)
    const text = k.bodyText()
    for (const part of ['Changed', 'Sell in CRM', 'Asha Rao', 'Unit price: 1400 → 1500']) assert.ok(text.includes(part), part)
  })

  it('History: pages through a long list', async () => {
    const { k, calls } = await openPage({ lastPage: 3 })
    await openTab(k, 'History')
    await k.tick(20)
    await press(k, 'Next')
    await k.tick(20)
    assert.deepEqual(calls.history.map((c) => c.page), [1, 2])
  })

  it('Signals & ICP: the signals found and the ideal customer state come from the list and the record, never from usage', async () => {
    const { k, calls } = await openPage(hr())
    await openTab(k, 'Signals & ICP')
    await k.tick(20)
    const text = k.bodyText()
    assert.ok(text.includes('Signals found') && text.includes('4'), 'the count is shown')
    assert.ok(text.includes('In use'), 'the ICP state is shown')
    assert.equal(calls.usage.length, 0, 'usage is never asked for this tab, and for HR it is a refusal')
    assert.ok(k.all('a').some((a) => a.getAttribute('href')?.startsWith('/signals?product=')), 'a link to the signals')
  })

  it('says where a merged record went: a notice with a link to the record it was merged into, and none for any other record', async () => {
    const merged = await openPage({ record: fullRecord({ status: 'archived', mergedInto: { id: 12, key: 'scholarclone/sch-12', name: 'Fee Collection (kept)' } }) })
    assert.ok(merged.k.bodyText().includes('This record was merged into Fee Collection (kept)'))
    assert.equal(merged.k.all('a').find((a) => a.textContent === 'Fee Collection (kept)')?.getAttribute('href'), '/portfolio/products/12')
    await disposeAll()
    const plain = await openPage()
    assert.equal(plain.k.bodyText().includes('was merged into'), false)
    await disposeAll()
    const nulled = await openPage({ record: fullRecord({ mergedInto: null }) })
    assert.equal(nulled.k.bodyText().includes('was merged into'), false)
  })

  it('Signals & ICP of an archived Sub-product: does not ask the old endpoint (it answers 404 for an archived one), says why in a sentence and shows no error', async () => {
    // found in the real-browser walk of 23 Nov 2026: archiving with this tab open made the tab say "The ideal customer could not be read."
    const { k, calls } = await openPage({ record: fullRecord({ status: 'archived' }) })
    await openTab(k, 'Signals & ICP')
    await k.tick(20)
    assert.deepEqual(calls.offers, [], 'the ideal customer is not asked for')
    assert.ok(k.bodyText().includes('This sub-product is archived. Restore it to see or change its ideal customer'))
    assert.equal(k.all('[role="alert"]').length, 0, 'and no error is drawn')
    assert.equal(k.all('ul[aria-label="Customer models"]').length, 0, 'no stale list of models')
  })

  it('Signals & ICP: names the three ideal customer models and opens the form to edit them', async () => {
    const { k } = await openPage({ offerIcps: { b2b: { label: 'Fee B2B', industry_label: 'Private schools.' } } })
    await openTab(k, 'Signals & ICP')
    await k.tick(20)
    const text = k.bodyText()
    for (const label of ['B2B Customer Acquisition', 'B2G ICP', 'B2B Partner Acquisition', 'Private schools.']) assert.ok(text.includes(label), label)
    const edit = k.all('button').find((b) => b.textContent?.trim() === 'Edit' && b.closest('[role="tabpanel"]'))!
    await k.click(edit)
    await k.tick(60)
    assert.ok(k.one('[role="dialog"]')!.textContent!.includes('Edit Fee Collection'), 'the form opens on this record')
  })
})

describe('a Sub-product page: who sees what', () => {
  afterEach(disposeAll)

  it('shows HR the Overview and Signals & ICP only: no Sell tab, no price anywhere, and no call that would be refused', async () => {
    const { k, calls } = await openPage(hr())
    assert.deepEqual(tabLabels(k), ['Overview', 'Signals & ICP'])
    const text = k.bodyText()
    for (const word of ['Unit price', 'Cost price', 'Commission', 'SKU', 'Stock', 'Usage', 'History', '1500']) assert.equal(text.includes(word), false, `${word} is not shown to HR`)
    assert.ok(k.withText('Sold in CRM', 'span') === null, 'HR is not shown the Sell state')
    assert.equal(calls.usage.length + calls.history.length, 0, 'usage and history are never asked for')
  })

  it('draws no tab for a caller who may not see it, and no refusal text for it', async () => {
    const { k } = await openPage(hr())
    assert.equal(k.all('[role="tab"]').length, 2)
    assert.equal(/do not have the right|not allowed|forbidden/i.test(k.bodyText()), false)
  })

  it('hides Edit when the caller may not edit, and for a shared record', async () => {
    const noEdit = await openPage({ meta: meta({}, { editSubProduct: false }) })
    assert.ok(noEdit.k.withText('Edit') === null, 'no Edit button without the right to edit')
    await disposeAll()
    const shared = await openPage({ record: fullRecord({ shared: true }) })
    assert.ok(shared.k.withText('Edit') === null, 'a shared record is read only')
    assert.ok(shared.k.withText('Archive') === null, 'no Archive button for a shared record')
    assert.ok(shared.k.bodyText().includes('Shared, read only'))
  })
})

describe('a Sub-product page: the actions', () => {
  afterEach(disposeAll)

  it('opens the one form on Edit', async () => {
    const { k } = await openPage()
    await press(k, 'Edit')
    await k.tick(60)
    assert.ok(k.one('[role="dialog"]')!.textContent!.includes('Edit Fee Collection'))
  })

  it('asks before archiving, keeps the record when the answer is no, and archives when it is yes', async () => {
    const { k, calls } = await openPage()
    await press(k, 'Archive')
    await k.tick(10)
    assert.ok(k.bodyText().includes('Archive Fee Collection?'), 'the person is asked')
    await k.click(k.all('button').find((b) => b.textContent?.trim() === 'Cancel')!)
    await k.tick(10)
    assert.deepEqual(calls.archive, [], 'a no archives nothing')
    await press(k, 'Archive')
    await k.tick(10)
    await k.click(k.all('[role="alertdialog"] button, [role="dialog"] button').find((b) => b.textContent?.trim() === 'Archive')!)
    await k.tick(20)
    assert.deepEqual(calls.archive, [11])
    assert.ok(k.bodyText().includes('Archived'))
  })

  it('Delete from Sell in CRM asks first, and keeps the Sub-product: the entry goes to the Recycle Bin', async () => {
    const { k, calls } = await openPage()
    await press(k, 'Delete from Sell in CRM')
    await k.tick(10)
    assert.ok(k.bodyText().includes('Recycle Bin'), 'the question says where it goes')
    assert.deepEqual(calls.deleted, [], 'nothing is deleted before the answer')
    await k.click(k.all('button').find((b) => b.textContent?.trim() === 'Cancel')!)
    await k.tick(10)
    assert.deepEqual(calls.deleted, [], 'a no deletes nothing')
    await press(k, 'Delete from Sell in CRM')
    await k.tick(10)
    await k.click(k.all('[role="alertdialog"] button, [role="dialog"] button').find((b) => b.textContent?.trim() === 'Delete from Sell in CRM')!)
    await k.tick(30)
    assert.deepEqual(calls.deleted, ['301'], 'the CRM entry is deleted by its own id')
    assert.equal(calls.archive.length, 0, 'the Sub-product itself is not archived')
    assert.ok(k.bodyText().includes('stays, as Not sold'))
  })

  it('offers Delete from Sell in CRM to administrators only, and not for an entry already in the Recycle Bin', async () => {
    const seller = await openPage({ meta: meta({}, { createProduct: false }) })
    assert.ok(seller.k.withText('Delete from Sell in CRM') === null, 'Delete from Sell in CRM is for administrators only')
    await disposeAll()
    const binned = await openPage({ record: fullRecord({ sell: sellRow({ state: 'binned' }) }) })
    assert.ok(binned.k.withText('Delete from Sell in CRM') === null, 'an entry already in the Recycle Bin is not deleted again')
  })

  it('says out loud when the delete is refused', async () => {
    const { k } = await openPage({ deleteFails: true })
    await press(k, 'Delete from Sell in CRM')
    await k.tick(10)
    await k.click(k.all('[role="alertdialog"] button, [role="dialog"] button').find((b) => b.textContent?.trim() === 'Delete from Sell in CRM')!)
    await k.tick(30)
    assert.ok(k.all('[role="alert"]').some((a) => (a.textContent ?? '').includes('could not be deleted')))
  })
})

describe('a Sub-product page: accessibility and words', () => {
  afterEach(disposeAll)

  it('has no axe violation on any tab', async () => {
    const { k } = await openPage({ customFields: true })
    for (const name of ['Overview', 'Details', 'Bundle', 'Usage', 'History', 'Signals & ICP', 'Custom Fields']) {
      await openTab(k, name)
      await k.tick(30)
      const panel = k.one('[role="tabpanel"]:not([hidden])')!.parentElement as HTMLElement
      assert.deepEqual(await axeViolations(panel), [], `${name} has no axe violation`)
    }
  })

  it('says Product and Sub-product everywhere and never Catalogue, Offer, Item or Product line', async () => {
    const { k } = await openPage({ customFields: true, bundle: [{ id: '9', productId: '400', name: 'Receipt printer', itemType: 'product', unitPrice: 200, quantity: 3 }] })
    for (const name of ['Overview', 'Details', 'Bundle', 'Usage', 'History', 'Signals & ICP', 'Custom Fields']) {
      await openTab(k, name)
      await k.tick(30)
      const text = k.bodyText()
      const hit = text.match(/\b(catalogues?|offers?|items?|product lines?)\b/i)
      assert.equal(hit, null, `${name}: "${hit?.[0]}" is on screen`)
    }
  })
})
