import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import { routerHarness } from '../signals/router-harness'
import { axeViolations } from '../agent/a11y'
import { portfolioProducts } from '../signals/opportunity-fixtures'
import { CURRENCIES } from '../money/currencies'
import type { PmFullRecord, PmListRow, PmPriceTotal } from '../../services/product-master/record-types'
import type { PmMeta, PmTaxRate } from '../../services/product-master/types'
import { fullRecord, listRow, meta as metaFixture, productRecord, sellRow } from './fixtures'
import { controlOf, fill, installWorld, openTab, switchOf, type Kit, type World } from './screen-kit'

/**
 * Price, currency and tax on the Portfolio screens (S16, contract section 5): the badge and the currency select, the Sell section's tax list and live price card,
 * the read-only card on the Details tab, the Product's total card, and the Price books that are gone from the Usage tab. The server is a fake that records what it is asked.
 */

const RATES: PmTaxRate[] = [
  { id: 3, name: 'GST', percentage: 18, currency: 'INR' },
  { id: 4, name: 'GST', percentage: 5, currency: 'INR' },
  { id: 5, name: 'VAT', percentage: 20, currency: 'EUR' },
  { id: 6, name: 'Sales tax', percentage: 8, currency: 'USD' },
  { id: 7, name: 'Exempt', percentage: 0, currency: null },
]

const withRates = (over: Partial<PmMeta> = {}): PmMeta => metaFixture({ taxRates: RATES, ...over })

async function openForm(mode: 'create-sub-product' | 'edit', world: World = {}, extra: { recordId?: number; defaultProductId?: number } = {}) {
  const k = await kit()
  const calls = await installWorld(k, { meta: withRates(), ...world })
  const { ProductFormDrawer } = await import('../../components/domain/portfolio/product-form-drawer')
  await k.render(k.h(ProductFormDrawer, { open: true, onOpenChange: () => {}, mode, recordId: extra.recordId, defaultProductId: extra.defaultProductId, onSaved: () => {} }))
  await k.tick(40)
  return { k, calls }
}

const editForm = (record: PmFullRecord, world: World = {}) => openForm('edit', { ...world, record }, { recordId: record.id })
const optionsOf = (k: Kit, label: string): string[] => Array.from((controlOf(k, label) as HTMLSelectElement).options).map((o) => o.textContent ?? '')
/** The words of a card with one space between its elements (the DOM has none: the stylesheet lays them out), so it reads as a person reads it: "Price 1,000.00 GST 18% 180.00 Total 1,180.00". */
const wordsOf = (root: Element | null | undefined): string => (root ? Array.from(root.querySelectorAll('*')).filter((e) => e.children.length === 0).map((e) => e.textContent ?? '').join(' ').replace(/\s+/g, ' ').trim() : '')
const cardText = (k: Kit): string => wordsOf(k.one('section[aria-label="Price with tax"]'))

async function startSelling(k: Kit) {
  await openTab(k, 'Sell in CRM')
  await k.click(switchOf(k, 'Sell in CRM')!)
}

// ============================================================================================================================ the badge and the select

describe('the currency badge', () => {
  afterEach(disposeAll)

  async function draw(props: Record<string, unknown>) {
    const k = await kit()
    const { CurrencyBadge } = await import('../../components/domain/portfolio/currency-badge')
    await k.render(k.h(CurrencyBadge, props))
    return k
  }

  it('is a round badge holding the symbol, named for a screen reader as "Indian Rupee (INR)"', async () => {
    const k = await draw({ code: 'INR' })
    const badge = k.one('[role="img"]')!
    assert.equal(badge.textContent, '₹')
    assert.equal(badge.getAttribute('aria-label'), 'Indian Rupee (INR)')
    assert.match(badge.className, /rounded-full/)
    assert.deepEqual(await axeViolations(k.one('body')!), [])
  })

  it('draws a different symbol for each code, and reads a code in any case', async () => {
    for (const [code, symbol] of [['USD', '$'], ['eur', '€'], ['JPY', '¥'], ['CHF', 'CHF']] as const) {
      const k = await draw({ code })
      assert.equal(k.one('[role="img"]')!.textContent, symbol, code)
      await disposeAll()
    }
  })

  it('draws a NEUTRAL badge for a code that is not in the list: the generic sign, a dashed border, the code as typed, and a name that says it is not in the list', async () => {
    const k = await draw({ code: 'Rs' })
    const badge = k.one('[role="img"]')!
    assert.equal(badge.textContent, '¤', 'no symbol is invented for it')
    assert.match(badge.className, /border-dashed/, 'it looks different from a catalogue currency')
    assert.equal(badge.getAttribute('aria-label'), 'Rs (not in the list)')
    await disposeAll()
    const named = await draw({ code: 'Rs', showCode: true, showName: true })
    assert.ok(named.bodyText().includes('Rs'), 'the code is shown as typed')
    assert.ok(named.bodyText().includes('not in the list'))
    assert.equal(named.one('[role="img"]'), null, 'with its words beside it the badge is hidden from a screen reader, so the name is not read twice')
    assert.deepEqual(await axeViolations(named.one('body')!), [])
  })

  it('shows the code and the name beside the badge when asked, and nothing for an empty code', async () => {
    const full = await draw({ code: 'USD', showCode: true, showName: true })
    assert.ok(full.bodyText().includes('$') && full.bodyText().includes('USD') && full.bodyText().includes('US Dollar'))
    await disposeAll()
    for (const empty of [null, undefined, '', '  ']) {
      const none = await draw({ code: empty })
      assert.equal(none.bodyText(), '', `nothing for ${JSON.stringify(empty)}`)
      await disposeAll()
    }
  })

  it('draws no flag picture and no emoji: the badge is text', async () => {
    const k = await draw({ code: 'INR', showCode: true, showName: true })
    assert.equal(k.all('img, svg').length, 0)
    assert.equal(/[\u{1F1E6}-\u{1F1FF}]/u.test(k.bodyText()), false, 'no regional-indicator (flag) character')
  })

  it('writes an amount as the badge and the number, so the cell reads like the formatted money', async () => {
    const k = await kit()
    const { Money } = await import('../../components/domain/portfolio/currency-badge')
    await k.render(k.h(Money, { amount: 120000, code: 'INR' }))
    assert.equal(k.bodyText(), '₹1,20,000.00')
    await k.render(k.h(Money, { amount: 1500, code: 'USD' }))
    assert.equal(k.bodyText(), '$1,500.00')
    await k.render(k.h(Money, { amount: null, code: 'USD' }))
    assert.equal(k.bodyText(), '', 'no amount, nothing')
  })
})

describe('the currency select', () => {
  afterEach(disposeAll)

  async function draw(value: string, fallbackCode?: string) {
    const k = await kit()
    const { CurrencySelect } = await import('../../components/domain/portfolio/currency-select')
    const { Field } = await import('../../components/shared/scaffolds')
    const picked: string[] = []
    await k.render(k.h(Field, { label: 'Currency', children: (c: object) => k.h(CurrencySelect, { ...c, value, onChange: (code: string) => picked.push(code), fallbackCode }) }))
    return { k, picked, select: () => controlOf(k, 'Currency') as HTMLSelectElement }
  }

  it('is a labelled select of the twelve currencies, each option naming its symbol, code and name', async () => {
    const { k, select } = await draw('INR')
    assert.equal(select().value, 'INR')
    assert.deepEqual(Array.from(select().options).map((o) => o.value), CURRENCIES.map((c) => c.code))
    assert.equal(select().options[0].textContent, '₹ INR - Indian Rupee')
    assert.equal(select().options[1].textContent, '$ USD - US Dollar')
    assert.deepEqual(await axeViolations(k.one('body')!), [])
  })

  it('shows the badge of the chosen currency and reports a choice', async () => {
    const { k, picked, select } = await draw('USD')
    assert.equal(k.one('[role="img"]')!.getAttribute('aria-label'), 'US Dollar (USD)')
    await fill(k, 'Currency', 'EUR')
    assert.deepEqual(picked, ['EUR'])
    assert.ok(select())
  })

  it('keeps a legacy value as one more option, as typed and marked, so it is never rewritten', async () => {
    const { k, select } = await draw('Rs')
    assert.equal(select().value, 'Rs')
    assert.equal(select().options[0].textContent, 'Rs (not in the list)')
    assert.equal(select().options.length, CURRENCIES.length + 1)
    assert.equal(k.one('[role="img"]')!.textContent, '¤', 'with the neutral badge')
  })

  it('offers an empty value (saved before the list existed) as "Default (INR)"', async () => {
    const { select } = await draw('', 'INR')
    assert.equal(select().value, '')
    assert.equal(select().options[0].textContent, 'Default (INR)')
  })
})

// ============================================================================================================================ the Sell section

describe('the Sell section: currency', () => {
  afterEach(disposeAll)

  it('is a select that starts on the organisation\'s default currency and is never empty on a new Sub-product', async () => {
    const { k } = await openForm('create-sub-product')
    await startSelling(k)
    const select = controlOf(k, 'Currency') as HTMLSelectElement
    assert.equal(select.tagName, 'SELECT', 'a select, not a free text box')
    assert.equal(select.value, 'INR')
    assert.ok(!optionsOf(k, 'Currency').includes('Default (INR)'), 'no empty choice on a create')
    await disposeAll()
    const usd = await openForm('create-sub-product', { meta: withRates({ defaultCurrency: 'USD' }) })
    await startSelling(usd.k)
    assert.equal((controlOf(usd.k, 'Currency') as HTMLSelectElement).value, 'USD', 'the organisation\'s own default')
  })

  it('falls back to the rupee when the server sends no default, or one that is not in the list', async () => {
    const old = metaFixture({ taxRates: RATES })
    delete old.defaultCurrency
    delete old.currencies
    const { k } = await openForm('create-sub-product', { meta: old })
    await startSelling(k)
    assert.equal((controlOf(k, 'Currency') as HTMLSelectElement).value, 'INR')
    await disposeAll()
    const odd = await openForm('create-sub-product', { meta: withRates({ defaultCurrency: 'XYZ' }) })
    await startSelling(odd.k)
    assert.equal((controlOf(odd.k, 'Currency') as HTMLSelectElement).value, 'INR')
  })

  it('sends the currency with a new entry, and only a changed currency on an edit', async () => {
    const created = await openForm('create-sub-product')
    await fill(created.k, 'Name', 'Training day')
    await startSelling(created.k)
    await fill(created.k, 'Unit price', '1500')
    await created.k.click(created.k.withText('Save')!)
    await created.k.tick(30)
    assert.equal((created.calls.create[0].sell as Record<string, unknown>).currency, 'INR', 'a currency always goes with a new entry')
    await disposeAll()

    const edited = await editForm(fullRecord())
    await openTab(edited.k, 'Sell in CRM')
    await fill(edited.k, 'Unit price', '1750')
    await edited.k.click(edited.k.withText('Save')!)
    await edited.k.tick(30)
    assert.deepEqual(edited.calls.update[0].body, { sell: { unitPrice: 1750 } }, 'the currency is not sent when it did not change')
    await disposeAll()

    const switched = await editForm(fullRecord())
    await openTab(switched.k, 'Sell in CRM')
    await fill(switched.k, 'Currency', 'USD')
    await fill(switched.k, 'Tax rate', '')
    await switched.k.click(switched.k.withText('Save')!)
    await switched.k.tick(30)
    assert.deepEqual(switched.calls.update[0].body, { sell: { currency: 'USD', taxRateId: null } })
  })

  it('keeps a legacy currency as it was typed: it is an option, selected, and a save of another field does not rewrite it', async () => {
    const { k, calls } = await editForm(fullRecord({ sell: sellRow({ currency: 'Rs', taxRateId: null, taxRateName: null, taxPercent: null }) }))
    await openTab(k, 'Sell in CRM')
    const select = controlOf(k, 'Currency') as HTMLSelectElement
    assert.equal(select.value, 'Rs')
    assert.equal(select.options[0].textContent, 'Rs (not in the list)')
    await fill(k, 'SKU', 'NEW-SKU')
    await k.click(k.withText('Save')!)
    await k.tick(30)
    assert.deepEqual(calls.update[0].body, { sell: { sku: 'NEW-SKU' } }, 'the legacy currency is neither fixed nor sent')
  })

  it('offers "Default (INR)" for a record saved with no currency, and does not send one unless the person chooses', async () => {
    const { k, calls } = await editForm(fullRecord({ sell: sellRow({ currency: null }) }))
    await openTab(k, 'Sell in CRM')
    const select = controlOf(k, 'Currency') as HTMLSelectElement
    assert.equal(select.value, '')
    assert.equal(select.options[0].textContent, 'Default (INR)')
    await fill(k, 'SKU', 'X-1')
    await k.click(k.withText('Save')!)
    await k.tick(30)
    assert.deepEqual(calls.update[0].body, { sell: { sku: 'X-1' } })
  })

  it('shows a refused currency next to the field', async () => {
    const { ApiError } = await import('../../services/core')
    const { k } = await editForm(fullRecord(), { refuse: () => new ApiError('Invalid.', 422, { 'sell.currency': ['Choose a currency from the list.'] }) })
    await openTab(k, 'Sell in CRM')
    await fill(k, 'Currency', 'EUR')
    await fill(k, 'Tax rate', '')
    await k.click(k.withText('Save')!)
    await k.tick(30)
    assert.ok(k.bodyText().includes('Choose a currency from the list.'))
    assert.equal(controlOf(k, 'Currency').getAttribute('aria-invalid'), 'true')
  })
})

describe('the Sell section: the tax rate follows the currency', () => {
  afterEach(disposeAll)

  it('lists the rates of the chosen currency and the rates tied to none, and no others', async () => {
    const { k } = await editForm(fullRecord({ sell: sellRow({ taxRateId: null, taxRateName: null, taxPercent: null }) }))
    await openTab(k, 'Sell in CRM')
    assert.deepEqual(optionsOf(k, 'Tax rate'), ['Default', 'GST (18%)', 'GST (5%)', 'Exempt (0%)'], 'INR: the two GST rates and the rate with no currency')
    await fill(k, 'Currency', 'EUR')
    assert.deepEqual(optionsOf(k, 'Tax rate'), ['Default', 'VAT (20%)', 'Exempt (0%)'])
    await fill(k, 'Currency', 'JPY')
    assert.deepEqual(optionsOf(k, 'Tax rate'), ['Default', 'Exempt (0%)'], 'a currency with no rate of its own offers only the rate for any currency')
  })

  it('drops a rate that no longer fits when the currency changes, says so, and sends the drop', async () => {
    const { k, calls } = await editForm(fullRecord())
    await openTab(k, 'Sell in CRM')
    assert.equal((controlOf(k, 'Tax rate') as HTMLSelectElement).value, '3', 'GST 18% is chosen')
    await fill(k, 'Currency', 'EUR')
    assert.equal((controlOf(k, 'Tax rate') as HTMLSelectElement).value, '', 'it was taken off')
    const note = k.all('[role="status"]').map((s) => s.textContent ?? '').find((t) => t.includes('GST (18%)'))
    assert.ok(note, 'the person is told')
    assert.ok(note.includes('is for INR') && note.includes('EUR'), `the note names both currencies: ${note}`)
    await k.click(k.withText('Save')!)
    await k.tick(30)
    assert.deepEqual(calls.update[0].body, { sell: { currency: 'EUR', taxRateId: null } })
  })

  it('keeps a rate that has no currency when the currency changes, with no note', async () => {
    const { k } = await editForm(fullRecord({ sell: sellRow({ taxRateId: 7, taxRateName: 'Exempt', taxPercent: 0 }) }))
    await openTab(k, 'Sell in CRM')
    await fill(k, 'Currency', 'EUR')
    assert.equal((controlOf(k, 'Tax rate') as HTMLSelectElement).value, '7')
    assert.ok(!k.bodyText().includes('was taken off'))
  })

  it('takes the note away once the person chooses a rate', async () => {
    const { k } = await editForm(fullRecord())
    await openTab(k, 'Sell in CRM')
    await fill(k, 'Currency', 'EUR')
    assert.ok(k.bodyText().includes('was taken off'))
    await fill(k, 'Tax rate', '5')
    assert.ok(!k.bodyText().includes('was taken off'))
  })

  it('keeps a stored rate that is for another currency visible and marked, never silently hidden (the server still judges it on save)', async () => {
    const { k } = await editForm(fullRecord({ sell: sellRow({ currency: 'USD', taxRateId: 3 }) }))
    await openTab(k, 'Sell in CRM')
    const options = optionsOf(k, 'Tax rate')
    assert.ok(options.some((o) => o.includes('GST (18%)') && o.includes('for INR, not USD')), `the rate is shown and marked: ${options.join(' | ')}`)
    assert.equal((controlOf(k, 'Tax rate') as HTMLSelectElement).value, '3')
  })

  it('treats an empty currency as the default currency for the tax list', async () => {
    const { k } = await editForm(fullRecord({ sell: sellRow({ currency: null, taxRateId: null, taxRateName: null, taxPercent: null }) }))
    await openTab(k, 'Sell in CRM')
    assert.deepEqual(optionsOf(k, 'Tax rate'), ['Default', 'GST (18%)', 'GST (5%)', 'Exempt (0%)'])
  })
})

describe('the Sell section: the live price card', () => {
  afterEach(disposeAll)

  it('says "No price yet" until a price is typed, with the currency\'s badge', async () => {
    const { k } = await openForm('create-sub-product')
    await startSelling(k)
    assert.ok(cardText(k).includes('No price yet'), cardText(k))
    assert.ok(cardText(k).includes('INR') && cardText(k).includes('Indian Rupee'), 'the card names the currency')
    assert.ok(k.one('section[aria-label="Price with tax"] [aria-hidden="true"]')!.textContent === '₹', 'and draws its badge')
  })

  it('shows "Price 1,000.00 + GST 18% 180.00 = Total 1,180.00" as the price and the rate are typed and chosen', async () => {
    const { k } = await openForm('create-sub-product')
    await startSelling(k)
    await fill(k, 'Unit price', '1000')
    assert.ok(cardText(k).includes('Price 1,000.00'), cardText(k))
    assert.ok(cardText(k).includes('No tax is added'), 'with no rate there is no tax line')
    assert.ok(!cardText(k).includes('Total'), 'and no total of its own')
    await fill(k, 'Tax rate', '3')
    const text = cardText(k)
    for (const part of ['Price 1,000.00', 'GST 18% 180.00', 'Total 1,180.00']) assert.ok(text.includes(part), `${part}: ${text}`)
    assert.ok(!text.includes('No tax is added'))
  })

  it('writes the rupee with Indian grouping and the dollar with international grouping', async () => {
    const { k } = await openForm('create-sub-product')
    await startSelling(k)
    await fill(k, 'Unit price', '2499000')
    await fill(k, 'Tax rate', '3')
    assert.ok(cardText(k).includes('Total 29,48,820.00'), cardText(k))
    await fill(k, 'Currency', 'USD')
    await fill(k, 'Tax rate', '6')
    assert.ok(cardText(k).includes('Total 2,698,920.00'), cardText(k))
  })

  it('follows the currency\'s digits: a yen price has none', async () => {
    const { k } = await openForm('create-sub-product')
    await startSelling(k)
    await fill(k, 'Currency', 'JPY')
    await fill(k, 'Unit price', '1050')
    await fill(k, 'Tax rate', '7')
    assert.ok(cardText(k).includes('Price 1,050'), cardText(k))
    assert.ok(!cardText(k).includes('1,050.00'))
  })

  it('asks for a number when the price is not one, and never shows a total made of it', async () => {
    const { k } = await openForm('create-sub-product')
    await startSelling(k)
    await fill(k, 'Unit price', '1,500')
    assert.ok(cardText(k).includes('Enter the price as a number'), cardText(k))
    assert.ok(!cardText(k).includes('Total'))
  })

  it('goes back to "No price yet" when the price is emptied, and a price of 0 is a price', async () => {
    const { k } = await openForm('create-sub-product')
    await startSelling(k)
    await fill(k, 'Unit price', '0')
    assert.ok(cardText(k).includes('Price 0.00'), 'free is a price')
    await fill(k, 'Unit price', '')
    assert.ok(cardText(k).includes('No price yet'))
  })

  it('shows the saved price and rate of a record, and the form has no word about a price book', async () => {
    const { k } = await editForm(fullRecord())
    await openTab(k, 'Sell in CRM')
    for (const part of ['Price 1,500.00', 'GST 18% 270.00', 'Total 1,770.00']) assert.ok(cardText(k).includes(part), `${part}: ${cardText(k)}`)
    assert.equal(/price books?/i.test(k.bodyText()), false)
  })

  it('has no accessibility violation on the Sell section, with a price, a rate and a note about a dropped rate', async () => {
    const { k } = await editForm(fullRecord())
    await openTab(k, 'Sell in CRM')
    await fill(k, 'Currency', 'EUR')
    assert.deepEqual(await axeViolations(k.one('[role="dialog"]')!), [])
    await fill(k, 'Tax rate', '5')
    assert.deepEqual(await axeViolations(k.one('[role="dialog"]')!), [])
  })
})

// ============================================================================================================================ the Details tab

describe('the Details tab: the same card, read only', () => {
  afterEach(disposeAll)

  async function openDetails(world: World = {}) {
    const k = await kit()
    const router = await routerHarness('', '/portfolio/products/11')
    const calls = await installWorld(k, { record: fullRecord(), ...world })
    const { SubProductPage } = await import('../../components/domain/portfolio/sub-product-page')
    await k.render(router.wrap(k.h(SubProductPage, { id: '11', onBack: () => {} })))
    await k.tick(80)
    await openTab(k, 'Details')
    return { k, calls }
  }

  it('shows Price 1,500.00 + GST 18% 270.00 = Total 1,770.00 with the rupee badge, and nothing to type into', async () => {
    const { k } = await openDetails()
    const text = cardText(k)
    for (const part of ['Price 1,500.00', 'GST 18% 270.00', 'Total 1,770.00', 'INR', 'Indian Rupee']) assert.ok(text.includes(part), `${part}: ${text}`)
    assert.equal(k.all('section[aria-label="Price with tax"] input, section[aria-label="Price with tax"] select, section[aria-label="Price with tax"] button').length, 0, 'read only')
    assert.deepEqual(await axeViolations(k.one('section[aria-label="Price with tax"]')!), [])
  })

  it('says "No price yet" for a Sub-product with no price, and shows the price alone for one with no tax rate', async () => {
    const none = await openDetails({ record: fullRecord({ sell: sellRow({ unitPrice: null }) }) })
    assert.ok(cardText(none.k).includes('No price yet'))
    await disposeAll()
    const bare = await openDetails({ record: fullRecord({ sell: sellRow({ taxRateId: null, taxRateName: null, taxPercent: null }) }) })
    assert.ok(cardText(bare.k).includes('Price 1,500.00') && cardText(bare.k).includes('No tax is added'))
  })

  it('draws a legacy currency as typed with the neutral badge, and never as a symbol', async () => {
    const { k } = await openDetails({ record: fullRecord({ sell: sellRow({ currency: 'Rs', taxRateId: null, taxPercent: null, taxRateName: null }) }) })
    const card = k.one('section[aria-label="Price with tax"]')!
    assert.ok((card.textContent ?? '').includes('Rs'))
    assert.ok((card.textContent ?? '').includes('not in the list'))
    assert.ok(!(card.textContent ?? '').includes('₹'))
    assert.ok(k.bodyText().includes('Rs 1,500.00'), 'the unit price row writes it as typed')
  })

  it('says nothing about price books: no word, no link, and the old "base price" sentence is gone', async () => {
    const { k } = await openDetails()
    assert.equal(/price books?/i.test(k.bodyText()), false)
    assert.equal(k.bodyText().includes('base price'), false)
    assert.equal(k.all('a').some((a) => (a.getAttribute('href') ?? '').includes('price-books')), false)
  })
})

// ============================================================================================================================ the Product page

const BLOCK_INR: PmPriceTotal = { currency: 'INR', subtotal: 12500, tax: 2250, total: 14750, counted: 5, uncounted: 2 }
const BLOCK_USD: PmPriceTotal = { currency: 'USD', subtotal: 2000, tax: 160, total: 2160, counted: 1, uncounted: 2 }

describe('the Product page: the total card', () => {
  afterEach(disposeAll)

  async function openProduct(world: World = {}) {
    const k = await kit()
    const router = await routerHarness('', '/portfolio/scholarclone')
    const rows: PmListRow[] = [listRow({ unitPrice: 1500, currency: 'INR' }), listRow({ id: 12, name: 'Admissions', key: 'scholarclone/sch-12', unitPrice: 20, currency: 'USD' })]
    const calls = await installWorld(k, { listRows: rows, record: productRecord({ priceTotals: [BLOCK_INR] }), ...world })
    const { portfolioService } = await import('../../services/portfolio/portfolio-service')
    Object.assign(portfolioService, { getProducts: async () => portfolioProducts() })
    const { ProductDetailView } = await import('../../components/domain/portfolio/product-detail-view')
    await k.render(router.wrap(k.h(ProductDetailView, { context: { token: 'test-token', subInstituteId: '1', syear: '', userId: '2', organizationId: '', orgType: '', profileId: '1' } as never, productKey: 'scholarclone' })))
    await k.tick(80)
    await openTab(k, 'Sub-products')
    return { k, calls }
  }
  const totalText = (k: Kit): string => wordsOf(k.one('section[aria-label="Total of the Sub-products"]'))

  it('shows "Price 12,500.00 + Tax 2,250.00 = Total 14,750.00, from 5 of 7 Sub-products" with the badge, and the Sub-products that have no price yet', async () => {
    const { k, calls } = await openProduct()
    assert.deepEqual(calls.get, [1], 'the Product\'s own record carries the total')
    const text = totalText(k)
    for (const part of ['INR', 'Price 12,500.00', 'Tax 2,250.00', 'Total 14,750.00', 'from 5 of 7 Sub-products', '2 Sub-products have no price yet']) assert.ok(text.includes(part), `${part}: ${text}`)
    assert.ok(k.one('section[aria-label="Total of the Sub-products"] [aria-hidden="true"]')!.textContent === '₹')
    assert.deepEqual(await axeViolations(k.one('section[aria-label="Total of the Sub-products"]')!), [])
  })

  it('shows one block per currency, each with its own badge and digits', async () => {
    const { k } = await openProduct({ record: productRecord({ priceTotals: [BLOCK_INR, BLOCK_USD] }) })
    const blocks = k.all('section[aria-label="Total of the Sub-products"] li')
    assert.equal(blocks.length, 2)
    assert.ok(wordsOf(blocks[0]).includes('Total 14,750.00') && wordsOf(blocks[0]).includes('from 5 of 8 Sub-products'), wordsOf(blocks[0]))
    assert.ok(wordsOf(blocks[1]).includes('Total 2,160.00') && wordsOf(blocks[1]).includes('US Dollar'), wordsOf(blocks[1]))
    assert.equal(k.all('section[aria-label="Total of the Sub-products"] p[role="status"]').length, 1, 'the sentence about the unpriced ones is said once, not once per currency')
  })

  it('says "1 Sub-product has no price yet" for one, and nothing at all about it for none', async () => {
    const one = await openProduct({ record: productRecord({ priceTotals: [{ ...BLOCK_INR, uncounted: 1 }] }) })
    assert.ok(totalText(one.k).includes('1 Sub-product has no price yet'))
    await disposeAll()
    const none = await openProduct({ record: productRecord({ priceTotals: [{ ...BLOCK_INR, counted: 7, uncounted: 0 }] }) })
    assert.ok(totalText(none.k).includes('from 7 of 7 Sub-products'))
    assert.ok(!totalText(none.k).includes('no price yet'))
  })

  it('draws no card when the server sent no totals (nothing priced, or a person who may not view prices)', async () => {
    for (const priceTotals of [[], undefined]) {
      const { k } = await openProduct({ record: productRecord({ priceTotals }) })
      assert.equal(k.one('section[aria-label="Total of the Sub-products"]'), null, `no card for ${JSON.stringify(priceTotals)}`)
      assert.ok(!k.bodyText().includes('no price yet'))
      await disposeAll()
    }
  })

  it('still opens the page when the record cannot be read: the total is a nicety', async () => {
    const { k } = await openProduct({ record: null })
    assert.equal(k.one('section[aria-label="Total of the Sub-products"]'), null)
    assert.ok(k.bodyText().includes('Fee Collection'), 'the Sub-products are listed')
  })

  it('shows the Price column of the Sub-products with the badge of each price\'s own currency', async () => {
    const { k } = await openProduct()
    const cells = k.all('tbody tr').map((tr) => tr.textContent ?? '')
    assert.ok(cells.some((t) => t.includes('Fee Collection') && t.includes('₹1,500.00')), cells.join(' | '))
    assert.ok(cells.some((t) => t.includes('Admissions') && t.includes('$20.00')))
    assert.ok(k.all('tbody [role="img"]').some((b) => b.getAttribute('aria-label') === 'US Dollar (USD)'), 'each price carries its currency badge')
  })
})

// ============================================================================================================================ the Usage tab and the redirect words

describe('the Usage tab without price books', () => {
  afterEach(disposeAll)

  it('has no Price books card, empty state, button or link, whatever the Usage answer holds', async () => {
    const k = await kit()
    const router = await routerHarness('', '/portfolio/products/11')
    const answer = { signals: 4, icp: 'active', quotes: 2, basePrice: 1500, currency: 'INR', counts: { quotes: 2, priceBooks: 5 }, pointers: null, latest: null }
    await installWorld(k, { record: fullRecord(), usage: answer as never })
    const { SubProductPage } = await import('../../components/domain/portfolio/sub-product-page')
    await k.render(router.wrap(k.h(SubProductPage, { id: '11', onBack: () => {} })))
    await k.tick(80)
    await openTab(k, 'Usage')
    await k.tick(30)
    const text = k.bodyText()
    assert.ok(text.includes('Where it is used'))
    assert.equal(/price books?/i.test(text), false, 'not even a count of them, if an older server still sends one')
    assert.equal(k.all('a').some((a) => (a.getAttribute('href') ?? '').includes('price-books')), false)
  })
})
