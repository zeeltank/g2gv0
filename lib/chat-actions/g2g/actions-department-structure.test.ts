import assert from 'node:assert/strict'
import { test } from 'node:test'

import * as flow from '../flow'
import { DEPARTMENT_PAGE } from './actions'
import {
  changeDepartmentHeadAction,
  mergeDepartmentsAction,
  reorderDepartmentAction,
  type DepartmentRow,
  type DepartmentStructureDeps,
} from './actions-department-structure'
import { assertAppliesTo, assertWriteDefinition, at, ledger, lineMap } from './test-kit'

/** An in-memory org the fake deps read and write, so verify has something real to read. */
function world(overrides: Partial<DepartmentStructureDeps> = {}) {
  const { rows, record } = ledger()
  const departments: DepartmentRow[] = [
    { id: 1, department: 'Finance', parent_id: 0, sort_order: 1, head_user_id: null, head_name: null, employee_count: 12 },
    { id: 2, department: 'Operations', parent_id: 0, sort_order: 2, head_user_id: 31, head_name: 'Asha Rao', employee_count: 30 },
    { id: 3, department: 'Payroll', parent_id: 1, sort_order: 1, head_user_id: null, head_name: null, employee_count: 3 },
    { id: 4, department: 'Treasury', parent_id: 0, sort_order: 3, head_user_id: null, head_name: null, employee_count: 1 },
  ]
  const calls = { merged: [] as unknown[], reordered: [] as unknown[], heads: [] as unknown[] }

  const deps: DepartmentStructureDeps = {
    listDepartments: async () => departments.map((row) => ({ ...row })),
    getDepartment: async (_ctx, id) => departments.find((row) => String(row.id) === id) ?? null,
    listEmployees: async () => [{ id: 31, name: 'Asha Rao', employee_no: 'E31' }, { id: 32, name: 'Ben Cole' }],
    mergeDepartment: async (_ctx, sourceId, targetId) => {
      calls.merged.push({ sourceId, targetId })
      departments.splice(departments.findIndex((row) => String(row.id) === sourceId), 1)
      return { message: 'merged', data: { employees: 12, job_roles_folded: 2, children: 1 } }
    },
    reorderDepartment: async (_ctx, id, direction) => {
      calls.reordered.push({ id, direction })
      const own = departments.find((row) => String(row.id) === id)!
      const siblings = departments.filter((row) => row.parent_id === own.parent_id).sort((a, b) => a.sort_order! - b.sort_order!)
      const index = siblings.indexOf(own)
      const neighbour = siblings[direction === 'up' ? index - 1 : index + 1]
      if (!neighbour) return { moved: false }
      ;[own.sort_order, neighbour.sort_order] = [neighbour.sort_order, own.sort_order]
      return { moved: true }
    },
    setDepartmentHead: async (_ctx, id, headUserId) => {
      calls.heads.push({ id, headUserId })
      departments.find((row) => String(row.id) === id)!.head_user_id = headUserId === null ? null : Number(headUserId)
      return {}
    },
    record,
    ...overrides,
  }

  return { deps, departments, calls, rows }
}

const page = at(DEPARTMENT_PAGE)
const refusal = 'You do not have permission to perform this action.'

// ---- merge_departments ----------------------------------------------------------------------

test('merge_departments: offered on Department Management only', () => {
  const definition = mergeDepartmentsAction(world().deps)
  assertWriteDefinition(definition)
  assertAppliesTo(definition, [DEPARTMENT_PAGE], ['/dashboard', '/module/lms/learning/learning-catalog'])
})

test('merge_departments: departments are read live and each option says where it sits and how big it is', async () => {
  const options = await mergeDepartmentsAction(world().deps).inputs[0].options!(page)

  assert.deepEqual(options[0], { value: '1', label: 'Finance (top level, 12 employees, 1 sub-department)' })
  assert.deepEqual(options[2], { value: '3', label: 'Payroll (under Finance, 3 employees)' })
})

test('merge_departments: a department cannot be merged into itself', () => {
  const definition = mergeDepartmentsAction(world().deps)

  assert.ok(definition.validate!({ source_id: '1', target_id: '1' }).target_id)
  assert.ok(definition.validate!({ source_id: 'x', target_id: '2' }).source_id)
  assert.deepEqual(definition.validate!({ source_id: '1', target_id: '2' }), {})
})

test('merge_departments: the preview says plainly it is destructive and irreversible and what moves', () => {
  const definition = mergeDepartmentsAction(world().deps)
  const confirming = flow.submit(flow.start(definition), definition, { source_id: '1', target_id: '2' }, page, {
    source_id: 'Finance (top level, 12 employees)', target_id: 'Operations (top level, 30 employees)',
  })

  assert.equal(confirming.phase, 'confirming')
  if (confirming.phase === 'confirming') {
    assert.deepEqual(lineMap(confirming.preview), {
      'Retired (merged away)': 'Finance (top level, 12 employees)',
      'Receives everything': 'Operations (top level, 30 employees)',
    })
    const warning = confirming.preview.warning ?? ''
    assert.match(warning, /DESTRUCTIVE AND IRREVERSIBLE/)
    assert.match(warning, /There is no un-merge/)
    for (const noun of ['employees', 'job roles', 'skills', 'performance', 'tasks', 'LMS content', 'sub-departments']) {
      assert.ok(warning.includes(noun), `warning mentions ${noun}`)
    }
  }
})

test('merge_departments: merges the chosen pair, writes the ledger, and verify confirms the source is gone', async () => {
  const { deps, calls, rows } = world()
  const result = await flow.executeVerified(mergeDepartmentsAction(deps), { source_id: '1', target_id: '2' }, page)

  assert.equal(result.ok, true, result.message)
  assert.deepEqual(calls.merged, [{ sourceId: '1', targetId: '2' }])
  assert.match(result.message, /12 employee\(s\) moved, 2 job role\(s\) folded, 1 sub-department\(s\) re-parented/)
  assert.match(result.message, /Confirmed/)
  assert.equal(rows[0].entry.operation, 'chat_merge_departments')
  assert.equal(rows[0].entry.subject_id, 1)
  assert.equal(result.link?.href, DEPARTMENT_PAGE)
})

test('merge_departments: verify FAILURE - the merged department is still listed - is reported failed', async () => {
  const { deps } = world({ mergeDepartment: async () => ({ data: {} }) })
  const result = await flow.executeVerified(mergeDepartmentsAction(deps), { source_id: '1', target_id: '2' }, page)

  assert.equal(result.ok, false)
  assert.match(result.message, /could not be confirmed.*still listed/)
})

test('merge_departments: the server refusal is shown, no ledger row, and nothing is verified', async () => {
  const { deps, rows } = world({ mergeDepartment: async () => { throw new Error(refusal) } })
  const result = await flow.executeVerified(mergeDepartmentsAction(deps), { source_id: '1', target_id: '2' }, page)

  assert.equal(result.ok, false)
  assert.equal(result.message, refusal)
  assert.equal(rows.length, 0)
})

test('merge_departments: a department that has gone is refused before any write', async () => {
  const { deps, calls } = world()
  const definition = mergeDepartmentsAction(deps)

  assert.equal((await definition.execute({ source_id: '99', target_id: '2' }, page)).ok, false)
  assert.equal((await definition.execute({ source_id: '1', target_id: '99' }, page)).ok, false)
  assert.equal(calls.merged.length, 0)
})

// ---- reorder_department ---------------------------------------------------------------------

test('reorder_department: offered on Department Management only', () => {
  const definition = reorderDepartmentAction(world().deps)
  assertWriteDefinition(definition)
  assertAppliesTo(definition, [DEPARTMENT_PAGE], ['/dashboard'])
})

test('reorder_department: options show each department\'s live position among its siblings', async () => {
  const options = await reorderDepartmentAction(world().deps).inputs[0].options!(page)

  assert.deepEqual(options.map((option) => option.label), [
    'Finance - position 1 of 3 at the top level',
    'Operations - position 2 of 3 at the top level',
    'Payroll - position 1 of 1 under Finance',
    'Treasury - position 3 of 3 at the top level',
  ])
})

test('reorder_department: direction is validated and the preview states the move', () => {
  const definition = reorderDepartmentAction(world().deps)

  assert.ok(definition.validate!({ department_id: '2', direction: 'sideways' }).direction)
  const confirming = flow.submit(flow.start(definition), definition, { department_id: '2', direction: 'down' }, page, { department_id: 'Operations - position 2 of 3 at the top level' })
  assert.equal(confirming.phase, 'confirming')
  if (confirming.phase === 'confirming') {
    assert.equal(confirming.preview.title, 'Move this department down?')
    assert.equal(lineMap(confirming.preview).Move, 'Down one place')
  }
})

test('reorder_department: moves it and verify confirms the order is as requested', async () => {
  const { deps, calls, rows, departments } = world()
  const result = await flow.executeVerified(reorderDepartmentAction(deps), { department_id: '2', direction: 'up' }, page)

  assert.equal(result.ok, true, result.message)
  assert.deepEqual(calls.reordered, [{ id: '2', direction: 'up' }])
  assert.equal(departments.find((row) => row.id === 2)!.sort_order, 1)
  assert.match(result.message, /Confirmed: it is now position 1 of 3/)
  assert.equal(rows[0].entry.operation, 'chat_reorder_department')
})

test('reorder_department: already first is reported honestly, writes no ledger row, and is not a failure', async () => {
  const { deps, rows } = world()
  const result = await flow.executeVerified(reorderDepartmentAction(deps), { department_id: '1', direction: 'up' }, page)

  assert.equal(result.ok, true)
  assert.match(result.message, /already first/)
  assert.equal(rows.length, 0)
})

test('reorder_department: verify FAILURE - the order did not change - is reported failed', async () => {
  const { deps } = world({ reorderDepartment: async () => ({ moved: true }) })
  const result = await flow.executeVerified(reorderDepartmentAction(deps), { department_id: '2', direction: 'down' }, page)

  assert.equal(result.ok, false)
  assert.match(result.message, /could not be confirmed.*same place/)
})

test('reorder_department: the server refusal is shown and no ledger row is written', async () => {
  const { deps, rows } = world({ reorderDepartment: async () => { throw new Error(refusal) } })
  const result = await flow.executeVerified(reorderDepartmentAction(deps), { department_id: '2', direction: 'up' }, page)

  assert.equal(result.ok, false)
  assert.equal(result.message, refusal)
  assert.equal(rows.length, 0)
})

// ---- change_department_head -----------------------------------------------------------------

test('change_department_head: offered on Department Management only', () => {
  const definition = changeDepartmentHeadAction(world().deps)
  assertWriteDefinition(definition)
  assertAppliesTo(definition, [DEPARTMENT_PAGE], ['/dashboard'])
})

test('change_department_head: departments (with the current head) and employees are read live; clearing is offered', async () => {
  const definition = changeDepartmentHeadAction(world().deps)
  const departments = await definition.inputs[0].options!(page)
  const employees = await definition.inputs[1].options!(page)

  assert.equal(departments.find((option) => option.value === '2')!.label, 'Operations (top level, 30 employees) - head: Asha Rao')
  assert.equal(departments.find((option) => option.value === '1')!.label, 'Finance (top level, 12 employees, 1 sub-department) - no head')
  assert.deepEqual(employees, [
    { value: '0', label: 'No head (clear it)' },
    { value: '31', label: 'Asha Rao (E31)' },
    { value: '32', label: 'Ben Cole' },
  ])
})

test('change_department_head: the preview names the department and the new head, or says it clears', () => {
  const definition = changeDepartmentHeadAction(world().deps)
  const change = flow.submit(flow.start(definition), definition, { department_id: '1', head_user_id: '32' }, page, { department_id: 'Finance', head_user_id: 'Ben Cole' })
  const clear = flow.submit(flow.start(definition), definition, { department_id: '2', head_user_id: '0' }, page, { department_id: 'Operations' })

  assert.equal(change.phase, 'confirming')
  assert.equal(clear.phase, 'confirming')
  if (change.phase === 'confirming') assert.equal(lineMap(change.preview)['New head'], 'Ben Cole')
  if (clear.phase === 'confirming') {
    assert.equal(clear.preview.title, 'Clear this department\'s head?')
    assert.equal(lineMap(clear.preview)['New head'], 'No head')
  }
})

test('change_department_head: sets the head, writes the ledger, and verify confirms the new person', async () => {
  const { deps, calls, rows } = world()
  const result = await flow.executeVerified(changeDepartmentHeadAction(deps), { department_id: '1', head_user_id: '32' }, page)

  assert.equal(result.ok, true, result.message)
  assert.deepEqual(calls.heads, [{ id: '1', headUserId: '32' }])
  assert.match(result.message, /Ben Cole is now the head of "Finance"/)
  assert.match(result.message, /Confirmed: Ben Cole is recorded as the head/)
  assert.equal(rows[0].entry.operation, 'chat_change_department_head')
})

test('change_department_head: clearing sends null and verify confirms there is no head', async () => {
  const { deps, calls } = world()
  const result = await flow.executeVerified(changeDepartmentHeadAction(deps), { department_id: '2', head_user_id: '0' }, page)

  assert.equal(result.ok, true, result.message)
  assert.deepEqual(calls.heads, [{ id: '2', headUserId: null }])
  assert.match(result.message, /has no head/)
})

test('change_department_head: verify FAILURE - the recorded head is someone else - is reported failed', async () => {
  const { deps } = world({ setDepartmentHead: async () => ({}) })
  const result = await flow.executeVerified(changeDepartmentHeadAction(deps), { department_id: '1', head_user_id: '32' }, page)

  assert.equal(result.ok, false)
  assert.match(result.message, /could not be confirmed.*not Ben Cole/)
})

test('change_department_head: the server refusal is shown and no ledger row is written', async () => {
  const { deps, rows } = world({ setDepartmentHead: async () => { throw new Error(refusal) } })
  const result = await flow.executeVerified(changeDepartmentHeadAction(deps), { department_id: '1', head_user_id: '32' }, page)

  assert.equal(result.ok, false)
  assert.equal(result.message, refusal)
  assert.equal(rows.length, 0)
})

test('change_department_head: an employee or department that has gone is refused before any write', async () => {
  const { deps, calls } = world()
  const definition = changeDepartmentHeadAction(deps)

  assert.equal((await definition.execute({ department_id: '99', head_user_id: '32' }, page)).ok, false)
  assert.equal((await definition.execute({ department_id: '1', head_user_id: '99' }, page)).ok, false)
  assert.equal(calls.heads.length, 0)
})
