/**
 * G2G's chat actions - what the assistant can do from a G2G page.
 *
 * Each definition maps a page to an endpoint G2G already has, through the same service
 * function the page's own button uses. Nothing here talks to the backend directly, and nothing
 * here is a new write path: the signed-in user's token goes with the request, so the backend's
 * own permission checks (`profile`, `platformright`, `task.permission`...) decide, exactly as
 * they do when the user clicks the page's own button. A refusal comes back as the result.
 *
 * The universal flow (`../flow.ts`) supplies preview, Confirm, run-once and result handling.
 */

import type { LaravelContext } from '@/lib/laravel-context'
import type {
  ActionContext,
  ActionOption,
  ActionResult,
  ChatActionDefinition,
} from '../types'

export interface G2gActionApp {
  laravel: LaravelContext
}

export type G2gActionContext = ActionContext<G2gActionApp>

/** The two calls the department action needs, injectable so tests need no network. */
export interface DepartmentActionDeps {
  listDepartments: (context: LaravelContext) => Promise<Array<{ id: number; department: string }>>
  createDepartment: (
    context: LaravelContext,
    data: { department: string; parent_id?: string; code?: string; description?: string },
  ) => Promise<{ data?: { id?: number } } | unknown>
  /** Writes the ledger row for the Activity tab. Must never throw. */
  record: (moduleKey: string, entry: Record<string, unknown>) => Promise<unknown>
}

/** The Department Management screen. A prefix, so its detail routes count as the same page. */
export const DEPARTMENT_PAGE = '/module/organizational-management/organization-setup/department-management'

const MODULE_KEY = 'organizational_management'

export function createDepartmentAction(deps: DepartmentActionDeps): ChatActionDefinition<G2gActionApp> {
  return {
    key: 'create_department',
    label: 'Create a department',
    description: 'Add a department to the organisation, optionally under a parent department.',
    risk: 'write',
    phrases: [
      'create department',
      'create a department',
      'create new department',
      'add department',
      'add a department',
      'add new department',
      'new department',
      'make a department',
    ],
    // `menuId` is set only when the page was resolved from the signed-in user's own, rights-filtered
    // menu. A URL typed for a screen they cannot see resolves to nothing, so the action is not offered.
    appliesTo: (context) => context.menuId !== null && context.pathname.startsWith(DEPARTMENT_PAGE),
    inputs: [
      { key: 'department', label: 'Department name', type: 'text', required: true, maxLength: 191, placeholder: 'e.g. Finance' },
      { key: 'code', label: 'Code', type: 'text', maxLength: 50, placeholder: 'Optional short code' },
      {
        key: 'parent_id',
        label: 'Parent department',
        type: 'select',
        // The organisation's own departments, read live - never a fixed list.
        options: async (context): Promise<ActionOption[]> => {
          const departments = await deps.listDepartments(context.app.laravel)

          return [
            { value: '', label: 'None (top level)' },
            ...departments.map((department) => ({ value: String(department.id), label: department.department })),
          ]
        },
      },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Optional' },
    ],
    preview: (values, _context, labels) => ({
      title: 'Create this department?',
      lines: [
        { label: 'Name', value: values.department },
        { label: 'Code', value: values.code || '—' },
        { label: 'Parent', value: values.parent_id ? (labels.parent_id ?? `Department ${values.parent_id}`) : 'None (top level)' },
        { label: 'Description', value: values.description || '—' },
      ],
    }),
    execute: async (values, context): Promise<ActionResult> => {
      try {
        const response = (await deps.createDepartment(context.app.laravel, {
          department: values.department,
          parent_id: values.parent_id || undefined,
          code: values.code || undefined,
          description: values.description || undefined,
        })) as { data?: { id?: number } } | undefined

        const id = response?.data?.id

        // The ledger line is best-effort: the department exists whether or not it is written.
        await deps.record(MODULE_KEY, {
          operation: 'chat_create_department',
          operation_label: 'Create department (chat)',
          capability: 'conversational',
          status: 'completed',
          message: `Created department "${values.department}" from the chat.`,
          subject_entity_key: 'department',
          subject_id: id,
          subject_label: values.department,
        })

        return { ok: true, message: `Created the department "${values.department}".` }
      } catch (error) {
        // The backend's own reason - a permission refusal, a duplicate name - is the answer.
        return {
          ok: false,
          message: error instanceof Error ? error.message : 'The department could not be created.',
        }
      }
    },
  }
}
