import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { screenKit, type Call } from '../leads/screen-kit'
import { catalogueResponder, type ApiOptions, type Kit } from './harness'
import { forgetResolved } from './resolver'

/**
 * The other places that choose a Sub-product (slice 15, P3-C), each as a person meets it: the REAL page or dialog, the REAL picker and services, only the
 * network replaced. Each one must save the CATALOGUE id exactly as before (a string for a ticket, an asset and a FAQ,
 * the text an opportunity tag always sent), must show an id it already holds by name even when the picker no longer offers it, and must not ask the old product
 * list for anything.
 */
type Saved = Array<{ method: string; path: string; body: Record<string, unknown> }>

async function mountWith(respond: (call: Call) => unknown, element: (h: Kit['h']) => unknown, opts: { pathname?: string } = {}) {
  forgetResolved()
  const screen = await screenKit({ pathname: opts.pathname ?? '/module/crm/support/tickets', respond })
  await screen.mount(element(screen.k.h) as never, 60)
  return screen
}

const triggerOf = (k: Kit, index = 0) => k.all('[data-picker-trigger]')[index]
const shownName = (k: Kit, index = 0) => triggerOf(k, index).querySelector('[data-picker-value]')!.textContent
async function choose(k: Kit, crmProductId: number, index = 0) {
  await k.click(triggerOf(k, index))
  await k.tick(40)
  await k.click(k.one(`[data-picker-option="${crmProductId}"]`)!)
  await k.tick(20)
}
const writes = (saved: Saved, method: string, tail: string) => saved.filter((s) => s.method === method && s.path.endsWith(tail))
const noOldList = (calls: Call[]) => assert.equal(calls.filter((c) => c.path.endsWith('/crm/products')).length, 0, 'the old product list is not asked for')

function recorder(api: ApiOptions = {}, extra: (call: Call) => unknown = () => undefined) {
  const catalogue = catalogueResponder(api)
  const saved: Saved = []
  const respond = async (call: Call) => {
    const answered = await catalogue(call)
    if (answered !== undefined) return answered
    if (call.method === 'POST' || call.method === 'PUT') saved.push({ method: call.method, path: call.path, body: call.body as Record<string, unknown> })
    const own = extra(call)
    if (own !== undefined) return own
    // The option lists the forms read beside the Sub-product (organizations, contacts, assets, contracts, invoices): empty pages, in the shape the list endpoints answer.
    if (call.method === 'GET' && /\/crm\/(organizations|contacts|assets|service-contracts|invoices)$/.test(call.path)) return { status: 1, message: '', data: { items: [], total: 0 } }
    return undefined
  }
  return { saved, respond }
}

describe('an opportunity: Sub-products of Interest', () => {
  afterEach(async () => { await disposeAll() })

  it('tags the chosen Sub-product with the catalogue id as text and the quantity', async () => {
    const { opportunity } = await import('../opportunities/fixtures')
    const { withOpportunityExtras } = await import('../opportunities/model')
    const { saved, respond } = recorder({}, (call) => (call.method === 'POST' ? { status: 1, message: 'Added.' } : undefined))
    const { OpportunityDetailPage } = await import('../../components/domain/crm/opportunity-detail-page')
    const s = await mountWith(respond, (h) => h(OpportunityDetailPage, { opportunity: withOpportunityExtras(opportunity() as never), onSaved: () => undefined, onBack: () => undefined, picklists: { salesStage: [], leadSource: [], potentialType: [], forecastCategory: [] } }), { pathname: '/module/crm/sales/opportunities/31' })
    await s.k.click(s.k.withText('Sub-products')!)
    await s.k.tick(30)
    await s.k.click(s.k.withText('Add Sub-product')!)
    await s.k.tick(40)
    await choose(s.k, 12)
    await s.k.click(s.k.withText('Add')!)
    await s.k.tick(40)
    const post = writes(saved, 'POST', '/products')
    assert.equal(post.length, 1)
    assert.strictEqual(post[0].body.productId, '12', 'the catalogue id as the text the tag has always sent')
    assert.equal(post[0].body.quantity, 1)
    noOldList(s.calls)
    s.restore()
  })

  it('names a tagged Sub-product a Sub-product (a service stays a Service), never a Product', async () => {
    const { opportunity } = await import('../opportunities/fixtures')
    const { withOpportunityExtras } = await import('../opportunities/model')
    const rows = [{ id: '7', productId: '12', name: 'Fees Intelligence', itemType: 'product', quantity: 2 }, { id: '8', productId: '13', name: 'Implementation', itemType: 'service', quantity: 1 }]
    const { respond } = recorder({}, (call) => (call.method === 'GET' && call.path.endsWith('/products') ? { status: 1, message: '', data: rows } : undefined))
    const { OpportunityDetailPage } = await import('../../components/domain/crm/opportunity-detail-page')
    const s = await mountWith(respond, (h) => h(OpportunityDetailPage, { opportunity: withOpportunityExtras(opportunity() as never), onSaved: () => undefined, onBack: () => undefined, picklists: { salesStage: [], leadSource: [], potentialType: [], forecastCategory: [] } }), { pathname: '/module/crm/sales/opportunities/31' })
    await s.k.click(s.k.withText('Sub-products')!)
    await s.k.tick(30)
    const text = s.k.bodyText()
    assert.ok(text.includes('Sub-product · Qty 2'), text.slice(0, 500))
    assert.ok(text.includes('Service · Qty 1'))
    assert.ok(!/(^|[^-])Product · Qty/.test(text), 'the word Product is for the level above')
    s.restore()
  })
})

describe('a ticket: the Sub-product', () => {
  afterEach(async () => { await disposeAll() })

  const ticket = { id: '9', title: 'Cannot log in', organizationId: null, contactId: null, productId: '15', assetId: null, serviceContractId: null, status: 'Open', priority: 'High', severity: null, category: null, description: null, assignedTo: '2' }

  async function open() {
    const { saved, respond } = recorder({}, (call) => (call.method === 'PUT' ? { status: 1, message: 'Ticket saved.', data: {} } : undefined))
    const { CreateTicketModal } = await import('../../components/domain/crm/create-ticket-modal')
    const s = await mountWith(respond, (h) => h(CreateTicketModal, { isOpen: true, onClose: () => undefined, onSaved: () => undefined, ticket, ticketStatuses: [], ticketPriorities: [] }))
    return { ...s, saved }
  }

  it('shows the ticket\'s paused Sub-product by name, and saves the catalogue id of the one chosen instead', async () => {
    const s = await open()
    assert.equal(shownName(s.k), 'Old Gujarat Edition', 'a paused Sub-product is shown by name, not blank')
    await choose(s.k, 10)
    await s.k.click(s.k.withText('Save Changes')!)
    await s.k.tick(40)
    const put = writes(s.saved, 'PUT', '/crm/tickets/9')
    assert.equal(put.length, 1)
    assert.strictEqual(put[0].body.productId, '10')
    noOldList(s.calls)
    s.restore()
  })

  it('lets the person take the Sub-product off, and saves null', async () => {
    const s = await open()
    await s.k.click(triggerOf(s.k))
    await s.k.tick(40)
    await s.k.click(s.k.one('[data-picker-clear]')!)
    await s.k.click(s.k.withText('Save Changes')!)
    await s.k.tick(40)
    assert.strictEqual(writes(s.saved, 'PUT', '/crm/tickets/9')[0].body.productId, null)
    s.restore()
  })
})

describe('an asset: the required Sub-product', () => {
  afterEach(async () => { await disposeAll() })

  const asset = { id: '4', assetName: 'Server rack 1', productId: '16', organizationId: null, serialNumber: '', tagNumber: '', dateSold: null, dateInService: null, status: null, shippingMethod: null, shippingTrackingNumber: null, invoiceId: null, description: null, assignedTo: '2' }

  async function open(over: Record<string, unknown> = {}) {
    const { saved, respond } = recorder({}, (call) => (call.method === 'PUT' || call.method === 'POST' ? { status: 1, message: 'Asset saved.', data: {} } : undefined))
    const { CreateAssetModal } = await import('../../components/domain/crm/create-asset-modal')
    const s = await mountWith(respond, (h) => h(CreateAssetModal, { isOpen: true, onClose: () => undefined, onSaved: () => undefined, asset: { ...asset, ...over } }))
    return { ...s, saved }
  }

  it('shows an asset\'s Sub-product that is in the Recycle Bin by name, and saves the one chosen as a string id', async () => {
    const s = await open()
    assert.equal(shownName(s.k), 'Retired Pack')
    assert.equal(s.k.one('[data-picker-state]')!.textContent, 'Not sold')
    await choose(s.k, 11)
    await s.k.click(s.k.withText('Save Changes')!)
    await s.k.tick(40)
    const put = writes(s.saved, 'PUT', '/crm/assets/4')
    assert.equal(put.length, 1)
    assert.strictEqual(put[0].body.productId, '11')
    noOldList(s.calls)
    s.restore()
  })

  it('still refuses to save without a Sub-product, in the owner\'s words', async () => {
    const s = await open({ productId: null })
    await s.k.click(s.k.withText('Save Changes')!)
    await s.k.tick(30)
    assert.ok(s.k.bodyText().includes('Asset Name, Sub-product, and Assigned To are required.'))
    assert.equal(writes(s.saved, 'PUT', '/crm/assets/4').length, 0, 'nothing is sent')
    s.restore()
  })
})

describe('a FAQ: the optional Sub-product', () => {
  afterEach(async () => { await disposeAll() })

  const faq = { id: '3', question: 'How do I reset?', answer: 'Use the link.', category: '', status: 'Draft', productId: '', assignedTo: '2' }

  it('saves the chosen catalogue id as text, and an empty one as an empty string, as before', async () => {
    const { saved, respond } = recorder({}, (call) => (call.method === 'PUT' ? { status: 1, message: 'FAQ saved.', data: {} } : undefined))
    const { CreateFaqModal } = await import('../../components/domain/crm/create-faq-modal')
    const s = await mountWith(respond, (h) => h(CreateFaqModal, { isOpen: true, onClose: () => undefined, onSaved: () => undefined, faq, categories: [], statuses: [] }))
    assert.equal(shownName(s.k), 'Optional - leave blank for a general question')
    await s.k.click(s.k.withText('Save Changes')!)
    await s.k.tick(40)
    assert.strictEqual(writes(saved, 'PUT', '/crm/faqs/3')[0].body.productId, '', 'left blank: the empty string it has always sent')
    await choose(s.k, 12)
    await s.k.click(s.k.withText('Save Changes')!)
    await s.k.tick(40)
    assert.strictEqual(writes(saved, 'PUT', '/crm/faqs/3')[1].body.productId, '12')
    noOldList(s.calls)
    s.restore()
  })
})
