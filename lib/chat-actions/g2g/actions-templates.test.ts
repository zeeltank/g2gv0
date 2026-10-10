import assert from 'node:assert/strict'
import { test } from 'node:test'

import * as flow from '../flow'
import type { ActionContext } from '../types'
import type { G2gActionApp } from './actions'
import { CHAT_REPORT_LAYOUT, createTemplateAction, type TemplateActionDeps } from './actions-templates'

const laravel = { token: 't', subInstituteId: '1', syear: '2026', userId: '7', organizationId: '1', orgType: 'x', profileId: '1' }
const context = (moduleKey: string | null, menuId: number | null = 5): ActionContext<G2gActionApp> => ({
  pathname: '/module/lms', menuId, moduleKey, snapshot: null, app: { laravel },
})

function deps(overrides: Partial<TemplateActionDeps> = {}) {
  const calls: { created: unknown[]; recorded: unknown[]; sourcesFor: string[] } = { created: [], recorded: [], sourcesFor: [] }
  const value: TemplateActionDeps = {
    listDataSources: async (moduleKey) => { calls.sourcesFor.push(moduleKey); return [{ name: 'lms.catalog', label: 'Course catalog' }] },
    createTemplate: async (payload) => { calls.created.push(payload); return { template: { id: 31 } } },
    record: async (_module, entry) => { calls.recorded.push(entry); return true },
    ...overrides,
  }
  return { value, calls }
}

test('offered only inside a module, on a page from the user’s own menu', () => {
  const action = createTemplateAction(deps().value)
  assert.equal(action.appliesTo(context('lms')), true)
  assert.equal(action.appliesTo(context(null)), false)
  assert.equal(action.appliesTo(context('lms', null)), false)
})

test('data sources are read live for THIS module only', async () => {
  const d = deps()
  const action = createTemplateAction(d.value)
  const select = action.inputs.find((input) => input.key === 'data_source')!
  const options = await select.options!(context('talent_management'))
  assert.deepEqual(d.calls.sourcesFor, ['talent_management'])
  assert.equal(options.some((option) => option.value === 'lms.catalog'), true)
})

test('a report needs a source and a prompt needs text', () => {
  const action = createTemplateAction(deps().value)
  assert.ok(action.validate!({ name: 'A', kind: 'report', data_source: '', user_prompt: '', description: '' }).data_source)
  assert.ok(action.validate!({ name: 'A', kind: 'prompt', data_source: '', user_prompt: '', description: '' }).user_prompt)
  assert.deepEqual(action.validate!({ name: 'A', kind: 'report', data_source: 'lms.catalog', user_prompt: '', description: '' }), {})
})

test('saves a DRAFT report with the generic layout, for the active module, and records it', async () => {
  const d = deps()
  const action = createTemplateAction(d.value)
  const result = await action.execute({ name: 'Monthly', kind: 'report', data_source: 'lms.catalog', user_prompt: '', description: '' }, context('lms'))
  assert.equal(result.ok, true)
  const sent = d.calls.created[0] as Record<string, unknown>
  assert.equal(sent.status, 'draft')
  assert.equal(sent.module_key, 'lms')
  assert.equal(sent.html_layout, CHAT_REPORT_LAYOUT)
  assert.equal(sent.data_source, 'lms.catalog')
  assert.equal(d.calls.recorded.length, 1)
})

test('the module comes from the page, never from the typed values', async () => {
  const d = deps()
  const action = createTemplateAction(d.value)
  await action.execute({ name: 'X', kind: 'prompt', data_source: '', user_prompt: 'Summarise', description: '', module_key: 'other' } as never, context('task_management'))
  assert.equal((d.calls.created[0] as Record<string, unknown>).module_key, 'task_management')
})

test('a backend refusal is shown, not hidden, and nothing is recorded', async () => {
  const d = deps({ createTemplate: async () => { throw new Error('You do not have the right to create templates.') } })
  const action = createTemplateAction(d.value)
  const result = await action.execute({ name: 'X', kind: 'prompt', data_source: '', user_prompt: 'p', description: '' }, context('lms'))
  assert.equal(result.ok, false)
  assert.match(result.message, /do not have the right/)
  assert.equal(d.calls.recorded.length, 0)
})

test('it goes through the same confirm flow as every action', () => {
  const action = createTemplateAction(deps().value)
  const state = flow.submit(flow.start(action, { name: 'N', kind: 'prompt', user_prompt: 'hi' }), action, { name: 'N', kind: 'prompt', user_prompt: 'hi' }, context('lms'))
  assert.equal(state.phase, 'confirming')
})
