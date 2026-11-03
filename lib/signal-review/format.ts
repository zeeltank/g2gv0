import type { HistoryDecisionCode, HistoryVia, ReviewDecisionCode, ReviewHistoryEntry, ReviewStatus } from '@/services/signal-review/types'
import type { SignalRun } from '@/services/signal-review/runs-service'

/**
 * Words and number formats for the Signal Review screen's decision dialog, history and runs. Pure, so the rules that matter (what an unknown cost looks
 * like, what a missing reason is called, which runs are "manual") are tested without a browser.
 */

/** Shown wherever a value is not known. A known zero is written as zero; an unknown is never turned into one. */
export const NO_VALUE = '—'

// ── Decisions and statuses ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** What a history row says was decided. `Follow-up` is stored, but every screen calls it "Contacted". */
const DECISION_LABELS: Record<HistoryDecisionCode, string> = {
  reviewed: 'Reviewed',
  dismissed: 'Not relevant',
  follow_up: 'Contacted',
  reopened: 'Reopened',
  promoted: 'Promoted to lead',
}

export function decisionLabel(decision: HistoryDecisionCode): string {
  return DECISION_LABELS[decision] ?? decision
}

/** The decision dialog's title for each way of opening it. */
const DIALOG_TITLES: Record<ReviewDecisionCode, string> = {
  dismissed: 'Not relevant',
  follow_up: 'Contacted',
  reviewed: 'Reviewed',
  reopened: 'Reopen',
}

export function dialogTitle(mode: ReviewDecisionCode): string {
  return DIALOG_TITLES[mode]
}

/** The decision dialog's submit button for each way of opening it. */
const SUBMIT_LABELS: Record<ReviewDecisionCode, string> = {
  dismissed: 'Mark not relevant',
  follow_up: 'Mark contacted',
  reviewed: 'Mark reviewed',
  reopened: 'Reopen',
}

export function submitLabel(mode: ReviewDecisionCode): string {
  return SUBMIT_LABELS[mode]
}

const STATUS_LABELS: Record<ReviewStatus, string> = {
  New: 'Needs decision',
  Reviewed: 'Reviewed',
  'Follow-up': 'Contacted',
  Dismissed: 'Not relevant',
}

/** What a stored `review_status` is called on screen. */
export function statusLabel(status: ReviewStatus): string {
  return STATUS_LABELS[status] ?? status
}

export type StatusTone = 'neutral' | 'success' | 'warning' | 'error'

const STATUS_TONES: Record<ReviewStatus, StatusTone> = { New: 'neutral', Reviewed: 'success', 'Follow-up': 'warning', Dismissed: 'error' }

export function statusTone(status: ReviewStatus): StatusTone {
  return STATUS_TONES[status] ?? 'neutral'
}

/**
 * The reason a row carries: the server's label, else the raw code (a code that has since left the list is still the truth), else nothing.
 * Nothing is invented for a row that never had a reason.
 */
export function reasonText(entry: Pick<ReviewHistoryEntry, 'reason_code' | 'reason_label'>): string | null {
  const label = entry.reason_label?.trim()
  if (label) return label
  const code = entry.reason_code?.trim()
  return code || null
}

/**
 * A small honest tag for rows that did not come from this screen, so a missing reason is not read as an omission by the person who decided.
 * Rows made here (`signal_review`) and by turning a signal into a lead (`promote`) need none.
 */
export function viaTag(via: HistoryVia): { label: string; explanation: string } | null {
  switch (via) {
    case 'legacy_screen':
      return { label: 'original screen', explanation: 'Decided on the original Signals screen, which does not ask for a reason or a note.' }
    case 'backfill':
      return { label: 'earlier record', explanation: 'Rebuilt from the status the signal already had when history began. The reason and note were never recorded.' }
    default:
      return null
  }
}

/** Who decided, in words. A null name is "not recorded", never a guess. */
export function decidedByText(name: string | null | undefined): string {
  const trimmed = name?.trim()
  return trimmed ? `by ${trimmed}` : 'by someone (not recorded)'
}

// ── Dates ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const toTime = (iso: string | null | undefined): number | null => {
  if (!iso) return null
  const time = Date.parse(iso)
  return Number.isNaN(time) ? null : time
}

/**
 * "3 Nov 2026, 10:15" in the viewer's time zone (or `timeZone`, for tests). Built from parts so the order and the month names do not change with the
 * browser's language data. A null is `—`; a string that is not a date is shown as it came, so nothing is hidden.
 */
export function formatDateTime(iso: string | null | undefined, options: { timeZone?: string } = {}): string {
  if (!iso) return NO_VALUE
  const time = toTime(iso)
  if (time === null) return iso

  const parts = new Intl.DateTimeFormat('en-US', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: options.timeZone,
  }).formatToParts(new Date(time))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''

  return `${part('day')} ${part('month')} ${part('year')}, ${part('hour')}:${part('minute')}`
}

const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? '' : 's'}`

/** "5 minutes ago", "in 2 days", "just now". Null when the date cannot be read. */
export function relativeTime(iso: string | null | undefined, now: Date = new Date()): string | null {
  const time = toTime(iso)
  if (time === null) return null

  const seconds = Math.round((now.getTime() - time) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 45) return 'just now'

  const minutes = Math.floor(abs / 60)
  const hours = Math.floor(abs / 3600)
  const days = Math.floor(abs / 86400)
  const phrase = abs < 3600 ? plural(Math.max(minutes, 1), 'minute')
    : abs < 86400 ? plural(hours, 'hour')
      : days < 30 ? plural(days, 'day')
        : days < 365 ? plural(Math.floor(days / 30), 'month')
          : plural(Math.floor(days / 365), 'year')

  return seconds >= 0 ? `${phrase} ago` : `in ${phrase}`
}

// ── Numbers ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const isNumber = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value)

/** "42 s", "3 min 05 s", "1 h 02 min". Null (not finished, or never measured) is `—`. */
export function formatDuration(seconds: number | null | undefined): string {
  if (!isNumber(seconds) || seconds < 0) return NO_VALUE
  const whole = Math.round(seconds)
  if (whole < 60) return `${whole} s`
  if (whole < 3600) return `${Math.floor(whole / 60)} min ${String(whole % 60).padStart(2, '0')} s`
  return `${Math.floor(whole / 3600)} h ${String(Math.floor((whole % 3600) / 60)).padStart(2, '0')} min`
}

/**
 * US dollars. Null is unknown and shows `—`; a recorded zero (a run that used no AI) shows `$0.00`. Under a dollar four decimals are kept, because
 * a research run costs cents and two decimals would round most of them to the same figure.
 */
export function formatCostUsd(value: number | null | undefined): string {
  if (!isNumber(value)) return NO_VALUE
  if (value === 0) return '$0.00'
  if (value >= 1) return `$${value.toFixed(2)}`
  if (value < 0.0001) return '<$0.0001'
  return `$${value.toFixed(4)}`
}

/** A whole number with thousands separators; null is `—`, a recorded 0 is `0`. */
export function formatCount(value: number | null | undefined): string {
  return isNumber(value) ? value.toLocaleString('en-US') : NO_VALUE
}

// ── Runs ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A sum over the runs that have a figure. `total` is null when no run has one, so "nothing recorded" is never shown as zero. */
export interface KnownSum {
  total: number | null
  known: number
  unknown: number
}

export function sumKnown(values: ReadonlyArray<number | null | undefined>): KnownSum {
  const known = values.filter(isNumber)
  return {
    total: known.length > 0 ? known.reduce((sum, value) => sum + value, 0) : null,
    known: known.length,
    unknown: values.length - known.length,
  }
}

/** Input plus output tokens of a run; unknown unless both were recorded. */
export function totalTokens(run: Pick<SignalRun, 'ai_input_tokens' | 'ai_output_tokens'>): number | null {
  return isNumber(run.ai_input_tokens) && isNumber(run.ai_output_tokens) ? run.ai_input_tokens + run.ai_output_tokens : null
}

export function isManual(run: Pick<SignalRun, 'trigger'>): boolean {
  return run.trigger.trim().toLowerCase() === 'manual'
}

const STATUS_WORDS: Record<string, string> = {
  running: 'Running', success: 'Success', partial: 'Partial', failed: 'Failed', skipped: 'Skipped', timed_out: 'Timed out',
}

export function runStatusLabel(status: string): string {
  const key = status.trim().toLowerCase()
  return STATUS_WORDS[key] ?? (status.trim() || NO_VALUE)
}

export function runStatusTone(status: string): StatusTone | 'info' {
  switch (status.trim().toLowerCase()) {
    case 'success': return 'success'
    case 'partial': return 'warning'
    case 'failed':
    case 'timed_out': return 'error'
    case 'running': return 'info'
    default: return 'neutral'
  }
}

/** The kinds of run whose reason the table spells out. */
export function runNeedsReason(status: string): boolean {
  return ['failed', 'skipped', 'timed_out'].includes(status.trim().toLowerCase())
}

/** Why a failed or skipped run stopped, from what the run recorded; says so when it recorded nothing. */
export function runReason(run: Pick<SignalRun, 'error_message' | 'stage_message' | 'error_code'>): string {
  return run.error_message ?? run.stage_message ?? run.error_code ?? 'No reason recorded.'
}

/** Newest first by start time (a run that never recorded one goes last), then by id. Returns a copy. */
export function sortRunsNewestFirst(runs: readonly SignalRun[]): SignalRun[] {
  return [...runs].sort((a, b) => {
    const at = toTime(a.started_at)
    const bt = toTime(b.started_at)
    if (at !== bt) {
      if (at === null) return 1
      if (bt === null) return -1
      return bt - at
    }
    return b.id - a.id
  })
}

export interface RunsSummary {
  total: number
  /** The newest run, or null when there are none. */
  last: SignalRun | null
  counts: { success: number; partial: number; failed: number; skipped: number; other: number }
  /** True only when there is at least one run and every one of them was started by hand. */
  allManual: boolean
  /** Runs that were not started by hand. */
  scheduled: number
  cost: KnownSum
  tokens: KnownSum
  searches: KnownSum
}

export function summariseRuns(runs: readonly SignalRun[]): RunsSummary {
  const counts = { success: 0, partial: 0, failed: 0, skipped: 0, other: 0 }
  for (const run of runs) {
    const key = run.status.trim().toLowerCase()
    if (key === 'success' || key === 'partial' || key === 'failed' || key === 'skipped') counts[key] += 1
    else counts.other += 1
  }
  const manual = runs.filter(isManual).length

  return {
    total: runs.length,
    last: sortRunsNewestFirst(runs)[0] ?? null,
    counts,
    allManual: runs.length > 0 && manual === runs.length,
    scheduled: runs.length - manual,
    cost: sumKnown(runs.map((run) => run.ai_cost_usd)),
    tokens: sumKnown(runs.map(totalTokens)),
    searches: sumKnown(runs.map((run) => run.search_requests)),
  }
}
