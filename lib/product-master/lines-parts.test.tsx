import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'

/** The small pieces the Products screen gains from the product lines, in a fake browser: the scope switch and the three extra columns of the catalogue list. */
async function setup() {
  const k = await kit()
  // next/link reads `self` while it renders; the fake browser does not define it.
  Object.defineProperty(globalThis, 'self', { value: k.w, configurable: true, writable: true })
  const { ProductScopeSwitch } = await import('../../components/domain/crm/product-scope-switch')
  const { IcpBadge, LineColumnCells, LineColumnHeads, SignalsCount } = await import('../../components/domain/crm/product-line-columns')
  return { k, ProductScopeSwitch, IcpBadge, LineColumnCells, LineColumnHeads, SignalsCount }
}

describe('the scope switch', () => {
  afterEach(disposeAll)

  it('shows the two scopes as a group of buttons and marks the open one as pressed', async () => {
    const { k, ProductScopeSwitch } = await setup()
    await k.render(k.h(ProductScopeSwitch, { scope: 'catalogue', onChange: () => undefined, lines: null }))

    assert.equal(k.one('[role="group"]')!.getAttribute('aria-label'), 'What to list')
    const buttons = k.all('button')
    assert.deepEqual(buttons.map((b) => b.textContent), ['Catalogue', 'Product lines'])
    assert.deepEqual(buttons.map((b) => b.getAttribute('aria-pressed')), ['true', 'false'])
  })

  it('presses the product lines when they are the open scope', async () => {
    const { k, ProductScopeSwitch } = await setup()
    await k.render(k.h(ProductScopeSwitch, { scope: 'lines', onChange: () => undefined, lines: null }))
    assert.deepEqual(k.all('button').map((b) => b.getAttribute('aria-pressed')), ['false', 'true'])
  })

  it('asks for the other scope when it is clicked, and does nothing when the open one is clicked', async () => {
    const { k, ProductScopeSwitch } = await setup()
    const asked: string[] = []
    await k.render(k.h(ProductScopeSwitch, { scope: 'catalogue', onChange: (scope: string) => asked.push(scope), lines: null }))

    await k.click(k.withText('Catalogue')!)
    assert.deepEqual(asked, [], 'the open scope is not asked for again')
    await k.click(k.withText('Product lines')!)
    assert.deepEqual(asked, ['lines'])
  })

  it('shows how many product lines there are on their button, when that is known and not zero', async () => {
    const { k, ProductScopeSwitch } = await setup()
    await k.render(k.h(ProductScopeSwitch, { scope: 'catalogue', onChange: () => undefined, lines: { productLines: 5 } }))
    assert.deepEqual(k.all('button').map((b) => b.textContent), ['Catalogue', 'Product lines5'])

    await k.render(k.h(ProductScopeSwitch, { scope: 'catalogue', onChange: () => undefined, lines: { productLines: 0 } }))
    assert.deepEqual(k.all('button').map((b) => b.textContent), ['Catalogue', 'Product lines'], 'no "0" badge')

    await k.render(k.h(ProductScopeSwitch, { scope: 'catalogue', onChange: () => undefined, lines: undefined }))
    assert.deepEqual(k.all('button').map((b) => b.textContent), ['Catalogue', 'Product lines'])
  })

  it('puts the count on the product lines button only, never on the catalogue', async () => {
    const { k, ProductScopeSwitch } = await setup()
    await k.render(k.h(ProductScopeSwitch, { scope: 'lines', onChange: () => undefined, lines: { productLines: 5 } }))
    assert.equal(k.withText('Catalogue')!.textContent, 'Catalogue')
  })
})

describe('the extra columns of the catalogue list', () => {
  afterEach(disposeAll)

  const wrap = (k: Awaited<ReturnType<typeof setup>>['k'], head: unknown, row: unknown) =>
    k.h('table', null, k.h('thead', null, k.h('tr', null, head)), k.h('tbody', null, k.h('tr', null, row)))

  it('has three headings: the product line, the Signals found and the ICP', async () => {
    const { k, LineColumnHeads } = await setup()
    await k.render(wrap(k, k.h(LineColumnHeads), null))
    assert.deepEqual(k.all('th').map((th) => th.textContent), ['Product line', 'Signals', 'ICP'])
  })

  it('shows the product line as a link to its page, the signals count and the ICP state', async () => {
    const { k, LineColumnHeads, LineColumnCells } = await setup()
    const hrefs: number[] = []
    const product = { productLine: { id: 4, name: 'ScholarClone' }, signalsFound: 12, icp: 'active' as const }
    await k.render(wrap(k, k.h(LineColumnHeads), k.h(LineColumnCells, { product, lineHref: (id: number) => { hrefs.push(id); return `/module/crm/sales/products/lines/${id}` } })))

    const cells = k.all('td')
    assert.equal(cells.length, 3)
    assert.equal(cells[0].querySelector('a')!.getAttribute('href'), '/module/crm/sales/products/lines/4')
    assert.equal(cells[0].textContent, 'ScholarClone')
    assert.equal(cells[1].textContent, '12')
    assert.equal(cells[2].textContent, 'Active')
    assert.deepEqual(hrefs, [4])
  })

  it('does not let a click on the product line also open the item behind it', async () => {
    const { k, LineColumnCells } = await setup()
    let rowClicks = 0
    const product = { productLine: { id: 4, name: 'ScholarClone' }, signalsFound: 1, icp: 'none' as const }
    await k.render(k.h('table', null, k.h('tbody', null, k.h('tr', { onClick: () => { rowClicks += 1 } }, k.h(LineColumnCells, { product, lineHref: () => '#' })))))

    // The anchor's own navigation is the browser's business; what matters is that the click does not bubble up to the row.
    const link = k.one('a')!
    await k.act(async () => { link.addEventListener('click', (e) => e.preventDefault()); link.dispatchEvent(new k.w.MouseEvent('click', { bubbles: true, cancelable: true })) })
    assert.equal(rowClicks, 0)
  })

  it('shows dashes for an item that is tied to no sub-product, and a 0 for a real zero', async () => {
    const { k, LineColumnCells } = await setup()
    await k.render(wrap(k, null, k.h(LineColumnCells, { product: { productLine: null, signalsFound: null, icp: null }, lineHref: () => '#' })))
    assert.deepEqual(k.all('td').map((td) => td.textContent), ['—', '—', '—'])
    assert.equal(k.one('a'), null)

    await k.render(wrap(k, null, k.h(LineColumnCells, { product: { productLine: { id: 1, name: 'EB' }, signalsFound: 0, icp: 'none' }, lineHref: () => '#' })))
    assert.deepEqual(k.all('td').map((td) => td.textContent), ['EB', '0', 'Not set up'], 'a count of 0 is an answer, not a blank')
  })

  it('tolerates an item from an older server that sends none of the three fields', async () => {
    const { k, LineColumnCells } = await setup()
    await k.render(wrap(k, null, k.h(LineColumnCells, { product: {}, lineHref: () => '#' })))
    assert.deepEqual(k.all('td').map((td) => td.textContent), ['—', '—', '—'])
  })
})

describe('the ICP badge and the signals count', () => {
  afterEach(disposeAll)

  it('words every state and explains it in a tooltip', async () => {
    const { k, IcpBadge } = await setup()
    const seen: Array<[string, string | null]> = []
    for (const state of ['active', 'draft', 'archived', 'template', 'none']) {
      await k.render(k.h(IcpBadge, { state }))
      const badge = k.one('[title]')!
      seen.push([badge.textContent!, badge.getAttribute('title')])
    }
    assert.deepEqual(seen.map((s) => s[0]), ['Active', 'Draft', 'Archived', 'Built-in', 'Not set up'])
    for (const [, title] of seen) assert.ok((title ?? '').length > 20)
  })

  it('draws a dash, with no tooltip, when no ICP applies', async () => {
    const { k, IcpBadge } = await setup()
    await k.render(k.h(IcpBadge, { state: null }))
    assert.equal(k.one('span')!.textContent, '—')
    assert.equal(k.one('[title]'), null)
    await k.render(k.h(IcpBadge, { state: undefined }))
    assert.equal(k.one('span')!.textContent, '—')
  })

  it('draws a count, a real zero, and a dash that says Signals does not look for the record', async () => {
    const { k, SignalsCount } = await setup()
    await k.render(k.h(SignalsCount, { count: 7 }))
    assert.equal(k.one('span')!.textContent, '7')
    await k.render(k.h(SignalsCount, { count: 0 }))
    assert.equal(k.one('span')!.textContent, '0')
    await k.render(k.h(SignalsCount, { count: null }))
    assert.equal(k.one('span')!.textContent, '—')
    assert.ok(k.one('span')!.getAttribute('title')!.includes('does not look for'))
  })
})
