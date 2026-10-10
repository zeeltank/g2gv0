import assert from 'node:assert/strict'
import { test } from 'node:test'

import * as flow from './flow'
import type { ChatActionDefinition } from './types'

const base: ChatActionDefinition<null> = {
  key: 'demo', label: 'Demo', description: 'd', risk: 'write', phrases: [], appliesTo: () => true, inputs: [],
  preview: () => ({ title: 't', lines: [] }),
  execute: async () => ({ ok: true, message: 'Done.' }),
}
const ctx = { pathname: '/', menuId: 1, moduleKey: 'm', snapshot: null, app: null }

test('no verify hook: the execute result stands', async () => {
  assert.deepEqual(await flow.executeVerified(base, {}, ctx), { ok: true, message: 'Done.' })
})

test('a confirmed change is reported with what was confirmed', async () => {
  const r = await flow.executeVerified({ ...base, verify: async () => ({ ok: true, message: 'Confirmed in the database.' }) }, {}, ctx)
  assert.equal(r.ok, true)
  assert.match(r.message, /Confirmed in the database/)
})

test('a change that cannot be found is a failure, not a success', async () => {
  const r = await flow.executeVerified({ ...base, verify: async () => ({ ok: false, message: 'department not found.' }) }, {}, ctx)
  assert.equal(r.ok, false)
  assert.match(r.message, /could not be confirmed: department not found/)
})

test('a verifier that throws is a failure', async () => {
  const r = await flow.executeVerified({ ...base, verify: async () => { throw new Error('offline') } }, {}, ctx)
  assert.equal(r.ok, false)
  assert.match(r.message, /offline/)
})

test('verify is never called when execute failed, and a throwing execute is a failure', async () => {
  let called = false
  const failed = await flow.executeVerified({ ...base, execute: async () => ({ ok: false, message: 'denied' }), verify: async () => { called = true; return { ok: true } } }, {}, ctx)
  assert.equal(failed.ok, false)
  assert.equal(called, false)
  const thrown = await flow.executeVerified({ ...base, execute: async () => { throw new Error('boom') } }, {}, ctx)
  assert.deepEqual(thrown, { ok: false, message: 'boom' })
})
