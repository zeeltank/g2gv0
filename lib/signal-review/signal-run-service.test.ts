import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { parseRunSnapshot, refusalFrom, RunRefusalError, signalRunService } from '../../services/signal-review/signal-run-service'

interface Call { url: string; init?: RequestInit }

/** Replaces fetch for one test and records what was asked of it. No request leaves the process. */
function fakeFetch(reply: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => { const call = { url: String(url), init }; calls.push(call); return reply(call) }) as typeof fetch
  restore.push(() => { globalThis.fetch = original })
  return calls
}
const restore: Array<() => void> = []
afterEach(() => { for (const fn of restore.splice(0)) fn() })

const json = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

const RUN_ROW = { id: 90, status: 'running', stage: 'queued', stage_message: 'Queued.', queries_run: 0, sources_found: 0, opportunities_qualified: 0, opportunities_new: 0, error_message: null }

describe('starting a run', () => {
  it('posts the product, the customer model and the sub-product as JSON to the run endpoint, and returns the run', async () => {
    const calls = fakeFetch(() => json(202, { status: 1, message: 'Research started.', data: { run_id: 90, run: RUN_ROW } }))
    const started = await signalRunService.start({ product: 'scholar', customer_model: 'b2g', offer_id: 'SCH-11' })

    assert.match(calls[0].url, /\/signals\/research\/run$/)
    assert.equal(calls[0].init?.method, 'POST')
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { product: 'scholar', customer_model: 'b2g', offer_id: 'SCH-11' })
    assert.equal((calls[0].init?.headers as Record<string, string>)['Content-Type'], 'application/json')
    assert.equal(started.runId, 90)
    assert.equal(started.run?.stage_message, 'Queued.')
  })

  it('keeps the code and the missing list of a 422 refusal', async () => {
    fakeFetch(() => json(422, { status: 0, code: 'product_not_configured', message: 'Scholar (B2B ICP) is not ready for discovery.', missing: ['Ideal customer'] }))
    await assert.rejects(signalRunService.start({ product: 'scholar', customer_model: 'b2b' }), (error: unknown) => {
      assert.ok(error instanceof RunRefusalError)
      assert.deepEqual([error.status, error.code, error.missing, error.message], [422, 'product_not_configured', ['Ideal customer'], 'Scholar (B2B ICP) is not ready for discovery.'])
      return true
    })
  })

  it('keeps a 409 apart: it is "already running", not a failure of the request', async () => {
    fakeFetch(() => json(409, { status: 0, code: 'already_running', message: 'Research is already running.' }))
    await assert.rejects(signalRunService.start({ product: 'scholar', customer_model: 'b2b' }), (error: unknown) => error instanceof RunRefusalError && error.status === 409 && error.code === 'already_running')
  })

  it('keeps how long to wait after a 429, from the body or from the Retry-After header', async () => {
    fakeFetch(() => json(429, { status: 0, code: 'cooldown', message: 'Research ran a moment ago.', retry_after_seconds: 540 }, { 'Retry-After': '540' }))
    await assert.rejects(signalRunService.start({ product: 'scholar', customer_model: 'b2b' }), (error: unknown) => error instanceof RunRefusalError && error.retryAfterSeconds === 540)
    assert.equal(refusalFrom(429, {}, '75').retryAfterSeconds, 75)
    assert.equal(refusalFrom(429, {}, null).retryAfterSeconds, null)
  })

  it('still refuses with a status when the body is not JSON', async () => {
    fakeFetch(() => new Response('<html>Bad gateway</html>', { status: 502 }))
    await assert.rejects(signalRunService.start({ product: 'scholar', customer_model: 'b2b' }), (error: unknown) => error instanceof RunRefusalError && error.status === 502)
  })

  it('lets a network failure through as it is, so the screen can tell it from a refusal', async () => {
    fakeFetch(() => { throw new TypeError('fetch failed') })
    await assert.rejects(signalRunService.start({ product: 'scholar', customer_model: 'b2b' }), TypeError)
  })

  it('does not call a run started when the server did not say which one', async () => {
    fakeFetch(() => json(202, { status: 1, data: {} }))
    await assert.rejects(signalRunService.start({ product: 'scholar', customer_model: 'b2b' }), /did not say which one/)
  })
})

describe('following a run', () => {
  it('asks for the run by its number and reads the figures it needs', async () => {
    const calls = fakeFetch(() => json(200, { status: 1, data: { ...RUN_ROW, status: 'success', queries_run: 8, sources_found: 21, opportunities_qualified: 6, opportunities_new: 4 } }))
    const run = await signalRunService.get(90)
    assert.match(calls[0].url, /\/signals\/research\/runs\/90$/)
    assert.deepEqual(run, { id: 90, status: 'success', stage_message: 'Queued.', queries_run: 8, sources_found: 21, opportunities_qualified: 6, opportunities_new: 4, error_message: null })
  })

  it('finds the run that is going among the latest runs', async () => {
    fakeFetch(() => json(200, { status: 1, data: [{ ...RUN_ROW, id: 92, status: 'success' }, { ...RUN_ROW, id: 91 }, { ...RUN_ROW, id: 90 }] }))
    assert.equal((await signalRunService.findRunning())?.id, 91)
  })

  it('finds none when no run is going', async () => {
    fakeFetch(() => json(200, { status: 1, data: [{ ...RUN_ROW, id: 92, status: 'failed' }] }))
    assert.equal(await signalRunService.findRunning(), null)
  })

  it('refuses an answer it cannot read rather than guess', async () => {
    fakeFetch(() => json(200, { status: 1, data: { nothing: true } }))
    await assert.rejects(signalRunService.get(90), /cannot read/)
  })

  it('keeps a figure the server did not send as null, never zero', () => {
    const run = parseRunSnapshot({ id: 5, status: 'running', queries_run: '3', sources_found: undefined })
    assert.deepEqual([run?.queries_run, run?.sources_found, run?.opportunities_new, run?.stage_message], [null, null, null, null])
  })
})
