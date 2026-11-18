/**
 * LMS chat actions that change courses: assign a course to someone, edit a course, delete a course.
 *
 * Each calls the endpoint the LMS page's own button calls, through the page's own service, as the
 * signed-in user. THE SERVER decides who may - and it now does (hp_erp routes/api.php, middleware
 * `anyaccess`, App\Http\Middleware\RequireAnyAccess); before that these three took any token:
 *
 *   assign_course  POST   /api/lmsAssignment        administrator/HR role, or the `add` right on the
 *                                                   Assignments page (department head, reporting manager)
 *   edit_course    PUT    /api/lms/courses/{id}     administrator/HR role, or any profile that can open
 *                                                   Course Builder (the page that saves course drafts)
 *   delete_course  DELETE /api/lms/courses/{id}     administrator/HR role only (the catalogue offers
 *                                                   delete to course authors only)
 *
 * The controllers scope by the TOKEN's tenant, so another organisation's course or learner id is a
 * 404/422, never a write. A refusal comes back as the result and is shown as the server worded it.
 *
 * Every action defines `verify`: after the write it READS BACK through the app's own list/get API and
 * the action is reported failed - "ran, but could not be confirmed" - unless the change is really there.
 */

import type { LaravelContext } from '@/lib/laravel-context'
import type { ActionOption, ActionResult, ChatActionDefinition } from '../types'
import type { G2gActionApp } from './actions'
import { LEARNING_CATALOG_PAGE, LMS_ASSIGNMENTS_PAGE } from './actions-lms'
import { failureMessage, isIsoDate, onPage, writeLedger, type RecordActivity } from './shared'

export { LEARNING_CATALOG_PAGE, LMS_ASSIGNMENTS_PAGE }

const CATALOG_MODULE_KEY = 'lms_learning_catalog'
const LMS_MODULE_KEY = 'lms'

export interface CourseRow {
  id: number
  display_name: string | null
  status: number
  learners: number
}

export interface CourseDetail extends CourseRow {
  standard_id: number | null
  subject_category: string | null
  short_name: string | null
}

export interface PersonRow {
  id: number
  name: string
  employee_no?: string | null
}

export interface AssignmentLine {
  learner_name: string
  course_name: string
  assignment_type: string
  due_date: string | null
}

export interface CourseUpdateBody {
  display_name: string
  standard_id: number
  status: number
  subject_category?: string | null
  short_name?: string | null
}

export interface LmsCourseActionDeps {
  /** Courses in the organisation's catalogue, live. `search` narrows by name; `activeOnly` hides inactive ones. */
  listCourses: (context: LaravelContext, filters?: { search?: string; activeOnly?: boolean }) => Promise<CourseRow[]>
  getCourse: (context: LaravelContext, id: number) => Promise<CourseDetail>
  /** The organisation's departments, as the course form's Department picker lists them. */
  listDepartments: (context: LaravelContext) => Promise<Array<{ id: number; department: string }>>
  updateCourse: (context: LaravelContext, id: number, body: CourseUpdateBody) => Promise<unknown>
  deleteCourse: (context: LaravelContext, id: number) => Promise<unknown>
  /** People the Assignments page can assign to, live. */
  listLearners: (context: LaravelContext) => Promise<PersonRow[]>
  /** The Assignments page's own list (approved assignments). */
  listAssignments: (context: LaravelContext) => Promise<AssignmentLine[]>
  createAssignments: (
    context: LaravelContext,
    payload: { user_ids: number[]; course_id: number; assignment_type: string; due_date?: string },
  ) => Promise<unknown>
  record: RecordActivity
}

const courseName = (course: { id: number; display_name: string | null }) => course.display_name?.trim() || `Course ${course.id}`

/** Names from different endpoints differ by a middle name; the same person's tokens nest. */
export function sameName(a: string, b: string): boolean {
  const tokens = (value: string) => value.toLowerCase().split(/\s+/).filter(Boolean)
  const left = tokens(a)
  const right = tokens(b)
  if (left.length === 0 || right.length === 0) return false

  const [small, big] = left.length <= right.length ? [left, right] : [right, left]

  return small.every((token) => big.includes(token))
}

const today = () => new Date().toISOString().slice(0, 10)

const matchesAssignment = (line: AssignmentLine, learner: string, course: string) =>
  sameName(line.learner_name, learner) && line.course_name.trim().toLowerCase() === course.trim().toLowerCase()

// ---- assign_course -------------------------------------------------------------------------

export function assignCourseAction(deps: LmsCourseActionDeps): ChatActionDefinition<G2gActionApp> {
  /** The matching-assignment count BEFORE the write, so verify can tell "new" from "already there". */
  const before = new WeakMap<ActionResult, { learner: string; course: string; count: number }>()

  return {
    key: 'assign_course',
    label: 'Assign a course',
    description: 'Assign a course to an employee, as the Assignments page does. Needs the Assignments add right or an administrator/HR role.',
    risk: 'write',
    phrases: ['assign course', 'assign a course', 'assign learning', 'assign training', 'assign a course to', 'enrol someone', 'enroll someone'],
    appliesTo: (context) => onPage(context, LMS_ASSIGNMENTS_PAGE),
    inputs: [
      {
        key: 'course_id',
        label: 'Course',
        type: 'select',
        required: true,
        options: async (context): Promise<ActionOption[]> =>
          (await deps.listCourses(context.app.laravel, { activeOnly: true })).map((course) => ({
            value: String(course.id),
            label: courseName(course),
          })),
      },
      {
        key: 'user_id',
        label: 'Employee',
        type: 'select',
        required: true,
        options: async (context): Promise<ActionOption[]> =>
          (await deps.listLearners(context.app.laravel)).map((person) => ({
            value: String(person.id),
            label: person.employee_no ? `${person.name} (${person.employee_no})` : person.name,
          })),
      },
      {
        key: 'assignment_type',
        label: 'Type',
        type: 'select',
        required: true,
        // The two values the Assignments page offers - a protocol choice, not organisation data.
        options: async () => [
          { value: 'Mandatory', label: 'Mandatory' },
          { value: 'Optional', label: 'Optional' },
        ],
      },
      { key: 'due_date', label: 'Due date', type: 'text', placeholder: 'Optional, YYYY-MM-DD', maxLength: 10 },
    ],
    validate: (values) => {
      const errors: Record<string, string> = {}

      if (values.course_id && !/^\d+$/.test(values.course_id)) errors.course_id = 'Choose a course from the list.'
      if (values.user_id && !/^\d+$/.test(values.user_id)) errors.user_id = 'Choose an employee from the list.'
      if (values.assignment_type && values.assignment_type !== 'Mandatory' && values.assignment_type !== 'Optional') {
        errors.assignment_type = 'Choose Mandatory or Optional.'
      }
      if (values.due_date) {
        if (!isIsoDate(values.due_date)) errors.due_date = 'Use a real date as YYYY-MM-DD.'
        else if (values.due_date < today()) errors.due_date = 'The due date cannot be in the past.'
      }

      return errors
    },
    preview: (values, _context, labels) => ({
      title: 'Assign this course?',
      lines: [
        { label: 'Course', value: labels.course_id ?? `Course ${values.course_id}` },
        { label: 'Employee', value: labels.user_id ?? `Employee ${values.user_id}` },
        { label: 'Type', value: values.assignment_type },
        { label: 'Due date', value: values.due_date || 'None' },
      ],
      warning: 'The employee is assigned the course and enrolled in it straight away.',
    }),
    execute: async (values, context): Promise<ActionResult> => {
      try {
        const laravel = context.app.laravel
        const [courses, learners] = await Promise.all([deps.listCourses(laravel, { activeOnly: true }), deps.listLearners(laravel)])
        const course = courses.find((row) => row.id === Number(values.course_id))
        const learner = learners.find((row) => row.id === Number(values.user_id))

        if (!course) return { ok: false, message: 'That course is no longer in the catalogue.' }
        if (!learner) return { ok: false, message: 'That employee could not be found.' }

        const existing = (await deps.listAssignments(laravel)).filter((line) => matchesAssignment(line, learner.name, courseName(course))).length

        await deps.createAssignments(laravel, {
          user_ids: [learner.id],
          course_id: course.id,
          assignment_type: values.assignment_type,
          due_date: values.due_date || undefined,
        })

        await writeLedger(deps.record, LMS_MODULE_KEY, {
          operation: 'chat_assign_course',
          operation_label: 'Assign course (chat)',
          message: `Assigned "${courseName(course)}" to ${learner.name} (${values.assignment_type}) from the chat.`,
          subject_entity_key: 'course',
          subject_id: course.id,
          subject_label: courseName(course),
        })

        const result: ActionResult = {
          ok: true,
          message: `Assigned "${courseName(course)}" to ${learner.name}.`,
          link: { label: 'Open Assignments', href: LMS_ASSIGNMENTS_PAGE },
        }
        before.set(result, { learner: learner.name, course: courseName(course), count: existing })

        return result
      } catch (error) {
        return { ok: false, message: failureMessage(error, 'The course could not be assigned.') }
      }
    },
    verify: async (_values, context, result) => {
      const expected = before.get(result)
      if (!expected) return { ok: false, message: 'there is no record of what was assigned to check.' }

      const now = (await deps.listAssignments(context.app.laravel)).filter((line) => matchesAssignment(line, expected.learner, expected.course)).length

      return now > expected.count
        ? { ok: true, message: `Confirmed: ${expected.learner} now appears with "${expected.course}" in the assignment list.` }
        : { ok: false, message: `${expected.learner} does not appear with "${expected.course}" in the assignment list.` }
    },
  }
}

// ---- edit_course ---------------------------------------------------------------------------

const STATUS_LABEL: Record<string, string> = { '1': 'Active', '0': 'Inactive' }

export function editCourseAction(deps: LmsCourseActionDeps): ChatActionDefinition<G2gActionApp> {
  const expected = new WeakMap<ActionResult, { id: number; body: CourseUpdateBody }>()

  return {
    key: 'edit_course',
    label: 'Edit a course',
    description: 'Change a course\'s name, status, category, short name or department. Blank fields stay as they are.',
    risk: 'write',
    phrases: ['edit course', 'edit a course', 'update course', 'update a course', 'rename course', 'rename a course', 'change course'],
    appliesTo: (context) => onPage(context, LEARNING_CATALOG_PAGE),
    inputs: [
      {
        key: 'course_id',
        label: 'Course',
        type: 'select',
        required: true,
        options: async (context): Promise<ActionOption[]> =>
          (await deps.listCourses(context.app.laravel)).map((course) => ({
            value: String(course.id),
            label: course.status === 1 ? courseName(course) : `${courseName(course)} (inactive)`,
          })),
      },
      { key: 'display_name', label: 'New name', type: 'text', maxLength: 191, placeholder: 'Leave blank to keep' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        // sub_std_map.status is a 0/1 flag - a protocol choice, not organisation data.
        options: async () => [
          { value: '', label: 'Keep as is' },
          { value: '1', label: 'Active' },
          { value: '0', label: 'Inactive' },
        ],
      },
      { key: 'subject_category', label: 'Category', type: 'text', maxLength: 191, placeholder: 'Leave blank to keep' },
      { key: 'short_name', label: 'Short name', type: 'text', maxLength: 100, placeholder: 'Leave blank to keep' },
      {
        key: 'standard_id',
        label: 'Department',
        type: 'select',
        options: async (context): Promise<ActionOption[]> => [
          { value: '', label: 'Keep as is' },
          ...(await deps.listDepartments(context.app.laravel)).map((department) => ({
            value: String(department.id),
            label: department.department,
          })),
        ],
      },
    ],
    validate: (values) => {
      const errors: Record<string, string> = {}

      if (values.course_id && !/^\d+$/.test(values.course_id)) errors.course_id = 'Choose a course from the list.'
      if (values.status && values.status !== '0' && values.status !== '1') errors.status = 'Choose Active or Inactive.'
      if (values.standard_id && !/^\d+$/.test(values.standard_id)) errors.standard_id = 'Choose a department from the list.'

      const anyChange = ['display_name', 'status', 'subject_category', 'short_name', 'standard_id'].some((key) => (values[key] ?? '').trim() !== '')
      if (!anyChange && !errors.course_id) errors.display_name = 'Enter at least one change.'

      return errors
    },
    preview: (values, _context, labels) => {
      const lines = [{ label: 'Course', value: labels.course_id ?? `Course ${values.course_id}` }]

      if (values.display_name) lines.push({ label: 'Name becomes', value: values.display_name })
      if (values.status) lines.push({ label: 'Status becomes', value: STATUS_LABEL[values.status] ?? values.status })
      if (values.subject_category) lines.push({ label: 'Category becomes', value: values.subject_category })
      if (values.short_name) lines.push({ label: 'Short name becomes', value: values.short_name })
      if (values.standard_id) lines.push({ label: 'Department becomes', value: labels.standard_id ?? `Department ${values.standard_id}` })

      return {
        title: 'Save these changes to the course?',
        lines,
        warning: 'Only the fields listed here are written; everything else about the course stays as it is.',
      }
    },
    execute: async (values, context): Promise<ActionResult> => {
      try {
        const laravel = context.app.laravel
        const id = Number(values.course_id)
        const current = await deps.getCourse(laravel, id)

        const body: CourseUpdateBody = {
          display_name: values.display_name || (current.display_name ?? ''),
          standard_id: values.standard_id ? Number(values.standard_id) : (current.standard_id ?? 0),
          status: values.status ? Number(values.status) : current.status,
          ...(values.subject_category ? { subject_category: values.subject_category } : {}),
          ...(values.short_name ? { short_name: values.short_name } : {}),
        }

        await deps.updateCourse(laravel, id, body)

        await writeLedger(deps.record, CATALOG_MODULE_KEY, {
          operation: 'chat_edit_course',
          operation_label: 'Edit course (chat)',
          message: `Edited the course "${courseName(current)}" from the chat.`,
          subject_entity_key: 'course',
          subject_id: id,
          subject_label: courseName(current),
        })

        const result: ActionResult = {
          ok: true,
          message: `Saved the changes to "${courseName(current)}".`,
          link: { label: 'Open Learning Catalog', href: LEARNING_CATALOG_PAGE },
        }
        expected.set(result, { id, body })

        return result
      } catch (error) {
        return { ok: false, message: failureMessage(error, 'The course could not be saved.') }
      }
    },
    verify: async (_values, context, result) => {
      const target = expected.get(result)
      if (!target) return { ok: false, message: 'there is no record of what was saved to check.' }

      const saved = await deps.getCourse(context.app.laravel, target.id)
      const wrong: string[] = []

      if ((saved.display_name ?? '').trim() !== target.body.display_name.trim()) wrong.push('name')
      if (Number(saved.status) !== target.body.status) wrong.push('status')
      if (target.body.standard_id && Number(saved.standard_id) !== target.body.standard_id) wrong.push('department')
      if (target.body.subject_category !== undefined && (saved.subject_category ?? '').trim() !== target.body.subject_category?.trim()) wrong.push('category')
      if (target.body.short_name !== undefined && (saved.short_name ?? '').trim() !== target.body.short_name?.trim()) wrong.push('short name')

      return wrong.length === 0
        ? { ok: true, message: 'Confirmed: the course now shows the new values.' }
        : { ok: false, message: `the course still shows the old ${wrong.join(', ')}.` }
    },
  }
}

// ---- delete_course -------------------------------------------------------------------------

export function deleteCourseAction(deps: LmsCourseActionDeps): ChatActionDefinition<G2gActionApp> {
  const deleted = new WeakMap<ActionResult, { id: number; name: string }>()

  return {
    key: 'delete_course',
    label: 'Delete a course',
    description: 'Delete a course from the catalogue. Administrator or HR only; this cannot be undone from the app.',
    risk: 'write',
    phrases: ['delete course', 'delete a course', 'remove course', 'remove a course'],
    appliesTo: (context) => onPage(context, LEARNING_CATALOG_PAGE),
    inputs: [
      {
        key: 'course_id',
        label: 'Course',
        type: 'select',
        required: true,
        // The learner count rides in the label so the preview can say how many people it touches.
        options: async (context): Promise<ActionOption[]> =>
          (await deps.listCourses(context.app.laravel)).map((course) => ({
            value: String(course.id),
            label: `${courseName(course)} - ${course.learners} learner${course.learners === 1 ? '' : 's'}`,
          })),
      },
    ],
    validate: (values): Record<string, string> =>
      values.course_id && !/^\d+$/.test(values.course_id) ? { course_id: 'Choose a course from the list.' } : {},
    preview: (values, _context, labels) => ({
      title: 'Delete this course?',
      lines: [{ label: 'Course (learners enrolled)', value: labels.course_id ?? `Course ${values.course_id}` }],
      warning:
        'DESTRUCTIVE AND IRREVERSIBLE from the app. The course is removed from the catalogue for everyone, and ' +
        'the learners enrolled in it (the number beside its name) lose access to it. There is no restore screen.',
    }),
    execute: async (values, context): Promise<ActionResult> => {
      try {
        const laravel = context.app.laravel
        const id = Number(values.course_id)
        const current = await deps.getCourse(laravel, id)

        await deps.deleteCourse(laravel, id)

        await writeLedger(deps.record, CATALOG_MODULE_KEY, {
          operation: 'chat_delete_course',
          operation_label: 'Delete course (chat)',
          message: `Deleted the course "${courseName(current)}" from the chat.`,
          subject_entity_key: 'course',
          subject_id: id,
          subject_label: courseName(current),
        })

        const result: ActionResult = {
          ok: true,
          message: `Deleted the course "${courseName(current)}".`,
          link: { label: 'Open Learning Catalog', href: LEARNING_CATALOG_PAGE },
        }
        deleted.set(result, { id, name: courseName(current) })

        return result
      } catch (error) {
        return { ok: false, message: failureMessage(error, 'The course could not be deleted.') }
      }
    },
    verify: async (_values, context, result) => {
      const target = deleted.get(result)
      if (!target) return { ok: false, message: 'there is no record of what was deleted to check.' }

      const stillListed = (await deps.listCourses(context.app.laravel, { search: target.name })).some((course) => course.id === target.id)

      return stillListed
        ? { ok: false, message: `"${target.name}" is still in the catalogue.` }
        : { ok: true, message: `Confirmed: "${target.name}" is no longer in the catalogue.` }
    },
  }
}
