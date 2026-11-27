/**
 * What the Runs tab says about a run: who it was about, what happened in plain words, why it was skipped or failed, what approving would do, and which
 * buttons the engine allows for its status.
 *
 * Pure: no React, no network. Tested in lib/workflows/runs.test.ts.
 */
import type { RunStep, WorkflowCatalog, WorkflowRunRow } from '@/services/gtm/workflows'
import { actionLabel } from './catalog'
import { capitalize, recordName, runStatusWord, sentenceCase } from './labels'
import { plainMessage } from './messages'
import { formatValue, joinWithAnd } from './sentence'
import type { ConfirmText } from './status'
import { dayHeading, relativeTime } from './time'

type RunLike = Pick<WorkflowRunRow, 'status' | 'error' | 'attempts' | 'next_attempt_at' | 'decision_note'>

/** The record a run was about, the way a person names it: "Lead 12". */
export function runSubject(run: Pick<WorkflowRunRow, 'entity_type' | 'entity_id'>): string {
  return recordName(run.entity_type, run.entity_id)
}

/** A plain reason for a run that did not simply finish, or null when there is nothing to explain. */
export function runReason(run: RunLike, catalog?: WorkflowCatalog | null, now: Date = new Date()): string | null {
  const error = run.error ? plainMessage(run.error, catalog) : null
  switch (run.status) {
    case 'failed': {
      const tries = run.attempts > 1 ? ` after ${run.attempts} tries` : ''
      return `Failed${tries}${error ? `: ${error}` : '.'}`
    }
    case 'skipped': return error ?? 'Skipped.'
    case 'retry_wait': return `Hit a temporary problem. It will try again ${relativeTime(run.next_attempt_at, now)}.${error ? ` ${error}` : ''}`
    case 'rejected': return run.decision_note ? `Rejected: ${run.decision_note}` : 'Rejected.'
    case 'cancelled': return error ?? 'Cancelled before it ran.'
    case 'pending_approval': return 'Waiting for an administrator to approve it.'
    default: return null
  }
}

/** The engine lets an administrator decide a run that waits, retry one that failed, and cancel one that has not started. */
export const canDecide = (status: string): boolean => status === 'pending_approval'
export const canRetry = (status: string): boolean => status === 'failed'
export const canCancel = (status: string): boolean => ['pending_approval', 'queued', 'retry_wait'].includes(status)

export interface DayGroup<T> {
  heading: string
  runs: T[]
}

/** The runs grouped by the day they started, newest first, each day under "Today", "Yesterday" or its date. */
export function groupRunsByDay<T extends Pick<WorkflowRunRow, 'created_at'>>(runs: readonly T[], now: Date = new Date()): Array<DayGroup<T>> {
  const groups: Array<DayGroup<T>> = []
  for (const run of runs) {
    const heading = dayHeading(run.created_at, now)
    const last = groups[groups.length - 1]
    if (last && last.heading === heading) last.runs.push(run)
    else groups.push({ heading, runs: [run] })
  }
  return groups
}

/** The statuses a person can filter the timeline by, in the order they matter, with the count each has. Only statuses that exist are offered. */
const OUTCOME_ORDER = ['pending_approval', 'failed', 'retry_wait', 'succeeded', 'skipped', 'rejected', 'cancelled', 'queued', 'running'] as const

export function outcomeOptions(counts: Record<string, number>): Array<{ value: string; label: string }> {
  const present = OUTCOME_ORDER.filter((s) => (counts[s] ?? 0) > 0)
  return [{ value: 'all', label: 'All outcomes' }, ...present.map((s) => ({ value: s, label: `${runStatusWord(s)} (${counts[s]})` }))]
}

/** The outcomes the URL may name. */
export const OUTCOME_VALUES: readonly string[] = ['all', ...OUTCOME_ORDER]

/** The question before approving: it runs now, on that record, and cannot be undone. */
export function approveQuestion(run: Pick<WorkflowRunRow, 'entity_type' | 'entity_id' | 'workflow_name'>, actionPhrases: readonly string[]): ConfirmText {
  const does = actionPhrases.length > 0 ? `It will ${joinWithAnd(actionPhrases)}` : 'Its steps will run'
  return {
    title: `Approve this run on ${runSubject(run)}?`,
    description: `${does} now, on ${runSubject(run)}. This cannot be undone.`,
    confirmLabel: 'Approve and run',
  }
}

export function rejectQuestion(run: Pick<WorkflowRunRow, 'entity_type' | 'entity_id'>): ConfirmText {
  return {
    title: `Reject this run on ${runSubject(run)}?`,
    description: `Nothing will be done to ${runSubject(run)}. The reason you gave is kept with the run.`,
    confirmLabel: 'Reject run',
  }
}

export function cancelQuestion(run: Pick<WorkflowRunRow, 'entity_type' | 'entity_id'>): ConfirmText {
  return {
    title: `Cancel this run on ${runSubject(run)}?`,
    description: 'A cancelled run does not happen. The automation keeps reacting to new events.',
    confirmLabel: 'Cancel run',
  }
}

/** The notice after a decision: the same verb the button used. */
export function decisionNotice(kind: 'approve' | 'reject' | 'retry' | 'cancel', status: string): string {
  const verb = { approve: 'Approved', reject: 'Rejected', retry: 'Retried', cancel: 'Cancelled' }[kind]
  return `${verb}. The run is now: ${runStatusWord(status).toLowerCase()}.`
}

export interface StepLine {
  id: number
  title: string
  status: string
  when: string | null
  error: string | null
  details: Array<{ label: string; value: string }>
}

/** What a step of a run did, in the screen's words: "Add a note to the lead", Done, and the few details its result holds. */
export function describeStep(step: RunStep, catalog: WorkflowCatalog | null, now: Date = new Date()): StepLine {
  const title = capitalize(catalog ? actionLabel(catalog, step.action) : sentenceCase(step.action))
  return {
    id: step.id,
    title,
    status: step.status,
    when: step.finished_at ?? step.started_at ? relativeTime(step.finished_at ?? step.started_at, now) : null,
    error: step.error ? plainMessage(step.error, catalog) : null,
    details: summarizeResult(step.result),
  }
}

/** The plain details of a step's result: its reason first, then up to four plain values. Structured values are left out. */
export function summarizeResult(result: unknown): Array<{ label: string; value: string }> {
  if (result === null || result === undefined || result === '') return []
  if (typeof result !== 'object' || Array.isArray(result)) return [{ label: 'Result', value: formatValue(result) }]
  const entries = Object.entries(result as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined && v !== '' && typeof v !== 'object')
  const ranked = [...entries.filter(([k]) => k === 'reason'), ...entries.filter(([k]) => k !== 'reason')]
  return ranked.slice(0, 5).map(([k, v]) => ({ label: sentenceCase(k), value: formatValue(v) }))
}
