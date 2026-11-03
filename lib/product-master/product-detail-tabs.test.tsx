import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { screenKit, type Call } from './screen-kit'
import { meta, options, priceBook, soldSubProductRecord, usage } from './lines-fixtures'
import type { CrmProduct } from '../../types/crm'

/** A catalogue item's own page, as a person meets it: the real component with the real sidebar hook and service client, only the network replaced. */

function item(over: Partial<CrmProduct> = {}): CrmProduct {
  return {
    id: '301', itemType: 'product', productNo: 'PRD-AAAA1111', name: 'Fee Collection', sku: 'SKU-1', category: null, glAccount: null, description: null, unitPrice: 1500, costPrice: null,
    commissionRate: null, currency: 'INR', taxRateId: null, taxRateName: null, isActive: true, vendor: null, qtyInStock: 10, qtyInDemand: null, reorderLevel: null, weight: null,
    usageUnit: null, imageUrl: null, assignedTo: '2', createdBy: '2', createdAt: null, updatedAt: null, ...over,
  }
}

const respond = (extra: Partial<{ record: unknown; usage: unknown; can: Parameters<typeof meta>[1] }> = {}) => (call: Call): unknown => {
  // A save of the sub-product's details: the server answers with the record as it is afterwards.
  if (call.method === 'PUT' && /\/product-master\/\d+$/.test(call.path)) return { status: 1, data: { ...soldSubProductRecord(), name: (call.body as { name?: string }).name ?? 'Fee Collection' } }
  if (call.path.endsWith('/product-master/meta')) return { status: 1, data: meta({}, extra.can ?? {}) }
  if (call.path.endsWith('/product-master/options')) return { status: 1, data: options() }
  if (call.path.endsWith('/usage')) return { status: 1, data: extra.usage ?? usage({ quotes: 2, priceBooks: [priceBook()] }) }
  if (/\/product-master\/\d+$/.test(call.path)) return { status: 1, data: extra.record ?? soldSubProductRecord() }
  return undefined
}

async function open(product: CrmProduct, extra: Parameters<typeof respond>[0] = {}) {
  const screen = await screenKit({ pathname: '/module/crm/sales/products/301', respond: respond(extra) })
  const { ProductDetailPage } = await import('../../components/domain/crm/product-detail-page')
  const saved = { count: 0 }
  await screen.mount(screen.k.h(ProductDetailPage, { product, onSaved: () => { saved.count += 1 }, onBack: () => undefined, categories: [], taxRates: [] }))
  const tabs = () => screen.k.all('div.border-b > button').map((b) => b.textContent)
  const openTab = async (label: string) => { await screen.k.click(screen.k.all('div.border-b > button').find((b) => b.textContent === label)!); await screen.k.tick(40) }
  const masterCalls = () => screen.calls.filter((c) => c.path.includes('/product-master'))
  return { ...screen, tabs, openTab, masterCalls, saved }
}

describe('the tabs of a catalogue item\'s page', () => {
  afterEach(async () => { await disposeAll() })

  it('are exactly the old ones for an item with no record behind it, and the product lines are never asked for', async () => {
    const s = await open(item())
    assert.deepEqual(s.tabs(), ['Details', 'Bundle', 'History'])
    assert.equal(s.masterCalls().length, 0)
    s.restore()
  })

  it('are exactly the old ones for an item from an older server that sends none of the new fields', async () => {
    const product = item()
    for (const key of ['masterId', 'masterKind', 'masterStatus', 'productLine', 'offerId', 'signalsFound', 'icp'] as const) delete (product as unknown as Record<string, unknown>)[key]
    const s = await open(product)
    assert.deepEqual(s.tabs(), ['Details', 'Bundle', 'History'])
    s.restore()
  })

  it('gain Signals & ICP and Usage for an item tied to a sub-product, and ask for nothing until one is opened', async () => {
    const s = await open(item({ masterId: 11, masterKind: 'sub_product' }))
    assert.deepEqual(s.tabs(), ['Details', 'Bundle', 'Signals & ICP', 'Usage', 'History'])
    assert.equal(s.masterCalls().length, 0, 'opening the page costs no extra call')
    s.restore()
  })

  it('gain Usage alone for a catalogue-only item', async () => {
    const s = await open(item({ masterId: 12, masterKind: 'item' }))
    assert.deepEqual(s.tabs(), ['Details', 'Bundle', 'Usage', 'History'])
    s.restore()
  })

  it('leave a service without a Bundle tab, and still gain the extra ones', async () => {
    const s = await open(item({ itemType: 'service', masterId: 11, masterKind: 'sub_product' }))
    assert.deepEqual(s.tabs(), ['Details', 'Signals & ICP', 'Usage', 'History'])
    s.restore()
  })

  it('show what Signals found, the ICP and the sub-product when Signals & ICP is opened', async () => {
    const s = await open(item({ masterId: 11, masterKind: 'sub_product' }))
    await s.openTab('Signals & ICP')
    const text = s.k.bodyText()
    for (const part of ['Product line and sub-product', 'ScholarClone', 'SCH-11', 'Signals found', 'See these signals', 'An ideal-customer profile is saved and in use.', 'Collects school fees online.']) {
      assert.ok(text.includes(part), part)
    }
    assert.deepEqual(s.masterCalls().map((c) => `${c.method} ${c.path.replace(/^.*\/product-master/, '')}`).sort(), ['GET /11', 'GET /11/usage', 'GET /meta', 'GET /options'])
    assert.ok(!text.includes('Details of'), 'the Details tab is replaced, not stacked')
    s.restore()
  })

  it('show the signals, quotes and price books when Usage is opened, asking only for the usage', async () => {
    const s = await open(item({ masterId: 11, masterKind: 'sub_product' }))
    await s.openTab('Usage')
    for (const part of ['Where it is used', 'Standard 2026', 'INR 1200.00', 'Open Price Books']) assert.ok(s.k.bodyText().includes(part), part)
    assert.deepEqual(s.masterCalls().map((c) => c.path.replace(/^.*\/product-master/, '')), ['/11/usage'])
    assert.equal(s.k.all('a').find((a) => a.textContent === 'Open Price Books')!.getAttribute('href'), '/module/crm/sales/price-books')
    s.restore()
  })

  it('link the sub-product\'s product line to its own page under Products', async () => {
    const s = await open(item({ masterId: 11, masterKind: 'sub_product' }))
    await s.openTab('Signals & ICP')
    assert.equal(s.k.all('a').find((a) => a.textContent === 'ScholarClone')!.getAttribute('href'), '/module/crm/sales/products/lines/1')
    s.restore()
  })

  it('go back to Details without asking again, and ask again when the tab is reopened', async () => {
    const s = await open(item({ masterId: 11, masterKind: 'sub_product' }))
    await s.openTab('Usage')
    await s.openTab('Details')
    assert.ok(s.k.bodyText().includes('Product Details'))
    assert.ok(!s.k.bodyText().includes('Where it is used'))
    const before = s.masterCalls().length
    await s.openTab('Usage')
    assert.equal(s.masterCalls().length, before + 1)
    s.restore()
  })

  it('offer "Edit sub-product details" on Signals & ICP, and the form leaves out Sell in CRM', async () => {
    const s = await open(item({ masterId: 11, masterKind: 'sub_product' }))
    await s.openTab('Signals & ICP')
    const edit = s.k.all('button').find((b) => b.textContent?.includes('Edit sub-product details'))
    assert.ok(edit)
    await s.k.click(edit!)
    await s.k.tick(40)
    assert.ok(s.k.bodyText().includes('Edit Fee Collection'))
    assert.ok(!s.k.bodyText().includes('Sell this in the CRM'))
    s.restore()
  })

  it('follow a rename made from Signals & ICP in the page\'s heading, without reading the item again', async () => {
    const s = await open(item({ masterId: 11, masterKind: 'sub_product' }))
    assert.equal(s.k.one('h1')!.textContent, 'Fee Collection')
    await s.openTab('Signals & ICP')
    await s.k.click(s.k.all('button').find((b) => b.textContent?.includes('Edit sub-product details'))!)
    await s.k.tick(40)

    const name = s.k.all('input').find((el) => s.k.w.document.querySelector(`label[for="${el.id}"]`)?.textContent?.startsWith('Name')) as HTMLInputElement
    const set = Object.getOwnPropertyDescriptor(s.k.w.HTMLInputElement.prototype, 'value')!.set!
    await s.k.act(async () => { set.call(name, 'Fee Collection Plus'); name.dispatchEvent(new s.k.w.Event('input', { bubbles: true })) })
    await s.k.click(s.k.withText('Save changes')!)
    await s.k.tick(60)

    assert.equal(s.k.one('h1')!.textContent, 'Fee Collection Plus')
    assert.equal(s.saved.count, 0, 'the page was not asked to read the item again (that would send the person back to Details)')
    assert.deepEqual(s.calls.filter((c) => c.method === 'PUT').map((c) => c.body), [{ name: 'Fee Collection Plus' }])
    s.restore()
  })

  it('offer no editing of the sub-product to someone who may not edit one', async () => {
    const s = await open(item({ masterId: 11, masterKind: 'sub_product' }), { can: { editSubProduct: false } })
    await s.openTab('Signals & ICP')
    assert.ok(!s.k.all('button').some((b) => b.textContent?.includes('Edit sub-product details')))
    s.restore()
  })

  it('keep the item\'s own Edit button, which opens the CRM dialog as before', async () => {
    const s = await open(item({ masterId: 11, masterKind: 'sub_product' }))
    await s.k.click(s.k.all('button').find((b) => b.textContent === 'Edit')!)
    await s.k.tick(40)
    assert.ok(s.k.bodyText().includes('Edit Product'))
    assert.ok(s.k.bodyText().includes('Product Name'))
    s.restore()
  })
})
