import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { absent } from '../agent/assertions'
import type { CrmSalesOrder } from '../../types/crm'
import { screenKit, type Call, type Responder } from '../leads/screen-kit'

/**
 * A Sales Order's page as a person meets it (FIX-e2e A1): the real page, the real invoice dialog, the real sidebar hook and service client, only the
 * network replaced. The day-in-the-life run found that "Create Invoice" never appeared, because nothing on the screen opened the dialog that already
 * knew how to copy an order into an invoice on the server.
 */

function salesOrder(over: Partial<CrmSalesOrder> = {}): CrmSalesOrder {
  return {
    id: '7', legacyId: null, soNo: 'SO-0007', subject: 'Hillcrest ERP rollout', organizationId: '58', organizationName: 'Hillcrest Academy', contactId: null,
    contactName: null, opportunityId: null, opportunityName: null, quoteId: null, quoteNo: null, soStage: 'Created', dueDate: null, carrier: null, currency: 'INR',
    subtotal: 1000, discountPercent: null, discountAmount: 0, shippingHandlingAmount: 0, adjustment: 0, taxTotal: 180, total: 1180,
    billingStreet: null, billingCity: null, billingState: null, billingCode: null, billingCountry: null, billingPoBox: null,
    shippingStreet: null, shippingCity: null, shippingState: null, shippingCode: null, shippingCountry: null, shippingPoBox: null,
    termsConditions: null, description: null, assignedTo: '2', assignedToName: 'Anil Shah', createdBy: '2', createdAt: null, updatedAt: null, ...over,
  }
}

/** The menu a person with Invoices in their sidebar has (the screen kit's own menu holds only Leads). */
function menuWithInvoices(withInvoices: boolean) {
  return [{
    id: 199, label: 'Sales & Marketing', icon: null, access_link: '/module/crm', page_type: null, sort_order: 1, parent_id: null,
    children: [
      { id: 201, label: 'Sales Orders', icon: null, access_link: '/module/crm/sales/sales-orders', page_type: 'page', sort_order: 1, parent_id: 199, children: [] },
      ...(withInvoices ? [{ id: 202, label: 'Invoices', icon: null, access_link: '/module/crm/sales/invoices', page_type: 'page', sort_order: 2, parent_id: 199, children: [] }] : []),
    ],
  }]
}

async function open(over: Partial<CrmSalesOrder> = {}, respond?: Responder, withInvoices = true) {
  const screen = await screenKit({
    pathname: '/module/crm/sales/sales-orders/7',
    respond: (call: Call) => {
      if (call.method === 'POST' && call.path.endsWith('/crm/invoices/from-sales-order/7')) {
        return respond?.(call) ?? { status: 1, message: 'Invoice created from sales order.', data: { id: '88', total: 1180 } }
      }
      return undefined
    },
  })
  // The sidebar hook reads its first answer from the browser's own storage when it mounts, so this replaces the Leads menu before anything is mounted.
  screen.k.w.sessionStorage.setItem('gtg-sidebar-cache-v3:1:16', JSON.stringify({ status_code: 200, message: 'ok', data: menuWithInvoices(withInvoices) }))
  const { SalesOrderDetailPage } = await import('../../components/domain/crm/sales-order-detail-page')
  await screen.mount(screen.k.h(SalesOrderDetailPage, { salesOrder: salesOrder(over), onSaved: () => undefined, onBack: () => undefined, soStages: [] }), 40)
  const { k } = screen
  const headerButton = () => k.one('button[data-create-invoice]')
  const dialogButton = (label: string) => k.all('[role="dialog"] button').find((b) => b.textContent?.trim() === label) ?? null
  return { ...screen, headerButton, dialogButton }
}

describe('a sales order\'s page: Create Invoice', () => {
  afterEach(async () => { await disposeAll() })

  it('shows a Create Invoice button on an order that can be invoiced', async () => {
    const s = await open()
    assert.ok(s.headerButton(), 'the button is drawn')
    assert.equal(s.headerButton()!.textContent!.trim(), 'Create Invoice')
    s.restore()
  })

  it('pressing it opens the "from sales order" dialog, which posts the ORDER\'S id and nothing typed by hand', async () => {
    const s = await open()
    await s.k.click(s.headerButton()!)
    await s.k.tick(30)
    assert.ok(s.k.bodyText().includes('Create Invoice From Sales Order'), 'the dialog names what it does')
    assert.equal(s.k.all('[role="dialog"] input').length, 0, 'there is no form to fill: the server copies the order')
    await s.k.click(s.dialogButton('Create Invoice')!)
    await s.k.tick(40)
    const posts = s.calls.filter((c) => c.method === 'POST' && c.path.includes('/crm/invoices'))
    assert.equal(posts.length, 1, 'exactly one invoice request')
    assert.equal(posts[0].path.replace(/^.*\/crm/, '/crm'), '/crm/invoices/from-sales-order/7', 'the request names the sales order, so the server copies its lines and total')
    s.restore()
  })

  it('after the invoice is made it opens the new invoice', async () => {
    const s = await open()
    await s.k.click(s.headerButton()!)
    await s.k.tick(30)
    await s.k.click(s.dialogButton('Create Invoice')!)
    await s.k.tick(40)
    assert.equal(s.router.written.at(-1), '/module/crm/sales/invoices/88', 'the new invoice\'s page is opened')
    s.restore()
  })

  it('a person whose menu has no Invoices row gets the server\'s message on the page, not a dead /dashboard address', async () => {
    const s = await open({}, undefined, false)
    await s.k.click(s.headerButton()!)
    await s.k.tick(30)
    await s.k.click(s.dialogButton('Create Invoice')!)
    await s.k.tick(40)
    assert.equal(s.router.written.length, 0, 'nothing was opened')
    assert.ok(s.k.bodyText().includes('Invoice created from sales order.'), 'the page says the invoice was made')
    s.restore()
  })

  it('when the server refuses, the dialog says why, stays open, and nothing is opened', async () => {
    const s = await open({}, () => ({ status: 0, message: 'You do not have the right to add invoices.', __status: 403 }))
    await s.k.click(s.headerButton()!)
    await s.k.tick(30)
    await s.k.click(s.dialogButton('Create Invoice')!)
    await s.k.tick(40)
    assert.ok(s.k.bodyText().includes('You do not have the right to add invoices.'), 'the refusal is shown')
    assert.ok(s.k.one('[role="dialog"]'), 'the dialog is still open')
    assert.equal(s.router.written.length, 0, 'no page was opened')
    s.restore()
  })

  it('draws no button on an order that is still a draft or was cancelled', async () => {
    for (const soStage of ['Draft', 'Cancelled']) {
      const s = await open({ soStage })
      absent(s.headerButton(), `a ${soStage} order cannot be invoiced`)
      s.restore()
      await disposeAll()
    }
  })
})
