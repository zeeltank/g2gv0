import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { absent, says } from '../agent/assertions'
import { axeViolations } from '../agent/a11y'
import { cleanup, outreachKit } from './outreach-screen-kit'

/**
 * The Outreach tab's page: the switch between Companies, All people and Messages, in a fake browser with a router that keeps the address. The Messages view is a stand-in node (the
 * real queue is another file with its own tests); what is proved here is that the page builds only the open view, keeps the address, keeps each list's search between views, and puts
 * the open list's button in the header row.
 */

async function open(search = '', options: Parameters<typeof outreachKit>[0] = {}) {
  const s = await outreachKit({ ...options, search })
  const { OutreachPage } = await import('../../components/domain/signals/outreach/outreach-page')
  const built = { messages: 0 }
  const Probe = () => {
    built.messages += 1
    return s.k.h('p', { 'data-messages': 'yes' }, 'The message queue stands here.')
  }
  await s.mount(s.k.h(OutreachPage, { service: s.service, messages: s.k.h(Probe), messageDeps: s.messageDeps }))
  const tabs = () => s.k.all('[role="tablist"][aria-label="Outreach sections"] [role="tab"]')
  const tab = (label: string) => tabs().find((t) => t.textContent === label)
  const selected = () => tabs().filter((t) => t.getAttribute('aria-selected') === 'true').map((t) => t.textContent)
  return { ...s, built, tabs, tab, selected }
}

describe('the Outreach page: the three views', () => {
  afterEach(cleanup)

  it('offers Companies, All people and Messages, opens Companies, and says in one line what the tab is for', async () => {
    const s = await open()
    assert.deepEqual(s.tabs().map((t) => t.textContent), ['Companies', 'All people', 'Messages'])
    assert.deepEqual(s.selected(), ['Companies'])
    says(s.k.bodyText(), 'The companies your signals found and the people at them. Write to them, and turn the right ones into leads.')
    assert.ok(s.rowOf('Riverdale Public School'), 'the companies are on the page')
  })

  it('builds only the open view: no people are read and the queue is not built while Companies is open', async () => {
    const s = await open()
    assert.equal(s.calls.companies.length, 1)
    assert.equal(s.calls.people.length, 0)
    assert.equal(s.built.messages, 0)
    absent(s.k.one('[data-messages]'), 'the queue is not on the page')
  })

  it('opens All people, writes ?view=people into the address, and reads the people only then', async () => {
    const s = await open()
    await s.press(s.tab('All people'), 40)
    assert.equal(s.router.lastSearch(), 'view=people')
    assert.deepEqual(s.selected(), ['All people'])
    assert.equal(s.calls.people.length, 1)
    assert.ok(s.rowOf('Meera Patel'), 'the people are on the page')
    absent(s.k.one('input[aria-label="Search companies"]'), 'the companies list is no longer built')
    assert.ok(s.k.one('input[aria-label="Search all people"]'))
  })

  it('opens Messages with the node it was given, and reads neither list', async () => {
    const s = await open()
    await s.press(s.tab('Messages'), 40)
    assert.equal(s.router.lastSearch(), 'view=messages')
    assert.equal(s.k.one('[data-messages]')!.textContent, 'The message queue stands here.')
    assert.equal(s.built.messages > 0, true)
    assert.equal(s.calls.people.length, 0)
    assert.equal(s.calls.companies.length, 1, 'Companies was read once, when it opened')
  })

  it('opens the view a pasted address names, and Companies for one it does not know', async () => {
    const messages = await open('view=messages')
    assert.deepEqual(messages.selected(), ['Messages'])
    assert.ok(messages.k.one('[data-messages]'))
    assert.equal(messages.calls.companies.length, 0)
    await cleanup()
    const people = await open('view=people')
    assert.deepEqual(people.selected(), ['All people'])
    assert.equal(people.calls.companies.length, 0)
    await cleanup()
    const unknown = await open('view=nonsense')
    assert.deepEqual(unknown.selected(), ['Companies'])
  })

  it('goes back to the plain address when Companies is chosen again', async () => {
    const s = await open('view=people')
    await s.press(s.tab('Companies'), 40)
    assert.equal(s.router.lastSearch(), '')
    assert.deepEqual(s.selected(), ['Companies'])
  })

  it('moves between the views with the arrow keys, as every tab bar here does', async () => {
    const s = await open()
    const first = s.tab('Companies')!
    first.focus()
    await s.k.press('ArrowRight', first)
    await s.settle(40)
    assert.deepEqual(s.selected(), ['All people'])
    assert.equal(s.router.lastSearch(), 'view=people')
  })

  it('has no accessibility violation a fake page can see', async () => {
    const s = await open()
    assert.deepEqual(await axeViolations(s.k.one('[role="tablist"]')!.parentElement!), [])
  })
})

describe('the Outreach page: the header button and the lists\' memory', () => {
  afterEach(cleanup)

  const headerButtons = (s: Awaited<ReturnType<typeof open>>) => {
    const tablist = s.k.one('[role="tablist"][aria-label="Outreach sections"]')!
    return s.k.all('button').filter((b) => (b.compareDocumentPosition(tablist) & s.k.w.Node.DOCUMENT_POSITION_FOLLOWING) !== 0).map((b) => b.textContent?.trim())
  }

  it('draws Add company above the tabs on Companies, Add person there on All people, and neither on Messages', async () => {
    const s = await open()
    assert.deepEqual(headerButtons(s), ['Add company'])
    await s.press(s.tab('All people'), 40)
    assert.deepEqual(headerButtons(s), ['Add person'])
    await s.press(s.tab('Messages'), 40)
    assert.deepEqual(headerButtons(s), [])
  })

  it('keeps what was searched for in each list while another view is open', async () => {
    const s = await open()
    await s.type(s.k.one('input[aria-label="Search companies"]'), 'sunrise')
    await s.settle(320)
    assert.equal(s.calls.companies[s.calls.companies.length - 1].search, 'sunrise')
    await s.press(s.tab('All people'), 40)
    await s.press(s.tab('Companies'), 40)
    assert.equal((s.k.one('input[aria-label="Search companies"]') as HTMLInputElement).value, 'sunrise')
    assert.equal(s.calls.companies[s.calls.companies.length - 1].search, 'sunrise', 'the list asked for the same search again')
  })

  it('opens the person drawer from the All people view with ?person= next to ?view=', async () => {
    const s = await open('view=people')
    await s.press(s.rowOf('Meera Patel')!.querySelector('button'), 40)
    assert.match(s.router.lastSearch(), /(^|&)view=people(&|$)/)
    assert.match(s.router.lastSearch(), /(^|&)person=11(&|$)/)
    assert.equal(s.k.one('[data-person-panel]')!.getAttribute('data-person-panel'), '11')
  })
})
