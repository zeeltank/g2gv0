import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { screenKit, type Call } from '../leads/screen-kit'
import { catalogueResponder, typeInto, type Kit } from '../product-picker/harness'
import { forgetResolved } from '../product-picker/resolver'

/**
 * Price Books are gone and a document line is priced from its Sub-product alone (S16, 25 Nov 2026; hp_erp contract section 6), as a person meets it: the REAL quote form, the
 * REAL document pages and line tables, the REAL services, only the network replaced.
 *
 *  - The quote form has no Price Book choice, and neither the form nor the quote page asks the server for a price book.
 *  - A save the server refuses with the `currency_mismatch` sentence shows that sentence, in words, on the line table of ALL THREE documents (quote, sales order, invoice),
 *    as an alert above the lines; it clears when the person edits a line; and any other failure still goes to the page's notice.
 */

const SENTENCE = 'Scholar Nine is priced in INR, this document is in USD.'

const common = {
  id: '7', currency: 'USD', subtotal: 0, discountAmount: 0, discountPercent: null, taxTotal: 0, total: 0, shippingHandlingAmount: 0, adjustment: 0, organizationId: null, organizationName: null,
  contactId: null, contactName: null, opportunityId: null, opportunityName: null, billingStreet: null, billingCity: null, billingState: null, billingCode: null, billingCountry: null,
  shippingStreet: null, shippingCity: null, shippingState: null, shippingCode: null, shippingCountry: null, termsConditions: null, description: null, assignedTo: '2',
  amountPaid: 0, balanceDue: 0, quoteStage: 'Draft', soStage: 'Created', invoiceStage: 'Draft', validTill: null, dueDate: null,
}
const SPECS = [
  { name: 'a quote', module: 'quote-detail-page', exportName: 'QuoteDetailPage', prop: 'quote', stageProp: 'quoteStages', endpoint: '/crm/quotes/7/line-items', doc: { ...common, subject: 'Hillcrest quote', quoteNo: 'Q-0007' } },
  { name: 'a sales order', module: 'sales-order-detail-page', exportName: 'SalesOrderDetailPage', prop: 'salesOrder', stageProp: 'soStages', endpoint: '/crm/sales-orders/7/line-items', doc: { ...common, subject: 'Hillcrest order', soNo: 'SO-0007' } },
  { name: 'an invoice', module: 'invoice-detail-page', exportName: 'InvoiceDetailPage', prop: 'invoice', stageProp: 'invoiceStages', endpoint: '/crm/invoices/7/line-items', doc: { ...common, subject: 'Hillcrest invoice', invoiceNo: 'INV-0007' } },
] as const

const savedLine = { id: '1', productId: '10', description: 'Scholar Nine', quantity: 2, unitPrice: 999, discountPercent: null, discountAmount: null, taxRateId: null, taxNameSnapshot: null, taxPercentSnapshot: null, lineTotal: 0, sequenceNo: 0 }

type Spec = (typeof SPECS)[number]

async function openDocument(spec: Spec, onSave: (call: Call) => unknown) {
  forgetResolved()
  const catalogue = catalogueResponder({})
  const screen = await screenKit({
    pathname: `/module/crm/sales/${spec.module}/7`,
    respond: async (call: Call) => {
      const answered = await catalogue(call)
      if (answered !== undefined) return answered
      if (call.path.endsWith('/crm/tax-rates')) return { status: 1, message: '', data: [] }
      if (call.path.endsWith(spec.endpoint) && call.method === 'GET') return { status: 1, message: '', data: [savedLine] }
      if (call.path.endsWith(spec.endpoint) && call.method === 'PUT') return onSave(call)
      return undefined
    },
  })
  const page = await import(`../../components/domain/crm/${spec.module}`)
  await screen.mount(screen.k.h(page[spec.exportName], { [spec.prop]: spec.doc, onSaved: () => undefined, onBack: () => undefined, [spec.stageProp]: [] }), 60)
  await screen.k.click(screen.k.withText('Line Items')!)
  await screen.k.tick(60)
  return screen
}

const alerts = (k: Kit) => k.all('[data-line-table-error]')
/** Presses Save and waits (up to about 3 seconds, in short steps) until the server has been asked and the page has drawn its answer. */
async function saveLines(s: Awaited<ReturnType<typeof openDocument>>) {
  const asked = () => s.calls.filter((c) => c.method === 'PUT').length
  const before = asked()
  await s.k.click(s.k.withText('Save Line Items')!)
  for (let i = 0; i < 120 && asked() === before; i++) await s.k.tick(25)
  await s.k.tick(150)
}

for (const spec of SPECS) {
  describe(`${spec.name}: a Sub-product priced in another currency`, () => {
    afterEach(async () => { await disposeAll() })

    it('shows the server\'s sentence on the line table, as an alert, once, and nowhere else', async () => {
      const s = await openDocument(spec, () => ({ __status: 422, status: 0, message: SENTENCE, code: 'currency_mismatch' }))
      assert.equal(alerts(s.k).length, 0, 'nothing is said before a save')
      await saveLines(s)
      const shown = alerts(s.k)
      assert.equal(shown.length, 1, 'one alert on the line table')
      assert.equal(shown[0].textContent, SENTENCE)
      assert.equal(shown[0].getAttribute('role'), 'alert')
      assert.ok(shown[0].closest('div.space-y-3')!.querySelector('table'), 'it sits with the line table it is about')
      assert.equal(s.k.bodyText().split(SENTENCE).length - 1, 1, 'and the sentence is not repeated in the page\'s notice')
      s.restore()
    })

    it('says it in the sentence the server gave, not a generic one (a different Sub-product and currencies)', async () => {
      const other = 'Implementation Support is priced in EUR, this document is in INR.'
      const s = await openDocument(spec, () => ({ __status: 422, status: 0, message: other }))
      await saveLines(s)
      assert.equal(alerts(s.k)[0].textContent, other)
      s.restore()
    })

    it('clears the sentence as soon as the person changes a line, and when the next save works', async () => {
      let refuse = true
      const s = await openDocument(spec, () => (refuse ? { __status: 422, status: 0, message: SENTENCE } : { status: 1, message: 'Line items saved.', data: spec.doc }))
      await saveLines(s)
      assert.equal(alerts(s.k).length, 1)
      const qty = Array.from(s.k.all('tbody tr')[0].querySelectorAll('input')).find((i) => (i as HTMLInputElement).type === 'number') as HTMLInputElement
      await typeInto(s.k, qty, '3')
      assert.equal(alerts(s.k).length, 0, 'editing a line clears it')
      refuse = false
      await saveLines(s)
      assert.equal(alerts(s.k).length, 0)
      assert.ok(s.k.bodyText().includes('Line items saved.'), 'a good save is announced as before')
      s.restore()
    })

    it('leaves every other failure to the page\'s notice and draws no alert on the line table', async () => {
      const s = await openDocument(spec, () => ({ __status: 500, status: 0, message: 'The server could not save these lines.' }))
      await saveLines(s)
      assert.equal(alerts(s.k).length, 0)
      assert.ok(s.k.bodyText().includes('The server could not save these lines.'))
      s.restore()
    })
  })
}

describe('Price Books are gone from the quote', () => {
  afterEach(async () => { await disposeAll() })

  const quote = { ...SPECS[0].doc, currency: 'INR', priceBookId: '3', priceBookName: 'Schools 2026' }

  it('the quote form has no Price Book choice and never asks for price books', async () => {
    const screen = await screenKit({ pathname: '/module/crm/sales/quotes', respond: async (call: Call) => (/\/crm\/(organizations|contacts|opportunities)$/.test(call.path) ? { status: 1, message: '', data: { items: [], total: 0 } } : undefined) })
    const { CreateQuoteModal } = await import('../../components/domain/crm/create-quote-modal')
    await screen.mount(screen.k.h(CreateQuoteModal, { isOpen: true, onClose: () => undefined, onSaved: () => undefined, quote: null, quoteStages: [] }), 60)
    const text = screen.k.bodyText()
    assert.ok(text.includes('New Quote'), 'the form is open')
    assert.ok(text.includes('Currency'), 'and still has its other fields')
    assert.equal(/price book/i.test(text), false, 'no Price Book label, hint or placeholder')
    assert.equal(screen.calls.filter((c) => c.path.includes('price-book')).length, 0)
    screen.restore()
  })

  it('an old quote that still carries a price book id is edited without one: nothing is sent back', async () => {
    const saved: Array<Record<string, unknown>> = []
    const screen = await screenKit({
      pathname: '/module/crm/sales/quotes/7',
      respond: async (call: Call) => {
        if (call.method === 'PUT' && call.path.endsWith('/crm/quotes/7')) { saved.push(call.body as Record<string, unknown>); return { status: 1, message: 'Quote updated.', data: quote } }
        if (/\/crm\/(organizations|contacts|opportunities)$/.test(call.path)) return { status: 1, message: '', data: { items: [], total: 0 } }
        return undefined
      },
    })
    const { CreateQuoteModal } = await import('../../components/domain/crm/create-quote-modal')
    await screen.mount(screen.k.h(CreateQuoteModal, { isOpen: true, onClose: () => undefined, onSaved: () => undefined, quote, quoteStages: [] }), 60)
    assert.equal(/price book/i.test(screen.k.bodyText()), false)
    await screen.k.click(screen.k.withText('Save Changes')!)
    await screen.k.tick(60)
    assert.equal(saved.length, 1, 'the quote was saved')
    assert.equal('priceBookId' in saved[0], false, 'no price book id is sent')
    assert.equal('priceBookName' in saved[0], false)
    screen.restore()
  })

  it('the quote page shows no Price Book field, and no link to the removed screen, even when the answer still carries one', async () => {
    const screen = await screenKit({
      pathname: '/module/crm/sales/quotes/7',
      respond: async (call: Call) => (call.path.endsWith('/crm/tax-rates') ? { status: 1, message: '', data: [] } : undefined),
    })
    const { QuoteDetailPage } = await import('../../components/domain/crm/quote-detail-page')
    await screen.mount(screen.k.h(QuoteDetailPage, { quote, onSaved: () => undefined, onBack: () => undefined, quoteStages: [] }), 60)
    const text = screen.k.bodyText()
    assert.ok(text.includes('Quote Details'))
    assert.equal(/price book/i.test(text), false, 'no Price Book field')
    assert.equal(screen.k.all('a, button').some((el) => /price-books/.test(el.getAttribute('href') ?? '')), false)
    assert.equal(screen.calls.filter((c) => c.path.includes('price-book')).length, 0, 'and no price book is fetched')
    screen.restore()
  })
})
