import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { opportunitiesService } from '../../services/signals/opportunities'

/**
 * The real request the Company Opportunities list sends. The screen tests replace this service with a fake, so without this file a misspelt parameter name
 * (`freshnes`, `reviewstatus`...) would leave every screen test green while the server silently ignored the filter. Found by a mutation of the caller's own
 * on 13 Nov 2026 (S15 P1-A verification). No request leaves the process: `fetch` is replaced for each test.
 */
const CONTEXT = { organizationId: 1, subInstituteId: 1, userId: 2 } as never

const restore: Array<() => void> = []
afterEach(() => { for (const fn of restore.splice(0)) fn() })

/** Replaces fetch for one test, records the address it is asked for, and answers with an empty list. */
function fakeFetch() {
  const urls: string[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (url: unknown) => {
    urls.push(String(url))
    return new Response(JSON.stringify({ status: 1, data: [], meta: { page: 1, per_page: 5, total: 0, last_page: 1 }, summary: {}, filters: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
  restore.push(() => { globalThis.fetch = original })
  return urls
}

const paramsOf = (url: string) => new URL(url, 'http://localhost').searchParams

describe('the opportunities list request', () => {
  it('sends the Signal Review filters under the names the server reads', async () => {
    const urls = fakeFetch()
    await opportunitiesService.list(CONTEXT, {
      search: 'district office', reviewStatus: 'Follow-up', freshness: 'last_30_days', businessFit: 'scholar', productMasterId: 7, sort: 'recent', page: 2, perPage: 20,
    })
    assert.equal(urls.length, 1)
    assert.match(urls[0], /\/signals\/opportunities\?/)
    const p = paramsOf(urls[0])
    assert.equal(p.get('search'), 'district office')
    assert.equal(p.get('review_status'), 'Follow-up')
    assert.equal(p.get('freshness'), 'last_30_days')
    assert.equal(p.get('business_fit'), 'scholar')
    assert.equal(p.get('product_master_id'), '7')
    assert.equal(p.get('sort'), 'recent')
    assert.equal(p.get('page'), '2')
    assert.equal(p.get('per_page'), '20')
  })

  it('sends nothing for a facet left on All, and the screen\'s usual page and size', async () => {
    const urls = fakeFetch()
    await opportunitiesService.list(CONTEXT, { product: 'all', sort: 'default' })
    const p = paramsOf(urls[0])
    for (const name of ['search', 'review_status', 'freshness', 'business_fit', 'product_master_id', 'product', 'sort']) {
      assert.equal(p.has(name), false, `${name} is not sent when nothing was chosen`)
    }
    assert.equal(p.get('page'), '1')
    assert.equal(p.get('per_page'), '5')
  })

  it('sends one product by its key, and an undated filter as chosen', async () => {
    const urls = fakeFetch()
    await opportunitiesService.list(CONTEXT, { product: 'scholarclone', freshness: 'undated' })
    const p = paramsOf(urls[0])
    assert.equal(p.get('product'), 'scholarclone')
    assert.equal(p.get('freshness'), 'undated')
    assert.equal(p.has('product_master_id'), false)
  })
})
