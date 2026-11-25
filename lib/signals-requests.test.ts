/**
 * The real request builders of the Signals service, with fetch stubbed: the product key goes out as the canonical key, the list is filtered by
 * the stored product (never by a title or keyword), and nothing is sent that the screen did not ask for. No network.
 */
import { strict as assert } from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { opportunitiesService } from '../services/signals/opportunities'
import type { LaravelContext } from './laravel-context'

const ctx = { token: 'tok', subInstituteId: '6', syear: '', userId: '1', organizationId: '', orgType: '', profileId: '1' } as LaravelContext

type Call = { url: URL; method: string; body: unknown }
let calls: Call[] = []
const realFetch = globalThis.fetch

beforeEach(() => {
  calls = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://localhost')
    let body: unknown = null
    try { body = init?.body ? JSON.parse(String(init.body)) : null } catch { body = String(init?.body) }
    calls.push({ url, method: (init?.method ?? 'GET').toUpperCase(), body })

    return new Response(JSON.stringify({ status: 1, data: [], meta: { total: 0 }, summary: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
})
afterEach(() => { globalThis.fetch = realFetch })

describe('Signals requests', () => {
  it('lists a product by its canonical key and sends no title or keyword filter', async () => {
    await opportunitiesService.list(ctx, { product: 'scholarclone', page: 1 })
    const q = calls[0].url.searchParams
    assert.equal(q.get('product'), 'scholarclone')
    for (const forbidden of ['search', 'business_fit', 'kind', 'category']) assert.equal(q.has(forbidden), false, forbidden)
  })

  it('sends no product filter for "all" or none (that is the listing of everything, not a run)', async () => {
    await opportunitiesService.list(ctx, { product: 'all' })
    await opportunitiesService.list(ctx, {})
    assert.equal(calls[0].url.searchParams.has('product'), false)
    assert.equal(calls[1].url.searchParams.has('product'), false)
  })

  it('sends the selectors as filters of the list with scope_filter, and nothing for a selector that is not set (S17)', async () => {
    await opportunitiesService.list(ctx, { product: 'all', scopeFilter: true, offerId: 'SCH-11', customerModel: 'b2g', regions: [{ country: 'India', state: 'Gujarat' }] })
    const q = calls[0].url.searchParams
    assert.equal(q.get('scope_filter'), '1')
    assert.equal(q.get('offer_id'), 'SCH-11')
    assert.equal(q.get('customer_model'), 'b2g')
    assert.equal(q.get('regions[0][country]'), 'India')
    assert.equal(q.get('regions[0][state]'), 'Gujarat')
    assert.equal(q.has('all_signals'), false)

    await opportunitiesService.list(ctx, { product: 'all', scopeFilter: true })
    const bare = calls[1].url.searchParams
    assert.equal(bare.get('scope_filter'), '1')
    for (const name of ['offer_id', 'customer_model', 'regions[0][country]', 'all_signals']) assert.equal(bare.has(name), false, name)

    await opportunitiesService.list(ctx, { product: 'all' })
    assert.equal(calls[2].url.searchParams.has('scope_filter'), false, 'without the flag the request is what it always was')
  })

  it('asks for the days across every scope with all_signals, and for one scope\'s days without it', async () => {
    await opportunitiesService.getRunDates(ctx, 'scholarclone', 'b2b', 'SCH-11', [], true)
    assert.equal(calls[0].url.searchParams.get('all_signals'), '1')
    await opportunitiesService.getRunDates(ctx, 'scholarclone', 'b2b', 'SCH-11', [], false)
    assert.equal(calls[1].url.searchParams.has('all_signals'), false)
  })

  it('starts a run with the selected product key in the body, on the research endpoint only', async () => {
    await opportunitiesService.runResearch(ctx, undefined, 'enterprise_brain')
    assert.equal(calls.length, 1)
    assert.equal(calls[0].method, 'POST')
    assert.match(calls[0].url.pathname, /\/signals\/research\/run$/)
    assert.deepEqual(calls[0].body, { product: 'enterprise_brain' })
  })

  it('asks for a product\'s readiness with that product key', async () => {
    await opportunitiesService.getStatus(ctx, 'g2g')
    assert.equal(calls[0].url.searchParams.get('product'), 'g2g')
    await opportunitiesService.getStatus(ctx, 'all')
    assert.equal(calls[1].url.searchParams.has('product'), false)
  })

  it('reads a past day by the run date, with the product, and never as a run', async () => {
    await opportunitiesService.list(ctx, { product: 'scholarclone', runDate: '2026-10-14', expired: 'include' })
    const q = calls[0].url.searchParams
    assert.equal(q.get('run_date'), '2026-10-14')
    assert.equal(q.get('product'), 'scholarclone')
    assert.equal(calls[0].method, 'GET')
    assert.equal(calls.some((c) => /research\/run$/.test(c.url.pathname)), false)
  })

  it('asks for the successful-run dates of one product (a read)', async () => {
    await opportunitiesService.getRunDates(ctx, 'enterprise_brain')
    assert.equal(calls[0].method, 'GET')
    assert.match(calls[0].url.pathname, /\/signals\/research\/dates$/)
    assert.equal(calls[0].url.searchParams.get('product'), 'enterprise_brain')
  })
})
