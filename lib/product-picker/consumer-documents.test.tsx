import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { screenKit, type Call } from '../leads/screen-kit'
import { catalogueResponder, type ApiOptions, type Kit } from './harness'
import { forgetResolved } from './resolver'

/**
 * Every document that holds lines of Sub-products, as a person meets it (slice 15, P3-C): the REAL page, the REAL line table, the REAL picker and the REAL
 * services, only the network replaced. Choosing a Sub-product must fill the same fields the old product list did (the description, the base price, the default
 * tax rate), and the SAVED body must carry the CATALOGUE id as text under `productId`, exactly as before (never the master id), because the line tables of the
 * three documents point at `crm_products.id`. A Sub-product the picker no longer offers (paused) must still be shown by name on an old document, and saving that
 * document without touching it must send the same id back.
 */
interface Spec {
  name: string
  module: string
  exportName: string
  prop: string
  stageProp: string
  endpoint: string
  doc: Record<string, unknown>
}

const common = {
  id: '7', currency: 'INR', subtotal: 0, discountAmount: 0, discountPercent: null, taxTotal: 0, total: 0, shippingHandlingAmount: 0, adjustment: 0, organizationId: null, organizationName: null,
  contactId: null, contactName: null, opportunityId: null, opportunityName: null, billingStreet: null, billingCity: null, billingState: null, billingCode: null, billingCountry: null,
  shippingStreet: null, shippingCity: null, shippingState: null, shippingCode: null, shippingCountry: null, termsConditions: null, description: null, assignedTo: '2',
  amountPaid: 0, balanceDue: 0, quoteStage: 'Draft', soStage: 'Created', invoiceStage: 'Draft', validTill: null, dueDate: null,
}
const SPECS: Spec[] = [
  { name: 'a quote', module: 'quote-detail-page', exportName: 'QuoteDetailPage', prop: 'quote', stageProp: 'quoteStages', endpoint: '/crm/quotes/7/line-items', doc: { ...common, subject: 'Hillcrest quote', quoteNo: 'Q-0007' } },
  { name: 'a sales order', module: 'sales-order-detail-page', exportName: 'SalesOrderDetailPage', prop: 'salesOrder', stageProp: 'soStages', endpoint: '/crm/sales-orders/7/line-items', doc: { ...common, subject: 'Hillcrest order', soNo: 'SO-0007' } },
  { name: 'an invoice', module: 'invoice-detail-page', exportName: 'InvoiceDetailPage', prop: 'invoice', stageProp: 'invoiceStages', endpoint: '/crm/invoices/7/line-items', doc: { ...common, subject: 'Hillcrest invoice', invoiceNo: 'INV-0007' } },
]

const TAX_RATES = [{ id: '4', name: 'GST 18', percentage: 18, isDefault: false, isActive: true }, { id: '5', name: 'GST 5', percentage: 5, isDefault: false, isActive: true }]
const savedLine = (productId: string | null, description: string, unitPrice: number, taxRateId: string | null) => ({ id: '1', productId, description, quantity: 2, unitPrice, discountPercent: null, discountAmount: null, taxRateId, taxNameSnapshot: null, taxPercentSnapshot: null, lineTotal: 0, sequenceNo: 0 })

async function open(spec: Spec, held: ReturnType<typeof savedLine>[] = [], api: ApiOptions = {}) {
  forgetResolved()
  const catalogue = catalogueResponder(api)
  const saves: Array<{ path: string; body: { lineItems: Array<Record<string, unknown>> } }> = []
  const screen = await screenKit({
    pathname: `/module/crm/sales/${spec.module}/7`,
    respond: async (call: Call) => {
      const answered = await catalogue(call)
      if (answered !== undefined) return answered
      if (call.path.endsWith('/crm/tax-rates')) return { status: 1, message: '', data: TAX_RATES }
      if (call.path.endsWith(spec.endpoint) && call.method === 'GET') return { status: 1, message: '', data: held }
      if (call.path.endsWith(spec.endpoint) && call.method === 'PUT') { saves.push({ path: call.path, body: call.body as never }); return { status: 1, message: 'Line items saved.', data: spec.doc } }
      return undefined
    },
  })
  const page = await import(`../../components/domain/crm/${spec.module}`)
  await screen.mount(screen.k.h(page[spec.exportName], { [spec.prop]: spec.doc, onSaved: () => undefined, onBack: () => undefined, [spec.stageProp]: [] }), 60)
  await screen.k.click(screen.k.withText('Line Items')!)
  await screen.k.tick(60)
  return { ...screen, saves }
}

const rowInputs = (k: Kit, row = 0) => Array.from(k.all('tbody tr')[row].querySelectorAll('input')).filter((i) => i.getAttribute('role') !== 'combobox') as HTMLInputElement[]
const triggers = (k: Kit) => k.all('[data-picker-trigger]')
async function pickRow(k: Kit, crmProductId: number, index = 0) {
  await k.click(triggers(k)[index])
  await k.tick(40)
  await k.click(k.one(`[data-picker-option="${crmProductId}"]`)!)
  await k.tick(20)
}
async function save(s: Awaited<ReturnType<typeof open>>) {
  await s.k.click(s.k.withText('Save Line Items')!)
  await s.k.tick(40)
  return s.saves[s.saves.length - 1]
}

for (const spec of SPECS) {
  describe(`${spec.name}: the Sub-product on a line`, () => {
    afterEach(async () => { await disposeAll() })

    it('fills the description, the base price and keeps the default tax rate for the save, and saves the CATALOGUE id as text', async () => {
      const s = await open(spec)
      await s.k.click(s.k.withText('Add Line')!)
      await pickRow(s.k, 10)
      const [description, , price] = rowInputs(s.k)
      assert.equal(description.value, 'Scholar Nine', 'the description is the Sub-product\'s name')
      assert.equal(price.value, '999', 'the unit price is the Sub-product\'s base price')
      const sent = await save(s)
      assert.ok(sent, 'the document was saved')
      const line = sent.body.lineItems[0]
      assert.strictEqual(line.productId, '10', 'the catalogue id, as the text the documents have always stored')
      assert.notStrictEqual(line.productId, '23', 'never the master id')
      assert.equal(line.description, 'Scholar Nine')
      assert.equal(line.unitPrice, 999)
      assert.strictEqual(line.taxRateId, '4', 'the default tax rate, as a string id like before')
      s.restore()
    })

    it('does the same for a service, and for a Sub-product with no tax rate (null, not the word null)', async () => {
      const s = await open(spec)
      await s.k.click(s.k.withText('Add Line')!)
      await s.k.click(s.k.withText('Add Line')!)
      await pickRow(s.k, 12, 0)
      await pickRow(s.k, 11, 1)
      const sent = await save(s)
      assert.deepEqual(sent.body.lineItems.map((l) => [l.productId, l.unitPrice, l.taxRateId]), [['12', 5000, '5'], ['11', 25000, null]])
      s.restore()
    })

    it('shows a saved line\'s Sub-product by name when the list no longer offers it, and saves the same id back untouched', async () => {
      const s = await open(spec, [savedLine('15', 'Old Gujarat Edition', 800, null)])
      assert.equal(triggers(s.k)[0].querySelector('[data-picker-value]')!.textContent, 'Old Gujarat Edition', 'a paused Sub-product is shown by name, not blank')
      assert.equal(s.k.one('[data-picker-state]')!.textContent, 'Paused')
      const sent = await save(s)
      assert.strictEqual(sent.body.lineItems[0].productId, '15', 'the id is sent back as it was')
      assert.equal(sent.body.lineItems[0].unitPrice, 800)
      s.restore()
    })

    it('never asks the old product list for the Sub-products: one picker request per opening, no /crm/products', async () => {
      const s = await open(spec)
      await s.k.click(s.k.withText('Add Line')!)
      await pickRow(s.k, 10)
      assert.equal(s.calls.filter((c) => c.path.endsWith('/crm/products')).length, 0, 'the old endpoint is not called')
      assert.equal(s.to('/product-master/picker').length, 1, 'one search for both kinds, not a product call and a service call')
      assert.equal(s.to('/product-master/picker')[0].query.has('type'), false, 'no type: every kind the person may view')
      s.restore()
    })

    it('words the column Sub-product, not Product / Service', async () => {
      const s = await open(spec)
      assert.ok(s.k.all('th').some((th) => th.textContent === 'Sub-product'), 'the column heading')
      assert.equal(s.k.all('th').some((th) => /Product \/ Service/.test(th.textContent ?? '')), false)
      s.restore()
    })
  })
}

describe('a quote: a line takes the Sub-product\'s own price and tax rate (S16: Price Books were removed)', () => {
  afterEach(async () => { await disposeAll() })

  it('prices a newly picked Sub-product from its own price even when an old answer still carries a price book id, and never asks for a price book', async () => {
    forgetResolved()
    const catalogue = catalogueResponder({})
    const saves: Array<{ lineItems: Array<Record<string, unknown>> }> = []
    const screen = await screenKit({
      pathname: '/module/crm/sales/quote-detail-page/7',
      respond: async (call: Call) => {
        const answered = await catalogue(call)
        if (answered !== undefined) return answered
        if (call.path.endsWith('/crm/tax-rates')) return { status: 1, message: '', data: TAX_RATES }
        // A server that has not been updated yet still answers a price book's items: the page must not even ask.
        if (call.path.includes('/crm/price-books/')) return { status: 1, message: '', data: [{ id: '1', productId: '10', listPrice: 750, itemType: 'product', name: 'Scholar Nine' }] }
        if (call.path.endsWith('/crm/quotes/7/line-items') && call.method === 'GET') return { status: 1, message: '', data: [] }
        if (call.path.endsWith('/crm/quotes/7/line-items') && call.method === 'PUT') { saves.push(call.body as never); return { status: 1, message: 'ok', data: {} } }
        return undefined
      },
    })
    const { QuoteDetailPage } = await import('../../components/domain/crm/quote-detail-page')
    await screen.mount(screen.k.h(QuoteDetailPage, { quote: { ...SPECS[0].doc, priceBookId: '3' }, onSaved: () => undefined, onBack: () => undefined, quoteStages: [] }), 60)
    const { k } = screen
    await k.click(k.withText('Line Items')!)
    await k.tick(60)
    await k.click(k.withText('Add Line')!)
    await k.click(k.withText('Add Line')!)
    await pickRow(k, 10, 0)
    await pickRow(k, 11, 1)
    await k.click(k.withText('Save Line Items')!)
    await k.tick(40)
    assert.deepEqual(saves[0].lineItems.map((l) => [l.productId, l.unitPrice]), [['10', 999], ['11', 25000]], 'each line is priced from its Sub-product alone: 999 is Scholar Nine\'s own price, not the 750 an old price book listed')
    assert.equal(screen.calls.filter((c) => c.path.includes('price-book')).length, 0, 'no price book is fetched')
    screen.restore()
  })
})
