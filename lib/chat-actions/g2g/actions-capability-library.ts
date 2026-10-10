/**
 * Capability Library chat actions: add a skill, a job role, or a KASA entry (knowledge, ability,
 * attitude, behaviour).
 *
 * Each calls the same endpoint the Capability Library's own form (or, for a job role, the department
 * panel's "add a role") calls, as the signed-in user:
 *
 *   create_skill       POST /api/competency/library/skills
 *   create_kasa_entry  POST /api/competency/library/kasa/{type}
 *   create_job_role    POST /api/competency/library/jobroles   (with the department's id, exactly as
 *                      the department panel sends it - not the Library form's by-name guess)
 *
 * THE SERVER NOW ENFORCES WHO MAY (hp_erp routes/api.php, middleware `anyaccess`). These routes took
 * any token, and a plain gate would have broken the two screens that legitimately call them, so the
 * rule is "any door that is genuinely used":
 *
 *   skills, KASA   administrator/HR role, or the `add` right on the Capability Library page
 *   job roles      the same, OR the `edit` right on Department Management (the in-place "add a role"
 *                  in a department's panel - department heads hold it)
 *
 * The controller stamps the token's tenant, refuses a duplicate title in the same category, and drops
 * a department id that is not the caller's organisation's.
 *
 * Every action defines `verify`: it reads the new entry back through the Library's own GET (or the
 * department's role list) and is reported failed unless it is really there.
 */

import type { LaravelContext } from '@/lib/laravel-context'
import type { ActionOption, ActionResult, ChatActionDefinition } from '../types'
import { DEPARTMENT_PAGE, type G2gActionApp } from './actions'
import { failureMessage, onPage, writeLedger, type RecordActivity } from './shared'

export const CAPABILITY_LIBRARY_PAGE = '/module/capability-intelligence/capability-library'

const MODULE_KEY = 'capability_intelligence'

export type KasaType = 'knowledge' | 'ability' | 'attitude' | 'behaviour'
export type LibraryEntryTab = 'skill' | KasaType

/** The four the library's KASA route accepts; a protocol choice, not organisation data. */
export const KASA_TYPES: Array<{ value: KasaType; label: string }> = [
  { value: 'knowledge', label: 'Knowledge' },
  { value: 'ability', label: 'Ability' },
  { value: 'attitude', label: 'Attitude' },
  { value: 'behaviour', label: 'Behaviour' },
]

export interface LibraryEntryRecord {
  title?: string | null
  category?: string | null
  description?: string | null
}

export interface CapabilityLibraryDeps {
  createEntry: (
    context: LaravelContext,
    tab: LibraryEntryTab,
    payload: { title: string; category?: string; description?: string },
  ) => Promise<{ data?: { id?: number } } | unknown>
  /** The Library's own GET for one entry. */
  getEntry: (context: LaravelContext, tab: LibraryEntryTab, id: number) => Promise<LibraryEntryRecord | null>
  listDepartments: (context: LaravelContext) => Promise<Array<{ id: number; department: string }>>
  createJobRole: (
    context: LaravelContext,
    departmentId: string,
    payload: { jobrole: string; description?: string },
  ) => Promise<{ data?: { id?: number } } | unknown>
  /** The department panel's own list of its roles. */
  listDepartmentJobRoles: (context: LaravelContext, departmentId: string) => Promise<Array<{ id: number; jobrole: string }>>
  record: RecordActivity
}

const createdId = (response: unknown): number | undefined => {
  const id = (response as { data?: { id?: number } } | undefined)?.data?.id

  return typeof id === 'number' ? id : undefined
}

const same = (a: string | null | undefined, b: string) => (a ?? '').trim().toLowerCase() === b.trim().toLowerCase()

function entryInputs(titleLabel: string) {
  return [
    { key: 'title', label: titleLabel, type: 'text' as const, required: true, maxLength: 191 },
    { key: 'category', label: 'Category', type: 'text' as const, maxLength: 191, placeholder: 'Optional' },
    { key: 'description', label: 'Description', type: 'textarea' as const, placeholder: 'Optional' },
  ]
}

/** Shared create + read-back for the skill and the four KASA kinds. */
function entryAction(
  deps: CapabilityLibraryDeps,
  spec: {
    key: string
    label: string
    description: string
    phrases: string[]
    noun: string
    titleLabel: string
    tab: (values: Record<string, string>) => LibraryEntryTab
    extraInputs?: ChatActionDefinition<G2gActionApp>['inputs']
    extraValidate?: ChatActionDefinition<G2gActionApp>['validate']
    kindLabel?: (values: Record<string, string>, labels: Record<string, string>) => string
  },
): ChatActionDefinition<G2gActionApp> {
  const created = new WeakMap<ActionResult, { tab: LibraryEntryTab; id?: number; title: string; category: string }>()

  return {
    key: spec.key,
    label: spec.label,
    description: spec.description,
    risk: 'write',
    phrases: spec.phrases,
    appliesTo: (context) => onPage(context, CAPABILITY_LIBRARY_PAGE),
    inputs: [...(spec.extraInputs ?? []), ...entryInputs(spec.titleLabel)],
    validate: spec.extraValidate,
    preview: (values, _context, labels) => ({
      title: `Add this ${spec.noun}?`,
      lines: [
        ...(spec.kindLabel ? [{ label: 'Kind', value: spec.kindLabel(values, labels) }] : []),
        { label: spec.titleLabel, value: values.title },
        { label: 'Category', value: values.category || '—' },
        { label: 'Description', value: values.description || '—' },
      ],
      warning: `It is added to this organisation's Capability Library only; an entry with the same title in the same category is refused.`,
    }),
    execute: async (values, context): Promise<ActionResult> => {
      try {
        const tab = spec.tab(values)
        const response = await deps.createEntry(context.app.laravel, tab, {
          title: values.title,
          category: values.category || undefined,
          description: values.description || undefined,
        })
        const id = createdId(response)

        await writeLedger(deps.record, MODULE_KEY, {
          operation: `chat_create_${tab === 'skill' ? 'skill' : 'kasa_entry'}`,
          operation_label: `Add ${spec.noun} (chat)`,
          message: `Added the ${spec.noun} "${values.title}" to the Capability Library from the chat.`,
          subject_entity_key: tab,
          subject_id: id,
          subject_label: values.title,
        })

        const result: ActionResult = {
          ok: true,
          message: `Added the ${spec.noun} "${values.title}".`,
          link: { label: 'Open Capability Library', href: CAPABILITY_LIBRARY_PAGE },
        }
        created.set(result, { tab, id, title: values.title, category: values.category })

        return result
      } catch (error) {
        return { ok: false, message: failureMessage(error, `The ${spec.noun} could not be added.`) }
      }
    },
    verify: async (_values, context, result) => {
      const target = created.get(result)
      if (!target) return { ok: false, message: 'there is no record of what was added to check.' }
      if (target.id === undefined) return { ok: false, message: 'the server did not return the new entry\'s id, so it cannot be read back.' }

      const record = await deps.getEntry(context.app.laravel, target.tab, target.id)

      if (!record || !same(record.title, target.title)) return { ok: false, message: `the ${spec.noun} "${target.title}" could not be read back.` }
      if (target.category && !same(record.category, target.category)) return { ok: false, message: `the saved category is "${record.category ?? ''}", not "${target.category}".` }

      return { ok: true, message: `Confirmed: "${target.title}" is in the Capability Library.` }
    },
  }
}

export function createSkillAction(deps: CapabilityLibraryDeps): ChatActionDefinition<G2gActionApp> {
  return entryAction(deps, {
    key: 'create_skill',
    label: 'Add a skill',
    description: 'Add a skill to the Capability Library.',
    phrases: ['create skill', 'create a skill', 'add skill', 'add a skill', 'new skill', 'make a skill'],
    noun: 'skill',
    titleLabel: 'Skill name',
    tab: () => 'skill',
  })
}

export function createKasaEntryAction(deps: CapabilityLibraryDeps): ChatActionDefinition<G2gActionApp> {
  return entryAction(deps, {
    key: 'create_kasa_entry',
    label: 'Add a KASA entry',
    description: 'Add a knowledge, ability, attitude or behaviour entry to the Capability Library.',
    phrases: [
      'create kasa entry', 'add kasa entry', 'new kasa entry', 'add knowledge', 'add a knowledge entry',
      'add ability', 'add an ability', 'add attitude', 'add an attitude', 'add behaviour', 'add a behaviour',
    ],
    noun: 'KASA entry',
    titleLabel: 'Title',
    extraInputs: [
      {
        key: 'kasa_type',
        label: 'Kind',
        type: 'select',
        required: true,
        options: async (): Promise<ActionOption[]> => KASA_TYPES.map(({ value, label }) => ({ value, label })),
      },
    ],
    extraValidate: (values): Record<string, string> =>
      values.kasa_type && !KASA_TYPES.some((kind) => kind.value === values.kasa_type)
        ? { kasa_type: 'Choose knowledge, ability, attitude or behaviour.' }
        : {},
    tab: (values) => (KASA_TYPES.some((kind) => kind.value === values.kasa_type) ? (values.kasa_type as KasaType) : 'knowledge'),
    kindLabel: (values, labels) => labels.kasa_type ?? values.kasa_type,
  })
}

export function createJobRoleAction(deps: CapabilityLibraryDeps): ChatActionDefinition<G2gActionApp> {
  const created = new WeakMap<ActionResult, { departmentId: string; id?: number; name: string }>()

  return {
    key: 'create_job_role',
    label: 'Add a job role',
    description: 'Add a job role to a department.',
    risk: 'write',
    phrases: ['create job role', 'create a job role', 'add job role', 'add a job role', 'new job role', 'make a job role'],
    // Both screens that add a role in place: the Capability Library, and a department's own panel.
    appliesTo: (context) => onPage(context, CAPABILITY_LIBRARY_PAGE, DEPARTMENT_PAGE),
    inputs: [
      { key: 'jobrole', label: 'Job role', type: 'text', required: true, maxLength: 191, placeholder: 'e.g. Payroll Analyst' },
      {
        key: 'department_id',
        label: 'Department',
        type: 'select',
        required: true,
        // The organisation's own departments, read live - never a fixed list.
        options: async (context): Promise<ActionOption[]> =>
          (await deps.listDepartments(context.app.laravel)).map((department) => ({
            value: String(department.id),
            label: department.department,
          })),
      },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Optional' },
    ],
    validate: (values): Record<string, string> =>
      values.department_id && !/^\d+$/.test(values.department_id) ? { department_id: 'Choose a department from the list.' } : {},
    preview: (values, _context, labels) => ({
      title: 'Add this job role?',
      lines: [
        { label: 'Job role', value: values.jobrole },
        { label: 'Department', value: labels.department_id ?? `Department ${values.department_id}` },
        { label: 'Description', value: values.description || '—' },
      ],
      warning: 'The role is attached to that department by its id, so it appears in the department\'s role list.',
    }),
    execute: async (values, context): Promise<ActionResult> => {
      try {
        const response = await deps.createJobRole(context.app.laravel, values.department_id, {
          jobrole: values.jobrole,
          description: values.description || undefined,
        })
        const id = createdId(response)

        await writeLedger(deps.record, MODULE_KEY, {
          operation: 'chat_create_job_role',
          operation_label: 'Add job role (chat)',
          message: `Added the job role "${values.jobrole}" from the chat.`,
          subject_entity_key: 'job_role',
          subject_id: id,
          subject_label: values.jobrole,
        })

        const result: ActionResult = {
          ok: true,
          message: `Added the job role "${values.jobrole}".`,
          link: { label: 'Open Capability Library', href: CAPABILITY_LIBRARY_PAGE },
        }
        created.set(result, { departmentId: values.department_id, id, name: values.jobrole })

        return result
      } catch (error) {
        return { ok: false, message: failureMessage(error, 'The job role could not be added.') }
      }
    },
    verify: async (_values, context, result) => {
      const target = created.get(result)
      if (!target) return { ok: false, message: 'there is no record of what was added to check.' }

      const roles = await deps.listDepartmentJobRoles(context.app.laravel, target.departmentId)
      const found = roles.some((role) => (target.id !== undefined ? role.id === target.id : same(role.jobrole, target.name)))

      return found
        ? { ok: true, message: `Confirmed: "${target.name}" is listed under that department.` }
        : { ok: false, message: `"${target.name}" is not in that department's role list.` }
    },
  }
}
