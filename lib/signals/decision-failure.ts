import { isDecisionConflict } from '@/services/signal-review/decision-error'
import type { ReviewHistoryEntry } from '@/services/signal-review/types'

export const FORBIDDEN_TEXT = 'You can view signals but you are not allowed to decide on them.'
export const NETWORK_TEXT = 'The request did not reach the server. Check your connection and try again.'
export const NOT_FOUND_TEXT = 'This signal can no longer be found. It may have been removed.'

type DecisionField = 'decision' | 'reason_code' | 'note'

/** What the screen does about a refused or failed decision. */
export type DecisionFailure =
  /** A 422: messages for the dialog's fields, and one for anything the dialog has no field for. */
  | { kind: 'fields'; serverErrors: Partial<Record<DecisionField, string>>; formError: string | null }
  /** A 409 `conflict`: someone decided first. `entry` is their decision, or null when the server did not say. */
  | { kind: 'conflict'; entry: ReviewHistoryEntry | null; message: string }
  /** A 409 `unchanged`: the decision would change nothing. */
  | { kind: 'unchanged'; message: string }
  /** A 403: this person may view signals but not decide on them. */
  | { kind: 'forbidden'; message: string }
  /** A 404: the signal is gone, or was never in this organisation. */
  | { kind: 'missing'; message: string }
  /** Everything else, including a request that never reached the server. A retry is possible. */
  | { kind: 'failed'; message: string }

const FIELDS: readonly DecisionField[] = ['decision', 'reason_code', 'note']

const statusOf = (error: unknown): number | null => {
  const status = (error as { status?: unknown } | null)?.status
  return typeof status === 'number' ? status : null
}

const messageOf = (error: unknown): string | null => {
  const message = (error as { message?: unknown } | null)?.message
  return typeof message === 'string' && message.trim() !== '' ? message : null
}

/** Sorts what the decisions endpoint (or the network) answered into the few things the screen can do about it. */
export function classifyDecisionFailure(error: unknown): DecisionFailure {
  if (isDecisionConflict(error)) {
    const { code, message, current } = error.body
    return code === 'conflict' ? { kind: 'conflict', entry: current ?? null, message } : { kind: 'unchanged', message }
  }

  const status = statusOf(error)
  if (status === 403) return { kind: 'forbidden', message: FORBIDDEN_TEXT }
  if (status === 404) return { kind: 'missing', message: NOT_FOUND_TEXT }

  if (status === 422) {
    const errors = (error as { errors?: Record<string, unknown> }).errors ?? {}
    const serverErrors: Partial<Record<DecisionField, string>> = {}
    const elsewhere: string[] = []
    for (const [field, raw] of Object.entries(errors)) {
      const text = (Array.isArray(raw) ? raw : [raw]).filter((m): m is string => typeof m === 'string' && m !== '').join(' ')
      if (text === '') continue
      if ((FIELDS as readonly string[]).includes(field)) serverErrors[field as DecisionField] = text
      else elsewhere.push(text)
    }
    const placed = Object.keys(serverErrors).length > 0
    const formError = elsewhere.length > 0 ? elsewhere.join(' ') : placed ? null : (messageOf(error) ?? 'The decision was not accepted.')
    return { kind: 'fields', serverErrors, formError }
  }

  // A thrown TypeError is how fetch reports "could not reach the server"; an ApiError with a status carries the server's own sentence.
  return { kind: 'failed', message: status !== null ? (messageOf(error) ?? `The server answered ${status}.`) : NETWORK_TEXT }
}
