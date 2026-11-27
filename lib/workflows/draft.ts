/**
 * The builder's form as plain data: what the person has typed, how it becomes the request the server takes, what is still missing, and whether anything
 * changed since the form was opened (the drawer refuses to close dirty).
 *
 * Every value is held as TEXT while the person edits, the way a text box holds it, and typed (number, yes/no, list) only when the request is made. The
 * condition values are typed from the catalog's fact types and the action parameters from the catalog's typed parameter list (lib/workflows/catalog.ts).
 *
 * Pure: no React, no network. Tested in lib/workflows/draft.test.ts.
 */
import type { CatalogField, GtmWorkflow, WorkflowAction, WorkflowCatalog, WorkflowCondition, WorkflowInput } from '@/services/gtm/workflows'
import { actionOf, effectiveKind, fieldsOf, isConsequential, operatorsFor, paramsOf, type ParamDef } from './catalog'
import { LIST_OPERATORS, NO_VALUE_OPERATORS } from './labels'
import { describeAutomation } from './sentence'

export const MAX_CONDITIONS = 10
export const MAX_ACTIONS = 6
export const DEFAULT_RUNS_PER_DAY = 100

export interface ConditionDraft {
  /** A stable key for the row while it is on screen; never sent. */
  key: string
  field: string
  op: string
  value: string
}

export interface ActionDraft {
  key: string
  type: string
  params: Record<string, string>
}

export interface WorkflowDraft {
  name: string
  description: string
  trigger: string
  conditions: ConditionDraft[]
  actions: ActionDraft[]
  requiresApproval: boolean
  maxRunsPerDay: string
}

let counter = 0
export const newKey = (): string => `row-${++counter}`

const toText = (v: unknown): string => (v === undefined || v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v))

export function emptyDraft(): WorkflowDraft {
  return { name: '', description: '', trigger: '', conditions: [], actions: [], requiresApproval: false, maxRunsPerDay: String(DEFAULT_RUNS_PER_DAY) }
}

export function conditionFromApi(c: WorkflowCondition): ConditionDraft {
  return { key: newKey(), field: c.field, op: c.op, value: Array.isArray(c.value) ? c.value.map(toText).join(', ') : toText(c.value) }
}

export function actionFromApi(a: WorkflowAction): ActionDraft {
  return { key: newKey(), type: a.type, params: Object.fromEntries(Object.entries(a.params ?? {}).map(([k, v]) => [k, toText(v)])) }
}

export function draftFromWorkflow(w: GtmWorkflow): WorkflowDraft {
  return {
    name: w.name,
    description: w.description ?? '',
    trigger: w.trigger_event,
    conditions: w.conditions.map(conditionFromApi),
    actions: w.actions.map(actionFromApi),
    requiresApproval: Boolean(w.requires_approval),
    maxRunsPerDay: String(w.max_runs_per_day ?? DEFAULT_RUNS_PER_DAY),
  }
}

/** A copy for "Duplicate": the same definition under a new name, as a draft the person can adjust. */
export function duplicateInput(w: GtmWorkflow): WorkflowInput {
  return {
    name: `${w.name} (copy)`.slice(0, 191),
    description: w.description,
    trigger_event: w.trigger_event,
    conditions: w.conditions,
    actions: w.actions,
    requires_approval: Boolean(w.requires_approval),
    max_runs_per_day: w.max_runs_per_day,
  }
}

/** The form without its row keys, as text: two forms with the same words are the same form. */
export function snapshot(d: WorkflowDraft): string {
  return JSON.stringify({
    name: d.name.trim(),
    description: d.description.trim(),
    trigger: d.trigger,
    conditions: d.conditions.map(({ field, op, value }) => ({ field, op, value: value.trim() })),
    actions: d.actions.map(({ type, params }) => ({ type, params: Object.fromEntries(Object.entries(params).filter(([, v]) => v.trim() !== '').map(([k, v]) => [k, v.trim()]).sort()) })),
    requiresApproval: d.requiresApproval,
    maxRunsPerDay: d.maxRunsPerDay.trim(),
  })
}

export function isDirty(initial: WorkflowDraft, current: WorkflowDraft): boolean {
  return snapshot(initial) !== snapshot(current)
}

/** Choosing another event clears the conditions (the facts differ) and drops the steps that cannot follow it. */
export function changeTrigger(draft: WorkflowDraft, catalog: WorkflowCatalog, trigger: string): { draft: WorkflowDraft; droppedSteps: number; droppedConditions: number } {
  const provides = catalog.triggers[trigger]?.provides ?? []
  const actions = draft.actions.filter((a) => (actionOf(catalog, a.type)?.needs ?? []).every((need) => provides.includes(need)))
  return {
    draft: { ...draft, trigger, conditions: [], actions },
    droppedSteps: draft.actions.length - actions.length,
    droppedConditions: draft.conditions.length,
  }
}

export function addCondition(draft: WorkflowDraft, catalog: WorkflowCatalog): WorkflowDraft {
  const fields = fieldsOf(catalog, draft.trigger)
  const field = Object.keys(fields)[0]
  if (!field || draft.conditions.length >= MAX_CONDITIONS) return draft
  const op = operatorsFor(catalog, fields[field])[0] ?? 'eq'
  return { ...draft, conditions: [...draft.conditions, { key: newKey(), field, op, value: '' }] }
}

export function patchCondition(draft: WorkflowDraft, key: string, patch: Partial<Omit<ConditionDraft, 'key'>>): WorkflowDraft {
  return { ...draft, conditions: draft.conditions.map((c) => (c.key === key ? { ...c, ...patch } : c)) }
}

/** Choosing another fact keeps the operator when it still makes sense for it, and clears the value. */
export function changeConditionField(draft: WorkflowDraft, catalog: WorkflowCatalog, key: string, field: string): WorkflowDraft {
  const allowed = operatorsFor(catalog, fieldsOf(catalog, draft.trigger)[field])
  const current = draft.conditions.find((c) => c.key === key)
  const op = current && allowed.includes(current.op) ? current.op : allowed[0] ?? 'eq'
  return patchCondition(draft, key, { field, op, value: '' })
}

/** Choosing another operator clears a value that no longer fits (a list becomes a single value, and none needs no value). */
export function changeConditionOp(draft: WorkflowDraft, key: string, op: string): WorkflowDraft {
  const current = draft.conditions.find((c) => c.key === key)
  const listChanged = current ? LIST_OPERATORS.includes(current.op) !== LIST_OPERATORS.includes(op) : false
  return patchCondition(draft, key, { op, ...(NO_VALUE_OPERATORS.includes(op) || listChanged ? { value: '' } : {}) })
}

export function removeCondition(draft: WorkflowDraft, key: string): WorkflowDraft {
  return { ...draft, conditions: draft.conditions.filter((c) => c.key !== key) }
}

export function addAction(draft: WorkflowDraft, type: string): WorkflowDraft {
  if (draft.actions.length >= MAX_ACTIONS) return draft
  return { ...draft, actions: [...draft.actions, { key: newKey(), type, params: {} }] }
}

export function changeActionType(draft: WorkflowDraft, key: string, type: string): WorkflowDraft {
  return { ...draft, actions: draft.actions.map((a) => (a.key === key ? { ...a, type, params: {} } : a)) }
}

export function patchActionParam(draft: WorkflowDraft, key: string, param: string, value: string): WorkflowDraft {
  return { ...draft, actions: draft.actions.map((a) => (a.key === key ? { ...a, params: { ...a.params, [param]: value } } : a)) }
}

export function removeAction(draft: WorkflowDraft, key: string): WorkflowDraft {
  return { ...draft, actions: draft.actions.filter((a) => a.key !== key) }
}

/** Puts a detail of the record, written in double curly brackets, into a text at the caret (or at the end). */
export function insertFact(text: string, fact: string, caret?: number | null): { text: string; caret: number } {
  const token = `{{${fact}}}`
  const at = caret === null || caret === undefined || caret < 0 || caret > text.length ? text.length : caret
  return { text: text.slice(0, at) + token + text.slice(at), caret: at + token.length }
}

// ---- the request ------------------------------------------------------------------------------------------------------------------------------------

/** "a, b, c" to ["a", "b", "c"]. */
export function splitList(text: string): string[] {
  return text.split(',').map((s) => s.trim()).filter(Boolean)
}

const isNumeric = (text: string): boolean => text.trim() !== '' && !Number.isNaN(Number(text))
/** The server's numbers for a step are whole numbers. */
const isWhole = (text: string): boolean => /^-?[0-9]+$/.test(text.trim())

function typedValue(text: string, field: CatalogField | undefined): unknown {
  if (field?.type === 'number' && isNumeric(text)) return Number(text)
  if (field?.type === 'bool') return text === 'true'
  return text
}

export function conditionToApi(c: ConditionDraft, field: CatalogField | undefined): WorkflowCondition {
  if (NO_VALUE_OPERATORS.includes(c.op)) return { field: c.field, op: c.op }
  if (LIST_OPERATORS.includes(c.op)) return { field: c.field, op: c.op, value: splitList(c.value).map((v) => typedValue(v, field)) }
  return { field: c.field, op: c.op, value: typedValue(c.value.trim(), field) }
}

function paramValue(def: ParamDef, raw: string): unknown {
  switch (effectiveKind(def)) {
    case 'number':
    case 'user':
      return isNumeric(raw) ? Number(raw) : raw
    case 'bool':
      return raw === 'true'
    case 'json':
      try { return JSON.parse(raw) } catch { return raw }
    default:
      return raw
  }
}

export function actionToApi(a: ActionDraft, defs: readonly ParamDef[]): WorkflowAction {
  const params: Record<string, unknown> = {}
  for (const def of defs) {
    const raw = (a.params[def.key] ?? '').trim()
    if (raw !== '') params[def.key] = paramValue(def, raw)
  }
  return { type: a.type, params }
}

/** The request a save sends. `trigger_event` goes only with a new automation: the server refuses a changed event on an existing one. */
export function draftToInput(draft: WorkflowDraft, catalog: WorkflowCatalog, creating: boolean): WorkflowInput {
  const fields = fieldsOf(catalog, draft.trigger)
  const limit = Number(draft.maxRunsPerDay)
  return {
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    ...(creating ? { trigger_event: draft.trigger } : {}),
    conditions: draft.conditions.map((c) => conditionToApi(c, fields[c.field])),
    actions: draft.actions.map((a) => actionToApi(a, paramsOf(actionOf(catalog, a.type)))),
    requires_approval: draft.requiresApproval,
    max_runs_per_day: Number.isFinite(limit) && limit >= 1 ? Math.round(limit) : DEFAULT_RUNS_PER_DAY,
  }
}

/** The control a condition's value is typed into: none, a yes/no, one choice, several choices, a number, or text (one value or a comma-separated list). */
export type ValueControl = 'none' | 'yesno' | 'choice' | 'choices' | 'number' | 'text' | 'texts'

export function valueControl(field: CatalogField | undefined, op: string): ValueControl {
  if (NO_VALUE_OPERATORS.includes(op)) return 'none'
  const list = LIST_OPERATORS.includes(op)
  if (field?.type === 'bool') return 'yesno'
  if (field?.type === 'enum' && field.options && field.options.length > 0) return list ? 'choices' : 'choice'
  if (field?.type === 'number' && !list) return 'number'
  return list ? 'texts' : 'text'
}

/** True when the automation's runs will wait for a person, as far as the form can tell: the approval switch, or a step that needs one. */
export function draftNeedsApproval(draft: WorkflowDraft, catalog: WorkflowCatalog): boolean {
  return draft.requiresApproval || draft.actions.some((a) => isConsequential(catalog, a.type))
}

/** The live sentence at the top of the builder. A condition with no value yet reads as "…", never as a wrong value. */
export function draftSentence(draft: WorkflowDraft, catalog: WorkflowCatalog, locale?: string): string {
  const fields = fieldsOf(catalog, draft.trigger)
  const conditions = draft.conditions.map((c): WorkflowCondition => {
    if (NO_VALUE_OPERATORS.includes(c.op)) return { field: c.field, op: c.op }
    return c.value.trim() === '' ? { field: c.field, op: c.op, value: '' } : conditionToApi(c, fields[c.field])
  })
  return describeAutomation({ trigger: draft.trigger, conditions, actions: draft.actions.filter((a) => a.type !== ''), needsApproval: draftNeedsApproval(draft, catalog) }, catalog, locale)
}

// ---- what is still missing --------------------------------------------------------------------------------------------------------------------------

/** The key under which a step's "choose what it does" message is kept, beside the messages for its details. */
export const STEP_TYPE = '__type'

export interface DraftProblems {
  name?: string
  trigger?: string
  steps?: string
  limit?: string
  /** By condition key. */
  conditions: Record<string, string>
  /** By step key, then by parameter name. */
  params: Record<string, Record<string, string>>
  /** Every message in reading order, for the summary and the focus. */
  all: string[]
}

/** What is missing or wrong before a save is sent. The server checks the rest and its words are shown beside the field they are about. */
export function validateDraft(draft: WorkflowDraft, catalog: WorkflowCatalog): DraftProblems {
  const p: DraftProblems = { conditions: {}, params: {}, all: [] }
  const fail = (message: string) => { p.all.push(message); return message }

  if (draft.name.trim() === '') p.name = fail('Give the automation a name.')
  else if (draft.name.trim().length > 191) p.name = fail('Use a name of 191 characters or fewer.')

  if (draft.trigger === '') p.trigger = fail('Choose what starts the automation.')

  const fields = fieldsOf(catalog, draft.trigger)
  draft.conditions.forEach((c, i) => {
    if (NO_VALUE_OPERATORS.includes(c.op)) return
    const field = fields[c.field]
    const n = i + 1
    if (c.value.trim() === '') p.conditions[c.key] = fail(`Condition ${n}: enter a value to compare with.`)
    else if (field?.type === 'number' && !(LIST_OPERATORS.includes(c.op) ? splitList(c.value).every(isNumeric) : isNumeric(c.value))) p.conditions[c.key] = fail(`Condition ${n}: use a number.`)
  })

  if (draft.actions.length === 0) p.steps = fail('Add at least one step.')
  draft.actions.forEach((a, i) => {
    const errors: Record<string, string> = {}
    if (a.type === '') errors[STEP_TYPE] = fail(`Step ${i + 1}: choose what it should do.`)
    for (const def of paramsOf(actionOf(catalog, a.type))) {
      const raw = (a.params[def.key] ?? '').trim()
      const kind = effectiveKind(def)
      if (raw === '') {
        if (def.required) errors[def.key] = fail(`Step ${i + 1}: fill in “${def.label}”.`)
        continue
      }
      if ((kind === 'number' || kind === 'user') && !isWhole(raw)) errors[def.key] = fail(`Step ${i + 1}: “${def.label}” needs a whole number.`)
      else if (kind === 'number' && ((def.min !== undefined && Number(raw) < def.min) || (def.max !== undefined && Number(raw) > def.max))) {
        errors[def.key] = fail(`Step ${i + 1}: “${def.label}” must be between ${def.min ?? '…'} and ${def.max ?? '…'}.`)
      } else if (kind === 'json') {
        try { JSON.parse(raw) } catch { errors[def.key] = fail(`Step ${i + 1}: “${def.label}” is not valid. Check the brackets and quotes.`) }
      }
    }
    if (Object.keys(errors).length > 0) p.params[a.key] = errors
  })

  const limit = Number(draft.maxRunsPerDay)
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) p.limit = fail('Use a whole number from 1 to 1000 for the daily limit.')
  return p
}

export function hasDraftProblems(p: DraftProblems): boolean {
  return p.all.length > 0
}
