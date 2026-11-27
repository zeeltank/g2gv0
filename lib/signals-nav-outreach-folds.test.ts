import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from './scaffolds/dom-test-kit'
import type { NavModule, NavNode } from './gtg-navigation'
import { collapseSignalsNav, SIGNALS_TABS } from './signals-nav'

/**
 * The sidebar after Outreach, Outreach Approvals and the two SMS Notifiers were merged into the Outreach tab of Market Signals (27 Nov 2026; owner decision). The four menu rows stay
 * in the database with status 1 (a Role & Permissions save deletes the rights of every row that is not status 1); `/gtm/outreach` is now the Outreach tab's rights row. The sidebar
 * does not draw them, each old address is a redirect page and keeps resolving to itself for a person whose menu held the row, and the row of the tab must not make the Marketing folder
 * it sits in behave like the Signals group.
 */

const OUTREACH = '/gtm/outreach'
const APPROVALS = '/module/crm/marketing/outreach-approvals'
const SMS_SALES = '/module/crm/sales/sms-notifier'
const SMS_SUPPORT = '/module/crm/support/sms-notifier'
const ALL_FOUR = [OUTREACH, APPROVALS, SMS_SALES, SMS_SUPPORT]

const leaf = (id: number, label: string, accessLink: string | null): NavNode => ({ id: String(id), label, accessLink, children: [] })
const folder = (id: number, label: string, children: NavNode[]): NavNode => ({ id: String(id), label, accessLink: null, children })
const OUTREACH_ROW = () => leaf(511, 'Outreach', OUTREACH)
const APPROVALS_ROW = () => leaf(512, 'Outreach Approvals', APPROVALS)
const SMS_SALES_ROW = () => leaf(522, 'SMS Notifier', SMS_SALES)
const SMS_SUPPORT_ROW = () => leaf(532, 'SMS Notifier', SMS_SUPPORT)
const LEADS = () => leaf(201, 'Leads', '/module/crm/marketing/leads')
const CAMPAIGNS = () => leaf(513, 'Campaigns', '/module/crm/marketing/campaigns')
const TICKETS = () => leaf(531, 'Tickets', '/module/crm/support/tickets')
/** Market Signals as the menu has it: the rows of the first three tabs under it. The Outreach tab's row is NOT among them. */
const signalsBranch = (): NavNode => ({
  id: '489', label: 'Market Signals', accessLink: '/module/crm/signals',
  children: [leaf(490, 'Market Signals', '/signals'), leaf(491, 'Ingestion Engine', '/ingestion'), leaf(492, 'Product Portfolio', '/portfolio')],
})
const crm = (children: NavNode[]): NavModule => ({ id: '199', label: 'Sales & Marketing', short: 'S&M', accessLink: null, children })
const labels = (nodes: NavNode[]) => nodes.map((c) => c.label)
const MARKET_SIGNALS = { moduleId: '199', menuId: '489', submenuId: '489' }

/** The menu as a host holds it once the four rows are all there: Outreach and Approvals in the Marketing folder, one SMS Notifier in Sales and one in Support. */
const everything = (withSignals = true): NavModule[] => [crm([
  ...(withSignals ? [signalsBranch()] : []),
  folder(510, 'Marketing', [LEADS(), OUTREACH_ROW(), APPROVALS_ROW(), CAMPAIGNS()]),
  folder(520, 'Sales', [leaf(521, 'Opportunities', '/module/crm/sales/opportunities'), SMS_SALES_ROW()]),
  folder(530, 'Support', [TICKETS(), SMS_SUPPORT_ROW()]),
])]

describe('the four Outreach rows are not drawn in the sidebar', () => {
  it('drops all four rows and keeps every neighbour in its order', () => {
    const out = collapseSignalsNav(everything())
    const [, marketing, sales, support] = out.modules[0].children
    assert.deepEqual(labels(marketing.children), ['Leads', 'Campaigns'])
    assert.deepEqual(labels(sales.children), ['Opportunities'])
    assert.deepEqual(labels(support.children), ['Tickets'])
    assert.deepEqual([...out.retired].sort(), [...ALL_FOUR].sort(), 'each of the four addresses is claimed as retired, so a link built from it still resolves')
  })

  it('drops each row on its own, and claims as retired only the address of a row that was there', () => {
    const cases: Array<[string, NavNode]> = [[OUTREACH, OUTREACH_ROW()], [APPROVALS, APPROVALS_ROW()], [SMS_SALES, SMS_SALES_ROW()], [SMS_SUPPORT, SMS_SUPPORT_ROW()]]
    for (const [address, row] of cases) {
      const out = collapseSignalsNav([crm([LEADS(), row, CAMPAIGNS()])])
      assert.deepEqual(labels(out.modules[0].children), ['Leads', 'Campaigns'], address)
      assert.deepEqual(out.retired, [address], address)
    }
  })

  it('finds each row by its address, whatever its label, capitals or trailing slash', () => {
    const renamed = [leaf(511, 'Write to people', '/GTM/Outreach/'), leaf(512, 'Queue', '/Module/CRM/Marketing/Outreach-Approvals'), leaf(522, 'Texts', '/module/crm/sales/SMS-notifier/'), leaf(532, 'Text log', '/MODULE/crm/support/sms-notifier')]
    const out = collapseSignalsNav([crm([LEADS(), ...renamed])])
    assert.deepEqual(labels(out.modules[0].children), ['Leads'])
    assert.deepEqual([...out.retired].sort(), [...ALL_FOUR].sort())
  })

  it('finds the rows at any depth', () => {
    const deep: NavModule[] = [{ id: '1', label: 'Mod', short: 'M', accessLink: null, children: [folder(10, 'Group', [folder(11, 'Inner', [OUTREACH_ROW(), LEADS(), SMS_SALES_ROW()])])] }]
    const out = collapseSignalsNav(deep)
    assert.deepEqual(labels(out.modules[0].children[0].children[0].children), ['Leads'])
  })

  it('does not touch a row of those addresses that has children, so nothing else can disappear with it', () => {
    const outreachParent: NavNode = { ...OUTREACH_ROW(), children: [leaf(901, 'Something else', '/y')] }
    const smsParent: NavNode = { ...SMS_SALES_ROW(), children: [leaf(902, 'Another', '/z')] }
    const out = collapseSignalsNav([crm([outreachParent, smsParent])])
    assert.deepEqual(labels(out.modules[0].children), ['Outreach', 'SMS Notifier'])
    assert.deepEqual(out.retired, [])
  })

  it('does not draw a row that merely carries the NAME of the tab: only the four addresses are folded, and nothing is folded into Market Signals by its label', () => {
    const namesake = leaf(900, 'Outreach', '/somewhere/else')
    const out = collapseSignalsNav([crm([signalsBranch(), folder(510, 'Marketing', [LEADS(), namesake])])])
    assert.deepEqual(labels(out.modules[0].children[1].children), ['Leads', 'Outreach'], 'the namesake stays where it was')
    assert.equal(out.owners['/somewhere/else'], undefined, 'and Market Signals does not own its address')
    assert.deepEqual(out.retired, [])
  })

  it('changes nothing in place, and returns the same objects when the person holds none of the rows', () => {
    const without = [crm([LEADS(), CAMPAIGNS()])]
    const before = JSON.stringify(without)
    const out = collapseSignalsNav(without)
    assert.equal(JSON.stringify(without), before)
    assert.equal(out.modules, without)
    assert.deepEqual(out.retired, [])

    const withRows = everything()
    const beforeRows = JSON.stringify(withRows)
    collapseSignalsNav(withRows)
    assert.equal(JSON.stringify(withRows), beforeRows, 'a menu with the rows is not changed in place either')
  })
})

describe('the tab and the fold do not fight over /gtm/outreach', () => {
  it('lists Outreach as the fourth tab, on the existing /gtm/outreach row, going to /signals/outreach', () => {
    const tab = SIGNALS_TABS[3]
    assert.deepEqual({ key: tab.key, label: tab.label, href: tab.href, route: tab.route }, { key: 'outreach', label: 'Outreach', href: OUTREACH, route: '/signals/outreach' })
  })

  it('leaves the Marketing folder the way it was: not folded into Market Signals, and its own address and children untouched', () => {
    const out = collapseSignalsNav(everything())
    const marketing = out.modules[0].children.find((c) => c.id === '510')!
    assert.equal(marketing.accessLink, null, 'the folder did not take over a Signals address')
    assert.deepEqual(labels(marketing.children), ['Leads', 'Campaigns'])
    const marketSignals = out.modules[0].children.find((c) => c.id === '489')!
    assert.equal(marketSignals.accessLink, '/signals', 'Market Signals still resolves to /signals')
    assert.deepEqual(marketSignals.children, [])
  })

  it('keeps every Signals address owned by Market Signals, and not by the folder that held the Outreach row', () => {
    const out = collapseSignalsNav(everything())
    for (const address of ['/signals', '/module/crm/signals', '/ingestion', '/portfolio', '/signals/portfolio']) assert.deepEqual(out.owners[address], MARKET_SIGNALS, address)
  })

  it('has Market Signals own the tab\'s address and route, and no owner for the other three old addresses', () => {
    const out = collapseSignalsNav(everything())
    assert.deepEqual(out.owners[OUTREACH], MARKET_SIGNALS, 'a visit to the old /gtm/outreach highlights Market Signals, as /ingestion and /portfolio do')
    assert.deepEqual(out.owners['/signals/outreach'], MARKET_SIGNALS, 'and so does the tab\'s own route')
    for (const address of [APPROVALS, SMS_SALES, SMS_SUPPORT]) assert.equal(out.owners[address], undefined, address)
  })

  it('claims no owner at all for a person whose menu has no Market Signals group', () => {
    const out = collapseSignalsNav(everything(false))
    assert.equal(out.tabs, null, 'no Signals group in this menu')
    for (const address of ALL_FOUR) assert.equal(out.owners[address], undefined, address)
    assert.deepEqual([...out.retired].sort(), [...ALL_FOUR].sort(), 'the rows are still not drawn, and the addresses still resolve')
    assert.deepEqual(labels(out.modules[0].children[0].children), ['Leads', 'Campaigns'])
  })
})

// ---------------------------------------------------------------------------------------------------------------------------- the real hook

const TENANT = 1
const PROFILE = 16
const raw = (n: NavNode, parent: number | null, sort: number): Record<string, unknown> => ({
  id: Number(n.id), label: n.label, icon: null, access_link: n.accessLink, page_type: n.children.length ? null : 'page', sort_order: sort, parent_id: parent,
  children: n.children.map((c, i) => raw(c, Number(n.id), i + 1)),
})

async function throughTheHook(holdsRows: boolean) {
  const k = await kit()
  /* eslint-disable @typescript-eslint/no-require-imports */
  // `require`, not `import()`: the hook loads these through the same loader, and a dynamic import would give this file a second copy of each module.
  const { AuthContext } = require('../components/auth/gtg-auth') as typeof import('../components/auth/gtg-auth')
  const { QueryClient, QueryClientProvider } = require('@tanstack/react-query') as typeof import('@tanstack/react-query')
  /* eslint-enable @typescript-eslint/no-require-imports */
  const { useSidebarNavigation } = await import('../hooks/use-sidebar-navigation')
  const without = (rows: NavNode[]) => rows.filter((r) => holdsRows || !ALL_FOUR.includes(r.accessLink ?? ''))
  const tree: NavModule = crm([
    leaf(442, 'Command Center', '/module/crm/command-center'),
    signalsBranch(),
    folder(510, 'Marketing', without([LEADS(), OUTREACH_ROW(), APPROVALS_ROW(), CAMPAIGNS()])),
    folder(520, 'Sales', without([leaf(521, 'Opportunities', '/module/crm/sales/opportunities'), SMS_SALES_ROW()])),
    folder(530, 'Support', without([TICKETS(), SMS_SUPPORT_ROW()])),
  ])
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
      tree: nav.modules[0].children.map((c) => [c.label, c.children.map((g) => g.label)]),
      resolved: Object.fromEntries([...ALL_FOUR, '/signals'].map((address) => [address, nav.resolveAccessLink(address)])),
      active: { signals: nav.parseRoutePath('/signals'), tab: nav.parseRoutePath('/signals/outreach'), company: nav.parseRoutePath('/signals/outreach/12'), old: nav.parseRoutePath(OUTREACH) },
    }
    return k.h('pre', { 'data-report': '' }, JSON.stringify(report))
  }
  try {
    await k.render(k.h(QueryClientProvider, { client }, k.h(AuthContext.Provider, { value: { user: null } as never }, k.h(Probe))))
    await k.tick(40)
    return JSON.parse(k.one('[data-report]')!.textContent!) as {
      sidebar: Array<[string, string | null, string[]]>
      tree: Array<[string, string[]]>
      resolved: Record<string, string>
      active: Record<string, unknown>
    }
  } finally {
    globalThis.fetch = original
    client.clear()
  }
}

describe('through the real sidebar hook', () => {
  afterEach(disposeAll)

  it('draws none of the four rows, in the sidebar or in the tree routes are resolved from, and keeps every neighbour and Market Signals as one flat link', async () => {
    const report = await throughTheHook(true)
    assert.deepEqual(report.sidebar, [
      ['Command Center', '/module/crm/command-center', []],
      ['Market Signals', '/signals', []],
      ['Marketing', null, ['Leads', 'Campaigns']],
      ['Sales', null, ['Opportunities']],
      ['Support', null, ['Tickets']],
    ])
    assert.deepEqual(report.tree, [['Command Center', []], ['Market Signals', []], ['Marketing', ['Leads', 'Campaigns']], ['Sales', ['Opportunities']], ['Support', ['Tickets']]])
  })

  it('still resolves each old address, to itself, for a person whose menu held the row (their pages redirect), and Market Signals to /signals', async () => {
    const report = await throughTheHook(true)
    for (const address of ALL_FOUR) assert.equal(report.resolved[address], address, address)
    assert.equal(report.resolved['/signals'], '/signals')
  })

  it('does not resolve an old address for a person whose menu never held it (the dashboard, as before)', async () => {
    const report = await throughTheHook(false)
    for (const address of ALL_FOUR) assert.equal(report.resolved[address], '/dashboard', address)
    assert.equal(report.resolved['/signals'], '/signals')
  })

  it('keeps the sidebar on Market Signals for the tab, a company page under it and the old Outreach address', async () => {
    const report = await throughTheHook(true)
    assert.deepEqual(report.active.signals, MARKET_SIGNALS)
    assert.deepEqual(report.active.tab, MARKET_SIGNALS, '/signals/outreach')
    assert.deepEqual(report.active.company, MARKET_SIGNALS, '/signals/outreach/12 belongs to the nearest address above it')
    assert.deepEqual(report.active.old, MARKET_SIGNALS, '/gtm/outreach')
  })
})
