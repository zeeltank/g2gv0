import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import type { PmPriceTotal } from '../../services/product-master/record-types'
import { IMPORT_HEADER_MAP, TEMPLATE_HEADERS } from './import-template'
import { productTotal } from './model'
import { ADMIN_CAN, adminRows, aboutOnly, HR_CAN, product, service, sold } from './fixtures'
import { setup } from './screen-setup'

/** What S16 adds to the Product Portfolio list: a Product's total, the badge on a Sub-product's price, and the import's Currency and Tax Rate columns. */

const INR: PmPriceTotal = { currency: 'INR', subtotal: 12500, tax: 2250, total: 14750, counted: 5, uncounted: 2 }
const USD: PmPriceTotal = { currency: 'USD', subtotal: 2000, tax: 160, total: 2160, counted: 1, uncounted: 2 }

describe('the list: which total a Product row shows', () => {
  it('is the first currency\'s block, with the blocks after it counted for "+1 more"', () => {
    const total = productTotal(product({ priceTotals: [INR, USD] }))
    assert.equal(total?.first.currency, 'INR')
    assert.deepEqual(total?.more.map((t) => t.currency), ['USD'])
  })

  it('is null for a Sub-product, for a Product with no total and for a row the server sent none for', () => {
    assert.equal(productTotal(sold({ priceTotals: [INR] })), null, 'only a Product has a total')
    assert.equal(productTotal(product({ priceTotals: [] })), null)
    assert.equal(productTotal(product()), null)
  })
})

describe('the list: a Product\'s total and a Sub-product\'s price', () => {
  let current: Awaited<ReturnType<typeof setup>> | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })
  const open = async (opts: Parameters<typeof setup>[0] = {}) => { current = await setup(opts); return current }
  const rowsWith = (totals: PmPriceTotal[] | undefined) => [product({ priceTotals: totals }), aboutOnly(), sold(), service()]

  it('shows the total of a Product with its currency badge', async () => {
    const { rowOf } = await open({ rows: rowsWith([INR]) })
    const header = rowOf('ScholarClone')!
    assert.ok((header.textContent ?? '').includes('Total'), header.textContent ?? '')
    assert.ok((header.textContent ?? '').includes('₹14,750.00'), header.textContent ?? '')
    assert.ok(!(header.textContent ?? '').includes('more'), 'one currency: no "+1 more"')
  })

  it('shows the first currency and "+1 more" when the Sub-products are priced in several, naming the others for a screen reader', async () => {
    const { rowOf } = await open({ rows: rowsWith([INR, USD]) })
    const header = rowOf('ScholarClone')!
    assert.ok((header.textContent ?? '').includes('₹14,750.00'))
    assert.ok((header.textContent ?? '').includes('+1 more'), header.textContent ?? '')
    assert.ok((header.querySelector('.sr-only')?.textContent ?? '').includes('$2,160.00'), 'the hidden words name the other total')
  })

  it('shows no total for a Product the server sent none for', async () => {
    for (const totals of [[], undefined]) {
      const { rowOf } = await open({ rows: rowsWith(totals) })
      assert.ok(!(rowOf('ScholarClone')!.textContent ?? '').includes('Total'), `no total for ${JSON.stringify(totals)}`)
      current?.restore()
      await disposeAll()
    }
  })

  it('shows HR no total even if one were sent, and no price figure anywhere', async () => {
    const { text } = await open({ rows: [product({ priceTotals: [INR] }), aboutOnly()], can: HR_CAN })
    assert.ok(!text().includes('14,750') && !text().includes('₹') && !text().includes('Total'))
  })

  it('draws a Sub-product\'s price with the badge of its own currency: the rupee in Indian grouping, a dollar in the international one', async () => {
    const { rowOf, k } = await open({ rows: [product(), sold({ unitPrice: 120000, currency: 'INR' }), sold({ id: 12, name: 'Export pack', key: 'scholarclone/sch-09', unitPrice: 1234567.5, currency: 'USD' })] })
    assert.ok((rowOf('Fees Intelligence')!.textContent ?? '').includes('₹1,20,000.00'))
    assert.ok((rowOf('Export pack')!.textContent ?? '').includes('$1,234,567.50'))
    const badges = k.all('tbody [role="img"]').map((b) => b.getAttribute('aria-label'))
    assert.ok(badges.includes('Indian Rupee (INR)') && badges.includes('US Dollar (USD)'), badges.join(', '))
  })

  it('draws a legacy currency as typed, with the neutral badge', async () => {
    const { rowOf, k } = await open({ rows: [product(), sold({ unitPrice: 500, currency: 'Rs' })] })
    assert.ok((rowOf('Fees Intelligence')!.textContent ?? '').includes('500.00'))
    assert.ok(k.all('tbody [role="img"]').some((b) => b.getAttribute('aria-label') === 'Rs (not in the list)' && b.textContent === '¤'))
  })

  it('keeps a dash for a sold Sub-product with no price, and draws no badge there', async () => {
    const { rowOf } = await open({ rows: [product(), sold({ unitPrice: null })] })
    const cell = rowOf('Fees Intelligence')!
    assert.ok((cell.textContent ?? '').includes('—'))
    assert.equal(cell.querySelectorAll('[role="img"]').length, 0)
  })

  it('has no accessibility violation with totals and badges on the page', async () => {
    const { k } = await open({ rows: [...rowsWith([INR, USD])], can: ADMIN_CAN })
    assert.deepEqual(await axeViolations(k.one('table')!), [])
  })

  it('lays the Product header out so it can wrap on a phone: a wrapping row, no fixed width', async () => {
    const { rowOf } = await open({ rows: rowsWith([INR, USD]) })
    const summary = rowOf('ScholarClone')!.querySelector('span.ml-auto')!
    assert.match(summary.className, /flex-wrap/, 'the total, the count and the Add button wrap instead of pushing the page sideways')
    assert.ok(!/\b(w-\d|w-\[|min-w-(?!0))/.test(rowOf('ScholarClone')!.innerHTML), 'no fixed width inside the header')
  })

  it('works with the admin\'s whole page (a total on a Product, services, strays) without a retired word', async () => {
    const rows = adminRows().map((r) => (r.kind === 'product' && !r.shared ? { ...r, priceTotals: [INR] } : r))
    const { text } = await open({ rows })
    assert.equal(/\b(catalogues?|offers?|items?|product lines?|price books?)\b/i.test(text()), false)
  })
})

describe('the import template', () => {
  it('has the Currency and the Tax Rate columns, and reads both back to the API\'s own names', () => {
    assert.ok(TEMPLATE_HEADERS.includes('Currency') && TEMPLATE_HEADERS.includes('Tax Rate'))
    assert.equal(TEMPLATE_HEADERS.indexOf('Tax Rate'), TEMPLATE_HEADERS.indexOf('Currency') + 1, 'the rate sits beside the currency')
    assert.equal(IMPORT_HEADER_MAP.currency, 'currency')
    assert.equal(IMPORT_HEADER_MAP['tax rate'], 'taxRate')
  })

  it('keeps every column the old Products screen\'s file had, so a file made for it imports unchanged', () => {
    for (const old of ['Name', 'SKU', 'Category', 'Unit Price', 'Cost Price', 'Currency', 'Vendor', 'Qty In Stock', 'Reorder Level', 'Description', 'Assigned To (user id)']) assert.ok(TEMPLATE_HEADERS.includes(old as never), old)
    for (const header of TEMPLATE_HEADERS) assert.ok(IMPORT_HEADER_MAP[header.toLowerCase()], `${header} has an alias`)
  })
})
