import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import type { CrmOpportunity } from '../../types/crm'
import { withOpportunityExtras } from '../opportunities/model'
import { opportunity, options, pipelineAnswer } from '../opportunities/fixtures'
import { screenKit, type Call } from '../opportunities/screen-kit'

/**
 * The Sub-products of an opportunity carry their own price (S16, 25 Nov 2026; hp_erp contract section 6), and under them sits a read-only SUGGESTED VALUE: quantity x price of
 * the rows priced in the opportunity's currency, the others listed as not added. As a person meets it: the REAL opportunity page, only the network replaced. The rule itself
 * (rounding, case, the reasons) is proved on rows in suggested-value.test.ts; here it is the SCREEN: what is drawn, what is hidden, and that nothing is ever written.
 */

const row = (id: string, name: string, quantity: number, price?: { unitPrice: number | null; currency: string | null; taxPercent?: number | null }) => ({
  id, productId: `1${id}`, name, itemType: 'product', quantity, ...(price ? { taxPercent: null, ...price } : {}),
})

async function open(rows: unknown[], over: Record<string, unknown> = {}) {
  const screen = await screenKit({
    pathname: '/module/crm/sales/opportunities/31',
    respond: (call: Call) => {
      if (call.path.endsWith('/product-master/options')) return { status: 1, data: options }
      if (call.path.endsWith('/crm/opportunities/pipeline')) return pipelineAnswer()
      if (call.path.endsWith('/crm/opportunities/31/products') && call.method === 'GET') return { status: 1, message: '', data: rows }
      return undefined
    },
  })
  const { OpportunityDetailPage } = await import('../../components/domain/crm/opportunity-detail-page')
  const read = withOpportunityExtras(opportunity({ id: '31', ...over }) as unknown as CrmOpportunity)
  const picklists = { salesStage: [], leadSource: [], potentialType: [], forecastCategory: [] }
  await screen.mount(screen.k.h(OpportunityDetailPage, { opportunity: read, onSaved: () => undefined, onBack: () => undefined, picklists }), 40)
  await screen.k.click(screen.k.withText('Sub-products')!)
  const { k } = screen
  // The Sub-products are read from the server: wait (up to about 3 seconds, in short steps) until the tab has drawn them or said there are none.
  for (let i = 0; i < 120 && (k.bodyText().includes('Loading Sub-products') || !/Nothing tagged yet|Qty \d/.test(k.bodyText())); i++) await k.tick(25)
  await k.tick(20)
  return {
    ...screen,
    section: () => k.one('[data-suggested-value]'),
    total: () => k.one('[data-suggested-total]')?.textContent ?? null,
    notAdded: () => k.all('[data-suggested-not-added] li').map((li) => li.textContent),
    prices: () => k.all('[data-opportunity-product-price]').map((p) => p.textContent),
    writes: () => screen.calls.filter((c) => c.method !== 'GET'),
  }
}

describe('an opportunity: the price of each Sub-product and the Suggested value', () => {
  afterEach(async () => { await disposeAll() })

  it('shows each row\'s price with its currency, and a Suggested value that adds only the rows priced in the opportunity\'s currency', async () => {
    const s = await open([
      row('1', 'Scholar Nine', 2, { unitPrice: 1000, currency: 'INR' }),
      row('2', 'Scholar School ERP', 1, { unitPrice: 25000.5, currency: 'INR' }),
      row('3', 'Scholar Cloud', 3, { unitPrice: 99, currency: 'USD' }),
    ])
    assert.deepEqual(s.prices(), ['₹1,000.00', '₹25,000.50', '$99.00'], 'each price in its own currency, with its symbol and grouping')
    assert.equal(s.total(), '₹27,000.50', '2 x 1,000 + 1 x 25,000.50: the USD row is not added')
    assert.deepEqual(s.notAdded(), ['Scholar Cloud: priced in USD, not INR.'], 'and it is listed, with the reason')
    assert.ok(s.section()!.textContent!.includes('it never changes the Amount'))
    s.restore()
  })

  it('lists a row with no price yet, and a price with no currency, as not added', async () => {
    const s = await open([row('1', 'Fee ERP', 1, { unitPrice: null, currency: 'INR' }), row('2', 'Old Pack', 1, { unitPrice: 500, currency: null }), row('3', 'Scholar Nine', 1, { unitPrice: 999, currency: 'INR' })])
    assert.equal(s.total(), '₹999.00')
    assert.deepEqual(s.notAdded(), ['Fee ERP: no price yet.', 'Old Pack: its price has no currency.'])
    assert.ok(s.k.bodyText().includes('No price yet'), 'the row itself says so')
    s.restore()
  })

  it('says no Sub-product is priced in the currency, rather than showing a zero as if it were a value', async () => {
    const s = await open([row('1', 'Scholar Cloud', 1, { unitPrice: 99, currency: 'USD' })])
    assert.ok(s.section()!.textContent!.includes('No Sub-product is priced in INR yet.'))
    assert.deepEqual(s.notAdded(), ['Scholar Cloud: priced in USD, not INR.'])
    s.restore()
  })

  it('asks for a currency when the opportunity has none, and adds nothing', async () => {
    const s = await open([row('1', 'Scholar Nine', 1, { unitPrice: 999, currency: 'INR' })], { currency: null })
    assert.ok(s.k.one('[data-suggested-needs-currency]'), 'the sentence about setting a currency')
    assert.equal(s.total(), null, 'no figure')
    s.restore()
  })

  it('draws no price and no Suggested value when the answer carries no prices (a viewer who may not see them)', async () => {
    const s = await open([row('1', 'Scholar Nine', 2), row('2', 'Scholar School ERP', 1)])
    assert.equal(s.section(), null)
    assert.deepEqual(s.prices(), [])
    assert.ok(s.k.bodyText().includes('Scholar Nine'), 'the Sub-products themselves are still listed')
    assert.equal(s.k.bodyText().includes('No price yet'), false, 'and a missing price is not called "no price yet"')
    s.restore()
  })

  it('draws no Suggested value for an opportunity with no Sub-products', async () => {
    const s = await open([])
    assert.equal(s.section(), null)
    s.restore()
  })

  it('NEVER writes: opening the tab and looking at a figure sends no request but reads, and the opportunity\'s Amount is untouched', async () => {
    const s = await open([row('1', 'Scholar Nine', 2, { unitPrice: 1000, currency: 'INR' })])
    assert.equal(s.total(), '₹2,000.00')
    assert.deepEqual(s.writes(), [], 'no POST, PUT or DELETE of any kind')
    assert.equal(s.section()!.querySelectorAll('button, input, select, textarea, a').length, 0, 'the card has nothing to press or type into')
    await s.k.click(s.k.withText('Details')!)
    await s.k.tick(40)
    assert.ok(s.k.bodyText().includes(`INR ${(450000).toLocaleString()}`), 'the Amount on the Details tab is still the opportunity\'s own 450000, written the way the page writes it')
    assert.deepEqual(s.writes(), [])
    s.restore()
  })
})
