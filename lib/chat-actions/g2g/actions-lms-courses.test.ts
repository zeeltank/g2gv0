import assert from 'node:assert/strict'
import { test } from 'node:test'

import * as flow from '../flow'
import {
  assignCourseAction,
  deleteCourseAction,
  editCourseAction,
  LEARNING_CATALOG_PAGE,
  LMS_ASSIGNMENTS_PAGE,
  sameName,
  type AssignmentLine,
  type CourseDetail,
  type LmsCourseActionDeps,
} from './actions-lms-courses'
import { assertAppliesTo, assertWriteDefinition, at, ledger, lineMap } from './test-kit'

/** An in-memory catalogue + assignment list the fake deps read and write, so verify has something real to read. */
function world(overrides: Partial<LmsCourseActionDeps> = {}) {
  const { rows, record } = ledger()
  const courses: CourseDetail[] = [
    { id: 11, display_name: 'Fire Safety', status: 1, learners: 4, standard_id: 3, subject_category: 'Safety', short_name: 'FS' },
    { id: 12, display_name: 'Old Course', status: 0, learners: 0, standard_id: 3, subject_category: null, short_name: null },
  ]
  const assignments: AssignmentLine[] = []
  const calls = { updated: [] as unknown[], deleted: [] as number[], assigned: [] as unknown[] }

  const deps: LmsCourseActionDeps = {
    listCourses: async (_ctx, filters = {}) =>
      courses
        .filter((course) => (filters.activeOnly ? course.status === 1 : true))
        .filter((course) => (filters.search ? (course.display_name ?? '').includes(filters.search) : true))
        .map(({ id, display_name, status, learners }) => ({ id, display_name, status, learners })),
    getCourse: async (_ctx, id) => {
      const course = courses.find((row) => row.id === id)
      if (!course) throw new Error('Course not found')
      return { ...course }
    },
    listDepartments: async () => [{ id: 3, department: 'Operations' }, { id: 4, department: 'Finance' }],
    updateCourse: async (_ctx, id, body) => {
      calls.updated.push({ id, ...body })
      const course = courses.find((row) => row.id === id)!
      Object.assign(course, body)
      return {}
    },
    deleteCourse: async (_ctx, id) => {
      calls.deleted.push(id)
      courses.splice(courses.findIndex((row) => row.id === id), 1)
      return {}
    },
    listLearners: async () => [{ id: 21, name: 'Asha Rao', employee_no: 'E21' }, { id: 22, name: 'Ben Cole' }],
    listAssignments: async () => [...assignments],
    createAssignments: async (_ctx, payload) => {
      calls.assigned.push(payload)
      assignments.push({ learner_name: 'Asha Rao', course_name: 'Fire Safety', assignment_type: payload.assignment_type, due_date: payload.due_date ?? null })
      return { assigned: 1 }
    },
    record,
    ...overrides,
  }

  return { deps, courses, assignments, calls, rows }
}

// ---- shared ---------------------------------------------------------------------------------

test('sameName ignores a middle name but not a different person', () => {
  assert.equal(sameName('Asha Rao', 'Asha Kumari Rao'), true)
  assert.equal(sameName('asha rao', 'ASHA RAO'), true)
  assert.equal(sameName('Asha Rao', 'Ben Cole'), false)
  assert.equal(sameName('', 'Ben Cole'), false)
})

// ---- assign_course --------------------------------------------------------------------------

test('assign_course: offered on Assignments only, to a menu-resolved page', () => {
  const definition = assignCourseAction(world().deps)
  assertWriteDefinition(definition)
  assertAppliesTo(definition, [LMS_ASSIGNMENTS_PAGE], ['/dashboard', LEARNING_CATALOG_PAGE])
})

test('assign_course: courses and employees are read live; only active courses are offered', async () => {
  const definition = assignCourseAction(world().deps)
  const courses = await definition.inputs.find((input) => input.key === 'course_id')!.options!(at(LMS_ASSIGNMENTS_PAGE))
  const people = await definition.inputs.find((input) => input.key === 'user_id')!.options!(at(LMS_ASSIGNMENTS_PAGE))

  assert.deepEqual(courses, [{ value: '11', label: 'Fire Safety' }])
  assert.deepEqual(people, [{ value: '21', label: 'Asha Rao (E21)' }, { value: '22', label: 'Ben Cole' }])
})

test('assign_course: validation rejects bad ids, type and dates', () => {
  const definition = assignCourseAction(world().deps)
  const ok = { course_id: '11', user_id: '21', assignment_type: 'Mandatory', due_date: '' }

  assert.deepEqual(definition.validate!(ok), {})
  assert.ok(definition.validate!({ ...ok, course_id: 'x' }).course_id)
  assert.ok(definition.validate!({ ...ok, user_id: 'x' }).user_id)
  assert.ok(definition.validate!({ ...ok, assignment_type: 'Whatever' }).assignment_type)
  assert.ok(definition.validate!({ ...ok, due_date: '2030-02-31' }).due_date)
  assert.ok(definition.validate!({ ...ok, due_date: '2001-01-01' }).due_date, 'a past due date is refused')
  assert.deepEqual(definition.validate!({ ...ok, due_date: '2999-12-31' }), {})
})

test('assign_course: preview says who gets what; required fields block it', () => {
  const definition = assignCourseAction(world().deps)
  const blocked = flow.submit(flow.start(definition), definition, { course_id: '', user_id: '', assignment_type: '' }, at(LMS_ASSIGNMENTS_PAGE))
  assert.equal(blocked.phase, 'collecting')

  const values = { course_id: '11', user_id: '21', assignment_type: 'Mandatory', due_date: '2999-12-31' }
  const confirming = flow.submit(flow.start(definition), definition, values, at(LMS_ASSIGNMENTS_PAGE), { course_id: 'Fire Safety', user_id: 'Asha Rao (E21)' })
  assert.equal(confirming.phase, 'confirming')
  if (confirming.phase === 'confirming') {
    assert.deepEqual(lineMap(confirming.preview), { Course: 'Fire Safety', Employee: 'Asha Rao (E21)', Type: 'Mandatory', 'Due date': '2999-12-31' })
  }
})

test('assign_course: executes exactly the previewed payload, writes the ledger, and verify confirms the assignment', async () => {
  const { deps, calls, rows } = world()
  const definition = assignCourseAction(deps)
  const result = await flow.executeVerified(definition, { course_id: '11', user_id: '21', assignment_type: 'Mandatory', due_date: '2999-12-31' }, at(LMS_ASSIGNMENTS_PAGE))

  assert.equal(result.ok, true, result.message)
  assert.deepEqual(calls.assigned, [{ user_ids: [21], course_id: 11, assignment_type: 'Mandatory', due_date: '2999-12-31' }])
  assert.equal(rows[0].moduleKey, 'lms')
  assert.equal(rows[0].entry.operation, 'chat_assign_course')
  assert.match(result.message, /Confirmed/)
  assert.equal(result.link?.href, LMS_ASSIGNMENTS_PAGE)
})

test('assign_course: verify FAILURE - the write returned but the assignment is not in the list - is reported failed', async () => {
  const { deps } = world({ createAssignments: async () => ({ assigned: 1 }) })
  const result = await flow.executeVerified(assignCourseAction(deps), { course_id: '11', user_id: '21', assignment_type: 'Optional' }, at(LMS_ASSIGNMENTS_PAGE))

  assert.equal(result.ok, false)
  assert.match(result.message, /could not be confirmed/)
})

test('assign_course: an assignment that was already there is not mistaken for the new one', async () => {
  const { deps, assignments } = world({ createAssignments: async () => ({ assigned: 1 }) })
  assignments.push({ learner_name: 'Asha Rao', course_name: 'Fire Safety', assignment_type: 'Mandatory', due_date: null })

  const result = await flow.executeVerified(assignCourseAction(deps), { course_id: '11', user_id: '21', assignment_type: 'Mandatory' }, at(LMS_ASSIGNMENTS_PAGE))

  assert.equal(result.ok, false, 'count did not rise, so the write is unconfirmed')
})

test('assign_course: the server refusal is the result and no ledger row is written', async () => {
  const { deps, rows } = world({ createAssignments: async () => { throw new Error('Your role does not have access to this screen.') } })
  const result = await flow.executeVerified(assignCourseAction(deps), { course_id: '11', user_id: '21', assignment_type: 'Mandatory' }, at(LMS_ASSIGNMENTS_PAGE))

  assert.equal(result.ok, false)
  assert.equal(result.message, 'Your role does not have access to this screen.')
  assert.equal(rows.length, 0)
})

test('assign_course: a course or employee that has gone is refused before anything is written', async () => {
  const { deps, calls } = world()
  const definition = assignCourseAction(deps)

  assert.equal((await definition.execute({ course_id: '99', user_id: '21', assignment_type: 'Mandatory' }, at(LMS_ASSIGNMENTS_PAGE))).ok, false)
  assert.equal((await definition.execute({ course_id: '11', user_id: '99', assignment_type: 'Mandatory' }, at(LMS_ASSIGNMENTS_PAGE))).ok, false)
  assert.equal(calls.assigned.length, 0)
})

// ---- edit_course ----------------------------------------------------------------------------

test('edit_course: offered on the Learning Catalog only', () => {
  const definition = editCourseAction(world().deps)
  assertWriteDefinition(definition)
  assertAppliesTo(definition, [LEARNING_CATALOG_PAGE], ['/dashboard', LMS_ASSIGNMENTS_PAGE])
})

test('edit_course: courses (incl. inactive) and departments are read live', async () => {
  const definition = editCourseAction(world().deps)
  const courses = await definition.inputs.find((input) => input.key === 'course_id')!.options!(at(LEARNING_CATALOG_PAGE))
  const departments = await definition.inputs.find((input) => input.key === 'standard_id')!.options!(at(LEARNING_CATALOG_PAGE))

  assert.deepEqual(courses, [{ value: '11', label: 'Fire Safety' }, { value: '12', label: 'Old Course (inactive)' }])
  assert.deepEqual(departments, [{ value: '', label: 'Keep as is' }, { value: '3', label: 'Operations' }, { value: '4', label: 'Finance' }])
})

test('edit_course: a change is required and values are checked', () => {
  const definition = editCourseAction(world().deps)
  const none = { course_id: '11', display_name: '', status: '', subject_category: '', short_name: '', standard_id: '' }

  assert.ok(definition.validate!(none).display_name, 'no change at all is refused')
  assert.deepEqual(definition.validate!({ ...none, display_name: 'Fire Safety 2' }), {})
  assert.ok(definition.validate!({ ...none, status: '7' }).status)
  assert.ok(definition.validate!({ ...none, standard_id: 'x', display_name: 'a' }).standard_id)
})

test('edit_course: preview lists only the fields that will change', () => {
  const definition = editCourseAction(world().deps)
  const values = { course_id: '11', display_name: 'Fire Safety 2', status: '0', subject_category: '', short_name: '', standard_id: '4' }
  const confirming = flow.submit(flow.start(definition), definition, values, at(LEARNING_CATALOG_PAGE), { course_id: 'Fire Safety', standard_id: 'Finance' })

  assert.equal(confirming.phase, 'confirming')
  if (confirming.phase === 'confirming') {
    assert.deepEqual(lineMap(confirming.preview), {
      Course: 'Fire Safety', 'Name becomes': 'Fire Safety 2', 'Status becomes': 'Inactive', 'Department becomes': 'Finance',
    })
  }
})

test('edit_course: sends the required fields from the current course plus only the changes; verify reads them back', async () => {
  const { deps, calls, rows } = world()
  const result = await flow.executeVerified(
    editCourseAction(deps),
    { course_id: '11', display_name: 'Fire Safety 2', status: '', subject_category: '', short_name: 'FS2', standard_id: '' },
    at(LEARNING_CATALOG_PAGE),
  )

  assert.equal(result.ok, true, result.message)
  assert.deepEqual(calls.updated, [{ id: 11, display_name: 'Fire Safety 2', standard_id: 3, status: 1, short_name: 'FS2' }])
  assert.equal(rows[0].entry.operation, 'chat_edit_course')
  assert.match(result.message, /Confirmed/)
})

test('edit_course: verify FAILURE - the course still shows the old values - is reported failed', async () => {
  const { deps } = world({ updateCourse: async () => ({}) })
  const result = await flow.executeVerified(
    editCourseAction(deps),
    { course_id: '11', display_name: 'Renamed', status: '', subject_category: '', short_name: '', standard_id: '' },
    at(LEARNING_CATALOG_PAGE),
  )

  assert.equal(result.ok, false)
  assert.match(result.message, /could not be confirmed.*name/)
})

test('edit_course: the server refusal is shown and no ledger row is written', async () => {
  const { deps, rows } = world({ updateCourse: async () => { throw new Error('You do not have permission to perform this action.') } })
  const result = await flow.executeVerified(
    editCourseAction(deps),
    { course_id: '11', display_name: 'Renamed', status: '', subject_category: '', short_name: '', standard_id: '' },
    at(LEARNING_CATALOG_PAGE),
  )

  assert.equal(result.ok, false)
  assert.equal(result.message, 'You do not have permission to perform this action.')
  assert.equal(rows.length, 0)
})

// ---- delete_course --------------------------------------------------------------------------

test('delete_course: offered on the Learning Catalog only', () => {
  const definition = deleteCourseAction(world().deps)
  assertWriteDefinition(definition)
  assertAppliesTo(definition, [LEARNING_CATALOG_PAGE], ['/dashboard', LMS_ASSIGNMENTS_PAGE])
})

test('delete_course: the options carry the learner count, read live', async () => {
  const options = await deleteCourseAction(world().deps).inputs[0].options!(at(LEARNING_CATALOG_PAGE))

  assert.deepEqual(options, [
    { value: '11', label: 'Fire Safety - 4 learners' },
    { value: '12', label: 'Old Course - 0 learners' },
  ])
})

test('delete_course: the preview says plainly that it is destructive and irreversible and who is affected', () => {
  const definition = deleteCourseAction(world().deps)
  const confirming = flow.submit(flow.start(definition), definition, { course_id: '11' }, at(LEARNING_CATALOG_PAGE), { course_id: 'Fire Safety - 4 learners' })

  assert.equal(confirming.phase, 'confirming')
  if (confirming.phase === 'confirming') {
    assert.equal(confirming.preview.title, 'Delete this course?')
    assert.equal(lineMap(confirming.preview)['Course (learners enrolled)'], 'Fire Safety - 4 learners')
    assert.match(confirming.preview.warning ?? '', /DESTRUCTIVE AND IRREVERSIBLE/)
    assert.match(confirming.preview.warning ?? '', /learners enrolled .* lose access/)
  }
})

test('delete_course: deletes the chosen id, writes the ledger, and verify confirms it is gone', async () => {
  const { deps, calls, rows, courses } = world()
  const result = await flow.executeVerified(deleteCourseAction(deps), { course_id: '11' }, at(LEARNING_CATALOG_PAGE))

  assert.equal(result.ok, true, result.message)
  assert.deepEqual(calls.deleted, [11])
  assert.equal(courses.some((course) => course.id === 11), false)
  assert.equal(rows[0].entry.operation, 'chat_delete_course')
  assert.match(result.message, /Confirmed/)
})

test('delete_course: verify FAILURE - the course is still in the catalogue - is reported failed', async () => {
  const { deps } = world({ deleteCourse: async () => ({}) })
  const result = await flow.executeVerified(deleteCourseAction(deps), { course_id: '11' }, at(LEARNING_CATALOG_PAGE))

  assert.equal(result.ok, false)
  assert.match(result.message, /could not be confirmed.*still in the catalogue/)
})

test('delete_course: the server refusal is shown, no ledger row, and nothing is verified', async () => {
  let listed = 0
  const { deps, rows } = world({ deleteCourse: async () => { throw new Error('You do not have permission to perform this action.') } })
  const counting = { ...deps, listCourses: async (...args: Parameters<typeof deps.listCourses>) => { listed += 1; return deps.listCourses(...args) } }
  const result = await flow.executeVerified(deleteCourseAction(counting), { course_id: '11' }, at(LEARNING_CATALOG_PAGE))

  assert.equal(result.ok, false)
  assert.equal(result.message, 'You do not have permission to perform this action.')
  assert.equal(rows.length, 0)
  assert.equal(listed, 0, 'verify must not run after a refusal')
})

test('delete_course: a course that does not exist is reported, not deleted', async () => {
  const { deps, calls } = world()
  const result = await deleteCourseAction(deps).execute({ course_id: '99' }, at(LEARNING_CATALOG_PAGE))

  assert.equal(result.ok, false)
  assert.equal(result.message, 'Course not found')
  assert.equal(calls.deleted.length, 0)
})
