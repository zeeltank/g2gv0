import assert from 'node:assert/strict'
import { test } from 'node:test'

import * as flow from '../flow'
import { DEPARTMENT_PAGE } from './actions'
import {
  CAPABILITY_LIBRARY_PAGE,
  createJobRoleAction,
  createKasaEntryAction,
  createSkillAction,
  type CapabilityLibraryDeps,
  type LibraryEntryRecord,
  type LibraryEntryTab,
} from './actions-capability-library'
import { assertAppliesTo, assertWriteDefinition, at, ledger, lineMap } from './test-kit'

function world(overrides: Partial<CapabilityLibraryDeps> = {}) {
  const { rows, record } = ledger()
  const entries = new Map<string, LibraryEntryRecord>()
  const roles: Array<{ id: number; department: string; jobrole: string }> = []
  const calls = { entries: [] as unknown[], roles: [] as unknown[] }
  let nextId = 100

  const deps: CapabilityLibraryDeps = {
    createEntry: async (_ctx, tab, payload) => {
      calls.entries.push({ tab, ...payload })
      nextId += 1
      entries.set(`${tab}:${nextId}`, { title: payload.title, category: payload.category ?? null, description: payload.description ?? null })
      return { data: { id: nextId } }
    },
    getEntry: async (_ctx, tab: LibraryEntryTab, id) => entries.get(`${tab}:${id}`) ?? null,
    listDepartments: async () => [{ id: 3, department: 'Operations' }, { id: 4, department: 'Finance' }],
    createJobRole: async (_ctx, departmentId, payload) => {
      calls.roles.push({ departmentId, ...payload })
      nextId += 1
      roles.push({ id: nextId, department: departmentId, jobrole: payload.jobrole })
      return { data: { id: nextId } }
    },
    listDepartmentJobRoles: async (_ctx, departmentId) => roles.filter((role) => role.department === departmentId).map(({ id, jobrole }) => ({ id, jobrole })),
    record,
    ...overrides,
  }

  return { deps, calls, rows, entries, roles }
}

// ---- create_skill ---------------------------------------------------------------------------

test('create_skill: offered on the Capability Library only', () => {
  const definition = createSkillAction(world().deps)
  assertWriteDefinition(definition)
  assertAppliesTo(definition, [CAPABILITY_LIBRARY_PAGE], ['/dashboard', DEPARTMENT_PAGE])
})

test('create_skill: a name is required; preview states what is written and where', () => {
  const definition = createSkillAction(world().deps)
  assert.equal(flow.submit(flow.start(definition), definition, { title: '' }, at(CAPABILITY_LIBRARY_PAGE)).phase, 'collecting')

  const confirming = flow.submit(flow.start(definition), definition, { title: 'Negotiation', category: 'Soft skills', description: '' }, at(CAPABILITY_LIBRARY_PAGE))
  assert.equal(confirming.phase, 'confirming')
  if (confirming.phase === 'confirming') {
    assert.deepEqual(lineMap(confirming.preview), { 'Skill name': 'Negotiation', Category: 'Soft skills', Description: '—' })
    assert.match(confirming.preview.warning ?? '', /this organisation's Capability Library only/)
  }
})

test('create_skill: sends the previewed fields, writes the ledger, and verify reads the skill back', async () => {
  const { deps, calls, rows } = world()
  const result = await flow.executeVerified(createSkillAction(deps), { title: 'Negotiation', category: 'Soft skills', description: '' }, at(CAPABILITY_LIBRARY_PAGE))

  assert.equal(result.ok, true, result.message)
  assert.deepEqual(calls.entries, [{ tab: 'skill', title: 'Negotiation', category: 'Soft skills', description: undefined }])
  assert.equal(rows[0].moduleKey, 'capability_intelligence')
  assert.equal(rows[0].entry.operation, 'chat_create_skill')
  assert.equal(rows[0].entry.subject_id, 101)
  assert.match(result.message, /Confirmed/)
  assert.equal(result.link?.href, CAPABILITY_LIBRARY_PAGE)
})

test('create_skill: verify FAILURE - the entry cannot be read back - is reported failed', async () => {
  const { deps } = world({ getEntry: async () => null })
  const result = await flow.executeVerified(createSkillAction(deps), { title: 'Negotiation', category: '', description: '' }, at(CAPABILITY_LIBRARY_PAGE))

  assert.equal(result.ok, false)
  assert.match(result.message, /could not be confirmed/)
})

test('create_skill: verify FAILURE - a wrong saved title or category is reported failed', async () => {
  const wrongTitle = world({ getEntry: async () => ({ title: 'Something else', category: 'Soft skills' }) })
  assert.equal((await flow.executeVerified(createSkillAction(wrongTitle.deps), { title: 'Negotiation', category: 'Soft skills', description: '' }, at(CAPABILITY_LIBRARY_PAGE))).ok, false)

  const wrongCategory = world({ getEntry: async () => ({ title: 'Negotiation', category: 'Hard skills' }) })
  const result = await flow.executeVerified(createSkillAction(wrongCategory.deps), { title: 'Negotiation', category: 'Soft skills', description: '' }, at(CAPABILITY_LIBRARY_PAGE))
  assert.equal(result.ok, false)
  assert.match(result.message, /saved category/)
})

test('create_skill: the server refusal is shown and no ledger row is written', async () => {
  const { deps, rows } = world({ createEntry: async () => { throw new Error('You do not have permission to perform this action.') } })
  const result = await flow.executeVerified(createSkillAction(deps), { title: 'Negotiation', category: '', description: '' }, at(CAPABILITY_LIBRARY_PAGE))

  assert.equal(result.ok, false)
  assert.equal(result.message, 'You do not have permission to perform this action.')
  assert.equal(rows.length, 0)
})

// ---- create_kasa_entry ----------------------------------------------------------------------

test('create_kasa_entry: offered on the Capability Library only; the four kinds are offered', async () => {
  const definition = createKasaEntryAction(world().deps)
  assertWriteDefinition(definition)
  assertAppliesTo(definition, [CAPABILITY_LIBRARY_PAGE], ['/dashboard', DEPARTMENT_PAGE])

  const kinds = await definition.inputs.find((input) => input.key === 'kasa_type')!.options!(at(CAPABILITY_LIBRARY_PAGE))
  assert.deepEqual(kinds.map((kind) => kind.value), ['knowledge', 'ability', 'attitude', 'behaviour'])
})

test('create_kasa_entry: an unknown kind is refused; the preview names the kind', () => {
  const definition = createKasaEntryAction(world().deps)
  assert.ok(definition.validate!({ kasa_type: 'skill', title: 'x' }).kasa_type)
  assert.deepEqual(definition.validate!({ kasa_type: 'attitude', title: 'x' }), {})

  const confirming = flow.submit(flow.start(definition), definition, { kasa_type: 'attitude', title: 'Ownership', category: '', description: '' }, at(CAPABILITY_LIBRARY_PAGE), { kasa_type: 'Attitude' })
  assert.equal(confirming.phase, 'confirming')
  if (confirming.phase === 'confirming') assert.equal(lineMap(confirming.preview).Kind, 'Attitude')
})

test('create_kasa_entry: posts to the chosen kind and verify reads it back from that kind', async () => {
  const { deps, calls, rows } = world()
  const result = await flow.executeVerified(createKasaEntryAction(deps), { kasa_type: 'behaviour', title: 'Listens first', category: '', description: 'x' }, at(CAPABILITY_LIBRARY_PAGE))

  assert.equal(result.ok, true, result.message)
  assert.deepEqual(calls.entries, [{ tab: 'behaviour', title: 'Listens first', category: undefined, description: 'x' }])
  assert.equal(rows[0].entry.operation, 'chat_create_kasa_entry')
  assert.equal(rows[0].entry.subject_entity_key, 'behaviour')
})

test('create_kasa_entry: verify FAILURE is reported failed; a refusal writes no ledger row', async () => {
  const lost = world({ getEntry: async () => null })
  assert.equal((await flow.executeVerified(createKasaEntryAction(lost.deps), { kasa_type: 'ability', title: 'A', category: '', description: '' }, at(CAPABILITY_LIBRARY_PAGE))).ok, false)

  const refused = world({ createEntry: async () => { throw new Error('You do not have permission to perform this action.') } })
  const result = await flow.executeVerified(createKasaEntryAction(refused.deps), { kasa_type: 'ability', title: 'A', category: '', description: '' }, at(CAPABILITY_LIBRARY_PAGE))
  assert.equal(result.message, 'You do not have permission to perform this action.')
  assert.equal(refused.rows.length, 0)
})

// ---- create_job_role ------------------------------------------------------------------------

test('create_job_role: offered on the Capability Library AND on Department Management, nowhere else', () => {
  const definition = createJobRoleAction(world().deps)
  assertWriteDefinition(definition)
  assertAppliesTo(definition, [CAPABILITY_LIBRARY_PAGE, DEPARTMENT_PAGE], ['/dashboard', '/module/lms/learning/learning-catalog'])
})

test('create_job_role: departments are read live and the preview names the department', async () => {
  const definition = createJobRoleAction(world().deps)
  const departments = await definition.inputs.find((input) => input.key === 'department_id')!.options!(at(DEPARTMENT_PAGE))
  assert.deepEqual(departments, [{ value: '3', label: 'Operations' }, { value: '4', label: 'Finance' }])

  assert.ok(definition.validate!({ jobrole: 'x', department_id: 'abc' }).department_id)
  const blocked = flow.submit(flow.start(definition), definition, { jobrole: '', department_id: '' }, at(DEPARTMENT_PAGE))
  assert.equal(blocked.phase, 'collecting')

  const confirming = flow.submit(flow.start(definition), definition, { jobrole: 'Payroll Analyst', department_id: '4', description: '' }, at(DEPARTMENT_PAGE), { department_id: 'Finance' })
  assert.equal(confirming.phase, 'confirming')
  if (confirming.phase === 'confirming') assert.deepEqual(lineMap(confirming.preview), { 'Job role': 'Payroll Analyst', Department: 'Finance', Description: '—' })
})

test('create_job_role: sends the department id (as the department panel does) and verify finds the role under it', async () => {
  const { deps, calls, rows } = world()
  const result = await flow.executeVerified(createJobRoleAction(deps), { jobrole: 'Payroll Analyst', department_id: '4', description: '' }, at(DEPARTMENT_PAGE))

  assert.equal(result.ok, true, result.message)
  assert.deepEqual(calls.roles, [{ departmentId: '4', jobrole: 'Payroll Analyst', description: undefined }])
  assert.equal(rows[0].entry.operation, 'chat_create_job_role')
  assert.match(result.message, /Confirmed/)
})

test('create_job_role: verify FAILURE - not listed under the department - is reported failed', async () => {
  const { deps } = world({ listDepartmentJobRoles: async () => [] })
  const result = await flow.executeVerified(createJobRoleAction(deps), { jobrole: 'Payroll Analyst', department_id: '4', description: '' }, at(DEPARTMENT_PAGE))

  assert.equal(result.ok, false)
  assert.match(result.message, /could not be confirmed.*role list/)
})

test('create_job_role: the server refusal is shown and no ledger row is written', async () => {
  const { deps, rows } = world({ createJobRole: async () => { throw new Error('You do not have permission to perform this action.') } })
  const result = await flow.executeVerified(createJobRoleAction(deps), { jobrole: 'X', department_id: '4', description: '' }, at(DEPARTMENT_PAGE))

  assert.equal(result.ok, false)
  assert.equal(result.message, 'You do not have permission to perform this action.')
  assert.equal(rows.length, 0)
})
