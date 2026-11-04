import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { screenKit, type Call } from './screen-kit'
import { can, line, list, meta, options, soldSubProductRecord, sub, usage } from './lines-fixtures'
import type { CrmProduct, CrmProductLines } from '../../types/crm'

/** The Products screen as a person meets it: the real components, the real sidebar hook and service client, only the network replaced. */

function item(over: Partial<CrmProduct> = {}): CrmProduct {
  return {
    id: '301', itemType: 'product', productNo: 'PRD-AAAA1111', name: 'Fee Collection', sku: 'SKU-1', category: null, glAccount: null, description: null, unitPrice: 1500, costPrice: null,
    commissionRate: null, currency: 'INR', taxRateId: null, taxRateName: null, isActive: true, vendor: null, qtyInStock: 10, qtyInDemand: null, reorderLevel: null, weight: null,
    usageUnit: null, imageUrl: null, assignedTo: '2', createdBy: '2', createdAt: null, updatedAt: null, ...over,
  }
}

const tied = item({ masterId: 11, masterKind: 'sub_product', masterStatus: 'active', productLine: { id: 1, name: 'ScholarClone' }, offerId: 'SCH-11', signalsFound: 4, icp: 'active' })
const plain = item({ id: '302', name: 'Setup day', sku: null, masterId: 12, masterKind: 'item', masterStatus: 'active', productLine: null, offerId: null, signalsFound: null, icp: null })
const lines = (over: Partial<CrmProductLines> = {}): CrmProductLines => ({ available: true, linked: 1, productLines: 5, subProducts: 25, ...over })

interface Server {
  items?: CrmProduct[]
  lines?: CrmProductLines | null
  masterList?: () => unknown
}

function server(opts: Server = {}) {
  const items = opts.items ?? [tied, plain]
  return (call: Call): unknown => {
    if (call.path.endsWith('/crm/products')) {
      const body: Record<string, unknown> = { items, pagination: { current_page: 1, last_page: 1, per_page: 20, total: items.length } }
      if (opts.lines !== null) body.lines = opts.lines ?? lines()
      return { status: 1, message: 'Products.', data: body }
    }
    if (call.path.endsWith('/product-master') && call.method === 'GET') return { status: 1, data: opts.masterList ? opts.masterList() : list() }
    if (call.path.endsWith('/product-master/meta')) return { status: 1, data: meta() }
    if (call.path.endsWith('/product-master/options')) return { status: 1, data: options() }
    if (call.path.endsWith('/product-master/11/usage')) return { status: 1, data: usage() }
    if (call.path.endsWith('/product-master/11')) return { status: 1, data: soldSubProductRecord() }
    return undefined
  }
}

async function open(opts: Server & { search?: string } = {}) {
  const screen = await screenKit({ search: opts.search ?? '', respond: server(opts) })
  const { ProductListView } = await import('../../components/domain/crm/product-list-view')
  await screen.mount(screen.k.h(ProductListView))
  const heads = () => screen.k.all('thead th').map((th) => th.textContent)
  const switchButtons = () => screen.k.all('[role="group"][aria-label="What to list"] button')
  const rowOf = (name: string) => screen.k.all('tbody tr').find((tr) => tr.textContent?.includes(name)) ?? null
  return { ...screen, heads, switchButtons, rowOf }
}

describe('the Products screen: the catalogue, as it has always been', () => {
  afterEach(async () => { await disposeAll() })

  it('looks exactly as before on a server that has no product lines: no switch, no extra columns', async () => {
    const s = await open({ lines: null })
    assert.equal(s.switchButtons().length, 0)
    assert.deepEqual(s.heads().slice(1), ['Name', 'Category', 'Unit Price', 'Qty In Stock', 'Active'])
    assert.ok(s.k.bodyText().includes('Fee Collection'))
    s.restore()
  })

  it('shows the switch, but no extra columns, when the product lines exist and no item is tied to one', async () => {
    const s = await open({ lines: lines({ linked: 0 }), items: [plain] })
    assert.deepEqual(s.switchButtons().map((b) => b.textContent), ['Catalogue', 'Product lines5'])
    assert.deepEqual(s.switchButtons().map((b) => b.getAttribute('aria-pressed')), ['true', 'false'])
    assert.deepEqual(s.heads().slice(1), ['Name', 'Category', 'Unit Price', 'Qty In Stock', 'Active'])
    assert.equal(s.rowOf('Setup day')!.querySelectorAll('td').length, 6, 'no stray cells either: tick box, name, category, price, stock, active')
    s.restore()
  })

  it('shows the Product line, Signals and ICP columns when an item is tied to a sub-product', async () => {
    const s = await open()
    assert.deepEqual(s.heads().slice(1), ['Name', 'Category', 'Unit Price', 'Qty In Stock', 'Active', 'Product line', 'Signals', 'ICP'])
    const cells = (name: string) => Array.from(s.rowOf(name)!.querySelectorAll('td')).map((td) => td.textContent)
    assert.deepEqual(cells('Fee Collection').slice(-3), ['ScholarClone', '4', 'Active'])
    assert.deepEqual(cells('Setup day').slice(-3), ['—', '—', '—'], 'an item tied to nothing has dashes')
    assert.equal(s.rowOf('Fee Collection')!.querySelector('a')!.getAttribute('href'), '/module/crm/sales/products/lines/1', 'the product line opens its own page')
    s.restore()
  })

  it('still opens an item\'s page when its row is clicked', async () => {
    const s = await open()
    await s.k.click(s.rowOf('Fee Collection')!)
    assert.equal(s.router.written[s.router.written.length - 1], '/module/crm/sales/products/301')
    s.restore()
  })

  it('says, when the catalogue is empty, that the product lines are in the other view', async () => {
    const s = await open({ items: [], lines: lines({ linked: 0 }) })
    assert.ok(s.k.bodyText().includes('No products yet.'))
    assert.ok(s.k.bodyText().includes('Your product lines are in the other view: 5 product lines with 25 sub-products.'))
    s.restore()
  })

  it('makes the empty row span the whole table, with or without the extra columns', async () => {
    const plainTable = await open({ items: [], lines: lines({ linked: 0 }) })
    const span = (s: typeof plainTable) => Number(s.k.all('tbody td[colspan]')[0].getAttribute('colspan'))
    assert.equal(span(plainTable), plainTable.heads().length, 'six columns: tick box, name, category, price, stock, active')
    plainTable.restore()
    await disposeAll()

    const wide = await open({ items: [], lines: lines({ linked: 2 }) })
    assert.equal(span(wide), wide.heads().length, 'nine columns once the product line, signals and ICP are drawn')
    assert.equal(wide.heads().length, 9)
    wide.restore()
  })

  it('says nothing about the other view when the catalogue is empty and there are no product lines', async () => {
    const s = await open({ items: [], lines: lines({ linked: 0, productLines: 0, subProducts: 0 }) })
    assert.ok(s.k.bodyText().includes('No products yet.'))
    assert.ok(!s.k.bodyText().includes('other view'))
    s.restore()
  })
})

describe('the Products screen: moving between the catalogue and the product lines', () => {
  afterEach(async () => { await disposeAll() })

  it('opens the product lines, and writes that to the address, when their button is pressed', async () => {
    const s = await open()
    await s.k.click(s.switchButtons()[1])
    await s.k.tick(40)

    assert.equal(s.router.lastSearch(), 'scope=lines')
    assert.deepEqual(s.switchButtons().map((b) => b.getAttribute('aria-pressed')), ['false', 'true'])
    assert.ok(s.k.bodyText().includes('4 sub-products in 3 product lines.'))
    assert.ok(s.rowOf('ScholarClone'))
    assert.ok(s.rowOf('Fee Collection'))
    assert.equal(s.to('/product-master').filter((c) => c.method === 'GET').length >= 1, true)
    s.restore()
  })

  it('goes back to the catalogue, and clears the address, when the Catalogue button is pressed', async () => {
    const s = await open({ search: 'scope=lines&q=pay&status=archived' })
    await s.k.click(s.switchButtons()[0])
    await s.k.tick(40)

    assert.equal(s.router.lastSearch(), '', 'the other scope\'s search and status do not follow')
    assert.deepEqual(s.switchButtons().map((b) => b.getAttribute('aria-pressed')), ['true', 'false'])
    assert.deepEqual(s.heads().slice(1, 3), ['Name', 'Category'], 'the catalogue table is back')
    s.restore()
  })

  it('opens straight on the product lines from a link, with the way back in place', async () => {
    const s = await open({ search: 'scope=lines' })
    assert.deepEqual(s.switchButtons().map((b) => b.getAttribute('aria-pressed')), ['false', 'true'])
    assert.ok(s.rowOf('ScholarClone'))
    assert.equal(s.to('/crm/products').length, 0, 'the catalogue is not asked for while the product lines are open')
    s.restore()
  })

  it('opens each sub-product where it belongs: a sold one in its catalogue, an unsold one on its own page', async () => {
    const s = await open({ search: 'scope=lines' })
    const href = (name: string) => s.k.all('a').find((a) => a.textContent === name)?.getAttribute('href')
    assert.equal(href('Fee Collection'), '/module/crm/sales/products/lines/11')
    assert.equal(href('Admissions'), '/module/crm/sales/products/301')
    assert.equal(href('Timetable'), '/module/crm/sales/services/302')
    assert.equal(href('ScholarClone'), '/module/crm/sales/products/lines/1')
    s.restore()
  })

  it('treats an unknown scope in the address as the catalogue', async () => {
    const s = await open({ search: 'scope=junk' })
    assert.deepEqual(s.heads().slice(1, 3), ['Name', 'Category'])
    s.restore()
  })

  it('says the product lines are not set up when the server has none, and still offers the way back', async () => {
    const s = await open({ search: 'scope=lines', masterList: () => list({ available: false, products: [], totals: { products: 0, subProducts: 0, items: 0 } }) })
    assert.ok(s.k.bodyText().includes('Product lines are not set up here yet'))
    assert.equal(s.switchButtons().length, 2)
    s.restore()
  })
})

describe('the catalogue list on its own', () => {
  afterEach(async () => { await disposeAll() })

  const mountCatalogue = async (itemType: 'product' | 'service', withSwitch: boolean) => {
    const screen = await screenKit({ respond: server({ items: [], lines: lines({ linked: 0 }) }) })
    const { ProductCatalogListView } = await import('../../components/domain/crm/product-catalog-list-view')
    await screen.mount(screen.k.h(ProductCatalogListView, { itemType, routeSegment: itemType === 'service' ? 'services' : 'products', scopeSwitch: withSwitch ? screen.k.h('div', { id: 'switch' }, 'SWITCH') : undefined }))
    return screen
  }

  it('points at the other view only where that view\'s switch is drawn', async () => {
    const withSwitch = await mountCatalogue('product', true)
    assert.ok(withSwitch.k.bodyText().includes('Your product lines are in the other view'))
    assert.ok(withSwitch.k.one('#switch'), 'the switch it was given is drawn under the title')
    withSwitch.restore()
    await disposeAll()

    const without = await mountCatalogue('product', false)
    assert.ok(without.k.bodyText().includes('No products yet.'))
    assert.ok(!without.k.bodyText().includes('other view'), 'no switch, so no pointer to the other view')
    without.restore()
  })

  it('never points a service list at the product lines, even if it were given a switch', async () => {
    const screen = await mountCatalogue('service', true)
    assert.ok(screen.k.bodyText().includes('No services yet.'))
    assert.ok(!screen.k.bodyText().includes('other view'))
    screen.restore()
  })
})

describe('the Services screen', () => {
  afterEach(async () => { await disposeAll() })

  it('never shows the scope switch or the other view\'s hint, even where the product lines exist', async () => {
    const screen = await screenKit({ respond: server({ items: [], lines: lines({ linked: 0 }) }) })
    const { ServiceListView } = await import('../../components/domain/crm/service-list-view')
    await screen.mount(screen.k.h(ServiceListView))
    assert.equal(screen.k.all('[role="group"][aria-label="What to list"]').length, 0)
    assert.ok(screen.k.bodyText().includes('No services yet.'))
    assert.ok(!screen.k.bodyText().includes('other view'))
    screen.restore()
  })

  it('shows the three extra columns for a service tied to a sub-product, like the Products screen', async () => {
    const service = item({ id: '310', itemType: 'service', name: 'Onboarding', masterId: 13, masterKind: 'sub_product', productLine: { id: 1, name: 'ScholarClone' }, signalsFound: 0, icp: 'none', qtyInStock: null })
    const screen = await screenKit({ respond: server({ items: [service], lines: lines({ linked: 1 }) }) })
    const { ServiceListView } = await import('../../components/domain/crm/service-list-view')
    await screen.mount(screen.k.h(ServiceListView))
    assert.deepEqual(screen.k.all('thead th').map((th) => th.textContent).slice(1), ['Name', 'Category', 'Unit Price', 'Active', 'Product line', 'Signals', 'ICP'])
    assert.deepEqual(Array.from(screen.k.all('tbody tr')[0].querySelectorAll('td')).map((td) => td.textContent).slice(-3), ['ScholarClone', '0', 'Not set up'])
    screen.restore()
  })
})

// A line, a sub-product and what the lines fixture needs are imported so the fixtures stay in use by the screen tests above.
void [can, line, sub]
