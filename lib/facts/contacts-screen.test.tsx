import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { absent, same } from '../agent/assertions'
import { ApiError } from '../../services/core'
import type { FactsApi } from '../../services/facts/api-types'
import type { Contact } from '../../types/crm'
import { fakeFactsService } from './fake-service'
import { fact, phoneFact, queueData } from './fixtures'
import { screenKit, type Call } from './screen-kit'

/** The Contacts screen as a person meets it: the real list, the real sidebar hook and service client, only the network (and the facts API, as a fake) replaced. */

function contact(over: Partial<Contact> = {}): Contact {
  return {
    id: '31', contactNo: 'CON-0031', organizationId: '135', organizationName: 'Hillcrest Academy', salutation: null, firstName: 'Asha', lastName: 'Menon', title: 'Principal', department: null,
    email: 'asha@hillcrest.example.edu', secondaryEmail: null, phone: '+91 11111 22222', mobile: null, fax: null, homePhone: null, assistant: null, assistantPhone: null, reportsToId: null,
    birthday: null, leadSource: null, doNotCall: false, emailOptOut: false, mailingStreet: null, mailingCity: null, mailingState: null, mailingCode: null, mailingCountry: null,
    mailingPoBox: null, otherStreet: null, otherCity: null, otherState: null, otherCode: null, otherCountry: null, otherPoBox: null, description: null, assignedTo: null, createdBy: null,
    createdAt: null, updatedAt: null, ...over,
  }
}

const respond = (contacts: Contact[]) => (call: Call): unknown => {
  if (call.path.endsWith('/crm/contacts')) return { status: 1, message: 'Contacts.', data: { items: contacts, pagination: { current_page: 1, last_page: 1, per_page: 20, total: contacts.length } } }
  return undefined
}

async function open(options: { search?: string; contacts?: Contact[]; facts?: Partial<FactsApi> } = {}) {
  const screen = await screenKit({ search: options.search ?? '', respond: respond(options.contacts ?? [contact(), contact({ id: '32', firstName: 'Ravi', lastName: 'Iyer', email: null })]) })
  const { ContactListView } = await import('../../components/domain/crm/contact-list-view')
  const { service, calls } = fakeFactsService(options.facts)
  await screen.mount(screen.k.h(ContactListView, { factsService: service }), 40)
  const tabs = () => screen.k.all('[role="tab"]')
  const tab = (label: string) => tabs().find((t) => t.textContent?.startsWith(label)) as HTMLElement
  const rowOf = (name: string) => screen.k.all('tbody tr').find((tr) => tr.textContent?.includes(name)) ?? null
  const openScope = async (label: string) => { await screen.k.click(tab(label)); await screen.k.tick(20); await screen.k.tick(20) }
  const press = async (target: Element | null | undefined) => { assert.ok(target, 'the control exists'); await screen.k.click(target); await screen.k.tick(15) }
  const card = (id: number) => screen.k.one(`li[data-fact="${id}"]`)
  return { ...screen, service, factsCalls: calls, tabs, tab, rowOf, openScope, press, card }
}

describe('the Contacts screen: the list, as it has always been', () => {
  afterEach(async () => { await disposeAll() })

  it('opens on the contacts list with a clean address and the Suggestions scope kept out of the page', async () => {
    const s = await open()
    assert.ok(s.rowOf('Asha') && s.rowOf('Ravi'), 'the contacts are listed')
    assert.deepEqual(s.router.written, [], 'the address was not touched')
    assert.equal(s.k.one('#contact-scope-panel-contacts')!.hasAttribute('hidden'), false)
    assert.equal(s.k.one('#contact-scope-panel-suggestions')!.hasAttribute('hidden'), true)
    assert.equal(s.k.one('#contact-scope-panel-suggestions')!.textContent, '', 'a scope that is not open builds nothing')
    assert.deepEqual(s.k.all('thead th').slice(1).map((th) => th.textContent), ['First Name', 'Last Name', 'Title', 'Organization', 'Email', 'Phone'])
    s.restore()
  })

  it('keeps everything the list had: header buttons, search, paging, count', async () => {
    const s = await open()
    for (const label of ['Import', 'Find Duplicates', 'Add Contact']) assert.ok(s.k.withText(label) || s.k.all('button').some((b) => b.textContent?.includes(label)), label)
    assert.ok(s.k.one('input[placeholder="Search name, email, or organization…"]'))
    assert.ok(s.k.bodyText().includes('2 contacts'))
    assert.ok(s.k.bodyText().includes('Page 1 of 1'))
    s.restore()
  })

  it('still opens a contact\'s page when its row is clicked', async () => {
    const s = await open()
    await s.k.click(s.rowOf('Asha')!)
    assert.equal(s.router.written.at(-1), '/module/crm/marketing/contacts/31')
    s.restore()
  })

  it('keeps the search the person typed when they look at the suggestions and come back', async () => {
    const s = await open()
    const input = s.k.one('input[placeholder="Search name, email, or organization…"]') as HTMLInputElement
    const set = Object.getOwnPropertyDescriptor(s.k.w.HTMLInputElement.prototype, 'value')!.set!
    await s.k.act(async () => { set.call(input, 'Asha'); input.dispatchEvent(new s.k.w.Event('input', { bubbles: true })) })
    await s.k.tick(20)
    await s.openScope('Suggestions')
    await s.openScope('Contacts')
    assert.equal((s.k.one('input[placeholder="Search name, email, or organization…"]') as HTMLInputElement).value, 'Asha')
    s.restore()
  })
})

describe('the Contacts screen: the Suggestions scope', () => {
  afterEach(async () => { await disposeAll() })

  it('has two tabs, with how many suggestions wait on the second and no count on the first', async () => {
    const s = await open()
    assert.deepEqual(s.tabs().map((t) => t.textContent), ['Contacts', 'Suggestions3'])
    assert.equal(s.tab('Contacts').getAttribute('aria-label'), null)
    assert.equal(s.tab('Suggestions').getAttribute('aria-label'), 'Suggestions 3', 'the name says the count with a space')
    assert.equal(s.tab('Contacts').getAttribute('aria-selected'), 'true')
    s.restore()
  })

  it('asks for the count once, the smallest page of what waits, and for nothing else until the scope is opened', async () => {
    const s = await open()
    assert.deepEqual(s.factsCalls.queue, [{ status: 'proposed', page: 1, per_page: 1 }])
    s.restore()
  })

  it('opens the suggestions, writes the scope into the address, and goes back to the plain address for Contacts', async () => {
    const s = await open()
    await s.openScope('Suggestions')
    assert.equal(s.router.lastSearch(), 'scope=suggestions')
    assert.ok(s.k.bodyText().includes('Nothing changes until you accept it'))
    assert.deepEqual(s.k.all('li[data-fact]').map((li) => li.getAttribute('data-fact')), ['1', '2', '3'])
    assert.equal(s.rowOf('Asha'), null, 'the list is not on screen while the suggestions are')
    await s.openScope('Contacts')
    assert.equal(s.router.lastSearch(), '', 'the first scope is the default')
    assert.ok(s.rowOf('Asha'))
    s.restore()
  })

  it('opens on the suggestions when a pasted link names them, and on the list for a scope that does not exist', async () => {
    const direct = await open({ search: 'scope=suggestions' })
    assert.ok(direct.k.bodyText().includes('Suggestions'))
    assert.ok(direct.card(1), 'the suggestions are open')
    assert.equal(direct.rowOf('Asha'), null)
    await disposeAll()
    const bad = await open({ search: 'scope=nonsense' })
    assert.ok(bad.rowOf('Asha'), 'the list is open')
    bad.restore()
  })

  it('moves between the tabs with the arrow keys, as tabs do', async () => {
    const s = await open()
    s.tab('Contacts').focus()
    await s.k.press('ArrowRight', s.tab('Contacts'))
    await s.k.tick(20)
    assert.equal(s.router.lastSearch(), 'scope=suggestions')
    same(s.k.w.document.activeElement, s.tab('Suggestions'), 'the focus follows')
    s.restore()
  })

  it('accepts a suggestion on the screen, and the number on the tab falls to match what is left', async () => {
    let waiting = 3
    const s = await open({
      facts: {
        queue: async (params) => (params.per_page === 1 ? queueData([fact()], { pagination: { page: 1, per_page: 1, total: waiting } }) : queueData([fact(), phoneFact()].slice(0, waiting - 1))),
        accept: async () => { waiting -= 1; return { status: 1, data: { outcome: 'applied', fact: fact({ status: 'applied', column_written: true }) } } },
      },
    })
    await s.openScope('Suggestions')
    await s.press(Array.from(s.card(1)!.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Accept'))
    await s.k.tick(20)
    assert.equal(s.tab('Suggestions').getAttribute('aria-label'), 'Suggestions 2')
    s.restore()
  })

  it('shows no count when it cannot be read, and the list is unaffected', async () => {
    const s = await open({ facts: { queue: async () => { throw new ApiError('busy', 500) } } })
    assert.deepEqual(s.tabs().map((t) => t.textContent), ['Contacts', 'Suggestions'])
    assert.ok(s.rowOf('Asha'), 'the list still works')
    s.restore()
  })

  it('says there is no access on the scope when the facts are forbidden, and the list is unaffected', async () => {
    const s = await open({ search: 'scope=suggestions', facts: { queue: async () => { throw new ApiError('no', 403) } } })
    assert.ok(s.k.bodyText().includes('You do not have access to suggestions here.'))
    absent(s.k.withText('Retry'), 'no Retry when there is no access')
    await s.openScope('Contacts')
    assert.ok(s.rowOf('Asha'), 'the list is fine')
    s.restore()
  })

  it('links a suggestion\'s contact to its page through the person\'s menu', async () => {
    const s = await open({ search: 'scope=suggestions' })
    assert.equal(s.card(1)!.querySelector('[data-record] a')!.getAttribute('href'), '/module/crm/marketing/contacts/31')
    s.restore()
  })

  it('has no axe violations on the switch with the list open and with the suggestions open', async () => {
    const s = await open()
    assert.deepEqual(await axeViolations(s.k.one('[role="tablist"]')!.parentElement!), [], 'list open')
    await s.openScope('Suggestions')
    assert.deepEqual(await axeViolations(s.k.one('[role="tablist"]')!.parentElement!), [], 'suggestions open')
    s.restore()
  })
})

describe('the support twin of the Contacts screen', () => {
  it('is the same component: the content map routes both rows to ContactListView', () => {
    const source = readFileSync(path.resolve('hooks/content-map-crm.ts'), 'utf8')
    assert.match(source, /accessLink: '\/module\/crm\/marketing\/contacts', component: ContactListView/)
    assert.match(source, /accessLink: '\/module\/crm\/support\/contacts', component: ContactListView/)
  })

  it('opens the same switch from the support address', async () => {
    const screen = await screenKit({ pathname: '/module/crm/support/contacts', respond: respond([contact()]) })
    const { ContactListView } = await import('../../components/domain/crm/contact-list-view')
    const { service } = fakeFactsService()
    await screen.mount(screen.k.h(ContactListView, { factsService: service }), 40)
    assert.deepEqual(screen.k.all('[role="tab"]').map((t) => t.textContent), ['Contacts', 'Suggestions3'])
    await screen.k.click(screen.k.all('[role="tab"]')[1])
    await screen.k.tick(20)
    assert.equal(screen.router.lastSearch(), 'scope=suggestions')
    screen.restore()
    await disposeAll()
  })
})
