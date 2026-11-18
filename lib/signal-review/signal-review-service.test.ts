import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { ApiError } from '../../services/core'
import { isDecisionConflict } from '../../services/signal-review/decision-error'
import { listQuery, signalReviewService } from '../../services/signal-review/signal-review-service'
import { historyEntry } from './signal-fixtures'

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

describe('the list query', () => {
  it('sends only what was chosen, as strings', () => {
    assert.deepEqual(listQuery({ page: 2, per_page: 20, sort: 'recent', review_status: 'Follow-up', product_master_id: 7 }), { page: '2', per_page: '20', sort: 'recent', review_status: 'Follow-up', product_master_id: '7' })
    assert.deepEqual(listQuery({ search: '', freshness: undefined }), {})
  })
})

describe('reading', () => {
  it('asks for the list, one signal and its history at the paths the contract names', async () => {
    const calls = fakeFetch(() => json(200, { status: 1, data: [] }))
    await signalReviewService.list({ page: 1, review_status: 'New' })
    await signalReviewService.get(7)
    await signalReviewService.history(7)
    assert.match(calls[0].url, /\/signals\/opportunities\?page=1&review_status=New$/)
    assert.match(calls[1].url, /\/signals\/opportunities\/7$/)
    assert.match(calls[2].url, /\/signals\/opportunities\/7\/reviews$/)
  })
})

describe('deciding', () => {
  const body = { decision: 'dismissed', reason_code: 'stale', expected_status: 'New' } as const

  it('posts the decision as JSON to the decisions path and returns the answer', async () => {
    const calls = fakeFetch(() => json(200, { status: 1, data: { id: 7 }, review: historyEntry() }))
    const result = await signalReviewService.decide(7, body)
    assert.equal(result.review.id, 12)
    assert.match(calls[0].url, /\/signals\/opportunities\/7\/decisions$/)
    assert.equal(calls[0].init?.method, 'POST')
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), body)
    assert.equal((calls[0].init?.headers as Record<string, string>)['Content-Type'], 'application/json')
  })

  it('keeps the code and the other person\'s decision of a 409 "conflict"', async () => {
    const entry = historyEntry({ decided_by_name: 'Anil' })
    fakeFetch(() => json(409, { status: 0, code: 'conflict', message: 'Someone decided first.', current: entry }))
    await assert.rejects(signalReviewService.decide(7, body), (error: unknown) => {
      assert.ok(isDecisionConflict(error))
      assert.equal(error.body.code, 'conflict')
      assert.equal(error.body.current?.decided_by_name, 'Anil')
      assert.equal(error.status, 409)
      return true
    })
  })

  it('keeps a 409 "unchanged" apart from a conflict', async () => {
    fakeFetch(() => json(409, { status: 0, code: 'unchanged', message: 'Already so.', current: null }))
    await assert.rejects(signalReviewService.decide(7, body), (error: unknown) => isDecisionConflict(error) && error.body.code === 'unchanged')
  })

  it('answers a 422 with an ApiError whose errors are keyed by field', async () => {
    fakeFetch(() => json(422, { status: 0, message: 'Validation failed', errors: { reason_code: ['Choose a reason.'] } }))
    await assert.rejects(signalReviewService.decide(7, body), (error: unknown) => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.status, 422)
      assert.deepEqual(error.errors, { reason_code: ['Choose a reason.'] })
      return true
    })
  })

  it('answers a 403 and a 404 with an ApiError carrying the status', async () => {
    fakeFetch(() => json(403, { status: 0, message: 'Forbidden' }))
    await assert.rejects(signalReviewService.decide(7, body), (error: unknown) => error instanceof ApiError && error.status === 403 && error.message === 'Forbidden')
    fakeFetch(() => json(404, { status: 0, message: 'Opportunity not found' }))
    await assert.rejects(signalReviewService.decide(7, body), (error: unknown) => error instanceof ApiError && error.status === 404)
  })

  it('treats a 409 without a known code, and a body that is not JSON, as a plain ApiError', async () => {
    fakeFetch(() => json(409, { status: 0, message: 'A clash.' }))
    await assert.rejects(signalReviewService.decide(7, body), (error: unknown) => error instanceof ApiError && error.status === 409 && !isDecisionConflict(error))
    fakeFetch(() => new Response('<html>Bad gateway</html>', { status: 502, statusText: 'Bad Gateway' }))
    await assert.rejects(signalReviewService.decide(7, body), (error: unknown) => error instanceof ApiError && error.status === 502 && /502/.test(error.message))
  })

  it('lets a request that never reached the server fail as it is, so the screen can offer a retry', async () => {
    fakeFetch(() => { throw new TypeError('Failed to fetch') })
    await assert.rejects(signalReviewService.decide(7, body), TypeError)
  })
})
