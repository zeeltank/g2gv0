import { failureText, NETWORK_TEXT, safeInternalPath } from '@/lib/agent/model'
import type { KillSwitch, ProposalsPagination, ProposalsParams, QueueOrganisation } from '@/services/agent/types'

/**
 * What the Waiting for you tab says and asks for, decided in one place and tested without a browser. A person clears the day's proposals here without opening
 * organisations one by one; each row is the proposal exactly as the organisation's own panel shows it, so accepting and dismissing say the same words.
 */

/** How many proposals a page lists. The server caps a page at 50. */
export const QUEUE_PER_PAGE = 25

/** What the tab asks for: the proposals nobody has decided, page by page. */
export function queueParams(page: number): ProposalsParams {
  return { status: 'pending', page, per_page: QUEUE_PER_PAGE }
}

/** What the tab's count asks for: one row, because only the total is wanted. */
export const COUNT_PARAMS: ProposalsParams = { status: 'pending', page: 1, per_page: 1 }

export function lastPage(pagination: Pick<ProposalsPagination, 'per_page' | 'total'> | null | undefined): number {
  if (!pagination || pagination.per_page <= 0) return 1
  return Math.max(1, Math.ceil(pagination.total / pagination.per_page))
}

/** "Showing 26–50 of 61", or null when there is nothing to count. */
export function rangeText(pagination: Pick<ProposalsPagination, 'page' | 'per_page' | 'total'> | null | undefined, rows: number): string | null {
  if (!pagination || pagination.total <= 0 || rows <= 0) return null
  const from = (pagination.page - 1) * pagination.per_page + 1
  return `Showing ${from}–${from + rows - 1} of ${pagination.total}`
}

export const QUEUE_INTRO = 'Everything the agent has proposed that nobody has decided yet, across your organisations. Accept or dismiss here without opening each organisation. Nothing is sent anywhere: accepting writes a note, a task or a link inside the CRM.'

export const QUEUE_EMPTY_TEXT = 'Nothing is waiting for you. When the agent proposes something that needs a person, it appears here with the records it rests on.'

export function waitingTotalText(total: number): string {
  return total === 0 ? 'Nothing is waiting' : `${total} waiting for you`
}

export const NO_DECIDE_TEXT = 'You can see what is waiting here, but accepting or dismissing a proposal needs the edit right on Organizations.'

/** While the organisation's kill switch is on, nothing can be accepted: said before a person tries, and a dismissal still works. */
export const AGENT_OFF_QUEUE_TEXT = 'The agent is switched off for your organisation, so a proposal cannot be accepted until an administrator switches it back on. You can still dismiss proposals.'
export const AGENT_OFF_PLATFORM_QUEUE_TEXT = 'The agent is switched off for every organisation by the platform, so a proposal cannot be accepted until it is switched back on. You can still dismiss proposals.'
export const AGENT_OFF_UNKNOWN_QUEUE_TEXT = 'The agent is switched off, so a proposal cannot be accepted until it is switched back on. You can still dismiss proposals.'

/** The sentence above the list while the agent is switched off, or null while it is running (or while it is not known). */
export function agentOffQueueText(kill: KillSwitch | null | undefined): string | null {
  if (!kill || !kill.on) return null
  if (kill.scope === 'platform') return AGENT_OFF_PLATFORM_QUEUE_TEXT
  if (kill.scope === 'organisation') return AGENT_OFF_QUEUE_TEXT
  return AGENT_OFF_UNKNOWN_QUEUE_TEXT
}

// ── Reading ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type ReadFailureKind = 'forbidden' | 'unavailable' | 'error'

const statusOf = (error: unknown): number | null => {
  const status = (error as { status?: unknown } | null)?.status
  return typeof status === 'number' ? status : null
}

/**
 * How a failed read of the queue or of the settings is shown. A 404 on these two reads can only mean the route is not there (nothing on them answers 404
 * otherwise), so it is said as "this server does not have it yet" and the other tabs keep working; a 403 is no access (no retry can help); anything else is an
 * error to retry.
 */
export function readFailure(error: unknown, what: string, fallback: string): { kind: ReadFailureKind; message: string } {
  const status = statusOf(error)
  if (status === 403) return { kind: 'forbidden', message: 'You do not have access to the agent.' }
  if (status === 404) return { kind: 'unavailable', message: `This server does not have the ${what} yet. The other tabs keep working.` }
  return { kind: 'error', message: failureText(error, fallback) }
}

// ── The organisation a proposal is about ────────────────────────────────────────────────────────────────────────────────────────────────

export interface OrganisationLine {
  kind: 'link' | 'text' | 'removed' | 'gone'
  /** The name to show (null when the organisation can no longer be found at all). */
  name: string | null
  /** An address inside this application, only for a kind of `link`. */
  href: string | null
  /** A sentence under the name when something about it needs saying. */
  note: string | null
}

/**
 * The organisation of a queued proposal. A removed or vanished organisation is SAID to be (the row is never dropped, and it can still be dismissed); a link is
 * made only from a plain path inside this application, never from anything else the server sent.
 */
export function organisationLine(organisation: QueueOrganisation): OrganisationLine {
  if (organisation.name === null) {
    return { kind: 'gone', name: null, href: null, note: 'The organisation this was proposed for can no longer be found. You can still dismiss the proposal.' }
  }
  if (organisation.removed) {
    return { kind: 'removed', name: organisation.name, href: null, note: 'This organisation has been removed or merged into another one. You can still dismiss the proposal.' }
  }
  const href = safeInternalPath(organisation.href_hint)
  return href ? { kind: 'link', name: organisation.name, href, note: null } : { kind: 'text', name: organisation.name, href: null, note: null }
}

// ── Deciding ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Why accepting or dismissing a queued proposal did not work, in a sentence: the server's own when it gave one, otherwise a plain one for the status. */
export function decisionFailureText(error: unknown, fallback: string): string {
  const status = statusOf(error)
  if (status === 403) return NO_DECIDE_TEXT
  if (status === 404) return 'This proposal can no longer be found. It may have been removed.'
  if (status !== null) {
    const message = (error as { message?: unknown } | null)?.message
    return typeof message === 'string' && message.trim() !== '' ? message : `The server answered ${status}.`
  }
  if (error instanceof TypeError) return NETWORK_TEXT
  const message = (error as { message?: unknown } | null)?.message
  return typeof message === 'string' && message.trim() !== '' ? message : fallback
}
