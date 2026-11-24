import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { productRecordService } from '../../services/product-master/record-service'

/**
 * The REAL requests the Sub-product form and pages send. The screen tests replace this service with a fake, which cannot see an address, a parameter, a body
 * or a header: a misspelt `productId` or a dropped bearer header would leave every screen test green while the server ignored the request. No request leaves
 * the process: `fetch` is replaced for each test, and a signed-in person is faked in `window` so the shared client can read a token.
 */
interface Call { url: URL; init?: RequestInit }

const restore: Array<() => void> = []
let calls: Call[] = []
afterEach(() => { for (const fn of restore.splice(0)) fn() })

function signedIn(token: string | null) {
  const g = globalThis as { window?: unknown }
  const original = g.window
  g.window = { localStorage: { getItem: () => (token === null ? null : JSON.stringify({ token })) }, sessionStorage: { getItem: () => null } }
  restore.push(() => { if (original === undefined) delete g.window; else g.window = original })
}

function fakeFetch(body: unknown = { status: 1, data: {} }) {
  calls = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    calls.push({ url: new URL(String(input), 'http://localhost'), init })
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
  restore.push(() => { globalThis.fetch = original })
}

const header = (call: Call, name: string): string | undefined => {
  const headers = call.init?.headers as Record<string, string> | undefined
  return headers?.[name]
}

describe('the record service sends the real requests', () => {
  beforeEach(() => { signedIn('tok-9'); fakeFetch() })

  it('reads one record, its Sell section, its usage and its history by the master id', async () => {
    await productRecordService.get(11)
    await productRecordService.sell(11)
    await productRecordService.usage(11)
    await productRecordService.history(11, { page: 2, per: 25 })
    assert.deepEqual(calls.map((c) => c.url.pathname.replace(/^.*\/api/, '')), ['/product-master/11', '/product-master/11/sell', '/product-master/11/usage', '/product-master/11/history'])
    assert.equal(calls[3].url.searchParams.get('page'), '2')
    assert.equal(calls[3].url.searchParams.get('per'), '25')
    for (const c of calls) assert.equal(c.init?.method ?? 'GET', 'GET', 'a read')
  })

  it('looks a Sub-product up in the flat list by its Product, a search or a page, under the names the server reads', async () => {
    await productRecordService.list({ page: 3, per: 20, q: 'SCH-11', productId: 1, status: 'all' })
    const p = calls[0].url.searchParams
    assert.match(calls[0].url.pathname, /\/product-master\/list$/)
    assert.equal(p.get('page'), '3')
    assert.equal(p.get('per'), '20')
    assert.equal(p.get('q'), 'SCH-11')
    assert.equal(p.get('productId'), '1', 'the server reads productId')
    assert.equal(p.get('status'), 'all')
  })

  it('sends nothing for a list parameter that was not asked for', async () => {
    await productRecordService.list({ q: 'x' })
    const p = calls[0].url.searchParams
    for (const name of ['page', 'per', 'productId', 'status']) assert.equal(p.has(name), false, `${name} is not sent`)
  })

  it('asks the picker for products only, with the text typed and the limit', async () => {
    await productRecordService.pickerParts('fee', 15)
    const p = calls[0].url.searchParams
    assert.match(calls[0].url.pathname, /\/product-master\/picker$/)
    assert.equal(p.get('type'), 'product', 'a bundle holds products')
    assert.equal(p.get('q'), 'fee')
    assert.equal(p.get('limit'), '15')
  })

  it('saves with POST for a new record and PUT for an existing one, the body as JSON', async () => {
    await productRecordService.create({ kind: 'sub_product', name: 'Fee Desk' })
    await productRecordService.update(11, { about: { notes: 'x' } })
    assert.equal(calls[0].init?.method, 'POST')
    assert.match(calls[0].url.pathname, /\/product-master$/)
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { kind: 'sub_product', name: 'Fee Desk' })
    assert.equal(calls[1].init?.method, 'PUT')
    assert.match(calls[1].url.pathname, /\/product-master\/11$/)
    assert.deepEqual(JSON.parse(String(calls[1].init?.body)), { about: { notes: 'x' } })
  })

  it('archives and restores through the record\'s own routes', async () => {
    await productRecordService.archive(11)
    await productRecordService.restore(11)
    assert.match(calls[0].url.pathname, /\/product-master\/11\/archive$/)
    assert.match(calls[1].url.pathname, /\/product-master\/11\/restore$/)
    assert.equal(calls[0].init?.method, 'POST')
    assert.equal(calls[1].init?.method, 'POST')
  })

  it('sends the signed-in person\'s token as a bearer header on every one of them', async () => {
    await productRecordService.get(11)
    await productRecordService.usage(11)
    await productRecordService.history(11)
    await productRecordService.list({})
    await productRecordService.pickerParts('')
    await productRecordService.create({ kind: 'product', name: 'P', key: 'p_one' })
    await productRecordService.update(11, {})
    await productRecordService.archive(11)
    assert.equal(calls.length, 8)
    for (const c of calls) assert.equal(header(c, 'Authorization'), 'Bearer tok-9', `${c.url.pathname} carries the bearer header`)
  })
})

describe('the record service without a session', () => {
  it('sends no Authorization header at all, and never the word undefined', async () => {
    signedIn(null)
    fakeFetch()
    await productRecordService.get(11)
    const headers = (calls[0].init?.headers ?? {}) as Record<string, string>
    assert.equal(Object.keys(headers).some((n) => n.toLowerCase() === 'authorization'), false)
  })
})
