import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { fakeFactsService } from '../facts/fake-service'
import { meera, nidhi, organization, peopleKit, rakesh, type Rights, type World } from './kit'

/** The People tab of a company as a person meets it: the real tab, rail, panel, sidebar hook and services; only the network and the facts API are replaced. */

async function open(options: { rights?: Rights | null; world?: Partial<World>; initialPersonId?: string | null } = {}) {
  const screen = await peopleKit({ rights: options.rights, world: options.world })
  const { PeopleTab } = await import('../../components/domain/crm/people/people-tab')
  const { service } = fakeFactsService()
  const events = { changed: 0 }
  await screen.mount(screen.k.h(PeopleTab, { organization: organization(), initialPersonId: options.initialPersonId ?? null, onChanged: () => { events.changed += 1 }, factsService: service }), 80)
  const rail = () => screen.k.all('[data-person-rail] button')
  const names = () => rail().map((b) => b.querySelector('.truncate')?.textContent)
  const railRow = (name: string) => rail().find((b) => b.textContent?.includes(name)) as HTMLElement
  const press = async (target: Element | null | undefined, wait = 25) => { assert.ok(target, 'the control exists'); await screen.k.click(target); await screen.k.tick(wait) }
  const button = (label: string) => screen.k.all('button').find((b) => b.textContent?.trim() === label) as HTMLButtonElement | undefined
  const type = async (input: Element, text: string, wait = 320) => {
    const set = Object.getOwnPropertyDescriptor(screen.k.w.HTMLInputElement.prototype, 'value')!.set!
    await screen.k.act(async () => { set.call(input, text); input.dispatchEvent(new screen.k.w.Event('input', { bubbles: true })) })
    await screen.k.tick(wait)
  }
  const openMore = async () => {
    const trigger = screen.k.one('button[aria-label="More"]')!
    await screen.k.act(async () => { trigger.dispatchEvent(new screen.k.w.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, ctrlKey: false })) })
    await screen.k.tick(15)
  }
  const menuItem = (text: string) => screen.k.all('[role="menuitem"]').find((i) => i.textContent?.trim() === text) as HTMLElement | undefined
  const listCalls = () => screen.callsTo(/\/crm\/contacts$/, 'GET')
  const panelHeading = () => screen.k.one('[data-person-panel] h2')?.textContent ?? ''
  const rails = () => ({ list: screen.k.one('[data-person-rail]')!.parentElement!, panel: screen.k.one('[data-person-panel]')!.parentElement! })
  return { ...screen, events, rail, names, railRow, press, button, type, openMore, menuItem, listCalls, panelHeading, rails }
}

describe('the People tab: the list', () => {
  afterEach(async () => { await disposeAll() })

  it('reads the company\'s people in one call, the primary first, and opens the first person', async () => {
    const s = await open()
    assert.equal(s.listCalls().length, 1)
    assert.equal(s.listCalls()[0].query.get('organization_id'), '135')
    assert.deepEqual(s.names(), ['Meera Patel', 'Nidhi Joshi', 'Rakesh Shah'])
    assert.ok(s.railRow('Meera').textContent!.includes('Primary contact'), 'the star is also written for a screen reader')
    assert.ok(s.railRow('Rakesh').textContent!.includes('Accountant · Finance'))
    assert.ok(s.panelHeading().includes('Mrs. Meera Patel'), 'the first person is open')
    assert.equal(s.railRow('Meera').getAttribute('aria-current'), 'true')
    s.restore()
  })

  it('marks a person who asked not to be called with a dot that is also written', async () => {
    const s = await open()
    const dot = s.railRow('Nidhi').querySelector('[data-restriction]')!
    assert.equal(dot.getAttribute('data-restriction'), 'do-not-call')
    assert.equal(dot.textContent, 'Do not call')
    s.restore()
  })

  it('opens another person when their row is chosen', async () => {
    const s = await open()
    await s.press(s.railRow('Rakesh'), 60)
    assert.ok(s.panelHeading().includes('Rakesh Shah'))
    assert.equal(s.railRow('Rakesh').getAttribute('aria-current'), 'true')
    assert.equal(s.railRow('Meera').getAttribute('aria-current'), null)
    s.restore()
  })

  it('opens the person a link asked for', async () => {
    const s = await open({ initialPersonId: '32' })
    assert.ok(s.panelHeading().includes('Rakesh Shah'))
    s.restore()
  })

  it('says so when the company has no people yet, and keeps Add person', async () => {
    const s = await open({ world: { people: [] } })
    assert.ok(s.k.bodyText().includes('No people yet. Add the first person or import a CSV.'))
    assert.ok(s.button('Add person'))
    assert.equal(s.k.one('[data-person-panel]'), null)
    s.restore()
  })
})

describe('the People tab: search and chips', () => {
  afterEach(async () => { await disposeAll() })

  it('searches by name, email, phone and title through the server, once the typing stops', async () => {
    const s = await open()
    await s.type(s.k.one('input[aria-label="Search people"]')!, 'accountant')
    assert.equal(s.listCalls().at(-1)!.query.get('search'), 'accountant')
    assert.deepEqual(s.names(), ['Rakesh Shah'])
    await s.type(s.k.one('input[aria-label="Search people"]')!, 'zzzz')
    assert.ok(s.k.bodyText().includes('No person matches.'))
    s.restore()
  })

  it('sends nothing for a search that is still being typed', async () => {
    const s = await open()
    await s.type(s.k.one('input[aria-label="Search people"]')!, 'r', 10)
    assert.equal(s.listCalls().length, 1, 'the delay has not passed')
    s.restore()
  })

  it('narrows to Primary, Mine and Do not call with the filters the server knows, and All sends none', async () => {
    const s = await open()
    await s.press(s.button('Primary'), 60)
    assert.equal(s.listCalls().at(-1)!.query.get('primary'), '1')
    assert.deepEqual(s.names(), ['Meera Patel'])
    assert.equal(s.button('Primary')!.getAttribute('aria-pressed'), 'true')
    await s.press(s.button('Mine'), 60)
    assert.equal(s.listCalls().at(-1)!.query.get('owner'), '2', 'the signed-in user')
    assert.equal(s.listCalls().at(-1)!.query.has('primary'), false)
    await s.press(s.button('Do not call'), 60)
    assert.equal(s.listCalls().at(-1)!.query.get('do_not_call'), '1')
    assert.deepEqual(s.names(), ['Nidhi Joshi'])
    await s.press(s.button('All'), 60)
    const last = s.listCalls().at(-1)!.query
    for (const key of ['primary', 'owner', 'do_not_call']) assert.equal(last.has(key), false, key)
    s.restore()
  })
})

describe('the People tab: keyboard and phone layout', () => {
  afterEach(async () => { await disposeAll() })

  it('moves between people with the arrow keys, Home and End, keeps one row in the tab order, and opens a person with Enter or a click', async () => {
    const s = await open()
    const rows = s.rail()
    assert.deepEqual(rows.map((r) => r.getAttribute('tabindex')), ['0', '-1', '-1'], 'one row is in the tab order: the open person')
    rows[0].focus()
    await s.k.press('ArrowDown', rows[0])
    assert.equal(s.k.w.document.activeElement, rows[1])
    await s.k.press('ArrowDown', rows[1])
    assert.equal(s.k.w.document.activeElement, rows[2])
    await s.k.press('ArrowDown', rows[2])
    assert.equal(s.k.w.document.activeElement, rows[0], 'it wraps')
    await s.k.press('ArrowUp', rows[0])
    assert.equal(s.k.w.document.activeElement, rows[2], 'and wraps back')
    await s.k.press('End', rows[2])
    assert.equal(s.k.w.document.activeElement, rows[2])
    await s.k.press('Home', rows[2])
    assert.equal(s.k.w.document.activeElement, rows[0])
    assert.ok(s.panelHeading().includes('Meera'), 'moving the focus does not open anyone')
    await s.press(rows[2], 60)
    assert.ok(s.panelHeading().includes('Rakesh'))
    assert.deepEqual(s.rail().map((r) => r.getAttribute('tabindex')), ['-1', '-1', '0'])
    s.restore()
  })

  it('shows the list first on a phone and the person after one is chosen, with a Back button', async () => {
    const s = await open()
    const hides = (el: Element) => el.className.includes('max-lg:hidden')
    assert.equal(hides(s.rails().list), false, 'the list shows')
    assert.equal(hides(s.rails().panel), true, 'the person waits')
    await s.press(s.railRow('Rakesh'), 60)
    assert.equal(hides(s.rails().list), true)
    assert.equal(hides(s.rails().panel), false)
    assert.ok(s.k.one('[data-person-back]'), 'Back is there')
    assert.ok(s.rails().panel.className.includes('lg:[&_[data-person-back]]:hidden'), 'and is hidden on a wide screen, where the list is beside the person')
    await s.press(s.k.one('[data-person-back]'), 60)
    assert.equal(hides(s.rails().list), false)
    assert.equal(hides(s.rails().panel), true)
    s.restore()
  })

  it('opens on the person when a link asked for one, even on a phone', async () => {
    const s = await open({ initialPersonId: '33' })
    assert.equal(s.rails().list.className.includes('max-lg:hidden'), true)
    assert.equal(s.rails().panel.className.includes('max-lg:hidden'), false)
    s.restore()
  })

  it('is one column under a wide screen\'s two, and has no axe violations', async () => {
    const s = await open()
    const grid = s.k.one('[data-person-rail]')!.parentElement!.parentElement!
    assert.ok(grid.className.includes('grid-cols-1') && grid.className.includes('lg:grid-cols-['), grid.className)
    assert.deepEqual(await axeViolations(s.k.one('[data-person-rail]')!.parentElement!.parentElement!.parentElement!), [])
    s.restore()
  })
})

describe('the People tab: Add person, the more menu, and the rights', () => {
  afterEach(async () => { await disposeAll() })

  it('opens Add person with the company fixed, not asked for', async () => {
    const s = await open()
    await s.press(s.button('Add person'), 60)
    assert.ok(s.k.bodyText().includes('Add person'))
    assert.equal(s.k.one('[data-locked-company]')!.textContent, 'Hillcrest Academy')
    assert.ok(s.k.bodyText().includes('Hillcrest Academy'))
    s.restore()
  })

  it('disables Add person and Import without the add right, and Find duplicates without the edit right', async () => {
    const s = await open({ rights: { view: true, add: false, edit: false, delete: false } })
    assert.equal(s.button('Add person')!.disabled, true)
    assert.equal(s.button('Add person')!.getAttribute('title'), 'You do not have the add right on people.')
    await s.press(s.button('Add person'))
    assert.equal(s.k.all('[role="dialog"]').length, 0, 'nothing opened')
    await s.openMore()
    assert.notEqual(s.menuItem('Import CSV')!.getAttribute('data-disabled'), null)
    assert.notEqual(s.menuItem('Find duplicates')!.getAttribute('data-disabled'), null)
    assert.equal(s.menuItem('Export')!.getAttribute('data-disabled'), null, 'a person who may view may export')
    s.restore()
  })

  it('has Import CSV, Export, Find duplicates and the Recycle bin; Export is limited to this company', async () => {
    const s = await open()
    await s.openMore()
    assert.deepEqual(s.k.all('[role="menuitem"]').map((i) => i.textContent?.trim()), ['Import CSV', 'Export', 'Find duplicates', 'Recycle bin'])
    const href = new URL(s.menuItem('Export')!.getAttribute('href')!, 'http://test.local')
    assert.equal(href.searchParams.get('organization_id'), '135')
    assert.ok(href.pathname.endsWith('/crm/contacts/export'))
    await s.press(s.menuItem('Recycle bin'))
    assert.equal(s.router.written.at(-1), '/module/crm/marketing/recycle-bin')
    s.restore()
  })

  it('opens the import of people and the duplicates of this company only', async () => {
    const s = await open()
    await s.openMore()
    await s.press(s.menuItem('Import CSV'), 40)
    assert.ok(s.k.bodyText().includes('Import people'))
    await disposeAll()
    const t = await open({ world: { people: [meera(), rakesh()] } })
    await t.openMore()
    await t.press(t.menuItem('Find duplicates'), 60)
    assert.equal(t.callsTo(/\/crm\/contacts\/duplicates$/).length, 1)
    t.restore()
    s.restore()
  })

  it('reads the list again after a person is made primary, deleted, or added, and tells the company page', async () => {
    const s = await open()
    await s.press(s.railRow('Rakesh'), 60)
    await s.press(s.button('Make primary'), 60)
    assert.equal(s.events.changed, 1)
    assert.equal(s.listCalls().length, 2, 'the list was read again')
    assert.equal(s.names()[0], 'Rakesh Shah', 'the new primary leads the rail')
    const trigger = s.k.one('button[aria-label="More actions"]')!
    await s.k.act(async () => { trigger.dispatchEvent(new s.k.w.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, ctrlKey: false })) })
    await s.k.tick(15)
    await s.press(s.menuItem('Delete'))
    await s.press(s.k.withText('Delete person'), 80)
    assert.deepEqual(s.names(), ['Nidhi Joshi', 'Meera Patel'], 'nobody is primary any more, so by last name')
    assert.equal(s.events.changed, 2)
    assert.ok(s.panelHeading().includes('Nidhi'), 'the panel moved to the first person that is left')
    s.restore()
  })
})

describe('the People tab: Also found in GTM', () => {
  afterEach(async () => { await disposeAll() })

  const gtm = [
    { source: 'gtm' as const, id: 1, name: 'Anita Rao', email: 'anita@gtm.example', phone: null, role: 'Director', consent_status: null },
    { source: 'gtm' as const, id: 2, name: 'Vikram Nair', email: null, phone: '020 4000 7700', role: null, consent_status: null },
    { source: 'crm' as const, id: 9, name: 'Meera Patel', email: null, phone: null, role: null, consent_status: 'opted_in' },
  ]

  it('shows a collapsed strip with the GTM people only, read-only, that opens on request', async () => {
    const s = await open({ world: { gtm } })
    const strip = s.k.one('[data-gtm-strip]')!
    assert.ok(strip.textContent!.includes('Also found in GTM (2)'), 'the CRM line is not counted')
    assert.equal(strip.querySelector('li'), null, 'collapsed')
    await s.press(strip.querySelector('button'))
    assert.deepEqual(Array.from(strip.querySelectorAll('li')).map((li) => li.querySelector('p')!.textContent), ['Anita Rao', 'Vikram Nair'])
    assert.equal(strip.querySelectorAll('a, input').length, 0, 'nothing to click or send from here')
    assert.ok(strip.textContent!.includes('Read only'))
    assert.equal(strip.querySelector('button')!.getAttribute('aria-expanded'), 'true')
    s.restore()
  })

  it('shows nothing when GTM knows no one here, or when the call is refused', async () => {
    const none = await open({ world: { gtm: [gtm[2]] } })
    assert.equal(none.k.one('[data-gtm-strip]'), null)
    none.restore()
    await disposeAll()
    const refused = await open({ world: { gtm: 'fails' } })
    assert.equal(refused.k.one('[data-gtm-strip]'), null)
    refused.restore()
  })
})

describe('the People tab: the list of a person with nothing narrowed', () => {
  afterEach(async () => { await disposeAll() })

  it('never shows a person of another company (the server is asked for this one)', async () => {
    const s = await open({ world: { people: [meera(), nidhi(), { ...rakesh(), organizationId: '200' }] } })
    assert.deepEqual(s.names(), ['Meera Patel', 'Nidhi Joshi'])
    s.restore()
  })
})
