import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { listQueryString, patchListQuery, readListQuery } from '../../components/shared/scaffolds/list-query'
import {
  clearFiltersPatch, DEFAULT_PER_PAGE, effectiveSort, isNarrowed, listRequest, perPageOf, PORTFOLIO_QUERY, productChoices, productIdOf, readinessChoices, SEARCH_MAX,
} from './query'

const read = (search: string) => readListQuery(new URLSearchParams(search), PORTFOLIO_QUERY)

describe('the Product Portfolio address', () => {
  it('opens on the active records by name, 20 to a page, and a clean address', () => {
    const q = read('')
    assert.equal(q.q, '')
    assert.equal(q.sort, 'name')
    assert.equal(q.dir, 'asc')
    assert.equal(q.page, 1)
    assert.deepEqual(q.filters, { product: '', type: 'all', sold: 'all', readiness: '', status: 'active', per: '20', view: 'list' })
    assert.equal(listQueryString(q, PORTFOLIO_QUERY), '', 'the default view has no query string')
    assert.equal(perPageOf(q), DEFAULT_PER_PAGE)
  })

  it('reads the Services entry of the sidebar: /portfolio?type=service', () => {
    assert.equal(read('type=service').filters.type, 'service')
    assert.equal(listRequest(read('type=service')).type, 'service')
  })

  it('writes every choice back to the address and drops what is the default', () => {
    const q = read('type=subproduct&sold=paused&readiness=In%20development&status=archived&product=7&per=50&page=3&sort=signals&dir=desc&q=erp&view=matches')
    assert.equal(q.page, 3)
    assert.equal(q.sort, 'signals')
    assert.equal(q.dir, 'desc')
    const back = new URLSearchParams(listQueryString(q, PORTFOLIO_QUERY))
    for (const [name, value] of Object.entries({ type: 'subproduct', sold: 'paused', readiness: 'In development', status: 'archived', product: '7', per: '50', page: '3', sort: 'signals', dir: 'desc', q: 'erp', view: 'matches' })) {
      assert.equal(back.get(name), value, `${name} survives a round trip through the address`)
    }
  })

  it('falls back to the default for a value the screen does not know (a link cannot send the server nonsense)', () => {
    const q = read('type=hardware&sold=maybe&status=deleted&per=999&sort=cost&view=other&page=-2')
    assert.deepEqual(q.filters, { product: '', type: 'all', sold: 'all', readiness: '', status: 'active', per: '20', view: 'list' })
    assert.equal(q.sort, 'name')
    assert.equal(q.page, 1)
  })

  it('goes back to page 1 when a choice changes, and keeps the page when only the page changes', () => {
    const on3 = read('page=3')
    assert.equal(patchListQuery(on3, { filters: { type: 'service' } }, PORTFOLIO_QUERY).page, 1)
    assert.equal(patchListQuery(on3, { page: 4 }, PORTFOLIO_QUERY).page, 4)
  })
})

describe('what the address asks the server (every choice reaches the request)', () => {
  it('sends nothing for a choice left on "All", and the active status, the order and the page size always', () => {
    assert.deepEqual(listRequest(read('')), { q: undefined, productId: undefined, type: undefined, sold: undefined, readiness: undefined, status: 'active', sort: 'name', dir: 'asc', page: 1, per: 20 })
  })

  it('sends the search, the Product, the type, the sold state, the readiness, the status, the order, the page and the page size', () => {
    const request = listRequest(read('q=fees&product=7&type=service&sold=no&readiness=Prototype&status=all&sort=readiness&dir=desc&page=2&per=100'))
    assert.deepEqual(request, { q: 'fees', productId: 7, type: 'service', sold: 'no', readiness: 'Prototype', status: 'all', sort: 'readiness', dir: 'desc', page: 2, per: 100 })
  })

  it('names the Product by its number only; anything else names none', () => {
    assert.equal(productIdOf(read('product=7')), 7)
    for (const bad of ['product=abc', 'product=0', 'product=-3', 'product=7.5', 'product=1e3']) assert.equal(productIdOf(read(bad)), undefined, bad)
  })

  it('cuts a long search to what the server accepts', () => {
    const request = listRequest(read(`q=${'x'.repeat(250)}`))
    assert.equal(request.q?.length, SEARCH_MAX)
  })

  it('asks for the price order only as a person who may see prices (the server answers Name to anybody else, and so does the heading)', () => {
    assert.equal(effectiveSort(read('sort=price'), true), 'price')
    assert.equal(effectiveSort(read('sort=price'), false), 'name')
    assert.equal(effectiveSort(read('sort=signals'), false), 'signals')
    assert.equal(listRequest(read('sort=price')).sort, 'price')
  })
})

describe('which view counts as narrowed, and how it is cleared', () => {
  it('counts a search and every choice, an archived or "all" status included', () => {
    assert.equal(isNarrowed(read('')), false)
    for (const search of ['q=x', 'product=3', 'type=service', 'sold=yes', 'readiness=Deferred', 'status=archived', 'status=all']) assert.equal(isNarrowed(read(search)), true, search)
  })

  it('does not count the order, the page size or the page', () => {
    assert.equal(isNarrowed(read('sort=signals&dir=desc&per=50&page=2')), false)
  })

  it('clears the search and every choice but keeps the order and the page size', () => {
    const cleared = patchListQuery(read('q=x&product=3&type=service&sold=yes&readiness=Deferred&status=archived&per=50&sort=signals&dir=desc'), clearFiltersPatch(), PORTFOLIO_QUERY)
    assert.equal(isNarrowed(cleared), false)
    assert.equal(cleared.filters.per, '50')
    assert.equal(cleared.sort, 'signals')
  })
})

describe('the choices of the Product and Readiness filters', () => {
  it('lists "All products" first and keeps a Product the address names even when the list has not got it', () => {
    const lines = [{ id: 1, name: 'ScholarClone' }, { id: 2, name: 'G2G' }]
    assert.deepEqual(productChoices(lines, '').map((c) => c.label), ['All products', 'ScholarClone', 'G2G'])
    assert.deepEqual(productChoices(lines, '9').at(-1), { value: '9', label: 'Product #9' })
    assert.equal(productChoices(lines, '2').length, 3, 'a Product that is in the list is not added twice')
  })

  it('lists "Any readiness" first and keeps a word the address names', () => {
    assert.deepEqual(readinessChoices(['Prototype', 'Deferred'], '').map((c) => c.value), ['', 'Prototype', 'Deferred'])
    assert.deepEqual(readinessChoices(['Prototype'], 'Gone').at(-1), { value: 'Gone', label: 'Gone' })
  })
})
