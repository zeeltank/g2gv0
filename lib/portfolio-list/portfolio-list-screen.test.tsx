import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { ADMIN_CAN, adminRows, aboutOnly, envelope, HR_CAN, hrRows, product, SALES_CAN, sold, stray } from './fixtures'
import { setup } from './screen-setup'

/** The Product Portfolio list as a person uses it: the real component, the real service client, the address kept by a stand-in router, only the network faked. */

const FORBIDDEN = /\b(catalogue|catalog|offers?|items?|product lines?)\b/i

describe('the Product Portfolio list: what is on the page', () => {
  let current: Awaited<ReturnType<typeof setup>> | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })
  const open = async (opts: Parameters<typeof setup>[0] = {}) => { current = await setup(opts); return current }

  it('is a product page with its own title and NO Signals buttons (Company Opportunities, Ingestion Engine, Partner Network)', async () => {
    const { k, text } = await open()
    assert.equal(k.one('h1')!.textContent, 'Product Portfolio')
    for (const word of ['Company Opportunities', 'Ingestion Engine', 'Partner Network', 'Market Signals']) assert.ok(!text().includes(word), `the page shows no "${word}"`)
    assert.equal(k.all('a').filter((a) => /^\/(signals|ingestion|partners)/.test(a.getAttribute('href') ?? '')).length, 0, 'no link into a Signals page')
  })

  it('shows the Products as group headers with their Sub-products under them, and a "No product yet" group for strays', async () => {
    const { rowOf, k } = await open()
    const groups = k.all('tr[data-group]').map((tr) => tr.getAttribute('data-group'))
    assert.deepEqual(groups, ['p:1', 'p:2', 'none'])
    assert.ok(rowOf('ScholarClone')!.textContent!.includes('3 sub-products'))
    assert.ok(rowOf('Enterprise Brain')!.textContent!.includes('Shared, read only'))
    assert.ok(rowOf('No product yet')!.textContent!.includes('Open one to choose its Product.'))
    const order = k.all('tbody tr').map((tr) => tr.getAttribute('data-group') ?? tr.getAttribute('data-row'))
    assert.deepEqual(order, ['p:1', '10', '11', '15', 'p:2', 'none', '20'], 'a Product, then its Sub-products, then the next Product')
  })

  it('draws every column of mock-up view 2 for an administrator, plus Category and In stock (hidden below the large breakpoint)', async () => {
    const { heads, k } = await open()
    assert.deepEqual(heads(), ['', 'Name', 'Type', 'SKU', 'Price', 'Category', 'In stock', 'Sold in CRM', 'Readiness', 'Signals', 'ICP'])
    for (const th of k.all('thead th').filter((t) => ['Category', 'In stock'].includes(t.textContent ?? ''))) assert.match(th.className, /hidden[^"]*lg:table-cell/, `${th.textContent} is hidden on a narrow screen`)
  })

  it('shows a row\'s own values: type, SKU, price, state, readiness, signals and ICP, all in words', async () => {
    const { rowOf } = await open()
    const fees = rowOf('Fees Intelligence')!.textContent!
    for (const part of ['Sub-product', 'SCH-02', 'INR 1,20,000.00', 'School ERP', '12.5', 'Sold', 'Live – with client', '2', 'Draft']) assert.ok(fees.includes(part), `Fees Intelligence shows ${part}: ${fees}`)
    const svc = rowOf('ScholarClone Implementation')!.textContent!
    for (const part of ['Service', 'SVC-1', 'Paused']) assert.ok(svc.includes(part), part)
    assert.ok(rowOf('Scholar School ERP')!.textContent!.includes('Not sold'))
    assert.ok(rowOf('Scholar School ERP')!.textContent!.includes('Prototype'))
  })

  it('opens a Sub-product on its own page and a Product on /portfolio/{key}', async () => {
    const { k } = await open()
    const hrefOf = (name: string) => k.all('a').find((a) => a.textContent === name)?.getAttribute('href')
    assert.equal(hrefOf('Fees Intelligence'), '/portfolio/products/11')
    assert.equal(hrefOf('ScholarClone'), '/portfolio/scholarclone')
    assert.equal(hrefOf('Enterprise Brain'), '/portfolio/enterprise_brain')
  })

  it('says every word as Product or Sub-product: never Catalogue, Offer, Item or Product line (rendered text, every state of the page)', async () => {
    const { text, openMore } = await open()
    assert.ok(!FORBIDDEN.test(text()), `forbidden word on the page: ${text().match(FORBIDDEN)?.[0]}`)
    await openMore()
    assert.ok(!FORBIDDEN.test(text()), `forbidden word in the More menu: ${text().match(FORBIDDEN)?.[0]}`)
  })
})

describe('what a caller who may not view prices sees (HR)', () => {
  let current: Awaited<ReturnType<typeof setup>> | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })

  it('gets no SKU, Price, Category, In stock or Sold in CRM column, no Sold in CRM filter, and no bulk tick that can be set', async () => {
    current = await setup({ rows: hrRows(), can: HR_CAN })
    const { heads, text, facet, k } = current
    assert.deepEqual(heads(), ['', 'Name', 'Type', 'Readiness', 'Signals', 'ICP'])
    for (const word of ['SKU', 'Price', 'Category', 'In stock', 'Sold in CRM']) assert.ok(!heads().includes(word), `no ${word} column for HR`)
    assert.equal(facet('Sold in CRM'), undefined, 'no Sold in CRM filter for HR')
    assert.ok(facet('Status'), 'the other filters are there')
    assert.ok(!text().includes('INR'), 'no price anywhere on the page')
    assert.ok(!text().includes('120000') && !text().includes('1,20,000'), 'no price figure')
    assert.equal(k.all('tbody input[type="checkbox"]').filter((c) => !(c as HTMLInputElement).disabled).length, 0, 'HR can tick nothing: nothing in the list can be changed by a bulk action')
  })

  it('does not invite a search by SKU (the server does not search a SKU the caller may not see), and an administrator is invited to', async () => {
    const placeholder = (s: Awaited<ReturnType<typeof setup>>) => (s.k.all('input').find((i) => i.getAttribute('aria-label') === 'Search the portfolio') as HTMLInputElement).placeholder
    current = await setup({ rows: hrRows(), can: HR_CAN })
    assert.equal(placeholder(current), 'Search by name or ID…')
    await disposeAll()
    current.restore()
    current = await setup()
    assert.equal(placeholder(current), 'Search by name, ID or SKU…')
  })

  it('draws the Sell columns for a sales profile and an administrator (the same list, the API sent the keys)', async () => {
    current = await setup({ rows: adminRows(), can: SALES_CAN })
    assert.ok(current.heads().includes('Price') && current.heads().includes('Sold in CRM'))
  })

  it('shows "Not shown" where a row of a type the caller may not view has no Sell keys', async () => {
    const noKeys = { ...sold({ id: 31, name: 'Hidden price one' }) } as Record<string, unknown>
    for (const key of ['sku', 'category', 'qtyInStock', 'unitPrice', 'currency']) delete noKeys[key]
    current = await setup({ rows: [product(), noKeys as never, sold()], can: SALES_CAN })
    assert.ok(current.rowOf('Hidden price one')!.textContent!.includes('Not shown'))
    assert.ok(current.rowOf('Fees Intelligence')!.textContent!.includes('INR 1,20,000.00'))
  })
})

describe('the filters, the search and the order reach the server', () => {
  let current: Awaited<ReturnType<typeof setup>> | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })

  it('sends the default view: active records by name, page 1, 20 to a page, the bearer header, no other filter', async () => {
    current = await setup()
    const call = current.lastList()!
    assert.equal(call.method, 'GET')
    assert.ok(call.path.endsWith('/api/product-master/list') || call.path.endsWith('/product-master/list'), call.path)
    assert.deepEqual(Object.fromEntries(call.query), { status: 'active', sort: 'name', dir: 'asc', page: '1', per: '20' })
    assert.equal(call.headers.Authorization, 'Bearer test-token', 'the person comes from the token, never from a parameter')
  })

  it('sends each filter the person chooses: Product, Type, Sold in CRM, Readiness, Status and the page size', async () => {
    current = await setup()
    const { choose, lastList, router } = current
    await choose('Product', '1')
    assert.equal(lastList()!.query.get('productId'), '1')
    await choose('Type', 'service')
    assert.equal(lastList()!.query.get('type'), 'service')
    await choose('Sold in CRM', 'paused')
    assert.equal(lastList()!.query.get('sold'), 'paused')
    await choose('Readiness', 'Prototype')
    assert.equal(lastList()!.query.get('readiness'), 'Prototype')
    await choose('Status', 'archived')
    assert.equal(lastList()!.query.get('status'), 'archived')
    await choose('Page size', '50')
    assert.equal(lastList()!.query.get('per'), '50')
    const search = new URLSearchParams(router.lastSearch())
    for (const [name, value] of Object.entries({ product: '1', type: 'service', sold: 'paused', readiness: 'Prototype', status: 'archived', per: '50' })) assert.equal(search.get(name), value, `${name} is in the address`)
  })

  it('opens a link as it was written: ?type=service filters to services and shows the choice', async () => {
    current = await setup({ search: 'type=service&status=all&q=impl&sort=signals&dir=desc&page=2&per=50' })
    const { lastList, facet } = current
    assert.deepEqual(Object.fromEntries(lastList()!.query), { type: 'service', status: 'all', q: 'impl', sort: 'signals', dir: 'desc', page: '2', per: '50' })
    assert.equal(facet('Type')!.value, 'service')
    assert.equal(facet('Status')!.value, 'all')
  })

  it('offers the Products and the readiness words the server knows', async () => {
    current = await setup()
    const { facet } = current
    assert.deepEqual(Array.from(facet('Product')!.options).map((o) => o.textContent), ['All products', 'ScholarClone', 'G2G'])
    assert.deepEqual(Array.from(facet('Readiness')!.options).map((o) => o.textContent), ['Any readiness', 'Prototype', 'Live – with client', 'Deferred'])
  })

  it('sends the search after the person stops typing, and goes back to page 1', async () => {
    current = await setup({ search: 'page=3', total: 90, lastPage: 5 })
    const { k, lastList, router } = current
    const box = k.all('input').find((i) => i.getAttribute('aria-label') === 'Search the portfolio') as HTMLInputElement
    const set = Object.getOwnPropertyDescriptor(k.w.HTMLInputElement.prototype, 'value')!.set!
    await k.act(async () => { set.call(box, 'fees'); box.dispatchEvent(new k.w.Event('input', { bubbles: true })) })
    await k.tick(500)
    assert.equal(lastList()!.query.get('q'), 'fees')
    assert.equal(lastList()!.query.get('page'), '1')
    assert.ok(new URLSearchParams(router.lastSearch()).get('q') === 'fees')
  })

  it('sorts by a heading: Name, Readiness, Signals and Price, and a second click turns the order', async () => {
    current = await setup()
    const { k, lastList } = current
    const head = (label: string) => k.all('thead th button').find((b) => b.textContent?.trim() === label)!
    await k.click(head('Signals'))
    await k.tick(30)
    assert.equal(lastList()!.query.get('sort'), 'signals')
    assert.equal(lastList()!.query.get('dir'), 'asc')
    await k.click(head('Signals'))
    await k.tick(30)
    assert.equal(lastList()!.query.get('dir'), 'desc')
    await k.click(head('Price'))
    await k.tick(30)
    assert.equal(lastList()!.query.get('sort'), 'price')
    await k.click(head('Readiness'))
    await k.tick(30)
    assert.equal(lastList()!.query.get('sort'), 'readiness')
    assert.equal(k.all('thead th').find((t) => t.textContent?.trim() === 'Readiness')!.getAttribute('aria-sort'), 'ascending')
  })

  it('draws no Price heading for a caller who may not see prices, and a link that asks for the price order sorts by Name', async () => {
    current = await setup({ rows: hrRows(), can: HR_CAN, search: 'sort=price' })
    const { k } = current
    assert.ok(!k.all('thead th button').some((b) => b.textContent?.trim() === 'Price'))
    assert.equal(k.all('thead th').find((t) => t.textContent?.trim() === 'Name')!.getAttribute('aria-sort'), 'ascending', 'the heading says the list is in name order')
  })
})

describe('paging', () => {
  let current: Awaited<ReturnType<typeof setup>> | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })

  it('says where the person is and asks for the next page, then the previous one', async () => {
    current = await setup({ total: 45, lastPage: 3 })
    const { k, text, lastList, button } = current
    assert.ok(text().includes('45 results') && text().includes('Page 1 of 3'))
    assert.equal((button('Previous') as HTMLButtonElement).disabled, true)
    await k.click(button('Next')!)
    await k.tick(30)
    assert.equal(lastList()!.query.get('page'), '2')
    await k.click(button('Previous')!)
    await k.tick(30)
    assert.equal(lastList()!.query.get('page'), '1')
  })

  it('opens a page that is "continued" with its Product named, when the page begins inside a group', async () => {
    current = await setup({ rows: [aboutOnly(), sold()], search: 'page=2', total: 30, lastPage: 2 })
    assert.ok(current.rowOf('ScholarClone')!.textContent!.includes('continued from the previous page'))
  })

  it('goes to the last page when a link holds a page past the end', async () => {
    current = await setup({
      search: 'page=9',
      list: (query) => (query.get('page') === '9' ? envelope([], ADMIN_CAN, { total: 45, page: 9, lastPage: 3 }) : envelope(adminRows(), ADMIN_CAN, { total: 45, page: Number(query.get('page')), lastPage: 3 })),
    })
    assert.equal(current.lastList()!.query.get('page'), '3')
  })
})

describe('the states of the list', () => {
  let current: Awaited<ReturnType<typeof setup>> | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })

  it('says it is loading before the first answer arrives', async () => {
    current = await setup({ list: () => new Promise(() => undefined) })
    assert.ok(current.text().includes('Loading…'))
    assert.equal(current.k.all('table').length, 0)
  })

  it('says there is nothing yet (no filter) and offers the Add buttons, or only the words when the caller may add nothing', async () => {
    current = await setup({ rows: [] })
    assert.ok(current.text().includes('No products yet'))
    assert.ok(current.text().includes('Add a product or a sub-product to start.'))
    await disposeAll()
    current.restore()
    current = await setup({ rows: [], can: { ...HR_CAN, createSubProduct: false, editSubProduct: false } })
    assert.ok(current.text().includes('Nothing has been added yet.'))
  })

  it('says nothing matches a search or a filter and offers a way out that clears them', async () => {
    current = await setup({ rows: [], search: 'q=zzz&type=service' })
    const { text, button, lastList, k } = current
    assert.ok(text().includes('Nothing matches'))
    await k.click(button('Clear filters')!)
    await k.tick(30)
    assert.equal(lastList()!.query.get('q'), null)
    assert.equal(lastList()!.query.get('type'), null)
  })

  it('shows the error with a Retry that asks again', async () => {
    let failing = true
    current = await setup({ list: () => (failing ? { __status: 500, status: 0, message: 'The database is down.' } : envelope(adminRows())) })
    const { text, button, k, calls } = current
    assert.ok(text().includes('The portfolio could not be loaded') && text().includes('The database is down.'))
    failing = false
    const before = calls.filter((c) => c.path.endsWith('/list')).length
    await k.click(button('Retry')!)
    await k.tick(40)
    assert.equal(calls.filter((c) => c.path.endsWith('/list')).length, before + 1)
    assert.ok(text().includes('Fees Intelligence'))
  })

  it('says so when the person has no access (403), without a Retry', async () => {
    current = await setup({ list: () => ({ __status: 403, status: 0, message: 'No.' }) })
    assert.ok(current.text().includes('You cannot open the Product Portfolio'))
    assert.equal(current.button('Retry'), undefined)
  })

  it('says the portfolio is not set up on a server that has no Product database', async () => {
    current = await setup({ list: () => envelope([], ADMIN_CAN, { available: false, total: 0 }) })
    assert.ok(current.text().includes('The Product Portfolio is not set up here yet'))
  })

  it('keeps the rows and shows the error beside them when a later read fails', async () => {
    let fail = false
    current = await setup({ list: () => (fail ? { __status: 500, status: 0, message: 'Slow down.' } : envelope(adminRows())) })
    fail = true
    await current.choose('Type', 'service')
    assert.ok(current.text().includes('Slow down.'))
    assert.ok(current.text().includes('Fees Intelligence'), 'the rows stay')
  })
})

describe('the page by structure and for assistive technology', () => {
  let current: Awaited<ReturnType<typeof setup>> | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })

  it('has no accessibility violations the markup can show (axe, colour excluded): the list, as an administrator and as HR', async () => {
    current = await setup()
    assert.deepEqual(await axeViolations(current.k.one('body')!), [])
    await disposeAll()
    current.restore()
    current = await setup({ rows: hrRows(), can: HR_CAN })
    assert.deepEqual(await axeViolations(current.k.one('body')!), [])
  })

  it('has the toolbar wrap and the table scroll sideways on its own, so nothing is wider than a 390 px screen', async () => {
    current = await setup()
    const { k } = current
    const wrapper = k.one('table')!.closest('div.overflow-x-auto')
    assert.ok(wrapper, 'the table sits in its own horizontal scroller')
    const toolbar = k.one('select')!.closest('div.flex-wrap')
    assert.ok(toolbar, 'the filters wrap onto new lines')
    for (const el of k.all('main *, body *').slice(0, 400)) assert.ok(!/\bw-\[(?:[5-9]\d\d|\d{4,})px\]/.test(el.className || ''), `no fixed width of 500px or more: ${el.className}`)
  })

  it('gives every Sub-product row a tick box with a name, and the header one', async () => {
    current = await setup({ rows: [product(), sold(), stray()] })
    const boxes = current.k.all('input[type="checkbox"]')
    assert.equal(boxes.length, 3, 'one for the header and one for each of the two Sub-product rows')
    for (const box of boxes) assert.ok(box.getAttribute('aria-label'), 'every tick box has a name')
  })
})
