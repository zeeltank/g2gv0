import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { listQueryString, patchListQuery, readListQuery } from '../../components/shared/scaffolds/list-query'
import {
  asksTheList, clearOpportunityFiltersPatch, DEFAULT_PER_PAGE, isNarrowedHere, listRequest, OPPORTUNITIES_QUERY, opportunityListState,
  productParam, resolveProductScope, SEARCH_MAX,
} from './opportunity-query'
import { reviewStatusOf } from './list-model'

const read = (search: string) => readListQuery(new URLSearchParams(search), OPPORTUNITIES_QUERY)
const PRODUCTS = [
  { key: 'scholarclone', ready: true, offers: [{ offer_id: 'SCH-11' }] },
  { key: 'enterprise_brain', ready: false, offers: [] },
  { key: 'g2g', ready: true, offers: [] },
]

describe('the address of Company Opportunities', () => {
  // CHANGED ON PURPOSE (S17, 25 Nov 2026): the page-size box is gone, so `per` is not in the address any more; five is the only page size.
  it('opens as it always did: a bare address is every status, the usual order, five per page, and no product named', () => {
    const query = read('')
    assert.deepEqual(query.filters, { product: '', status: 'all', freshness: 'all', fit: 'all' })
    assert.equal(query.sort, 'default')
    assert.equal(query.page, 1)
    assert.equal(query.q, '')
    assert.equal(listQueryString(query, OPPORTUNITIES_QUERY), '', 'the default view has a clean address')
  })

  it('reads a link made for the Signal Review with the Review\'s own names', () => {
    const query = read('product=4&status=contacted&freshness=last_30_days&fit=g2g&sort=priority&page=2&q=fee')
    assert.deepEqual(query.filters, { product: '4', status: 'contacted', freshness: 'last_30_days', fit: 'g2g' })
    assert.equal(query.sort, 'priority')
    assert.equal(query.page, 2)
    assert.equal(query.q, 'fee')
  })

  it('writes the same names back, leaving out whatever is the default', () => {
    const query = read('q=fee&status=reviewed&sort=recent&product=scholarclone')
    assert.equal(listQueryString(query, OPPORTUNITIES_QUERY), 'q=fee&sort=recent&product=scholarclone&status=reviewed')
    assert.deepEqual(read(listQueryString(query, OPPORTUNITIES_QUERY)), query, 'what is written reads back as the same view')
  })

  it('turns a word that is not allowed back into the default, so nothing odd reaches the server', () => {
    const query = read('status=bogus&freshness=bogus&sort=bogus&page=0')
    assert.deepEqual(query.filters, { product: '', status: 'all', freshness: 'all', fit: 'all' })
    assert.equal(query.sort, 'default')
    assert.equal(query.page, 1)
  })

  it('changing a filter goes back to page one', () => {
    const query = read('page=4&q=fee')
    assert.equal(patchListQuery(query, { filters: { status: 'new' } }, OPPORTUNITIES_QUERY).page, 1)
    assert.equal(patchListQuery(query, { page: 5 }, OPPORTUNITIES_QUERY).page, 5)
  })

  it('the page size is five whatever the address says: there is no page-size box and no `per`', () => {
    assert.equal(DEFAULT_PER_PAGE, 5)
    assert.equal(listRequest(read('per=50')).perPage, 5)
    assert.equal(listQueryString(read('per=50'), OPPORTUNITIES_QUERY), '', '`per` is not kept in the address')
  })

  it('knows when a link asks the list a question, and ignores blanks', () => {
    assert.equal(asksTheList(new URLSearchParams('')), false)
    assert.equal(asksTheList(new URLSearchParams('q=Hillcrest')), true)
    assert.equal(asksTheList(new URLSearchParams('status=all')), true, 'status=all is present, even though it is the default')
    assert.equal(asksTheList(new URLSearchParams('freshness=older')), true)
    assert.equal(asksTheList(new URLSearchParams('fit=g2g')), true)
    assert.equal(asksTheList(new URLSearchParams('q=%20%20&status=')), false)
    assert.equal(asksTheList(new URLSearchParams('page=2&sort=priority&per=20&product=g2g')), false, 'paging and order ask nothing')
  })
})

describe('the request the address makes', () => {
  it('sends nothing for a view left on its defaults', () => {
    assert.deepEqual(listRequest(read('')), { search: undefined, reviewStatus: undefined, freshness: undefined, businessFit: undefined, sort: 'default', page: 1, perPage: 5 })
  })

  it('the deep link ?status=all&q=<title> carries the search and NO status', () => {
    const request = listRequest(read('status=all&q=Hillcrest%20is%20opening%20a%20new%20campus'))
    assert.equal(request.search, 'Hillcrest is opening a new campus')
    assert.equal(request.reviewStatus, undefined)
  })

  it('turns the address words into the server\'s words', () => {
    const request = listRequest(read('status=contacted&freshness=undated&fit=eb&sort=recent&page=3'))
    assert.deepEqual(request, { search: undefined, reviewStatus: 'Follow-up', freshness: 'undated', businessFit: 'eb', sort: 'recent', page: 3, perPage: 5 })
    assert.equal(listRequest(read('status=new')).reviewStatus, 'New')
    assert.equal(listRequest(read('status=reviewed')).reviewStatus, 'Reviewed')
    assert.equal(listRequest(read('status=dismissed')).reviewStatus, 'Dismissed')
  })

  it('cuts a search the server would refuse (more than 100 characters) instead of failing with a 422', () => {
    const long = 'x'.repeat(SEARCH_MAX + 40)
    assert.equal(listRequest(read(`q=${long}`)).search, 'x'.repeat(SEARCH_MAX))
    assert.equal(listRequest(read(`q=${'y'.repeat(SEARCH_MAX)}`)).search?.length, SEARCH_MAX, 'a search of exactly 100 is left whole')
  })

  it('reviewStatusOf answers only for the five words, never for a name every object has', () => {
    assert.equal(reviewStatusOf('all'), null)
    assert.equal(reviewStatusOf(undefined), null)
    assert.equal(reviewStatusOf('constructor'), null)
    assert.equal(reviewStatusOf('__proto__'), null)
    assert.equal(reviewStatusOf('contacted'), 'Follow-up')
  })
})

describe('which product the screen is about', () => {
  const scope = (over: Partial<Parameters<typeof resolveProductScope>[0]> = {}) => resolveProductScope({ product: '', asksTheList: false, remembered: null, products: PRODUCTS, ...over })

  it('a link that only searches opens on All products, without waiting for the products', () => {
    assert.deepEqual(scope({ asksTheList: true, products: null }), { kind: 'all' })
    assert.deepEqual(scope({ asksTheList: true }), { kind: 'all' })
  })

  it('an explicit "all" is All products', () => {
    assert.deepEqual(scope({ product: 'all', products: null }), { kind: 'all' })
    assert.deepEqual(scope({ product: 'all', asksTheList: false }), { kind: 'all' })
  })

  it('with no parameters at all the screen starts as it always did: the remembered product, else the first ready one', () => {
    assert.deepEqual(scope({ remembered: 'g2g' }), { kind: 'product', choice: 'g2g' })
    assert.deepEqual(scope({ remembered: 'scholarclone::SCH-11' }), { kind: 'product', choice: 'scholarclone::SCH-11' })
    assert.deepEqual(scope({}), { kind: 'product', choice: 'scholarclone' })
    assert.deepEqual(scope({ remembered: 'gone_product' }), { kind: 'product', choice: 'scholarclone' })
    assert.deepEqual(scope({ products: [{ key: 'g2g', ready: false }, { key: 'enterprise_brain', ready: true }] }), { kind: 'product', choice: 'enterprise_brain' })
    assert.equal(scope({ products: null }), null, 'it waits for the products')
  })

  it('a product key selects that product, and a sub-product choice selects it only while it exists', () => {
    assert.deepEqual(scope({ product: 'g2g' }), { kind: 'product', choice: 'g2g' })
    assert.deepEqual(scope({ product: 'enterprise_brain', asksTheList: true }), { kind: 'product', choice: 'enterprise_brain' }, 'a named product wins over the search rule')
    assert.deepEqual(scope({ product: 'scholarclone::SCH-11' }), { kind: 'product', choice: 'scholarclone::SCH-11' })
    assert.deepEqual(scope({ product: 'scholarclone::GONE-1' }), { kind: 'product', choice: 'scholarclone' })
  })

  it('a number is a Product Master record (the Signal Review\'s meaning), unless a product really has that key', () => {
    assert.deepEqual(scope({ product: '4' }), { kind: 'master', id: 4 })
    assert.deepEqual(scope({ product: '4', asksTheList: true }), { kind: 'master', id: 4 })
    assert.deepEqual(scope({ product: '4', products: [...PRODUCTS, { key: '4', ready: true }] }), { kind: 'product', choice: '4' })
    assert.equal(scope({ product: '4', products: null }), null)
    assert.deepEqual(scope({ product: '0' }), { kind: 'product', choice: 'scholarclone' }, 'zero is no record')
  })

  it('a product the screen does not know falls back to its usual start', () => {
    assert.deepEqual(scope({ product: 'nonsense' }), { kind: 'product', choice: 'scholarclone' })
  })

  it('writes back the address a choice should have', () => {
    assert.equal(productParam({ kind: 'all' }), 'all')
    assert.equal(productParam({ kind: 'product', choice: 'scholarclone::SCH-11' }), 'scholarclone::SCH-11')
    assert.equal(productParam({ kind: 'master', id: 7 }), '7')
  })
})

describe('what an empty list means', () => {
  it('the product is a scope, not a filter: a screen with no product named is not "narrowed"', () => {
    assert.equal(isNarrowedHere(read('')), false)
    assert.equal(isNarrowedHere(read('product=g2g')), false)
    assert.equal(isNarrowedHere(read('q=fee')), true)
    assert.equal(isNarrowedHere(read('freshness=older')), true)
    assert.equal(isNarrowedHere(read('fit=g2g')), true)
    assert.equal(isNarrowedHere(read('status=dismissed')), true, 'this screen opens on All, so a chosen status narrows it')
  })

  it('an organisation with no signals at all is "empty"; a search or a facet that matches nothing is "filtered-empty"', () => {
    const state = (search: string, summaryTotal: number) => opportunityListState({ loaded: true, error: '', rows: 0, summaryTotal, query: read(search) })
    assert.equal(state('', 0), 'empty')
    assert.equal(state('product=g2g', 0), 'empty', 'naming a product does not make "nothing yet" a filter result')
    assert.equal(state('q=zzz', 0), 'filtered-empty')
    assert.equal(state('', 12), 'filtered-empty', 'rows exist for the product but none on this page or status')
    assert.equal(opportunityListState({ loaded: true, error: '', rows: 3, summaryTotal: 3, query: read('') }), 'ready')
    assert.equal(opportunityListState({ loaded: false, error: '', rows: 0, summaryTotal: 0, query: read('') }), 'loading')
    assert.equal(opportunityListState({ loaded: true, error: 'down', rows: 0, summaryTotal: 0, query: read('') }), 'error')
  })

  it('"Clear filters" clears the search and the facets and keeps the product', () => {
    const cleared = patchListQuery(read('product=g2g&q=fee&status=new&freshness=older&fit=eb&page=3'), clearOpportunityFiltersPatch(), OPPORTUNITIES_QUERY)
    assert.equal(cleared.q, '')
    assert.deepEqual(cleared.filters, { product: 'g2g', status: 'all', freshness: 'all', fit: 'all' })
    assert.equal(cleared.page, 1)
    assert.equal(listQueryString(cleared, OPPORTUNITIES_QUERY), 'product=g2g')
  })
})
