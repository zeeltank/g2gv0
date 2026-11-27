import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from './scaffolds/dom-test-kit'
import type { NavModule, NavNode } from './gtg-navigation'
import { collapseSignalsNav } from './signals-nav'

/**
 * The sidebar after Automation Rules were merged into Workflows (26 Nov 2026; owner decision). The menu ROW stays in the database with status 1 (a Role & Permissions save
 * deletes the rights of every row that is not status 1), so the change is made in code, the same way as Products, Services, Price Books and Contacts
 * (lib/crm/people-sidebar.test.ts): the row is not drawn, its old address still resolves to itself for a person who held the row (the address is a redirect page), and a
 * row that is not that row, or that has children, is left alone.
 */

const ADDRESS = '/module/crm/marketing/automation-rules'

const leaf = (id: number, label: string, accessLink: string | null): NavNode => ({ id: String(id), label, accessLink, children: [] })
const RULES = () => leaf(497, 'Automation Rules', ADDRESS)
const CAMPAIGNS = () => leaf(499, 'Campaigns', '/module/crm/marketing/campaigns')
const LEADS = () => leaf(201, 'Leads', '/module/crm/marketing/leads')
const crm = (children: NavNode[]): NavModule => ({ id: '199', label: 'Sales & Marketing', short: 'S&M', accessLink: null, children })

const labels = (m: NavModule[]) => m[0].children.map((c) => c.label)

describe('the Automation Rules row is not drawn in the sidebar', () => {
  it('drops the row and keeps its neighbours, Campaigns included, in their order', () => {
    const out = collapseSignalsNav([crm([LEADS(), RULES(), CAMPAIGNS()])])
    assert.deepEqual(labels(out.modules), ['Leads', 'Campaigns'])
  })

  it('keeps the old address resolvable, to itself, for a person whose menu held the row, and claims no owner to highlight', () => {
    const out = collapseSignalsNav([crm([LEADS(), RULES()])])
    assert.deepEqual(out.retired, [ADDRESS])
    assert.equal(out.owners[ADDRESS], undefined)
  })

  it('finds the row by its address, whatever its label, with a trailing slash and any capitals', () => {
    const renamed = leaf(497, 'Marketing rules', '/Module/CRM/marketing/Automation-Rules/')
    const out = collapseSignalsNav([crm([LEADS(), renamed])])
    assert.deepEqual(labels(out.modules), ['Leads'])
    assert.deepEqual(out.retired, [ADDRESS])
  })

  it('finds the row at any depth', () => {
    const deep: NavModule[] = [{ id: '1', label: 'Mod', short: 'M', accessLink: null, children: [{ id: '10', label: 'Group', accessLink: null, children: [RULES(), LEADS()] }] }]
    const out = collapseSignalsNav(deep)
    assert.deepEqual(out.modules[0].children[0].children.map((c) => c.label), ['Leads'])
    assert.deepEqual(out.retired, [ADDRESS])
  })

  it('does not touch a row of that address that has children, so nothing else can disappear with it', () => {
    const parent: NavNode = { ...RULES(), children: [leaf(901, 'Something else', '/y')] }
    const out = collapseSignalsNav([crm([parent])])
    assert.deepEqual(labels(out.modules), ['Automation Rules'])
    assert.deepEqual(out.retired, [], 'and it is not claimed as a retired address')
  })

  it('does not drop Campaigns or any other row of the same area', () => {
    const out = collapseSignalsNav([crm([CAMPAIGNS(), leaf(500, 'Quotes', '/module/crm/marketing/quotes')])])
    assert.deepEqual(labels(out.modules), ['Campaigns', 'Quotes'])
    assert.deepEqual(out.retired, [])
  })

  it('changes nothing in place, and returns the same objects when the person does not hold the row', () => {
    const without = [crm([LEADS(), CAMPAIGNS()])]
    const before = JSON.stringify(without)
    const out = collapseSignalsNav(without)
    assert.equal(JSON.stringify(without), before)
    assert.equal(out.modules, without, 'nothing to fold, so the same tree comes back')
    assert.deepEqual(out.retired, [])

    const withRow = [crm([LEADS(), RULES()])]
    const beforeRow = JSON.stringify(withRow)
    collapseSignalsNav(withRow)
    assert.equal(JSON.stringify(withRow), beforeRow, 'a menu with the row is not changed in place either')
  })

  it('leaves the Market Signals group as it was (a flat link to /signals, with its owners) when the row is dropped beside it', () => {
    const signals: NavNode = {
      id: '489', label: 'Market Signals', accessLink: '/module/crm/signals',
      children: [leaf(490, 'Market Signals', '/signals'), leaf(491, 'Ingestion Engine', '/ingestion')],
    }
    const out = collapseSignalsNav([crm([LEADS(), signals, RULES()])])
    assert.deepEqual(labels(out.modules), ['Leads', 'Market Signals'])
    const marketSignals = out.modules[0].children.find((c) => c.id === '489')!
    assert.equal(marketSignals.accessLink, '/signals')
    assert.deepEqual(marketSignals.children, [])
    assert.deepEqual(out.retired, [ADDRESS])
    assert.deepEqual(out.owners['/ingestion'], { moduleId: '199', menuId: '489', submenuId: '489' })
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
  const data = [crm([LEADS(), ...(holdsRow ? [RULES()] : []), CAMPAIGNS()])].map((mod, i) => raw(mod, null, i + 1))
  k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: TENANT, user_id: 2, user_profile_id: PROFILE }))
  k.w.sessionStorage.setItem(`gtg-sidebar-cache-v3:${TENANT}:${PROFILE}`, JSON.stringify({ status_code: 200, message: 'ok', data }))
  const original = globalThis.fetch
  globalThis.fetch = (async () => new Response(JSON.stringify({ status_code: 200, message: 'ok', data }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })

  function Probe() {
    const nav = useSidebarNavigation()
    const report = {
      sidebar: nav.sidebarModules.map((m) => m.children.map((c) => c.label)),
      tree: nav.modules.map((m) => m.children.map((c) => c.label)),
      resolved: nav.resolveAccessLink(ADDRESS),
      resolvedNeighbour: nav.resolveAccessLink('/module/crm/marketing/campaigns'),
    }
    return k.h('pre', { 'data-report': '' }, JSON.stringify(report))
  }
  try {
    await k.render(k.h(QueryClientProvider, { client }, k.h(AuthContext.Provider, { value: { user: null } as never }, k.h(Probe))))
    await k.tick(40)
    return JSON.parse(k.one('[data-report]')!.textContent!) as { sidebar: string[][]; tree: string[][]; resolved: string; resolvedNeighbour: string }
  } finally {
    globalThis.fetch = original
    client.clear()
  }
}

describe('through the real sidebar hook', () => {
  afterEach(disposeAll)

  it('draws no Automation Rules entry, in the sidebar or in the tree routes are resolved from, and keeps Campaigns', async () => {
    const report = await throughTheHook(true)
    assert.deepEqual(report.sidebar, [['Leads', 'Campaigns']])
    assert.deepEqual(report.tree, [['Leads', 'Campaigns']])
  })

  it('still resolves the old address, to itself, for a person whose menu held the row (its page redirects), and the neighbour as before', async () => {
    const report = await throughTheHook(true)
    assert.equal(report.resolved, ADDRESS)
    assert.equal(report.resolvedNeighbour, '/module/crm/marketing/campaigns')
  })

  it('does not resolve the old address for a person whose menu never held it (the dashboard, as before)', async () => {
    const report = await throughTheHook(false)
    assert.equal(report.resolved, '/dashboard')
    assert.equal(report.resolvedNeighbour, '/module/crm/marketing/campaigns')
  })
})
