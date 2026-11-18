import { splitFieldErrors, type SplitErrors } from '@/components/shared/scaffolds/form-errors'
import { isDeletedNameConflict } from '@/services/org-accounts/errors'

/** The linked records follow the rights of the Organizations screen, so a 403 here means this role has none on it. */
export const FORBIDDEN_PAGE_TEXT = 'You do not have access to the linked records of organisations.'
export const NOT_SET_UP_TEXT = 'Linked records are not set up on this server yet.'
export const NO_LINK_RIGHT_TEXT = 'You are not allowed to confirm or reject links.'
export const NO_CREATE_RIGHT_TEXT = 'You are not allowed to create CRM organisations.'
export const NO_EDIT_RIGHT_TEXT = 'You are not allowed to change organisations.'
export const NETWORK_TEXT = 'The request did not reach the server. Check your connection and try again.'
export const NOT_FOUND_TEXT = 'This organisation, or one of the records it points at, can no longer be found. It may have been removed.'
export const DELETED_NAME_QUESTION = 'A deleted organisation with this name exists. Restore it instead?'

const statusOf = (error: unknown): number | null => {
  const status = (error as { status?: unknown } | null)?.status
  return typeof status === 'number' ? status : null
}

const messageOf = (error: unknown): string | null => {
  const message = (error as { message?: unknown } | null)?.message
  return typeof message === 'string' && message.trim() !== '' ? message : null
}

/** Every message a 422 carries, once each: the field-keyed `errors` if there are any, else the `message`. */
function validationMessages(error: unknown): string[] {
  const errors = (error as { errors?: Record<string, unknown> } | null)?.errors ?? {}
  const messages: string[] = []
  for (const raw of Object.values(errors)) {
    for (const text of Array.isArray(raw) ? raw : [raw]) {
      if (typeof text === 'string' && text !== '' && !messages.includes(text)) messages.push(text)
    }
  }
  if (messages.length === 0) {
    const message = messageOf(error)
    if (message) messages.push(message)
  }
  return messages
}

/** A thrown TypeError is how fetch reports "could not reach the server"; an error with a status carries the server's own sentence. */
function otherText(error: unknown, fallback: string): string {
  const status = statusOf(error)
  if (status !== null) return messageOf(error) ?? `The server answered ${status}.`
  if (error instanceof TypeError) return NETWORK_TEXT
  return messageOf(error) ?? fallback
}

// ── Reading a page ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type LoadFailure =
  /** A 403: this person may not use the screen. A retry cannot help. */
  | { kind: 'forbidden'; message: string }
  /** A 404: the organisation is gone, or was never in this organisation. */
  | { kind: 'notFound'; message: string }
  /** A 503: this server does not have the linked-records tables yet. Retrying cannot help, and the rest of the screen still works. */
  | { kind: 'unavailable'; message: string }
  | { kind: 'error'; message: string }

export function classifyLoadFailure(error: unknown, fallback: string): LoadFailure {
  const status = statusOf(error)
  if (status === 403) return { kind: 'forbidden', message: FORBIDDEN_PAGE_TEXT }
  if (status === 404) return { kind: 'notFound', message: NOT_FOUND_TEXT }
  if (status === 503) return { kind: 'unavailable', message: NOT_SET_UP_TEXT }
  return { kind: 'error', message: otherText(error, fallback) }
}

// ── Confirming or rejecting a possible duplicate ────────────────────────────────────────────────────────────────────────────────────

/** What the list says when the server refused or could not take a decision on a pair. The pair stays where it is. */
export function linkFailureText(error: unknown): string {
  const status = statusOf(error)
  if (status === 403) return NO_LINK_RIGHT_TEXT
  if (status === 404) return messageOf(error) ?? NOT_FOUND_TEXT
  if (status === 422) return validationMessages(error).join(' ') || 'The decision was not accepted.'
  return otherText(error, 'The decision could not be saved.')
}

// ── Creating the CRM organisation ───────────────────────────────────────────────────────────────────────────────────────────────────

export type CreateFailure =
  /** A 409 `deleted_name_exists`: a deleted CRM organisation holds the name; the person is asked whether to restore it. */
  | { kind: 'deleted_name_exists' }
  | { kind: 'forbidden'; message: string }
  /** Anything else, including another 409 and a 422. */
  | { kind: 'failed'; message: string }

export function classifyCreateFailure(error: unknown): CreateFailure {
  if (isDeletedNameConflict(error)) return { kind: 'deleted_name_exists' }
  const status = statusOf(error)
  if (status === 403) return { kind: 'forbidden', message: NO_CREATE_RIGHT_TEXT }
  if (status === 422) return { kind: 'failed', message: validationMessages(error).join(' ') || 'The CRM organisation could not be created.' }
  return { kind: 'failed', message: status === 404 ? (messageOf(error) ?? NOT_FOUND_TEXT) : otherText(error, 'The CRM organisation could not be created.') }
}

// ── Saving lifecycle and owner ──────────────────────────────────────────────────────────────────────────────────────────────────────

export function classifySaveFailure(error: unknown, fields: readonly string[]): SplitErrors {
  const status = statusOf(error)
  if (status === 403) return { byField: {}, unplaced: [NO_EDIT_RIGHT_TEXT] }
  if (status === 404) return { byField: {}, unplaced: [NOT_FOUND_TEXT] }
  if (status === 422) {
    const split = splitFieldErrors((error as { errors?: Record<string, string[]> }).errors, fields)
    if (Object.keys(split.byField).length === 0 && split.unplaced.length === 0) split.unplaced.push(messageOf(error) ?? 'The changes were not accepted.')
    return split
  }
  return { byField: {}, unplaced: [otherText(error, 'This could not be saved.')] }
}
