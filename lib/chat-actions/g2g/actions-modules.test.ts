import assert from 'node:assert/strict'
import { test } from 'node:test'

import * as flow from '../flow'
import { ActionRegistry } from '../registry'
import type { ActionContext, ChatActionDefinition } from '../types'
import type { G2gActionApp } from './actions'
import { createCompetencyAction, COMPETENCY_LIBRARY_PAGE } from './actions-capability'
import { applyLeaveAction, decideLeaveAction, LEAVE_REQUESTS_PAGE, type LeaveActionDeps } from './actions-hrit'
import {
  LEARNING_CATALOG_PAGE,
  LMS_ASSIGNMENTS_PAGE,
  requestEnrollmentAction,
  reviewEnrollmentRequestAction,
  type LmsActionDeps,
} from './actions-lms'
import { createJobPostingAction, RECRUITMENT_PAGE, type TalentActionDeps } from './actions-talent'
import {
  addBacklogItemAction,
  MY_TASKS_PAGE,
  reviewTaskAction,
  TASK_DASHBOARD_PAGE,
  TASK_PROJECTS_PAGE,
  updateMyTaskStatusAction,
  type TaskActionDeps,
} from './actions-task'
import { isIsoDate, onPage } from './shared'

const laravel = {
  token: 'tok', subInstituteId: '1', syear: '2026', userId: '7', organizationId: '1', orgType: 'x', profileId: '1',
}

const at = (pathname: string, menuId: number | null = 13): ActionContext<G2gActionApp> => ({
  pathname, menuId, moduleKey: null, snapshot: null, app: { laravel },
})

type Ledger = Array<{ moduleKey: string; entry: Record<string, unknown> }>

function ledger() {
  const rows: Ledger = []
  return { rows, record: async (moduleKey: string, entry: Record<string, unknown>) => { rows.push({ moduleKey, entry }); return true } }
}

/** A definition must be offered on its page(s), and only to a page resolved from the user's own menu. */
function assertAppliesTo(definition: ChatActionDefinition<G2gActionApp>, pages: string[], elsewhere: string[]) {
  for (const page of pages) {
    assert.equal(definition.appliesTo(at(page)), true, `${definition.key} on ${page}`)
    assert.equal(definition.appliesTo(at(`${page}/42`)), true, `${definition.key} on ${page}/42`)
    assert.equal(definition.appliesTo(at(page, null)), false, `${definition.key} with menuId null`)
    assert.equal(definition.appliesTo(at(`${page}-old`)), false, `${definition.key} not on a sibling prefix`)
  }
  for (const page of elsewhere) assert.equal(definition.appliesTo(at(page)), false, `${definition.key} not on ${page}`)
}

function assertWriteDefinition(definition: ChatActionDefinition<G2gActionApp>) {
  assert.equal(definition.risk, 'write')
  assert.ok(definition.phrases.length > 0)
  assert.ok(definition.phrases.every((phrase) => phrase === phrase.toLowerCase()))
}

// ---- shared helpers ------------------------------------------------------------------------

test('onPage is segment-aware and needs a menu-resolved page', () => {
  assert.equal(onPage(at('/a/b'), '/a/b'), true)
  assert.equal(onPage(at('/a/b/c'), '/a/b'), true)
  assert.equal(onPage(at('/a/bc'), '/a/b'), false)
  assert.equal(onPage(at('/a/b', null), '/a/b'), false)
})

test('isIsoDate accepts real days only', () => {
  assert.equal(isIsoDate('2026-02-28'), true)
  assert.equal(isIsoDate('2026-02-31'), false)
  assert.equal(isIsoDate('26-02-28'), false)
  assert.equal(isIsoDate('2026-2-8'), false)
})

// ---- hrit_management ----------------------------------------------------------------------

function leaveDeps(overrides: Partial<LeaveActionDeps> = {}) {
  const calls = { applied: [] as unknown[], decided: [] as unknown[] }
  const { rows, record } = ledger()
  const deps: LeaveActionDeps = {
    listLeaveTypes: async () => [{ value: '4', label: 'Casual' }],
    listDecisionStatuses: async () => [
      { value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' },
      { value: 'rejected', label: 'Rejected' }, { value: 'sent_back', label: 'Sent Back' },
    ],
    listAwaitingMe: async () => [
      { id: 9, employee_name: 'Asha Rao', leave_type: 'Casual', from_date: '2026-11-02', to_date: '2026-11-03', days: 2, reason: 'x' },
    ],
    applyLeave: async (_ctx, payload) => { calls.applied.push(payload); return { data: { id: 55 } } },
    decideRequest: async (_ctx, id, payload) => { calls.decided.push({ id, ...payload }); return {} },
    record,
    ...overrides,
  }
  return { deps, calls, rows }
}

test('apply_leave: offered on Leave Requests only', () => {
  const definition = applyLeaveAction(leaveDeps().deps)
  assertWriteDefinition(definition)
  assertAppliesTo(definition, [LEAVE_REQUESTS_PAGE], ['/dashboard', '/module/hrit-solutions/leave-management/leave-reports'])
})

test('apply_leave: leave types are read live; dates validated', async () => {
  const { deps } = leaveDeps()
  const definition = applyLeaveAction(deps)
  const typeInput = definition.inputs.find((input) => input.key === 'leave_type_id')

  assert.deepEqual(await typeInput?.options?.(at(LEAVE_REQUESTS_PAGE)), [{ value: '4', label: 'Casual' }])

  assert.ok(definition.validate?.({ from_date: '2026-13-01', to_date: '', comment: 'x', leave_type_id: '4' }).from_date)
  assert.ok(definition.validate?.({ from_date: '2026-11-05', to_date: '2026-11-01', comment: 'x', leave_type_id: '4' }).to_date)
  assert.deepEqual(definition.validate?.({ from_date: '2026-11-01', to_date: '', comment: 'x', leave_type_id: '4' }), {})
})

test('apply_leave: required fields block the preview; preview shows what is sent', () => {
  const definition = applyLeaveAction(leaveDeps().deps)
  const blocked = flow.submit(flow.start(definition), definition, { leave_type_id: '', from_date: '', comment: '' }, at(LEAVE_REQUESTS_PAGE))
  assert.equal(blocked.phase, 'collecting')

  const values = { leave_type_id: '4', from_date: '2026-11-02', to_date: '', comment: 'Family event' }
  const confirming = flow.submit(flow.start(definition), definition, values, at(LEAVE_REQUESTS_PAGE), { leave_type_id: 'Casual' })
  assert.equal(confirming.phase, 'confirming')
  if (confirming.phase === 'confirming') {
    const byLabel = Object.fromEntries(confirming.preview.lines.map((line) => [line.label, line.value]))
    assert.equal(byLabel['Leave type'], 'Casual')
    assert.equal(byLabel.From, '2026-11-02')
    assert.equal(byLabel.To, '2026-11-02', 'a blank end date is a one-day leave and the preview says so')
    assert.equal(byLabel.Reason, 'Family event')
  }
})

test('apply_leave: success sends exactly the previewed values and writes the hrit ledger row', async () => {
  const { deps, calls, rows } = leaveDeps()
  const result = await applyLeaveAction(deps).execute(
    { leave_type_id: '4', from_date: '2026-11-02', to_date: '', comment: 'Family event' }, at(LEAVE_REQUESTS_PAGE),
  )

  assert.equal(result.ok, true)
  assert.deepEqual(calls.applied, [{ leaveTypeId: '4', dayType: 'full', fromDate: '2026-11-02', toDate: '2026-11-02', comment: 'Family event' }])
  assert.equal(rows[0].moduleKey, 'hrit_management')
  assert.equal(rows[0].entry.operation, 'chat_apply_leave')
  assert.equal(rows[0].entry.subject_id, 55)
})

test('apply_leave: the server refusal is the result and no ledger row is written', async () => {
  const { deps, rows } = leaveDeps({ applyLeave: async () => { throw new Error('Insufficient leave balance.') } })
  const result = await applyLeaveAction(deps).execute(
    { leave_type_id: '4', from_date: '2026-11-02', to_date: '2026-11-03', comment: 'x' }, at(LEAVE_REQUESTS_PAGE),
  )

  assert.deepEqual(result, { ok: false, message: 'Insufficient leave balance.' })
  assert.equal(rows.length, 0)
})

test('apply_leave: a ledger failure does not turn a filed leave into a failure', async () => {
  const { deps } = leaveDeps({ record: async () => { throw new Error('ledger down') } })
  const result = await applyLeaveAction(deps).execute(
    { leave_type_id: '4', from_date: '2026-11-02', to_date: '', comment: 'x' }, at(LEAVE_REQUESTS_PAGE),
  )

  assert.equal(result.ok, true)
})

test('decide_leave: applies-to, live options limited to requests awaiting me and approve/reject', async () => {
  const { deps } = leaveDeps()
  const definition = decideLeaveAction(deps)
  assertWriteDefinition(definition)
  assertAppliesTo(definition, [LEAVE_REQUESTS_PAGE], ['/dashboard'])

  const requests = await definition.inputs.find((input) => input.key === 'request_id')?.options?.(at(LEAVE_REQUESTS_PAGE))
  assert.deepEqual(requests, [{ value: '9', label: 'Asha Rao - Casual, 2026-11-02 to 2026-11-03 (2 days)' }])

  const decisions = await definition.inputs.find((input) => input.key === 'decision')?.options?.(at(LEAVE_REQUESTS_PAGE))
  assert.deepEqual(decisions?.map((option) => option.value), ['approved', 'rejected'])
})

test('decide_leave: validation, preview, success and refusal', async () => {
  const { deps, calls, rows } = leaveDeps()
  const definition = decideLeaveAction(deps)

  assert.ok(definition.validate?.({ request_id: 'abc', decision: 'approved' }).request_id)
  assert.ok(definition.validate?.({ request_id: '9', decision: 'cancelled' }).decision)

  const preview = definition.preview({ request_id: '9', decision: 'rejected', remark: 'Peak week' }, at(LEAVE_REQUESTS_PAGE), { request_id: 'Asha Rao - Casual' })
  assert.match(preview.title, /Reject/)
  assert.equal(preview.lines.find((line) => line.label === 'Request')?.value, 'Asha Rao - Casual')

  const ok = await definition.execute({ request_id: '9', decision: 'rejected', remark: 'Peak week' }, at(LEAVE_REQUESTS_PAGE))
  assert.equal(ok.ok, true)
  assert.deepEqual(calls.decided, [{ id: 9, status: 'rejected', hrRemarks: 'Peak week' }])
  assert.equal(rows[0].moduleKey, 'hrit_management')

  const denied = await decideLeaveAction(leaveDeps({
    decideRequest: async () => { throw new Error('You cannot decide your own leave request. Ask your approver.') },
  }).deps).execute({ request_id: '9', decision: 'approved', remark: '' }, at(LEAVE_REQUESTS_PAGE))
  assert.deepEqual(denied, { ok: false, message: 'You cannot decide your own leave request. Ask your approver.' })
})

// ---- task_management ----------------------------------------------------------------------

function taskDeps(overrides: Partial<TaskActionDeps> = {}) {
  const calls = { status: [] as unknown[], backlog: [] as unknown[], decisions: [] as unknown[] }
  const { rows, record } = ledger()
  const deps: TaskActionDeps = {
    listStatuses: async () => [{ value: 'IN-PROGRESS', label: 'IN-PROGRESS' }, { value: 'Awaiting Client', label: 'Awaiting Client' }],
    listMyOpenTasks: async () => [{ id: '31', title: 'Write report', status: 'PENDING' }],
    updateMyTaskStatus: async (_ctx, id, status, remarks) => { calls.status.push({ id, status, remarks }); return {} },
    listBacklogOptions: async () => ({
      types: [{ value: 'NEW', label: 'NEW' }, { value: 'FIX', label: 'FIX' }],
      priorities: [{ value: 'High', label: 'High' }],
    }),
    createBacklogItem: async (_ctx, payload) => { calls.backlog.push(payload); return { data: { id: '77' } } },
    listTasksToReview: async () => [{ id: '40', title: 'Close books', status: 'COMPLETED', assignee: 'Ravi' }],
    decideTask: async (_ctx, id, decision, remarks) => { calls.decisions.push({ id, decision, remarks }); return {} },
    record,
    ...overrides,
  }
  return { deps, calls, rows }
}

test('add_backlog_item: applies-to dashboard and projects, options live, success writes ledger', async () => {
  const { deps, calls, rows } = taskDeps()
  const definition = addBacklogItemAction(deps)
  assertWriteDefinition(definition)
  assertAppliesTo(definition, [TASK_DASHBOARD_PAGE, TASK_PROJECTS_PAGE], [MY_TASKS_PAGE, '/dashboard'])

  const types = await definition.inputs.find((input) => input.key === 'type')?.options?.(at(TASK_DASHBOARD_PAGE))
  assert.deepEqual(types?.map((option) => option.value), ['', 'NEW', 'FIX'])

  const blocked = flow.submit(flow.start(definition), definition, { title: '  ' }, at(TASK_DASHBOARD_PAGE))
  assert.equal(blocked.phase, 'collecting')

  const result = await definition.execute({ title: 'Post update', notes: '', type: 'NEW', priority: '' }, at(TASK_DASHBOARD_PAGE))
  assert.equal(result.ok, true)
  assert.deepEqual(calls.backlog, [{ title: 'Post update', notes: undefined, type: 'NEW', priority: undefined }])
  assert.equal(rows[0].moduleKey, 'task_management')
  assert.equal(rows[0].entry.subject_id, 77)
})

test('add_backlog_item: refusal is shown', async () => {
  const definition = addBacklogItemAction(taskDeps({ createBacklogItem: async () => { throw new Error('Please check the highlighted fields.') } }).deps)
  const result = await definition.execute({ title: 'x', notes: '', type: '', priority: '' }, at(TASK_DASHBOARD_PAGE))

  assert.deepEqual(result, { ok: false, message: 'Please check the highlighted fields.' })
})

test('update_my_task_status: applies-to My Tasks, live task and status options, success and refusal', async () => {
  const { deps, calls, rows } = taskDeps()
  const definition = updateMyTaskStatusAction(deps)
  assertWriteDefinition(definition)
  assertAppliesTo(definition, [MY_TASKS_PAGE], [TASK_DASHBOARD_PAGE])

  const tasks = await definition.inputs.find((input) => input.key === 'task_id')?.options?.(at(MY_TASKS_PAGE))
  assert.deepEqual(tasks, [{ value: '31', label: 'Write report (PENDING)' }])
  const statuses = await definition.inputs.find((input) => input.key === 'status')?.options?.(at(MY_TASKS_PAGE))
  assert.equal(statuses?.length, 2)

  const blocked = flow.submit(flow.start(definition), definition, { task_id: '31', status: 'IN-PROGRESS', remarks: '' }, at(MY_TASKS_PAGE))
  assert.equal(blocked.phase, 'collecting', 'a remark is required, as the endpoint requires')

  const result = await definition.execute({ task_id: '31', status: 'IN-PROGRESS', remarks: 'Started' }, at(MY_TASKS_PAGE))
  assert.equal(result.ok, true)
  assert.deepEqual(calls.status, [{ id: '31', status: 'IN-PROGRESS', remarks: 'Started' }])
  assert.equal(rows[0].moduleKey, 'task_my_tasks')

  const refused = await updateMyTaskStatusAction(taskDeps({
    updateMyTaskStatus: async () => { throw new Error('Task not found or cannot be updated.') },
  }).deps).execute({ task_id: '999', status: 'IN-PROGRESS', remarks: 'x' }, at(MY_TASKS_PAGE))
  assert.deepEqual(refused, { ok: false, message: 'Task not found or cannot be updated.' })
})

test('review_task: sending back needs a reason; approve and reject reach the endpoint verbs', async () => {
  const { deps, calls, rows } = taskDeps()
  const definition = reviewTaskAction(deps)
  assertWriteDefinition(definition)
  assertAppliesTo(definition, [TASK_DASHBOARD_PAGE], [MY_TASKS_PAGE, TASK_PROJECTS_PAGE])

  const tasks = await definition.inputs.find((input) => input.key === 'task_id')?.options?.(at(TASK_DASHBOARD_PAGE))
  assert.deepEqual(tasks, [{ value: '40', label: 'Close books - Ravi' }])

  assert.ok(definition.validate?.({ task_id: '40', decision: 'reject', remarks: '' }).remarks)
  assert.deepEqual(definition.validate?.({ task_id: '40', decision: 'approve', remarks: '' }), {})
  assert.ok(definition.validate?.({ task_id: '40', decision: 'maybe', remarks: '' }).decision)

  assert.match(definition.preview({ task_id: '40', decision: 'reject', remarks: 'Redo' }, at(TASK_DASHBOARD_PAGE), {}).title, /back/)

  await definition.execute({ task_id: '40', decision: 'reject', remarks: 'Redo' }, at(TASK_DASHBOARD_PAGE))
  await definition.execute({ task_id: '40', decision: 'approve', remarks: '' }, at(TASK_DASHBOARD_PAGE))
  assert.deepEqual(calls.decisions, [
    { id: '40', decision: 'reject', remarks: 'Redo' },
    { id: '40', decision: 'approve', remarks: '' },
  ])
  assert.equal(rows[0].moduleKey, 'task_management')
})

test('review_task: the 403 for a non-approver is the result', async () => {
  const definition = reviewTaskAction(taskDeps({
    decideTask: async () => { throw new Error('You do not have permission to perform this action.') },
  }).deps)
  const result = await definition.execute({ task_id: '40', decision: 'approve', remarks: '' }, at(TASK_DASHBOARD_PAGE))

  assert.deepEqual(result, { ok: false, message: 'You do not have permission to perform this action.' })
})

// ---- talent_management --------------------------------------------------------------------

function talentDeps(overrides: Partial<TalentActionDeps> = {}) {
  const calls = { jobs: [] as unknown[] }
  const { rows, record } = ledger()
  const deps: TalentActionDeps = {
    listDepartments: async () => [{ id: 3, department: 'Finance' }],
    createJob: async (payload) => { calls.jobs.push(payload); return { message: 'added successfully !!', data: { id: 501 } } },
    record,
    ...overrides,
  }
  return { deps, calls, rows }
}

test('create_job_posting: applies-to Recruitment, departments live, validation', async () => {
  const definition = createJobPostingAction(talentDeps().deps)
  assertWriteDefinition(definition)
  assertAppliesTo(definition, [RECRUITMENT_PAGE], ['/module/talent-management/onboarding', '/dashboard'])

  const departments = await definition.inputs.find((input) => input.key === 'department_id')?.options?.(at(RECRUITMENT_PAGE))
  assert.deepEqual(departments, [{ value: '', label: 'Not set' }, { value: '3', label: 'Finance' }])

  assert.ok(definition.validate?.({ title: 'x', positions: '0' }).positions)
  assert.ok(definition.validate?.({ title: 'x', positions: 'two' }).positions)
  assert.ok(definition.validate?.({ title: 'x', deadline: '2026-02-31' }).deadline)
  assert.deepEqual(definition.validate?.({ title: 'x', positions: '2', deadline: '2026-12-01' }), {})

  const preview = definition.preview({ title: 'Accountant', department_id: '3', location: '', employment_type: '', positions: '2', deadline: '', description: '' }, at(RECRUITMENT_PAGE), { department_id: 'Finance' })
  assert.equal(preview.lines.find((line) => line.label === 'Department')?.value, 'Finance')
  assert.ok(preview.warning)
})

test('create_job_posting: success sends only what was filled; ledger uses talent_recruitment', async () => {
  const { deps, calls, rows } = talentDeps()
  const result = await createJobPostingAction(deps).execute(
    { title: 'Accountant', department_id: '3', location: '', employment_type: 'Full-time', positions: '2', deadline: '', description: '' },
    at(RECRUITMENT_PAGE),
  )

  assert.equal(result.ok, true)
  assert.deepEqual(calls.jobs, [{
    title: 'Accountant', department_id: '3', location: undefined, employment_type: 'Full-time', positions: 2, deadline: undefined, description: undefined,
  }])
  assert.equal(rows[0].moduleKey, 'talent_recruitment')
  assert.equal(rows[0].entry.subject_id, 501)
})

test('create_job_posting: a requisition chain message is passed on; a permission refusal is the result', async () => {
  const chained = await createJobPostingAction(talentDeps({
    createJob: async () => ({ message: 'Requisition submitted and awaiting approval before it goes live.', data: { id: 1 } }),
  }).deps).execute({ title: 'x', department_id: '', location: '', employment_type: '', positions: '', deadline: '', description: '' }, at(RECRUITMENT_PAGE))
  assert.match(chained.message, /awaiting approval/)

  const refused = await createJobPostingAction(talentDeps({
    createJob: async () => { throw new Error('Your role does not have access to this screen.') },
  }).deps).execute({ title: 'x', department_id: '', location: '', employment_type: '', positions: '', deadline: '', description: '' }, at(RECRUITMENT_PAGE))
  assert.deepEqual(refused, { ok: false, message: 'Your role does not have access to this screen.' })
})

// ---- lms ----------------------------------------------------------------------------------

function lmsDeps(overrides: Partial<LmsActionDeps> = {}) {
  const calls = { requested: [] as number[], reviewed: [] as unknown[] }
  const { rows, record } = ledger()
  const deps: LmsActionDeps = {
    listCourses: async () => [{ id: 12, display_name: 'Data Literacy' }, { id: 13, display_name: null }],
    requestEnrollment: async (_ctx, courseId) => { calls.requested.push(courseId); return {} },
    listPending: async () => [{ id: 71, learner_name: 'Meera K', course_name: 'Data Literacy' }],
    reviewRequest: async (_ctx, id, decision, note) => { calls.reviewed.push({ id, decision, note }); return {} },
    record,
    ...overrides,
  }
  return { deps, calls, rows }
}

test('request_enrollment: applies-to Learning Catalog; courses live; success and duplicate refusal', async () => {
  const { deps, calls, rows } = lmsDeps()
  const definition = requestEnrollmentAction(deps)
  assertWriteDefinition(definition)
  assertAppliesTo(definition, [LEARNING_CATALOG_PAGE], [LMS_ASSIGNMENTS_PAGE, '/module/lms/learning/my-learning'])

  const courses = await definition.inputs.find((input) => input.key === 'course_id')?.options?.(at(LEARNING_CATALOG_PAGE))
  assert.deepEqual(courses, [{ value: '12', label: 'Data Literacy' }, { value: '13', label: 'Course 13' }])
  assert.ok(definition.validate?.({ course_id: 'x' }).course_id)

  const result = await definition.execute({ course_id: '12' }, at(LEARNING_CATALOG_PAGE))
  assert.equal(result.ok, true)
  assert.deepEqual(calls.requested, [12])
  assert.equal(rows[0].moduleKey, 'lms_learning_catalog')

  const duplicate = await requestEnrollmentAction(lmsDeps({
    requestEnrollment: async () => { throw new Error('You already have a pending request for this course.') },
  }).deps).execute({ course_id: '12' }, at(LEARNING_CATALOG_PAGE))
  assert.deepEqual(duplicate, { ok: false, message: 'You already have a pending request for this course.' })
})

test('review_enrollment_request: applies-to Assignments; pending live; success and non-admin refusal', async () => {
  const { deps, calls, rows } = lmsDeps()
  const definition = reviewEnrollmentRequestAction(deps)
  assertWriteDefinition(definition)
  assertAppliesTo(definition, [LMS_ASSIGNMENTS_PAGE], [LEARNING_CATALOG_PAGE])

  const pending = await definition.inputs.find((input) => input.key === 'request_id')?.options?.(at(LMS_ASSIGNMENTS_PAGE))
  assert.deepEqual(pending, [{ value: '71', label: 'Meera K - Data Literacy' }])
  assert.ok(definition.validate?.({ request_id: '71', decision: 'maybe' }).decision)

  assert.match(definition.preview({ request_id: '71', decision: 'rejected', note: '' }, at(LMS_ASSIGNMENTS_PAGE), {}).title, /Reject/)

  const result = await definition.execute({ request_id: '71', decision: 'approved', note: 'ok' }, at(LMS_ASSIGNMENTS_PAGE))
  assert.equal(result.ok, true)
  assert.deepEqual(calls.reviewed, [{ id: 71, decision: 'approved', note: 'ok' }])
  assert.equal(rows[0].moduleKey, 'lms')

  const refused = await reviewEnrollmentRequestAction(lmsDeps({
    reviewRequest: async () => { throw new Error('Your profile is not permitted to review enrolment requests.') },
  }).deps).execute({ request_id: '71', decision: 'approved', note: '' }, at(LMS_ASSIGNMENTS_PAGE))
  assert.deepEqual(refused, { ok: false, message: 'Your profile is not permitted to review enrolment requests.' })
})

// ---- capability_intelligence --------------------------------------------------------------

test('create_competency: applies-to Competency Library; validation; success; refusal', async () => {
  const created: unknown[] = []
  const { rows, record } = ledger()
  const definition = createCompetencyAction({
    createCompetency: async (_ctx, payload) => { created.push(payload); return { data: { id: 808 } } },
    record,
  })
  assertWriteDefinition(definition)
  assertAppliesTo(definition, [COMPETENCY_LIBRARY_PAGE], ['/module/capability-intelligence/capability-library', '/dashboard'])

  assert.equal(flow.submit(flow.start(definition), definition, { name: '' }, at(COMPETENCY_LIBRARY_PAGE)).phase, 'collecting')
  assert.equal(flow.submit(flow.start(definition), definition, { name: 'x'.repeat(192) }, at(COMPETENCY_LIBRARY_PAGE)).phase, 'collecting')

  const result = await definition.execute({ name: 'Negotiation', code: '', description: '' }, at(COMPETENCY_LIBRARY_PAGE))
  assert.equal(result.ok, true)
  assert.deepEqual(created, [{ name: 'Negotiation', code: undefined, description: undefined }])
  assert.equal(rows[0].moduleKey, 'capability_intelligence')
  assert.equal(rows[0].entry.subject_id, 808)

  const refused = await createCompetencyAction({
    createCompetency: async () => { throw new Error('You do not have permission to perform this action.') },
    record,
  }).execute({ name: 'x', code: '', description: '' }, at(COMPETENCY_LIBRARY_PAGE))
  assert.deepEqual(refused, { ok: false, message: 'You do not have permission to perform this action.' })
})

// ---- the registry as a whole --------------------------------------------------------------

test('a sentence picks the right action on a page that offers several', () => {
  const { deps: leave } = leaveDeps()
  const registry = new ActionRegistry<G2gActionApp>([applyLeaveAction(leave), decideLeaveAction(leave)])
  const context = at(LEAVE_REQUESTS_PAGE)

  assert.equal(registry.match('I want to apply for leave next week', context)?.key, 'apply_leave')
  assert.equal(registry.match('please approve leave for Asha', context)?.key, 'decide_leave')
  assert.equal(registry.match('how many leave requests are pending?', context), null)
  assert.equal(registry.match('apply for leave', at('/module/lms/learning/my-learning')), null)
})

test('every action keys and phrases are unique across the modules', () => {
  const { deps: leave } = leaveDeps()
  const { deps: task } = taskDeps()
  const { deps: talent } = talentDeps()
  const { deps: lms } = lmsDeps()
  const definitions = [
    applyLeaveAction(leave), decideLeaveAction(leave),
    addBacklogItemAction(task), updateMyTaskStatusAction(task), reviewTaskAction(task),
    createJobPostingAction(talent),
    requestEnrollmentAction(lms), reviewEnrollmentRequestAction(lms),
    createCompetencyAction({ createCompetency: async () => ({}), record: async () => true }),
  ]
  const keys = definitions.map((definition) => definition.key)

  assert.equal(new Set(keys).size, keys.length)
})
