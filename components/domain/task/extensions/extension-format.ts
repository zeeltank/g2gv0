import type { DeadlineExtension, ExtensionQueueSummary } from '@/types/task-management'
import { parseDay } from '../task-detail/date-utils'

/** 1 -> "1st", 2 -> "2nd", 11 -> "11th": the way a person says which request on a task this is. */
export function ordinal(n: number): string {
  const lastTwo = n % 100
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'
  return `${n}${suffix}`
}

/** `18 h` under a day, `2.1 days` from a day up. Null when nothing has been decided yet. */
export function formatDecisionTime(hours: number | null): string {
  if (hours === null || hours === undefined || Number.isNaN(hours)) return '-'
  if (hours < 24) return `${Math.max(0, Math.round(hours))} h`
  const days = Number((hours / 24).toFixed(1))
  return days === 1 ? '1 day' : `${days} days`
}

/** The approval rate as `78%`, or `-` before anything has been decided (null from the server, never 0). */
export function formatApprovalRate(rate: number | null): string {
  return rate === null || rate === undefined ? '-' : `${Math.round(rate * 100)}%`
}

/** How many requests the approval rate is a rate OF. A rate with no denominator misleads: 100% of 1 is not 100% of 40. */
export function decidedCount(summary: ExtensionQueueSummary): number {
  return summary.approved + summary.rejected
}

/**
 * `2026-11-27 14:05:00` or an ISO string, as `27 Nov 2026, 14:05`.
 * A date with no time is shown as a date: inventing a midnight would be a claim about when it happened.
 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-'
  if (value.length <= 10) {
    const day = parseDay(value)
    return day ? day.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : value
  }
  const then = new Date(value.includes('T') ? value : value.replace(' ', 'T'))
  if (Number.isNaN(then.getTime())) return value
  return then.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** `+7d`; a shortened request (negative) keeps its sign. Null when the server could not work it out. */
export function formatDaysRequested(days: number | null | undefined): string | null {
  if (days === null || days === undefined || Number.isNaN(days)) return null
  return days >= 0 ? `+${days}d` : `${days}d`
}

/** Only a pending request this viewer may decide can be ticked. The server says which; roles are never guessed here. */
export function isSelectable(row: DeadlineExtension): boolean {
  return row.status === 'pending' && row.can_decide === true
}

/** Why a row's checkbox is disabled, for its title: a disabled control with no reason reads as a bug. */
export function whyNotSelectable(row: DeadlineExtension): string {
  if (row.status !== 'pending') return `Already ${row.status}: only pending requests can be decided.`
  return 'Only an administrator or the owner of this task can decide it.'
}

/** Days a pending request has waited, never negative; 0 for anything already decided. */
export function waitingDays(row: DeadlineExtension): number {
  return row.status === 'pending' ? Math.max(0, row.age_days ?? 0) : 0
}

export type AgeTone = 'none' | 'warn' | 'late'

/** Amber from 3 days, red from 7: the same thresholds the row tint and its text badge use. */
export function ageTone(row: DeadlineExtension): AgeTone {
  const days = waitingDays(row)
  return days >= 7 ? 'late' : days >= 3 ? 'warn' : 'none'
}

/** A row worth a second look: asked when already late, or left waiting a week. The tint is never the only signal (see the badges). */
export function needsAttention(row: DeadlineExtension): boolean {
  return row.overdue_at_request === true || (row.status === 'pending' && waitingDays(row) >= 7)
}
