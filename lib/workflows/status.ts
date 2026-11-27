/**
 * What a row of the Automations tab says and allows: the status as a word, the last outcome as a short line, and what its On/Off switch and its menu
 * may do (including the question asked before turning on something that needs approval).
 *
 * Pure: no React, no network. Tested in lib/workflows/status.test.ts.
 */
import type { GtmWorkflow, WorkflowCatalog, WorkflowLastRun } from '@/services/gtm/workflows'
import { consequentialPhrases, needsApproval } from './catalog'
import { runStatusInline, runStatusWord, WORKFLOW_STATUS_WORD } from './labels'
import { joinWithAnd } from './sentence'
import { relativeTime } from './time'
import { RUN_STATUS_TONE, WORKFLOW_STATUS_TONE, type StatusTone } from './tones'

export interface StatusChipModel {
  word: string
  tone: StatusTone | 'problem'
}

/** Draft, On, Paused or Archived. The word carries the meaning. */
export function workflowStatusChip(status: string): StatusChipModel {
  return { word: WORKFLOW_STATUS_WORD[status] ?? status, tone: WORKFLOW_STATUS_TONE[status] ?? 'neutral' }
}

export function runStatusChip(status: string): StatusChipModel {
  return { word: runStatusWord(status), tone: RUN_STATUS_TONE[status] ?? 'neutral' }
}

/**
 * The last outcome as short parts for one line: "Last run 2 hours ago: done", "2 waiting for you", "Never run".
 * `last` is absent on a server that does not send it yet; that reads as never run, which is the honest thing to say about a row with nothing to show.
 */
export function lastOutcomeParts(last: WorkflowLastRun | null | undefined, now: Date = new Date()): string[] {
  const total = last ? last.done_7d + last.failed_7d + last.waiting : 0
  if (!last || (!last.at && !last.status && total === 0)) return ['Never run']

  const parts: string[] = []
  const waitingOnly = last.status === 'pending_approval' && last.waiting > 0
  if (last.at && !waitingOnly) parts.push(`Last run ${relativeTime(last.at, now)}${last.status ? `: ${runStatusInline(last.status)}` : ''}`)
  if (last.waiting > 0) parts.push(`${last.waiting} waiting for you`)
  if (last.failed_7d > 0) parts.push(`${last.failed_7d} failed this week`)
  return parts.length > 0 ? parts : ['Never run']
}

export interface ConfirmText {
  title: string
  description: string
  confirmLabel: string
}

export interface SwitchPlan {
  checked: boolean
  /** Why the switch cannot be used, in a sentence; null when it can. */
  disabledReason: string | null
  /** The status a click moves the automation to. */
  next: 'active' | 'paused' | null
  /** The question asked first. Only turning ON something that needs approval asks; turning off asks nothing. */
  confirm: ConfirmText | null
}

/** What the On/Off switch of a row does. */
export function switchPlan(workflow: GtmWorkflow, catalog: WorkflowCatalog, canWrite: boolean): SwitchPlan {
  const checked = workflow.status === 'active'
  if (!canWrite) return { checked, disabledReason: 'Only administrators can turn automations on or off.', next: null, confirm: null }
  if (workflow.status === 'archived') return { checked: false, disabledReason: 'An archived automation cannot be turned on again.', next: null, confirm: null }
  if (checked) return { checked, disabledReason: null, next: 'paused', confirm: null }
  return {
    checked,
    disabledReason: null,
    next: 'active',
    confirm: needsApproval(workflow, catalog) ? turnOnQuestion(workflow, catalog) : null,
  }
}

/** The question before turning on an automation whose runs wait for a person, with what approving really does. */
export function turnOnQuestion(workflow: Pick<GtmWorkflow, 'name' | 'actions'>, catalog: WorkflowCatalog): ConfirmText {
  const consequences = consequentialPhrases(catalog, workflow.actions)
  const approved = consequences.length > 0 ? ` Once approved, it will ${joinWithAnd(consequences)} on that record.` : ' Once approved, its steps run on that record.'
  return {
    title: `Turn on “${workflow.name}”?`,
    description: `Each time it matches, the run waits in Runs for an administrator to approve it.${approved} It reacts to new events from now on, not to past ones.`,
    confirmLabel: 'Turn on',
  }
}

export function archiveQuestion(workflow: Pick<GtmWorkflow, 'name'>, waiting: number): ConfirmText {
  const cancelled = waiting > 0 ? ` The ${waiting} ${waiting === 1 ? 'run' : 'runs'} waiting for you will be cancelled.` : ' Any run that has not started will be cancelled.'
  return {
    title: `Archive “${workflow.name}”?`,
    description: `An archived automation cannot be turned on or edited again.${cancelled}`,
    confirmLabel: 'Archive',
  }
}

export interface RowMenu {
  /** Edit is offered while the automation is a draft or paused; an automation that is on has to be turned off first. */
  edit: 'hidden' | 'disabled' | 'enabled'
  tryIt: boolean
  duplicate: boolean
  archive: boolean
}

export function rowMenu(status: string, canWrite: boolean): RowMenu {
  if (!canWrite) return { edit: 'hidden', tryIt: false, duplicate: false, archive: false }
  const archived = status === 'archived'
  return {
    edit: archived ? 'hidden' : status === 'active' ? 'disabled' : 'enabled',
    tryIt: !archived,
    duplicate: true,
    archive: !archived,
  }
}

/** The filter of the list by status. Archived automations are not listed by the server, so there is no filter for them. */
export const SHOW_FILTERS = ['all', 'active', 'paused', 'draft'] as const
export type ShowFilter = (typeof SHOW_FILTERS)[number]

export const SHOW_FILTER_LABEL: Readonly<Record<ShowFilter, string>> = {
  all: 'All automations',
  active: 'On',
  paused: 'Paused',
  draft: 'Draft',
}

/** The rows that match the search and the status filter. The search reads the sentence, the name and the description. */
export function filterAutomations(
  items: readonly GtmWorkflow[],
  query: { q: string; show: string },
  sentenceOf: (w: GtmWorkflow) => string,
): GtmWorkflow[] {
  const q = query.q.trim().toLowerCase()
  return items.filter((w) => {
    if (query.show !== 'all' && w.status !== query.show) return false
    if (q === '') return true
    return [w.name, w.description ?? '', sentenceOf(w)].some((text) => text.toLowerCase().includes(q))
  })
}
