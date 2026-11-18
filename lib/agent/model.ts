import type { AgentRunsParams } from '@/services/agent/api-types'
import type {
  AgentAction, AgentEvidenceRef, AgentOrgState, AgentProposal, AgentRunDetail, AutonomyLevel, DecisionOutcome, ProposalCounts, ProposalStatus, RunStatus,
} from '@/services/agent/types'

/**
 * What the agent screens say, decided in one place and tested without a browser (components render these, they do not invent words). The rules the words
 * keep: a status is a WORD, never only a colour; a cost that is not known is "unknown", never 0; everything a model wrote is plain text; a link is shown
 * only for an address inside this application.
 */

export const AGENT_BADGE = 'Agent'
export const NETWORK_TEXT = 'The request did not reach the server. Check your connection and try again.'
export const NO_VALUE = '—'

// ── Words for the actions ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<AgentAction, string> = {
  add_note: 'Add a note',
  add_task: 'Add a follow-up task',
  confirm_link: 'Confirm a probable link',
}

/** An action this screen knows by its name; one it does not know (a newer server) by its own name made readable, never guessed at. */
export function actionLabel(action: string): string {
  if (action in ACTION_LABELS) return ACTION_LABELS[action as AgentAction]
  const words = action.replace(/[_-]+/g, ' ').trim()
  return words === '' ? 'Action' : words.charAt(0).toUpperCase() + words.slice(1)
}

// ── Words for statuses ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Tone = 'success' | 'pending' | 'error' | 'inactive' | 'processing'

export interface StatusView {
  label: string
  tone: Tone
}

/** The state of a proposal in words: waiting for a person, applied (and by whom), dismissed or failed. */
export function proposalStatus(p: Pick<AgentProposal, 'status' | 'applied_via' | 'decided_by_name'>): StatusView {
  switch (p.status) {
    case 'pending':
      return { label: 'Waiting for you', tone: 'pending' }
    case 'applied':
      if (p.applied_via === 'policy') return { label: 'Applied by the agent', tone: 'success' }
      return { label: p.decided_by_name ? `Applied after ${p.decided_by_name} accepted it` : 'Applied after it was accepted', tone: 'success' }
    case 'dismissed':
      return { label: 'Dismissed', tone: 'inactive' }
    case 'failed':
      return { label: 'Could not be applied', tone: 'error' }
    default:
      return { label: String(p.status), tone: 'inactive' }
  }
}

/** Whether the agent did this itself (the autonomy setting let it): these are the items marked "Agent". */
export function appliedByAgent(p: Pick<AgentProposal, 'status' | 'applied_via'>): boolean {
  return p.status === 'applied' && p.applied_via === 'policy'
}

const RUN_STATUS: Record<RunStatus, StatusView> = {
  completed: { label: 'Completed', tone: 'success' },
  running: { label: 'Running', tone: 'processing' },
  unavailable: { label: 'Unavailable', tone: 'pending' },
  failed: { label: 'Failed', tone: 'error' },
}

export function runStatus(status: string): StatusView {
  return RUN_STATUS[status as RunStatus] ?? { label: status === '' ? NO_VALUE : status, tone: 'inactive' }
}

export const RUN_STATUS_OPTIONS: ReadonlyArray<{ value: '' | RunStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'unavailable', label: 'Unavailable' },
  { value: 'failed', label: 'Failed' },
  { value: 'running', label: 'Running' },
]

const LEVEL_PHRASE: Record<AutonomyLevel, 'alone' | 'asks' | 'off'> = { alone: 'alone', off: 'off', suggest: 'asks', draft: 'asks', approval: 'asks' }

/** "On its own: add a note. Waits for you: confirm a probable link." From the levels the server reports for this organisation. */
export function autonomySentence(autonomy: Record<string, AutonomyLevel>): string {
  const groups: Record<'alone' | 'asks' | 'off', string[]> = { alone: [], asks: [], off: [] }
  for (const [action, level] of Object.entries(autonomy)) groups[LEVEL_PHRASE[level] ?? 'asks'].push(actionLabel(action).toLowerCase())
  const parts: string[] = []
  if (groups.alone.length) parts.push(`On its own: ${groups.alone.join(', ')}.`)
  if (groups.asks.length) parts.push(`Waits for you: ${groups.asks.join(', ')}.`)
  if (groups.off.length) parts.push(`Switched off: ${groups.off.join(', ')}.`)
  return parts.join(' ')
}

// ── Numbers, money, time ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }

/** An amount in the currency it was priced in, to the precision of a model call (a fraction of a rupee). null is "unknown", never 0. */
export function formatCost(cost: number | null, currency: string | null): string {
  if (cost === null || !Number.isFinite(cost)) return 'Cost unknown'
  const fixed = cost.toFixed(4)
  const trimmed = fixed.replace(/0+$/, '')
  const [whole, fraction = ''] = trimmed.split('.')
  const amount = `${whole}.${fraction.padEnd(2, '0')}`
  const code = (currency ?? '').toUpperCase()
  if (code === '') return amount
  return SYMBOLS[code] ? `${SYMBOLS[code]}${amount}` : `${code} ${amount}`
}

export function formatTokens(input: number | null, output: number | null): string {
  if (input === null && output === null) return NO_VALUE
  const n = (v: number | null) => (v === null ? NO_VALUE : v.toLocaleString('en-US'))
  return `${n(input)} in · ${n(output)} out`
}

/** "3 Nov 2026, 20:52". `timeZone` is for tests; a person sees their own. */
export function formatWhen(iso: string | null, timeZone?: string): string {
  if (!iso) return NO_VALUE
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return NO_VALUE
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).format(date).replace(' at ', ', ')
}

/** "11 s", "1 min 4 s"; a dash while a run has not finished. */
export function durationText(startedAt: string | null, finishedAt: string | null): string {
  if (!startedAt || !finishedAt) return NO_VALUE
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
  if (!Number.isFinite(ms) || ms < 0) return NO_VALUE
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes} min ${seconds % 60} s`
}

export function countsText(counts: ProposalCounts): string {
  const parts: string[] = []
  if (counts.applied) parts.push(`${counts.applied} applied`)
  if (counts.pending) parts.push(`${counts.pending} waiting`)
  if (counts.dismissed) parts.push(`${counts.dismissed} dismissed`)
  if (counts.failed) parts.push(`${counts.failed} failed`)
  return parts.length ? parts.join(', ') : 'No proposals'
}

export function triggerText(trigger: string): string {
  return trigger === 'manual' ? 'Run agent button' : trigger === 'cli' ? 'Command line' : trigger
}

// ── The audit trail of a run ────────────────────────────────────────────────────────────────────────────────────────────────────────────

const STEPS: Record<string, string> = {
  read_context: 'Read the organisation’s records',
  model_call: 'Asked the model',
  write_brief: 'Wrote the brief',
  add_note: 'Add a note',
  add_task: 'Add a follow-up task',
  confirm_link: 'Confirm a probable link',
}

/** A step of a run in words. A name the screen does not know is shown as it was written, said plainly to be one: it is what the model asked for and was refused. */
export function stepLabel(tool: string): string {
  return STEPS[tool] ?? `“${tool}” (not an action that exists)`
}

const OUTCOMES: Record<string, string> = { read: 'Read', applied: 'Done', proposed: 'Proposed to a person', denied: 'Refused', error: 'Error' }

export function outcomeLabel(outcome: string): string {
  return OUTCOMES[outcome] ?? outcome
}

const REFUSALS: Record<string, string> = {
  unknown_tool: 'Not an action the agent has.',
  not_an_object: 'The proposal was not in the expected form.',
  out_of_scope_field: 'It tried to name another organisation, a person or a recipient.',
  target_outside_subject: 'It named something other than this organisation.',
  no_evidence: 'It did not cite the records it rests on.',
  too_many_evidence_refs: 'It cited too many records.',
  unknown_evidence_ref: 'It cited a record the agent was never shown.',
  unknown_link_suggestion: 'It named a pair that was not one of the suggestions.',
  empty_text: 'The text was empty.',
  text_too_long: 'The text was too long.',
  empty_title: 'The title was empty.',
  title_too_long: 'The title was too long.',
  bad_due_date: 'The due date was not a real date.',
  due_date_out_of_window: 'The due date was outside the allowed days.',
  no_crm_organisation: 'This organisation has no CRM record to attach it to.',
  policy_off: 'This kind of action is switched off for the organisation.',
  dismissed_before: 'A person had dismissed this before, so it is not offered again.',
  duplicate: 'The same proposal had already been made.',
  too_many_pending: 'Too many proposals were already waiting.',
  over_limit: 'More proposals than the limit.',
  empty_brief: 'The brief was empty.',
  apply_failed: 'It could not be applied.',
  internal_error: 'Something unexpected went wrong.',
  agent_off: 'The agent was switched off.',
}

export function refusalText(code: string | null): string | null {
  if (code === null || code === '') return null
  return REFUSALS[code] ?? code
}

// ── Evidence ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const EVIDENCE_TYPES: Record<string, string> = {
  signal: 'Signal',
  crm_organization: 'CRM organisation',
  gtm_account: 'GTM account',
  crm_opportunity: 'Opportunity',
  gtm_deal: 'Deal',
  note: 'Note',
  task: 'Task',
  org_account: 'This organisation',
  link_suggestion: 'Possible link',
}

/**
 * Types shown as text, not as a link: the page the person is already on, a question on it, and a GTM deal, which has no page of its own (the Deals screen is a
 * list). The last one matters for runs stored before the server stopped sending an address for it: those still say /gtm/deals/{id}, which is a 404.
 */
const NOT_LINKED = new Set(['org_account', 'link_suggestion', 'gtm_deal'])

/** An address inside this application and nothing else: a path from the root. Not a scheme, not another site, not a protocol-relative address. */
export function safeInternalPath(url: unknown): string | null {
  if (typeof url !== 'string') return null
  return /^\/(?![/\\])[^\s\\]*$/.test(url) ? url : null
}

export interface EvidenceItem {
  key: string
  typeLabel: string
  label: string
  href: string | null
}

export function evidenceItems(refs: readonly AgentEvidenceRef[]): EvidenceItem[] {
  return refs.map((ref) => ({
    key: `${ref.type}:${ref.id}`,
    typeLabel: EVIDENCE_TYPES[ref.type] ?? 'Record',
    label: ref.label.trim() === '' ? `${EVIDENCE_TYPES[ref.type] ?? 'Record'} ${ref.id}` : ref.label,
    href: NOT_LINKED.has(ref.type) ? null : safeInternalPath(ref.url),
  }))
}

// ── Whether the agent may be run now ────────────────────────────────────────────────────────────────────────────────────────────────────

export const NO_RUN_RIGHT_TEXT = 'You can read what the agent did here, but running it, and accepting or dismissing its proposals, needs the edit right on Organizations.'
export const SWITCHED_OFF_TEXT = 'The agent is switched off for your organisation.'

export type RunGate = { allowed: true } | { allowed: false; reason: string }

/** Whether the Run agent button may be pressed, and when it may not, why, in a sentence (the reason is shown, not hidden in a tooltip). */
export function runGate(state: Pick<AgentOrgState, 'can' | 'agent'>): RunGate {
  if (!state.can.run) return { allowed: false, reason: NO_RUN_RIGHT_TEXT }
  if (!state.agent.enabled) return { allowed: false, reason: state.agent.unavailable_reason ?? SWITCHED_OFF_TEXT }
  if (state.agent.unavailable_reason) return { allowed: false, reason: state.agent.unavailable_reason }
  if (state.agent.runs_today >= state.agent.daily_cap) {
    return { allowed: false, reason: `The agent has already run ${state.agent.daily_cap} times today on this organisation. Try again tomorrow.` }
  }
  return { allowed: true }
}

// ── What a run or a decision answers with ───────────────────────────────────────────────────────────────────────────────────────────────

export interface Notice {
  tone: 'success' | 'error'
  text: string
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The sentence after a run: what the agent did on its own, what it left for the person, or why it did not run. */
export function runNotice(run: Pick<AgentRunDetail, 'status' | 'message' | 'proposal_counts'>): Notice {
  if (run.status === 'unavailable') return { tone: 'error', text: run.message ?? 'The agent could not run.' }
  if (run.status === 'failed') return { tone: 'error', text: run.message ?? 'The run failed.' }
  if (run.status === 'running') return { tone: 'success', text: 'The agent is still running.' }
  const done = run.proposal_counts.applied
  const waiting = run.proposal_counts.pending
  if (done === 0 && waiting === 0) return { tone: 'success', text: 'The agent finished. It found nothing that needs doing.' }
  const parts: string[] = []
  if (done > 0) parts.push(`did ${plural(done, 'thing', 'things')} on its own`)
  if (waiting > 0) parts.push(`left ${plural(waiting, 'proposal', 'proposals')} for you`)
  return { tone: 'success', text: `The agent finished. It ${parts.join(' and ')}.` }
}

/** The sentence after accepting a proposal. */
export function acceptNotice(action: string, outcome: DecisionOutcome): string {
  if (outcome === 'already_applied') return 'This had already been applied.'
  switch (action) {
    case 'add_note': return 'The note was added to the organisation.'
    case 'add_task': return 'The follow-up task was added to the organisation’s schedule.'
    case 'confirm_link': return 'The records were linked as one organisation.'
    default: return 'Done.'
  }
}

export function dismissNotice(outcome: DecisionOutcome): string {
  return outcome === 'already_dismissed' ? 'This had already been dismissed.' : 'Dismissed. The agent will not suggest this again.'
}

/** After a link was confirmed, the identity that now holds the organisation, when it is not the one on this page (the two were merged). */
export function mergedInto(resultRef: string | null, currentId: number): number | null {
  const match = /^g2g_org_accounts:(\d+)$/.exec(resultRef ?? '')
  if (!match) return null
  const id = Number(match[1])
  return id !== currentId ? id : null
}

// ── Failures ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type LoadFailureKind = 'forbidden' | 'notFound' | 'error'

const statusOf = (error: unknown): number | null => {
  const status = (error as { status?: unknown } | null)?.status
  return typeof status === 'number' ? status : null
}

const messageOf = (error: unknown): string | null => {
  const message = (error as { message?: unknown } | null)?.message
  return typeof message === 'string' && message.trim() !== '' ? message : null
}

export function codeOf(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code : null
}

/** What went wrong in a sentence: the server's own when it gave one, otherwise a plain one for the status. */
export function failureText(error: unknown, fallback: string): string {
  const status = statusOf(error)
  if (status === 403) return NO_RUN_RIGHT_TEXT
  if (status === 404) return 'This organisation or proposal can no longer be found. It may have been removed.'
  if (status !== null) return messageOf(error) ?? `The server answered ${status}.`
  if (error instanceof TypeError) return NETWORK_TEXT
  return messageOf(error) ?? fallback
}

/** How a failed read is shown: not allowed (no retry can help), not found, or an error to retry. */
export function loadFailure(error: unknown, fallback: string): { kind: LoadFailureKind; message: string } {
  const status = statusOf(error)
  if (status === 403) return { kind: 'forbidden', message: 'You do not have access to the agent.' }
  if (status === 404) return { kind: 'notFound', message: 'This organisation could not be found. It may have been removed, or it is not in your organisation.' }
  return { kind: 'error', message: failureText(error, fallback) }
}

// ── The history list ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface RunFilters {
  status: '' | RunStatus
  dateFrom: string
  dateTo: string
}

export const EMPTY_FILTERS: RunFilters = { status: '', dateFrom: '', dateTo: '' }
export const RUNS_PER_PAGE = 20

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** A sentence when the dates cannot be asked for (a day that is not a day, or an end before the start); otherwise null. */
export function filterProblem(f: RunFilters): string | null {
  for (const day of [f.dateFrom, f.dateTo]) {
    if (day !== '' && !DAY.test(day)) return 'Dates are written year-month-day.'
  }
  if (f.dateFrom !== '' && f.dateTo !== '' && f.dateFrom > f.dateTo) return 'The end date is before the start date.'
  return null
}

/** The query for the list: only what was chosen. */
export function runsParams(f: RunFilters, page: number): AgentRunsParams {
  const params: AgentRunsParams = { page, per_page: RUNS_PER_PAGE }
  if (f.status !== '') params.status = f.status
  if (f.dateFrom !== '') params.date_from = f.dateFrom
  if (f.dateTo !== '') params.date_to = f.dateTo
  return params
}

/** Completed runs as a share of the runs that have finished (a run still under way is neither). null when none has finished. */
export function successRate(summary: { completed: number; failed: number; unavailable: number }): number | null {
  const finished = summary.completed + summary.failed + summary.unavailable
  return finished === 0 ? null : Math.round((summary.completed / finished) * 100)
}

/** Whether a proposal can still be decided by a person. */
export function isWaiting(status: ProposalStatus | string): boolean {
  return status === 'pending'
}
