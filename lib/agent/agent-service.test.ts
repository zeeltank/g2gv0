import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { ApiError } from '../../services/core'
import { AgentApiError } from '../../services/agent/errors'
import { agentService, runsQuery } from '../../services/agent/agent-service'
import { proposal } from './fixtures'

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

describe('the runs query', () => {
  it('sends only what was chosen, as strings, and a 0 is a real answer', () => {
    assert.deepEqual(runsQuery({ status: 'failed', date_from: '2026-11-01', page: 2, per_page: 20 }), { status: 'failed', date_from: '2026-11-01', page: '2', per_page: '20' })
    assert.deepEqual(runsQuery({ status: undefined, date_to: '' }), {})
    assert.deepEqual(runsQuery({ page: 0 }), { page: '0' })
  })
})

describe('reading', () => {
  it('asks for the panel, the runs and one run at the paths the contract names', async () => {
    const calls = fakeFetch(() => json(200, { status: 1, data: {} }))
    await agentService.state(7)
    await agentService.runs({ status: 'completed', date_from: '2026-11-01', page: 2, per_page: 20 })
    await agentService.runDetail(12)
    assert.match(calls[0].url, /\/agent\/organisations\/7$/)
    assert.match(calls[1].url, /\/agent\/runs\?status=completed&date_from=2026-11-01&page=2&per_page=20$/)
    assert.match(calls[2].url, /\/agent\/runs\/12$/)
    assert.equal(calls[0].init?.method, 'GET')
  })

  it('puts an id in the path as text, so it cannot add a segment or a query', async () => {
    const calls = fakeFetch(() => json(200, { status: 1, data: {} }))
    await agentService.state('7/../9?x=1')
    assert.match(calls[0].url, /\/agent\/organisations\/7%2F\.\.%2F9%3Fx%3D1$/)
  })

  it('answers a 403 and a 404 with an ApiError that carries the status', async () => {
    fakeFetch(() => json(403, { status: 0, message: 'Your role does not have access to this screen.' }))
    await assert.rejects(agentService.state(7), (error: unknown) => { assert.ok(error instanceof ApiError); assert.equal(error.status, 403); return true })
    fakeFetch(() => json(404, { status: 0, message: 'Organisation not found.' }))
    await assert.rejects(agentService.runDetail(9), (error: unknown) => { assert.ok(error instanceof ApiError); assert.equal(error.status, 404); return true })
  })
})

describe('writing', () => {
  it('runs the agent with a POST and an empty JSON body at the organisation\'s run path', async () => {
    const calls = fakeFetch(() => json(201, { status: 1, data: {} }))
    await agentService.run(7)
    assert.match(calls[0].url, /\/agent\/organisations\/7\/run$/)
    assert.equal(calls[0].init?.method, 'POST')
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {})
    assert.equal((calls[0].init?.headers as Record<string, string>)['Content-Type'], 'application/json')
    assert.equal((calls[0].init?.headers as Record<string, string>).Accept, 'application/json')
  })

  it('accepts and dismisses at the proposal\'s own paths', async () => {
    const calls = fakeFetch(() => json(200, { status: 1, data: { outcome: 'applied', proposal: proposal() } }))
    await agentService.accept(41)
    await agentService.dismiss(42)
    assert.match(calls[0].url, /\/agent\/proposals\/41\/accept$/)
    assert.match(calls[1].url, /\/agent\/proposals\/42\/dismiss$/)
    assert.equal(calls[0].init?.method, 'POST')
  })

  it('sends a dismissal\'s reason trimmed, and nothing when there is none or it is blank', async () => {
    const calls = fakeFetch(() => json(200, { status: 1, data: { outcome: 'dismissed', proposal: proposal() } }))
    await agentService.dismiss(1, '  Already knew this  ')
    await agentService.dismiss(1, '   ')
    await agentService.dismiss(1, '')
    await agentService.dismiss(1)
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { reason: 'Already knew this' })
    for (const call of calls.slice(1)) assert.deepEqual(JSON.parse(String(call.init?.body)), {})
  })

  it('keeps the code of a refusal before a run (the day\'s cap, already running, switched off)', async () => {
    fakeFetch(() => json(429, { status: 0, code: 'daily_cap', message: 'The agent has already run 10 times today on this organisation. Try again tomorrow.' }))
    await assert.rejects(agentService.run(7), (error: unknown) => {
      assert.ok(error instanceof AgentApiError)
      assert.equal(error.status, 429)
      assert.equal(error.code, 'daily_cap')
      assert.equal(error.proposal, null)
      assert.equal(error.message, 'The agent has already run 10 times today on this organisation. Try again tomorrow.')
      return true
    })
  })

  it('keeps the proposal a 409 carries, so the screen shows what became of it', async () => {
    const failed = proposal({ status: 'failed', error: 'Both organisations already have a record from the same source, so they cannot be one.' })
    fakeFetch(() => json(409, { status: 0, code: 'could_not_apply', message: 'Both organisations already have a record from the same source, so they cannot be one.', data: { proposal: failed } }))
    await assert.rejects(agentService.accept(3), (error: unknown) => {
      assert.ok(error instanceof AgentApiError)
      assert.equal(error.code, 'could_not_apply')
      assert.equal(error.proposal?.status, 'failed')
      assert.equal(error.proposal?.id, failed.id)
      return true
    })
  })

  it('keeps the field-keyed errors of a 422', async () => {
    fakeFetch(() => json(422, { status: 0, message: 'A reason can have at most 500 characters.', errors: { reason: ['A reason can have at most 500 characters.'] } }))
    await assert.rejects(agentService.dismiss(3, 'x'), (error: unknown) => {
      assert.ok(error instanceof AgentApiError)
      assert.equal(error.status, 422)
      assert.deepEqual(error.errors, { reason: ['A reason can have at most 500 characters.'] })
      assert.equal(error.code, null)
      return true
    })
  })

  it('names the status when the refusal is not JSON', async () => {
    fakeFetch(() => new Response('<html>nope</html>', { status: 403, statusText: 'Forbidden' }))
    await assert.rejects(agentService.run(7), (error: unknown) => error instanceof ApiError && error.status === 403 && /403/.test(error.message))
  })
})

describe('finding a CRM organisation\'s identity', () => {
  it('asks the Organisation 360 API, which makes the identity when there is none, and returns only its id', async () => {
    const calls = fakeFetch(() => json(200, { status: 1, created: true, data: { identity: { id: 44, name: 'Hillcrest' }, signals: {} } }))
    const result = await agentService.resolve(135)
    assert.match(calls[0].url, /\/org-accounts\/for-crm\/135$/)
    assert.equal(calls[0].init?.method, 'POST')
    assert.deepEqual(result, { status: 1, data: { org_account_id: 44 } })
  })

  it('refuses an answer that has no identity id rather than guessing one', async () => {
    fakeFetch(() => json(200, { status: 1, data: { identity: {} } }))
    await assert.rejects(agentService.resolve(135), (error: unknown) => error instanceof AgentApiError && error.status === 502)
  })

  it('answers another organisation\'s or a missing CRM organisation with the 404 it got', async () => {
    fakeFetch(() => json(404, { status: 0, message: 'Organisation not found.' }))
    await assert.rejects(agentService.resolve(999), (error: unknown) => error instanceof ApiError && error.status === 404)
  })
})
