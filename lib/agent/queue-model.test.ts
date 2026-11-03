import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ApiError } from '../../services/core'
import { AgentApiError } from '../../services/agent/errors'
import {
  agentOffQueueText, AGENT_OFF_PLATFORM_QUEUE_TEXT, AGENT_OFF_QUEUE_TEXT, AGENT_OFF_UNKNOWN_QUEUE_TEXT, COUNT_PARAMS, decisionFailureText, lastPage, NO_DECIDE_TEXT, organisationLine, QUEUE_PER_PAGE, queueParams, rangeText,
  readFailure, waitingTotalText,
} from './queue-model'
import { NETWORK_TEXT } from './model'

describe('what the queue asks for', () => {
  it('asks for the proposals nobody has decided, 25 to a page, and for the count with one row', () => {
    assert.deepEqual(queueParams(1), { status: 'pending', page: 1, per_page: 25 })
    assert.deepEqual(queueParams(3), { status: 'pending', page: 3, per_page: 25 })
    assert.equal(QUEUE_PER_PAGE, 25)
    assert.deepEqual(COUNT_PARAMS, { status: 'pending', page: 1, per_page: 1 })
  })

  it('counts pages and says which rows are on screen', () => {
    assert.equal(lastPage({ per_page: 25, total: 61 }), 3)
    assert.equal(lastPage({ per_page: 25, total: 50 }), 2)
    assert.equal(lastPage({ per_page: 25, total: 0 }), 1)
    assert.equal(lastPage(null), 1)
    assert.equal(lastPage({ per_page: 0, total: 10 }), 1)
    assert.equal(rangeText({ page: 2, per_page: 25, total: 61 }, 25), 'Showing 26–50 of 61')
    assert.equal(rangeText({ page: 3, per_page: 25, total: 61 }, 11), 'Showing 51–61 of 61')
    assert.equal(rangeText({ page: 1, per_page: 25, total: 0 }, 0), null)
    assert.equal(rangeText(null, 3), null)
  })

  it('says how many are waiting in words', () => {
    assert.equal(waitingTotalText(0), 'Nothing is waiting')
    assert.equal(waitingTotalText(1), '1 waiting for you')
    assert.equal(waitingTotalText(14), '14 waiting for you')
  })
})

describe('how a failed read is said', () => {
  it('says a 404 is a server that does not have it yet, and that the other tabs keep working', () => {
    const failure = readFailure(new ApiError('The route api/agent/proposals could not be found.', 404), 'waiting list', 'x')
    assert.equal(failure.kind, 'unavailable')
    assert.equal(failure.message, 'This server does not have the waiting list yet. The other tabs keep working.')
    assert.equal(readFailure(new ApiError('nope', 404), 'autonomy settings', 'x').message, 'This server does not have the autonomy settings yet. The other tabs keep working.')
  })

  it('says a 403 is no access, with nothing to retry', () => {
    assert.deepEqual(readFailure(new ApiError('no', 403), 'waiting list', 'x'), { kind: 'forbidden', message: 'You do not have access to the agent.' })
  })

  it('says anything else is an error to retry, in the server\'s words when it gave some and in plain ones when the request never arrived', () => {
    assert.deepEqual(readFailure(new ApiError('The server is busy.', 503), 'waiting list', 'x'), { kind: 'error', message: 'The server is busy.' })
    assert.deepEqual(readFailure(new TypeError('Failed to fetch'), 'waiting list', 'x'), { kind: 'error', message: NETWORK_TEXT })
    assert.deepEqual(readFailure(new Error(''), 'waiting list', 'The list could not be read.'), { kind: 'error', message: 'The list could not be read.' })
  })
})

describe('the organisation a proposal is about', () => {
  it('links an organisation that has a page, by a path inside this application', () => {
    const line = organisationLine({ id: 7, name: 'Hillcrest Academy', href_hint: '/module/crm/marketing/organizations/135', removed: false })
    assert.deepEqual(line, { kind: 'link', name: 'Hillcrest Academy', href: '/module/crm/marketing/organizations/135', note: null })
  })

  it('shows an organisation that has no CRM record yet as a name, never as a link', () => {
    assert.deepEqual(organisationLine({ id: 7, name: 'Hillcrest Academy', href_hint: null, removed: false }), { kind: 'text', name: 'Hillcrest Academy', href: null, note: null })
  })

  it('never makes a link from an address that is not a plain path inside the application', () => {
    for (const bad of ['https://evil.example/x', '//evil.example/x', 'javascript:alert(1)', '/ok path', '\\\\evil', '']) {
      const line = organisationLine({ id: 7, name: 'Hillcrest', href_hint: bad, removed: false })
      assert.equal(line.href, null, bad)
      assert.equal(line.kind, 'text', bad)
    }
  })

  it('says an organisation that was removed is removed, keeps its name, offers no link, and says the proposal can still be dismissed', () => {
    const line = organisationLine({ id: 7, name: 'Old Name School', href_hint: '/module/crm/marketing/organizations/1', removed: true })
    assert.equal(line.kind, 'removed')
    assert.equal(line.name, 'Old Name School')
    assert.equal(line.href, null, 'a removed organisation has no page to open, whatever the server sent')
    assert.match(line.note!, /removed or merged/)
    assert.match(line.note!, /still dismiss/)
  })

  it('says an organisation that can no longer be found at all cannot be found, and the proposal can still be dismissed', () => {
    const line = organisationLine({ id: 7, name: null, href_hint: null, removed: true })
    assert.equal(line.kind, 'gone')
    assert.equal(line.name, null)
    assert.match(line.note!, /can no longer be found/)
    assert.match(line.note!, /still dismiss/)
  })
})

describe('why a decision did not work', () => {
  it('says a 403 needs the edit right on Organizations', () => {
    assert.equal(decisionFailureText(new ApiError('Your role does not have access.', 403), 'x'), NO_DECIDE_TEXT)
    assert.match(NO_DECIDE_TEXT, /edit right on Organizations/)
  })

  it('says a 404 is a proposal that can no longer be found', () => {
    assert.equal(decisionFailureText(new ApiError('Proposal not found.', 404), 'x'), 'This proposal can no longer be found. It may have been removed.')
  })

  it('uses the server\'s sentence for a clash, and a plain one when it gave none', () => {
    assert.equal(decisionFailureText(new AgentApiError('This proposal was already applied.', 409, undefined, undefined, 'already_decided', null), 'x'), 'This proposal was already applied.')
    assert.equal(decisionFailureText(new AgentApiError('Both organisations already have a record from the same source.', 409, undefined, undefined, 'could_not_apply', null), 'x'), 'Both organisations already have a record from the same source.')
    assert.equal(decisionFailureText(new ApiError('', 500), 'x'), 'The server answered 500.')
  })

  it('says a lost connection in plain words, and falls back to the sentence it was given', () => {
    assert.equal(decisionFailureText(new TypeError('Failed to fetch'), 'x'), NETWORK_TEXT)
    assert.equal(decisionFailureText(new Error(''), 'The proposal could not be accepted.'), 'The proposal could not be accepted.')
    assert.equal(decisionFailureText(new Error('Something broke.'), 'x'), 'Something broke.')
  })

  it('has one sentence for each of the two reasons the agent can be off, and both say a dismissal still works', () => {
    assert.match(AGENT_OFF_QUEUE_TEXT, /your organisation/)
    assert.match(AGENT_OFF_PLATFORM_QUEUE_TEXT, /every organisation/)
    for (const text of [AGENT_OFF_QUEUE_TEXT, AGENT_OFF_PLATFORM_QUEUE_TEXT, AGENT_OFF_UNKNOWN_QUEUE_TEXT]) assert.match(text, /still dismiss/)
  })

  it('says nothing while the agent runs or while it is not known, and says which switch is on when it is off', () => {
    assert.equal(agentOffQueueText(null), null)
    assert.equal(agentOffQueueText(undefined), null)
    assert.equal(agentOffQueueText({ on: false, scope: null }), null)
    assert.equal(agentOffQueueText({ on: true, scope: 'organisation' }), AGENT_OFF_QUEUE_TEXT)
    assert.equal(agentOffQueueText({ on: true, scope: 'platform' }), AGENT_OFF_PLATFORM_QUEUE_TEXT)
    assert.equal(agentOffQueueText({ on: true, scope: null }), AGENT_OFF_UNKNOWN_QUEUE_TEXT)
  })
})
