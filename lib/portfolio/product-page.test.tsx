import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import { routerHarness } from '../signals/router-harness'
import { portfolioProducts } from '../signals/opportunity-fixtures'
import { axeViolations } from '../agent/a11y'
import { activeProductTab, eventWord, PRODUCT_TAB_IDS, PRODUCT_TAB_LABELS, productTabIds, resolveProductTab } from './page-model'
import { everything, historyRow, listRow, meta } from './fixtures'
import { fill, installWorld, openTab, press, tabLabels, type World } from './screen-kit'

/** One Product's page in a fake browser: the Signals products it already read, the Sub-products from the unified list, the form in its drawer. */
async function openProduct(world: World = {}, productKey = 'scholarclone', customise?: (p: ReturnType<typeof portfolioProducts>) => void) {
  const k = await kit()
  const router = await routerHarness('', `/portfolio/${productKey}`)
  const calls = await installWorld(k, { listRows: [listRow(), listRow({ id: 12, name: 'Admissions', key: 'scholarclone/sch-12', state: 'not_sold', type: null, hasSell: false, readiness: 'Prototype', signalsFound: 0, icp: 'none' })], ...world })
  const { portfolioService } = await import('../../services/portfolio/portfolio-service')
  Object.assign(portfolioService, { getProducts: async () => { const answer = portfolioProducts(); customise?.(answer); return answer } })
  const { ProductDetailView } = await import('../../components/domain/portfolio/product-detail-view')
  await k.render(router.wrap(k.h(ProductDetailView, { context: { token: 'test-token', subInstituteId: '1', syear: '', userId: '2', organizationId: '', orgType: '', profileId: '1' } as never, productKey })))
  await k.tick(80)
  return { k, router, calls }
}

/** Opens the "More actions" menu of the page header and returns its items. */
async function openMoreMenu(k: Awaited<ReturnType<typeof kit>>) {
  const trigger = k.all('button').find((b) => b.getAttribute('aria-label') === 'More actions')
  assert.ok(trigger, 'the page has a More actions menu')
  await k.act(async () => { trigger.dispatchEvent(new k.w.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, ctrlKey: false })) })
  await k.tick(20)
  return k.all('[role="menuitem"]')
}

describe('a Product page', () => {
  afterEach(disposeAll)

  it('has four tabs: Overview, Sub-products, Signals & ICP and History', async () => {
    const { k } = await openProduct()
    assert.deepEqual(tabLabels(k).map((t) => t.replace(/\d+$/, '').trim()), ['Overview', 'Sub-products', 'Signals & ICP', 'History'])
    assert.equal(k.one('h1')!.textContent, 'ScholarClone')
  })

  it('opens a page for a Product that only the Portfolio has (the built-in Commercial Bundle): its Sub-products, no setup steps, no Signals tab, never "Product not found"', async () => {
    // Owner's screenshot, 23 Nov 2026: clicking Commercial Bundle in the list said "There is no product "bundle" in this organisation", because the page looked the Product up in Signals only.
    const data = everything()
    data.data.products.push({ ...data.data.products[0], id: 5, key: 'bundle', name: 'Commercial Bundle', signalKey: null, portfolioName: null, subProductCount: 2 })
    const bundle = await openProduct({ everything: data }, 'bundle')
    assert.ok(!bundle.k.bodyText().includes('Product not found'))
    assert.equal(bundle.k.one('h1')!.textContent?.includes('Commercial Bundle'), true, 'the page is the Product\'s own')
    assert.deepEqual(tabLabels(bundle.k).map((t) => t.replace(/\d+$/, '').trim()), ['Sub-products', 'History'], 'its page is its Sub-products and its history')
    assert.ok(bundle.calls.list.some((c) => c.productId === 5), 'the Sub-products are read with the Product\'s id')
    assert.ok(!bundle.k.bodyText().includes('Customer and buyer summary'), 'no setup steps or customer summary')
    assert.ok(!bundle.k.all('a').some((a) => (a.getAttribute('href') ?? '').startsWith('/signals?product=')), 'and no Signals link')
    await disposeAll()

    const nothing = await openProduct({}, 'no_such_product')
    assert.ok(nothing.k.bodyText().includes('Product not found'), 'a key that is neither in Signals nor in the Portfolio is still not found')
  })

  it('says one number for the Sub-products in the header and on the tab: the ACTIVE ones, with the archived ones named apart (the tab also lists them so they can be restored)', async () => {
    // Owner's screenshot: the header said "1 sub-product" while the tab said 6: the tab counted the archived ones too.
    const { k } = await openProduct({ listRows: [listRow(), listRow({ id: 12, name: 'Admissions' }), listRow({ id: 13, name: 'Old thing', status: 'archived' })], archivedCount: 2 })
    assert.ok(k.bodyText().includes('1 sub-product · 2 archived'), `the header says 1 active and 2 archived: ${k.bodyText().slice(0, 300)}`)
    assert.ok(tabLabels(k).some((t) => /^Sub-products\s*1$/.test(t)), `the tab counts the active Sub-products only: ${tabLabels(k).join(' | ')}`)
  })

  it('has a History tab that lists every change of the Product, read with the Product\'s own record id, and says what is kept when there is none', async () => {
    // Owner, 24 Nov 2026: "verify that the History tab works in the products and sub-products". A Product page had no History tab at all.
    const withLines = await openProduct({ history: [historyRow({ event: 'updated', type: 'product.master.updated', store: 'record', by: 'Asha Rao', changes: [{ field: 'name', old: 'Scholar', new: 'ScholarClone' }] }), historyRow({ event: 'updated', type: 'product.master.updated', store: 'record', by: 'Asha Rao', changes: [{ field: 'status', old: 'active', new: 'archived' }] })] })
    await openTab(withLines.k, 'History')
    await withLines.k.tick(40)
    assert.deepEqual(withLines.calls.history.map((c) => c.id), [1], 'history is read once, with the Product\'s master id')
    const text = withLines.k.bodyText()
    assert.ok(text.includes('Asha Rao'), 'who made the change')
    assert.ok(/name/i.test(text) && /ScholarClone/.test(text), 'what changed')
    assert.ok(/archived/.test(text), 'the archive is a line too')
    await disposeAll()

    const none = await openProduct({ history: [] })
    await openTab(none.k, 'History')
    await none.k.tick(40)
    assert.ok(none.k.bodyText().includes('No changes recorded yet'))
    assert.ok(none.k.bodyText().includes("Every change to this product's details"), 'and says what a Product\'s history holds (not Sell in CRM details)')
    // opening a tab writes ?tab= into the (shared) address of the fake window: put it back so the next test starts on the Overview
    none.k.w.history.replaceState(null, '', '/portfolio/scholarclone')
  })

  it('does not read the history before the History tab is opened', async () => {
    const { calls } = await openProduct()
    assert.deepEqual(calls.history, [], 'no request until the tab is opened')
  })

  it('keeps the four setup steps, the customer and buyer summary and a plain Review opportunities link', async () => {
    const { k } = await openProduct()
    const text = k.bodyText()
    for (const part of ['Sub-product ICPs', 'Target accounts', 'Generate signals', 'Customer and buyer summary']) assert.ok(text.includes(part), part)
    const steps = k.all('ol li p.text-sm').map((p) => p.textContent ?? '')
    assert.ok(steps.some((s) => s.startsWith('1. Sub-products')), 'the first step is Sub-products')
    const link = k.all('a').find((a) => (a.textContent ?? '').includes('Review opportunities'))
    assert.equal(link?.getAttribute('href'), '/signals?product=scholarclone')
  })

  it('lists its own Sub-products on the Sub-products tab, each linking to its page, read with the Product\'s id', async () => {
    const { k, calls } = await openProduct()
    await openTab(k, 'Sub-products')
    await k.tick(20)
    assert.equal(calls.list.some((c) => c.productId === 1), true, 'the list is asked for this Product only')
    const hrefs = k.all('a').map((a) => a.getAttribute('href'))
    assert.ok(hrefs.includes('/portfolio/products/11') && hrefs.includes('/portfolio/products/12'))
    assert.ok(k.bodyText().includes('Sold in CRM'), 'a Sell viewer sees the state column')
  })

  it('pages the Sub-products', async () => {
    const { k, calls } = await openProduct({ lastPage: 3 })
    await openTab(k, 'Sub-products')
    await k.tick(20)
    await press(k, 'Next')
    await k.tick(20)
    assert.ok(calls.list.some((c) => c.page === 2), 'the second page is asked for')
  })

  it('shows HR the Sub-products without the Sold in CRM column or a price', async () => {
    const { k } = await openProduct({ viewSell: false, meta: meta({}, { sellInCrm: { product: false, service: false } }) })
    await openTab(k, 'Sub-products')
    await k.tick(20)
    const heads = k.all('th').map((t) => t.textContent)
    assert.equal(heads.includes('Sold in CRM'), false)
    assert.equal(heads.includes('Price'), false)
    assert.ok(heads.includes('Readiness'))
  })

  it('opens the one form for a new Sub-product under this Product, with the next ID suggested', async () => {
    const { k } = await openProduct()
    await press(k, 'Add sub-product')
    await k.tick(80)
    const dialog = k.one('[role="dialog"]')!
    assert.ok(dialog.textContent!.includes('Add sub-product'))
    const product = Array.from(dialog.querySelectorAll('select')).find((s) => (s as HTMLSelectElement).value === '1')
    assert.ok(product, 'the Product is chosen')
    assert.ok(Array.from(dialog.querySelectorAll('input')).some((i) => (i as HTMLInputElement).value === 'SCH-14'), 'the next ID is suggested')
  })

  it('has no Add sub-product button for a caller who may not add one', async () => {
    const { k } = await openProduct({ meta: meta({}, { createSubProduct: false }) })
    assert.ok(k.withText('Add sub-product') === null, 'no Add sub-product button for a caller who may not add')
  })

  it('lets an administrator edit a Product this organisation created (name, category, status, description) through the Product API; a built-in Product, and a caller who may not create Products, get no Edit', async () => {
    // The old Portfolio's "Edit Product" dialog was lost when the old screens went (found by the removal track, 23 Nov 2026): the unified screens had no way to edit a Product.
    const asCustom = (answer: ReturnType<typeof portfolioProducts>) => {
      const first = answer.data.products[0] as unknown as Record<string, unknown>
      Object.assign(first, { key: 'payroll_cloud', label: 'Payroll Cloud', custom: true, description: 'Old text', category: 'HR tech', status: 'active' })
    }
    const saved: Array<{ key: string; body: Record<string, unknown> }> = []
    const { productIcpService } = await import('../../services/signals/product-icp')
    Object.assign(productIcpService, { updateProduct: async (_c: unknown, key: string, body: Record<string, unknown>) => { saved.push({ key, body }); return { status: 1, message: 'Product updated.', data: { product: { key, label: String(body.label) } } } } })

    const own = await openProduct({}, 'payroll_cloud', asCustom)
    const items = await openMoreMenu(own.k)
    const edit = items.find((i) => i.textContent?.trim() === 'Edit this product')
    assert.ok(edit, 'an administrator is offered Edit for a Product of the organisation')
    await own.k.click(edit)
    await own.k.tick(40)
    assert.ok(own.k.one('[role="dialog"]')!.textContent!.includes('Edit product: Payroll Cloud'))
    await fill(own.k, 'Product name', 'Payroll Cloud Plus')
    await fill(own.k, 'Category', 'People tech')
    await fill(own.k, 'Description', 'New text')
    await press(own.k, 'Save changes')
    await own.k.tick(60)
    assert.deepEqual(saved, [{ key: 'payroll_cloud', body: { label: 'Payroll Cloud Plus', description: 'New text', category: 'People tech', status: 'active' } }], 'the key is kept and the four details are sent')
    assert.ok(own.k.bodyText().includes('Product saved.'))
    await disposeAll()

    const builtIn = await openProduct()
    assert.ok(!(await openMoreMenu(builtIn.k)).some((i) => i.textContent?.trim() === 'Edit this product'), 'a built-in Product is shared and read only')
    await disposeAll()

    // a Product that is the organisation's own record but that Signals does not know as one it created (custom false): no Edit either
    const notCustom = await openProduct({}, 'payroll_cloud', (answer) => { asCustom(answer); Object.assign(answer.data.products[0] as unknown as Record<string, unknown>, { custom: false }) })
    assert.ok(!(await openMoreMenu(notCustom.k)).some((i) => i.textContent?.trim() === 'Edit this product'), 'only a Product the organisation created is edited here')
    await disposeAll()

    const noRight = await openProduct({ meta: meta({}, { createProduct: false }) }, 'payroll_cloud', asCustom)
    assert.ok(!(await openMoreMenu(noRight.k)).some((i) => i.textContent?.trim() === 'Edit this product'), 'only an administrator edits a Product')
  })

  it('marks a built-in Product as Shared, read only, and offers no archive for it', async () => {
    const { k } = await openProduct()
    assert.ok(k.bodyText().includes('Shared, read only'))
  })

  it('lists the ideal customer state of each Sub-product on the Signals & ICP tab, each linking to that Sub-product\'s tab', async () => {
    const { k } = await openProduct()
    await openTab(k, 'Signals & ICP')
    await k.tick(20)
    const hrefs = k.all('a').map((a) => a.getAttribute('href'))
    assert.ok(hrefs.includes('/portfolio/products/11?tab=signals'))
    assert.ok(k.bodyText().includes('In use'))
  })

  it('has no axe violation on any tab, and never says Catalogue, Offer, Item or Product line', async () => {
    const { k } = await openProduct()
    for (const name of ['Overview', 'Sub-products', 'Signals & ICP']) {
      await openTab(k, name)
      await k.tick(20)
      const panel = k.one('[role="tabpanel"]:not([hidden])')!.parentElement as HTMLElement
      assert.deepEqual(await axeViolations(panel), [], `${name} has no axe violation`)
      const hit = panel.textContent!.match(/\b(catalogues?|offers?|items?|product lines?)\b/i)
      assert.equal(hit, null, `${name}: "${hit?.[0]}" is on screen`)
    }
  })
})

describe('the Product page tabs of the addresses that already exist', () => {
  it('opens the Sub-products for the older ?tab=offers and ?tab=icp links, the new name too, and the Overview for anything else', () => {
    assert.equal(resolveProductTab('offers'), 'sub-products')
    assert.equal(resolveProductTab('icp'), 'sub-products')
    assert.equal(resolveProductTab('sub-products'), 'sub-products')
    assert.equal(resolveProductTab('signals'), 'signals')
    assert.equal(resolveProductTab('history'), 'history', 'the History tab has an address of its own')
    assert.equal(resolveProductTab('kit'), 'kit', 'and so does the Sales Kit (27 Nov 2026)')
    assert.equal(resolveProductTab('nonsense'), 'overview')
    assert.equal(resolveProductTab(null), 'overview')
  })

  it('draws the Sales Kit as the fifth tab, before History, only for a caller who may view it, and only on a Product that has the full tab list', () => {
    assert.deepEqual([...PRODUCT_TAB_IDS], ['overview', 'sub-products', 'signals', 'kit', 'history'])
    assert.equal(PRODUCT_TAB_LABELS.kit, 'Sales Kit')
    assert.deepEqual(productTabIds({ full: true, kit: true }), ['overview', 'sub-products', 'signals', 'kit', 'history'])
    assert.deepEqual(productTabIds({ full: true, kit: false }), ['overview', 'sub-products', 'signals', 'history'], 'the four tabs of before')
    assert.deepEqual(productTabIds({ full: false, kit: true }), ['sub-products', 'history'], 'a Portfolio-only Product has no Sales Kit')
    assert.deepEqual(productTabIds({ full: false, kit: false }), ['sub-products', 'history'])
  })

  it('shows the tab asked for when the page has it, else the Overview (the Sub-products on a page with no Overview)', () => {
    const four = productTabIds({ full: true, kit: false })
    assert.equal(activeProductTab('kit', four), 'overview', 'a pasted ?tab=kit without the right lands on the Overview')
    assert.equal(activeProductTab('kit', productTabIds({ full: true, kit: true })), 'kit')
    assert.equal(activeProductTab('history', four), 'history')
    const short = productTabIds({ full: false, kit: true })
    assert.equal(activeProductTab('overview', short), 'sub-products')
    assert.equal(activeProductTab('kit', short), 'sub-products')
    assert.equal(activeProductTab('history', short), 'history')
  })

  it('words a move of a Sub-product to another Product as such, and keeps the other lines as they were', () => {
    assert.equal(eventWord(historyRow({ event: 'moved', type: 'product.moved', store: 'record' })), 'Moved to another Product')
    assert.equal(eventWord(historyRow({ event: 'created' })), 'Created')
    assert.equal(eventWord(historyRow({ event: 'deleted' })), 'Moved to the Recycle Bin')
    assert.equal(eventWord(historyRow({ event: 'updated' })), 'Changed')
  })
})
