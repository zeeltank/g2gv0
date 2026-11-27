import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { says } from '../agent/assertions'
import { readiness } from '../outreach/fixtures'
import { companiesAnswer, peopleAnswer } from './outreach-fake-service'
import { queueAnswer } from './outreach-facet-fixtures'
import { cleanup, outreachKit } from './outreach-screen-kit'

/**
 * The four filters across the three views of the Outreach tab, in one page: the real OutreachPage with the real Messages queue, the fake Outreach API for Companies and All people, and
 * a stand-in GTM server for the queue. The filters live in the ADDRESS, so what is chosen on one view is what the next opens with; a reload of the address opens the same narrowed
 * list; and a page number chosen under other filters never carries over.
 */

async function open(search = '', options: Parameters<typeof outreachKit>[0] = {}) {
  const s = await outreachKit({
    ...options,
    search,
    respond: (call) => {
      if (call.method === 'GET' && call.path.endsWith('/gtm/outreach')) return queueAnswer(call.query)
      if (call.path.endsWith('/gtm/outreach/readiness')) return { status: 1, data: readiness() }
      return undefined
    },
  })
  const { OutreachPage } = await import('../../components/domain/signals/outreach/outreach-page')
  const { MessagesPanel } = await import('../../components/domain/signals/outreach/messages-panel')
  await s.mount(s.k.h(OutreachPage, { service: s.service, messages: s.k.h(MessagesPanel), messageDeps: s.messageDeps }), 80)
  const tab = (label: string) => s.k.all('[role="tablist"][aria-label="Outreach sections"] [role="tab"]').find((t) => t.textContent === label)
  const selected = () => s.k.all('[role="tablist"][aria-label="Outreach sections"] [role="tab"]').filter((t) => t.getAttribute('aria-selected') === 'true').map((t) => t.textContent)
  const go = async (label: string) => { await s.press(tab(label), 80) }
  // `calls` of the kit are the Outreach API's; the reads of the queue go through fetch, which `to` lists.
  const queueCalls = () => s.to('/gtm/outreach').filter((c) => c.method === 'GET')
  const address = () => new URLSearchParams(s.router.lastSearch())
  /** What the open view's four selects show. */
  const chosen = () => ['Product', 'Sub-product', 'ICP', 'Region'].map((name) => s.shown(name))
  const messageNames = () => s.k.all('[role="tabpanel"]:not([hidden]) tbody tr').map((row) => row.querySelector('td .font-medium')?.textContent ?? '')

  return { ...s, tab, selected, go, queueCalls, address, chosen, messageNames }
}

describe('the filters across Companies, All people and Messages', () => {
  afterEach(cleanup)

  it('keeps what was chosen on Companies when All people and then Messages are opened, in the address and in what each view asks for', async () => {
    const s = await open()
    await s.pick('Region', 'Gujarat (2)')
    await s.pick('Product', 'School ERP (1)')
    assert.equal(s.address().get('region'), 'gujarat')
    assert.equal(s.address().get('product'), '11')

    await s.go('All people')
    assert.deepEqual(s.selected(), ['All people'])
    assert.equal(s.address().get('view'), 'people')
    assert.equal(s.address().get('region'), 'gujarat', 'the address still holds the filters')
    assert.equal(s.address().get('product'), '11')
    assert.equal(s.calls.people[s.calls.people.length - 1].region, 'gujarat', 'All people asked with them')
    assert.equal(s.calls.people[s.calls.people.length - 1].product, '11')
    assert.equal(s.shown('Product')?.startsWith('School ERP'), true, `Product shows what was chosen: ${s.shown('Product')}`)
    assert.equal(s.shown('Region')?.startsWith('Gujarat'), true)
    assert.deepEqual(s.k.all('tbody tr[data-person]').map((row) => row.getAttribute('data-person')), ['11', '13'], 'and shows the people of School ERP in Gujarat')

    await s.go('Messages')
    assert.deepEqual(s.selected(), ['Messages'])
    assert.equal(s.address().get('view'), 'messages')
    assert.equal(s.queueCalls().length, 1)
    assert.equal(s.queueCalls()[0].query.get('region'), 'gujarat', 'the queue asked with them')
    assert.equal(s.queueCalls()[0].query.get('product'), '11')
    assert.deepEqual(s.messageNames(), ['Asha Menon', 'Meera Patel'])
    assert.ok(s.shown('Product')!.startsWith('School ERP') && s.shown('Region')!.startsWith('Gujarat'))
  })

  it('keeps the filters going back to Companies, and a change made on Messages is what Companies opens with', async () => {
    const s = await open('view=messages')
    await s.pick('ICP', 'B2B: Private organisations (2)')
    await s.go('Companies')
    assert.equal(s.address().get('icp'), 'b2b')
    assert.equal(s.address().get('view'), null, 'Companies is the first view and leaves ?view= out')
    assert.equal(s.calls.companies[s.calls.companies.length - 1].icp, 'b2b')
    assert.deepEqual(s.k.all('tbody tr[data-company]').map((row) => row.getAttribute('data-company')), ['1'])
    assert.equal(s.shown('ICP'), 'B2B: Private organisations (1)')
  })

  it('opens whichever view the address names already narrowed, on a reload of the address', async () => {
    const people = await open('view=people&product=11&region=gujarat')
    assert.equal(people.calls.companies.length, 0, 'Companies was not built')
    assert.equal(people.calls.people.length, 1)
    assert.equal(people.calls.people[0].product, '11')
    assert.equal(people.calls.people[0].region, 'gujarat')
    assert.deepEqual(people.k.all('tbody tr[data-person]').map((row) => row.getAttribute('data-person')), ['11', '13'])
    await cleanup()

    const companies = await open('product=none')
    assert.equal(companies.calls.companies.length, 1)
    assert.equal(companies.calls.companies[0].product, 'none')
    assert.deepEqual(companies.k.all('tbody tr[data-company]').map((row) => row.getAttribute('data-company')), ['3'])
    await cleanup()

    const messages = await open('view=messages&icp=b2c')
    assert.equal(messages.queueCalls().length, 1)
    assert.equal(messages.queueCalls()[0].query.get('icp'), 'b2c')
    assert.deepEqual(messages.messageNames(), ['Anita Rao'])
  })

  it('shows the same filters on all three views, and each view reads its own options with its own counts', async () => {
    const s = await open('region=gujarat')
    assert.equal(s.shown('Region'), 'Gujarat (2)', 'Companies counts companies')
    await s.go('All people')
    assert.equal(s.shown('Region'), 'Gujarat (3)', 'All people counts people')
    await s.go('Messages')
    assert.equal(s.shown('Region'), 'Gujarat (3)', 'Messages counts messages')
    for (const name of ['Product', 'Sub-product', 'ICP', 'Region']) assert.equal(s.k.all(`[role="combobox"][aria-label="${name}"]`).length, 1, `exactly one ${name} select is on the page`)
  })

  it('takes the filters out of the address on every view with Clear filters, and leaves the open view and section', async () => {
    const s = await open('view=messages&section=queue&product=11&icp=b2b')
    await s.press(s.k.withText('Clear filters'), 80)
    assert.equal(s.address().get('product'), null)
    assert.equal(s.address().get('icp'), null)
    assert.equal(s.address().get('view'), 'messages')
    assert.equal(s.address().get('section'), 'queue')
    await s.go('All people')
    assert.deepEqual(s.chosen(), ['All products', 'All sub-products', 'All ICPs', 'All regions'])
  })
})

describe('a page number does not outlive the filters it was chosen under', () => {
  afterEach(cleanup)

  const paged = (answer: typeof companiesAnswer | typeof peopleAnswer) => async (query: Parameters<typeof companiesAnswer>[0]) => ({ ...answer(query), meta: { page: query.page ?? 1, per_page: 20, total: 45, last_page: 3 } })

  it('starts a list over at page one when the filters changed on another view while it was out of sight', async () => {
    const s = await open('', { overrides: { companies: paged(companiesAnswer) as never, people: paged(peopleAnswer) as never } })
    await s.press(s.button('Next'))
    assert.equal(s.calls.companies[s.calls.companies.length - 1].page, 2)
    says(s.k.bodyText(), 'Page 2 of 3')

    await s.go('All people')
    await s.pick('Product', 'School ERP (2)')
    await s.go('Companies')
    const asked = s.calls.companies[s.calls.companies.length - 1]
    assert.equal(asked.product, '11', 'Companies asks under the filter chosen on All people')
    assert.equal(asked.page, 1, 'and from its first page, not from the page 2 it was left on')
    says(s.k.bodyText(), 'Page 1 of 3')
  })

  it('remembers the page when the filters did not change while a view was out of sight', async () => {
    const s = await open('product=11', { overrides: { companies: paged(companiesAnswer) as never } })
    await s.press(s.button('Next'))
    await s.go('All people')
    await s.go('Companies')
    const asked = s.calls.companies[s.calls.companies.length - 1]
    assert.equal(asked.page, 2, 'the same filters, the same page')
    assert.equal(asked.product, '11')
  })
})
