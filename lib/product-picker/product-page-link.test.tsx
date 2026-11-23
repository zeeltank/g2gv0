import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { screenKit, type Call } from '../leads/screen-kit'
import { catalogueResponder } from './harness'

/**
 * The links from a ticket and an asset to the Sub-product they are about (slice 15, P3-C, brief item 3). These records hold the CATALOGUE id; the page is
 * addressed by the MASTER id, so a press asks `GET /product-master/by-crm/{id}` and goes to `/portfolio/products/{masterId}`. The link must not be built from
 * a menu row (`resolveAccessLink('/module/crm/sales/products')`): when the Products row is not in the person's sidebar that answers `/dashboard`.
 */
async function open(element: (h: (type: unknown, props?: unknown, ...children: unknown[]) => unknown) => unknown, extra: (call: Call) => unknown = () => undefined) {
  const catalogue = catalogueResponder({})
  const screen = await screenKit({
    pathname: '/module/crm/support/tickets/9',
    respond: async (call: Call) => (await catalogue(call)) ?? extra(call),
  })
  await screen.mount(element(screen.k.h) as never, 60)
  return screen
}

const link = (k: { one: (s: string) => HTMLElement | null }) => k.one('[data-product-page-link]') as HTMLButtonElement | null

describe('the link to a Sub-product page', () => {
  afterEach(async () => { await disposeAll() })

  it('goes to /portfolio/products/{masterId}, found from the catalogue id, also for a Sub-product that is paused', async () => {
    const { ProductPageLink } = await import('../../components/domain/portfolio/product-page-link')
    const s = await open((h) => h(ProductPageLink, { crmProductId: '15' }, 'Old Gujarat Edition'))
    assert.equal(link(s.k)!.textContent, 'Old Gujarat Edition')
    await s.k.click(link(s.k)!)
    await s.k.tick(30)
    assert.equal(s.to('/product-master/by-crm/15').length, 1, 'the master id is asked for when the link is pressed')
    assert.deepEqual(s.router.written, ['/portfolio/products/28'], 'the page of the MASTER id (28), not the catalogue id (15)')
    s.restore()
  })

  it('goes to the Product Portfolio list when the id cannot be found, not to a dead page and not to /dashboard', async () => {
    const { ProductPageLink } = await import('../../components/domain/portfolio/product-page-link')
    const s = await open((h) => h(ProductPageLink, { crmProductId: '999' }, 'Gone'))
    await s.k.click(link(s.k)!)
    await s.k.tick(30)
    assert.deepEqual(s.router.written, ['/portfolio'])
    s.restore()
  })
})

describe('the ticket and the asset page', () => {
  afterEach(async () => { await disposeAll() })

  it('a ticket\'s Sub-product opens the Sub-product page of the master id', async () => {
    const { TicketDetailPage } = await import('../../components/domain/crm/ticket-detail-page')
    const ticket = { id: '9', ticketNo: 'TT-9', title: 'Cannot log in', organizationId: null, organizationName: null, contactId: null, contactName: null, productId: '10', productName: 'Scholar Nine', assetId: null, assetName: null, serviceContractId: null, serviceContractNo: null, status: 'Open', priority: 'High', severity: null, category: null, description: null, solution: null, hours: null, days: null, assignedTo: '2', createdAt: null, updatedAt: null }
    const s = await open((h) => h(TicketDetailPage, { ticket, onSaved: () => undefined, onBack: () => undefined, ticketStatuses: [], ticketPriorities: [] }))
    assert.ok(link(s.k), 'the ticket shows its Sub-product as a link')
    assert.equal(link(s.k)!.textContent, 'Scholar Nine')
    assert.ok(s.k.all('dt').some((dt) => dt.textContent === 'Sub-product'), 'under the owner\'s word')
    await s.k.click(link(s.k)!)
    await s.k.tick(30)
    assert.deepEqual(s.router.written, ['/portfolio/products/23'])
    s.restore()
  })

  it('an asset\'s Sub-product opens the Sub-product page of the master id, and never asks the sidebar for the old Products address', async () => {
    const { AssetDetailPage } = await import('../../components/domain/crm/asset-detail-page')
    const asset = { id: '4', assetName: 'Server rack 1', productId: '11', productName: 'Scholar School ERP', organizationId: null, organizationName: null, serialNumber: null, tagNumber: null, dateSold: null, dateInService: null, status: null, shippingMethod: null, shippingTrackingNumber: null, invoiceId: null, invoiceNo: null, description: null, assignedTo: '2', createdAt: null, updatedAt: null }
    const s = await open((h) => h(AssetDetailPage, { asset, onSaved: () => undefined, onBack: () => undefined }))
    assert.ok(link(s.k), 'the asset shows its Sub-product as a link')
    await s.k.click(link(s.k)!)
    await s.k.tick(30)
    assert.deepEqual(s.router.written, ['/portfolio/products/24'])
    s.restore()
  })

  it('neither page builds the address from the Products menu row any more (a scan: that row may not be in the sidebar)', () => {
    for (const file of ['components/domain/crm/ticket-detail-page.tsx', 'components/domain/crm/asset-detail-page.tsx']) {
      assert.equal(readFileSync(file, 'utf8').includes('/module/crm/sales/products'), false, `${file} does not resolve the old Products address`)
    }
  })
})
