/**
 * The words and rules of the Approvals tab of the Workflows page, kept apart from the screen so they can be tested without a browser.
 *
 * VOCABULARY. The engine calls a place where a sign-off can happen a "point" and the ladder of approvers an organisation puts there a "chain"; neither word means
 * anything to a person using the screen. On the screen a point is an APPROVAL ("Leave approval", "in HRMS"), a chain is an APPROVAL FLOW, and a flow is made of STEPS
 * (the server's own messages say "Step 3: ..." and are shown as they come, so the rungs stay "steps"). A flow's status is shown as a WORD, never a lock or a "coming
 * soon": Draft (saved for later), On (new requests follow it), Off (new requests skip it).
 *
 * The condition of a flow is the engine's own small grammar (hp_erp app/Services/Platform/WorkflowConditionEvaluator.php): `field operator number` clauses joined by
 * AND, numbers only, no OR and no brackets. `parseCondition` accepts exactly what the evaluator would read, so the rows the screen shows are the rules the engine applies,
 * and anything else stays a line of text that is saved as typed.
 */

import type { ChipTone } from '@/lib/org-accounts/tones'
import type {
  EscalationAction,
  PlatformRegistryPayload,
  RegistryOption,
  SimulationResult,
  WorkflowChain,
  WorkflowPoint,
  WorkflowStatus,
  WorkflowStep,
} from './workflow'

// ── Steps ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type DraftStep = Omit<WorkflowStep, 'id' | 'order'> & { id?: string }

export function emptyStep(): DraftStep {
  return {
    name: '',
    approver_type: 'reporting_manager',
    approver: '',
    sla_hours: 24,
    on_breach: 'remind',
    allow_delegate: true,
    require_comment: false,
  }
}

/** A stored or suggested step as the editor's draft shape. */
export function toDraftStep(step: WorkflowStep): DraftStep {
  return {
    id: step.id,
    name: step.name ?? '',
    approver_type: step.approver_type ?? 'reporting_manager',
    approver: step.approver ?? '',
    sla_hours: Number(step.sla_hours ?? 0),
    on_breach: step.on_breach ?? 'none',
    allow_delegate: step.allow_delegate ?? true,
    require_comment: step.require_comment ?? false,
  }
}

/** The server's limits (hp_erp WorkflowController): at most 12 steps, a wait of 0 to 2,160 hours (90 days), a name of up to 120 characters. */
export const MAX_STEPS = 12
export const MAX_SLA_HOURS = 2160
export const MAX_STEP_NAME = 120

export interface StepErrors {
  name?: string
  approver?: string
  sla?: string
  breach?: string
}

/** Whether a breach action needs a time to happen after (it does for every action but "none"). */
export function breachNeedsTime(onBreach: EscalationAction, slaHours: number): boolean {
  return onBreach !== 'none' && Number(slaHours) === 0
}

export function stepErrors(step: DraftStep, approverTypes: readonly RegistryOption[]): StepErrors {
  const errors: StepErrors = {}
  const name = step.name.trim()

  if (name === '') errors.name = 'Name this step, for example “Reporting manager”.'
  else if (name.length > MAX_STEP_NAME) errors.name = `Use ${MAX_STEP_NAME} characters or fewer.`

  const type = approverTypes.find((option) => option.key === step.approver_type)

  if (type?.needs_value && step.approver.trim() === '') {
    errors.approver = step.approver_type === 'role' ? 'Name the role that approves this step.' : 'Enter the id of the person who approves this step.'
  }

  const sla = Number(step.sla_hours)

  if (!Number.isInteger(sla) || sla < 0 || sla > MAX_SLA_HOURS) {
    errors.sla = `Enter a whole number of hours from 0 to ${new Intl.NumberFormat('en-IN').format(MAX_SLA_HOURS)}.`
  } else if (breachNeedsTime(step.on_breach, sla)) {
    errors.breach = 'Set a time above, or there is nothing for this to happen after.'
  }

  return errors
}

// ── Status words ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The word of each status. The word carries the meaning; the look of the chip only helps (lib/org-accounts/tones.ts). */
export const FLOW_STATUS_WORD: Record<WorkflowStatus, string> = { draft: 'Draft', active: 'On', disabled: 'Off' }

export const FLOW_STATUS_TONE: Record<WorkflowStatus, ChipTone> = { draft: 'neutral', active: 'positive', disabled: 'muted' }

/** What each status does, in one clause, for the status field and the flow's own line. */
export const FLOW_STATUS_MEANING: Record<WorkflowStatus, string> = {
  draft: 'saved for later, nothing waits for it',
  active: 'new requests follow it',
  disabled: 'new requests skip it',
}

export const FLOW_STATUSES: readonly WorkflowStatus[] = ['draft', 'active', 'disabled']

export type Coverage = 'on' | 'no-flow' | 'none-on' | 'not-in-use'

/**
 * Where an approval stands, from the reader's side: is somebody signing requests off? An approval the product does not read yet is a fourth answer, not a failure:
 * a flow saved there is a plan, and the screen says so rather than showing the same mark as an approval that works.
 */
export function pointCoverage(point: Pick<WorkflowPoint, 'enforced' | 'workflows'>): Coverage {
  if (!point.enforced) return 'not-in-use'
  if (point.workflows.some((flow) => flow.status === 'active')) return 'on'

  return point.workflows.length === 0 ? 'no-flow' : 'none-on'
}

export const COVERAGE_WORD: Record<Coverage, string> = {
  on: 'A flow is on',
  'no-flow': 'No approval flow',
  'none-on': 'No flow is on',
  'not-in-use': 'Not in use yet',
}

export const COVERAGE_TONE: Record<Coverage, ChipTone> = { on: 'positive', 'no-flow': 'caution', 'none-on': 'caution', 'not-in-use': 'muted' }

export function plural(count: number, one: string, many = `${one}s`): string {
  return count === 1 ? one : many
}

/** The line above the list: how many of the approvals that work have a flow turned on, and how many cannot be used yet. */
export function approvalsSummary(points: readonly Pick<WorkflowPoint, 'enforced' | 'workflows'>[], moduleLabel: string | null): string {
  if (points.length === 0) return ''

  const inUse = points.filter((point) => point.enforced)
  const covered = inUse.filter((point) => pointCoverage(point) === 'on').length
  const waiting = points.length - inUse.length
  const where = moduleLabel ? ` in ${moduleLabel}` : ''

  if (inUse.length === 0) {
    return `${waiting} ${plural(waiting, 'approval')}${where} can be set up, but nothing uses ${waiting === 1 ? 'it' : 'them'} yet.`
  }

  const waitingLine = waiting > 0 ? ` ${waiting} more can be set up, but nothing uses ${waiting === 1 ? 'it' : 'them'} yet.` : ''

  return `${covered} of ${inUse.length} ${plural(inUse.length, 'approval')}${where} ${inUse.length === 1 ? 'has' : 'have'} a flow turned on.${waitingLine}`
}

// ── Conditions ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The six operators the engine reads, with the words a person says. */
export const CONDITION_OPERATORS = [
  { op: '>', label: 'is more than' },
  { op: '>=', label: 'is at least' },
  { op: '<', label: 'is less than' },
  { op: '<=', label: 'is at most' },
  { op: '=', label: 'is' },
  { op: '!=', label: 'is not' },
] as const

export type ConditionOp = (typeof CONDITION_OPERATORS)[number]['op']

export interface ConditionRow {
  field: string
  op: ConditionOp
  value: string
}

/** The engine tries the longest operators first, so `>=` is never read as `>` followed by `=`. This is its own order. */
const SCAN_ORDER: readonly ConditionOp[] = ['>=', '<=', '!=', '=', '>', '<']
const FIELD = /^[A-Za-z_][A-Za-z0-9_.]*$/
const NUMBER = /^-?(\d+\.?\d*|\.\d+)$/

const opLabel = (op: ConditionOp): string => CONDITION_OPERATORS.find((entry) => entry.op === op)?.label ?? op

function parseClause(clause: string): ConditionRow | null {
  for (const op of SCAN_ORDER) {
    const at = clause.indexOf(op)
    if (at === -1) continue

    const field = clause.slice(0, at).trim()
    const value = clause.slice(at + op.length).trim()

    return FIELD.test(field) && NUMBER.test(value) ? { field, op, value } : null
  }

  return null
}

/** The rows of a condition the engine would read, `[]` for an empty one, and `null` for text the rows cannot show (it is then kept as text). */
export function parseCondition(text: string): ConditionRow[] | null {
  const trimmed = text.trim()
  if (trimmed === '') return []

  const rows: ConditionRow[] = []

  for (const clause of trimmed.split(/\s+AND\s+/i)) {
    const row = parseClause(clause.trim())
    if (!row) return null
    rows.push(row)
  }

  return rows
}

export function formatCondition(rows: readonly ConditionRow[]): string {
  return rows.map((row) => `${row.field.trim()} ${row.op} ${row.value.trim()}`).join(' AND ')
}

/** Rows in words ("leave_days is more than 5 and leave_type_id is 3"). */
export function describeRows(rows: readonly ConditionRow[]): string {
  return rows.map((row) => `${row.field} ${opLabel(row.op)} ${row.value}`).join(' and ')
}

/** The condition in words. Text the rows cannot show comes back as typed. */
export function describeCondition(text: string): string {
  const rows = parseCondition(text)

  return rows === null ? text.trim() : describeRows(rows)
}

export interface ConditionRowErrors {
  field?: string
  value?: string
}

export function conditionRowErrors(row: ConditionRow): ConditionRowErrors {
  const errors: ConditionRowErrors = {}

  if (!FIELD.test(row.field.trim())) errors.field = 'Name the value to compare, for example leave_days. Use letters, digits and underscores.'
  if (!NUMBER.test(row.value.trim())) errors.value = 'Enter a number, such as 5 or 12.5.'

  return errors
}

// ── Sentences about a flow ───────────────────────────────────────────────────────────────────────────────────────────────────────────

const number = (n: number): string => new Intl.NumberFormat('en-IN').format(n)

export function flowSentence(flow: Pick<WorkflowChain, 'step_count' | 'total_sla_hours' | 'condition'>): string {
  const steps = `${flow.step_count} ${plural(flow.step_count, 'step')}`
  const time = flow.total_sla_hours > 0 ? `, up to ${number(flow.total_sla_hours)} ${plural(flow.total_sla_hours, 'hour')}` : ''
  const when = flow.condition.trim() === '' ? 'Applies to every request.' : `Applies when ${describeCondition(flow.condition)}.`

  return `${steps}${time}. ${when}`
}

/**
 * One plain sentence about why a flow may not be the one in use, or null when there is nothing to say. Written from the status and the condition, not taken from the
 * server's own reason, which speaks of chains and fallbacks. (A flow with a condition cannot be judged without a real request, so it is not called "unused".)
 */
export function flowNote(flow: Pick<WorkflowChain, 'status' | 'condition' | 'effective'>): string | null {
  if (flow.status === 'draft') return 'Saved for later. Nothing waits for it until you turn it on.'
  if (flow.status === 'disabled') return 'Switched off. New requests skip it.'
  if (flow.effective || flow.condition.trim() !== '') return null

  return 'An earlier flow with no condition is used instead. Turn that one off, or add a condition here.'
}

/** The sentence for the result of the "which flow applies" check, from the server's reason code. */
export function previewReasonSentence(reason: string): string {
  switch (reason) {
    case 'no_active_chain':
      return 'No flow is turned on for this approval.'
    case 'no_matching_chain':
      return 'None of the flows that are on match these values.'
    case 'not_installed':
      return 'Approval flows are not set up for this organisation yet.'
    default:
      return 'No flow applies.'
  }
}

export function previewSummary(result: Pick<SimulationResult, 'matched' | 'reason' | 'workflow'>): string {
  if (result.matched && result.workflow) {
    const flow = result.workflow
    const time = flow.total_sla_hours > 0 ? `, up to ${number(flow.total_sla_hours)} ${plural(flow.total_sla_hours, 'hour')}` : ''

    return `“${flow.name}” would apply: ${flow.step_count} ${plural(flow.step_count, 'step')}${time}.`
  }

  return `No saved flow would apply. ${previewReasonSentence(result.reason)}`
}

export interface PreviewPair {
  field: string
  value: string
}

/** The sample values the check sends: only a named field with a number in it. The rest is left out, as it always was. */
export function previewContext(pairs: readonly PreviewPair[]): Record<string, number> {
  const context: Record<string, number> = {}

  for (const { field, value } of pairs) {
    const key = field.trim()
    if (key === '' || value.trim() === '' || Number.isNaN(Number(value))) continue
    context[key] = Number(value)
  }

  return context
}

// ── Modules ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The label of a module, from the registry's own list; a module the list does not know keeps its key rather than disappearing. */
export function moduleLabelFor(key: string, modules: PlatformRegistryPayload['modules']): string {
  return modules.find((module) => module.key === key)?.label ?? key
}

/** The modules that actually have an approval, in the registry's own order, then any the registry does not list. */
export function orderedModuleKeys(points: readonly Pick<WorkflowPoint, 'module'>[], modules: PlatformRegistryPayload['modules']): string[] {
  return [
    ...modules.map((module) => module.key).filter((key) => points.some((point) => point.module === key)),
    ...Array.from(new Set(points.map((point) => point.module))).filter((key) => !modules.some((module) => module.key === key)),
  ]
}

// ── The form ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type RejectMode = WorkflowChain['on_reject']

export interface FlowForm {
  id: number | null
  /** The engine's key of the approval. Never shown. */
  flowKey: string
  name: string
  description: string
  /** `rows` while the condition fits the helper; `text` for anything the engine accepts that the rows cannot show, or by choice. */
  conditionMode: 'rows' | 'text'
  conditionRows: ConditionRow[]
  conditionText: string
  status: WorkflowStatus
  steps: DraftStep[]
  onReject: RejectMode
  notifyRequester: boolean
  /** The flow was On when it was opened: the server lets an On flow be edited and turned off even where nothing uses the approval. */
  wasOn: boolean
}

/** A new flow starts as a draft, so nothing begins to wait for it while somebody is still experimenting. */
export function newFlowForm(point: Pick<WorkflowPoint, 'key' | 'label' | 'suggested_steps'>): FlowForm {
  return {
    id: null,
    flowKey: point.key,
    name: point.label,
    description: '',
    conditionMode: 'rows',
    conditionRows: [],
    conditionText: '',
    status: 'draft',
    steps: point.suggested_steps.length > 0 ? point.suggested_steps.map(toDraftStep) : [emptyStep()],
    onReject: 'return_to_requester',
    notifyRequester: true,
    wasOn: false,
  }
}

export function editFlowForm(flow: WorkflowChain): FlowForm {
  const rows = parseCondition(flow.condition)

  return {
    id: flow.id,
    flowKey: flow.flow_key,
    name: flow.name,
    description: flow.description ?? '',
    conditionMode: rows === null ? 'text' : 'rows',
    conditionRows: rows ?? [],
    conditionText: flow.condition,
    status: flow.status,
    steps: flow.steps.map(toDraftStep),
    onReject: flow.on_reject,
    notifyRequester: flow.notify_requester,
    wasOn: flow.status === 'active',
  }
}

export function formCondition(form: Pick<FlowForm, 'conditionMode' | 'conditionRows' | 'conditionText'>): string {
  return form.conditionMode === 'rows' ? formatCondition(form.conditionRows) : form.conditionText.trim()
}

/** What is sent on Save: the same keys the screen has always sent. */
export function flowPayload(form: FlowForm) {
  return {
    flow_key: form.flowKey,
    name: form.name,
    description: form.description,
    condition: formCondition(form),
    status: form.status,
    steps: form.steps,
    on_reject: form.onReject,
    notify_requester: form.notifyRequester,
  }
}

/** Whether anything that would be saved differs from how the form was opened. */
export function isFlowFormDirty(opened: FlowForm, now: FlowForm): boolean {
  return JSON.stringify(flowPayload(opened)) !== JSON.stringify(flowPayload(now))
}

export interface FlowFormErrors {
  status?: string
  steps?: string
  conditionRows: ConditionRowErrors[]
  step: StepErrors[]
}

export function hasFlowFormErrors(errors: FlowFormErrors): boolean {
  return Boolean(errors.status || errors.steps)
    || errors.conditionRows.some((row) => Object.keys(row).length > 0)
    || errors.step.some((step) => Object.keys(step).length > 0)
}

/**
 * A warning, not an error: the server saves any text as the condition, so a flow written before the rows existed can still be edited. The engine reads only the grammar
 * above and a condition it cannot read never applies, which is the one thing worth saying where the text is typed.
 */
export function conditionWarning(form: Pick<FlowForm, 'conditionMode' | 'conditionText'>): string | null {
  if (form.conditionMode !== 'text' || form.conditionText.trim() === '' || parseCondition(form.conditionText) !== null) return null

  return 'The engine reads only a value, a comparison and a number, joined by AND, for example leave_days > 5 AND leave_type_id = 3. This text is not in that form, so the flow would never apply.'
}

/** The server's own rules, checked first, so the common mistakes are met with a sentence next to the field instead of a refusal after Save. */
export function validateFlowForm(form: FlowForm, context: { enforced: boolean; approverTypes: readonly RegistryOption[] }): FlowFormErrors {
  const errors: FlowFormErrors = {
    conditionRows: form.conditionMode === 'rows' ? form.conditionRows.map(conditionRowErrors) : [],
    step: form.steps.map((step) => stepErrors(step, context.approverTypes)),
  }

  if (form.status === 'active' && !form.wasOn && !context.enforced) {
    errors.status = 'Nothing in the product uses this approval yet, so a flow cannot be turned on here. Save it as a draft instead.'
  }

  if (form.steps.length > MAX_STEPS) errors.steps = `An approval flow can have at most ${MAX_STEPS} steps.`
  else if (form.status === 'active' && form.steps.length === 0) errors.steps = 'Add at least one step before turning this flow on, or nobody can approve anything.'

  return errors
}
