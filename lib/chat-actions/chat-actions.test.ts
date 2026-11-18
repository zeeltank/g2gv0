import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createDepartmentAction, DEPARTMENT_PAGE, type DepartmentActionDeps, type G2gActionApp } from './g2g/actions'
import * as flow from './flow'
import { ActionRegistry, prefillFromMessage } from './registry'
import type { ActionContext } from './types'

const laravel = {
  token: 'tok', subInstituteId: '1', syear: '2026', userId: '7', organizationId: '1', orgType: 'x', profileId: '1',
}

const context = (pathname: string): ActionContext<G2gActionApp> => ({
  pathname, menuId: 13, moduleKey: 'organizational_management', snapshot: null, app: { laravel },
})

function deps(overrides: Partial<DepartmentActionDeps> = {}) {
  const calls: { created: unknown[]; recorded: unknown[] } = { created: [], recorded: [] }
  const value: DepartmentActionDeps = {
    listDepartments: async () => [{ id: 3, department: 'Engineering' }, { id: 5, department: 'Sales' }],
    createDepartment: async (_ctx, data) => { calls.created.push(data); return { data: { id: 99 } } },
    record: async (_module, entry) => { calls.recorded.push(entry); return true },
    ...overrides,
  }
  return { value, calls }
}

const onDepartmentPage = context(DEPARTMENT_PAGE)

// ---- registry: what is offered, and what a sentence picks ---------------------------------

test('the action is offered on its page and only there', () => {
  const registry = new ActionRegistry([createDepartmentAction(deps().value)])

  assert.equal(registry.available(onDepartmentPage).length, 1)
  assert.equal(registry.available(context(DEPARTMENT_PAGE + '/42')).length, 1)
  assert.equal(registry.available(context('/module/lms/learning/my-learning')).length, 0)
  assert.equal(registry.available(context('/dashboard')).length, 0)
})

test('it is not offered when the page did not come from the user own menu', () => {
  const registry = new ActionRegistry([createDepartmentAction(deps().value)])
  const unresolved: ActionContext<G2gActionApp> = { ...onDepartmentPage, menuId: null }

  assert.equal(registry.available(unresolved).length, 0)
  assert.equal(registry.match('create a department called Finance', unresolved), null)
})

test('a sentence picks the action by its phrases, whole words only', () => {
  const registry = new ActionRegistry([createDepartmentAction(deps().value)])

  assert.equal(registry.match('Please create a department called Finance', onDepartmentPage)?.key, 'create_department')
  assert.equal(registry.match('can you ADD DEPARTMENT?', onDepartmentPage)?.key, 'create_department')
  assert.equal(registry.match('how many departments are there?', onDepartmentPage), null)
  assert.equal(registry.match('what is a new departmental policy?', onDepartmentPage), null)
})

test('asking for an action the page does not offer matches nothing', () => {
  const registry = new ActionRegistry([createDepartmentAction(deps().value)])

  assert.equal(registry.match('create a department called Finance', context('/module/lms/learning/my-learning')), null)
})

test('the sentence pre-fills the name when it states one', () => {
  const definition = createDepartmentAction(deps().value)

  assert.deepEqual(prefillFromMessage(definition, 'create a department called Finance'), { department: 'Finance' })
  assert.deepEqual(prefillFromMessage(definition, 'add a department named "Data Science"'), { department: 'Data Science' })
  assert.deepEqual(prefillFromMessage(definition, 'create a department'), {})
})

// ---- flow: the safety rules ----------------------------------------------------------------

test('required and length rules block the preview', () => {
  const definition = createDepartmentAction(deps().value)
  const state = flow.submit(flow.start(definition), definition, { department: '   ' }, onDepartmentPage)

  assert.equal(state.phase, 'collecting')
  assert.ok(state.phase === 'collecting' && state.errors.department)

  const tooLong = flow.submit(flow.start(definition), definition, { department: 'x'.repeat(192) }, onDepartmentPage)
  assert.ok(tooLong.phase === 'collecting' && tooLong.errors.department)
})

test('valid values produce a preview of exactly what will be written', () => {
  const definition = createDepartmentAction(deps().value)
  const state = flow.submit(
    flow.start(definition),
    definition,
    { department: '  Finance ', code: 'FIN', parent_id: '3', description: '' },
    onDepartmentPage,
    { parent_id: 'Engineering' },
  )

  assert.equal(state.phase, 'confirming')
  assert.ok(state.phase === 'confirming')
  assert.deepEqual(state.preview.lines, [
    { label: 'Name', value: 'Finance' },
    { label: 'Code', value: 'FIN' },
    { label: 'Parent', value: 'Engineering' },
    { label: 'Description', value: '—' },
  ])
})

test('execution cannot start from anywhere but confirming', () => {
  const definition = createDepartmentAction(deps().value)
  const collecting = flow.start(definition, { department: 'Finance' })

  assert.equal(flow.beginExecution(collecting), null)
  assert.equal(flow.beginExecution(flow.cancel(collecting)), null)
})

test('a second Confirm finds the proposal already running and does nothing', () => {
  const definition = createDepartmentAction(deps().value)
  const confirming = flow.submit(flow.start(definition), definition, { department: 'Finance' }, onDepartmentPage)

  const first = flow.beginExecution(confirming)
  assert.ok(first)
  assert.equal(flow.beginExecution(first!), null)

  const done = flow.finish(first!, { ok: true, message: 'ok' })
  assert.equal(flow.beginExecution(done), null)
})

test('cancel is final, and impossible once execution has started', () => {
  const definition = createDepartmentAction(deps().value)
  const confirming = flow.submit(flow.start(definition), definition, { department: 'Finance' }, onDepartmentPage)

  assert.equal(flow.cancel(confirming).phase, 'cancelled')
  assert.equal(flow.beginExecution(flow.cancel(confirming)), null)

  const executing = flow.beginExecution(confirming)!
  assert.equal(flow.cancel(executing).phase, 'executing')
  assert.equal(flow.cancel(flow.finish(executing, { ok: true, message: 'x' })).phase, 'done')
})

test('a failure is a final state carrying the reason', () => {
  const definition = createDepartmentAction(deps().value)
  const executing = flow.beginExecution(flow.submit(flow.start(definition), definition, { department: 'F' }, onDepartmentPage))!
  const failed = flow.finish(executing, { ok: false, message: 'Forbidden' })

  assert.equal(failed.phase, 'failed')
  assert.ok(flow.isFinal(failed))
})

// ---- the department action ----------------------------------------------------------------

test('executing creates the department through the existing service as the signed-in user', async () => {
  const { value, calls } = deps()
  const definition = createDepartmentAction(value)

  const result = await definition.execute({ department: 'Finance', code: 'FIN', parent_id: '3', description: '' }, onDepartmentPage)

  assert.equal(result.ok, true)
  assert.deepEqual(calls.created, [{ department: 'Finance', parent_id: '3', code: 'FIN', description: undefined }])
  assert.equal(calls.recorded.length, 1)
  assert.equal((calls.recorded[0] as { operation: string }).operation, 'chat_create_department')
})

test("the backend's refusal is the result - nothing is recorded as done", async () => {
  const { value, calls } = deps({
    createDepartment: async () => { throw new Error('You do not have permission to create departments.') },
  })

  const result = await createDepartmentAction(value).execute({ department: 'Finance' }, onDepartmentPage)

  assert.equal(result.ok, false)
  assert.equal(result.message, 'You do not have permission to create departments.')
  assert.equal(calls.recorded.length, 0)
})

test('a failed ledger write does not undo or hide a created department', async () => {
  const { value } = deps({ record: async () => false })

  assert.equal((await createDepartmentAction(value).execute({ department: 'Finance' }, onDepartmentPage)).ok, true)
})

test('parent choices are the organisation\'s own departments, with a top-level option', async () => {
  const definition = createDepartmentAction(deps().value)
  const parent = definition.inputs.find((input) => input.key === 'parent_id')!
  const options = await parent.options!(onDepartmentPage)

  assert.deepEqual(options, [
    { value: '', label: 'None (top level)' },
    { value: '3', label: 'Engineering' },
    { value: '5', label: 'Sales' },
  ])
})

test('Edit returns from the preview to the form, keeping what was typed, and only before execution', () => {
  const definition = createDepartmentAction(deps().value)
  const confirming = flow.submit(flow.start(definition), definition, { department: 'Finance' }, onDepartmentPage)

  const back = flow.edit(confirming)
  assert.equal(back.phase, 'collecting')
  assert.equal(back.values.department, 'Finance')

  const executing = flow.beginExecution(confirming)!
  assert.equal(flow.edit(executing).phase, 'executing')
  assert.equal(flow.edit(flow.start(definition)).phase, 'collecting')
})
