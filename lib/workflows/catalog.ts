/**
 * What the server's catalog offers, shaped for the pickers and forms of the Automations tab: the events and actions as grouped, searchable options; the
 * facts a condition can ask about; and the typed parameters of each action.
 *
 * The server sends each action's parameters typed, as `param_fields`. Until it does (and on an older server) only `params` is there, a record of name to a
 * description in words ("whole number 0-365, optional"), and `paramsOf` reads that the way the old form did. `param_fields` always wins when it is there.
 *
 * Pure: no React, no network. Tested in lib/workflows/catalog.test.ts.
 */
import type { CatalogAction, CatalogField, CatalogParam, GtmWorkflow, WorkflowAction, WorkflowCatalog } from '@/services/gtm/workflows'
import { actionGroup, capitalize, groupRank, humanize, LIST_OPERATORS, lowerFirst, NUMBER_OPERATORS, OPERATOR_LABELS, sentenceCase, stripParenthetical, triggerGroup } from './labels'

export type ParamKind = 'string' | 'text' | 'number' | 'bool' | 'enum' | 'user' | 'json'

export interface ParamOption {
  value: string
  label: string
}

export interface ParamDef {
  key: string
  label: string
  kind: ParamKind
  required: boolean
  options?: ParamOption[]
  /** A short line under the field. */
  hint?: string
  min?: number
  max?: number
  /** The text may carry details of the record, written in double curly brackets. */
  facts: boolean
}

/** Parameters whose text is filled in with details of the record when the automation runs. */
const FACT_KEYS: ReadonlySet<string> = new Set(['subject', 'title', 'text', 'body', 'description', 'reason'])
const KINDS: ReadonlySet<string> = new Set(['string', 'text', 'number', 'bool', 'enum', 'user'])

/** Reads one parameter described in words, as the server did before it sent typed ones. */
export function guessParamDef(key: string, description: string): ParamDef {
  const text = description.trim()
  const required = /\brequired\b/.test(text) && !/\boptional\b/.test(text)
  const hintMatch = /\(([^)]*)\)/.exec(text)
  const hint = hintMatch?.[1] ? capitalize(hintMatch[1].replace(/^e\.g\.\s*/i, 'for example ')) : undefined
  const facts = text.includes('{{')
  const base = text.replace(/\(.*?\)/g, '').split(',')[0].trim()
  const common = { key, label: sentenceCase(key), required, hint, facts }

  if (text.startsWith('object')) return { ...common, kind: 'json', facts: false }
  if (base.startsWith('whole number') || base.startsWith('id ')) {
    const range = /(\d+)\s*-\s*(\d+)/.exec(base)
    const kind: ParamKind = /(^|_)user_id$/.test(key) ? 'user' : 'number'
    return { ...common, kind, ...(range && kind === 'number' ? { min: Number(range[1]), max: Number(range[2]) } : {}) }
  }
  if (base.includes(' | ')) {
    const options = base.split('|').map((s) => s.trim()).filter(Boolean)
    if (options.length === 2 && options.includes('true') && options.includes('false')) return { ...common, kind: 'bool' }
    return { ...common, kind: 'enum', options: options.map((value) => ({ value, label: sentenceCase(value) })) }
  }
  return { ...common, kind: key === 'body' || key === 'text' || key === 'description' ? 'text' : 'string' }
}

function fromTyped(p: CatalogParam): ParamDef {
  const structured = p.format === 'json' || (p.type as string) === 'object' || (p.type as string) === 'json'
  const kind: ParamKind = structured ? 'json' : KINDS.has(p.type) ? (p.type as ParamKind) : 'string'
  const options = Array.isArray(p.options)
    ? p.options.map((o) => (typeof o === 'string' ? { value: o, label: sentenceCase(o) } : { value: o.value, label: o.label ?? sentenceCase(o.value) }))
    : undefined
  return {
    key: p.key,
    label: p.label || sentenceCase(p.key),
    kind,
    required: Boolean(p.required),
    ...(options && options.length > 0 ? { options } : {}),
    ...(p.help ? { hint: p.help } : {}),
    ...(typeof p.min === 'number' ? { min: p.min } : {}),
    ...(typeof p.max === 'number' ? { max: p.max } : {}),
    facts: p.placeholders ?? (kind !== 'json' && (kind === 'text' || FACT_KEYS.has(p.key))),
  }
}

/** The parameters of an action, typed: `param_fields` when the server sent it, otherwise read from the descriptions in words. */
export function paramsOf(action: CatalogAction | undefined): ParamDef[] {
  if (!action) return []
  if (Array.isArray(action.param_fields)) return action.param_fields.map(fromTyped)
  return Object.entries(action.params ?? {}).map(([key, description]) => guessParamDef(key, String(description)))
}

/** A parameter that is a list of choices but arrived with none: the form falls back to a text box. */
export function effectiveKind(def: ParamDef): ParamKind {
  return def.kind === 'enum' && (!def.options || def.options.length === 0) ? 'string' : def.kind
}

export function fieldsOf(catalog: WorkflowCatalog, trigger: string): Record<string, CatalogField> {
  return catalog.triggers[trigger]?.fields ?? {}
}

/** The label of a fact, or the fact's name made readable when the catalog does not have it (an old automation). */
export function fieldLabel(catalog: WorkflowCatalog, trigger: string, field: string): string {
  return fieldsOf(catalog, trigger)[field]?.label ?? humanize(field)
}

/** The operators a fact can use: a number can be compared, text cannot; a yes/no only says is or is not. */
export function operatorsFor(catalog: WorkflowCatalog, field: CatalogField | undefined): string[] {
  const all = catalog.operators.length > 0 ? catalog.operators : Object.keys(OPERATOR_LABELS)
  const type = field?.type
  return all.filter((op) => {
    if (NUMBER_OPERATORS.includes(op)) return type === 'number'
    if (op === 'contains') return type === 'string' || type === 'enum'
    if (LIST_OPERATORS.includes(op)) return type !== 'bool'
    return true
  })
}

export function actionOf(catalog: WorkflowCatalog, type: string): CatalogAction | undefined {
  return catalog.actions[type]
}

export function actionLabel(catalog: WorkflowCatalog, type: string): string {
  const action = catalog.actions[type]
  return action ? stripParenthetical(action.label) : sentenceCase(type)
}

/** An action's label for the middle of a sentence ("book a meeting"). */
export function actionPhrase(catalog: WorkflowCatalog, type: string): string {
  return lowerFirst(actionLabel(catalog, type))
}

export function triggerLabel(catalog: WorkflowCatalog, key: string): string {
  const trigger = catalog.triggers[key]
  return trigger ? stripParenthetical(trigger.label) : humanize(key)
}

export interface PickerOption {
  value: string
  label: string
  group: string
  /** A second line, such as the detail the catalog put in brackets. */
  hint?: string
  disabled?: boolean
  /** Why it cannot be chosen. */
  reason?: string
}

const bracketed = (text: string): string | undefined => {
  const match = /\(([^)]*)\)/.exec(text)
  return match?.[1] ? capitalize(match[1]) : undefined
}

function byGroup(options: PickerOption[]): PickerOption[] {
  return options
    .map((option, index) => ({ option, index }))
    .sort((a, b) => groupRank(a.option.group) - groupRank(b.option.group) || a.index - b.index)
    .map((x) => x.option)
}

/** Every event an automation can start from, grouped by the kind of record it is about. */
export function triggerOptions(catalog: WorkflowCatalog): PickerOption[] {
  return byGroup(Object.entries(catalog.triggers).map(([value, t]) => ({
    value,
    label: stripParenthetical(t.label),
    group: triggerGroup(t.entity),
    hint: bracketed(t.label),
  })))
}

/** Why an action cannot follow this event, or null when it can. */
export function actionUnavailableReason(catalog: WorkflowCatalog, type: string, trigger: string): string | null {
  const action = catalog.actions[type]
  const provides = catalog.triggers[trigger]?.provides ?? []
  const missing = (action?.needs ?? []).filter((need) => !provides.includes(need))
  if (missing.length === 0) return null
  return `Needs an event about a ${missing.map(humanize).join(' and a ')}`
}

/** Every action, grouped by the kind of record it works on. Those that cannot follow the chosen event are listed but cannot be chosen. */
export function actionOptions(catalog: WorkflowCatalog, trigger: string): PickerOption[] {
  return byGroup(Object.entries(catalog.actions).map(([value, a]) => {
    const reason = actionUnavailableReason(catalog, value, trigger)
    return {
      value,
      label: stripParenthetical(a.label),
      group: actionGroup(a.needs),
      hint: reason ?? bracketed(a.label),
      ...(reason ? { disabled: true, reason } : {}),
    }
  }))
}

export interface OptionGroup {
  group: string
  options: PickerOption[]
}

export function groupOptions(options: readonly PickerOption[]): OptionGroup[] {
  const groups: OptionGroup[] = []
  for (const option of options) {
    const last = groups.find((g) => g.group === option.group)
    if (last) last.options.push(option)
    else groups.push({ group: option.group, options: [option] })
  }
  return groups
}

/** The options that match what was typed, in the label, the hint or the group name. */
export function filterOptions(options: readonly PickerOption[], query: string): PickerOption[] {
  const q = query.trim().toLowerCase()
  if (q === '') return [...options]
  return options.filter((o) => o.label.toLowerCase().includes(q) || (o.hint ?? '').toLowerCase().includes(q) || o.group.toLowerCase().includes(q))
}

/** The details of the record an automation can insert into its text, by label. */
export function factChoices(catalog: WorkflowCatalog, trigger: string): Array<{ key: string; label: string }> {
  return Object.entries(fieldsOf(catalog, trigger)).map(([key, f]) => ({ key, label: f.label }))
}

/** True when the action does something a person should approve first. */
export function isConsequential(catalog: WorkflowCatalog, type: string): boolean {
  return catalog.actions[type]?.consequential === true
}

/** The actions of an automation that wait for approval, as phrases ("book a meeting"). */
export function consequentialPhrases(catalog: WorkflowCatalog, actions: readonly WorkflowAction[]): string[] {
  return actions.filter((a) => isConsequential(catalog, a.type)).map((a) => actionPhrase(catalog, a.type))
}

/** True when this automation's runs wait for a person: the server says so, or a consequential action or the approval switch makes it so. */
export function needsApproval(workflow: Pick<GtmWorkflow, 'needs_approval' | 'requires_approval' | 'actions'>, catalog: WorkflowCatalog): boolean {
  if (typeof workflow.needs_approval === 'boolean') return workflow.needs_approval
  return Boolean(workflow.requires_approval) || workflow.actions.some((a) => isConsequential(catalog, a.type))
}
