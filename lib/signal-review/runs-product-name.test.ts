import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseRun } from '@/services/signal-review/runs-service'

const BY_ID = new Map<number, string>([[7, 'ScholarClone']])
const BY_KEY = new Map<string, string>([['scholarclone', 'ScholarClone'], ['eb', 'Enterprise Brain']])

describe('a run\'s product name', () => {
  it('comes from the Product Master id when the run has one', () => {
    const run = parseRun({ id: 1, product_master_id: 7, product_key: 'something-else' }, BY_ID, BY_KEY)
    assert.equal(run.product_name, 'ScholarClone')
  })

  it('comes from the product key for a run made before runs recorded an id, ignoring case', () => {
    const run = parseRun({ id: 2, product_master_id: null, product_key: 'ScholarClone' }, BY_ID, BY_KEY)
    assert.equal(run.product_name, 'ScholarClone')
  })

  it('is null, so the raw key shows, when neither matches: nothing is guessed', () => {
    const run = parseRun({ id: 3, product_master_id: null, product_key: 'unknown_product' }, BY_ID, BY_KEY)
    assert.equal(run.product_name, null)
    assert.equal(run.product_key, 'unknown_product')
  })

  it('is null for a run with neither an id nor a key', () => {
    assert.equal(parseRun({ id: 4 }, BY_ID, BY_KEY).product_name, null)
  })

  it('does not name a run from an id that is no longer in the list', () => {
    assert.equal(parseRun({ id: 5, product_master_id: 99 }, BY_ID, BY_KEY).product_name, null)
  })
})
