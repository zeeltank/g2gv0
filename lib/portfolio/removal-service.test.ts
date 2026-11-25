import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { productRecordService } from '../../services/product-master/record-service'

/**
 * The REAL requests the delete and move calls send (S15 follow-up, contract 4.1 to 4.3 and the picker parameters of 4.4). The screen tests replace this service with a
 * fake, which cannot see an address, a method, a body or a header: a misspelt `subProductIds` or a dropped bearer header would leave every screen test green while
 * the server ignored the request. No request leaves the process: `fetch` is replaced for each test, and a signed-in person is faked in `window`.
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

function fakeFetch(reply: (call: Call) => Response = () => new Response(JSON.stringify({ status: 1, data: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } })) {
  calls = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const call = { url: new URL(String(input), 'http://localhost'), init }
    calls.push(call)
    return reply(call)
  }) as typeof fetch
  restore.push(() => { globalThis.fetch = original })
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const path = (call: Call) => call.url.pathname.replace(/^.*\/api/, '')
const header = (call: Call, name: string): string | undefined => (call.init?.headers as Record<string, string> | undefined)?.[name]
const body = (call: Call) => JSON.parse(String(call.init?.body))

describe('the delete preview', () => {
  beforeEach(() => { signedIn('tok-9'); fakeFetch() })

  it('asks GET /product-master/{id}/removal with the record\'s id and nothing else', async () => {
    await productRecordService.removalPreview(12)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].init?.method, 'GET', 'a read: it changes nothing')
    assert.equal(path(calls[0]), '/product-master/12/removal')
    assert.equal(calls[0].url.search, '', 'the organisation and the person come from the token')
    assert.equal(calls[0].init?.body, undefined)
  })

  it('hands back what the server said: what blocks it, the Sub-products and the Products they may move to', async () => {
    fakeFetch(() => json(200, { status: 1, data: { id: 12, kind: 'product', name: 'ScholarClone', canDelete: false, blockedBy: [{ code: 'sold_on_documents', count: 3, message: '3 quotes or orders hold it.' }], subProducts: [{ id: 31, name: 'Fee module', kind: 'sub_product', canDelete: true, blockedBy: [] }], targets: [{ id: 7, name: 'Enterprise Brain' }] } }))
    const answer = await productRecordService.removalPreview(12)
    assert.equal(answer.data.canDelete, false)
    assert.equal(answer.data.blockedBy[0].message, '3 quotes or orders hold it.')
    assert.equal(answer.data.subProducts[0].name, 'Fee module')
    assert.deepEqual(answer.data.targets, [{ id: 7, name: 'Enterprise Brain' }])
  })

  it('turns a 404 (another organisation\'s id, or none) into an ApiError that carries the status', async () => {
    fakeFetch(() => json(404, { status: 0, message: 'Product not found.' }))
    await assert.rejects(() => productRecordService.removalPreview(999), (error: { status?: number; message?: string }) => error.status === 404 && error.message === 'Product not found.')
  })
})

describe('the delete', () => {
  beforeEach(() => { signedIn('tok-9'); fakeFetch() })

  it('posts to /product-master/{id}/remove with an empty JSON body for a Sub-product', async () => {
    await productRecordService.remove(31)
    assert.equal(calls[0].init?.method, 'POST')
    assert.equal(path(calls[0]), '/product-master/31/remove')
    assert.deepEqual(body(calls[0]), {}, 'an empty body, not no body')
  })

  it('sends the ask-each-time answer under the names the server reads: subProducts and toProductId', async () => {
    await productRecordService.remove(12, { subProducts: 'move', toProductId: 7 })
    await productRecordService.remove(12, { subProducts: 'delete' })
    assert.deepEqual(body(calls[0]), { subProducts: 'move', toProductId: 7 })
    assert.deepEqual(body(calls[1]), { subProducts: 'delete' })
    for (const call of calls) assert.equal(path(call), '/product-master/12/remove')
  })

  it('turns a 409 blocked, a 422 and a 403 into an ApiError that carries the status and the server\'s sentence', async () => {
    for (const [status, message] of [[409, 'It is held.'], [422, 'Choose what happens to its sub-products.'], [403, 'You may not delete this.']] as const) {
      fakeFetch(() => json(status, { status: 0, code: 'blocked', message, data: { blockedBy: [] } }))
      await assert.rejects(() => productRecordService.remove(12), (error: { status?: number; message?: string }) => error.status === status && error.message === message)
    }
  })
})

describe('the move', () => {
  beforeEach(() => { signedIn('tok-9'); fakeFetch() })

  it('posts to /product-master/move with subProductIds and toProductId, as numbers', async () => {
    await productRecordService.move({ subProductIds: [31, 32], toProductId: 7 })
    assert.equal(calls[0].init?.method, 'POST')
    assert.equal(path(calls[0]), '/product-master/move')
    assert.deepEqual(body(calls[0]), { subProductIds: [31, 32], toProductId: 7 })
    assert.equal(typeof body(calls[0]).toProductId, 'number')
  })

  it('hands back what moved and what was already there', async () => {
    fakeFetch(() => json(200, { status: 1, data: { moved: [31], unchanged: [32], toProductId: 7 } }))
    const answer = await productRecordService.move({ subProductIds: [31, 32], toProductId: 7 })
    assert.deepEqual(answer.data, { moved: [31], unchanged: [32], toProductId: 7 })
  })

  it('turns a 422 invalid_target into an ApiError that carries the status', async () => {
    fakeFetch(() => json(422, { status: 0, code: 'invalid_target', message: 'Choose an active Product of this organisation.' }))
    await assert.rejects(() => productRecordService.move({ subProductIds: [31], toProductId: 99 }), (error: { status?: number }) => error.status === 422)
  })
})

describe('the bundle part picker\'s scope', () => {
  beforeEach(() => { signedIn('tok-9'); fakeFetch() })

  it('sends no scope by default (the answer is what it always was) and scope=all only when asked', async () => {
    await productRecordService.pickerParts('fee', 15)
    await productRecordService.pickerParts('fee', 15, 'sold')
    await productRecordService.pickerParts('fee', 15, 'all')
    assert.equal(calls[0].url.searchParams.has('scope'), false, 'no scope: unchanged for every caller that does not ask')
    assert.equal(calls[1].url.searchParams.has('scope'), false, '"sold" is the default and is never written')
    assert.equal(calls[2].url.searchParams.get('scope'), 'all')
    assert.equal(calls[2].url.searchParams.get('type'), 'product')
    assert.equal(calls[2].url.searchParams.get('q'), 'fee')
  })
})

describe('every one of them sends the signed-in person\'s token as a bearer header and never in the address', () => {
  it('carries Authorization on the preview, the delete and the move', async () => {
    signedIn('tok-9')
    fakeFetch()
    await productRecordService.removalPreview(1)
    await productRecordService.remove(1)
    await productRecordService.move({ subProductIds: [2], toProductId: 3 })
    assert.equal(calls.length, 3)
    for (const call of calls) {
      assert.equal(header(call, 'Authorization'), 'Bearer tok-9', `${path(call)} carries the bearer header`)
      assert.equal(call.url.searchParams.has('token'), false)
      assert.equal(header(call, 'Accept'), 'application/json')
    }
  })

  it('sends no Authorization header at all without a session, and never the word undefined', async () => {
    signedIn(null)
    fakeFetch()
    await productRecordService.removalPreview(1)
    const headers = (calls[0].init?.headers ?? {}) as Record<string, string>
    assert.equal(Object.keys(headers).some((name) => name.toLowerCase() === 'authorization'), false)
  })
})
