import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from './scaffolds/dom-test-kit'
import type { NavModule, NavNode } from './gtg-navigation'
import { collapseSignalsNav } from './signals-nav'

/**
 * The sidebar after the Sales Kit got its own menu row (27 Nov 2026). The row (`/portfolio/sales-kit`, a sibling of the Product Portfolio row) is the rights row of a TAB of the Product page: it
 * carries the four flags the tab reads. It stays in the database with status 1 (a Role & Permissions save deletes the rights of every row that is not status 1), and the sidebar does not draw
 * it. Its address keeps resolving to itself for a person whose menu held the row, and Market Signals owns it when the person has that group.
 */

const SALES_KIT = '/portfolio/sales-kit'

const leaf = (id: number, label: string, accessLink: string | null): NavNode => ({ id: String(id), label, accessLink, children: [] })
const folder = (id: number, label: string, children: NavNode[]): NavNode => ({ id: String(id), label, accessLink: null, children })
const ROW = () => leaf(480, 'Sales Kit', SALES_KIT)
const LEADS = () => leaf(201, 'Leads', '/module/crm/marketing/leads')
const CAMPAIGNS = () => leaf(513, 'Campaigns', '/module/crm/marketing/campaigns')
/** Market Signals as the menu has it, with the Sales Kit row beside the Product Portfolio row, as the migration puts it. */
const signalsBranch = (withKit = true): NavNode => ({
  id: '489', label: 'Market Signals', accessLink: '/module/crm/signals',
  children: [leaf(490, 'Market Signals', '/signals'), leaf(491, 'Ingestion Engine', '/ingestion'), leaf(479, 'Product Portfolio', '/portfolio'), ...(withKit ? [ROW()] : [])],
})
const crm = (children: NavNode[]): NavModule => ({ id: '199', label: 'Sales & Marketing', short: 'S&M', accessLink: null, children })
const labels = (nodes: NavNode[]) => nodes.map((c) => c.label)
const MARKET_SIGNALS = { moduleId: '199', menuId: '489', submenuId: '489' }

describe('the Sales Kit row is not drawn in the sidebar', () => {
  it('claims the address when the row sits under Market Signals, where that group already draws no children, and Market Signals owns it', () => {
    const out = collapseSignalsNav([crm([signalsBranch(), folder(510, 'Marketing', [LEADS(), CAMPAIGNS()])])])
    const market = out.modules[0].children[0]
    assert.deepEqual(market.children, [], 'Market Signals is one flat link')
    assert.equal(market.accessLink, '/signals')
    assert.deepEqual(out.retired, [SALES_KIT], 'the address is still claimed, so it keeps resolving for a person whose menu held it')
    assert.deepEqual(out.owners[SALES_KIT], MARKET_SIGNALS)
    assert.deepEqual(out.owners['/portfolio'], MARKET_SIGNALS, 'and the Product Portfolio is still owned as before')
  })

  it('drops the row from wherever else a host has put it, keeps every neighbour in its order, and claims no owner without the Signals group', () => {
    const out = collapseSignalsNav([crm([LEADS(), ROW(), CAMPAIGNS()])])
    assert.deepEqual(labels(out.modules[0].children), ['Leads', 'Campaigns'])
    assert.deepEqual(out.retired, [SALES_KIT])
    assert.equal(out.owners[SALES_KIT], undefined, 'there is no Market Signals to highlight')
  })

  it('finds the row by its address, whatever its label, capitals or trailing slash, at any depth', () => {
    const renamed = leaf(480, 'Shelf', '/Portfolio/Sales-Kit/')
    const deep: NavModule[] = [{ id: '1', label: 'Mod', short: 'M', accessLink: null, children: [folder(10, 'Group', [folder(11, 'Inner', [renamed, LEADS()])])] }]
    const out = collapseSignalsNav(deep)
    assert.deepEqual(labels(out.modules[0].children[0].children[0].children), ['Leads'])
    assert.deepEqual(out.retired, [SALES_KIT])
  })

  it('does not touch a row of that address that has children, so nothing else can disappear with it', () => {
    const parent: NavNode = { ...ROW(), children: [leaf(901, 'Something else', '/y')] }
    const out = collapseSignalsNav([crm([parent, LEADS()])])
    assert.deepEqual(labels(out.modules[0].children), ['Sales Kit', 'Leads'])
    assert.deepEqual(out.retired, [])
  })

  it('does not fold a row that merely carries the NAME of the tab', () => {
    const namesake = leaf(900, 'Sales Kit', '/somewhere/else')
    const out = collapseSignalsNav([crm([namesake, LEADS()])])
    assert.deepEqual(labels(out.modules[0].children), ['Sales Kit', 'Leads'])
    assert.deepEqual(out.retired, [])
  })

  it('claims nothing, changes nothing and returns the same objects for a menu that never held the row', () => {
    const without = [crm([signalsBranch(false), LEADS()])]
    const before = JSON.stringify(without)
    const out = collapseSignalsNav(without)
    assert.equal(JSON.stringify(without), before, 'not changed in place')
    assert.deepEqual(out.retired, [])
    assert.equal(out.owners[SALES_KIT], undefined)
    const plain = [crm([LEADS(), CAMPAIGNS()])]
    assert.equal(collapseSignalsNav(plain).modules, plain)
  })

  it('does not change a menu that holds the row in place', () => {
    const withRow = [crm([signalsBranch(), LEADS(), ROW()])]
    const before = JSON.stringify(withRow)
    collapseSignalsNav(withRow)
    assert.equal(JSON.stringify(withRow), before)
  })
})

// ---------------------------------------------------------------------------------------------------------------------------- the real hook

const TENANT = 1
const PROFILE = 16
const raw = (n: NavNode, parent: number | null, sort: number): Record<string, unknown> => ({
  id: Number(n.id), label: n.label, icon: null, access_link: n.accessLink, page_type: n.children.length ? null : 'page', sort_order: sort, parent_id: parent,
  children: n.children.map((c, i) => raw(c, Number(n.id), i + 1)),
})

async function throughTheHook(holdsRow: boolean) {
  const k = await kit()
  /* eslint-disable @typescript-eslint/no-require-imports */
  // `require`, not `import()`: the hook loads these through the same loader, and a dynamic import would give this file a second copy of each module.
  const { AuthContext } = require('../components/auth/gtg-auth') as typeof import('../components/auth/gtg-auth')
  const { QueryClient, QueryClientProvider } = require('@tanstack/react-query') as typeof import('@tanstack/react-query')
  /* eslint-enable @typescript-eslint/no-require-imports */
  const { useSidebarNavigation } = await import('../hooks/use-sidebar-navigation')
  const tree: NavModule = crm([leaf(442, 'Command Center', '/module/crm/command-center'), signalsBranch(holdsRow), folder(510, 'Marketing', [LEADS(), CAMPAIGNS()])])
  const data = [{ ...tree, accessLink: '/module/crm' }].map((mod, i) => raw(mod, null, i + 1))
  k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: TENANT, user_id: 2, user_profile_id: PROFILE }))
  k.w.sessionStorage.setItem(`gtg-sidebar-cache-v3:${TENANT}:${PROFILE}`, JSON.stringify({ status_code: 200, message: 'ok', data }))
  const original = globalThis.fetch
  globalThis.fetch = (async () => new Response(JSON.stringify({ status_code: 200, message: 'ok', data }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })

  function Probe() {
    const nav = useSidebarNavigation()
    const report = {
      sidebar: nav.sidebarModules[0].children.map((c) => [c.label, c.accessLink, c.children.map((g) => g.label)]),
      resolved: nav.resolveAccessLink(SALES_KIT),
      active: nav.parseRoutePath('/portfolio/products/11'),
    }
    return k.h('pre', { 'data-report': '' }, JSON.stringify(report))
  }
  try {
    await k.render(k.h(QueryClientProvider, { client }, k.h(AuthContext.Provider, { value: { user: null } as never }, k.h(Probe))))
    await k.tick(40)
    return JSON.parse(k.one('[data-report]')!.textContent!) as { sidebar: Array<[string, string | null, string[]]>; resolved: string; active: unknown }
  } finally {
    globalThis.fetch = original
    client.clear()
  }
}

describe('through the real sidebar hook', () => {
  afterEach(disposeAll)

  it('draws no Sales Kit entry, keeps Market Signals as one flat link and every neighbour, and still resolves the address to itself for a person who held the row', async () => {
    const report = await throughTheHook(true)
    assert.deepEqual(report.sidebar, [['Command Center', '/module/crm/command-center', []], ['Market Signals', '/signals', []], ['Marketing', null, ['Leads', 'Campaigns']]])
    assert.equal(report.resolved, SALES_KIT)
    assert.deepEqual(report.active, MARKET_SIGNALS, 'a Product page still highlights Market Signals')
  })

  it('does not resolve the address for a person whose menu never held the row (the dashboard, as for any address they do not hold)', async () => {
    const report = await throughTheHook(false)
    assert.equal(report.resolved, '/dashboard')
    assert.deepEqual(report.sidebar[1], ['Market Signals', '/signals', []])
  })
})
