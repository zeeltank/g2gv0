import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from './scaffolds/dom-test-kit'
import type { NavModule, NavNode } from './gtg-navigation'
import { collapseSignalsNav } from './signals-nav'

/**
 * The sidebar after Master Fields (into Field settings) and Agent Run History (into the Run Log) were merged (26 Nov 2026; owner decision). Master Fields' row is deleted in the
 * database, so this fold only covers a host that still holds it; Agent Run History's row STAYS (the agent API checks a right on it), so it is only not drawn. Both old addresses
 * are redirect pages and keep resolving to themselves for a person whose menu held the row.
 */

const MASTER_FIELDS = '/module/crm/master-fields'
const AGENT_RUNS = '/module/crm/marketing/agent-runs'

const leaf = (id: number, label: string, accessLink: string | null): NavNode => ({ id: String(id), label, accessLink, children: [] })
const FIELDS = () => leaf(202, 'Master Fields', MASTER_FIELDS)
const RUNS = () => leaf(486, 'Agent Run History', AGENT_RUNS)
const LEADS = () => leaf(201, 'Leads', '/module/crm/marketing/leads')
const CAMPAIGNS = () => leaf(499, 'Campaigns', '/module/crm/marketing/campaigns')
const crm = (children: NavNode[]): NavModule => ({ id: '199', label: 'Sales & Marketing', short: 'S&M', accessLink: null, children })
const labels = (m: NavModule[]) => m[0].children.map((c) => c.label)

describe('Master Fields and Agent Run History are not drawn in the sidebar', () => {
  it('drops both rows and keeps their neighbours in their order', () => {
    const out = collapseSignalsNav([crm([LEADS(), FIELDS(), CAMPAIGNS(), RUNS()])])
    assert.deepEqual(labels(out.modules), ['Leads', 'Campaigns'])
  })

  it('drops each row on its own, and claims as retired only the address of a row that was there', () => {
    const onlyFields = collapseSignalsNav([crm([LEADS(), FIELDS()])])
    assert.deepEqual(labels(onlyFields.modules), ['Leads'])
    assert.deepEqual(onlyFields.retired, [MASTER_FIELDS])

    const onlyRuns = collapseSignalsNav([crm([LEADS(), RUNS()])])
    assert.deepEqual(labels(onlyRuns.modules), ['Leads'])
    assert.deepEqual(onlyRuns.retired, [AGENT_RUNS])

    const both = collapseSignalsNav([crm([FIELDS(), RUNS()])])
    assert.deepEqual([...both.retired].sort(), [AGENT_RUNS, MASTER_FIELDS].sort())
  })

  it('claims no owner to highlight: both new homes are screens of Platform Services and Agentic AI, not sidebar entries of this module', () => {
    const out = collapseSignalsNav([crm([LEADS(), FIELDS(), RUNS()])])
    assert.equal(out.owners[MASTER_FIELDS], undefined)
    assert.equal(out.owners[AGENT_RUNS], undefined)
  })

  it('finds each row by its address, whatever its label, capitals or trailing slash', () => {
    const renamed = [leaf(202, 'Picklists', '/Module/CRM/Master-Fields/'), leaf(486, 'Runs', '/MODULE/crm/marketing/Agent-Runs/')]
    const out = collapseSignalsNav([crm([LEADS(), ...renamed])])
    assert.deepEqual(labels(out.modules), ['Leads'])
    assert.deepEqual([...out.retired].sort(), [AGENT_RUNS, MASTER_FIELDS].sort())
  })

  it('finds the rows at any depth', () => {
    const deep: NavModule[] = [{ id: '1', label: 'Mod', short: 'M', accessLink: null, children: [{ id: '10', label: 'Group', accessLink: null, children: [FIELDS(), LEADS(), RUNS()] }] }]
    const out = collapseSignalsNav(deep)
    assert.deepEqual(out.modules[0].children[0].children.map((c) => c.label), ['Leads'])
  })

  it('does not touch a row of either address that has children, so nothing else can disappear with it', () => {
    const fieldsParent: NavNode = { ...FIELDS(), children: [leaf(901, 'Something else', '/y')] }
    const runsParent: NavNode = { ...RUNS(), children: [leaf(902, 'Another', '/z')] }
    const out = collapseSignalsNav([crm([fieldsParent, runsParent])])
    assert.deepEqual(labels(out.modules), ['Master Fields', 'Agent Run History'])
    assert.deepEqual(out.retired, [])
  })

  it('changes nothing in place, and returns the same objects when the person holds neither row', () => {
    const without = [crm([LEADS(), CAMPAIGNS()])]
    const before = JSON.stringify(without)
    const out = collapseSignalsNav(without)
    assert.equal(JSON.stringify(without), before)
    assert.equal(out.modules, without)
    assert.deepEqual(out.retired, [])

    const withRows = [crm([LEADS(), FIELDS(), RUNS()])]
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

async function throughTheHook(holdsRows: boolean) {
  const k = await kit()
  /* eslint-disable @typescript-eslint/no-require-imports */
  // `require`, not `import()`: the hook loads these through the same loader, and a dynamic import would give this file a second copy of each module.
  const { AuthContext } = require('../components/auth/gtg-auth') as typeof import('../components/auth/gtg-auth')
  const { QueryClient, QueryClientProvider } = require('@tanstack/react-query') as typeof import('@tanstack/react-query')
  /* eslint-enable @typescript-eslint/no-require-imports */
  const { useSidebarNavigation } = await import('../hooks/use-sidebar-navigation')
  const data = [crm([LEADS(), ...(holdsRows ? [FIELDS()] : []), CAMPAIGNS(), ...(holdsRows ? [RUNS()] : [])])].map((mod, i) => raw(mod, null, i + 1))
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
      fields: nav.resolveAccessLink(MASTER_FIELDS),
      runs: nav.resolveAccessLink(AGENT_RUNS),
    }
    return k.h('pre', { 'data-report': '' }, JSON.stringify(report))
  }
  try {
    await k.render(k.h(QueryClientProvider, { client }, k.h(AuthContext.Provider, { value: { user: null } as never }, k.h(Probe))))
    await k.tick(40)
    return JSON.parse(k.one('[data-report]')!.textContent!) as { sidebar: string[][]; tree: string[][]; fields: string; runs: string }
  } finally {
    globalThis.fetch = original
    client.clear()
  }
}

describe('through the real sidebar hook', () => {
  afterEach(disposeAll)

  it('draws neither entry, in the sidebar or in the tree routes are resolved from, and keeps the neighbours', async () => {
    const report = await throughTheHook(true)
    assert.deepEqual(report.sidebar, [['Leads', 'Campaigns']])
    assert.deepEqual(report.tree, [['Leads', 'Campaigns']])
  })

  it('still resolves both old addresses, each to itself, for a person whose menu held the rows (their pages redirect)', async () => {
    const report = await throughTheHook(true)
    assert.equal(report.fields, MASTER_FIELDS)
    assert.equal(report.runs, AGENT_RUNS)
  })

  it('does not resolve either old address for a person whose menu never held it (the dashboard, as before)', async () => {
    const report = await throughTheHook(false)
    assert.equal(report.fields, '/dashboard')
    assert.equal(report.runs, '/dashboard')
  })
})
