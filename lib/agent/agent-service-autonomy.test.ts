import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { ApiError } from '../../services/core'
import { AgentApiError } from '../../services/agent/errors'
import { agentService, runsQuery } from '../../services/agent/agent-service'
import { autonomyAction, autonomyState, proposalsPage } from './fixtures'

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
const body = (call: Call) => JSON.parse(String(call.init?.body))

describe('the waiting queue and the autonomy settings: reading', () => {
  it('asks for the queue and the settings at the paths the contract names, with only what was chosen', async () => {
    const calls = fakeFetch(() => json(200, { status: 1, data: {} }))
    await agentService.proposals({ status: 'pending', page: 2, per_page: 25 })
    await agentService.proposals({})
    await agentService.autonomy()
    assert.match(calls[0].url, /\/agent\/proposals\?status=pending&page=2&per_page=25$/)
    assert.match(calls[1].url, /\/agent\/proposals\??$/, 'no filter at all: the shared client may leave a bare ? behind, which the server ignores')
    assert.match(calls[2].url, /\/agent\/autonomy$/)
    for (const call of calls) assert.equal(call.init?.method, 'GET')
  })

  it('shares the history list\'s query rule: a missing or blank value is left out and a 0 is a real answer', () => {
    assert.deepEqual(runsQuery({ status: 'pending', page: 1, per_page: undefined }), { status: 'pending', page: '1' })
    assert.deepEqual(runsQuery({ page: 0 }), { page: '0' })
  })

  it('hands back what the server answered, unchanged', async () => {
    fakeFetch(() => json(200, autonomyState()))
    const state = await agentService.autonomy() as unknown as ReturnType<typeof autonomyState>
    assert.deepEqual(state, autonomyState())
    fakeFetch(() => json(200, proposalsPage()))
    assert.deepEqual(await agentService.proposals({ status: 'pending' }), proposalsPage())
  })

  it('answers a missing route with an ApiError that carries the 404, which is how a screen knows the server does not have it yet', async () => {
    fakeFetch(() => json(404, { message: 'The route api/agent/autonomy could not be found.' }))
    await assert.rejects(agentService.autonomy(), (error: unknown) => { assert.ok(error instanceof ApiError); assert.equal(error.status, 404); return true })
    await assert.rejects(agentService.proposals({ status: 'pending' }), (error: unknown) => { assert.ok(error instanceof ApiError); assert.equal(error.status, 404); return true })
  })

  it('answers a 403 with an ApiError that carries the status', async () => {
    fakeFetch(() => json(403, { status: 0, message: 'Your role does not have access to this screen.' }))
    await assert.rejects(agentService.autonomy(), (error: unknown) => { assert.ok(error instanceof ApiError); assert.equal(error.status, 403); return true })
  })
})

describe('the autonomy settings: writing', () => {
  it('sets one action\'s level with a PUT at that action\'s own path, with the level and nothing else when there is no reason', async () => {
    const calls = fakeFetch(() => json(200, { status: 1, data: autonomyAction('add_note', { level: 'approval' }) }))
    const answer = await agentService.setAutonomy('add_note', 'approval')
    assert.match(calls[0].url, /\/agent\/autonomy\/add_note$/)
    assert.equal(calls[0].init?.method, 'PUT')
    assert.deepEqual(body(calls[0]), { level: 'approval' })
    assert.equal((calls[0].init?.headers as Record<string, string>)['Content-Type'], 'application/json')
    assert.equal((calls[0].init?.headers as Record<string, string>).Accept, 'application/json')
    assert.equal(answer.data.level, 'approval')
  })

  it('sends the reason trimmed, and nothing when it is blank', async () => {
    const calls = fakeFetch(() => json(200, { status: 1, data: autonomyAction('add_note') }))
    await agentService.setAutonomy('add_note', 'off', '  People dismiss every note  ')
    await agentService.setAutonomy('add_note', 'off', '   ')
    await agentService.setAutonomy('add_note', 'off', '')
    assert.deepEqual(body(calls[0]), { level: 'off', reason: 'People dismiss every note' })
    assert.deepEqual(body(calls[1]), { level: 'off' })
    assert.deepEqual(body(calls[2]), { level: 'off' })
  })

  it('puts the action key in the path as text, so it cannot add a segment, a query or a fragment', async () => {
    const calls = fakeFetch(() => json(200, { status: 1, data: {} }))
    await agentService.setAutonomy('add_note/../x?level=alone#', 'off')
    assert.match(calls[0].url, /\/agent\/autonomy\/add_note%2F\.\.%2Fx%3Flevel%3Dalone%23$/)
  })

  it('switches the organisation\'s agent off and on with a PUT at the kill switch path', async () => {
    const calls = fakeFetch(() => json(200, { status: 1, data: { kill_switch: { on: true, scope: 'organisation' } } }))
    const answer = await agentService.setKillSwitch(true, '  Wrong notes everywhere ')
    await agentService.setKillSwitch(false)
    assert.match(calls[0].url, /\/agent\/autonomy-kill-switch$/)
    assert.equal(calls[0].init?.method, 'PUT')
    assert.deepEqual(body(calls[0]), { on: true, reason: 'Wrong notes everywhere' })
    assert.deepEqual(body(calls[1]), { on: false }, 'false is sent as false, not left out')
    assert.deepEqual(answer.data.kill_switch, { on: true, scope: 'organisation' })
  })

  it('keeps the code of every refusal: not an administrator, not an action, not a level', async () => {
    fakeFetch(() => json(403, { status: 0, code: 'administrators_only', message: 'Only an administrator can change how much the agent may do on its own.' }))
    await assert.rejects(agentService.setAutonomy('add_note', 'off'), (error: unknown) => {
      assert.ok(error instanceof AgentApiError)
      assert.equal(error.status, 403)
      assert.equal(error.code, 'administrators_only')
      assert.equal(error.proposal, null)
      return true
    })
    fakeFetch(() => json(404, { status: 0, code: 'unknown_action', message: 'There is no such action.' }))
    await assert.rejects(agentService.setAutonomy('send_email', 'alone'), (error: unknown) => error instanceof AgentApiError && error.status === 404 && error.code === 'unknown_action')
    fakeFetch(() => json(422, { status: 0, code: 'unknown_level', message: 'That is not a level an action can be set to.' }))
    await assert.rejects(agentService.setAutonomy('add_note', 'turbo'), (error: unknown) => error instanceof AgentApiError && error.status === 422 && error.code === 'unknown_level')
    fakeFetch(() => json(403, { status: 0, code: 'administrators_only', message: 'Only an administrator can change how much the agent may do on its own.' }))
    await assert.rejects(agentService.setKillSwitch(true), (error: unknown) => error instanceof AgentApiError && error.code === 'administrators_only')
  })

  it('tells a route that is not there (a 404 with no code) from an action that is not there (a 404 with a code)', async () => {
    fakeFetch(() => json(404, { message: 'The route api/agent/autonomy/add_note could not be found.' }))
    await assert.rejects(agentService.setAutonomy('add_note', 'off'), (error: unknown) => error instanceof AgentApiError && error.status === 404 && error.code === null)
  })

  it('keeps the field-keyed errors of a 422 (a reason that is too long)', async () => {
    fakeFetch(() => json(422, { status: 0, message: 'A reason can have at most 300 characters.', errors: { reason: ['A reason can have at most 300 characters.'] } }))
    await assert.rejects(agentService.setAutonomy('add_note', 'off', 'x'), (error: unknown) => {
      assert.ok(error instanceof AgentApiError)
      assert.deepEqual(error.errors, { reason: ['A reason can have at most 300 characters.'] })
      return true
    })
  })

  it('names the status when the refusal is not JSON', async () => {
    fakeFetch(() => new Response('<html>nope</html>', { status: 502, statusText: 'Bad Gateway' }))
    await assert.rejects(agentService.setKillSwitch(true), (error: unknown) => error instanceof ApiError && error.status === 502 && /502/.test(error.message))
  })

  it('keeps the old POST writes as POSTs (the generalised sender did not change them)', async () => {
    const calls = fakeFetch(() => json(200, { status: 1, data: { outcome: 'applied', proposal: {} } }))
    await agentService.accept(5)
    await agentService.dismiss(5, 'x')
    assert.deepEqual(calls.map((c) => c.init?.method), ['POST', 'POST'])
  })
})
