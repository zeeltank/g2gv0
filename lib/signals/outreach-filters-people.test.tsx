import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { absent, says } from '../agent/assertions'
import type { OutreachListQuery } from '../../services/signals/outreach-types'
import { peopleAnswer } from './outreach-fake-service'
import { cleanup, outreachKit } from './outreach-screen-kit'

/**
 * The four filters (Product, Sub-product, ICP, Region) on the All people view: the real component, a router that keeps the address, and the fake Outreach API, which FILTERS the five
 * fixture people for real. A person has their company's sets, plus their own place when it is another one.
 *
 *   Meera Patel (11) and the Riverdale line (13)   company 1: School ERP + Scholar Core, B2B, Gujarat and Ahmedabad
 *   Ravi Shah (12)                                 company 3: nothing for product, sub-product or ICP; Gujarat, Surat, and his own Ahmedabad
 *   Anita Rao (14) and Kiran Desai (15)            company 2: Scholar Core, B2C, Maharashtra and Nagpur
 */

async function open(options: Parameters<typeof outreachKit>[0] = {}) {
  const s = await outreachKit(options)
  const { OutreachPeople } = await import('../../components/domain/signals/outreach/outreach-people')
  await s.mount(s.k.h(OutreachPeople, { service: s.service, messageDeps: s.messageDeps }))
  const ids = () => s.k.all('tbody tr[data-person]').map((row) => Number(row.getAttribute('data-person')))
  const last = () => s.calls.people[s.calls.people.length - 1]
  const filterParams = (query: OutreachListQuery) => Object.fromEntries((['product', 'sub_product', 'icp', 'region'] as const).filter((key) => query[key] !== undefined).map((key) => [key, query[key]]))
  return { ...s, ids, last, filterParams }
}

const FILTERS = ['Product', 'Sub-product', 'ICP', 'Region']

describe('All people: the filter bar', () => {
  afterEach(cleanup)

  it('draws the four selects at their "All" words, above the search box, with the same hint and no Clear filters yet', async () => {
    const s = await open()
    assert.deepEqual(FILTERS.map((name) => s.shown(name)), ['All products', 'All sub-products', 'All ICPs', 'All regions'])
    const group = s.k.one('[role="group"][aria-label="Filter by product, sub-product, ICP and region"]')!
    const search = s.k.one('input[aria-label="Search all people"]')!
    assert.ok((group.compareDocumentPosition(search) & s.k.w.Node.DOCUMENT_POSITION_FOLLOWING) !== 0, 'the search box follows the bar')
    says(s.k.bodyText(), 'they appear under Not recorded.')
    assert.equal(s.button('Clear filters'), undefined)
    assert.deepEqual(s.ids(), [11, 12, 13, 14, 15])
    assert.deepEqual(s.filterParams(s.last()), {})
  })

  it('lists the options with the number of PEOPLE each picks, counted by the server for this list', async () => {
    const s = await open()
    assert.deepEqual(await s.optionsOf('Product'), ['All products', 'Scholar Core (4)', 'School ERP (2)', 'Not recorded (1)'])
    assert.deepEqual(await s.optionsOf('ICP'), ['All ICPs', 'B2B: Private organisations (2)', 'B2C: Consumers (2)', 'Not recorded (1)'])
    assert.deepEqual(await s.optionsOf('Region'), ['All regions', 'Ahmedabad (3)', 'Gujarat (3)', 'Maharashtra (2)', 'Nagpur (2)', 'Surat (1)'])
  })
})

describe('All people: each filter narrows the rows', () => {
  afterEach(cleanup)

  const cases: Array<{ name: string; option: string; param: string; value: string; rows: number[]; address: string }> = [
    { name: 'Product', option: 'School ERP (2)', param: 'product', value: '11', rows: [11, 13], address: 'product=11' },
    { name: 'Sub-product', option: 'Legacy bundle (2)', param: 'sub_product', value: 'offer:G2G-09', rows: [14, 15], address: 'subProduct=offer%3AG2G-09' },
    { name: 'ICP', option: 'B2C: Consumers (2)', param: 'icp', value: 'b2c', rows: [14, 15], address: 'icp=b2c' },
    { name: 'Region', option: 'Surat (1)', param: 'region', value: 'surat', rows: [12], address: 'region=surat' },
  ]

  for (const c of cases) {
    it(`${c.name}: keeps only the people that match, asks the server for exactly that one filter, and writes it in the address`, async () => {
      const s = await open()
      await s.pick(c.name, c.option)
      assert.deepEqual(s.ids(), c.rows)
      assert.deepEqual(s.filterParams(s.last()), { [c.param]: c.value })
      assert.equal(s.router.lastSearch(), c.address)
      assert.equal(s.shown(c.name), c.option)
    })
  }

  it('counts a person\'s own place as well as their company\'s: Ravi Shah, added by hand in Ahmedabad, is in Ahmedabad with the Riverdale people', async () => {
    const s = await open()
    await s.pick('Region', 'Ahmedabad (3)')
    assert.deepEqual(s.ids(), [11, 12, 13])
    says(s.rowOf('Ravi Shah')!.textContent, 'ravi@greenfield.example')
  })

  it('ANDs two filters, and counts the second select with the first applied', async () => {
    const s = await open()
    await s.pick('Region', 'Ahmedabad (3)')
    assert.deepEqual(await s.optionsOf('ICP'), ['All ICPs', 'B2B: Private organisations (2)', 'Not recorded (1)'], 'no one in Ahmedabad is B2C, so B2C is not offered')
    await s.pick('ICP', 'B2B: Private organisations (2)')
    assert.deepEqual(s.ids(), [11, 13])
    assert.deepEqual(s.filterParams(s.last()), { icp: 'b2b', region: 'ahmedabad' })
  })

  it('picks the people with nothing recorded under Not recorded, and sends `none`', async () => {
    const s = await open()
    await s.pick('Product', 'Not recorded (1)')
    assert.deepEqual(s.ids(), [12])
    assert.deepEqual(s.filterParams(s.last()), { product: 'none' })
    assert.equal(s.router.lastSearch(), 'product=none')
  })
})

describe('All people: the Sub-product follows the Product', () => {
  afterEach(cleanup)

  it('offers only the chosen product\'s sub-products, and clears one that does not belong when the product changes', async () => {
    const s = await open()
    await s.pick('Product', 'School ERP (2)')
    assert.deepEqual(await s.optionsOf('Sub-product'), ['All sub-products', 'Fees and accounts (2)', 'Timetable (2)'])
    await s.pick('Product', 'All products')
    await s.pick('Sub-product', 'Fees and accounts (2)')
    assert.deepEqual(s.ids(), [11, 13])
    await s.pick('Product', 'Scholar Core (2)')
    assert.equal(s.shown('Sub-product'), 'All sub-products')
    assert.deepEqual(s.filterParams(s.last()), { product: '12' })
    assert.deepEqual(s.ids(), [11, 13, 14, 15])
  })
})

describe('All people: the chips, the page and the ticked rows follow the filters', () => {
  afterEach(cleanup)

  it('prints on the chips the counts of the people the filters leave', async () => {
    const s = await open()
    await s.pick('Region', 'Surat (1)')
    const wanted: Record<string, string> = { All: 'All 1', 'Ready to contact': 'Ready to contact 1', 'Needs details': 'Needs details 0', 'Found from signals': 'Found from signals 0', 'Added by hand': 'Added by hand 1' }
    for (const [label, name] of Object.entries(wanted)) assert.equal(s.chip(label)!.getAttribute('aria-label'), name, label)
  })

  it('goes back to page one when a filter changes', async () => {
    const s = await open({ overrides: { people: async (query) => ({ ...peopleAnswer(query), meta: { page: query.page ?? 1, per_page: 20, total: 45, last_page: 3 } }) } })
    await s.press(s.button('Next'))
    await s.press(s.button('Next'))
    assert.equal(s.last().page, 3)
    await s.pick('ICP', 'B2B: Private organisations (2)')
    assert.equal(s.last().page, 1)
    assert.equal(s.last().icp, 'b2b')
    says(s.k.bodyText(), 'Page 1 of 3')
    assert.equal(s.calls.people.filter((query) => query.icp === 'b2b' && query.page !== 1).length, 0, 'no page but the first was asked for under the new filter')
  })

  it('acts on what is shown: "select all on this page" ticks only the people the filters leave', async () => {
    const s = await open()
    await s.pick('ICP', 'B2C: Consumers (2)')
    await s.press(s.k.one('input[aria-label="Select all people on this page"]'))
    says(s.k.one('[aria-label="Actions for the selected rows"]')!.textContent, '2 people selected')
    await s.pick('Region', 'Nagpur (2)')
    absent(s.k.one('[aria-label="Actions for the selected rows"]'), 'a change of filter clears the ticks')
  })
})

describe('All people: nothing matches, and the address', () => {
  afterEach(cleanup)

  it('says "No people match these filters." with a Clear filters button in the table', async () => {
    const s = await open({ search: 'view=people&product=11&icp=b2c' })
    assert.deepEqual(s.ids(), [])
    const cell = s.k.one('tbody td')!
    says(cell.textContent, 'No people match these filters.')
    assert.ok(s.button('Clear filters', cell))
    assert.equal(s.k.all('tbody tr').length, 1)
    await s.press(s.button('Clear filters', cell), 40)
    assert.deepEqual(s.ids(), [11, 12, 13, 14, 15])
    assert.equal(s.router.lastSearch(), 'view=people')
  })

  it('opens already narrowed from a pasted address, and shows the chosen options', async () => {
    const s = await open({ search: 'view=people&icp=b2c&region=nagpur' })
    assert.equal(s.calls.people.length, 1)
    assert.deepEqual(s.filterParams(s.last()), { icp: 'b2c', region: 'nagpur' })
    assert.deepEqual(s.ids(), [14, 15])
    assert.equal(s.shown('ICP'), 'B2C: Consumers (2)')
    assert.equal(s.shown('Region'), 'Nagpur (2)')
  })

  it('keeps the filters in the address when a person is opened (the drawer writes ?person= beside them) and does not read the list again', async () => {
    const s = await open({ search: 'region=ahmedabad' })
    await s.press(s.rowOf('Meera Patel')!.querySelector('button'), 40)
    const written = new URLSearchParams(s.router.lastSearch())
    assert.equal(written.get('person'), '11')
    assert.equal(written.get('region'), 'ahmedabad')
    assert.deepEqual(s.filterParams(s.last()), { region: 'ahmedabad' })
    assert.equal(s.calls.people.length, 1, 'opening a person did not read the list again')
  })

  it('has every select named and reachable by keyboard', async () => {
    const s = await open()
    for (const name of FILTERS) {
      const trigger = s.k.one(`[role="combobox"][aria-label="${name}"]`) as HTMLButtonElement
      assert.ok(trigger, name)
      assert.notEqual(trigger.tabIndex, -1, `${name} is in the tab order`)
    }
    const trigger = s.k.one('[role="combobox"][aria-label="ICP"]') as HTMLButtonElement
    trigger.focus()
    await s.k.press('ArrowDown', trigger)
    await s.k.press('ArrowDown', trigger)
    await s.k.press('Enter', trigger)
    await s.settle(60)
    assert.deepEqual(s.filterParams(s.last()), { icp: 'b2b' })
  })
})
