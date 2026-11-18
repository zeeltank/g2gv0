import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DecisionConflictError } from '../../services/signal-review/decision-error'
import { buildDecisionRequest, availableDecisions, decisionNotice, statusAfter } from './decision-actions'
import { classifyDecisionFailure, FORBIDDEN_TEXT, NETWORK_TEXT } from './decision-failure'
import { historyEntry } from './signal-fixtures'

const decisions = (status: Parameters<typeof availableDecisions>[0]) => availableDecisions(status).map((a) => a.decision)

describe('which decision buttons a status offers', () => {
  it('offers all three on a signal that needs a decision, and never Reopen (the server refuses it)', () => {
    assert.deepEqual(decisions('New'), ['follow_up', 'reviewed', 'dismissed'])
  })

  it('offers only a way out of the current status', () => {
    assert.deepEqual(decisions('Follow-up'), ['reviewed', 'dismissed'])
    assert.deepEqual(decisions('Reviewed'), ['follow_up', 'dismissed'])
  })

  it('offers only Reopen on a dismissed signal', () => {
    assert.deepEqual(decisions('Dismissed'), ['reopened'])
  })

  it('calls the buttons by the screen\'s words, and marks the two that ask for more with an ellipsis', () => {
    assert.deepEqual(availableDecisions('New').map((a) => a.label), ['Contacted', 'Reviewed', 'Not relevant…'])
    assert.equal(availableDecisions('Dismissed')[0].label, 'Reopen…')
  })

  it('never offers the decision that would leave the status as it is', () => {
    for (const status of ['New', 'Follow-up', 'Reviewed', 'Dismissed'] as const) {
      for (const action of availableDecisions(status)) assert.notEqual(statusAfter(action.decision), status, `${status} -> ${action.decision}`)
    }
  })

  it('turns each decision into the status the contract says', () => {
    assert.deepEqual(['reviewed', 'dismissed', 'follow_up', 'reopened'].map((d) => statusAfter(d as never)), ['Reviewed', 'Dismissed', 'Follow-up', 'New'])
  })

  it('confirms each decision in words', () => {
    assert.equal(decisionNotice('follow_up'), 'Marked as contacted.')
    assert.equal(decisionNotice('dismissed'), 'Marked as not relevant.')
    assert.match(decisionNotice('reopened'), /^Reopened/)
    assert.equal(decisionNotice('promoted'), 'Saved.')
  })
})

describe('the request for a decision', () => {
  it('always carries the status the person was looking at', () => {
    assert.equal(buildDecisionRequest({ decision: 'follow_up' }, 'New').expected_status, 'New')
    assert.equal(buildDecisionRequest({ decision: 'reopened' }, 'Dismissed').expected_status, 'Dismissed')
  })

  it('sends the reason only with a dismissal, and a note only when it has words', () => {
    assert.deepEqual(buildDecisionRequest({ decision: 'dismissed', reason_code: 'stale', note: '  Too old.  ' }, 'New'), { decision: 'dismissed', reason_code: 'stale', note: 'Too old.', expected_status: 'New' })
    assert.deepEqual(buildDecisionRequest({ decision: 'reviewed', reason_code: 'stale', note: '   ' }, 'New'), { decision: 'reviewed', expected_status: 'New' })
  })
})

describe('what a refused decision becomes', () => {
  it('a 409 "conflict" carries the decision that got there first', () => {
    const entry = historyEntry()
    const failure = classifyDecisionFailure(new DecisionConflictError({ status: 0, code: 'conflict', message: 'Changed.', current: entry }))
    assert.deepEqual(failure, { kind: 'conflict', entry, message: 'Changed.' })
  })

  it('a 409 "conflict" without the other decision is still a conflict, with no entry', () => {
    const failure = classifyDecisionFailure(new DecisionConflictError({ status: 0, code: 'conflict', message: 'Changed.', current: null }))
    assert.deepEqual(failure, { kind: 'conflict', entry: null, message: 'Changed.' })
  })

  it('a 409 "unchanged" is a message, not a conflict', () => {
    const failure = classifyDecisionFailure(new DecisionConflictError({ status: 0, code: 'unchanged', message: 'Already contacted.', current: historyEntry() }))
    assert.deepEqual(failure, { kind: 'unchanged', message: 'Already contacted.' })
  })

  it('a 422 puts each message under its field and keeps the rest for the form', () => {
    const failure = classifyDecisionFailure(Object.assign(new Error('Validation failed'), { status: 422, errors: { reason_code: ['Choose a reason.'], note: ['Too long.', 'Really.'], expected_status: ['Not a status.'] } }))
    assert.deepEqual(failure, { kind: 'fields', serverErrors: { reason_code: 'Choose a reason.', note: 'Too long. Really.' }, formError: 'Not a status.' })
  })

  it('a 422 with nothing for any field still says something', () => {
    assert.deepEqual(classifyDecisionFailure(Object.assign(new Error('Validation failed'), { status: 422 })), { kind: 'fields', serverErrors: {}, formError: 'Validation failed' })
  })

  it('a 403 says the person may view but not decide', () => {
    assert.deepEqual(classifyDecisionFailure(Object.assign(new Error('Forbidden'), { status: 403 })), { kind: 'forbidden', message: FORBIDDEN_TEXT })
    assert.equal(FORBIDDEN_TEXT, 'You can view signals but you are not allowed to decide on them.')
  })

  it('a 404 says the signal is gone', () => {
    assert.equal(classifyDecisionFailure(Object.assign(new Error('Opportunity not found'), { status: 404 })).kind, 'missing')
  })

  it('a request that never reached the server is a retryable failure, in plain words', () => {
    assert.deepEqual(classifyDecisionFailure(new TypeError('Failed to fetch')), { kind: 'failed', message: NETWORK_TEXT })
    assert.deepEqual(classifyDecisionFailure(null), { kind: 'failed', message: NETWORK_TEXT })
  })

  it('any other answer from the server shows the server\'s own sentence', () => {
    assert.deepEqual(classifyDecisionFailure(Object.assign(new Error('Server Error'), { status: 500 })), { kind: 'failed', message: 'Server Error' })
    assert.deepEqual(classifyDecisionFailure(Object.assign(new Error(''), { status: 502 })), { kind: 'failed', message: 'The server answered 502.' })
  })
})
