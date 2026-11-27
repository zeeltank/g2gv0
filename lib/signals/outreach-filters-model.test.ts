import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { OutreachFacets } from '../../services/signals/outreach-types'
import { outreachQueryParams } from '../../services/signals/outreach'
import {
  changeFilters, FILTER_ALL_LABEL, FILTER_KEYS, FILTER_LABEL, FILTER_NOTE, filterOptions, filterQuery, filtersActive, filtersKey, INITIAL_OUTREACH_STATE, listPage, NOT_RECORDED,
  outreachQuery, readFilters, withChange, writeFilters,
} from './outreach-model'

/**
 * The four filters (Product, Sub-product, ICP, Region) as pure rules: the address they live in, the query they become, the cascade from product to sub-product, the words of each option
 * and the page a list is on. Nothing here needs a browser; the screens that use them are tested on their own.
 */

/** What the server's `facets` hold for a small tenant: two products (one with two sub-products), a code no product holds, three kinds of customer and four regions. */
function facets(over: Partial<OutreachFacets> = {}): OutreachFacets {
  return {
    products: [{ value: '11', label: 'School ERP', count: 4 }, { value: '12', label: 'Scholar Core', count: 2 }],
    subProducts: [
      { value: '21', label: 'Fees and accounts', count: 3, productId: 11 },
      { value: '22', label: 'Timetable', count: 1, productId: 11 },
      { value: '23', label: 'Exam portal', count: 2, productId: 12 },
      { value: 'offer:G2G-09', label: 'Legacy bundle', count: 1, productId: null },
    ],
    icps: [{ value: 'b2b', label: 'B2B: Private organisations', count: 4 }, { value: 'b2c', label: 'B2C: Consumers', count: 2 }],
    regions: [{ value: 'gujarat', label: 'Gujarat', count: 5 }, { value: 'nagpur', label: 'Nagpur', count: 2 }],
    notRecorded: { products: 3, subProducts: 4, icps: 5, regions: 0 },
    active: { product: null, subProduct: null, icp: null, region: null },
    ...over,
  }
}

const labels = (key: (typeof FILTER_KEYS)[number], f: OutreachFacets | null | undefined, filters = {}) => filterOptions(key, f, filters).map((option) => option.label)

describe('the four filters in the address', () => {
  it('names them Product, Sub-product, ICP and Region, each starting at an "All" word', () => {
    assert.deepEqual(FILTER_KEYS.map((key) => FILTER_LABEL[key]), ['Product', 'Sub-product', 'ICP', 'Region'])
    assert.deepEqual(FILTER_KEYS.map((key) => FILTER_ALL_LABEL[key]), ['All products', 'All sub-products', 'All ICPs', 'All regions'])
  })

  it('reads ?product=&subProduct=&icp=&region= and nothing else', () => {
    const filters = readFilters(new URLSearchParams('view=people&product=11&subProduct=21&icp=b2b&region=gujarat&person=7'))
    assert.deepEqual(filters, { product: '11', subProduct: '21', icp: 'b2b', region: 'gujarat' })
  })

  it('treats a missing, empty or blank value as no filter, trims, and lower-cases the ICP the way the server spells it', () => {
    assert.deepEqual(readFilters(new URLSearchParams('')), {})
    assert.deepEqual(readFilters(new URLSearchParams('product=&subProduct=%20%20&region=')), {})
    assert.deepEqual(readFilters(new URLSearchParams('product=%2011%20&icp=B2G')), { product: '11', icp: 'b2g' })
  })

  it('drops a value too long to be one the server offered, instead of sending it', () => {
    assert.deepEqual(readFilters(new URLSearchParams(`region=${'x'.repeat(121)}`)), {})
    assert.deepEqual(readFilters(new URLSearchParams(`region=${'x'.repeat(120)}`)), { region: 'x'.repeat(120) })
  })

  it('reads the Not recorded value and a value nobody offered exactly as they are (the server decides what they match)', () => {
    assert.deepEqual(readFilters(new URLSearchParams('product=none&region=atlantis')), { product: NOT_RECORDED, region: 'atlantis' })
  })

  it('writes them back, round trip, and keeps every other parameter the address holds', () => {
    const filters = { product: '12', subProduct: '23', icp: 'b2c', region: 'nagpur' }
    const written = writeFilters(new URLSearchParams('view=messages&section=queue&person=4'), filters)
    assert.equal(written.get('view'), 'messages')
    assert.equal(written.get('section'), 'queue')
    assert.equal(written.get('person'), '4')
    assert.deepEqual(readFilters(written), filters)
  })

  it('removes a filter that is no longer set, and leaves the rest of the address alone', () => {
    const written = writeFilters(new URLSearchParams('view=people&product=11&icp=b2b&region=gujarat'), { icp: 'b2b' })
    assert.equal(written.toString(), 'view=people&icp=b2b')
    assert.equal(writeFilters(new URLSearchParams('view=people&product=11'), {}).toString(), 'view=people')
  })

  it('says whether any is set, and gives each set of filters its own key', () => {
    assert.equal(filtersActive({}), false)
    assert.equal(filtersActive({ region: 'gujarat' }), true)
    assert.equal(filtersKey({ product: '1' }), filtersKey({ product: '1' }))
    assert.notEqual(filtersKey({ product: '1' }), filtersKey({ subProduct: '1' }), 'the same value under another filter is another set')
    assert.notEqual(filtersKey({}), filtersKey({ icp: 'b2b' }))
  })
})

describe('the request the four filters become', () => {
  it('uses the names the server reads (sub_product), and only for the filters that are set', () => {
    assert.deepEqual(filterQuery({ product: '11', subProduct: '21', icp: 'b2b', region: 'gujarat' }), { product: '11', sub_product: '21', icp: 'b2b', region: 'gujarat' })
    assert.deepEqual(filterQuery({ icp: 'b2c' }), { icp: 'b2c' })
    assert.deepEqual(filterQuery({}), {})
  })

  it('goes into the list request beside the chip, the search and the sort, and an unset filter never reaches the server', () => {
    const state = { ...INITIAL_OUTREACH_STATE, search: 'sun', chip: 'reachable' as const }
    const query = outreachQuery(state, {}, { product: '11', region: 'gujarat' })
    assert.equal(query.reach, 'reachable')
    assert.equal(query.search, 'sun')
    assert.equal(query.product, '11')
    assert.equal(query.region, 'gujarat')
    assert.equal('sub_product' in query, false)
    assert.equal('icp' in query, false)
    assert.deepEqual(outreachQueryParams(query), { page: '1', per_page: '20', sort: 'name', dir: 'asc', reach: 'reachable', search: 'sun', product: '11', region: 'gujarat' })
  })

  it('sends Not recorded as `none`, and drops an empty filter from the transport', () => {
    assert.deepEqual(outreachQueryParams({ product: 'none', sub_product: '', icp: undefined, region: 'surat' }), { product: 'none', region: 'surat' })
  })
})

describe('the cascade: the Sub-product follows the Product', () => {
  const f = facets()

  it('clears a sub-product that does not belong to the product just chosen', () => {
    assert.deepEqual(changeFilters({ product: '11', subProduct: '21' }, { product: '12' }, f), { product: '12' })
  })

  it('keeps a sub-product that belongs to the product just chosen (All products -> its own product)', () => {
    assert.deepEqual(changeFilters({ subProduct: '21' }, { product: '11' }, f), { product: '11', subProduct: '21' })
  })

  it('keeps the sub-product when the product goes back to All products, and when Not recorded is the sub-product', () => {
    assert.deepEqual(changeFilters({ product: '11', subProduct: '21' }, { product: '' }, f), { subProduct: '21' })
    assert.deepEqual(changeFilters({ product: '11', subProduct: NOT_RECORDED }, { product: '12' }, f), { product: '12', subProduct: NOT_RECORDED })
  })

  it('clears a sub-product of a product when the product becomes Not recorded, but keeps a code no product holds', () => {
    assert.deepEqual(changeFilters({ subProduct: '21' }, { product: NOT_RECORDED }, f), { product: NOT_RECORDED })
    assert.deepEqual(changeFilters({ subProduct: 'offer:G2G-09' }, { product: NOT_RECORDED }, f), { product: NOT_RECORDED, subProduct: 'offer:G2G-09' })
  })

  it('clears a sub-product it cannot tell the product of (not among the options), so a pair that cannot match is never left on screen', () => {
    assert.deepEqual(changeFilters({ subProduct: '99' }, { product: '12' }, f), { product: '12' })
    assert.deepEqual(changeFilters({ subProduct: '21' }, { product: '12' }, null), { product: '12' })
  })

  it('does nothing to the sub-product when the product did not change, or when the change names the sub-product itself', () => {
    assert.deepEqual(changeFilters({ product: '11', subProduct: '21' }, { product: '11' }, f), { product: '11', subProduct: '21' })
    assert.deepEqual(changeFilters({ product: '11', subProduct: '21' }, { subProduct: '22' }, f), { product: '11', subProduct: '22' })
    assert.deepEqual(changeFilters({ product: '11', subProduct: '21' }, { product: '12', subProduct: '23' }, f), { product: '12', subProduct: '23' })
  })

  it('leaves the other two filters as they were, and clears one that is set to an empty string', () => {
    assert.deepEqual(changeFilters({ product: '11', icp: 'b2b', region: 'gujarat' }, { icp: '' }, f), { product: '11', region: 'gujarat' })
    assert.deepEqual(changeFilters({ product: '11', subProduct: '21', icp: 'b2b' }, { product: '12' }, f), { product: '12', icp: 'b2b' })
  })
})

describe('the words of each option', () => {
  const f = facets()

  it('starts at "All ...", lists each option as "Name (count)", and ends with "Not recorded (count)"', () => {
    assert.deepEqual(labels('product', f), ['All products', 'School ERP (4)', 'Scholar Core (2)', 'Not recorded (3)'])
    assert.deepEqual(labels('icp', f), ['All ICPs', 'B2B: Private organisations (4)', 'B2C: Consumers (2)', 'Not recorded (5)'])
    assert.deepEqual(filterOptions('product', f, {}).map((option) => option.value), ['', '11', '12', NOT_RECORDED], 'the value of Not recorded is none, of All is empty')
  })

  it('leaves out Not recorded when no row is without a value, and an option no row picks', () => {
    assert.deepEqual(labels('region', f), ['All regions', 'Gujarat (5)', 'Nagpur (2)'])
    assert.deepEqual(labels('region', facets({ regions: [{ value: 'gujarat', label: 'Gujarat', count: 5 }, { value: 'goa', label: 'Goa', count: 0 }] })), ['All regions', 'Gujarat (5)'])
  })

  it('keeps the CHOSEN option listed even at zero, so a person can see and undo what is applied', () => {
    const empty = facets({ regions: [{ value: 'goa', label: 'Goa', count: 0 }], notRecorded: { products: 0, subProducts: 0, icps: 0, regions: 0 } })
    assert.deepEqual(labels('region', empty, { region: 'goa' }), ['All regions', 'Goa (0)'])
    assert.deepEqual(labels('region', empty, { region: NOT_RECORDED }), ['All regions', 'Not recorded (0)'], 'an option with no rows that is not the chosen one stays out; Not recorded is the chosen one')
  })

  it('names a chosen value the server did not list (a typed address), never a blank', () => {
    assert.deepEqual(labels('region', f, { region: 'atlantis' }), ['All regions', 'Gujarat (5)', 'Nagpur (2)', 'atlantis (0)'])
    assert.deepEqual(labels('icp', f, { icp: 'b2g' }), ['All ICPs', 'B2B: Private organisations (4)', 'B2C: Consumers (2)', 'B2G: Government and tenders (0)', 'Not recorded (5)'])
    assert.deepEqual(labels('product', f, { product: '99' }).slice(-2), ['Unknown product (0)', 'Not recorded (3)'])
    assert.deepEqual(labels('subProduct', f, { subProduct: 'offer:ZZ-1' }).includes('ZZ-1 (0)'), true)
  })

  it('offers only the chosen product\'s sub-products when a real product is chosen', () => {
    assert.deepEqual(labels('subProduct', f, { product: '11' }), ['All sub-products', 'Fees and accounts (3)', 'Timetable (1)', 'Not recorded (4)'])
    assert.deepEqual(labels('subProduct', f, { product: '12' }), ['All sub-products', 'Exam portal (2)', 'Not recorded (4)'])
  })

  it('offers every sub-product with All products or Not recorded chosen', () => {
    assert.deepEqual(labels('subProduct', f, {}), ['All sub-products', 'Fees and accounts (3)', 'Timetable (1)', 'Exam portal (2)', 'Legacy bundle (1)', 'Not recorded (4)'])
    assert.equal(labels('subProduct', f, { product: NOT_RECORDED }).length, 6)
  })

  it('keeps the chosen sub-product listed even when it is not the chosen product\'s', () => {
    assert.ok(labels('subProduct', f, { product: '12', subProduct: '21' }).includes('Fees and accounts (3)'))
  })

  it('keeps the server\'s order, and reads numeric ids as the strings the address holds', () => {
    const numeric = facets({ products: [{ value: 7 as unknown as string, label: 'Zeta', count: 1 }, { value: 3 as unknown as string, label: 'Alpha', count: 2 }] })
    assert.deepEqual(labels('product', numeric), ['All products', 'Zeta (1)', 'Alpha (2)', 'Not recorded (3)'])
    assert.deepEqual(filterOptions('product', numeric, { product: '3' }).map((option) => option.value), ['', '7', '3', NOT_RECORDED])
  })

  it('offers only "All ..." before the server has answered, and Not recorded alone when it is the chosen one', () => {
    assert.deepEqual(labels('product', null), ['All products'])
    assert.deepEqual(labels('region', undefined, { region: NOT_RECORDED }), ['All regions', 'Not recorded (0)'])
  })

  it('says in one plain line why some rows sit under Not recorded', () => {
    assert.equal(FILTER_NOTE, 'Some signals have no product, sub-product, ICP or region recorded: they appear under Not recorded.')
  })
})

describe('the page a list is on, with the filters shared by three lists', () => {
  it('is the list\'s own page while the filters are the ones it chose that page under', () => {
    const second = withChange(INITIAL_OUTREACH_STATE, { page: 2 }, filtersKey({ product: '11' }))
    assert.equal(listPage(second, { product: '11' }), 2)
    assert.equal(outreachQuery(second, {}, { product: '11' }).page, 2)
  })

  it('goes back to page one when the filters are not the ones the page was chosen under (also for a list that was out of sight)', () => {
    const second = withChange(INITIAL_OUTREACH_STATE, { page: 2 }, filtersKey({ product: '11' }))
    assert.equal(listPage(second, { product: '12' }), 1)
    assert.equal(listPage(second, {}), 1)
    assert.equal(outreachQuery(second, {}, { icp: 'b2b' }).page, 1)
  })

  it('remembers a page against the filters it was chosen under, and a chip, search or sort goes to page one under the current ones', () => {
    const key = filtersKey({ region: 'gujarat' })
    const third = withChange(INITIAL_OUTREACH_STATE, { page: 3 }, key)
    assert.equal(withChange(third, { chip: 'mine' }, key).page, 1)
    assert.equal(withChange(third, { page: 4 }, key).page, 4)
    assert.equal(withChange(third, { page: 4 }, key).filtersKey, key)
  })

  it('is the state\'s own page when no filters are given, so the old callers read what they always read', () => {
    assert.equal(outreachQuery({ ...INITIAL_OUTREACH_STATE, page: 3 }).page, 3)
    assert.equal(listPage({ ...INITIAL_OUTREACH_STATE, page: 3 }), 3)
    assert.equal(listPage({ ...INITIAL_OUTREACH_STATE, page: 3 }, {}), 3, 'a page chosen under no filters is still page 3 under no filters')
  })
})
