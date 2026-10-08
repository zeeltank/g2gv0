/**
 * Small pieces every G2G chat action uses, kept here so each module's file stays about its own
 * endpoint. Nothing in this file talks to the backend.
 */

import type { ActionContext } from '../types'
import type { G2gActionApp } from './actions'

/** Writes the ledger row the Activity tab shows. Must never throw (see `recordModuleActivitySafely`). */
export type RecordActivity = (moduleKey: string, entry: Record<string, unknown>) => Promise<unknown>

/**
 * Whether the user is on one of the given pages AND the page was resolved from their own,
 * rights-filtered sidebar (`menuId` is null for a URL typed for a screen they cannot see).
 *
 * Segment-aware: `/leave-requests` matches itself and `/leave-requests/42`, not `/leave-requests-old`.
 */
export function onPage(context: ActionContext<G2gActionApp>, ...pages: string[]): boolean {
  if (context.menuId === null) return false

  return pages.some((page) => context.pathname === page || context.pathname.startsWith(`${page}/`))
}

/** The backend's own reason (a permission refusal, a duplicate) is the answer; never replaced. */
export function failureMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() !== '' ? error.message : fallback
}

/** `YYYY-MM-DD` that is also a real calendar day (rejects 2026-02-31). */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

/** Ledger write that cannot break the action: the change has already happened by then. */
export async function writeLedger(record: RecordActivity, moduleKey: string, entry: Record<string, unknown>): Promise<void> {
  try {
    await record(moduleKey, { capability: 'conversational', status: 'completed', ...entry })
  } catch {
    // Best-effort by design.
  }
}

/** Looks a chosen value up in the live options a select was shown, for previews and checks. */
export function labelOf(options: Array<{ value: string; label: string }>, value: string): string | undefined {
  return options.find((option) => option.value === value)?.label
}
