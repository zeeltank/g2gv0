import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import type { NavModule, NavNode } from '../gtg-navigation'
import { collapseSignalsNav } from '../signals-nav'

/**
 * The sidebar after Products and Services became the Product Portfolio, a tab of Market Signals (owner decisions of 13 Nov and 24 Nov 2026, slice 15). The two menu ROWS
 * (468, 469) stay in the database with status 1 (a Role & Permissions save deletes the rights of every row that is not status 1), so the change is made in code, here:
 * neither row is drawn (the list is the "Product Portfolio" tab of Market Signals: a second sidebar entry would be its twin), the old addresses still resolve, and a
 * visit to the Product and Sub-product pages highlights Market Signals. REWRITTEN ON PURPOSE on 24 Nov: it used to pin a "Product Portfolio" entry where Products was.
 */

const leaf = (id: number, label: string, accessLink: string | null): NavNode => ({ id: String(id), label, accessLink, children: [] })
const PRODUCTS = () => leaf(468, 'Products', '/module/crm/sales/products')
const SERVICES = () => leaf(469, 'Services', '/module/crm/sales/services')
const PRICE_BOOKS = () => leaf(470, 'Price Books', '/module/crm/sales/price-books')
/** Market Signals as the live menu has it; `withPortfolio` is the Product Portfolio tab row (492), which a person may or may not hold. */
const signals = (withPortfolio: boolean): NavNode => ({
  id: '489', label: 'Market Signals', accessLink: '/module/crm/signals',
  children: [leaf(490, 'Company Opportunities', '/signals'), leaf(491, 'Ingestion Engine', '/ingestion'), ...(withPortfolio ? [leaf(492, 'Product Portfolio', '/portfolio')] : []), leaf(493, 'Partner Network', '/partners')],
})
const crm = (children: NavNode[]): NavModule => ({ id: '199', label: 'Sales & Marketing', short: 'S&M', accessLink: null, children })

/** A person's Sales & Marketing menu with the rows they hold. */
function menu(have: { products: boolean; services: boolean; portfolio: boolean }): NavModule[] {
  return [crm([
    leaf(466, 'Quotes', '/module/crm/sales/quotes'),
    ...(have.products ? [PRODUCTS()] : []), ...(have.services ? [SERVICES()] : []), PRICE_BOOKS(), signals(have.portfolio),
  ])]
}

const labels = (m: NavModule[]) => m[0].children.map((c) => c.label)
const find = (m: NavModule[], id: string) => m[0].children.find((c) => c.id === id)

describe('the Products and Services rows are not drawn in the sidebar, with each combination of Products, Services and Portfolio rights', () => {
  const SIGNALS_ENTRY = { moduleId: '199', menuId: '489', submenuId: '489' }
  const combos: Array<[boolean, boolean, boolean]> = []
  for (const products of [true, false]) for (const services of [true, false]) for (const portfolio of [true, false]) combos.push([products, services, portfolio])

  for (const [products, services, portfolio] of combos) {
    const name = `Products ${products ? 'yes' : 'no'}, Services ${services ? 'yes' : 'no'}, Portfolio tab ${portfolio ? 'yes' : 'no'}`
    it(name, () => {
      const out = collapseSignalsNav(menu({ products, services, portfolio }))
      const shown = labels(out.modules)

      // Neither row, and no Product Portfolio entry, is drawn: the list is the Product Portfolio tab of Market Signals.
      for (const word of ['Products', 'Services', 'Product Portfolio']) assert.equal(shown.includes(word), false, `${word} is never drawn in the sidebar`)
      assert.equal(find(out.modules, '468'), undefined)
      assert.equal(find(out.modules, '469'), undefined)

      // The Product Portfolio pages belong to Market Signals (the module the tab is in), whatever rows the person holds.
      assert.deepEqual(out.owners['/portfolio'], SIGNALS_ENTRY, 'a visit to /portfolio highlights Market Signals')

      // The old addresses stay resolvable (their pages redirect) only for a row the person held, and highlight Market Signals while being redirected.
      assert.deepEqual(out.retired, [...(products ? ['/module/crm/sales/products'] : []), ...(services ? ['/module/crm/sales/services'] : [])])
      assert.deepEqual(out.owners['/module/crm/sales/products'], products ? SIGNALS_ENTRY : undefined)
      assert.deepEqual(out.owners['/module/crm/sales/services'], services ? SIGNALS_ENTRY : undefined)

      // Everything else in the menu is untouched.
      assert.deepEqual(shown, ['Quotes', 'Price Books', 'Market Signals'])
      assert.deepEqual(find(out.modules, '489')!.children, [], 'Market Signals stays one flat link')
    })
  }

  it("highlights Market Signals for every address of the Portfolio, old and new, and for the tab's own route", () => {
    const out = collapseSignalsNav(menu({ products: true, services: true, portfolio: true }))
    for (const path of ['/signals', '/ingestion', '/partners', '/portfolio', '/signals/portfolio', '/module/crm/sales/products', '/module/crm/sales/services']) assert.deepEqual(out.owners[path], SIGNALS_ENTRY, path)
  })

  it('does not touch a Products row that has children, so nothing else can change with it, while the Services leaf is dropped', () => {
    const parent: NavNode = { ...PRODUCTS(), children: [leaf(900, 'Something', '/x')] }
    const out = collapseSignalsNav([crm([parent, SERVICES()])])
    assert.equal(find(out.modules, '468')!.label, 'Products')
    assert.equal(find(out.modules, '468')!.accessLink, '/module/crm/sales/products')
    assert.equal(find(out.modules, '469'), undefined, 'the Services row is not drawn')
  })

  it('finds the rows by their address, whatever their label, so a renamed row is dropped too', () => {
    const renamed = leaf(468, 'Catalogue', '/module/crm/sales/products')
    const out = collapseSignalsNav([crm([renamed, PRICE_BOOKS()])])
    assert.deepEqual(out.modules[0].children.map((c) => c.label), ['Price Books'])
  })

  it('finds the rows at any depth; with no Market Signals group nothing is highlighted for them', () => {
    const deep: NavModule[] = [{ id: '1', label: 'Mod', short: 'M', accessLink: null, children: [{ id: '10', label: 'Group', accessLink: null, children: [PRODUCTS(), SERVICES(), PRICE_BOOKS()] }] }]
    const out = collapseSignalsNav(deep)
    assert.deepEqual(out.modules[0].children[0].children.map((c) => c.label), ['Price Books'])
    assert.equal(out.owners['/portfolio'], undefined, 'no Signals group, no owner')
    assert.deepEqual(out.retired, ['/module/crm/sales/products', '/module/crm/sales/services'])
  })

  it('changes nothing in place and returns the same objects when the person has neither row', () => {
    const input = menu({ products: false, services: false, portfolio: false })
    const before = JSON.stringify(input)
    const out = collapseSignalsNav(input)
    assert.equal(JSON.stringify(input), before, 'the input is not changed')
    assert.deepEqual(out.retired, [])
    const withRows = menu({ products: true, services: true, portfolio: true })
    const beforeRows = JSON.stringify(withRows)
    collapseSignalsNav(withRows)
    assert.equal(JSON.stringify(withRows), beforeRows, 'a menu with the rows is not changed in place either')
  })
})

// ---------------------------------------------------------------------------------------------------------------------------- the real hook

const TENANT = 1
const PROFILE = 16
const raw = (n: NavNode, parent: number | null, sort: number): Record<string, unknown> => ({
  id: Number(n.id), label: n.label, icon: null, access_link: n.accessLink, page_type: n.children.length ? null : 'page', sort_order: sort, parent_id: parent,
  children: n.children.map((c, i) => raw(c, Number(n.id), i + 1)),
})
const serverMenu = (m: NavModule[]) => m.map((mod, i) => raw(mod, null, i + 1))

async function throughTheHook(have: { products: boolean; services: boolean; portfolio: boolean }) {
  const k = await kit()
  /* eslint-disable @typescript-eslint/no-require-imports */
  // `require`, not `import()`: the hook loads these through the same loader, and a dynamic import would give this file a second copy of each module.
  const { AuthContext } = require('../../components/auth/gtg-auth') as typeof import('../../components/auth/gtg-auth')
  const { QueryClient, QueryClientProvider } = require('@tanstack/react-query') as typeof import('@tanstack/react-query')
  /* eslint-enable @typescript-eslint/no-require-imports */
  const { useSidebarNavigation } = await import('../../hooks/use-sidebar-navigation')
  const data = serverMenu(menu(have))
  k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: TENANT, user_id: 2, user_profile_id: PROFILE }))
  k.w.sessionStorage.setItem(`gtg-sidebar-cache-v3:${TENANT}:${PROFILE}`, JSON.stringify({ status_code: 200, message: 'ok', data }))
  const original = globalThis.fetch
  globalThis.fetch = (async () => new Response(JSON.stringify({ status_code: 200, message: 'ok', data }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })

  function Probe() {
    const nav = useSidebarNavigation()
    const report = {
      sidebar: nav.sidebarModules[0]?.children.map((c) => ({ id: c.id, label: c.label, accessLink: c.accessLink })),
      active: {
        portfolio: nav.parseRoutePath('/portfolio'), subProduct: nav.parseRoutePath('/portfolio/products/5'), product: nav.parseRoutePath('/portfolio/scholarclone'),
        ingestion: nav.parseRoutePath('/ingestion'),
      },
      resolved: {
        products: nav.resolveAccessLink('/module/crm/sales/products'), services: nav.resolveAccessLink('/module/crm/sales/services'), portfolio: nav.resolveAccessLink('/portfolio'),
        priceBooks: nav.resolveAccessLink('/module/crm/sales/price-books'),
      },
    }
    return k.h('pre', { 'data-report': '' }, JSON.stringify(report))
  }
  try {
    await k.render(k.h(QueryClientProvider, { client }, k.h(AuthContext.Provider, { value: { user: null } as never }, k.h(Probe))))
    await k.tick(40)
    return JSON.parse(k.one('[data-report]')!.textContent!) as {
      sidebar: Array<{ id: string; label: string; accessLink: string }>
      active: Record<string, { moduleId: string; menuId: string; submenuId: string } | null>
      resolved: Record<string, string>
    }
  } finally {
    globalThis.fetch = original
    client.clear()
  }
}

describe('through the real sidebar hook', () => {
  afterEach(disposeAll)
  const signalsEntry = { moduleId: '199', menuId: '489', submenuId: '489' }

  it('draws no Product Portfolio, Products or Services entry, and highlights Market Signals for /portfolio, a Sub-product page and a Product page', async () => {
    const report = await throughTheHook({ products: true, services: true, portfolio: true })
    assert.deepEqual(report.sidebar.map((s) => s.label), ['Quotes', 'Price Books', 'Market Signals'], 'no Products, no Services, no Product Portfolio')
    assert.deepEqual(report.active.portfolio, signalsEntry)
    assert.deepEqual(report.active.subProduct, signalsEntry, '/portfolio/products/5 belongs to Market Signals')
    assert.deepEqual(report.active.product, signalsEntry, '/portfolio/scholarclone belongs to Market Signals')
    assert.deepEqual(report.active.ingestion, signalsEntry, 'and so do the other Signals tabs')
  })

  it('still resolves the two old addresses, to themselves (their pages redirect), for a person who could see them: a link built as old address + "/" + id keeps working', async () => {
    const report = await throughTheHook({ products: true, services: true, portfolio: true })
    assert.equal(report.resolved.products, '/module/crm/sales/products')
    assert.equal(report.resolved.services, '/module/crm/sales/services')
    assert.equal(report.resolved.portfolio, '/portfolio')
    assert.equal(report.resolved.priceBooks, '/module/crm/sales/price-books', 'another address resolves as ever')
  })

  it('does not resolve an old address a person could not see (the dashboard, as before)', async () => {
    const report = await throughTheHook({ products: false, services: false, portfolio: true })
    assert.equal(report.resolved.products, '/dashboard')
    assert.equal(report.resolved.services, '/dashboard')
  })

  it('draws no Services entry either for a person who has Services but not Products (the tab has the Type filter)', async () => {
    const report = await throughTheHook({ products: false, services: true, portfolio: true })
    assert.deepEqual(report.sidebar.map((s) => s.label), ['Quotes', 'Price Books', 'Market Signals'])
    assert.deepEqual(report.active.portfolio, signalsEntry)
  })

  it('keeps /portfolio on Market Signals for a person with neither row, as the tab always did', async () => {
    const report = await throughTheHook({ products: false, services: false, portfolio: true })
    assert.deepEqual(report.sidebar.map((s) => s.label), ['Quotes', 'Price Books', 'Market Signals'])
    assert.deepEqual(report.active.portfolio, signalsEntry)
  })
})
