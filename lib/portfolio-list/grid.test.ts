import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  cardRows, gridCards, gridSortChoices, gridSortNote, gridSortValue, ICP_CHIP_WORD, INLINE_LIMIT, INLINE_SHOWN, pageHasTickable, parseGridSort, productChips, rowPrice,
  rowPriceHidden, signalsText, subProductChips, subProductCountText,
} from './grid'
import { displayItems } from './model'
import { ADMIN_CAN, adminRows, aboutOnly, entry, HR_CAN, hrRows, product, SALES_CAN, service, shared, sold, stray } from './fixtures'
import type { PortfolioCan, PortfolioRow } from '../../services/product-master/portfolio-list-types'

/**
 * The grid model: how the groups of one page become cards, what a card shows, the chips on it, and the sort choices of the grid. The page is the one the table draws
 * (`displayItems`), so a card and a table group can never disagree about which row belongs under which Product.
 */

const cardsOf = (rows: PortfolioRow[], can: PortfolioCan = ADMIN_CAN, page = 1) => gridCards(displayItems(rows, page), can)
const many = (n: number, over: Partial<PortfolioRow> = {}): PortfolioRow[] => Array.from({ length: n }, (_, i) => aboutOnly({ id: 100 + i, name: `Sub ${i + 1}`, key: `scholarclone/s${i + 1}`, ...over }))

describe('one card for each group of the page', () => {
  it('makes a card of each Product with its Sub-products inside, and one for the strays, in the order of the page', () => {
    const cards = cardsOf(adminRows())
    assert.deepEqual(cards.map((c) => c.key), ['p:1', 'p:2', 'none'])
    assert.deepEqual(cards.map((c) => c.kind), ['product', 'product', 'no-product'])
    assert.deepEqual(cards.map((c) => c.title), ['ScholarClone', 'Enterprise Brain', 'No product yet'])
    assert.deepEqual(cards[0].subs.map((s) => s.row.name), ['Scholar School ERP', 'Fees Intelligence', 'ScholarClone Implementation'], 'the Sub-products sit inside their Product card')
    assert.deepEqual(cards[1].subs, [], 'a Product with no Sub-product on the page has none inside')
    assert.deepEqual(cards[2].subs.map((s) => s.row.name), ['Imported widget'])
  })

  it('loses no row: every Sub-product of the page is inside exactly one card', () => {
    const rows = adminRows()
    const cards = cardsOf(rows)
    const subRows = rows.filter((r) => r.kind !== 'product').map((r) => r.id)
    assert.deepEqual(cardRows(cards).map((r) => r.id), subRows)
  })

  it('opens a Product from its own page, and a card with no Product row of its own opens nothing', () => {
    const [scholar, brain, strays] = cardsOf(adminRows())
    assert.equal(scholar.href, '/portfolio/scholarclone')
    assert.equal(brain.href, '/portfolio/enterprise_brain')
    assert.equal(strays.href, null)
    assert.equal(scholar.subs[1].href, '/portfolio/products/11', 'a Sub-product opens its own page')
  })

  it('says what the Product itself says and nothing it does not: signals, the count, its ICP, and no description', () => {
    const [scholar] = cardsOf(adminRows())
    assert.equal(scholar.signals, '31 signals found')
    assert.equal(scholar.countText, '3 sub-products')
    assert.deepEqual(scholar.chips.map((c) => c.label), ['ICP in use'], 'a Product row with no readiness draws none (no "Not described" on every card)')
    assert.ok(!('description' in scholar), 'the list has no description field, so a card carries none')
  })

  it('draws a shared Product as read only, and an archived one as archived', () => {
    const cards = cardsOf([product({ id: 3, name: 'Retired Suite', key: 'retired', status: 'archived', subProductCount: 1 }), shared()])
    assert.deepEqual(cards[0].chips.map((c) => c.label), ['Archived', 'ICP in use'])
    assert.deepEqual(cards[1].chips.map((c) => c.label), ['Shared, read only', 'ICP in use'])
    assert.match(cards[1].chips[0].hint ?? '', /cannot be changed here/)
  })
})

describe('the Sub-products a card holds, and "+N more"', () => {
  it(`shows up to ${INLINE_LIMIT} Sub-products in full, with no "+N more"`, () => {
    for (const n of [1, 3, INLINE_LIMIT]) {
      const [card] = cardsOf([product({ subProductCount: n }), ...many(n)])
      assert.equal(card.shown.length, n, `${n} Sub-products are all drawn`)
      assert.equal(card.more, 0)
      assert.equal(card.openLabel, 'Open ScholarClone')
    }
  })

  it(`keeps the first ${INLINE_SHOWN} of more than ${INLINE_LIMIT} and counts the rest, so a lone "+1 more" never costs a row`, () => {
    const [five] = cardsOf([product({ subProductCount: 5 }), ...many(5)])
    assert.deepEqual(five.shown.map((s) => s.row.name), ['Sub 1', 'Sub 2', 'Sub 3'])
    assert.equal(five.more, 2)
    assert.equal(five.openLabel, 'Open ScholarClone, 2 more sub-products', 'a screen reader hears what the card leaves out')
    const [six] = cardsOf([product({ subProductCount: 6 }), ...many(6)])
    assert.equal(six.more, 3)
    assert.equal(five.subs.length, 5, 'the card still knows every Sub-product of the page')
  })

  it('never leaves exactly one Sub-product out: a card that could not show all of five shows three, not four', () => {
    assert.ok(INLINE_LIMIT - INLINE_SHOWN >= 1 && INLINE_SHOWN + 2 > INLINE_LIMIT, 'with these limits "+N more" is always N of 2 or more')
  })

  it('draws every Sub-product of a card that has no Product page to send a person to', () => {
    const [card] = cardsOf([...many(7, { productId: 1, productName: 'ScholarClone' })], ADMIN_CAN, 2)
    assert.equal(card.href, null)
    assert.equal(card.shown.length, 7, 'there is nowhere to open "the rest", so none is left out')
    assert.equal(card.more, 0)
    assert.equal(card.openLabel, null)
  })

  it('counts the Product by its own row, whatever is on the page', () => {
    const [card] = cardsOf([product({ subProductCount: 12 }), ...many(2)])
    assert.equal(card.countText, '12 sub-products')
    assert.equal(card.subs.length, 2)
  })
})

describe('a group that is only part of its Product', () => {
  it('marks the group a page begins inside as continued, drawn from the Product name its Sub-products carry', () => {
    const [card] = cardsOf([aboutOnly({ id: 40, name: 'Late Sub', productId: 1, productName: 'ScholarClone' }), sold({ id: 41, name: 'Later Sub' })], ADMIN_CAN, 2)
    assert.equal(card.continued, true)
    assert.equal(card.title, 'ScholarClone')
    assert.equal(card.product, null)
    assert.equal(card.note, 'Continued from the previous page')
    assert.equal(card.countText, null, 'without the Product row there is no count of its own to show')
    assert.deepEqual(card.chips, [])
  })

  it('does not call the first page continued, and says a card made without its Product row shows the matches only', () => {
    const [card] = cardsOf([service()], ADMIN_CAN, 1)
    assert.equal(card.continued, false)
    assert.equal(card.note, 'Showing the sub-products that match')
  })

  it('has no note on a whole Product, and tells the strays how to find their Product', () => {
    const [scholar, , strays] = cardsOf(adminRows())
    assert.equal(scholar.note, null)
    assert.equal(strays.note, 'Open one to choose its Product.')
  })

  it('never loses a Product row that shows up among a group\'s Sub-products: it gets a card of its own', () => {
    const cards = cardsOf([product(), aboutOnly(), product({ id: 9, name: 'Odd', key: 'odd' })])
    assert.deepEqual(cards.map((c) => c.title), ['ScholarClone', 'Odd'])
  })
})

describe('the chips of a Sub-product row: its own state and readiness', () => {
  it('shows an administrator the state in CRM and the readiness, in words, each row its own', () => {
    const [scholar] = cardsOf(adminRows())
    const chips = (name: string) => scholar.subs.find((s) => s.row.name === name)!.chips.map((c) => `${c.kind}:${c.label}`)
    assert.deepEqual(chips('Fees Intelligence'), ['state:Sold', 'readiness:Live – with client'])
    assert.deepEqual(chips('Scholar School ERP'), ['state:Not sold', 'readiness:Prototype'])
    assert.deepEqual(chips('ScholarClone Implementation'), ['service:Service', 'state:Paused'], 'a Service is labelled, and a row with no readiness draws none')
  })

  it('takes the colour of each from the same rules as the table, and never draws one by colour alone (the label is always there)', () => {
    const [scholar] = cardsOf(adminRows())
    const fees = scholar.subs.find((s) => s.row.name === 'Fees Intelligence')!
    assert.deepEqual(fees.chips.map((c) => c.tone), ['success', 'success'])
    for (const chip of cardsOf(adminRows()).flatMap((c) => [...c.chips, ...c.subs.flatMap((s) => s.chips)])) assert.ok(chip.label.length > 0, 'every chip has its word')
  })

  it('leaves the state in CRM to a caller who may view Sell, but keeps the readiness for everybody', () => {
    const [scholar] = cardsOf(hrRows(), HR_CAN)
    const fees = scholar.subs.find((s) => s.row.name === 'Fees Intelligence')!
    assert.deepEqual(fees.chips.map((c) => c.kind), ['readiness'])
  })

  it('marks an archived Sub-product and a shared one', () => {
    const chips = subProductChips(aboutOnly({ status: 'archived', shared: true }), ADMIN_CAN).map((c) => c.label)
    assert.deepEqual(chips, ['Archived', 'Shared, read only', 'Not sold', 'Prototype'])
  })

  it('says each ICP state as a phrase, since a chip has no column heading', () => {
    assert.deepEqual(Object.values(ICP_CHIP_WORD), ['ICP in use', 'ICP draft', 'ICP archived', 'ICP built in', 'No ICP yet'])
    assert.deepEqual(productChips(product({ icp: 'none' })).map((c) => c.label), ['No ICP yet'])
    assert.deepEqual(productChips(product({ icp: null })).map((c) => c.label), [], 'a Product with no ICP state draws no ICP chip')
  })
})

describe('what a card says about money', () => {
  it('shows a Sub-product\'s price when the caller may view Sell and the row carries one', () => {
    assert.deepEqual(rowPrice(sold(), SALES_CAN), { amount: 120000, currency: 'INR' })
    const [scholar] = cardsOf(adminRows())
    assert.deepEqual(scholar.subs.find((s) => s.row.name === 'Fees Intelligence')!.price, { amount: 120000, currency: 'INR' })
  })

  it('shows no price to a caller who may not view Sell, even for a row that carries one (the two checks are both made)', () => {
    assert.equal(rowPrice(sold(), HR_CAN), null)
    const [scholar] = cardsOf(adminRows(), HR_CAN)
    assert.deepEqual(scholar.subs.map((s) => s.price), [null, null, null])
    assert.equal(scholar.total, null)
  })

  it('shows none where the row carries no price: no Sell keys, or keys with nothing in them', () => {
    assert.equal(rowPrice(aboutOnly(), ADMIN_CAN), null)
    assert.equal(rowPrice(aboutOnly({ unitPrice: null, sku: null }), ADMIN_CAN), null)
    assert.equal(rowPrice(aboutOnly({ unitPrice: 0, currency: 'INR' }), ADMIN_CAN)?.amount, 0, 'a price of zero is a price')
  })

  it('says the price is not shown for a sold row of a type the caller may not view (its Sell keys are absent), and for no one else', () => {
    const noKeys = { ...sold({ id: 31, name: 'Hidden price one' }) } as Record<string, unknown>
    for (const key of ['sku', 'category', 'qtyInStock', 'unitPrice', 'currency']) delete noKeys[key]
    assert.equal(rowPriceHidden(noKeys as unknown as PortfolioRow, SALES_CAN), true)
    assert.equal(rowPriceHidden(noKeys as unknown as PortfolioRow, HR_CAN), false, 'a caller who may view no Sell is not told there is a price')
    assert.equal(rowPriceHidden(aboutOnly(), SALES_CAN), false, 'a row with no Sell side has no price to hide')
    assert.equal(rowPriceHidden(sold(), SALES_CAN), false)
  })

  it('totals a Product from the server\'s blocks, for a caller who may view Sell only', () => {
    const priced = product({ priceTotals: [{ currency: 'INR', subtotal: 100, tax: 18, total: 118, counted: 2, uncounted: 0 }, { currency: 'USD', subtotal: 5, tax: 0, total: 5, counted: 1, uncounted: 0 }] })
    const [withSell] = cardsOf([priced, sold()], ADMIN_CAN)
    assert.equal(withSell.total?.first.total, 118)
    assert.equal(withSell.total?.more.length, 1)
    const [without] = cardsOf([priced, sold()], HR_CAN)
    assert.equal(without.total, null)
    assert.equal(cardsOf([product()], ADMIN_CAN)[0].total, null, 'a Product with nothing priced has no total')
  })
})

describe('what a card lets a person do', () => {
  it('offers Add sub-product on a Product of the organisation\'s own that is active, to a caller who may add Sub-products', () => {
    const [scholar, brain] = cardsOf([product(), shared()])
    assert.equal(scholar.canAddSubProduct, true)
    assert.equal(brain.canAddSubProduct, false, 'a shared Product is read only')
    assert.equal(cardsOf([product({ status: 'archived' })])[0].canAddSubProduct, false, 'an archived one takes none')
    assert.equal(cardsOf([product()], { ...ADMIN_CAN, createSubProduct: false })[0].canAddSubProduct, false)
    assert.equal(cardsOf(adminRows())[2].canAddSubProduct, false, 'the strays have no Product to add under')
  })

  it('says which rows can be ticked and why not, the table\'s own rules', () => {
    const [scholar, , strays] = cardsOf(adminRows())
    assert.deepEqual(scholar.subs.map((s) => s.tickable), [true, true, true])
    assert.equal(strays.subs[0].tickable, true)
    const viewer = cardsOf(hrRows(), { ...HR_CAN, editSubProduct: false, createSubProduct: false })
    assert.equal(pageHasTickable(viewer), false, 'a person who may change nothing gets no tick boxes')
    assert.match(viewer[0].subs[0].whyNoTick ?? '', /may not change/)
    assert.equal(pageHasTickable(cardsOf(adminRows())), true)
  })

  it('does not tick a Sub-product of a shared Product', () => {
    const [card] = cardsOf([shared(), aboutOnly({ id: 50, name: 'Read only sub', productId: 2, productName: 'Enterprise Brain', shared: true })])
    assert.equal(card.subs[0].tickable, false)
    assert.match(card.subs[0].whyNoTick ?? '', /read only/)
  })
})

describe('the words of a card', () => {
  it('says signals and sub-products as a person would', () => {
    assert.equal(signalsText(31), '31 signals found')
    assert.equal(signalsText(1), '1 signal found')
    assert.equal(signalsText(0), 'No signals found yet', 'a real zero is said, not hidden')
    assert.equal(signalsText(null), null, 'nobody counted: nothing is said')
    assert.equal(signalsText(undefined), null)
    assert.equal(subProductCountText(3), '3 sub-products')
    assert.equal(subProductCountText(1), '1 sub-product')
    assert.equal(subProductCountText(0), 'No sub-products yet')
  })

  it('uses no word the screens retired, and no arrow, middle dot or capitals-only label, in anything it says', () => {
    const cards = cardsOf([...adminRows(), entry()])
    const words = cards.flatMap((c) => [c.title, c.note ?? '', c.countText ?? '', c.signals ?? '', c.openLabel ?? '', ...c.chips.map((x) => x.label), ...c.subs.flatMap((s) => s.chips.map((x) => x.label))])
    for (const word of words) {
      assert.doesNotMatch(word, /(?<![\w-])(catalogues?|offers?|items?|product[ -]lines?|views?)(?![\w-])/i, `a retired word: ${word}`)
      assert.doesNotMatch(word, /[→·]/, `an arrow or a middle dot: ${word}`)
    }
  })
})

describe('the sort of the grid', () => {
  it('offers the table\'s orders in words, and the price orders only to a caller who may view prices', () => {
    assert.deepEqual(gridSortChoices(true).map((c) => c.value), ['name:asc', 'name:desc', 'signals:desc', 'signals:asc', 'readiness:asc', 'readiness:desc', 'price:asc', 'price:desc'])
    assert.deepEqual(gridSortChoices(false).map((c) => c.value), ['name:asc', 'name:desc', 'signals:desc', 'signals:asc', 'readiness:asc', 'readiness:desc'])
    for (const choice of gridSortChoices(true)) assert.doesNotMatch(choice.label, /[→·—]/, 'plain words')
  })

  it('reads the address back as a choice, and a choice as the address\'s sort and direction', () => {
    for (const choice of gridSortChoices(true)) {
      assert.equal(gridSortValue(choice.sort, choice.dir, true), choice.value)
      assert.deepEqual(parseGridSort(choice.value, true), { sort: choice.sort, dir: choice.dir })
    }
  })

  it('falls back to Name, A to Z for an order the grid does not offer (a link with a price sort, opened by a person who may not view prices)', () => {
    assert.equal(gridSortValue('price', 'asc', false), 'name:asc')
    assert.equal(gridSortValue('weird', 'asc', true), 'name:asc')
    assert.deepEqual(parseGridSort('price:asc', false), { sort: 'name', dir: 'asc' })
    assert.deepEqual(parseGridSort('nonsense', true), { sort: 'name', dir: 'asc' })
  })

  it('explains what the sort moved when it is not the name', () => {
    assert.equal(gridSortNote('name'), null)
    assert.match(gridSortNote('signals') ?? '', /sub-products inside each product/)
    assert.match(gridSortNote('price') ?? '', /Products stay in order of name/)
  })
})

describe('a long page', () => {
  it('turns the rows of a 20-row page of five Products into five cards', () => {
    const rows: PortfolioRow[] = []
    for (let p = 1; p <= 5; p++) {
      rows.push(product({ id: p, name: `Product ${p}`, key: `p${p}`, subProductCount: 3 }))
      for (let s = 0; s < 3; s++) rows.push(aboutOnly({ id: p * 100 + s, name: `Sub ${p}.${s}`, key: `p${p}/s${s}`, productId: p, productName: `Product ${p}` }))
    }
    const cards = cardsOf(rows)
    assert.equal(cards.length, 5)
    assert.ok(cards.every((c) => c.subs.length === 3 && c.shown.length === 3 && c.more === 0))
  })
})
