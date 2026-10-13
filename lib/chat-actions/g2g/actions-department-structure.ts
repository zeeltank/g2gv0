/**
 * Department Management chat actions that change the STRUCTURE: merge two departments, move one up or
 * down among its siblings, change its head.
 *
 * Each calls the endpoint the Department Management page's own control calls, through
 * `organizationService`, as the signed-in user:
 *
 *   merge_departments        POST  /api/departments-management/{id}/merge
 *   reorder_department       POST  /api/departments-management/reorder
 *   change_department_head   PATCH /api/departments-management/{id}/head
 *
 * THE SERVER NOW ENFORCES WHO MAY (hp_erp routes/api.php, middleware `anyaccess`): these and the other
 * department writes (parent, employee moves, update, delete) took any token, the only gate being the UI
 * hiding a button. They now need the `view` right on the Department Management page - the same right the
 * sidebar and `POST /departments-management` use - or the administrator/HR role. (Employee moves also
 * accept the Employee Directory page's right, because its bulk bar moves people too.) The controller
 * scopes every id by the token's tenant: another organisation's department is a 404, a merge target
 * outside the organisation is refused.
 *
 * Every action defines `verify`: it reads the department list (or the department) back through the
 * page's own GET and the action is reported failed unless the change is really there.
 */

import type { LaravelContext } from '@/lib/laravel-context'
import type { ActionOption, ActionResult, ChatActionDefinition } from '../types'
import { DEPARTMENT_PAGE, type G2gActionApp } from './actions'
import { failureMessage, onPage, writeLedger, type RecordActivity } from './shared'

const MODULE_KEY = 'organizational_management'

export interface DepartmentRow {
  id: number
  department: string
  parent_id?: number | null
  sort_order?: number | null
  head_user_id?: number | null
  head_name?: string | null
  employee_count?: number | string | null
}

export interface EmployeeRow {
  id: number | string
  name?: string | null
  employee_no?: string | null
}

export interface MergeOutcome {
  message?: string
  data?: { employees?: number; job_roles_folded?: number; children?: number }
}

export interface DepartmentStructureDeps {
  /** Every live department of the organisation, as the page lists them. */
  listDepartments: (context: LaravelContext) => Promise<DepartmentRow[]>
  /** One department, as the page's details panel reads it. */
  getDepartment: (context: LaravelContext, id: string) => Promise<DepartmentRow | null>
  /** The head-of-department picker's employees. */
  listEmployees: (context: LaravelContext) => Promise<EmployeeRow[]>
  mergeDepartment: (context: LaravelContext, sourceId: string, targetId: string) => Promise<MergeOutcome | unknown>
  reorderDepartment: (context: LaravelContext, id: string, direction: 'up' | 'down') => Promise<{ moved?: boolean; data?: { moved?: boolean } } | unknown>
  setDepartmentHead: (context: LaravelContext, id: string, headUserId: string | null) => Promise<unknown>
  record: RecordActivity
}

const link = { label: 'Open Department Management', href: DEPARTMENT_PAGE }
const count = (value: number | string | null | undefined) => Number(value ?? 0) || 0

/** Siblings of a department in the order the page shows them (sort order, then id). */
function siblingsOf(all: DepartmentRow[], department: DepartmentRow): DepartmentRow[] {
  const parent = Number(department.parent_id ?? 0)

  return all
    .filter((row) => Number(row.parent_id ?? 0) === parent)
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0) || a.id - b.id)
}

const nameOf = (all: DepartmentRow[], id: number | null | undefined) =>
  id ? all.find((row) => row.id === id)?.department : undefined

/** Same-named departments exist, so the option says where each sits and how big it is. */
function describe(all: DepartmentRow[], department: DepartmentRow): string {
  const employees = count(department.employee_count)
  const children = all.filter((row) => Number(row.parent_id ?? 0) === department.id).length
  const parent = nameOf(all, Number(department.parent_id ?? 0))

  return [
    department.department,
    ' (',
    parent ? `under ${parent}, ` : 'top level, ',
    `${employees} employee${employees === 1 ? '' : 's'}`,
    children > 0 ? `, ${children} sub-department${children === 1 ? '' : 's'}` : '',
    ')',
  ].join('')
}

const departmentOptions = (deps: DepartmentStructureDeps, label: (all: DepartmentRow[], row: DepartmentRow) => string) =>
  async (context: { app: G2gActionApp }): Promise<ActionOption[]> => {
    const all = await deps.listDepartments(context.app.laravel)

    return all.map((row) => ({ value: String(row.id), label: label(all, row) }))
  }

// ---- merge_departments ---------------------------------------------------------------------

export function mergeDepartmentsAction(deps: DepartmentStructureDeps): ChatActionDefinition<G2gActionApp> {
  const merged = new WeakMap<ActionResult, { sourceId: number; targetId: number; source: string; target: string }>()

  return {
    key: 'merge_departments',
    label: 'Merge two departments',
    description: 'Move everything from one department into another and retire the first. Cannot be undone.',
    risk: 'write',
    phrases: ['merge department', 'merge departments', 'merge a department', 'merge two departments'],
    appliesTo: (context) => onPage(context, DEPARTMENT_PAGE),
    inputs: [
      { key: 'source_id', label: 'Merge this department', type: 'select', required: true, options: departmentOptions(deps, describe) },
      { key: 'target_id', label: 'Into this department', type: 'select', required: true, options: departmentOptions(deps, describe) },
    ],
    validate: (values) => {
      const errors: Record<string, string> = {}

      if (values.source_id && !/^\d+$/.test(values.source_id)) errors.source_id = 'Choose a department from the list.'
      if (values.target_id && !/^\d+$/.test(values.target_id)) errors.target_id = 'Choose a department from the list.'
      if (values.source_id && values.source_id === values.target_id) errors.target_id = 'A department cannot be merged into itself.'

      return errors
    },
    preview: (values, _context, labels) => ({
      title: 'Merge these departments?',
      lines: [
        { label: 'Retired (merged away)', value: labels.source_id ?? `Department ${values.source_id}` },
        { label: 'Receives everything', value: labels.target_id ?? `Department ${values.target_id}` },
      ],
      warning:
        'DESTRUCTIVE AND IRREVERSIBLE. The first department is retired. Its employees, job roles, skills, competency ' +
        'records, performance records, tasks and LMS content all become the second department\'s, and its ' +
        'sub-departments are re-parented under it. There is no un-merge. Employee, sub-department and role counts ' +
        'for the first department are shown beside its name.',
    }),
    execute: async (values, context): Promise<ActionResult> => {
      try {
        const laravel = context.app.laravel
        const all = await deps.listDepartments(laravel)
        const source = all.find((row) => row.id === Number(values.source_id))
        const target = all.find((row) => row.id === Number(values.target_id))

        if (!source) return { ok: false, message: 'The department to merge no longer exists.' }
        if (!target) return { ok: false, message: 'The department to merge into no longer exists.' }

        const outcome = (await deps.mergeDepartment(laravel, values.source_id, values.target_id)) as MergeOutcome | undefined
        const moved = outcome?.data

        await writeLedger(deps.record, MODULE_KEY, {
          operation: 'chat_merge_departments',
          operation_label: 'Merge departments (chat)',
          message: `Merged the department "${source.department}" into "${target.department}" from the chat.`,
          subject_entity_key: 'department',
          subject_id: source.id,
          subject_label: source.department,
        })

        const detail = moved
          ? ` ${moved.employees ?? 0} employee(s) moved, ${moved.job_roles_folded ?? 0} job role(s) folded, ${moved.children ?? 0} sub-department(s) re-parented.`
          : ''
        const result: ActionResult = {
          ok: true,
          message: `Merged "${source.department}" into "${target.department}".${detail}`,
          link,
        }
        merged.set(result, { sourceId: source.id, targetId: target.id, source: source.department, target: target.department })

        return result
      } catch (error) {
        return { ok: false, message: failureMessage(error, 'The departments could not be merged.') }
      }
    },
    verify: async (_values, context, result) => {
      const target = merged.get(result)
      if (!target) return { ok: false, message: 'there is no record of what was merged to check.' }

      const all = await deps.listDepartments(context.app.laravel)

      if (all.some((row) => row.id === target.sourceId)) return { ok: false, message: `"${target.source}" is still listed as a department.` }
      if (!all.some((row) => row.id === target.targetId)) return { ok: false, message: `"${target.target}" is no longer listed.` }

      return { ok: true, message: `Confirmed: "${target.source}" is no longer listed and "${target.target}" remains.` }
    },
  }
}

// ---- reorder_department --------------------------------------------------------------------

export function reorderDepartmentAction(deps: DepartmentStructureDeps): ChatActionDefinition<G2gActionApp> {
  const moved = new WeakMap<ActionResult, { id: number; name: string; direction: 'up' | 'down'; before: number; noop: boolean }>()

  return {
    key: 'reorder_department',
    label: 'Move a department up or down',
    description: 'Move a department one place up or down among the departments at its level.',
    risk: 'write',
    phrases: ['reorder department', 'reorder a department', 'move department up', 'move department down', 'change department order'],
    appliesTo: (context) => onPage(context, DEPARTMENT_PAGE),
    inputs: [
      {
        key: 'department_id',
        label: 'Department',
        type: 'select',
        required: true,
        options: departmentOptions(deps, (all, row) => {
          const siblings = siblingsOf(all, row)
          const parent = nameOf(all, Number(row.parent_id ?? 0))

          return `${row.department} - position ${siblings.findIndex((sibling) => sibling.id === row.id) + 1} of ${siblings.length}${parent ? ` under ${parent}` : ' at the top level'}`
        }),
      },
      {
        key: 'direction',
        label: 'Move',
        type: 'select',
        required: true,
        // The two values the reorder endpoint accepts - a protocol choice, not organisation data.
        options: async () => [
          { value: 'up', label: 'Up one place' },
          { value: 'down', label: 'Down one place' },
        ],
      },
    ],
    validate: (values) => {
      const errors: Record<string, string> = {}

      if (values.department_id && !/^\d+$/.test(values.department_id)) errors.department_id = 'Choose a department from the list.'
      if (values.direction && values.direction !== 'up' && values.direction !== 'down') errors.direction = 'Choose up or down.'

      return errors
    },
    preview: (values, _context, labels) => ({
      title: values.direction === 'down' ? 'Move this department down?' : 'Move this department up?',
      lines: [
        { label: 'Department (current position)', value: labels.department_id ?? `Department ${values.department_id}` },
        { label: 'Move', value: values.direction === 'down' ? 'Down one place' : 'Up one place' },
      ],
      warning: 'It swaps places with its neighbour at the same level; nothing else about either department changes.',
    }),
    execute: async (values, context): Promise<ActionResult> => {
      try {
        const laravel = context.app.laravel
        const direction = values.direction === 'down' ? 'down' : 'up'
        const all = await deps.listDepartments(laravel)
        const department = all.find((row) => row.id === Number(values.department_id))

        if (!department) return { ok: false, message: 'That department no longer exists.' }

        const outcome = (await deps.reorderDepartment(laravel, values.department_id, direction)) as { moved?: boolean; data?: { moved?: boolean } } | undefined
        const didMove = outcome?.moved ?? outcome?.data?.moved ?? true

        if (didMove) {
          await writeLedger(deps.record, MODULE_KEY, {
            operation: 'chat_reorder_department',
            operation_label: 'Reorder department (chat)',
            message: `Moved the department "${department.department}" ${direction} from the chat.`,
            subject_entity_key: 'department',
            subject_id: department.id,
            subject_label: department.department,
          })
        }

        const result: ActionResult = {
          ok: true,
          message: didMove
            ? `Moved "${department.department}" ${direction}.`
            : `"${department.department}" is already ${direction === 'up' ? 'first' : 'last'} at its level, so nothing moved.`,
          link,
        }
        moved.set(result, { id: department.id, name: department.department, direction, before: Number(department.sort_order ?? 0), noop: !didMove })

        return result
      } catch (error) {
        return { ok: false, message: failureMessage(error, 'The department could not be moved.') }
      }
    },
    verify: async (_values, context, result) => {
      const target = moved.get(result)
      if (!target) return { ok: false, message: 'there is no record of what was moved to check.' }
      if (target.noop) return { ok: true }

      const all = await deps.listDepartments(context.app.laravel)
      const department = all.find((row) => row.id === target.id)

      if (!department) return { ok: false, message: `"${target.name}" is no longer listed.` }

      const now = Number(department.sort_order ?? 0)
      const right = target.direction === 'up' ? now < target.before : now > target.before

      if (!right) return { ok: false, message: `"${target.name}" is still in the same place.` }

      const siblings = siblingsOf(all, department)

      return {
        ok: true,
        message: `Confirmed: it is now position ${siblings.findIndex((sibling) => sibling.id === department.id) + 1} of ${siblings.length} at its level.`,
      }
    },
  }
}

// ---- change_department_head ----------------------------------------------------------------

/** "No head" is sent as 0, which the endpoint stores as no head. */
const NO_HEAD = '0'

export function changeDepartmentHeadAction(deps: DepartmentStructureDeps): ChatActionDefinition<G2gActionApp> {
  const changed = new WeakMap<ActionResult, { id: string; name: string; headId: number | null; headName: string }>()

  return {
    key: 'change_department_head',
    label: 'Change a department head',
    description: 'Assign, change or clear the head of a department.',
    risk: 'write',
    phrases: [
      'change department head', 'change the department head', 'set department head', 'assign department head',
      'change head of department', 'assign head of department', 'change hod', 'assign hod', 'set hod',
    ],
    appliesTo: (context) => onPage(context, DEPARTMENT_PAGE),
    inputs: [
      {
        key: 'department_id',
        label: 'Department',
        type: 'select',
        required: true,
        options: departmentOptions(deps, (all, row) => `${describe(all, row)}${row.head_name ? ` - head: ${row.head_name}` : ' - no head'}`),
      },
      {
        key: 'head_user_id',
        label: 'New head',
        type: 'select',
        required: true,
        options: async (context): Promise<ActionOption[]> => [
          { value: NO_HEAD, label: 'No head (clear it)' },
          ...(await deps.listEmployees(context.app.laravel)).map((employee) => ({
            value: String(employee.id),
            label: employee.employee_no ? `${employee.name ?? employee.id} (${employee.employee_no})` : String(employee.name ?? employee.id),
          })),
        ],
      },
    ],
    validate: (values) => {
      const errors: Record<string, string> = {}

      if (values.department_id && !/^\d+$/.test(values.department_id)) errors.department_id = 'Choose a department from the list.'
      if (values.head_user_id && !/^\d+$/.test(values.head_user_id)) errors.head_user_id = 'Choose an employee from the list.'

      return errors
    },
    preview: (values, _context, labels) => ({
      title: values.head_user_id === NO_HEAD ? 'Clear this department\'s head?' : 'Change this department\'s head?',
      lines: [
        { label: 'Department (current head)', value: labels.department_id ?? `Department ${values.department_id}` },
        { label: 'New head', value: values.head_user_id === NO_HEAD ? 'No head' : (labels.head_user_id ?? `Employee ${values.head_user_id}`) },
      ],
      warning: 'Only the head of this department changes; no employee is moved.',
    }),
    execute: async (values, context): Promise<ActionResult> => {
      try {
        const laravel = context.app.laravel
        const clearing = values.head_user_id === NO_HEAD
        const [all, employees] = await Promise.all([deps.listDepartments(laravel), deps.listEmployees(laravel)])
        const department = all.find((row) => row.id === Number(values.department_id))

        if (!department) return { ok: false, message: 'That department no longer exists.' }

        const employee = clearing ? undefined : employees.find((row) => String(row.id) === values.head_user_id)

        if (!clearing && !employee) return { ok: false, message: 'That employee could not be found.' }

        await deps.setDepartmentHead(laravel, values.department_id, clearing ? null : values.head_user_id)

        const headName = clearing ? '' : String(employee?.name ?? values.head_user_id)

        await writeLedger(deps.record, MODULE_KEY, {
          operation: 'chat_change_department_head',
          operation_label: 'Change department head (chat)',
          message: clearing
            ? `Cleared the head of "${department.department}" from the chat.`
            : `Made ${headName} the head of "${department.department}" from the chat.`,
          subject_entity_key: 'department',
          subject_id: department.id,
          subject_label: department.department,
        })

        const result: ActionResult = {
          ok: true,
          message: clearing ? `Cleared the head of "${department.department}".` : `${headName} is now the head of "${department.department}".`,
          link,
        }
        changed.set(result, { id: values.department_id, name: department.department, headId: clearing ? null : Number(values.head_user_id), headName })

        return result
      } catch (error) {
        return { ok: false, message: failureMessage(error, 'The department head could not be changed.') }
      }
    },
    verify: async (_values, context, result) => {
      const target = changed.get(result)
      if (!target) return { ok: false, message: 'there is no record of what was changed to check.' }

      const department = await deps.getDepartment(context.app.laravel, target.id)

      if (!department) return { ok: false, message: `"${target.name}" could not be read back.` }

      const actual = department.head_user_id ?? null

      if (target.headId === null) {
        return actual === null || Number(actual) === 0
          ? { ok: true, message: `Confirmed: "${target.name}" has no head.` }
          : { ok: false, message: `"${target.name}" still has a head recorded.` }
      }

      return Number(actual) === target.headId
        ? { ok: true, message: `Confirmed: ${target.headName} is recorded as the head.` }
        : { ok: false, message: `the recorded head of "${target.name}" is not ${target.headName}.` }
    },
  }
}
