import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { opportunitiesService } from '../../services/signals/opportunities'
import { refusalFrom, RunRefusalError } from '../../services/signals/run-refusal'

/**
 * The REAL request that starts a research run from Company Opportunities, and the refusals it turns into. The screen tests replace this service with a fake,
 * which cannot see the address, the headers or the body it builds, or what it does with a refusal: the shared client keeps only a refusal's message, and
 * its code, its list of what is missing and how long to wait are what the screen needs to explain it. No request leaves the process: `fetch` is replaced.
 */
const CONTEXT = { token: 'tok-1', subInstituteId: '6', syear: '', userId: '1', organizationId: '', orgType: '', profileId: '1' } as never

interface Call { url: URL; init?: RequestInit }
const restore: Array<() => void> = []
afterEach(() => { for (const fn of restore.splice(0)) fn() })

function fakeFetch(reply: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => { const call = { url: new URL(String(input), 'http://localhost'), init }; calls.push(call); return reply(call) }) as typeof fetch
  restore.push(() => { globalThis.fetch = original })
  return calls
}
const json = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
const start = () => opportunitiesService.runResearch(CONTEXT, undefined, 'g2g', [{ country: 'India', state: 'Gujarat' }], 'G-11', 'b2g')

describe('starting a run: the request', () => {
  it('posts JSON to the run endpoint with the organisation and token in the address, the token as a header, and the product, places, sub-product and model in the body', async () => {
    const calls = fakeFetch(() => json(202, { status: 1, message: 'Research started.', data: { run_id: 90, run: { id: 90 } } }))
    const answer = await start()

    assert.equal(calls.length, 1)
    assert.equal(calls[0].init?.method, 'POST')
    assert.match(calls[0].url.pathname, /\/signals\/research\/run$/)
    assert.equal(calls[0].url.searchParams.get('sub_institute_id'), '6')
    assert.equal(calls[0].url.searchParams.get('token'), 'tok-1', 'the address is what it always was')
    const headers = calls[0].init?.headers as Record<string, string>
    assert.equal(headers['Content-Type'], 'application/json')
    assert.equal(headers.Accept, 'application/json')
    assert.equal(JSON.parse(String(calls[0].init?.body)).product, 'g2g')
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      product: 'g2g', regions: [{ country: 'India', state: 'Gujarat' }], offer_id: 'G-11', customer_model: 'b2g', icp_type: 'b2g',
    })
    assert.equal(answer.message, 'Research started.')
    assert.equal(answer.data?.run_id, 90)
  })

  it('sends the signed-in person\'s token as a bearer header, as the shared client does (found by a mutation of the caller\'s own on 13 Nov: the header was never asserted)', async () => {
    const g = globalThis as { window?: unknown }
    const original = g.window
    g.window = { localStorage: { getItem: () => JSON.stringify({ token: 'tok-1' }) }, sessionStorage: { getItem: () => null } }
    restore.push(() => { if (original === undefined) delete g.window; else g.window = original })
    const calls = fakeFetch(() => json(202, { status: 1, message: 'Research started.', data: { run_id: 90, run: { id: 90 } } }))
    await start()
    const headers = calls[0].init?.headers as Record<string, string>
    assert.equal(headers.Authorization, 'Bearer tok-1', 'the run is started as the person who pressed Generate')
  })

  it('sends no Authorization header at all when nobody is signed in, and never the word undefined', async () => {
    const calls = fakeFetch(() => json(202, { status: 1, message: 'Research started.', data: { run_id: 90, run: { id: 90 } } }))
    await start()
    const headers = calls[0].init?.headers as Record<string, string>
    assert.equal(Object.keys(headers).some((name) => name.toLowerCase() === 'authorization'), false, 'no Authorization header without a session')
  })

  it('sends only what was chosen: no places, no sub-product, no model', async () => {
    const calls = fakeFetch(() => json(202, { status: 1, message: 'ok', data: { run_id: 1, run: {} } }))
    await opportunitiesService.runResearch(CONTEXT, undefined, 'enterprise_brain')
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { product: 'enterprise_brain' })
  })
})

describe('starting a run: the refusals keep what the screen needs', () => {
  const refusedWith = async (reply: () => Response) => {
    fakeFetch(reply)
    try { await start() } catch (error) { return error }
    return assert.fail('the start was not refused')
  }

  it('keeps how long to wait after a cool-down (429), from the body or from the Retry-After header', async () => {
    const fromBody = await refusedWith(() => json(429, { status: 0, code: 'cooldown', message: 'Research ran a moment ago.', retry_after_seconds: 540 }))
    assert.ok(fromBody instanceof RunRefusalError, 'fromBody instanceof RunRefusalError')
    assert.deepEqual([fromBody.status, fromBody.code, fromBody.retryAfterSeconds, fromBody.message], [429, 'cooldown', 540, 'Research ran a moment ago.'])

    const fromHeader = await refusedWith(() => json(429, { status: 0, code: 'cooldown' }, { 'Retry-After': '75' }))
    assert.ok(fromHeader instanceof RunRefusalError, 'fromHeader instanceof RunRefusalError')
    assert.equal(fromHeader.retryAfterSeconds, 75)
  })

  it('a cool-down that names no wait anywhere keeps no wait time, not zero', async () => {
    const error = await refusedWith(() => json(429, { status: 0, code: 'cooldown', message: 'Research ran a moment ago.' }))
    assert.ok(error instanceof RunRefusalError, 'error instanceof RunRefusalError')
    assert.equal(error.retryAfterSeconds, null, 'neither the body nor a header named a wait')
    // The reader on its own: no header, a blank one, and one that is not a number are all "no wait", never 0.
    assert.equal(refusalFrom(429, {}, null).retryAfterSeconds, null)
    assert.equal(refusalFrom(429, {}, '  ').retryAfterSeconds, null, 'a blank header is no wait')
    assert.equal(refusalFrom(429, {}, 'soon').retryAfterSeconds, null, 'a header that is not a number is no wait')
    assert.equal(refusalFrom(429, {}, '75').retryAfterSeconds, 75, 'and a number is kept')
  })

  it('keeps the code and the list of what is missing of a 422', async () => {
    const error = await refusedWith(() => json(422, { status: 0, code: 'product_not_configured', message: 'G2G (B2B ICP) is not ready for discovery.', missing: ['Ideal customer', '', 7, 'At least one search'] }))
    assert.ok(error instanceof RunRefusalError, 'error instanceof RunRefusalError')
    assert.deepEqual([error.status, error.code, error.missing], [422, 'product_not_configured', ['Ideal customer', 'At least one search']])
  })

  it('keeps a 409 apart: it is "already running"', async () => {
    const error = await refusedWith(() => json(409, { status: 0, code: 'already_running', message: 'Research is already running.' }))
    assert.ok(error instanceof RunRefusalError && error.status === 409 && error.code === 'already_running', 'error instanceof RunRefusalError && error.status === 409 && error.code === \'already_running\'')
  })

  it('still refuses with a status when the body is not JSON', async () => {
    const error = await refusedWith(() => new Response('<html>Bad gateway</html>', { status: 502 }))
    assert.ok(error instanceof RunRefusalError, 'error instanceof RunRefusalError')
    assert.deepEqual([error.status, error.code, error.message], [502, null, 'The run could not be started (502).'])
  })

  it('lets a lost connection through as it is, so the screen can tell it from a refusal', async () => {
    fakeFetch(() => { throw new TypeError('fetch failed') })
    await assert.rejects(start(), TypeError)
  })

  it('says it cannot read an "ok" answer that is not JSON, instead of calling it a lost connection', async () => {
    fakeFetch(() => new Response('<html>ok</html>', { status: 200 }))
    await assert.rejects(start(), (error: unknown) => error instanceof Error && !(error instanceof TypeError) && /cannot read/.test(error.message))
  })
})
