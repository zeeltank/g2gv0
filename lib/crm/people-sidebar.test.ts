import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import type { NavModule, NavNode } from '../gtg-navigation'
import { collapseSignalsNav } from '../signals-nav'

/**
 * The sidebar after Contacts were merged into Organizations (S18, 25 Nov 2026; owner decision: "Contacts move under Organizations with no duplicated feature"). The two
 * Contacts menu ROWS (Sales & Marketing and Support) stay in the database with status 1 (a Role & Permissions save deletes the rights of every row that is not status 1),
 * so the change is made in code, the same way as Products, Services and Price Books (lib/portfolio-list/sidebar.test.ts): neither row is drawn, the old addresses still
 * resolve to themselves for a person who held the row, and a visit to either address highlights the Organizations row of the same area.
 */

const leaf = (id: number, label: string, accessLink: string | null): NavNode => ({ id: String(id), label, accessLink, children: [] })
const CONTACTS = () => leaf(451, 'Contacts', '/module/crm/marketing/contacts')
const SUPPORT_CONTACTS = () => leaf(452, 'Contacts', '/module/crm/support/contacts')
const ORGANIZATIONS = () => leaf(453, 'Organizations', '/module/crm/marketing/organizations')
const SUPPORT_ORGANIZATIONS = () => leaf(454, 'Organizations', '/module/crm/support/organizations')
const crm = (children: NavNode[]): NavModule => ({ id: '199', label: 'Sales & Marketing', short: 'S&M', accessLink: null, children })
const support = (children: NavNode[]): NavModule => ({ id: '300', label: 'Support', short: 'Sup', accessLink: null, children })

const ORGS_ENTRY = { moduleId: '199', menuId: '453', submenuId: '453' }
const SUPPORT_ORGS_ENTRY = { moduleId: '300', menuId: '454', submenuId: '454' }

function menu(have: { contacts: boolean; supportContacts: boolean; orgs?: boolean; supportOrgs?: boolean }): NavModule[] {
  return [
    crm([leaf(466, 'Quotes', '/module/crm/sales/quotes'), ...(have.contacts ? [CONTACTS()] : []), ...(have.orgs === false ? [] : [ORGANIZATIONS()])]),
    support([leaf(460, 'Tickets', '/module/crm/support/tickets'), ...(have.supportContacts ? [SUPPORT_CONTACTS()] : []), ...(have.supportOrgs === false ? [] : [SUPPORT_ORGANIZATIONS()])]),
  ]
}

const labels = (m: NavModule[], index: number) => m[index].children.map((c) => c.label)

describe('the Contacts rows are not drawn in the sidebar, with each combination of the two rows', () => {
  const combos: Array<[boolean, boolean]> = [[true, true], [true, false], [false, true], [false, false]]
  for (const [contacts, supportContacts] of combos) {
    it(`Sales & Marketing row: ${contacts}, Support row: ${supportContacts}`, () => {
      const out = collapseSignalsNav(menu({ contacts, supportContacts }))

      assert.deepEqual(labels(out.modules, 0), ['Quotes', 'Organizations'], 'no Contacts entry in Sales & Marketing')
      assert.deepEqual(labels(out.modules, 1), ['Tickets', 'Organizations'], 'none in Support')

      // The old addresses stay resolvable only for a row the person held, and highlight the Organizations row of the same area while being redirected.
      assert.deepEqual(out.retired, [...(contacts ? ['/module/crm/marketing/contacts'] : []), ...(supportContacts ? ['/module/crm/support/contacts'] : [])])
      assert.deepEqual(out.owners['/module/crm/marketing/contacts'], contacts ? ORGS_ENTRY : undefined)
      assert.deepEqual(out.owners['/module/crm/support/contacts'], supportContacts ? SUPPORT_ORGS_ENTRY : undefined)
    })
  }

  it('finds the rows by their address, whatever their label, so a renamed row is dropped too', () => {
    const renamed = leaf(451, 'Stakeholders', '/module/crm/marketing/contacts')
    const out = collapseSignalsNav([crm([renamed, ORGANIZATIONS()])])
    assert.deepEqual(labels(out.modules, 0), ['Organizations'])
  })

  it('finds the rows at any depth', () => {
    const deep: NavModule[] = [{ id: '1', label: 'Mod', short: 'M', accessLink: null, children: [{ id: '10', label: 'Group', accessLink: null, children: [CONTACTS(), ORGANIZATIONS()] }] }]
    const out = collapseSignalsNav(deep)
    assert.deepEqual(out.modules[0].children[0].children.map((c) => c.label), ['Organizations'])
    assert.deepEqual(out.retired, ['/module/crm/marketing/contacts'])
  })

  it('highlights the other area\'s Organizations row when the person has none in the area of the address, and nothing when they have none at all', () => {
    const noSupportOrgs = collapseSignalsNav(menu({ contacts: false, supportContacts: true, supportOrgs: false }))
    assert.deepEqual(noSupportOrgs.owners['/module/crm/support/contacts'], ORGS_ENTRY, 'falls back to the Sales & Marketing Organizations row')
    const noOrgs = collapseSignalsNav([crm([CONTACTS()])])
    assert.equal(noOrgs.owners['/module/crm/marketing/contacts'], undefined, 'no Organizations row, no owner')
    assert.deepEqual(noOrgs.retired, ['/module/crm/marketing/contacts'], 'the address still resolves to itself')
  })

  it('does not touch a Contacts row that has children, so nothing else can disappear with it, and drops the leaf', () => {
    const parent: NavNode = { ...CONTACTS(), children: [leaf(901, 'Something else', '/y')] }
    const out = collapseSignalsNav([crm([parent, ORGANIZATIONS()])])
    assert.deepEqual(labels(out.modules, 0), ['Contacts', 'Organizations'])
    assert.deepEqual(out.retired, [], 'and it is not claimed as a retired address')
    assert.deepEqual(labels(collapseSignalsNav([crm([CONTACTS()])]).modules, 0), [], 'the leaf is dropped')
  })

  it('changes nothing in place and returns the same objects when the person holds neither row', () => {
    const input = menu({ contacts: false, supportContacts: false })
    const before = JSON.stringify(input)
    const out = collapseSignalsNav(input)
    assert.equal(JSON.stringify(input), before, 'the input is not changed')
    assert.equal(out.modules, input, 'nothing to fold, so the same tree comes back')
    assert.deepEqual(out.retired, [])
    const withRows = menu({ contacts: true, supportContacts: true })
    const beforeRows = JSON.stringify(withRows)
    collapseSignalsNav(withRows)
    assert.equal(JSON.stringify(withRows), beforeRows, 'a menu with the rows is not changed in place either')
  })

  it('leaves the Products, Services and Price Books fold as it was when both folds apply', () => {
    const both: NavModule[] = [crm([
      leaf(466, 'Quotes', '/module/crm/sales/quotes'), leaf(468, 'Products', '/module/crm/sales/products'), CONTACTS(), ORGANIZATIONS(),
      { id: '489', label: 'Market Signals', accessLink: '/module/crm/signals', children: [leaf(490, 'Company Opportunities', '/signals'), leaf(492, 'Product Portfolio', '/portfolio')] },
    ])]
    const out = collapseSignalsNav(both)
    assert.deepEqual(labels(out.modules, 0), ['Quotes', 'Organizations', 'Market Signals'])
    assert.deepEqual(out.retired, ['/module/crm/sales/products', '/module/crm/marketing/contacts'])
    assert.deepEqual(out.owners['/module/crm/sales/products'], { moduleId: '199', menuId: '489', submenuId: '489' }, 'Products still highlights Market Signals')
    assert.deepEqual(out.owners['/module/crm/marketing/contacts'], ORGS_ENTRY, 'Contacts highlights Organizations')
  })
})

// ---------------------------------------------------------------------------------------------------------------------------- the real hook

const TENANT = 1
const PROFILE = 16
const raw = (n: NavNode, parent: number | null, sort: number): Record<string, unknown> => ({
  id: Number(n.id), label: n.label, icon: null, access_link: n.accessLink, page_type: n.children.length ? null : 'page', sort_order: sort, parent_id: parent,
  children: n.children.map((c, i) => raw(c, Number(n.id), i + 1)),
})

async function throughTheHook(have: { contacts: boolean; supportContacts: boolean }) {
  const k = await kit()
  /* eslint-disable @typescript-eslint/no-require-imports */
  // `require`, not `import()`: the hook loads these through the same loader, and a dynamic import would give this file a second copy of each module.
  const { AuthContext } = require('../../components/auth/gtg-auth') as typeof import('../../components/auth/gtg-auth')
  const { QueryClient, QueryClientProvider } = require('@tanstack/react-query') as typeof import('@tanstack/react-query')
  /* eslint-enable @typescript-eslint/no-require-imports */
  const { useSidebarNavigation } = await import('../../hooks/use-sidebar-navigation')
  const data = menu(have).map((mod, i) => raw(mod, null, i + 1))
  k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: TENANT, user_id: 2, user_profile_id: PROFILE }))
  k.w.sessionStorage.setItem(`gtg-sidebar-cache-v3:${TENANT}:${PROFILE}`, JSON.stringify({ status_code: 200, message: 'ok', data }))
  const original = globalThis.fetch
  globalThis.fetch = (async () => new Response(JSON.stringify({ status_code: 200, message: 'ok', data }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })

  function Probe() {
    const nav = useSidebarNavigation()
    const report = {
      sidebar: nav.sidebarModules.map((m) => m.children.map((c) => c.label)),
      active: { contact: nav.parseRoutePath('/module/crm/marketing/contacts/12'), supportContact: nav.parseRoutePath('/module/crm/support/contacts/12') },
      resolved: { contacts: nav.resolveAccessLink('/module/crm/marketing/contacts'), supportContacts: nav.resolveAccessLink('/module/crm/support/contacts') },
    }
    return k.h('pre', { 'data-report': '' }, JSON.stringify(report))
  }
  try {
    await k.render(k.h(QueryClientProvider, { client }, k.h(AuthContext.Provider, { value: { user: null } as never }, k.h(Probe))))
    await k.tick(40)
    return JSON.parse(k.one('[data-report]')!.textContent!) as {
      sidebar: string[][]
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

  it('draws no Contacts entry, and highlights Organizations for a person\'s old address in each area', async () => {
    const report = await throughTheHook({ contacts: true, supportContacts: true })
    assert.deepEqual(report.sidebar, [['Quotes', 'Organizations'], ['Tickets', 'Organizations']])
    assert.deepEqual(report.active.contact, ORGS_ENTRY, '/module/crm/marketing/contacts/12 belongs to Organizations')
    assert.deepEqual(report.active.supportContact, SUPPORT_ORGS_ENTRY, 'and the Support one to the Support Organizations row')
  })

  it('still resolves the old addresses, to themselves, for a person who could see them (their pages redirect)', async () => {
    const report = await throughTheHook({ contacts: true, supportContacts: true })
    assert.equal(report.resolved.contacts, '/module/crm/marketing/contacts')
    assert.equal(report.resolved.supportContacts, '/module/crm/support/contacts')
  })

  it('does not resolve an old address a person could not see (the dashboard, as before)', async () => {
    const report = await throughTheHook({ contacts: false, supportContacts: false })
    assert.equal(report.resolved.contacts, '/dashboard')
    assert.equal(report.resolved.supportContacts, '/dashboard')
    assert.equal(report.active.contact, null, 'and the address highlights nothing')
  })
})
