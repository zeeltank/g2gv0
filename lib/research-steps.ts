/**
 * What the Generate Signals progress bar shows, worked out only from the run row the backend holds (its `stage`, counts and timestamps).
 * Nothing here is invented: the steps are the stages the backend really writes, a percentage is completed steps over total steps, and a run that
 * did not succeed never reads as 100% or as a success.
 */

export interface RunProgressInput {
  status: string
  stage?: string | null
  stage_message?: string | null
  started_at?: string | null
  completed_at?: string | null
  updated_at?: string | null
  queries_run?: number
  queries_failed?: number
  sources_found?: number
  opportunities_qualified?: number
  opportunities_new?: number
  error_message?: string | null
  error_code?: string | null
}

/** The stages the backend writes while a run works, in order. (`completed` and `failed` are end states, not steps.) */
export const RESEARCH_STEPS = [
  { key: 'queued', label: 'Queued' },
  { key: 'preparing', label: 'Checking product & ICP' },
  { key: 'searching', label: 'Searching' },
  { key: 'collecting', label: 'Reading sources' },
  { key: 'analyzing', label: 'Analysing' },
  { key: 'saving', label: 'Saving' },
] as const

export type ProgressState = 'idle' | 'queued' | 'running' | 'completed' | 'failed'
export type StepStatus = 'done' | 'current' | 'pending'

export interface ProgressView {
  state: ProgressState
  steps: { key: string; label: string; status: StepStatus }[]
  /** 1-based number of the step in progress, or null when it is not known or the run has ended. */
  stepNumber: number | null
  totalSteps: number
  /** Completed steps over total steps. Null when it cannot be told reliably (an unknown stage, or a run that failed). Never 100 unless the run succeeded. */
  percent: number | null
  message: string
  counts: string[]
  /** True when the run finished but could not do everything. */
  limited: boolean
  elapsedSeconds: number | null
  lastUpdateSeconds: number | null
  /** An active run that has sent no progress for STALE_AFTER_SECONDS: it may have stopped. The bar stops animating and says so; the backend closes it itself. */
  stale: boolean
  error: string | null
}

/** A live run saves progress at every search and page, so two quiet minutes means it is not moving. */
export const STALE_AFTER_SECONDS = 120

const END = ['success', 'partial', 'failed', 'skipped']

export function isTerminal(status: string | null | undefined): boolean {
  return END.includes(String(status))
}

const seconds = (from: string | null | undefined, to: number): number | null => {
  if (!from) return null
  const t = Date.parse(from)

  return Number.isNaN(t) ? null : Math.max(0, Math.round((to - t) / 1000))
}

/** "45s", "3m 05s", "1h 02m". */
export function formatDuration(total: number): string {
  const s = Math.max(0, Math.round(total))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`

  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

/** @param nowMs the current time in ms (passed in so the view is a pure function of its inputs) */
export function describeProgress(run: RunProgressInput | null | undefined, nowMs: number): ProgressView {
  const total = RESEARCH_STEPS.length
  if (!run) {
    return { state: 'idle', steps: RESEARCH_STEPS.map((s) => ({ ...s, status: 'pending' as const })), stepNumber: null, totalSteps: total, percent: null, message: '', counts: [], limited: false, elapsedSeconds: null, lastUpdateSeconds: null, stale: false, error: null }
  }

  const index = RESEARCH_STEPS.findIndex((s) => s.key === run.stage)
  const ended = isTerminal(run.status)
  const ok = run.status === 'success' || run.status === 'partial'
  const state: ProgressState = ended ? (ok ? 'completed' : 'failed') : run.stage === 'queued' ? 'queued' : 'running'

  const steps = RESEARCH_STEPS.map((s, i) => ({
    ...s,
    status: (ok ? 'done' : state === 'failed' || index < 0 ? 'pending' : i < index ? 'done' : i === index ? 'current' : 'pending') as StepStatus,
  }))

  const percent = ok ? 100 : state === 'failed' || index < 0 ? null : Math.round((index / total) * 100)

  const counts: string[] = []
  if (run.queries_run) counts.push(`${run.queries_run} ${run.queries_run === 1 ? 'search' : 'searches'}${run.queries_failed ? ` (${run.queries_failed} failed)` : ''}`)
  if (run.sources_found) counts.push(`${run.sources_found} ${run.sources_found === 1 ? 'source' : 'sources'}`)
  if (ok) counts.push(`${run.opportunities_qualified ?? 0} qualified${run.opportunities_new ? ` (${run.opportunities_new} new)` : ''}`)

  const started = run.started_at
  const elapsedSeconds = ended ? (run.completed_at ? seconds(started, Date.parse(run.completed_at)) : null) : seconds(started, nowMs)

  const lastUpdateSeconds = ended ? null : seconds(run.updated_at ?? run.started_at, nowMs)

  return {
    state,
    steps,
    stepNumber: !ended && index >= 0 ? index + 1 : null,
    totalSteps: total,
    percent,
    message: run.stage_message ?? '',
    counts,
    limited: run.status === 'partial',
    elapsedSeconds,
    lastUpdateSeconds,
    stale: !ended && lastUpdateSeconds !== null && lastUpdateSeconds > STALE_AFTER_SECONDS,
    error: state === 'failed' ? run.error_message ?? run.stage_message ?? 'The run did not complete.' : null,
  }
}
