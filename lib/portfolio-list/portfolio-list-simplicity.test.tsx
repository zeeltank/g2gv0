import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { aboutOnly, adminRows, ADMIN_CAN, envelope, HR_CAN, hrRows, product, SALES_CAN, sold } from './fixtures'
import { setup, type SetupOptions } from './screen-setup'

/**
 * "Less confusing" (slice 15, plan section 3a and the approved mock-up, views 1 and 2; the owner's words of 23 Nov 2026 about the live Products screen with its
 * Catalogue | Product lines switch, five top buttons, "Views", Unit Price and Qty In Stock). The whole list screen is mounted in a fake browser and asked, as a person
 * would look at it: how many actions are in the header, where the rest went, is there any switch between two views, are the states words, what does HR see, and does
 * any retired word appear in any state of the page. Each rule here is one the owner asked for; the mutation table of this file is in
 * Docs/agentic-crm/_evidence/s15/wpc-mutations-simplicity-2026-11-23.txt.
 */

const RETIRED = /(?<![\w-])(catalogues?|catalogs?|offers?|items?|product[ -]lines?|views?|refresh)(?![\w-])/i
const MORE_ITEMS = ['Import CSV', 'Sync Excel', 'Export CSV', 'Find duplicates', 'Recycle Bin']

describe('three actions in the header, the rest under More', () => {
  let current: Awaited<ReturnType<typeof setup>> | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })
  const open = async (opts: SetupOptions = {}) => { current = await setup(opts); return current }
  /** What the header offers, left to right: its buttons and links. */
  const headerActions = () => Array.from(current!.k.one('header')!.querySelectorAll('button, a')).map((el) => el.textContent?.trim())

  it('shows an administrator exactly three: More, Add product and Add sub-product, in the order of the mock-up, and nothing else in the header', async () => {
    await open()
    assert.deepEqual(headerActions(), ['More', 'Add product', 'Add sub-product'])
  })

  it('makes Add sub-product the one primary action and the other two plain outlines', async () => {
    await open()
    const [more, addProduct, addSub] = Array.from(current!.k.one('header')!.querySelectorAll('button')) as HTMLElement[]
    assert.match(more.className, /border-input/, 'More is an outline')
    assert.match(addProduct.className, /border-input/, 'Add product is an outline')
    assert.match(addSub.className, /\bbg-primary\b/, 'Add sub-product is the filled, primary button')
    assert.doesNotMatch(addSub.className, /border-input/, 'and not an outline')
  })

  it('keeps Import CSV, Sync Excel, Export CSV, Find duplicates and Recycle Bin out of sight until More is opened, and has all five inside it', async () => {
    await open()
    for (const word of MORE_ITEMS) assert.ok(!current!.text().includes(word), `${word} is not on the page before More is opened`)
    assert.ok(!current!.k.all('button, a').some((el) => MORE_ITEMS.includes(el.textContent?.trim() ?? '')), 'and not as a button or a link')
    await current!.openMore()
    assert.deepEqual(current!.menuItems().map((m) => m.textContent?.trim()), MORE_ITEMS)
  })

  it('offers Add product to administrators only: a seller gets More and Add sub-product, HR gets Sync Excel under More and Add sub-product', async () => {
    await open({ rows: adminRows(), can: SALES_CAN, canManage: false })
    assert.deepEqual(headerActions(), ['More', 'Add sub-product'], 'a seller')
    await disposeAll()
    current!.restore()
    await open({ rows: hrRows(), can: HR_CAN, canManage: true })
    assert.deepEqual(headerActions(), ['More', 'Add sub-product'], 'HR, who manages the Portfolio')
    await disposeAll()
    current!.restore()
    await open({ rows: hrRows(), can: HR_CAN, canManage: false })
    assert.deepEqual(headerActions(), ['Add sub-product'], 'HR with nothing to put under More: no empty menu')
  })

  it('draws no action at all for a person who may add and manage nothing', async () => {
    await open({ rows: hrRows(), can: { ...HR_CAN, createSubProduct: false, editSubProduct: false }, canManage: false })
    assert.deepEqual(headerActions(), [])
  })

  it('shows the bulk bar only when rows are ticked (Reassign and Delete are not among the header actions)', async () => {
    await open()
    assert.ok(!current!.text().includes('selected'), 'no bar before anything is ticked')
    assert.ok(!current!.k.all('button').some((b) => ['Reassign', 'Delete (to the Recycle Bin)'].includes(b.textContent?.trim() ?? '')))
    const box = current!.rowOf('Fees Intelligence')!.querySelector('input[type="checkbox"]') as HTMLInputElement
    await current!.k.click(box)
    await current!.k.tick(20)
    assert.ok(current!.text().includes('1 selected'))
    assert.ok(current!.button('Reassign') && current!.button('Delete (to the Recycle Bin)'), 'ticking brings the bar')
  })
})

describe('one list, no second view', () => {
  let current: Awaited<ReturnType<typeof setup>> | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })

  it('has no switch between two views: no tabs, no radio group, no Catalogue | Product lines toggle, no Views, no Refresh', async () => {
    current = await setup()
    const { k, text } = current
    assert.equal(k.all('[role="tablist"], [role="tab"], [role="radiogroup"], [role="radio"]').length, 0, 'no tab or radio switch on the page')
    for (const word of ['Catalogue', 'Product lines', 'Product line', 'Views', 'View', 'Refresh', 'Saved views']) assert.ok(!k.all('button, a, [role="tab"]').some((el) => el.textContent?.trim() === word), `no ${word} control`)
    assert.ok(!RETIRED.test(text()), `no retired word on the page: ${text().match(RETIRED)?.[0]}`)
    assert.equal(k.all('table').length, 1, 'one table: Products with their Sub-products under them')
  })

  it('puts the filters in one row that wraps: Product, Type, Sold in CRM, Readiness, Status and the page size, after the search', async () => {
    current = await setup()
    const { k } = current
    const selects = k.all('select')
    const toolbar = selects[0].closest('div.flex-wrap')!
    for (const select of selects) assert.equal(select.closest('div.flex-wrap'), toolbar, 'every filter is in the same wrapping row')
    const labels = selects.map((s) => k.w.document.querySelector(`label[for="${s.id}"]`)?.textContent)
    assert.deepEqual(labels, ['Product', 'Type', 'Sold in CRM', 'Readiness', 'Status', 'Page size'])
    assert.ok(toolbar.querySelector('input'), 'the search is in the same row')
  })

  it('has no filter called Catalogue, Item, Offer or Product line, and no option that says one', async () => {
    current = await setup()
    const words = current.k.all('select option, label').map((el) => el.textContent ?? '')
    assert.ok(!words.some((w) => RETIRED.test(w)), `a filter or option carries a retired word: ${words.find((w) => RETIRED.test(w))}`)
  })
})

describe('the same list inside Market Signals (the Product Portfolio tab) and on its own (the module)', () => {
  let current: Awaited<ReturnType<typeof setup>> | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })

  it('on its own it draws its title; inside Market Signals the Signals header names the page, so it draws only its description and its actions', async () => {
    current = await setup()
    assert.equal(current.k.one('h1')!.textContent, 'Product Portfolio', 'the module page has its own title')
    current.restore()
    await disposeAll()
    current = await setup({ embedded: true })
    assert.equal(current.k.all('h1').length, 0, 'no second title under the Signals header')
    assert.ok(current.text().includes('Every product and the sub-products under it'), 'the description stays')
    assert.deepEqual(Array.from(current.k.all('button')).map((b) => b.textContent?.trim()).slice(0, 3), ['More', 'Add product', 'Add sub-product'], 'and so do the three actions, first on the page')
    assert.equal(current.k.all('tr[data-group]').length >= 3, true, 'and the same list is under it')
  })
})

describe('a list that reads as sections: each Product a band, its Sub-products the rows under it', () => {
  let current: Awaited<ReturnType<typeof setup>> | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })

  // Owner, 23 Nov 2026, from screenshots of the live list: "the product / sub-product hierarchy looks confusing, clumsy, mixed, no separation".
  it('draws each Product as a solid band with an accent on its left edge, a heavier rule above it and its count and action on the right, never as a row like the others', async () => {
    current = await setup()
    const groups = current.k.all('tr[data-group]')
    assert.ok(groups.length >= 3)
    for (const tr of groups) {
      assert.match(tr.className, /(^|\s)bg-muted(\s|$)/, 'a solid band, not a faint tint (bg-muted/40)')
      assert.match(tr.className, /border-l-primary/, 'with an accent on its left edge')
      assert.match(tr.className, /border-t-2/, 'and a heavier rule above it')
    }
    const scholar = current.rowOf('ScholarClone')!
    assert.ok(scholar.querySelector('span.ml-auto')?.textContent?.includes('3 sub-products'), 'the count sits on the right, away from the name and its labels')
    assert.ok(scholar.querySelector('span.ml-auto button'), 'and so does its one action')
  })

  it('draws a Sub-product under its Product with an elbow line before its name, and no Product band has one', async () => {
    current = await setup()
    const { k, rowOf } = current
    for (const name of ['Fees Intelligence', 'Scholar School ERP', 'ScholarClone Implementation']) assert.ok(rowOf(name)!.querySelector('td span[aria-hidden="true"].border-l-2'), `${name} has the elbow`)
    assert.equal(k.all('tr[data-group] span[aria-hidden="true"].border-l-2').length, 0, 'a Product band has none')
  })

  it('has no Type column (a Sub-product under a Product needs no label on every row) and labels only a Service', async () => {
    current = await setup()
    const { heads, rowOf } = current
    assert.ok(!heads().includes('Type'))
    assert.ok(!rowOf('Fees Intelligence')!.textContent!.includes('Sub-product'), 'no row repeats the word Sub-product')
    assert.ok(rowOf('ScholarClone Implementation')!.textContent!.includes('Service'), 'a Service is labelled')
    assert.ok(!rowOf('Fees Intelligence')!.textContent!.includes('Service'))
  })

  it('gives every column heading one look: the sort buttons take the cell\'s capitals and the one sorted by is darker', async () => {
    current = await setup()
    const sortButtons = current.k.all('thead th button')
    assert.ok(sortButtons.length >= 3)
    for (const b of sortButtons) {
      assert.match(b.className, /\buppercase\b/)
      assert.doesNotMatch(b.className, /normal-case/)
    }
    assert.match(sortButtons.find((b) => b.textContent?.trim() === 'Name')!.className, /text-foreground/, 'the sorted-by heading is darker')
  })

  it('draws nothing in the Sell cells of a Sub-product that is not sold, and a dash where a SOLD one has a gap', async () => {
    // the second row carries the Sell keys with nothing in them (what the API sends a caller who may view Sell for a record with no Sell side)
    const keysWithNothing = aboutOnly({ id: 33, name: 'Keys but no Sell side', sku: null, unitPrice: null, category: null, qtyInStock: null, currency: null, hasSell: false })
    current = await setup({ rows: [product(), sold({ id: 31, name: 'Sold without a category', category: null }), aboutOnly({ id: 32, name: 'Not sold yet' }), keysWithNothing] })
    const cells = (name: string) => Array.from(current!.rowOf(name)!.querySelectorAll('td'))
    // td: tick, name, SKU, Price, Category, In stock, Sold in CRM, Readiness, Signals, ICP
    for (const name of ['Not sold yet', 'Keys but no Sell side']) {
      assert.deepEqual(cells(name).slice(2, 6).map((td) => td.textContent?.trim()), ['', '', '', ''], `${name}: no dashes in SKU, Price, Category, In stock`)
    }
    assert.equal(cells('Sold without a category')[4]!.textContent?.trim(), '—', 'a sold one with no category shows the gap')
  })
})

describe('plain words, not codes', () => {
  let current: Awaited<ReturnType<typeof setup>> | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })

  it('says the state of a Sub-product as a word (Sold, Paused, Not sold), never as an API code', async () => {
    current = await setup()
    const { k, rowOf, text } = current
    const stateOf = (name: string) => rowOf(name)!.textContent!
    assert.ok(stateOf('Fees Intelligence').includes('Sold'))
    assert.ok(stateOf('ScholarClone Implementation').includes('Paused'))
    assert.ok(stateOf('Scholar School ERP').includes('Not sold'))
    assert.equal(/[a-z]+_[a-z]+/.test(text()), false, `a code with an underscore is on the page: ${text().match(/[a-z]+_[a-z]+/)?.[0]}`)
    for (const code of ['sub_product', 'not_sold', 'needs_product', 'MATCH-HIGH']) assert.ok(!text().includes(code), `${code} is not on the page`)
    assert.ok(k.all('tbody tr').length > 0)
  })

  it('names a Product\'s own state in words too: "Shared, read only", "N sub-products", "No product yet"', async () => {
    current = await setup()
    assert.ok(current.text().includes('Shared, read only'))
    assert.ok(current.text().includes('3 sub-products'))
    assert.ok(current.text().includes('No product yet'))
  })

  it('shows HR no price, SKU, category or stock, anywhere on the page, in the menu or in an address', async () => {
    current = await setup({ rows: hrRows(), can: HR_CAN, canManage: true })
    const { k, text, heads, openMore } = current
    for (const word of ['SKU', 'Price', 'Category', 'In stock', 'Sold in CRM', 'INR', '₹', 'Unit Price', 'Qty In Stock']) assert.ok(!text().includes(word), `HR sees "${word}"`)
    assert.deepEqual(heads(), ['', 'Name', 'Readiness', 'Signals', 'ICP'])
    // caller check (23 Nov): a price cell drawn for a person who may not see prices would be an extra column with no heading (the rows carry no price, so it shows a dash)
    const sub = k.all('tbody tr').find((row) => row.querySelectorAll('td').length > 1)
    assert.ok(sub !== undefined, 'the table has a Sub-product row')
    assert.equal(sub!.querySelectorAll('td').length, heads().length, 'a Sub-product row has exactly as many cells as the table has headings: no stray price column for HR')
    await openMore()
    assert.ok(!text().includes('Export CSV') && !text().includes('Import CSV'), 'and the Products actions are not in the menu')
    assert.equal(k.all('a[href*="export"]').length, 0, 'no export link for a person who may not see prices')
  })
})

describe('no retired word in any state of the page', () => {
  let current: Awaited<ReturnType<typeof setup>> | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })

  const states: ReadonlyArray<readonly [string, SetupOptions]> = [
    ['the list', {}],
    ['the list with a search that finds nothing', { rows: [], search: 'q=zzz' }],
    ['the empty organisation', { rows: [] }],
    ['the loading state', { list: () => new Promise(() => undefined) }],
    ['a failed read', { list: () => ({ __status: 500, status: 0, message: 'The database is down.' }) }],
    ['a person without access', { list: () => ({ __status: 403, status: 0, message: 'No.' }) }],
    ['a server without the Product database', { list: () => envelope([], ADMIN_CAN, { available: false, total: 0 }) }],
    ['the list as HR', { rows: hrRows(), can: HR_CAN }],
    ['the list as a seller', { rows: adminRows(), can: SALES_CAN, canManage: false }],
  ]
  for (const [name, opts] of states) {
    it(`${name}: no Catalogue, Offer, Item, Product line, View or Refresh in the words`, async () => {
      current = await setup(opts)
      assert.ok(!RETIRED.test(current.text()), `a retired word: ${current.text().match(RETIRED)?.[0]}`)
    })
  }

  it('the Product page of a Sub-product group header and the bulk bar say Sub-product, not Item, when rows are ticked', async () => {
    current = await setup()
    const box = current.rowOf('Fees Intelligence')!.querySelector('input[type="checkbox"]') as HTMLInputElement
    await current.k.click(box)
    await current.k.tick(20)
    await current.k.click(current.button('Delete (to the Recycle Bin)')!)
    await current.k.tick(40)
    assert.ok(!RETIRED.test(current.text()), `a retired word: ${current.text().match(RETIRED)?.[0]}`)
    assert.ok(current.text().includes('Delete 1 sub-product from CRM?'))
  })
})
