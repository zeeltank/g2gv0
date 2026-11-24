import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { productPickerService } from '../../services/product-master/picker-service'

/**
 * The REAL requests the shared product picker sends (slice 15, P3-C). The screen tests of the picker and of every consumer replace the network, so without
 * this file a misspelt parameter (`limt`, `qq`), a wrong address or a missing bearer header would leave them all green while the server ignored the search.
 * No request leaves the process: `fetch` is replaced for each test, and the signed-in person is a stand-in `window` that holds a token.
 */
interface Call { url: URL; init?: RequestInit }
const restore: Array<() => void> = []
afterEach(() => { for (const fn of restore.splice(0)) fn() })

function signIn(token: string | null) {
  const g = globalThis as { window?: unknown }
  const original = g.window
  g.window = { localStorage: { getItem: () => (token ? JSON.stringify({ token }) : null) }, sessionStorage: { getItem: () => null } }
  restore.push(() => { if (original === undefined) delete g.window; else g.window = original })
}

function fakeFetch(reply: (call: Call) => Response) {
  const calls: Call[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => { const call = { url: new URL(String(input), 'http://localhost'), init }; calls.push(call); return reply(call) }) as typeof fetch
  restore.push(() => { globalThis.fetch = original })
  return calls
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const headersOf = (call: Call) => (call.init?.headers ?? {}) as Record<string, string>

describe('the picker request', () => {
  beforeEach(() => signIn('tok-9'))

  it('asks GET /api/product-master/picker with the type, the text and the limit under the names the server reads', async () => {
    const calls = fakeFetch(() => json(200, { status: 1, data: [] }))
    await productPickerService.search({ type: 'service', q: 'nine', limit: 15 })
    assert.equal(calls.length, 1)
    assert.equal(calls[0].init?.method, 'GET')
    assert.match(calls[0].url.pathname, /\/product-master\/picker$/, 'the address')
    assert.equal(calls[0].url.searchParams.get('type'), 'service')
    assert.equal(calls[0].url.searchParams.get('q'), 'nine')
    assert.equal(calls[0].url.searchParams.get('limit'), '15')
  })

  it('sends the signed-in person\'s token as a bearer header and never in the address', async () => {
    const calls = fakeFetch(() => json(200, { status: 1, data: [] }))
    await productPickerService.search({ q: 'x' })
    assert.equal(headersOf(calls[0]).Authorization, 'Bearer tok-9', 'the search is made as the person who is typing')
    assert.equal(calls[0].url.searchParams.has('token'), false, 'the credential stays out of the address')
    assert.equal(headersOf(calls[0]).Accept, 'application/json')
  })

  it('sends nothing for a type or a text that was not given, trims the text, and keeps the limit between 1 and the server\'s 50', async () => {
    const calls = fakeFetch(() => json(200, { status: 1, data: [] }))
    await productPickerService.search({ q: '   ' })
    await productPickerService.search({ q: '  Nine  ', limit: 500 })
    await productPickerService.search({ limit: 0 })
    assert.equal(calls[0].url.searchParams.has('q'), false, 'blank text is not a search')
    assert.equal(calls[0].url.searchParams.has('type'), false, 'no type means every kind the person may view')
    assert.equal(calls[1].url.searchParams.get('q'), 'Nine')
    assert.equal(calls[1].url.searchParams.get('limit'), '50', 'never more than the server serves')
    assert.equal(calls[2].url.searchParams.has('limit'), false, 'a zero limit is no limit: the server\'s own 20')
  })

  it('hands back the rows as the server sent them, with the catalogue id the documents store', async () => {
    fakeFetch(() => json(200, { status: 1, data: [{ crmProductId: 10, masterId: 23, name: 'Scholar Nine', productName: 'ScholarClone', sku: 'SCH-09-SKU', unitPrice: 999, currency: 'INR', taxRateId: null, type: 'product' }] }))
    const answer = await productPickerService.search({ type: 'product' })
    assert.equal(answer.data[0].crmProductId, 10)
    assert.equal(answer.data[0].masterId, 23)
  })

  it('turns a 403 and a 422 into an ApiError that carries the status', async () => {
    fakeFetch(() => json(403, { status: 0, message: 'You do not have the right to view prices of this kind of product.' }))
    await assert.rejects(() => productPickerService.search({ type: 'product' }), (error: { status?: number }) => error.status === 403)
    fakeFetch(() => json(422, { status: 0, message: 'type must be product, subproduct or service.' }))
    await assert.rejects(() => productPickerService.search({ type: 'product' }), (error: { status?: number }) => error.status === 422)
  })
})

describe('the scope of the picker request (S15 follow-up, contract 4.4)', () => {
  beforeEach(() => signIn('tok-9'))

  it('sends scope=all only when asked for it, and never for the default: a caller that does not ask is byte for byte what it was', async () => {
    const calls = fakeFetch(() => json(200, { status: 1, data: [] }))
    await productPickerService.search({ q: 'x' })
    await productPickerService.search({ q: 'x', scope: 'sold' })
    await productPickerService.search({ q: 'x', scope: 'all', type: 'product', limit: 20 })
    assert.equal(calls[0].url.searchParams.has('scope'), false)
    assert.equal(calls[1].url.searchParams.has('scope'), false, '"sold" is the default and is not written into the request')
    assert.equal(calls[2].url.searchParams.get('scope'), 'all')
    assert.equal(calls[2].url.searchParams.get('type'), 'product', 'the other parameters are unchanged')
    assert.equal(calls[2].url.searchParams.get('limit'), '20')
    assert.equal(headersOf(calls[2]).Authorization, 'Bearer tok-9')
  })

  it('hands back the marks of a scope=all row (sold, state) and a null catalogue id for a Sub-product that is not sold', async () => {
    fakeFetch(() => json(200, { status: 1, data: [{ crmProductId: null, masterId: 30, name: 'Admissions Desk', productName: 'ScholarClone', sku: null, unitPrice: null, currency: null, taxRateId: null, type: 'product', sold: false, state: 'not_sold' }] }))
    const answer = await productPickerService.search({ scope: 'all' })
    assert.equal(answer.data[0].crmProductId, null)
    assert.equal(answer.data[0].sold, false)
    assert.equal(answer.data[0].state, 'not_sold')
  })
})

describe('the Products with their Sub-products (withSubProducts)', () => {
  beforeEach(() => signIn('tok-9'))

  it('asks GET /product-master/lines?withSubProducts=1 when asked, and the bare address (no query at all) when not', async () => {
    const calls = fakeFetch(() => json(200, { status: 1, data: [] }))
    await productPickerService.lines()
    await productPickerService.lines({})
    await productPickerService.lines({ withSubProducts: false })
    await productPickerService.lines({ withSubProducts: true })
    for (const call of calls) assert.match(call.url.pathname, /\/product-master\/lines$/)
    assert.equal(calls[0].url.search, '', 'the default request has no query')
    assert.equal(calls[1].url.search, '')
    assert.equal(calls[2].url.search, '')
    assert.equal(calls[3].url.searchParams.get('withSubProducts'), '1')
    assert.equal(headersOf(calls[3]).Authorization, 'Bearer tok-9')
  })

  it('hands back each Product followed by its Sub-products, with their kind and the Product above them', async () => {
    fakeFetch(() => json(200, { status: 1, data: [{ id: 1, key: 'scholarclone', name: 'ScholarClone', kind: 'product', parentName: null }, { id: 31, key: 'fee', name: 'Fee module', kind: 'sub_product', parentName: 'ScholarClone' }] }))
    const answer = await productPickerService.lines({ withSubProducts: true })
    assert.deepEqual(answer.data.map((r) => [r.kind, r.parentName]), [['product', null], ['sub_product', 'ScholarClone']])
  })
})

describe('the Product list and the read by name', () => {
  beforeEach(() => signIn('tok-9'))

  it('reads the Products (level 1) from /product-master/lines with the bearer header', async () => {
    const calls = fakeFetch(() => json(200, { status: 1, data: [{ id: 1, key: 'scholarclone', name: 'ScholarClone' }] }))
    const answer = await productPickerService.lines()
    assert.match(calls[0].url.pathname, /\/product-master\/lines$/)
    assert.equal(headersOf(calls[0]).Authorization, 'Bearer tok-9')
    assert.equal(answer.data[0].name, 'ScholarClone')
  })

  it('reads a catalogue id by name in two steps: by-crm for the master id, then the record', async () => {
    const calls = fakeFetch((call) => (call.url.pathname.endsWith('/by-crm/10')
      ? json(200, { status: 1, data: { id: 23, kind: 'sub_product' } })
      : json(200, { status: 1, data: { id: 23, name: 'Scholar Nine', parent: { id: 1, name: 'ScholarClone' }, sell: { state: 'paused' } } })))
    const found = await productPickerService.describe(10)
    assert.deepEqual(calls.map((c) => c.url.pathname.replace(/^.*\/product-master/, '')), ['/by-crm/10', '/23'])
    assert.deepEqual(found, { masterId: 23, name: 'Scholar Nine', productName: 'ScholarClone', state: 'paused' })
    for (const call of calls) assert.equal(headersOf(call).Authorization, 'Bearer tok-9')
  })

  it('reads a person who may not see Sell (no sell, no parent) as a name alone', async () => {
    fakeFetch(() => json(200, { status: 1, data: { id: 5, name: 'Scholar Five', parent: null, sell: null } }))
    assert.deepEqual(await productPickerService.describeMaster(5), { masterId: 5, name: 'Scholar Five', productName: null, state: null })
  })

  it('passes a 404 on by-crm up as an ApiError, and does not ask for the record', async () => {
    const calls = fakeFetch(() => json(404, { status: 0, message: 'Product not found.' }))
    await assert.rejects(() => productPickerService.describe(999), (error: { status?: number }) => error.status === 404)
    assert.equal(calls.length, 1, 'one request: there is no master id to read')
  })
})
