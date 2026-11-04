import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { ApiError } from '../../services/core'
import { FactsApiError } from '../../services/facts/errors'
import { factsService, queueQuery } from '../../services/facts/facts-service'
import { dismissedFact, fact } from './fixtures'

interface Call { url: string; init?: RequestInit }

/** Replaces fetch for one test and records what was asked of it. No request leaves the process. */
function fakeFetch(reply: () => Response | Promise<Response>) {
  const calls: Call[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => { calls.push({ url: String(url), init }); return reply() }) as typeof fetch
  restore.push(() => { globalThis.fetch = original })
  return calls
}
const restore: Array<() => void> = []
afterEach(() => { for (const fn of restore.splice(0)) fn() })

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('the queue query', () => {
  it('sends only what was chosen, as strings, and a 0 is a real answer', () => {
    assert.deepEqual(queueQuery({ type: 'contact', status: 'proposed', page: 2, per_page: 25 }), { type: 'contact', status: 'proposed', page: '2', per_page: '25' })
    assert.deepEqual(queueQuery({ type: undefined, status: undefined }), {})
    assert.deepEqual(queueQuery({ page: 0 }), { page: '0' })
  })
})

describe('reading', () => {
  it('asks for a record\'s facts, the queue and the consent at the paths the contract names', async () => {
    const calls = fakeFetch(() => json(200, { status: 1, data: {} }))
    await factsService.entity('contact', 31)
    await factsService.queue({ status: 'proposed', type: 'organization', page: 2, per_page: 25 })
    await factsService.consent('lead', 7)
    assert.match(calls[0].url, /\/facts\/entity\/contact\/31$/)
    assert.match(calls[1].url, /\/facts\/queue\?status=proposed&type=organization&page=2&per_page=25$/)
    assert.match(calls[2].url, /\/consent\/lead\/7$/)
    assert.equal(calls[0].init?.method, 'GET')
  })

  it('puts an id in the path as text, so it cannot add a segment or a query', async () => {
    const calls = fakeFetch(() => json(200, { status: 1, data: {} }))
    await factsService.entity('contact', '7/../9?x=1')
    await factsService.consent('organization', '1#frag')
    assert.match(calls[0].url, /\/facts\/entity\/contact\/7%2F\.\.%2F9%3Fx%3D1$/)
    assert.match(calls[1].url, /\/consent\/organization\/1%23frag$/)
  })

  it('answers a 403 and a 404 with an ApiError that carries the status', async () => {
    fakeFetch(() => json(403, { status: 0, message: 'Your role does not have access to this screen.' }))
    await assert.rejects(factsService.queue({}), (error: unknown) => { assert.ok(error instanceof ApiError); assert.equal(error.status, 403); return true })
    fakeFetch(() => json(404, { status: 0, message: 'Not found.' }))
    await assert.rejects(factsService.entity('contact', 9), (error: unknown) => { assert.ok(error instanceof ApiError); assert.equal(error.status, 404); return true })
  })
})

describe('writing', () => {
  it('accepts and dismisses at the fact\'s own paths with a POST and a JSON body', async () => {
    const calls = fakeFetch(() => json(200, { status: 1, data: { outcome: 'applied', fact: fact() } }))
    await factsService.accept(41)
    await factsService.dismiss(42)
    assert.match(calls[0].url, /\/facts\/41\/accept$/)
    assert.match(calls[1].url, /\/facts\/42\/dismiss$/)
    assert.equal(calls[0].init?.method, 'POST')
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {})
    assert.equal((calls[0].init?.headers as Record<string, string>)['Content-Type'], 'application/json')
    assert.equal((calls[0].init?.headers as Record<string, string>).Accept, 'application/json')
  })

  it('sends a dismissal\'s reason trimmed, and nothing when there is none or it is blank', async () => {
    const calls = fakeFetch(() => json(200, { status: 1, data: { outcome: 'dismissed', fact: dismissedFact() } }))
    await factsService.dismiss(1, '  Already knew this  ')
    await factsService.dismiss(1, '   ')
    await factsService.dismiss(1, '')
    await factsService.dismiss(1)
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { reason: 'Already knew this' })
    for (const call of calls.slice(1)) assert.deepEqual(JSON.parse(String(call.init?.body)), {})
  })

  it('keeps the fact a 409 not_pending carries, so the screen shows what became of it', async () => {
    const current = dismissedFact({ id: 3 })
    fakeFetch(() => json(409, { status: 0, code: 'not_pending', message: 'This suggestion was already decided.', data: { fact: current } }))
    await assert.rejects(factsService.accept(3), (error: unknown) => {
      assert.ok(error instanceof FactsApiError)
      assert.equal(error.status, 409)
      assert.equal(error.code, 'not_pending')
      assert.equal(error.fact?.status, 'dismissed')
      assert.equal(error.fact?.id, 3)
      assert.equal(error.message, 'This suggestion was already decided.')
      return true
    })
  })

  it('keeps the code of a 403 no_right and of a 409 entity_gone, with no fact', async () => {
    fakeFetch(() => json(403, { status: 0, code: 'no_right', message: 'You may not decide this.' }))
    await assert.rejects(factsService.accept(3), (error: unknown) => error instanceof FactsApiError && error.status === 403 && error.code === 'no_right' && error.fact === null)
    fakeFetch(() => json(409, { status: 0, code: 'entity_gone', message: 'The record was removed.' }))
    await assert.rejects(factsService.accept(3), (error: unknown) => error instanceof FactsApiError && error.code === 'entity_gone' && error.fact === null)
  })

  it('keeps the field-keyed errors of a 422', async () => {
    fakeFetch(() => json(422, { status: 0, message: 'A reason can have at most 500 characters.', errors: { reason: ['A reason can have at most 500 characters.'] } }))
    await assert.rejects(factsService.dismiss(3, 'x'), (error: unknown) => {
      assert.ok(error instanceof FactsApiError)
      assert.equal(error.status, 422)
      assert.deepEqual(error.errors, { reason: ['A reason can have at most 500 characters.'] })
      assert.equal(error.code, null)
      return true
    })
  })

  it('names the status when the refusal is not JSON', async () => {
    fakeFetch(() => new Response('<html>nope</html>', { status: 403, statusText: 'Forbidden' }))
    await assert.rejects(factsService.accept(7), (error: unknown) => error instanceof ApiError && error.status === 403 && /403/.test(error.message))
  })
})
