import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from './scaffolds/dom-test-kit'
import type { NavModule, NavNode } from './gtg-navigation'
import { collapseSignalsNav, SIGNALS_TABS, visibleSignalsTabs } from './signals-nav'

/**
 * The Signal Review row (menu 506) is retired as a screen (merged into Company Opportunities, 13 Nov 2026) but stays in the database with status 1, because a
 * Role & Permissions save deletes the rights of every row that is not status 1. So the sidebar must never draw it, whatever a person's rights, and a visit to its
 * old address must highlight Market Signals. Written beside lib/signals-screen.test.ts, which pins the four tabs and stays as it is.
 */

const leaf = (id: number, label: string, accessLink: string | null): NavNode => ({ id: String(id), label, accessLink, children: [] })

/** Market Signals as the live menu has it: the four tabs and Signal Inbox under it. */
const signalsBranch = (): NavNode => ({
  id: '489', label: 'Market Signals', accessLink: '/module/crm/signals',
  children: [
    leaf(490, 'Company Opportunities', '/signals'), leaf(491, 'Ingestion Engine', '/ingestion'), leaf(492, 'Product Portfolio', '/portfolio'),
    leaf(493, 'Partner Network', '/partners'), leaf(501, 'Signal Inbox', '/module/crm/marketing/signal-inbox'),
  ],
})

const REVIEW = (): NavNode => leaf(506, 'Signal Review', '/signal-review')

const crm = (children: NavNode[]): NavModule => ({ id: '199', label: 'Sales & Marketing Intelligence', short: 'S&M', accessLink: null, children })

const everyNode = (nodes: NavNode[]): NavNode[] => nodes.flatMap((n) => [n, ...everyNode(n.children)])
const holdsReview = (nodes: NavNode[]) => everyNode(nodes).some((n) => n.id === '506' || n.label.trim().toLowerCase() === 'signal review' || /signal-review/i.test(n.accessLink ?? ''))
const ids = (nodes: NavNode[]) => nodes.map((n) => n.id)

describe('the sidebar never shows Signal Review', () => {
  it('drops the row from the CRM root, where the menu holds it beside Market Signals, for a person who holds the right', () => {
    const input = [crm([leaf(442, 'Command Center', '/module/crm/command-center'), signalsBranch(), REVIEW(), leaf(10, 'Reports', '/reports')])]
    assert.equal(holdsReview(input), true, 'the fixture does hold the row')
    const result = collapseSignalsNav(input)
    assert.equal(holdsReview(result.modules), false)
    assert.deepEqual(ids(result.modules[0].children), ['442', '489', '10'], 'only the Review row went; the order of the rest is kept')
  })

  it('gives a person who does not hold the right exactly the same sidebar', () => {
    const base = () => [crm([leaf(442, 'Command Center', '/module/crm/command-center'), signalsBranch(), leaf(10, 'Reports', '/reports')])]
    const withRow = collapseSignalsNav([crm([leaf(442, 'Command Center', '/module/crm/command-center'), signalsBranch(), REVIEW(), leaf(10, 'Reports', '/reports')])])
    const without = collapseSignalsNav(base())
    assert.deepEqual(withRow.modules, without.modules)
    assert.deepEqual(withRow.tabs, without.tabs)
    assert.deepEqual(withRow.owners, without.owners)
  })

  it('leaves Market Signals a flat link to /signals with no children, and the four tabs as they are', () => {
    const result = collapseSignalsNav([crm([signalsBranch(), REVIEW()])])
    const marketSignals = result.modules[0].children.find((c) => c.id === '489')!
    assert.equal(marketSignals.accessLink, '/signals')
    assert.deepEqual(marketSignals.children, [])
    assert.deepEqual(SIGNALS_TABS.map((t) => t.href), ['/signals', '/ingestion', '/portfolio', '/partners'])
    assert.deepEqual(visibleSignalsTabs(result.tabs).map((t) => t.href), ['/signals', '/ingestion', '/portfolio', '/partners'])
    for (const href of ['/signals', '/ingestion', '/portfolio', '/partners']) assert.deepEqual(result.owners[href], { moduleId: '199', menuId: '489', submenuId: '489' }, href)
  })

  it('drops it wherever it is nested, under either address or by its name, and keeps its neighbours', () => {
    const cases: Array<[string, () => NavModule[]]> = [
      ['under another parent', () => [crm([{ ...leaf(10, 'Reports', null), children: [leaf(11, 'Pipeline', '/reports/pipeline'), REVIEW()] }])]],
      ['two levels down', () => [crm([{ ...leaf(10, 'Reports', null), children: [{ ...leaf(11, 'More', null), children: [REVIEW(), leaf(12, 'Pipeline', '/reports/pipeline')] }] }])]],
      ['under Market Signals itself, where the first migration put it', () => [crm([leaf(10, 'Reports', '/reports'), { ...signalsBranch(), children: [...signalsBranch().children, REVIEW()] }])]],
      ['by the other address', () => [crm([leaf(10, 'Reports', '/reports'), leaf(506, 'Signal Review', '/module/crm/signal-review')])]],
      ['with a different capitalisation and a trailing slash', () => [crm([leaf(10, 'Reports', '/reports'), leaf(506, 'Review of signals', '/Signal-Review/')])]],
      ['by its name when the address is missing', () => [crm([leaf(10, 'Reports', '/reports'), leaf(506, ' Signal Review ', null)])]],
      ['as a module of its own', () => [crm([leaf(10, 'Reports', '/reports')]), { ...leaf(506, 'Signal Review', '/signal-review'), short: 'SR', standalone: true }]],
    ]
    for (const [name, build] of cases) {
      const input = build()
      assert.equal(holdsReview(input), true, `${name}: the fixture holds the row`)
      const result = collapseSignalsNav(input)
      assert.equal(holdsReview(result.modules), false, name)
      assert.ok(everyNode(result.modules).some((n) => n.label === 'Reports'), `${name}: the neighbour stays`)
    }
  })

  it('drops it even for a person whose menu holds no Signals row at all (there is nothing to rebuild the tree for)', () => {
    const input = [crm([leaf(201, 'Leads', '/module/crm/marketing/leads'), REVIEW()])]
    const result = collapseSignalsNav(input)
    assert.equal(result.tabs, null, 'no Signals group in this menu')
    assert.deepEqual(ids(result.modules[0].children), ['201'])
  })

  it('does not drop a row of that name that has children: nothing else may vanish with it', () => {
    const odd: NavNode = { ...REVIEW(), children: [leaf(900, 'Something else', '/something-else')] }
    const result = collapseSignalsNav([crm([odd])])
    assert.deepEqual(ids(result.modules[0].children), ['506'])
    assert.deepEqual(ids(result.modules[0].children[0].children), ['900'])
  })

  it('sends a visit to either address to the Market Signals entry, for the highlight and the breadcrumb, as /signals does', () => {
    const result = collapseSignalsNav([crm([signalsBranch(), REVIEW()])])
    const marketSignals = { moduleId: '199', menuId: '489', submenuId: '489' }
    assert.deepEqual(result.owners['/signal-review'], marketSignals)
    assert.deepEqual(result.owners['/module/crm/signal-review'], marketSignals)
    assert.deepEqual(result.owners['/signal-review'], result.owners['/signals'])
  })

  it('changes nothing in place, and returns the same objects when there is nothing to drop', () => {
    const input = [crm([leaf(442, 'Command Center', '/module/crm/command-center'), signalsBranch(), REVIEW()])]
    const before = JSON.stringify(input)
    collapseSignalsNav(input)
    assert.equal(JSON.stringify(input), before, 'the input tree is not touched')

    const plain = [crm([leaf(10, 'Reports', '/reports')])]
    assert.equal(collapseSignalsNav(plain).modules, plain, 'a menu with no Signals group and no Review row comes back untouched')
    const untouchedBranch = leaf(10, 'Reports', '/reports')
    const mixed = collapseSignalsNav([crm([untouchedBranch, REVIEW()])])
    assert.equal(mixed.modules[0].children[0], untouchedBranch, 'a sibling of the dropped row is the same object')
  })
})

// ── Through the real sidebar hook ────────────────────────────────────────────────────────────────────────────────────────────────────────

const PROFILE = 16
const TENANT = 1
const raw = (id: number, label: string, accessLink: string | null, parent: number | null, sort: number, children: unknown[] = []) => (
  { id, label, icon: null, access_link: accessLink, page_type: accessLink ? 'page' : null, sort_order: sort, parent_id: parent, children }
)
const SERVER_MENU = [
  raw(199, 'Sales & Marketing Intelligence', '/module/crm', null, 1, [
    raw(442, 'Command Center', '/module/crm/command-center', 199, 1),
    raw(489, 'Market Signals', '/module/crm/signals', 199, 2, [
      raw(490, 'Company Opportunities', '/signals', 489, 1), raw(491, 'Ingestion Engine', '/ingestion', 489, 2), raw(492, 'Product Portfolio', '/portfolio', 489, 3),
      raw(493, 'Partner Network', '/partners', 489, 4), raw(501, 'Signal Inbox', '/module/crm/marketing/signal-inbox', 489, 5),
    ]),
    raw(506, 'Signal Review', '/signal-review', 199, 9),
  ]),
]

describe('through the real sidebar hook', () => {
  afterEach(disposeAll)

  it('does not list Signal Review for a person whose menu holds it, and resolves its old address to Market Signals', async () => {
    const k = await kit()
    /* eslint-disable @typescript-eslint/no-require-imports */
    // `require`, not `import()`: the hook loads these through the same loader, and a dynamic import would give this file a second copy of each module.
    const { AuthContext } = require('../components/auth/gtg-auth') as typeof import('../components/auth/gtg-auth')
    const { QueryClient, QueryClientProvider } = require('@tanstack/react-query') as typeof import('@tanstack/react-query')
    /* eslint-enable @typescript-eslint/no-require-imports */
    const { useSidebarNavigation } = await import('../hooks/use-sidebar-navigation')

    k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: TENANT, user_id: 2, user_profile_id: PROFILE }))
    k.w.sessionStorage.setItem(`gtg-sidebar-cache-v3:${TENANT}:${PROFILE}`, JSON.stringify({ status_code: 200, message: 'ok', data: SERVER_MENU }))
    const original = globalThis.fetch
    globalThis.fetch = (async () => new Response(JSON.stringify({ status_code: 200, message: 'ok', data: SERVER_MENU }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })

    // The probe writes what the hook answers into the page as JSON, and the test reads it back from there (a component may not hand state to the test by reassigning a variable).
    function Probe() {
      const nav = useSidebarNavigation()
      const report = {
        sidebar: nav.sidebarModules,
        tree: nav.modules,
        active: { signals: nav.parseRoutePath('/signals'), review: nav.parseRoutePath('/signal-review'), crmReview: nav.parseRoutePath('/module/crm/signal-review') },
        resolvedSignals: nav.resolveAccessLink('/signals'),
      }
      return k.h('pre', { 'data-report': '' }, JSON.stringify(report))
    }

    try {
      await k.render(k.h(QueryClientProvider, { client }, k.h(AuthContext.Provider, { value: { user: null } as never }, k.h(Probe))))
      await k.tick(40)
      const shown = k.one('[data-report]')
      assert.ok(shown, 'the hook ran')
      const report = JSON.parse(shown.textContent!) as { sidebar: NavModule[]; tree: NavModule[]; active: Record<string, unknown>; resolvedSignals: string }

      assert.equal(holdsReview(report.sidebar), false, 'the sidebar does not list it')
      assert.equal(holdsReview(report.tree), false, 'nor does the tree that routes are resolved from')
      const marketSignals = report.sidebar[0].children.find((c) => c.id === '489')!
      assert.equal(marketSignals.accessLink, '/signals')
      assert.deepEqual(marketSignals.children, [])

      const active = { moduleId: '199', menuId: '489', submenuId: '489' }
      assert.deepEqual(report.active.signals, active)
      assert.deepEqual(report.active.review, active, 'a visit to the old address highlights Market Signals')
      assert.deepEqual(report.active.crmReview, active)
      assert.equal(report.resolvedSignals, '/signals')
    } finally {
      globalThis.fetch = original
      client.clear()
    }
  })
})
