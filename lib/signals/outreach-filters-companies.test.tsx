import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { absent, says } from '../agent/assertions'
import type { OutreachListQuery } from '../../services/signals/outreach-types'
import { axeViolations } from '../agent/a11y'
import { computeFacets, filtersOf } from './outreach-facet-engine'
import { companiesAnswer } from './outreach-fake-service'
import { companySets, FACET_CATALOG } from './outreach-facet-fixtures'
import { companies } from './outreach-fixtures'
import { cleanup, outreachKit } from './outreach-screen-kit'

/**
 * The four filters (Product, Sub-product, ICP, Region) on the Companies view: the real component, a router that keeps the address, and the fake Outreach API, which FILTERS the three
 * fixture companies for real and counts the options with the other three filters applied (lib/signals/outreach-facet-engine.ts, held to the server's contract by its own test).
 *
 *   Riverdale Public School (1)  School ERP + Scholar Core; Fees and accounts, Timetable, Exam portal; B2B; Gujarat, Ahmedabad
 *   Sunrise Academy (2)          Scholar Core; Exam portal + a code no product holds; B2C; Maharashtra, Nagpur
 *   Greenfield Traders (3)       nothing recorded for product, sub-product or ICP; Gujarat, Surat
 */

async function open(options: Parameters<typeof outreachKit>[0] = {}) {
  const s = await outreachKit(options)
  const { OutreachCompanies } = await import('../../components/domain/signals/outreach/outreach-companies')
  await s.mount(s.k.h(OutreachCompanies, { service: s.service, messageDeps: s.messageDeps }))
  const ids = () => s.k.all('tbody tr[data-company]').map((row) => Number(row.getAttribute('data-company')))
  const last = () => s.calls.companies[s.calls.companies.length - 1]
  const filterParams = (query: OutreachListQuery) => Object.fromEntries((['product', 'sub_product', 'icp', 'region'] as const).filter((key) => query[key] !== undefined).map((key) => [key, query[key]]))
  return { ...s, ids, last, filterParams }
}

const FILTERS = ['Product', 'Sub-product', 'ICP', 'Region']

describe('Companies: the filter bar', () => {
  afterEach(cleanup)

  it('draws Product, Sub-product, ICP and Region as four named selects, each starting at its "All" word, with no Clear filters until one is used', async () => {
    const s = await open()
    assert.deepEqual(FILTERS.map((name) => s.shown(name)), ['All products', 'All sub-products', 'All ICPs', 'All regions'])
    const group = s.k.one('[role="group"][aria-label="Filter by product, sub-product, ICP and region"]')
    assert.ok(group, 'the four are one named group')
    assert.equal(group.querySelectorAll('[role="combobox"]').length, 4)
    assert.equal(s.button('Clear filters'), undefined)
    assert.deepEqual(s.ids(), [1, 2, 3], 'nothing is narrowed')
    assert.deepEqual(s.filterParams(s.last()), {}, 'no filter is sent')
  })

  it('says in one line why some rows sit under Not recorded', async () => {
    const s = await open()
    says(s.k.bodyText(), 'Some signals have no product, sub-product, ICP or region recorded: they appear under Not recorded.')
  })

  it('lists each option as "Name (count)" with the rows it picks, Not recorded last, and the server\'s order', async () => {
    const s = await open()
    assert.deepEqual(await s.optionsOf('Product'), ['All products', 'Scholar Core (2)', 'School ERP (1)', 'Not recorded (1)'])
    assert.deepEqual(await s.optionsOf('Sub-product'), ['All sub-products', 'Exam portal (2)', 'Fees and accounts (1)', 'Legacy bundle (1)', 'Timetable (1)', 'Not recorded (1)'])
    assert.deepEqual(await s.optionsOf('ICP'), ['All ICPs', 'B2B: Private organisations (1)', 'B2C: Consumers (1)', 'Not recorded (1)'])
    assert.deepEqual(await s.optionsOf('Region'), ['All regions', 'Gujarat (2)', 'Ahmedabad (1)', 'Maharashtra (1)', 'Nagpur (1)', 'Surat (1)'], 'the most common first, and no Not recorded when every row has one')
  })

  it('sits above the search box and the chips, so it reads as the first thing that narrows the list', async () => {
    const s = await open()
    const group = s.k.one('[role="group"][aria-label="Filter by product, sub-product, ICP and region"]')!
    const search = s.k.one('input[aria-label="Search companies"]')!
    assert.ok((group.compareDocumentPosition(search) & s.k.w.Node.DOCUMENT_POSITION_FOLLOWING) !== 0, 'the search box follows the bar')
  })

  it('offers a search box on a long list (the Region list can be long) and none on a short one', async () => {
    const places = Array.from({ length: 12 }, (_, i) => ({ value: `place-${i}`, label: `Place ${String(i).padStart(2, '0')}`, count: 12 - i }))
    const s = await open({ overrides: { companies: async (query) => { const answer = companiesAnswer(query); return { ...answer, facets: { ...answer.facets!, regions: places } } } } })
    await s.press(s.k.one('[role="combobox"][aria-label="Region"]'))
    const search = s.k.one('input[aria-label="Search options"]') as HTMLInputElement
    assert.ok(search, 'a search box opens with the long list')
    await s.type(search, 'place 07')
    const list = s.k.all('[role="listbox"]').find((el) => el.getAttribute('aria-label') === 'Region')!
    assert.deepEqual(Array.from(list.querySelectorAll('[role="option"]')).map((option) => option.textContent?.trim()), ['Place 07 (5)'])
    await s.k.press('Escape', s.k.one('[role="combobox"][aria-label="Region"]')!)
    await s.settle(200)
    await s.press(s.k.one('[role="combobox"][aria-label="Product"]'))
    absent(s.k.one('input[aria-label="Search options"]'), 'a short list has no search box')
  })
})

describe('Companies: each filter narrows the rows', () => {
  afterEach(cleanup)

  const cases: Array<{ name: string; option: string; param: string; value: string; rows: number[]; address: string }> = [
    { name: 'Product', option: 'School ERP (1)', param: 'product', value: '11', rows: [1], address: 'product=11' },
    { name: 'Sub-product', option: 'Exam portal (2)', param: 'sub_product', value: '23', rows: [1, 2], address: 'subProduct=23' },
    { name: 'ICP', option: 'B2C: Consumers (1)', param: 'icp', value: 'b2c', rows: [2], address: 'icp=b2c' },
    { name: 'Region', option: 'Gujarat (2)', param: 'region', value: 'gujarat', rows: [1, 3], address: 'region=gujarat' },
  ]

  for (const c of cases) {
    it(`${c.name}: keeps only the companies that match, asks the server for exactly that one filter, and writes it in the address`, async () => {
      const s = await open()
      await s.pick(c.name, c.option)
      assert.deepEqual(s.ids(), c.rows)
      assert.deepEqual(s.filterParams(s.last()), { [c.param]: c.value })
      assert.equal(s.router.lastSearch(), c.address)
      assert.equal(s.shown(c.name), c.option, 'the select shows what was chosen')
      assert.ok(s.button('Clear filters'), 'Clear filters appears')
    })
  }

  it('shows a row\'s own words after narrowing, not only the number of rows', async () => {
    const s = await open()
    await s.pick('ICP', 'B2C: Consumers (1)')
    says(s.rowOf('Sunrise Academy')!.textContent, 'Needs details')
    absent(s.rowOf('Riverdale Public School'), 'the company that is B2B is gone')
  })

  it('goes back to every company when a select is set to its "All" word, and takes the filter out of the address', async () => {
    const s = await open()
    await s.pick('Region', 'Gujarat (2)')
    assert.deepEqual(s.ids(), [1, 3])
    await s.pick('Region', 'All regions')
    assert.deepEqual(s.ids(), [1, 2, 3])
    assert.equal(s.router.lastSearch(), '')
    assert.deepEqual(s.filterParams(s.last()), {})
  })
})

describe('Companies: filters together, and what they count', () => {
  afterEach(cleanup)

  it('narrows further with a second filter (they are ANDed), and sends both', async () => {
    const s = await open()
    await s.pick('Region', 'Gujarat (2)')
    assert.deepEqual(s.ids(), [1, 3])
    await s.pick('Product', 'School ERP (1)')
    assert.deepEqual(s.ids(), [1])
    assert.deepEqual(s.filterParams(s.last()), { product: '11', region: 'gujarat' })
    assert.match(s.router.lastSearch(), /(^|&)product=11(&|$)/)
    assert.match(s.router.lastSearch(), /(^|&)region=gujarat(&|$)/)
  })

  it('counts each select with the OTHER three filters applied: Region Gujarat takes Scholar Core down from 2 to 1, and Maharashtra leaves only Scholar Core', async () => {
    const s = await open()
    assert.deepEqual(await s.optionsOf('Product'), ['All products', 'Scholar Core (2)', 'School ERP (1)', 'Not recorded (1)'], 'the plain count')
    await s.pick('Region', 'Gujarat (2)')
    assert.deepEqual(await s.optionsOf('Product'), ['All products', 'Scholar Core (1)', 'School ERP (1)', 'Not recorded (1)'])
    await s.pick('Region', 'All regions')
    await s.pick('Region', 'Maharashtra (1)')
    assert.deepEqual(await s.optionsOf('Product'), ['All products', 'Scholar Core (1)'], 'School ERP and Not recorded would show no company, so they are not offered')
    assert.deepEqual(await s.optionsOf('ICP'), ['All ICPs', 'B2C: Consumers (1)'])
  })

  it('counts a select without its own filter, so the other choices stay on offer: Region still lists every place while one is chosen', async () => {
    const s = await open()
    await s.pick('Region', 'Gujarat (2)')
    assert.deepEqual(await s.optionsOf('Region'), ['All regions', 'Gujarat (2)', 'Ahmedabad (1)', 'Maharashtra (1)', 'Nagpur (1)', 'Surat (1)'])
  })

  it('shows the count of the chosen option under the OTHER filters too: Gujarat reads (1) once Product is School ERP', async () => {
    const s = await open()
    await s.pick('Region', 'Gujarat (2)')
    await s.pick('Product', 'School ERP (1)')
    assert.equal(s.shown('Region'), 'Gujarat (1)')
  })
})

describe('Companies: Not recorded', () => {
  afterEach(cleanup)

  it('picks the companies with nothing recorded, and sends the value `none`', async () => {
    const s = await open()
    await s.pick('Product', 'Not recorded (1)')
    assert.deepEqual(s.ids(), [3])
    assert.deepEqual(s.filterParams(s.last()), { product: 'none' })
    assert.equal(s.router.lastSearch(), 'product=none')
    says(s.rowOf('Greenfield Traders')!.textContent, 'Added by hand')
  })

  it('works on every filter, and together with a value', async () => {
    const s = await open()
    await s.pick('ICP', 'Not recorded (1)')
    assert.deepEqual(s.ids(), [3])
    await s.pick('Region', 'Gujarat (1)')
    assert.deepEqual(s.ids(), [3])
    assert.deepEqual(s.filterParams(s.last()), { icp: 'none', region: 'gujarat' })
  })

  it('stays on offer, at zero, when it is the chosen one and no company is left', async () => {
    const s = await open({ search: 'product=11&subProduct=none' })
    assert.deepEqual(s.ids(), [], 'School ERP has sub-products, so none is without one')
    assert.equal(s.shown('Sub-product'), 'Not recorded (0)')
    assert.ok((await s.optionsOf('Sub-product')).includes('Not recorded (0)'))
  })
})

describe('Companies: the Sub-product follows the Product (the cascade)', () => {
  afterEach(cleanup)

  it('offers only the chosen product\'s sub-products once a product is chosen', async () => {
    const s = await open()
    await s.pick('Product', 'School ERP (1)')
    assert.deepEqual(await s.optionsOf('Sub-product'), ['All sub-products', 'Fees and accounts (1)', 'Timetable (1)'], 'Exam portal belongs to Scholar Core, and the code no product holds belongs to none')
  })

  it('offers every sub-product again when the product goes back to All products', async () => {
    const s = await open()
    await s.pick('Product', 'School ERP (1)')
    await s.pick('Product', 'All products')
    assert.equal((await s.optionsOf('Sub-product')).length, 6)
  })

  it('clears a sub-product that does not belong to the product just chosen, in the address and in the request', async () => {
    const s = await open()
    await s.pick('Sub-product', 'Fees and accounts (1)')
    assert.deepEqual(s.ids(), [1])
    assert.equal(s.router.lastSearch(), 'subProduct=21')
    // Riverdale carries both products, so Scholar Core is still on offer with Fees chosen; Fees belongs to School ERP.
    assert.deepEqual(await s.optionsOf('Product'), ['All products', 'Scholar Core (1)', 'School ERP (1)'])
    await s.pick('Product', 'Scholar Core (1)')
    assert.equal(s.shown('Sub-product'), 'All sub-products', 'the sub-product no longer belongs, so it was cleared')
    assert.equal(s.router.lastSearch(), 'product=12')
    assert.deepEqual(s.filterParams(s.last()), { product: '12' })
    assert.deepEqual(s.ids(), [1, 2], 'every Scholar Core company, not only the one that had Fees')
  })

  it('keeps a sub-product that does belong to the product just chosen', async () => {
    const s = await open()
    await s.pick('Sub-product', 'Fees and accounts (1)')
    await s.pick('Product', 'School ERP (1)')
    assert.equal(s.shown('Sub-product'), 'Fees and accounts (1)')
    assert.deepEqual(s.filterParams(s.last()), { product: '11', sub_product: '21' })
    assert.deepEqual(s.ids(), [1])
  })
})

describe('Companies: the chips and the page follow the filters', () => {
  afterEach(cleanup)

  it('prints on the chips the counts of the companies the filters leave, not of every company', async () => {
    const s = await open()
    assert.equal(s.chip('All')!.getAttribute('aria-label'), 'All 3')
    await s.pick('Region', 'Gujarat (2)')
    const wanted: Record<string, string> = { All: 'All 2', 'Ready to contact': 'Ready to contact 2', 'Needs details': 'Needs details 0', 'Found from signals': 'Found from signals 1', 'Added by hand': 'Added by hand 1' }
    for (const [label, name] of Object.entries(wanted)) assert.equal(s.chip(label)!.getAttribute('aria-label'), name, label)
  })

  it('works together with a chip, the search and the sort: the request carries all of them', async () => {
    const s = await open()
    await s.pick('ICP', 'B2B: Private organisations (1)')
    await s.press(s.chip('Ready to contact'))
    await s.type(s.k.one('input[aria-label="Search companies"]'), 'river')
    await s.settle(320)
    const asked = s.last() as unknown as Record<string, unknown>
    assert.equal(asked.icp, 'b2b')
    assert.equal(asked.reach, 'reachable')
    assert.equal(asked.search, 'river')
    assert.equal(asked.sort, 'name')
  })

  it('draws the options the server counts after the search: typing a name asks again and the selects take the new numbers', async () => {
    // The server counts the options over the companies the search leaves (before the chip); this stand-in does the same with a plain name match.
    const s = await open({
      overrides: {
        companies: async (query) => {
          const rows = companies().filter((row) => !query.search || row.name.toLowerCase().includes(query.search.toLowerCase()))
          return { ...companiesAnswer(query), data: rows, facets: computeFacets(rows, (row) => companySets(row.id), filtersOf(query), FACET_CATALOG) }
        },
      },
    })
    assert.deepEqual(await s.optionsOf('Product'), ['All products', 'Scholar Core (2)', 'School ERP (1)', 'Not recorded (1)'])
    await s.type(s.k.one('input[aria-label="Search companies"]'), 'sunrise')
    await s.settle(320)
    assert.equal(s.last().search, 'sunrise')
    assert.deepEqual(await s.optionsOf('Product'), ['All products', 'Scholar Core (1)'], 'only Sunrise is left, so only its product is offered')
  })

  it('goes back to page one when a filter changes, and asks for page one under the new filter', async () => {
    const s = await open({ overrides: { companies: async (query) => ({ ...companiesAnswer(query), meta: { page: query.page ?? 1, per_page: 20, total: 45, last_page: 3 } }) } })
    await s.press(s.button('Next'))
    assert.equal(s.last().page, 2)
    says(s.k.bodyText(), 'Page 2 of 3')
    await s.pick('Region', 'Gujarat (2)')
    assert.equal(s.last().page, 1, 'the new filter is asked for from the first page')
    assert.equal(s.last().region, 'gujarat')
    says(s.k.bodyText(), 'Page 1 of 3')
    assert.equal(s.calls.companies.filter((query) => query.region === 'gujarat' && query.page === 2).length, 0, 'page 2 of the new filter was never asked for')
  })

  it('pages within the filtered list afterwards, keeping the filter', async () => {
    const s = await open({ overrides: { companies: async (query) => ({ ...companiesAnswer(query), meta: { page: query.page ?? 1, per_page: 20, total: 45, last_page: 3 } }) } })
    await s.pick('Region', 'Gujarat (2)')
    await s.press(s.button('Next'))
    assert.equal(s.last().page, 2)
    assert.equal(s.last().region, 'gujarat')
    says(s.k.bodyText(), 'Page 2 of 3')
  })

  it('clears the ticked rows when a filter changes, so a bulk action never reaches a row that is no longer shown', async () => {
    const s = await open()
    await s.press(s.k.one('input[aria-label="Select Sunrise Academy"]'))
    says(s.k.one('[aria-label="Actions for the selected rows"]')!.textContent, '1 company selected')
    await s.pick('Region', 'Gujarat (2)')
    absent(s.k.one('[aria-label="Actions for the selected rows"]'), 'the bar went with the selection')
  })

  it('acts on what is shown: "select all on this page" ticks only the companies the filters leave, and Write message reads only their people', async () => {
    const s = await open()
    await s.pick('Region', 'Gujarat (2)')
    await s.press(s.k.one('input[aria-label="Select all companies on this page"]'))
    says(s.k.one('[aria-label="Actions for the selected rows"]')!.textContent, '2 companies selected')
    await s.press(s.button('Write message', s.k.one('[aria-label="Actions for the selected rows"]')!), 40)
    assert.deepEqual(s.calls.people.map((query) => query.company_id).sort(), [1, 3])
  })
})

describe('Companies: nothing matches, and getting back', () => {
  afterEach(cleanup)

  it('says "No companies match these filters." with a Clear filters button in the table, not a blank table', async () => {
    // School ERP with B2C has no company, and the options never offer the pair, so it arrives in the address (a link, a reload).
    const empty = await open({ search: 'product=11&icp=b2c' })
    assert.deepEqual(empty.ids(), [])
    const cell = empty.k.one('tbody td')!
    says(cell.textContent, 'No companies match these filters.')
    assert.ok(empty.button('Clear filters', cell), 'the button is in the empty table')
    assert.equal(empty.k.all('tbody tr').length, 1, 'the one row is the message')
    absent(empty.k.one('tbody a[href="/signals"]'), 'it is not the "no companies yet" message')
  })

  it('brings the rows back, and empties the address, when Clear filters is pressed', async () => {
    const s = await open({ search: 'view=companies&product=11&icp=b2c' })
    assert.deepEqual(s.ids(), [])
    await s.press(s.button('Clear filters', s.k.one('tbody td')!), 40)
    assert.deepEqual(s.ids(), [1, 2, 3])
    assert.equal(s.router.lastSearch(), 'view=companies', 'only the four filters were taken out of the address')
    assert.deepEqual(FILTERS.map((name) => s.shown(name)), ['All products', 'All sub-products', 'All ICPs', 'All regions'])
    assert.equal(s.button('Clear filters'), undefined, 'and the button is gone')
  })

  it('clears every filter at once from the bar', async () => {
    const s = await open()
    await s.pick('Region', 'Gujarat (2)')
    await s.pick('Product', 'School ERP (1)')
    await s.press(s.button('Clear filters'), 40)
    assert.equal(s.router.lastSearch(), '')
    assert.deepEqual(s.ids(), [1, 2, 3])
    assert.deepEqual(s.filterParams(s.last()), {})
  })

  it('keeps the old words when only the search or a chip narrows the list', async () => {
    const s = await open({ overrides: { companies: async (query) => (query.reach === 'blocked' ? { ...companiesAnswer(query), data: [] } : companiesAnswer(query)) } })
    await s.press(s.chip('Do not contact'))
    says(s.k.bodyText(), 'No company matches. Clear the search, or pick All.')
    absent(s.button('Clear filters'), 'no filter is set')
  })

  it('shows a filter nobody offered, from the address, as a chosen option that can be undone (no error, no blank box)', async () => {
    const s = await open({ search: 'region=atlantis' })
    assert.deepEqual(s.ids(), [])
    assert.equal(s.shown('Region'), 'atlantis (0)')
    says(s.k.bodyText(), 'No companies match these filters.')
    assert.equal(s.k.all('[role="alert"]').length, 0, 'it is not a failure')
    await s.press(s.button('Clear filters'), 40)
    assert.deepEqual(s.ids(), [1, 2, 3])
  })
})

describe('Companies: filters from the address', () => {
  afterEach(cleanup)

  it('opens already narrowed: the first request carries the filters of a pasted or reloaded address, and the selects show them', async () => {
    const s = await open({ search: 'product=11&region=gujarat' })
    assert.equal(s.calls.companies.length, 1, 'one request, already narrowed')
    assert.deepEqual(s.filterParams(s.last()), { product: '11', region: 'gujarat' })
    assert.deepEqual(s.ids(), [1])
    assert.equal(s.shown('Product'), 'School ERP (1)')
    assert.equal(s.shown('Region'), 'Gujarat (1)')
    assert.equal(s.shown('ICP'), 'All ICPs')
    assert.ok(s.button('Clear filters'))
  })

  it('reads Not recorded and a lower- or upper-case ICP from the address', async () => {
    const s = await open({ search: 'product=none&icp=B2B' })
    assert.deepEqual(s.filterParams(s.last()), { product: 'none', icp: 'b2b' })
  })

  it('keeps every other part of the address when a filter is chosen', async () => {
    const s = await open({ search: 'view=companies&section=queue' })
    await s.pick('ICP', 'B2B: Private organisations (1)')
    assert.equal(s.router.lastSearch(), 'view=companies&section=queue&icp=b2b')
  })
})

describe('Companies: the filters by keyboard, and for a screen reader', () => {
  afterEach(cleanup)

  it('reaches each select by Tab, opens it with the arrow keys, chooses with Enter, and leaves focus on the select', async () => {
    const s = await open()
    const trigger = s.k.one('[role="combobox"][aria-label="Product"]') as HTMLButtonElement
    assert.notEqual(trigger.tabIndex, -1, 'it is in the tab order')
    trigger.focus()
    assert.ok(s.k.w.document.activeElement === trigger, 'it takes focus')
    await s.k.press('ArrowDown', trigger)
    assert.equal(trigger.getAttribute('aria-expanded'), 'true')
    await s.k.press('ArrowDown', trigger)
    await s.k.press('Enter', trigger)
    await s.settle(60)
    assert.deepEqual(s.filterParams(s.last()), { product: '12' }, 'the option the arrow moved to was chosen')
    assert.equal(s.router.lastSearch(), 'product=12')
    assert.ok(s.k.w.document.activeElement === trigger, 'focus returned to the select')
  })

  it('closes a list with Escape and changes nothing', async () => {
    const s = await open()
    const trigger = s.k.one('[role="combobox"][aria-label="ICP"]') as HTMLButtonElement
    await s.press(trigger)
    assert.equal(trigger.getAttribute('aria-expanded'), 'true')
    await s.k.press('Escape', trigger)
    assert.equal(trigger.getAttribute('aria-expanded'), 'false')
    assert.deepEqual(s.filterParams(s.last()), {})
  })

  it('names every select, and has nothing for the accessibility rules to find', async () => {
    const s = await open({ search: 'product=11' })
    for (const name of FILTERS) assert.ok(s.k.one(`[role="combobox"][aria-label="${name}"]`), name)
    assert.deepEqual(await axeViolations(s.k.one('[role="group"][aria-label="Filter by product, sub-product, ICP and region"]')!.parentElement!), [])
  })
})
