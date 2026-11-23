import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { adminRows, ADMIN_CAN, envelope, HR_CAN, hrRows, SALES_CAN } from './fixtures'
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
    for (const word of ['SKU', 'Price', 'Category', 'In stock', 'Sold in CRM', 'INR', 'Unit Price', 'Qty In Stock']) assert.ok(!text().includes(word), `HR sees "${word}"`)
    assert.deepEqual(heads(), ['', 'Name', 'Type', 'Readiness', 'Signals', 'ICP'])
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
