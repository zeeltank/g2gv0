import assert from 'node:assert/strict'
import { test } from 'node:test'

import * as flow from './flow'
import type { ChatActionDefinition, FlowState } from './types'

const definition: ChatActionDefinition<null> = {
  key: 'demo',
  label: 'Demo',
  description: 'demo',
  risk: 'write',
  requiresApproval: true,
  phrases: ['demo'],
  appliesTo: () => true,
  inputs: [{ key: 'name', label: 'Name', type: 'text', required: true }],
  preview: (values) => ({ title: 'Do it?', lines: [{ label: 'Name', value: values.name }] }),
  execute: async () => ({ ok: true, message: 'ok' }),
}

function confirming(): FlowState {
  const collecting = flow.start(definition, { name: 'A' })
  return flow.submit(collecting, definition, { name: 'A' }, { pathname: '/', menuId: 1, moduleKey: 'm', snapshot: null, app: null })
}

function waiting(): FlowState {
  const requesting = flow.beginApproval(confirming())
  assert.ok(requesting)
  return flow.requested(requesting, 7)
}

test('Confirm on an approval action sends a request once, never runs it', () => {
  const state = confirming()
  const first = flow.beginApproval(state)
  assert.equal(first?.phase, 'requesting')
  // a second press finds a state that is no longer `confirming`
  assert.equal(flow.beginApproval(first as FlowState), null)
  assert.equal(flow.beginExecution(first as FlowState), null)
})

test('an unapproved action cannot be executed from any pre-approval state', () => {
  for (const state of [confirming(), flow.beginApproval(confirming()) as FlowState, waiting()]) {
    assert.equal(flow.beginApprovedExecution(state), null)
  }
})

test('pending leaves the wait alone; approved and rejected move it', () => {
  const state = waiting()
  assert.equal(flow.decided(state, 'pending'), state)
  assert.equal(flow.decided(state, 'completed'), state)
  assert.equal(flow.decided(state, 'approved').phase, 'approved')
  const rejected = flow.decided(state, 'rejected', 'no budget')
  assert.equal(rejected.phase, 'rejected')
  assert.equal(flow.isFinal(rejected), true)
})

test('approved runs exactly once and keeps the request id to the end', () => {
  const approved = flow.decided(waiting(), 'approved')
  const executing = flow.beginApprovedExecution(approved)
  assert.equal(executing?.requestId, 7)
  assert.equal(flow.beginApprovedExecution(executing as FlowState), null)
  const done = flow.finish(executing as Extract<FlowState, { phase: 'executing' }>, { ok: true, message: 'ok' })
  assert.equal(done.phase, 'done')
  assert.equal((done as { requestId?: number }).requestId, 7)
  assert.equal(flow.decided(done, 'rejected'), done)
})

test('a request that could not be recorded fails visibly and nothing was sent', () => {
  const requesting = flow.beginApproval(confirming()) as FlowState
  const failed = flow.requestFailed(requesting, { ok: false, message: 'offline' })
  assert.equal(failed.phase, 'failed')
})

test('the requester can withdraw while waiting, and that is final', () => {
  const cancelled = flow.cancel(waiting())
  assert.equal(cancelled.phase, 'cancelled')
  assert.equal(flow.decided(cancelled, 'approved'), cancelled)
})
