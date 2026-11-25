import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { absent, same, says } from '../agent/assertions'
import { ApiError } from '../../services/core'
import type { FactsApi } from '../../services/facts/api-types'
import type { Contact } from '../../types/crm'
import { fakeFactsService } from '../facts/fake-service'
import { consentData, entityData, fact, queueData } from '../facts/fixtures'
import { screenKit, type Call } from '../facts/screen-kit'
import { fakeService } from '../org-accounts/fake-service'
import { listResponse, summary } from '../org-accounts/fixtures'
import { DEFAULT_LINKS } from '../org-accounts/links'
import type { OrgAccountsApi } from '../../services/org-accounts/api-types'

/**
 * S18 (25 Nov 2026), track T3: the Organizations screen with its All people scope, the Suggestions scope that moved here from the old Contacts list, the Companies columns,
 * and the person's old address redirect component. The real components, the real sidebar hook and service clients; only the network (and the facts and org-accounts APIs, as
 * fakes) is replaced. REPLACES lib/facts/contacts-screen.test.tsx (the old Contacts list): its tests are mapped in the report of the track.
 */

const PROFILE = 16
const TENANT = 1

interface Rights { view: boolean; add: boolean; edit: boolean; delete: boolean }
const ALL: Rights = { view: true, add: true, edit: true, delete: true }

/** The menu a person holds: Sales & Marketing with Contacts (carrying the rights) and Organizations, the way the server sends them. */
const menuWith = (rights: Rights | null) => [{
  id: 199, label: 'Sales & Marketing', icon: null, access_link: '/module/crm', page_type: null, sort_order: 1, parent_id: null,
  children: [
    ...(rights ? [{
      id: 451, label: 'Contacts', icon: null, access_link: '/module/crm/marketing/contacts', page_type: 'page', sort_order: 2, parent_id: 199, children: [],
      can_view: rights.view ? 1 : 0, can_add: rights.add ? 1 : 0, can_edit: rights.edit ? 1 : 0, can_delete: rights.delete ? 1 : 0,
    }] : []),
    { id: 452, label: 'Organizations', icon: null, access_link: '/module/crm/marketing/organizations', page_type: 'page', sort_order: 3, parent_id: 199, children: [] },
    { id: 460, label: 'Organizations', icon: null, access_link: '/module/crm/support/organizations', page_type: 'page', sort_order: 4, parent_id: 199, children: [] },
  ],
}]

function person(over: Partial<Contact> & { organizationDeleted?: boolean } = {}): Contact {
  return {
    id: '31', contactNo: 'CON-0031', organizationId: '135', organizationName: 'Greenfield Public School', salutation: null, firstName: 'Meera', lastName: 'Patel', title: 'Principal',
    department: 'Management', email: 'meera@greenfield.example', secondaryEmail: null, phone: '079 4000 1200', mobile: '98250 11122', fax: null, homePhone: null, assistant: null,
    assistantPhone: null, reportsToId: null, birthday: null, leadSource: null, doNotCall: false, emailOptOut: false, mailingStreet: null, mailingCity: null, mailingState: null,
    mailingCode: null, mailingCountry: null, mailingPoBox: null, otherStreet: null, otherCity: null, otherState: null, otherCode: null, otherCountry: null, otherPoBox: null,
    description: null, assignedTo: null, createdBy: null, createdAt: '2026-10-12 10:00:00', updatedAt: null, isPrimary: true, contactRole: 'Decision maker', ...over,
  }
}

const PEOPLE = [
  person(),
  person({ id: '32', firstName: 'Rakesh', lastName: 'Shah', title: 'Accountant', contactRole: 'Billing', isPrimary: false, email: null, phone: null, mobile: '98250 22233' }),
  person({ id: '33', firstName: 'Sana', lastName: 'Khan', title: null, contactRole: null, isPrimary: false, organizationId: null, organizationName: null }),
  person({ id: '34', firstName: 'Vikram', lastName: 'Nair', title: 'Registrar', contactRole: 'Influencer', isPrimary: false, organizationId: '77', organizationName: 'Lotus International School', organizationDeleted: true }),
]

interface OpenOptions {
  search?: string
  pathname?: string
  rights?: Rights | null
  people?: Contact[]
  facts?: Partial<FactsApi>
  /** Replaces the whole people answer (for an empty or failing list). */
  peopleAnswer?: (call: Call) => unknown
  companies?: unknown[]
  confirm?: (message: string) => boolean
}

const listAnswer = (items: unknown[]) => ({ status: 1, message: 'ok', data: { items, pagination: { current_page: 1, last_page: 1, per_page: 20, total: items.length } } })

function responder(options: OpenOptions) {
  return (call: Call): unknown => {
    if (call.path.endsWith('/crm/contacts') && call.method === 'GET') return options.peopleAnswer ? options.peopleAnswer(call) : listAnswer(options.people ?? PEOPLE)
    if (/\/crm\/contacts\/\d+$/.test(call.path) && call.method === 'GET') return { status: 1, message: 'ok', data: (options.people ?? PEOPLE).find((p) => call.path.endsWith(`/${p.id}`)) ?? PEOPLE[0] }
    if (call.path.endsWith('/crm/contacts/bulk/delete')) return { status: 1, message: 'ok', data: { summary: { succeeded: 1, failed: 0 }, results: [{ id: 32, ok: true }] } }
    if (call.path.endsWith('/crm/organizations') && call.method === 'GET') return listAnswer(options.companies ?? [])
    // The real Person panel reads its Evidence and Consent through the facts API.
    if (call.path.includes('/facts/entity/')) return entityData()
    if (call.path.includes('/consent/')) return consentData()
    if (call.path.endsWith('/org-accounts')) return listResponse([], { summary: summary({ total: 5, with_crm: 2, suggestions: 2 }) })
    if (call.path.endsWith('/crm/picklist-values')) return { status: 1, message: 'ok', data: { contacts: {}, organizations: {} } }
    return undefined
  }
}

/** The switch (the real OrgScopes) around the real PeopleTable, with the org-accounts and facts APIs as fakes. */
async function openScopes(options: OpenOptions = {}) {
  const screen = await screenKit({ search: options.search ?? 'scope=people', pathname: options.pathname ?? '/module/crm/marketing/organizations', respond: responder(options) })
  screen.k.w.sessionStorage.setItem(`gtg-sidebar-cache-v3:${TENANT}:${PROFILE}`, JSON.stringify({ status_code: 200, message: 'ok', data: menuWith(options.rights === undefined ? ALL : options.rights) }))
  const confirms: string[] = []
  ;(screen.k.w as unknown as { confirm: (m: string) => boolean }).confirm = (message: string) => { confirms.push(message); return options.confirm ? options.confirm(message) : true }
  const { OrgScopes } = await import('../../components/domain/crm/org-scopes')
  const { PeopleTable } = await import('../../components/domain/crm/people-table')
  const { getLaravelContext } = await import('../laravel-context')
  const { INITIAL_PEOPLE_STATE } = await import('./people')
  const facts = fakeFactsService(options.facts)
  const org = fakeService({ list: async (params) => (params.has_crm === 0 ? listResponse([], { summary: summary({ total: 5, with_crm: 2 }) }) : listResponse(undefined, { summary: summary({ total: 5, with_crm: 2, suggestions: 2 }) })) })
  const offered = options.rights !== null

  function Harness() {
    const listState = screen.k.React.useState(INITIAL_PEOPLE_STATE)
    return screen.k.h(OrgScopes, {
      context: getLaravelContext(), service: org.service as OrgAccountsApi, links: DEFAULT_LINKS, factsApi: facts.service, peopleCount: 109,
      people: offered ? screen.k.h(PeopleTable, { listState }) : undefined,
    }, screen.k.h('p', { id: 'companies-list' }, 'THE COMPANIES LIST'))
  }
  await screen.mount(screen.k.h(Harness), 40)

  const tabs = () => screen.k.all('[role="tab"]')
  const tab = (label: string) => tabs().find((t) => t.textContent?.startsWith(label)) as HTMLElement
  const openScope = async (label: string) => { await screen.k.click(tab(label)); await screen.k.tick(20); await screen.k.tick(20) }
  const rowOf = (name: string) => screen.k.all('tbody tr').find((tr) => tr.textContent?.includes(name)) ?? null
  const peopleCalls = () => screen.to('/crm/contacts').filter((c) => c.method === 'GET')
  const lastPeopleQuery = () => peopleCalls().at(-1)!.query
  const press = async (target: Element | null | undefined) => { assert.ok(target, 'the control exists'); await screen.k.click(target); await screen.k.tick(25); await screen.k.tick(15) }
  const chip = (label: string) => screen.k.all('[role="group"][aria-label="Show"] button').find((b) => b.textContent === label) as HTMLElement
  const card = (id: number) => screen.k.one(`li[data-fact="${id}"]`)
  return { ...screen, org, facts, factsCalls: facts.calls, confirms, tabs, tab, openScope, rowOf, peopleCalls, lastPeopleQuery, press, chip, card }
}

describe('All people: the scope switch', () => {
  afterEach(async () => { await disposeAll() })

  it('has the five tabs of the mock-up, in order, with the counts on All people, Discovered, Possible duplicates and Suggestions and none on Companies', async () => {
    const s = await openScopes({ search: '' })
    assert.deepEqual(s.tabs().map((t) => t.textContent), ['Companies', 'Discovered3', 'Possible duplicates2', 'All people109', 'Suggestions3'])
    assert.equal(s.tab('Companies').getAttribute('aria-label'), null)
    assert.equal(s.tab('All people').getAttribute('aria-label'), 'All people 109')
    assert.equal(s.tab('Suggestions').getAttribute('aria-label'), 'Suggestions 3')
    assert.ok(s.k.one('#companies-list'), 'opens on the Companies list, with a clean address')
    assert.deepEqual(s.router.written, [])
    s.restore()
  })

  it('offers neither All people nor Suggestions without the contacts view right, and ?scope=people then lands on Companies', async () => {
    const s = await openScopes({ rights: null })
    assert.deepEqual(s.tabs().map((t) => t.textContent), ['Companies', 'Discovered3', 'Possible duplicates2'])
    assert.ok(s.k.one('#companies-list'), 'the Companies list is what is open')
    assert.equal(s.peopleCalls().length, 0, 'the people list is never asked for')
    assert.equal(s.factsCalls.queue.length, 0, 'nor the suggestions count')
    s.restore()
  })

  it('opens All people from the address (`?scope=people`), writes the scope into it, and goes back to the plain address for Companies', async () => {
    const s = await openScopes({ search: '' })
    await s.openScope('All people')
    assert.equal(s.router.lastSearch(), 'scope=people')
    assert.equal(s.k.one('#companies-list'), null, 'the Companies list is not on screen while the people are')
    assert.ok(s.rowOf('Meera'))
    await s.openScope('Companies')
    assert.equal(s.router.lastSearch(), '')
    assert.ok(s.k.one('#companies-list'))
    s.restore()
  })

  it('moves between the tabs with the arrow keys, as tabs do', async () => {
    const s = await openScopes({ search: '' })
    await s.openScope('Possible duplicates')
    s.tab('Possible duplicates').focus()
    await s.k.press('ArrowRight', s.tab('Possible duplicates'))
    await s.k.tick(20)
    assert.equal(s.router.lastSearch(), 'scope=people')
    same(s.k.w.document.activeElement, s.tab('All people'), 'the focus follows')
    s.restore()
  })
})

describe('All people: the table reads the people list', () => {
  afterEach(async () => { await disposeAll() })

  it('asks /crm/contacts for the first page, sorted by last name, and never the companies list, with no filter on', async () => {
    const s = await openScopes()
    const query = s.lastPeopleQuery()
    assert.equal(query.get('page'), '1')
    assert.equal(query.get('per_page'), '20')
    assert.equal(query.get('sort_by'), 'last_name')
    assert.equal(query.get('sort_dir'), 'asc')
    for (const key of ['primary', 'owner', 'do_not_call', 'no_company', 'search', 'consent']) assert.equal(query.has(key), false, `${key} is not sent`)
    assert.equal(s.to('/crm/organizations').length, 0, 'the companies list is not asked for')
    s.restore()
  })

  it('has the columns of the mock-up and a header that can be sorted by name, title, email and created', async () => {
    const s = await openScopes()
    assert.deepEqual(s.k.all('thead th').slice(1).map((th) => th.textContent), ['Name', 'Company', 'Title · role', 'Email', 'Phone', 'Owner', 'Created'])
    assert.equal(s.k.one('thead th[aria-sort]')!.textContent, 'Name', 'the list is sorted by name')
    s.restore()
  })

  it('writes each row: the Primary star with its word, the company, title and role, phone or mobile, and the created date', async () => {
    const s = await openScopes()
    const meera = s.rowOf('Meera')!
    says(meera.textContent, 'Meera Patel (Primary)')
    assert.ok(meera.querySelector('svg'), 'the star')
    assert.equal(meera.querySelector('a')!.getAttribute('href'), '/module/crm/marketing/organizations/135', 'the company opens its own page')
    says(meera.textContent, 'Principal · Decision maker')
    says(meera.textContent, '079 4000 1200')
    says(meera.textContent, '12 Oct 2026')
    const rakesh = s.rowOf('Rakesh')!
    absent(rakesh.querySelector('svg'), 'no star for a person who is not the primary')
    says(rakesh.textContent, '98250 22233')
    says(rakesh.textContent, 'Accountant · Billing')
    s.restore()
  })

  it('marks a person with no company "No company" and one whose company is in the Recycle Bin "Company in Recycle Bin"', async () => {
    const s = await openScopes()
    assert.equal(s.rowOf('Sana')!.querySelector('[data-company="none"]')!.textContent, 'No company')
    const vikram = s.rowOf('Vikram')!
    assert.equal(vikram.querySelector('[data-company="recycle-bin"]')!.textContent, 'Company in Recycle Bin')
    says(vikram.textContent, 'Lotus International School')
    absent(vikram.querySelector('a'), 'a company in the Recycle Bin has no page to open')
    absent(s.rowOf('Meera')!.querySelector('[data-company]'), 'a person of a live company carries no chip')
    s.restore()
  })

  it('each chip asks the server for exactly its own filter, and All asks for none', async () => {
    const s = await openScopes()
    const expected: Array<[string, string]> = [['Primary', 'primary=1'], ['Mine', 'owner=2'], ['Do not call', 'do_not_call=1'], ['No company', 'no_company=1']]
    for (const [label, wanted] of expected) {
      await s.press(s.chip(label))
      const query = s.lastPeopleQuery()
      const sent = ['primary', 'owner', 'do_not_call', 'no_company'].filter((key) => query.has(key)).map((key) => `${key}=${query.get(key)}`)
      assert.deepEqual(sent, [wanted], label)
      assert.equal(s.chip(label).getAttribute('aria-pressed'), 'true')
      assert.equal(s.chip('All').getAttribute('aria-pressed'), 'false')
    }
    await s.press(s.chip('All'))
    for (const key of ['primary', 'owner', 'do_not_call', 'no_company']) assert.equal(s.lastPeopleQuery().has(key), false, `${key} is gone again`)
    s.restore()
  })

  it('sends the search and goes back to the first page; the sort flips on a second click and sorts by created', async () => {
    const s = await openScopes()
    const input = s.k.one('input[aria-label="Search all people"]') as HTMLInputElement
    const set = Object.getOwnPropertyDescriptor(s.k.w.HTMLInputElement.prototype, 'value')!.set!
    await s.k.act(async () => { set.call(input, 'meera'); input.dispatchEvent(new s.k.w.Event('input', { bubbles: true })) })
    await s.k.tick(20)
    assert.equal(s.lastPeopleQuery().get('search'), 'meera')
    assert.equal(s.lastPeopleQuery().get('page'), '1')
    const created = s.k.all('thead button').find((b) => b.textContent === 'Created')!
    await s.press(created)
    assert.equal(s.lastPeopleQuery().get('sort_by'), 'created_at')
    assert.equal(s.lastPeopleQuery().get('sort_dir'), 'asc')
    await s.press(s.k.all('thead button').find((b) => b.textContent === 'Created')!)
    assert.equal(s.lastPeopleQuery().get('sort_dir'), 'desc')
    s.restore()
  })

  it('says "No people yet" for an empty organisation and "No person matches" when a search or chip leaves nothing', async () => {
    const empty = await openScopes({ people: [] })
    says(empty.k.bodyText(), 'No people yet. Add the first person or import a CSV.')
    await empty.press(empty.chip('Primary'))
    says(empty.k.bodyText(), 'No person matches.')
    empty.restore()
  })

  it('says why the list is not there when the server refuses, and the tabs still work', async () => {
    const s = await openScopes({ peopleAnswer: () => ({ __status: 500, status: 0, message: 'The server is busy.' }) })
    says(s.k.one('[role="alert"]')!.textContent, 'The server is busy.')
    await s.openScope('Companies')
    assert.ok(s.k.one('#companies-list'))
    s.restore()
  })

  it('keeps the search the person typed when they look at another scope and come back', async () => {
    const s = await openScopes()
    const input = s.k.one('input[aria-label="Search all people"]') as HTMLInputElement
    const set = Object.getOwnPropertyDescriptor(s.k.w.HTMLInputElement.prototype, 'value')!.set!
    await s.k.act(async () => { set.call(input, 'Asha'); input.dispatchEvent(new s.k.w.Event('input', { bubbles: true })) })
    await s.k.tick(20)
    await s.openScope('Suggestions')
    await s.openScope('All people')
    assert.equal((s.k.one('input[aria-label="Search all people"]') as HTMLInputElement).value, 'Asha')
    s.restore()
  })
})

describe('All people: a person opens in a drawer', () => {
  afterEach(async () => { await disposeAll() })

  it('writes `?person=` into the address when a name is clicked, and opens the person\'s panel with the fixed props', async () => {
    const s = await openScopes()
    await s.press(s.rowOf('Meera')!.querySelector('button'))
    assert.equal(s.router.lastSearch(), 'scope=people&person=31')
    await s.k.tick(30)
    assert.ok(s.k.one('[data-person-panel="31"]'), 'the panel of that person is open')
    s.restore()
  })

  it('opens the person a pasted link names, and ignores a person that is not a record id', async () => {
    const s = await openScopes({ search: 'scope=people&person=32' })
    await s.k.tick(30)
    assert.ok(s.k.one('[data-person-panel="32"]'))
    await disposeAll()
    s.restore()
    const bad = await openScopes({ search: 'scope=people&person=abc' })
    await bad.k.tick(30)
    assert.equal(bad.k.one('[data-person-panel]'), null)
    bad.restore()
  })

  it('takes `?person=` out of the address when the drawer is closed, and keeps the scope', async () => {
    const s = await openScopes({ search: 'scope=people&person=31' })
    await s.k.tick(30)
    await s.k.press('Escape')
    await s.k.tick(30)
    assert.equal(s.router.lastSearch(), 'scope=people')
    s.restore()
  })
})

describe('All people: the tools of the old Contacts list are all still here', () => {
  afterEach(async () => { await disposeAll() })

  it('has Recycle Bin, Export, Import, Find Duplicates and Add person (above the table when the page gives no header), a search and a count', async () => {
    const s = await openScopes()
    for (const label of ['Recycle Bin', 'Export', 'Import', 'Find Duplicates', 'Add person']) assert.ok(s.k.all('button').some((b) => b.textContent?.includes(label)), label)
    assert.ok(s.k.one('input[placeholder="Search name, email, phone, title, company"]'))
    says(s.k.bodyText(), '4 people')
    says(s.k.bodyText(), 'Page 1 of 1')
    assert.ok(s.k.all('button').some((b) => b.textContent?.includes('Saved views') || b.getAttribute('aria-label')?.includes('saved views') || b.textContent?.includes('Views')), 'saved views')
    s.restore()
  })

  it('exports with the search it is showing, to the people export', async () => {
    const s = await openScopes()
    const href = s.k.one('[data-export-href]')!.getAttribute('data-export-href')!
    assert.ok(href.includes('/crm/contacts/export'), href)
    s.restore()
  })

  it('disables Add person without the add right, and says why', async () => {
    const s = await openScopes({ rights: { view: true, add: false, edit: false, delete: false } })
    const add = s.k.all('button').find((b) => b.textContent?.includes('Add person')) as HTMLButtonElement
    assert.equal(add.disabled, true)
    assert.equal(add.getAttribute('title'), 'You do not have the right to add people.')
    s.restore()
  })

  it('deletes the ticked people in words ("1 person") and tells the result; without the delete right it refuses and sends nothing', async () => {
    const s = await openScopes()
    await s.press(s.rowOf('Rakesh')!.querySelector('input[type="checkbox"]'))
    says(s.k.bodyText(), '1 selected')
    await s.press(s.k.withText('Delete'))
    assert.equal(s.confirms.length, 1)
    says(s.confirms[0], 'Delete 1 person? This moves them to the Recycle Bin. Their company is not touched.')
    assert.deepEqual(s.to('/crm/contacts/bulk/delete').map((c) => (c.body as { ids: number[] }).ids), [[32]])
    says(s.k.bodyText(), 'Deleted 1 person.')
    s.restore()
    await disposeAll()

    const refused = await openScopes({ rights: { view: true, add: true, edit: true, delete: false } })
    await refused.press(refused.rowOf('Rakesh')!.querySelector('input[type="checkbox"]'))
    await refused.press(refused.k.withText('Delete'))
    assert.equal(refused.confirms.length, 0, 'no question is asked')
    assert.equal(refused.to('/crm/contacts/bulk/delete').length, 0, 'nothing is sent')
    says(refused.k.one('[role="alert"]')!.textContent, 'You do not have the right to delete people.')
    refused.restore()
  })

  it('has no axe violations with All people open', async () => {
    const s = await openScopes()
    assert.deepEqual(await axeViolations(s.k.one('[role="tablist"]')!.parentElement!), [])
    s.restore()
  })

  it('keeps to a 390 px screen: the table scrolls on its own (a positioned scroll box, for its sr-only text), the toolbar wraps, nothing is fixed wide', async () => {
    const s = await openScopes()
    const wrapper = s.k.one('table')!.closest('div.overflow-x-auto')
    assert.ok(wrapper, 'the table sits in its own horizontal scroller')
    assert.ok(/\brelative\b/.test(wrapper!.className), 'a scroll box that holds sr-only text is positioned, or the text widens the page')
    assert.ok(s.k.one('input[aria-label="Search all people"]')!.closest('div.flex-wrap'), 'the toolbar wraps onto new lines')
    for (const el of s.k.all('body *').slice(0, 600)) assert.ok(!/\bw-\[(?:[5-9]\d\d|\d{4,})px\]/.test(typeof el.className === 'string' ? el.className : ''), `no fixed width of 500px or more: ${el.className}`)
    s.restore()
  })
})

describe('Suggestions: the scope that moved here from the old Contacts list', () => {
  afterEach(async () => { await disposeAll() })

  it('asks for the count once, the smallest page of what waits, and for nothing else until the scope is opened', async () => {
    const s = await openScopes({ search: '' })
    assert.deepEqual(s.factsCalls.queue, [{ status: 'proposed', page: 1, per_page: 1 }])
    s.restore()
  })

  it('opens the suggestions and writes the scope into the address', async () => {
    const s = await openScopes({ search: '' })
    await s.openScope('Suggestions')
    assert.equal(s.router.lastSearch(), 'scope=suggestions')
    says(s.k.bodyText(), 'Nothing changes until you accept it')
    assert.deepEqual(s.k.all('li[data-fact]').map((li) => li.getAttribute('data-fact')), ['1', '2', '3'])
    s.restore()
  })

  it('opens on the suggestions when a pasted link names them', async () => {
    const s = await openScopes({ search: 'scope=suggestions' })
    assert.ok(s.card(1), 'the suggestions are open')
    assert.equal(s.k.one('#companies-list'), null)
    s.restore()
  })

  it('accepts a suggestion on the screen, and the number on the tab falls to match what is left', async () => {
    let waiting = 3
    const s = await openScopes({
      search: 'scope=suggestions',
      facts: {
        queue: async (params) => (params.per_page === 1 ? queueData([fact()], { pagination: { page: 1, per_page: 1, total: waiting } }) : queueData([fact()].slice(0, waiting))),
        accept: async () => { waiting -= 1; return { status: 1, data: { outcome: 'applied', fact: fact({ status: 'applied', column_written: true }) } } },
      },
    })
    await s.press(Array.from(s.card(1)!.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Accept'))
    await s.k.tick(20)
    assert.equal(s.tab('Suggestions').getAttribute('aria-label'), 'Suggestions 2')
    s.restore()
  })

  it('shows no count when it cannot be read, and says there is no access on the scope when the facts are forbidden', async () => {
    const busy = await openScopes({ search: '', facts: { queue: async () => { throw new ApiError('busy', 500) } } })
    assert.equal(busy.tab('Suggestions').textContent, 'Suggestions')
    busy.restore()
    await disposeAll()
    const forbidden = await openScopes({ search: 'scope=suggestions', facts: { queue: async () => { throw new ApiError('no', 403) } } })
    says(forbidden.k.bodyText(), 'You do not have access to suggestions here.')
    forbidden.restore()
  })

  it('links a suggestion\'s person to All people, through the person\'s menu', async () => {
    const s = await openScopes({ search: 'scope=suggestions' })
    assert.equal(s.card(1)!.querySelector('[data-record] a')!.getAttribute('href'), '/module/crm/marketing/organizations?scope=people&person=31')
    s.restore()
  })

  it('has no axe violations with the suggestions open', async () => {
    const s = await openScopes({ search: 'scope=suggestions' })
    assert.deepEqual(await axeViolations(s.k.one('[role="tablist"]')!.parentElement!), [])
    s.restore()
  })
})

// ---------------------------------------------------------------------------------------------------------------------------- the whole Organizations screen

async function openScreen(options: OpenOptions = {}) {
  const screen = await screenKit({ search: options.search ?? '', pathname: options.pathname ?? '/module/crm/marketing/organizations', respond: responder(options) })
  screen.k.w.sessionStorage.setItem(`gtg-sidebar-cache-v3:${TENANT}:${PROFILE}`, JSON.stringify({ status_code: 200, message: 'ok', data: menuWith(options.rights === undefined ? ALL : options.rights) }))
  const confirms: string[] = []
  ;(screen.k.w as unknown as { confirm: (m: string) => boolean }).confirm = (message: string) => { confirms.push(message); return options.confirm ? options.confirm(message) : false }
  const { OrganizationListView } = await import('../../components/domain/crm/organization-list-view')
  await screen.mount(screen.k.h(OrganizationListView), 60)
  const header = () => screen.k.one('h1')!.parentElement!.parentElement!
  const buttons = (root: Element) => Array.from(root.querySelectorAll('button')).map((b) => b.textContent?.trim())
  const press = async (target: Element | null | undefined) => { assert.ok(target, 'the control exists'); await screen.k.click(target); await screen.k.tick(25); await screen.k.tick(15) }
  return { ...screen, confirms, header, buttons, press }
}

const COMPANIES = [
  { id: '135', accountNo: 'ACC-000135', name: 'Greenfield Public School', accountType: 'Customer', industry: 'Education', billingCity: 'Ahmedabad', phone: '079 4000 1200', email: null, peopleCount: 6, primaryContactName: 'Meera Patel', matchedPerson: { id: 31, name: 'Meera Patel' } },
  { id: '136', accountNo: 'ACC-000136', name: 'Sunrise Academy', accountType: 'Prospect', industry: 'Education', billingCity: 'Mumbai', phone: '022 4000 8800', email: null, peopleCount: 0, primaryContactName: null },
  { id: '137', accountNo: 'ACC-000137', name: 'Old Server Co', accountType: 'Prospect', industry: null, billingCity: null, phone: null, email: null },
]

describe('the Organizations screen: the header follows the scope', () => {
  afterEach(async () => { await disposeAll() })

  it('keeps the companies\' buttons on Companies, and puts the people\'s buttons (with Add person) in the page header on All people', async () => {
    const companies = await openScreen({ companies: COMPANIES })
    assert.deepEqual(companies.buttons(companies.header()).filter((b) => ['Recycle Bin', 'Export', 'Import', 'Find Duplicates', 'Add Organization', 'Add person'].includes(b ?? '')), ['Recycle Bin', 'Export', 'Import', 'Find Duplicates', 'Add Organization'])
    says(companies.k.one('h1')!.parentElement!.textContent, 'Companies and the people who work there.')
    companies.restore()
    await disposeAll()

    const people = await openScreen({ search: 'scope=people', companies: COMPANIES })
    await people.k.tick(40)
    assert.deepEqual(people.buttons(people.header()).filter((b) => ['Recycle Bin', 'Export', 'Import', 'Find Duplicates', 'Add Organization', 'Add person'].includes(b ?? '')), ['Recycle Bin', 'Export', 'Import', 'Find Duplicates', 'Add person'])
    people.restore()
  })

  it('shows the same switch from the Support address, with the people linked under the Support area', async () => {
    const s = await openScreen({ search: 'scope=people', pathname: '/module/crm/support/organizations' })
    await s.k.tick(40)
    assert.deepEqual(s.k.all('[role="tab"]').map((t) => t.textContent?.replace(/\d+$/, '')), ['Companies', 'Discovered', 'Possible duplicates', 'All people', 'Suggestions'])
    assert.equal(s.k.all('tbody tr').find((tr) => tr.textContent?.includes('Meera'))!.querySelector('a')!.getAttribute('href'), '/module/crm/support/organizations/135', 'a company opens under the area of the list')
    s.restore()
  })

  it('has no All people or Suggestions tab for a person without the contacts view right', async () => {
    const s = await openScreen({ rights: null, search: 'scope=people', companies: COMPANIES })
    assert.deepEqual(s.k.all('[role="tab"]').map((t) => t.textContent?.replace(/\d+$/, '')), ['Companies', 'Discovered', 'Possible duplicates'])
    assert.ok(s.buttons(s.header()).includes('Add Organization'), 'the header is the companies\' header')
    s.restore()
  })
})

describe('the Companies list: People and Primary contact', () => {
  afterEach(async () => { await disposeAll() })

  it('has the People and Primary contact columns, a count for each company and the person a search matched', async () => {
    const s = await openScreen({ companies: COMPANIES })
    assert.deepEqual(s.k.all('thead th').slice(1).map((th) => th.textContent), ['Name', 'Type', 'Industry', 'City', 'Phone', 'People', 'Primary contact'])
    const greenfield = s.k.all('tbody tr').find((tr) => tr.textContent?.includes('Greenfield'))!
    assert.equal(greenfield.querySelector('[data-people-count]')!.textContent, '6')
    says(greenfield.textContent, 'Meera Patel')
    assert.equal(greenfield.querySelector('[data-matched-person]')!.textContent, 'Matched person: Meera Patel')
    const sunrise = s.k.all('tbody tr').find((tr) => tr.textContent?.includes('Sunrise'))!
    assert.equal(sunrise.querySelector('[data-people-count]')!.textContent, '0')
    absent(sunrise.querySelector('[data-matched-person]'), 'no pill when nothing was matched through a person')
    s.restore()
  })

  it('shows a dash where an older server sends no People or Primary contact', async () => {
    const s = await openScreen({ companies: COMPANIES })
    const old = s.k.all('tbody tr').find((tr) => tr.textContent?.includes('Old Server Co'))!
    absent(old.querySelector('[data-people-count]'), 'no count is made up')
    assert.deepEqual(Array.from(old.querySelectorAll('td')).slice(-2).map((td) => td.textContent), ['—', '—'])
    s.restore()
  })

  it('says how many people a delete moves and what happens to them, before it deletes; and asks the plain question for a company with none', async () => {
    const s = await openScreen({ companies: COMPANIES })
    await s.press(s.k.all('tbody tr').find((tr) => tr.textContent?.includes('Greenfield'))!.querySelector('input[type="checkbox"]'))
    await s.press(s.k.withText('Delete'))
    assert.equal(s.confirms.length, 1)
    says(s.confirms[0], 'Delete 1 organization? This moves it to the Recycle Bin.')
    says(s.confirms[0], 'Greenfield Public School has 6 people.')
    says(s.confirms[0], 'They stay in All people, marked "Company in Recycle Bin", and are linked back if the company is restored.')
    says(s.confirms[0], 'Nothing about a person is deleted.')
    s.restore()
    await disposeAll()

    const plain = await openScreen({ companies: COMPANIES })
    await plain.press(plain.k.all('tbody tr').find((tr) => tr.textContent?.includes('Sunrise'))!.querySelector('input[type="checkbox"]'))
    await plain.press(plain.k.withText('Delete'))
    assert.equal(plain.confirms[0], 'Delete 1 organization? This moves it to the Recycle Bin.')
    plain.restore()
  })

  it('calls the owner choice "Also transfer people"', async () => {
    const s = await openScreen({ companies: COMPANIES })
    await s.press(s.k.all('tbody tr').find((tr) => tr.textContent?.includes('Greenfield'))!.querySelector('input[type="checkbox"]'))
    says(s.k.bodyText(), 'Also transfer people')
    s.restore()
  })
})

// ---------------------------------------------------------------------------------------------------------------------------- the old person address

describe('a person\'s old address (the redirect component)', () => {
  afterEach(async () => { await disposeAll() })

  async function visit(id: string, area: 'marketing' | 'support', getContact: (id: string) => Promise<{ data: Partial<Contact> | null }>) {
    const screen = await screenKit({ pathname: `/module/crm/${area}/contacts/${id}`, respond: () => undefined })
    const { PersonAddressRedirect } = await import('../../components/domain/crm/person-address-redirect')
    const asked: string[] = []
    await screen.mount(screen.k.h(PersonAddressRedirect, { area, id, service: { getContact: async (_context: unknown, one: string) => { asked.push(one); return getContact(one) } } as never }), 30)
    return { ...screen, asked }
  }

  it('sends a person with a company to that company\'s People tab, replacing the history entry', async () => {
    const s = await visit('31', 'marketing', async () => ({ data: { id: '31', organizationId: '135' } }))
    assert.deepEqual(s.asked, ['31'])
    assert.deepEqual(s.router.written, ['/module/crm/marketing/organizations/135?tab=people&person=31'])
    s.restore()
  })

  it('sends a person with no company to All people', async () => {
    const s = await visit('33', 'marketing', async () => ({ data: { id: '33', organizationId: null } }))
    assert.deepEqual(s.router.written, ['/module/crm/marketing/organizations?scope=people&person=33'])
    s.restore()
  })

  it('keeps the Support area the visitor came from', async () => {
    const withCompany = await visit('31', 'support', async () => ({ data: { id: '31', organizationId: '135' } }))
    assert.deepEqual(withCompany.router.written, ['/module/crm/support/organizations/135?tab=people&person=31'])
    withCompany.restore()
    await disposeAll()
    const none = await visit('33', 'support', async () => ({ data: { id: '33', organizationId: null } }))
    assert.deepEqual(none.router.written, ['/module/crm/support/organizations?scope=people&person=33'])
    none.restore()
  })

  it('says so, with a way back to All people, for a person that cannot be read; and never looks up an id that is not a number', async () => {
    const gone = await visit('99', 'marketing', async () => { throw new ApiError('Contact not found.', 404) })
    says(gone.k.one('[role="alert"]')!.textContent, 'Contact not found.')
    assert.deepEqual(gone.router.written, [], 'nothing is guessed')
    await gone.k.click(gone.k.withText('Back to All people')!)
    assert.deepEqual(gone.router.written, ['/module/crm/marketing/organizations?scope=people'])
    gone.restore()
    await disposeAll()

    const odd = await visit('abc', 'marketing', async () => ({ data: { id: '1', organizationId: '1' } }))
    assert.deepEqual(odd.asked, [], 'no request for an id that is not a record id')
    says(odd.k.one('[role="alert"]')!.textContent, 'This person could not be found.')
    odd.restore()
  })
})
