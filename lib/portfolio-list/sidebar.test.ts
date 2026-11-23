import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import type { NavModule, NavNode } from '../gtg-navigation'
import { collapseSignalsNav } from '../signals-nav'

/**
 * The sidebar after Products and Services became the Product Portfolio (owner decision of 13 Nov 2026, slice 15, track P3-A). The two menu ROWS (468, 469) stay in the
 * database with status 1 (a Role & Permissions save deletes the rights of every row that is not status 1), so the change is made in code, here: the Products row is
 * drawn as "Product Portfolio" at /portfolio, the Services row only for a person who has Services but not Products, and a visit to /portfolio highlights that entry.
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

describe('the Products and Services rows in the sidebar, with each combination of Products, Services and Portfolio rights', () => {
  const combos: Array<[boolean, boolean, boolean]> = []
  for (const products of [true, false]) for (const services of [true, false]) for (const portfolio of [true, false]) combos.push([products, services, portfolio])

  for (const [products, services, portfolio] of combos) {
    const name = `Products ${products ? 'yes' : 'no'}, Services ${services ? 'yes' : 'no'}, Portfolio tab ${portfolio ? 'yes' : 'no'}`
    it(name, () => {
      const out = collapseSignalsNav(menu({ products, services, portfolio }))
      const shown = labels(out.modules)

      // The Products row is the Product Portfolio entry, in the slot Products had.
      assert.equal(shown.includes('Products'), false, 'the word Products is never drawn')
      assert.equal(shown.includes('Product Portfolio'), products, 'the Product Portfolio entry is the Products row, shown only to a person who holds it')
      if (products) {
        const entry = find(out.modules, '468')!
        assert.equal(entry.label, 'Product Portfolio')
        assert.equal(entry.accessLink, '/portfolio')
        assert.equal(shown.indexOf('Product Portfolio'), shown.indexOf('Quotes') + 1, 'it sits where Products sat: right after Quotes')
      }

      // The Services row is drawn only for a person who has Services but not Products, and opens the list on Services.
      assert.equal(shown.includes('Services'), services && !products, 'Services is shown only to a person who has it and not Products')
      if (services && !products) {
        const entry = find(out.modules, '469')!
        assert.equal(entry.accessLink, '/portfolio?type=service')
        assert.equal(entry.label, 'Services')
      }

      // A visit to /portfolio highlights the entry the person has: the Product Portfolio, else Services, else (as before) Market Signals, else nothing.
      const owner = out.owners['/portfolio']
      if (products) assert.deepEqual(owner, { moduleId: '199', menuId: '468', submenuId: '468' }, 'the Product Portfolio entry, not Market Signals')
      else if (services) assert.deepEqual(owner, { moduleId: '199', menuId: '469', submenuId: '469' }, 'the Services entry')
      else assert.deepEqual(owner, { moduleId: '199', menuId: '489', submenuId: '489' }, 'Market Signals, as before')

      // The old addresses stay resolvable (their pages redirect) only for a row the person held.
      assert.deepEqual(out.retired, [...(products ? ['/module/crm/sales/products'] : []), ...(services ? ['/module/crm/sales/services'] : [])])

      // Everything else in the menu is untouched.
      assert.ok(shown.includes('Quotes') && shown.includes('Price Books') && shown.includes('Market Signals'))
      assert.deepEqual(find(out.modules, '489')!.children, [], 'Market Signals stays one flat link')
    })
  }

  it('highlights the Product Portfolio entry for the old addresses too (a visit that is still being redirected)', () => {
    const out = collapseSignalsNav(menu({ products: true, services: true, portfolio: true }))
    const entry = { moduleId: '199', menuId: '468', submenuId: '468' }
    for (const path of ['/portfolio', '/module/crm/sales/products', '/module/crm/sales/services']) assert.deepEqual(out.owners[path], entry, path)
  })

  it('keeps the Signals tabs as they are: /ingestion and /partners still highlight Market Signals, /portfolio no longer does when the person has the entry', () => {
    const out = collapseSignalsNav(menu({ products: true, services: false, portfolio: true }))
    const signalsEntry = { moduleId: '199', menuId: '489', submenuId: '489' }
    assert.deepEqual(out.owners['/ingestion'], signalsEntry)
    assert.deepEqual(out.owners['/partners'], signalsEntry)
    assert.deepEqual(out.owners['/signals'], signalsEntry)
    assert.notDeepEqual(out.owners['/portfolio'], signalsEntry)
  })

  it('does not touch a Products row that has children, so nothing else can change with it', () => {
    const parent: NavNode = { ...PRODUCTS(), children: [leaf(900, 'Something', '/x')] }
    const out = collapseSignalsNav([crm([parent, SERVICES()])])
    assert.equal(find(out.modules, '468')!.label, 'Products')
    assert.equal(find(out.modules, '468')!.accessLink, '/module/crm/sales/products')
    assert.equal(find(out.modules, '469')!.accessLink, '/portfolio?type=service', 'the Services row is the entry here, because the person has no Products LEAF')
  })

  it('finds the rows by their address, whatever their label, so a renamed row still folds', () => {
    const renamed = leaf(468, 'Catalogue', '/module/crm/sales/products')
    const out = collapseSignalsNav([crm([renamed])])
    assert.equal(out.modules[0].children[0].label, 'Product Portfolio')
  })

  it('finds the rows at any depth, and tells the highlight where they are', () => {
    const deep: NavModule[] = [{ id: '1', label: 'Mod', short: 'M', accessLink: null, children: [{ id: '10', label: 'Group', accessLink: null, children: [PRODUCTS(), SERVICES()] }] }]
    const out = collapseSignalsNav(deep)
    assert.deepEqual(out.modules[0].children[0].children.map((c) => c.label), ['Product Portfolio'])
    assert.deepEqual(out.owners['/portfolio'], { moduleId: '1', menuId: '10', submenuId: '468' }, 'the same triple the sidebar hook files the entry under')
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
      route: { portfolio: nav.getRoutePath({ moduleId: '199', menuId: '468', submenuId: '468' }), services: nav.getRoutePath({ moduleId: '199', menuId: '469', submenuId: '469' }) },
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
      route: Record<string, string | null>
      resolved: Record<string, string>
    }
  } finally {
    globalThis.fetch = original
    client.clear()
  }
}

describe('through the real sidebar hook', () => {
  afterEach(disposeAll)

  it('draws Product Portfolio where Products was, highlights it for /portfolio and for a Sub-product and a Product page, and sends its click to /portfolio', async () => {
    const report = await throughTheHook({ products: true, services: true, portfolio: true })
    assert.deepEqual(report.sidebar.map((s) => s.label), ['Quotes', 'Product Portfolio', 'Price Books', 'Market Signals'], 'no Products, no Services')
    const entry = { moduleId: '199', menuId: '468', submenuId: '468' }
    assert.deepEqual(report.active.portfolio, entry)
    assert.deepEqual(report.active.subProduct, entry, '/portfolio/products/5 belongs to the same entry')
    assert.deepEqual(report.active.product, entry, '/portfolio/scholarclone belongs to the same entry')
    assert.deepEqual(report.active.ingestion, { moduleId: '199', menuId: '489', submenuId: '489' }, 'the other Signals tabs still highlight Market Signals')
    assert.equal(report.route.portfolio, '/portfolio', 'clicking the entry opens /portfolio')
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

  it('draws Services (and opens the list on Services) for a person who has Services but not Products, and highlights it for /portfolio', async () => {
    const report = await throughTheHook({ products: false, services: true, portfolio: true })
    assert.deepEqual(report.sidebar.map((s) => s.label), ['Quotes', 'Services', 'Price Books', 'Market Signals'])
    assert.equal(report.sidebar.find((s) => s.id === '469')!.accessLink, '/portfolio?type=service')
    assert.deepEqual(report.active.portfolio, { moduleId: '199', menuId: '469', submenuId: '469' })
    assert.equal(report.route.services, '/portfolio?type=service')
  })

  it('keeps /portfolio on Market Signals for a person with neither row, as the tab always did', async () => {
    const report = await throughTheHook({ products: false, services: false, portfolio: true })
    assert.deepEqual(report.sidebar.map((s) => s.label), ['Quotes', 'Price Books', 'Market Signals'])
    assert.deepEqual(report.active.portfolio, { moduleId: '199', menuId: '489', submenuId: '489' })
  })
})
