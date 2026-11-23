import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readListQuery, type ListQueryConfig } from '../../components/shared/scaffolds/list-query'
import {
  applyStatusChange, fitChoices, fitLabel, fitSummary, FRESHNESS_CHOICES, isNarrowed, listScreenState, productChoices, STATUS_CHOICES, summaryTiles,
} from './list-model'
import { signalRow } from './signal-fixtures'

/**
 * A list address of the shape the old Signal Review list had (Status opens on "needs decision"; every other facet on All). `isNarrowed` and `listScreenState` are
 * plain functions of a list query, and these tests need queries to hand them. The Review's own address, its request and their tests were removed on 13 Nov 2026
 * (P1-C) with that screen; the address and the request of Company Opportunities are proved in opportunity-query.test.ts.
 */
const CONFIG: ListQueryConfig = {
  sort: 'recent',
  sortKeys: ['recent', 'priority'],
  dir: 'desc',
  filters: {
    product: { default: 'all' },
    status: { default: 'new', allowed: STATUS_CHOICES.map((c) => c.value) },
    freshness: { default: 'all', allowed: FRESHNESS_CHOICES.map((c) => c.value) },
    fit: { default: 'all' },
  },
}

const read = (search = '') => readListQuery(new URLSearchParams(search), CONFIG)

describe('the default view', () => {
  it('does not narrow the list by itself, so it can tell "no signals yet" from "nothing matches"', () => {
    assert.equal(isNarrowed(read()), false)
    assert.equal(isNarrowed(read('q=school')), true)
    assert.equal(isNarrowed(read('product=4')), true)
    assert.equal(isNarrowed(read('status=dismissed')), false, 'Status has a default of its own and is not a narrowing facet')
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
})
