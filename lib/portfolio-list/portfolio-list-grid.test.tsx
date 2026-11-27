import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { removalPreview } from '../portfolio/fixtures'
import { adminRows, aboutOnly, ADMIN_CAN, envelope, HR_CAN, hrRows, product, SALES_CAN, service, sold } from './fixtures'
import { LAYOUT_STORAGE_KEY } from './layout'
import { setup, type SetupOptions } from './screen-setup'

/**
 * The grid (cards) of the Product Portfolio, as a person uses it: the real list screen, the real service client, the address kept by a stand-in router, only the network
 * faked. The owner asked for a filterable grid on the list on 27 Nov 2026; the list itself is pinned by the other files of this folder and is not touched by these.
 * The rules the grid has to keep: it is the SAME list (filters, sort, page and ticked rows survive the switch, and a switch reads nothing again), the address wins over
 * the browser's memory, a card is one tab stop, and a person sees nothing in a card they may not see in the table.
 */

type Screen = Awaited<ReturnType<typeof setup>>
const KEEP_FILTERS = 'q=ERP&type=service&status=all&sort=signals&dir=desc&page=2'

describe('the List | Grid switch', () => {
  let current: Screen | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })
  const open = async (opts: SetupOptions = {}) => { current = await setup(opts); return current }
  const layoutButton = (label: string) => current!.k.all('[role="group"][aria-label="Layout"] button').find((b) => b.textContent?.trim() === label)!
  const pressed = () => current!.k.all('[role="group"][aria-label="Layout"] button').filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent?.trim())
  const switchTo = async (label: string) => { await current!.k.click(layoutButton(label)); await current!.k.tick(40) }
  const stored = () => current!.k.w.localStorage.getItem(LAYOUT_STORAGE_KEY)

  it('opens as the list, with List pressed, and no remembered choice and no address parameter', async () => {
    const screen = await open()
    assert.deepEqual(pressed(), ['List'])
    assert.equal(screen.k.all('table').length, 1)
    assert.equal(screen.k.all('[data-card]').length, 0)
    assert.deepEqual(screen.router.written, [], 'opening the page writes nothing to the address')
  })

  it('draws a card for each Product instead of the table when Grid is pressed, writes ?layout=grid, and does not read the page again', async () => {
    const screen = await open()
    const readsBefore = screen.to('/product-master/list').length
    await switchTo('Grid')
    assert.deepEqual(pressed(), ['Grid'])
    assert.equal(screen.k.all('table').length, 0, 'the table is gone')
    assert.deepEqual(screen.k.all('[data-card]').map((c) => c.getAttribute('data-card')), ['p:1', 'p:2', 'none'], 'one card for each group of the page')
    assert.equal(screen.router.lastSearch(), 'layout=grid')
    assert.equal(screen.to('/product-master/list').length, readsBefore, 'the same rows are drawn another way: nothing is read again')
  })

  it('goes back to the list with the parameter removed from the address', async () => {
    const screen = await open({ search: 'layout=grid' })
    assert.deepEqual(pressed(), ['Grid'])
    await switchTo('List')
    assert.deepEqual(pressed(), ['List'])
    assert.equal(screen.k.all('table').length, 1)
    assert.equal(screen.router.lastSearch(), '', 'the list is the default, so it is the plain address')
  })

  it('keeps the search, every filter, the sort and the page when it switches, in both directions, and reads the same request', async () => {
    const screen = await open({ search: KEEP_FILTERS, total: 45, lastPage: 3, rows: [product(), service()] })
    const wanted = { q: 'ERP', type: 'service', status: 'all', sort: 'signals', dir: 'desc', page: '2' }
    const readsBefore = screen.to('/product-master/list').length
    await switchTo('Grid')
    const inGrid = new URLSearchParams(screen.router.lastSearch())
    for (const [name, value] of Object.entries({ ...wanted, layout: 'grid' })) assert.equal(inGrid.get(name), value, `${name} is still in the address`)
    await switchTo('List')
    const back = new URLSearchParams(screen.router.lastSearch())
    for (const [name, value] of Object.entries(wanted)) assert.equal(back.get(name), value, `${name} survived the way back`)
    assert.equal(back.get('layout'), null)
    assert.equal(screen.to('/product-master/list').length, readsBefore, 'and neither switch asked the server again')
    const last = screen.lastList()!.query
    for (const [name, value] of Object.entries({ q: 'ERP', type: 'service', status: 'all', sort: 'signals', dir: 'desc', page: '2' })) assert.equal(last.get(name), value, `${name} was sent`)
  })

  it('keeps the ticked rows when it switches, and the card shows the tick', async () => {
    const screen = await open()
    const box = (name: string) => screen.k.all('input[type="checkbox"]').find((i) => i.getAttribute('aria-label') === `Select ${name}`) as HTMLInputElement
    await screen.k.click(box('Fees Intelligence'))
    await screen.k.tick(20)
    assert.ok(screen.text().includes('1 selected'))
    const readsBefore = screen.to('/product-master/list').length
    await switchTo('Grid')
    assert.ok(screen.text().includes('1 selected'), 'the bar of ticked rows is still there')
    assert.equal(box('Fees Intelligence').checked, true, 'and the card\'s own box is ticked')
    assert.equal(box('Scholar School ERP').checked, false)
    assert.equal(screen.to('/product-master/list').length, readsBefore)
  })

  it('opens as the grid when the address says so, whatever the browser remembered', async () => {
    await open({ search: 'layout=grid', remembered: 'list' })
    assert.deepEqual(pressed(), ['Grid'])
    assert.ok(current!.k.all('[data-card]').length > 0)
  })

  it('lets the address win over the memory the other way too: ?layout=list opens the list for a person who last used the grid', async () => {
    await open({ search: 'layout=list', remembered: 'grid' })
    assert.deepEqual(pressed(), ['List'])
    assert.equal(current!.k.all('table').length, 1)
  })

  it('opens as the grid when the browser remembered it and the address names nothing, and does not write the address for it', async () => {
    const screen = await open({ remembered: 'grid' })
    assert.deepEqual(pressed(), ['Grid'])
    assert.ok(screen.k.all('[data-card]').length > 0)
    assert.deepEqual(screen.router.written, [])
  })

  it('treats a layout it does not know, in the address or in storage, as nothing said', async () => {
    await open({ search: 'layout=cards', remembered: 'tiles' })
    assert.deepEqual(pressed(), ['List'])
    await disposeAll()
    current!.restore()
    await open({ search: 'layout=cards', remembered: 'grid' })
    assert.deepEqual(pressed(), ['Grid'], 'an address that is not a layout falls to the memory')
  })

  it('remembers each choice, so the next visit opens the same way', async () => {
    await open()
    assert.equal(stored(), null)
    await switchTo('Grid')
    assert.equal(stored(), 'grid')
    await switchTo('List')
    assert.equal(stored(), 'list')
  })

  it('goes back to the list for a person whose browser remembered the grid, and stays there', async () => {
    const screen = await open({ remembered: 'grid' })
    await switchTo('List')
    assert.deepEqual(pressed(), ['List'])
    assert.equal(screen.k.all('table').length, 1, 'the remembered grid did not pull the page back')
    assert.equal(stored(), 'list')
  })

  it('works where the browser refuses to remember (a private window, blocked site data): the address still holds the choice', async () => {
    let restore = () => {}
    await open({
      beforeMount: (w) => {
        const proto = (w as unknown as { Storage: { prototype: Storage } }).Storage.prototype
        const { getItem, setItem } = proto
        proto.getItem = function (this: Storage, key: string) { if (key === LAYOUT_STORAGE_KEY) throw new Error('blocked'); return getItem.call(this, key) }
        proto.setItem = function (this: Storage, key: string, value: string) { if (key === LAYOUT_STORAGE_KEY) throw new Error('blocked'); return setItem.call(this, key, value) }
        restore = () => { proto.getItem = getItem; proto.setItem = setItem }
      },
    })
    try {
      assert.deepEqual(pressed(), ['List'], 'the page opens, as the list')
      await switchTo('Grid')
      assert.deepEqual(pressed(), ['Grid'])
      assert.equal(current!.router.lastSearch(), 'layout=grid')
      await switchTo('List')
      assert.deepEqual(pressed(), ['List'])
    } finally {
      restore()
    }
  })

  it('shows the Sort select only in the grid (the table\'s clickable headings are the list\'s sort), after the six filters', async () => {
    const screen = await open()
    assert.equal(screen.facet('Sort by'), undefined, 'none in the list')
    await switchTo('Grid')
    const labels = screen.k.all('select').map((s) => screen.k.w.document.querySelector(`label[for="${s.id}"]`)?.textContent)
    assert.deepEqual(labels, ['Product', 'Type', 'Sold in CRM', 'Readiness', 'Status', 'Page size', 'Sort by'])
    await switchTo('List')
    assert.equal(screen.facet('Sort by'), undefined)
  })
})

describe('the cards', () => {
  let current: Screen | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })
  const open = async (opts: SetupOptions = {}) => { current = await setup({ search: 'layout=grid', ...opts }); return current }
  const card = (key: string) => current!.k.one(`[data-card="${key}"]`)!
  const names = (el: Element) => Array.from(el.querySelectorAll('li[data-row] a')).map((a) => a.textContent)

  it('holds each Product\'s Sub-products inside its own card, with the Product\'s own facts above them', async () => {
    await open()
    const scholar = card('p:1')
    assert.equal(scholar.querySelector('h2')!.textContent, 'ScholarClone')
    assert.deepEqual(names(scholar), ['Scholar School ERP', 'Fees Intelligence', 'ScholarClone Implementation'], 'the Sub-products are in the card, in the page\'s order')
    for (const part of ['31 signals found', 'ICP in use', '3 sub-products']) assert.ok(scholar.textContent!.includes(part), `the card says "${part}"`)
    assert.deepEqual(names(card('p:2')), [], 'a Product with no Sub-product on the page holds none')
    assert.ok(card('p:2').textContent!.includes('Shared, read only'))
    assert.ok(card('p:2').textContent!.includes('5 sub-products'), 'but it still says how many it has')
  })

  it('keeps each Sub-product\'s own state, readiness and price on its row, and shows a price only because the row carries one', async () => {
    await open()
    const row = (name: string) => card('p:1').querySelector(`li[data-row="${({ 'Fees Intelligence': 11, 'Scholar School ERP': 10, 'ScholarClone Implementation': 15 } as Record<string, number>)[name]}"]`)!
    for (const part of ['Sold', 'Live – with client', '₹1,20,000.00']) assert.ok(row('Fees Intelligence').textContent!.includes(part), `Fees Intelligence: ${part}`)
    for (const part of ['Not sold', 'Prototype']) assert.ok(row('Scholar School ERP').textContent!.includes(part), `Scholar School ERP: ${part}`)
    assert.ok(!row('Scholar School ERP').textContent!.includes('₹'), 'a row with no price in it shows none')
    for (const part of ['Service', 'Paused', '₹40,000.00']) assert.ok(row('ScholarClone Implementation').textContent!.includes(part), `the Service: ${part}`)
    assert.ok(!row('Fees Intelligence').textContent!.includes('Not sold'), 'and no row borrows another\'s state')
  })

  it('says every status in words and with a small icon, never by colour alone', async () => {
    await open()
    const chips = Array.from(card('p:1').querySelectorAll('span')).filter((s) => ['Sold', 'Paused', 'Live – with client', 'Prototype', 'ICP in use'].includes(s.textContent?.trim() ?? ''))
    assert.equal(chips.length, 5)
    for (const chip of chips) {
      assert.ok(chip.querySelector('svg[aria-hidden="true"]'), `"${chip.textContent}" has an icon beside its word`)
      assert.match(chip.className, /\bborder\b/, 'it is a chip')
    }
    const plain = Array.from(card('p:1').querySelectorAll('span')).find((s) => s.textContent?.trim() === 'Service')!
    assert.equal(plain.querySelector('svg'), null, 'a neutral label needs no icon')
  })

  it('opens a Product from one stretched link, and each Sub-product from its own name', async () => {
    await open()
    const scholar = card('p:1')
    const links = Array.from(scholar.querySelectorAll('a'))
    const toProduct = links.filter((a) => a.getAttribute('href') === '/portfolio/scholarclone')
    assert.equal(toProduct.length, 1, 'one link to the Product')
    assert.equal(toProduct[0].getAttribute('aria-label'), 'Open ScholarClone')
    assert.match(toProduct[0].className, /absolute/)
    assert.match(toProduct[0].className, /inset-0/)
    assert.equal(toProduct[0].textContent, '', 'it is empty: the card\'s own words are the heading')
    assert.equal(scholar.querySelector('article')?.getAttribute('aria-labelledby') ?? card('p:1').querySelector('article')!.getAttribute('aria-labelledby'), scholar.querySelector('h2')!.id, 'the card is named by its heading')
    assert.deepEqual(links.filter((a) => a !== toProduct[0]).map((a) => a.getAttribute('href')), ['/portfolio/products/10', '/portfolio/products/11', '/portfolio/products/15'])
    assert.equal(current!.k.one('[data-card="p:2"] a')!.getAttribute('href'), '/portfolio/enterprise_brain')
  })

  it('is one tab stop: everything else a person can press in a card sits above the stretched link, and nothing is inside another control', async () => {
    await open()
    for (const key of ['p:1', 'p:2', 'none']) {
      const el = card(key)
      const stretched = el.querySelector('a.absolute')
      const others = Array.from(el.querySelectorAll('a, button, input, select, textarea, [tabindex]')).filter((c) => c !== stretched)
      assert.ok(others.length > 0 || key === 'p:2', `${key} has its own controls`)
      for (const control of others) assert.ok(control.closest('.z-20'), `a control of ${key} sits above the link: ${control.outerHTML.slice(0, 90)}`)
      if (stretched) assert.match(stretched.className, /\bz-10\b/)
      for (const control of Array.from(el.querySelectorAll('a, button'))) assert.equal(control.querySelector('a, button, input, select'), null, 'a control never contains another')
    }
  })

  it('has no link at all to a Product the page does not hold: the strays\' card opens nothing, and its Sub-products open their own pages', async () => {
    await open()
    const strays = card('none')
    assert.equal(strays.querySelector('a.absolute'), null)
    assert.ok(strays.textContent!.includes('Open one to choose its Product.'))
    assert.deepEqual(names(strays), ['Imported widget'])
    assert.match(strays.querySelector('article')!.className, /border-dashed/, 'drawn dashed: a place, not a Product')
  })

  it('keeps the first three of many Sub-products on the card, says "+N more", and names what the card leaves out to a screen reader', async () => {
    const many = Array.from({ length: 6 }, (_, i) => aboutOnly({ id: 100 + i, name: `Sub ${i + 1}`, key: `scholarclone/s${i + 1}` }))
    await open({ rows: [product({ subProductCount: 6 }), ...many] })
    const scholar = card('p:1')
    assert.deepEqual(names(scholar), ['Sub 1', 'Sub 2', 'Sub 3'])
    assert.ok(scholar.textContent!.includes('+3 more'))
    assert.ok(scholar.textContent!.includes('6 sub-products'))
    assert.equal(scholar.querySelector('a.absolute')!.getAttribute('aria-label'), 'Open ScholarClone, 3 more sub-products')
  })

  it('says a group the page begins inside of is continued, and opens no Product page for it', async () => {
    await open({ search: 'layout=grid&page=2', total: 40, lastPage: 2, rows: [sold({ id: 41, name: 'Later Sub' }), service({ id: 42, name: 'Later Service' })] })
    const cardEl = card('p:1')
    assert.equal(cardEl.querySelector('h2')!.textContent, 'ScholarClone')
    assert.ok(cardEl.textContent!.includes('Continued from the previous page'))
    assert.equal(cardEl.querySelector('a.absolute'), null)
    assert.deepEqual(names(cardEl), ['Later Sub', 'Later Service'])
  })

  it('is as wide as its box allows: one column on a phone, then two, three and four (a container query, so the Signals tab\'s own width decides)', async () => {
    await open()
    const list = current!.k.one('ul[aria-label="Products and their sub-products"]')!
    for (const cls of ['grid-cols-1', '@2xl:grid-cols-2', '@4xl:grid-cols-3', '@7xl:grid-cols-4']) assert.ok(list.className.split(/\s+/).includes(cls), `${cls}`)
    assert.ok(list.parentElement!.className.split(/\s+/).includes('@container'), 'the columns follow the box around the grid')
  })

  it('draws no price, SKU, category or stock for a caller who may not view Sell, even from rows that carry them', async () => {
    await open({ rows: adminRows(), can: HR_CAN })
    for (const word of ['₹', 'INR', 'SKU', 'Price', 'Category', 'In stock', 'Sold in CRM', 'Total']) assert.ok(!current!.text().includes(word), `HR sees "${word}"`)
    assert.ok(!card('p:1').textContent!.includes('Sold'), 'nor the state in CRM, which is a Sell fact')
    assert.ok(card('p:1').textContent!.includes('Prototype'), 'but the readiness stays')
  })

  it('draws the price of a Sub-product only for a caller who may view Sell', async () => {
    await open({ rows: adminRows(), can: SALES_CAN })
    assert.ok(card('p:1').textContent!.includes('₹1,20,000.00'))
    await disposeAll()
    current!.restore()
    await open({ rows: hrRows(), can: HR_CAN })
    assert.ok(!current!.text().includes('₹'))
  })

  it('has no accessibility violations the markup can show (axe, colour excluded): as an administrator, as HR, and as a person who may change nothing', async () => {
    await open()
    assert.deepEqual(await axeViolations(current!.k.one('body')!), [])
    await disposeAll()
    current!.restore()
    await open({ rows: hrRows(), can: HR_CAN })
    assert.deepEqual(await axeViolations(current!.k.one('body')!), [])
    await disposeAll()
    current!.restore()
    await open({ rows: hrRows(), can: { ...HR_CAN, createSubProduct: false, editSubProduct: false }, canManage: false })
    assert.deepEqual(await axeViolations(current!.k.one('body')!), [])
  })
})

describe('what the grid lets a person do', () => {
  let current: Screen | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })
  const open = async (opts: SetupOptions = {}) => { current = await setup({ search: 'layout=grid', ...opts }); return current }
  const box = (name: string) => current!.k.all('input[type="checkbox"]').find((i) => i.getAttribute('aria-label') === `Select ${name}`) as HTMLInputElement | undefined
  const tick = async (name: string) => { await current!.k.click(box(name)!); await current!.k.tick(20) }
  const openMenu = async (name: string) => {
    const trigger = current!.k.all('button').find((b) => b.getAttribute('aria-label') === `Actions for ${name}`)
    assert.ok(trigger, `${name} has a menu`)
    await current!.k.act(async () => { trigger.dispatchEvent(new current!.k.w.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, ctrlKey: false })) })
    await current!.k.tick(20)
    return current!.menuItems().map((i) => i.textContent?.trim())
  }

  it('ticks a Sub-product from its card and brings the bar of ticked rows, the same bar as the list', async () => {
    await open()
    assert.ok(!current!.text().includes('selected'))
    await tick('Fees Intelligence')
    assert.ok(current!.text().includes('1 selected'))
    assert.ok(current!.button('Reassign') && current!.button('Delete (to the Recycle Bin)') && current!.button('Move to another Product'))
    await tick('Scholar School ERP')
    assert.ok(current!.text().includes('2 selected'))
    assert.equal(box('Fees Intelligence')!.checked, true)
  })

  it('"Select all on this page" ticks every Sub-product that can be changed, as in the list, and not a Product', async () => {
    await open()
    const all = current!.k.all('input[type="checkbox"]').find((i) => (i.closest('label')?.textContent ?? '').includes('Select all on this page')) as HTMLInputElement
    assert.ok(all)
    await current!.k.click(all)
    await current!.k.tick(20)
    assert.ok(current!.text().includes('4 selected'), 'the About-only one, the sold one, the paused service and the stray')
    assert.equal(current!.k.all('[data-card] input[type="checkbox"]').filter((c) => (c as HTMLInputElement).checked).length, 4)
    await current!.k.click(all)
    await current!.k.tick(400)
    assert.ok(!current!.text().includes('selected'))
  })

  it('asks before it deletes ticked rows, in the same words as the list', async () => {
    await open()
    await tick('Fees Intelligence')
    await current!.k.click(current!.button('Delete (to the Recycle Bin)')!)
    await current!.k.tick(40)
    assert.ok(current!.text().includes('Delete 1 sub-product from CRM?'))
  })

  it('offers each Sub-product Move and Delete from its card, and an administrator\'s Product Delete product only', async () => {
    await open()
    assert.deepEqual(await openMenu('Fees Intelligence'), ['Move to another Product', 'Delete'])
    await current!.k.press('Escape')
    await current!.k.tick(20)
    assert.deepEqual(await openMenu('ScholarClone'), ['Delete product'])
    await current!.k.press('Escape')
    await current!.k.tick(20)
    assert.equal(current!.k.all('button').some((b) => b.getAttribute('aria-label') === 'Actions for Enterprise Brain'), false, 'a shared Product is read only: no menu')
  })

  it('deletes through the card\'s menu by the same dialog and the same request as the list', async () => {
    await open({
      intercept: (call) => {
        const preview = call.path.match(/\/product-master\/(\d+)\/removal$/)
        if (preview) return { status: 1, data: removalPreview({ id: Number(preview[1]), name: 'Fees Intelligence' }) }
        if (call.path.endsWith('/product-master/11/remove')) return { status: 1, data: { removed: [11] } }
        return undefined
      },
    })
    await openMenu('Fees Intelligence')
    await current!.k.click(current!.menuItems().find((i) => i.textContent?.trim() === 'Delete')!)
    await current!.k.tick(40)
    assert.equal(current!.to('/product-master/11/removal').length, 1, 'what it would do is read for this record')
    const button = current!.k.all('[role="dialog"] button').find((b) => b.textContent?.trim() === 'Delete')!
    await current!.k.click(button)
    await current!.k.tick(80)
    assert.equal(current!.to('/product-master/11/remove').length, 1)
    assert.ok(current!.text().includes('Deleted Fees Intelligence.'))
  })

  it('offers Add sub-product on a Product of the organisation\'s own, and not on a shared one', async () => {
    await open()
    const adds = current!.k.all('button').filter((b) => (b.getAttribute('aria-label') ?? '').startsWith('Add a sub-product to'))
    assert.deepEqual(adds.map((b) => b.getAttribute('aria-label')), ['Add a sub-product to ScholarClone'])
  })

  it('gives a person who may change nothing no tick box, no menu, no Add sub-product and no bar', async () => {
    await open({ rows: hrRows(), can: { ...HR_CAN, createSubProduct: false, editSubProduct: false }, canManage: false })
    assert.equal(current!.k.all('[data-card] input').length, 0, 'no tick boxes')
    assert.ok(!current!.text().includes('Select all on this page'))
    assert.equal(current!.k.all('button').filter((b) => (b.getAttribute('aria-label') ?? '').startsWith('Actions for')).length, 0, 'no Move or Delete anywhere')
    assert.equal(current!.k.all('button').filter((b) => (b.getAttribute('aria-label') ?? '').startsWith('Add a sub-product')).length, 0)
    for (const word of ['Move to another Product', 'Delete', 'Reassign']) assert.ok(!current!.k.all('button, [role="menuitem"]').some((b) => (b.textContent ?? '').includes(word)), `no ${word}`)
    assert.ok(current!.k.all('[data-card]').length > 0, 'they still see the cards')
  })

  it('sorts from the Sort select: it reaches the server and the address, back to page 1, and says what the sort moved', async () => {
    await open({ search: 'layout=grid&page=2', total: 45, lastPage: 3, rows: [product(), sold()] })
    assert.equal(current!.facet('Sort by')!.value, 'name:asc')
    assert.ok(!current!.text().includes('Products stay in order of name.'), 'nothing to explain for the name')
    await current!.choose('Sort by', 'signals:desc')
    const last = current!.lastList()!.query
    assert.equal(last.get('sort'), 'signals')
    assert.equal(last.get('dir'), 'desc')
    assert.equal(last.get('page'), '1', 'a new order starts from the first page')
    const address = new URLSearchParams(current!.router.lastSearch())
    assert.equal(address.get('sort'), 'signals')
    assert.equal(address.get('layout'), 'grid')
    assert.ok(current!.text().includes('Products stay in order of name. The sort orders the sub-products inside each product.'))
    assert.equal(current!.facet('Sort by')!.value, 'signals:desc')
  })

  it('offers the price orders only to a caller who may view prices', async () => {
    await open()
    const options = (select: HTMLSelectElement) => Array.from(select.options).map((o) => o.textContent)
    assert.ok(options(current!.facet('Sort by')!).includes('Price, low to high'))
    await disposeAll()
    current!.restore()
    await open({ rows: hrRows(), can: HR_CAN })
    assert.ok(!options(current!.facet('Sort by')!).some((label) => /price/i.test(label ?? '')))
  })

  it('applies a filter chosen in the grid: it reaches the server, the cards are what came back, and it is still there in the list', async () => {
    await open({
      list: (query) => (query.get('type') === 'service' ? envelope([product(), service()], ADMIN_CAN) : envelope(adminRows(), ADMIN_CAN)),
    })
    assert.equal(current!.k.all('[data-card]').length, 3)
    await current!.choose('Type', 'service')
    assert.equal(current!.lastList()!.query.get('type'), 'service')
    assert.deepEqual(current!.k.all('[data-card]').map((c) => c.getAttribute('data-card')), ['p:1'], 'only the cards of what the filter let through')
    assert.deepEqual(Array.from(current!.k.all('[data-card] li[data-row] a')).map((a) => a.textContent), ['ScholarClone Implementation'])
    assert.equal(new URLSearchParams(current!.router.lastSearch()).get('layout'), 'grid', 'filtering does not leave the grid')
    const layout = current!.k.all('[role="group"][aria-label="Layout"] button').find((b) => b.textContent?.trim() === 'List')!
    await current!.k.click(layout)
    await current!.k.tick(40)
    assert.equal(current!.facet('Type')!.value, 'service', 'the filter is still chosen in the list')
    assert.equal(current!.k.all('tr[data-row]').length, 1)
  })

  it('pages the same way: Next goes to page 2 and stays in the grid', async () => {
    await open({ total: 45, lastPage: 3 })
    await current!.k.click(current!.button('Next')!)
    await current!.k.tick(40)
    const address = new URLSearchParams(current!.router.lastSearch())
    assert.equal(address.get('page'), '2')
    assert.equal(address.get('layout'), 'grid')
    assert.equal(current!.lastList()!.query.get('page'), '2')
    assert.ok(current!.text().includes('Page 2 of 3'))
  })
})

describe('the states of the grid', () => {
  let current: Screen | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })
  const open = async (opts: SetupOptions = {}) => { current = await setup({ search: 'layout=grid', ...opts }); return current }

  it('draws cards\' shapes while the page loads, told to a screen reader as one "Loading…", with no table and no real card', async () => {
    await open({ list: () => new Promise(() => undefined) })
    const { k } = current!
    const status = k.one('[role="status"]')!
    assert.ok(status.textContent!.includes('Loading…'))
    assert.equal(k.all('ul[aria-hidden="true"] > li').length, 6)
    assert.equal(k.all('table').length, 0)
    assert.equal(k.all('[data-card]').length, 0)
    for (const bar of k.all('[role="status"] .animate-pulse')) assert.match(bar.className, /motion-reduce:animate-none/, 'it stops pulsing for a person who asked for less motion')
  })

  it('says when nothing matches, with the way out, and stays in the grid when it clears', async () => {
    await open({ rows: [], search: 'layout=grid&q=zzz' })
    assert.ok(current!.text().includes('Nothing matches'))
    assert.equal(current!.k.all('[data-card]').length, 0)
    await current!.k.click(current!.k.all('button').filter((b) => b.textContent?.trim() === 'Clear filters').at(-1)!)
    await current!.k.tick(40)
    const address = new URLSearchParams(current!.router.lastSearch())
    assert.equal(address.get('q'), null)
    assert.equal(address.get('layout'), 'grid', 'clearing the filters does not change the layout')
  })

  it('says what to do when there is nothing at all, and when the read failed or was refused', async () => {
    await open({ rows: [] })
    assert.ok(current!.text().includes('No products yet'))
    assert.ok(current!.text().includes('Add a product or a sub-product to start.'))
    await disposeAll()
    current!.restore()
    await open({ list: () => ({ __status: 500, status: 0, message: 'The database is down.' }) })
    assert.ok(current!.text().includes('The portfolio could not be loaded'))
    await disposeAll()
    current!.restore()
    await open({ list: () => ({ __status: 403, status: 0, message: 'No.' }) })
    assert.ok(current!.text().includes('You cannot open the Product Portfolio'))
  })

  it('uses no retired word in any state of the grid', async () => {
    const RETIRED = /(?<![\w-])(catalogues?|catalogs?|offers?|items?|product[ -]lines?|views?|refresh)(?![\w-])/i
    for (const opts of [{}, { rows: [] }, { list: () => new Promise(() => undefined) }, { rows: hrRows(), can: HR_CAN }] as SetupOptions[]) {
      await open(opts)
      assert.ok(!RETIRED.test(current!.text()), `a retired word: ${current!.text().match(RETIRED)?.[0]}`)
      await disposeAll()
      current!.restore()
    }
  })
})

describe('the source of the grid keeps the design brief', () => {
  const FILES = ['components/domain/portfolio/portfolio-list-grid.tsx', 'components/domain/portfolio/portfolio-list-card.tsx', 'components/domain/portfolio/portfolio-layout-toggle.tsx']
  const read = (file: string) => readFileSync(path.resolve(file), 'utf8')
  const lines = (file: string) => read(file).split(/\r?\n/).map((line, index) => ({ line, number: index + 1 })).filter(({ line }) => !/^\s*(\/\/|\*|\/\*)/.test(line))

  it('has no ALL-CAPS label, no tracking-wide eyebrow, no middle-dot string, no arrow in a label, and no gradient', () => {
    const offences: string[] = []
    for (const file of FILES) {
      for (const { line, number } of lines(file)) {
        if (/\buppercase\b|\btracking-(wide|wider|widest)\b|\bcapitalize\b/.test(line)) offences.push(`${file}:${number}: capitals ${line.trim().slice(0, 80)}`)
        if (/[·→—]/.test(line.replace(/\/\/.*$/, ''))) offences.push(`${file}:${number}: a middle dot, arrow or dash ${line.trim().slice(0, 80)}`)
        if (/\bgradient|bg-gradient|backdrop-blur/.test(line)) offences.push(`${file}:${number}: a gradient or blur ${line.trim().slice(0, 80)}`)
      }
    }
    assert.deepEqual(offences, [])
  })

  it('has no transition on hover anywhere (the cards change at once; motion is for the answer to an action) and no lift', () => {
    const offences: string[] = []
    for (const file of FILES) {
      for (const { line, number } of lines(file)) {
        if (/\btransition|\bduration-|\banimate-(?!none)|hover:-translate|hover:scale|hover:shadow/.test(line) && !/motion-reduce:animate-none/.test(line)) offences.push(`${file}:${number}: ${line.trim().slice(0, 100)}`)
      }
    }
    assert.deepEqual(offences, [])
  })

  it('stops the loading shapes pulsing for a person who asked for less motion, and uses the app\'s own pieces: Skeleton, chipClass, no Badge', () => {
    const grid = read(FILES[0])
    assert.match(grid, /import \{ Skeleton \} from '@\/components\/ui\/skeleton'/)
    for (const line of lines(FILES[0]).filter(({ line }) => /<Skeleton\b/.test(line))) assert.match(line.line, /motion-reduce:animate-none/)
    assert.match(read(FILES[1]), /chipClass\(chip\.tone\)/)
    for (const file of FILES) assert.doesNotMatch(read(file), /components\/ui\/(status-)?badge|<(Status)?Badge\b/)
  })

  it('imports nothing across domains (the design system keeps one domain out of another)', () => {
    for (const file of FILES) {
      const crossing = read(file).match(/from '@\/components\/domain\/(?!portfolio\/)[^']+'/g) ?? []
      assert.deepEqual(crossing, [], `${file} imports another domain`)
    }
  })

  it('gives the switch the pattern of the other layout switches: a labelled group of buttons with aria-pressed, icon-only under 1024 px', () => {
    const toggle = read(FILES[2])
    assert.match(toggle, /role="group" aria-label="Layout"/)
    assert.match(toggle, /aria-pressed=\{pressed\}/)
    assert.match(toggle, /hidden lg:inline/)
    assert.match(toggle, /useUrlTab\(LAYOUTS, LAYOUT_PARAM\)/, 'the address is held by the shared tab hook, not by a new filter of the list query')
  })
})
