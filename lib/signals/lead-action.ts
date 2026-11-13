import type { SignalRow } from '@/services/signal-review/signal-types'
import { NETWORK_TEXT, NOT_FOUND_TEXT } from './decision-failure'

/**
 * Turning a signal into a CRM lead from the Signal Review drawer: when the button is offered, what the confirmation says, and what each way the server
 * can answer means for the person. Pure, so the rules that matter (a signal with a lead never gets a second button, a 403 names leads and not decisions)
 * are tested without a browser.
 */

export const LEAD_FORBIDDEN_TEXT = 'You are not allowed to create leads from signals.'

/** The sentence the person confirms, in plain words: what will be made and where it is recorded. */
export const LEAD_CONFIRM = {
  title: 'Turn this signal into a lead?',
  description: 'A lead is created in CRM from this signal, with its organisation and what was observed. The signal’s history records it. If it already has a lead, no second one is made.',
  confirmLabel: 'Create lead',
}

/** The lead a signal was turned into, as the list and the detail name it. */
export interface SignalLead {
  id: string
  /** The lead's own number (LD-00012), when the server named it. */
  number: string | null
  status: string | null
  href: string
}

/** Where a lead opens. The id is digits only (it is the lead's table id), so nothing else can ever become part of the address. */
export const leadHref = (id: string) => `/module/crm/marketing/leads/${id}`

/** The lead of this signal, or null when it has none (or the server sent something that is not a lead id). */
export function leadOf(signal: Pick<SignalRow, 'promoted_lead_id' | 'promoted_lead_no' | 'promoted_lead_status'>): SignalLead | null {
  const raw: unknown = signal.promoted_lead_id
  const id = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : ''
  if (!/^[1-9]\d*$/.test(id)) return null
  const text = (value: unknown) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null)
  return { id, number: text(signal.promoted_lead_no), status: text(signal.promoted_lead_status), href: leadHref(id) }
}

/** The lead id out of an answer, or null when the answer does not name one. */
export function leadIdFrom(result: { data?: { lead_id?: unknown } } | null | undefined): string | null {
  const raw = result?.data?.lead_id
  const id = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : ''
  return /^[1-9]\d*$/.test(id) ? id : null
}

/**
 * The signal with its lead. The answer names only the lead's id, so a number or status kept from before is dropped when it belongs to another lead
 * and kept when it is the same one (a second press that found the lead already there).
 */
export function withLead(signal: SignalRow, leadId: string): SignalRow {
  if (signal.promoted_lead_id === leadId) return signal
  return { ...signal, promoted_lead_id: leadId, promoted_lead_no: null, promoted_lead_status: null }
}

/** The confirmation shown once the server has answered. A signal that already had a lead is not an error: it is simply told so. */
export function promoteNotice(created: boolean): string {
  return created
    ? 'Lead created in CRM. It is recorded in this signal’s history.'
    : 'This signal already has a lead, so no second one was made.'
}

export const NO_LEAD_ID_TEXT = 'The server did not say which lead it made. Reload the page to see whether the lead exists.'

export type PromoteFailure =
  /** A 403: this person may view signals but not act on them. */
  | { kind: 'forbidden'; message: string }
  /** A 404: the signal is gone, or was never in this organisation. */
  | { kind: 'missing'; message: string }
  /** Everything else, including a request that never reached the server. Pressing the button again retries. */
  | { kind: 'failed'; message: string }

const statusOf = (error: unknown): number | null => {
  const status = (error as { status?: unknown } | null)?.status
  return typeof status === 'number' ? status : null
}

const messageOf = (error: unknown): string | null => {
  const message = (error as { message?: unknown } | null)?.message
  return typeof message === 'string' && message.trim() !== '' ? message : null
}

/** Sorts what the promote endpoint (or the network) answered into the few things the drawer can do about it. */
export function classifyPromoteFailure(error: unknown): PromoteFailure {
  const status = statusOf(error)
  if (status === 403) return { kind: 'forbidden', message: LEAD_FORBIDDEN_TEXT }
  if (status === 404) return { kind: 'missing', message: NOT_FOUND_TEXT }
  // A thrown TypeError is how fetch reports "could not reach the server"; an ApiError with a status carries the server's own sentence.
  return { kind: 'failed', message: status !== null ? (messageOf(error) ?? `The server answered ${status}.`) : NETWORK_TEXT }
}
