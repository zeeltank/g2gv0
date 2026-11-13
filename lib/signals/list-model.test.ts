import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { patchListQuery, readListQuery, writeListQuery } from '../../components/shared/scaffolds/list-query'
import {
  applyStatusChange, clearFiltersPatch, fitChoices, fitLabel, fitSummary, isNarrowed, listScreenState, productChoices, queryToParams, rangeText,
  SIGNAL_LIST_QUERY, summaryTiles,
} from './list-model'
import { signalRow } from './signal-fixtures'

const read = (search = '') => readListQuery(new URLSearchParams(search), SIGNAL_LIST_QUERY)
const write = (query: ReturnType<typeof read>) => writeListQuery(new URLSearchParams(), query, SIGNAL_LIST_QUERY).toString()

describe('the default view', () => {
  it('opens on signals that need a decision, newest evidence first, with a clean address', () => {
    const query = read()
    assert.equal(query.sort, 'recent')
    assert.deepEqual(query.filters, { product: 'all', status: 'new', freshness: 'all', fit: 'all' })
    assert.equal(write(query), '')
  })

  it('asks the server for no freshness limit, so a signal with no date is never filtered out by default', () => {
    const params = queryToParams(read())
    assert.deepEqual(params, { page: 1, per_page: 20, sort: 'recent', review_status: 'New' })
    assert.ok(!('freshness' in params))
  })

  it('does not narrow the list by itself, so it can tell "no signals yet" from "nothing matches"', () => {
    assert.equal(isNarrowed(read()), false)
    assert.equal(isNarrowed(read('q=school')), true)
    assert.equal(isNarrowed(read('product=4')), true)
    assert.equal(isNarrowed(read('status=dismissed')), false, 'Status has a default of its own and is not a narrowing facet')
  })
})

describe('filters in the address', () => {
  it('reads back exactly what was written, for every facet at once', () => {
    const start = read()
    const next = patchListQuery(start, { q: 'tender', sort: 'priority', filters: { product: '4', status: 'contacted', freshness: 'last_30_days', fit: 'g2g' } }, SIGNAL_LIST_QUERY)
    const url = write(next)
    assert.deepEqual(read(url), { ...next, page: 1 })
    for (const part of ['q=tender', 'sort=priority', 'product=4', 'status=contacted', 'freshness=last_30_days', 'fit=g2g']) assert.ok(url.includes(part), part)
  })

  it('keeps "All" for status in the address, because the default is "needs decision"', () => {
    const url = write(patchListQuery(read(), { filters: { status: 'all' } }, SIGNAL_LIST_QUERY))
    assert.equal(url, 'status=all')
    assert.equal(read(url).filters.status, 'all')
  })

  it('goes back to page 1 when a filter changes', () => {
    const onPage3 = read('page=3')
    assert.equal(patchListQuery(onPage3, { filters: { fit: 'eb' } }, SIGNAL_LIST_QUERY).page, 1)
  })

  it('falls back to the default for a status, freshness or sort the screen does not know', () => {
    const query = read('status=bogus&freshness=yesterday&sort=nonsense')
    assert.equal(query.filters.status, 'new')
    assert.equal(query.filters.freshness, 'all')
    assert.equal(query.sort, 'recent')
  })
})

describe('the request for a view', () => {
  it('names the product by its Product Master id, only when the address holds a whole number', () => {
    assert.equal(queryToParams(read('product=7')).product_master_id, 7)
    assert.ok(!('product_master_id' in queryToParams(read('product=abc'))))
    assert.ok(!('product_master_id' in queryToParams(read('product=0'))))
    assert.ok(!('product_master_id' in queryToParams(read('product=4x'))))
  })

  it('turns the address word "contacted" into the stored status "Follow-up"', () => {
    assert.equal(queryToParams(read('status=contacted')).review_status, 'Follow-up')
    assert.equal(queryToParams(read('status=reviewed')).review_status, 'Reviewed')
    assert.equal(queryToParams(read('status=dismissed')).review_status, 'Dismissed')
    assert.ok(!('review_status' in queryToParams(read('status=all'))))
  })

  it('sends the freshness, the fit, the search and the sort that were chosen', () => {
    const params = queryToParams(read('freshness=undated&fit=eb&q=fee&sort=priority&page=2'))
    assert.deepEqual(params, { page: 2, per_page: 20, sort: 'priority', review_status: 'New', freshness: 'undated', business_fit: 'eb', search: 'fee' })
  })
})

describe('which of the five states the list is in', () => {
  const base = { loaded: true, error: '', rows: 0, summaryTotal: 0, query: read() }

  it('is loading until the first answer, and an error beats everything', () => {
    assert.equal(listScreenState({ ...base, loaded: false }), 'loading')
    assert.equal(listScreenState({ ...base, loaded: false, error: 'x' }), 'error')
    assert.equal(listScreenState({ ...base, rows: 3, error: 'x' }), 'error')
  })

  it('is ready whenever there are rows', () => {
    assert.equal(listScreenState({ ...base, rows: 1, summaryTotal: 9 }), 'ready')
  })

  it('is "empty" only when the organisation has no signals at all', () => {
    assert.equal(listScreenState(base), 'empty')
  })

  it('is "filtered-empty" when signals exist but none match, so the filters can be cleared', () => {
    assert.equal(listScreenState({ ...base, summaryTotal: 40 }), 'filtered-empty')
    assert.equal(listScreenState({ ...base, query: read('q=zzz') }), 'filtered-empty')
    assert.equal(listScreenState({ ...base, summaryTotal: 40, query: read('freshness=older') }), 'filtered-empty')
  })
})

describe('clearing the filters', () => {
  it('shows everything: no search, every facet on All, and Status on All as well', () => {
    const narrowed = read('q=a&product=4&status=dismissed&freshness=older&fit=eb')
    const cleared = patchListQuery(narrowed, clearFiltersPatch(), SIGNAL_LIST_QUERY)
    assert.equal(cleared.q, '')
    assert.deepEqual(cleared.filters, { product: 'all', status: 'all', freshness: 'all', fit: 'all' })
    assert.equal(isNarrowed(cleared), false)
    assert.deepEqual(queryToParams(cleared), { page: 1, per_page: 20, sort: 'recent' })
  })
})

describe('facet choices', () => {
  const options = [
    { id: 4, key: 'scholar', name: 'Scholar', kind: 'product' as const, parentId: null, label: 'Scholar' },
    { id: 9, key: 'scholar/p2', name: 'Core', kind: 'sub_product' as const, parentId: 4, label: 'Scholar › Core' },
  ]

  it('lists All products and every Product Master record by its id', () => {
    assert.deepEqual(productChoices(options, 'all'), [{ value: 'all', label: 'All products' }, { value: '4', label: 'Scholar' }, { value: '9', label: 'Scholar › Core' }])
  })

  it('keeps a product that is in the address but not in the list, so the box never shows the wrong one', () => {
    assert.deepEqual(productChoices([], '12'), [{ value: 'all', label: 'All products' }, { value: '12', label: 'Product #12' }])
  })

  it('names a fit by the product when the server said which, and by a plain word otherwise', () => {
    const products = [{ value: 'scholar', label: 'Scholar', business_fit: 'scholar' }]
    assert.equal(fitLabel('scholar', products), 'Scholar')
    assert.equal(fitLabel('multiple', products), 'Several products')
    assert.equal(fitLabel('eb', products), 'EB')
    assert.equal(fitLabel('custom', products), 'Custom')
    assert.deepEqual(fitChoices(['eb', 'scholar'], products, 'all').map((c) => c.label), ['Any fit', 'EB', 'Scholar'])
    assert.deepEqual(fitChoices(undefined, undefined, 'g2g').map((c) => c.value), ['all', 'g2g'])
  })

  it('writes the fit and the score together, and says nothing when neither is known', () => {
    assert.equal(fitSummary(signalRow(), [{ value: 's', label: 'Scholar', business_fit: 'scholar' }]), 'Scholar · Score 24')
    assert.equal(fitSummary(signalRow({ business_fit: null }), []), 'Score 24')
    assert.equal(fitSummary(signalRow({ business_fit: null, scores: null }), []), null)
  })
})

describe('the counts above the list', () => {
  it('shows what the server counted, with "decided so far" as everything no longer waiting', () => {
    assert.deepEqual(summaryTiles({ total: 73, new: 68, high_priority: 12, follow_up: 5 }).map((t) => [t.label, t.value]), [
      ['signals in total', 73], ['need a decision', 68], ['decided so far', 5], ['high priority', 12],
    ])
  })

  it('moves a signal between counts when its status changes, without going below zero', () => {
    const summary = { total: 10, new: 4, high_priority: 3, follow_up: 1 }
    assert.deepEqual(applyStatusChange(summary, { priority: 'Low' }, 'New', 'Follow-up'), { ...summary, new: 3, follow_up: 2 })
    assert.deepEqual(applyStatusChange(summary, { priority: 'Low' }, 'Follow-up', 'Dismissed'), { ...summary, follow_up: 0 })
    assert.deepEqual(applyStatusChange(summary, { priority: 'High' }, 'New', 'Dismissed'), { ...summary, new: 3, high_priority: 2 })
    assert.deepEqual(applyStatusChange(summary, { priority: 'High' }, 'Dismissed', 'New'), { ...summary, new: 5, high_priority: 4 })
    assert.equal(applyStatusChange(summary, { priority: 'High' }, 'New', 'New'), summary)
    assert.equal(applyStatusChange({ ...summary, new: 0 }, { priority: 'Low' }, 'New', 'Reviewed').new, 0)
  })

  it('says which rows of how many are on screen', () => {
    assert.equal(rangeText({ page: 2, per_page: 20, total: 73, last_page: 4 }, 20), 'Showing 21–40 of 73')
    assert.equal(rangeText({ page: 4, per_page: 20, total: 73, last_page: 4 }, 13), 'Showing 61–73 of 73')
    assert.equal(rangeText({ page: 1, per_page: 20, total: 0, last_page: 1 }, 0), null)
    assert.equal(rangeText(null, 3), null)
  })
})
