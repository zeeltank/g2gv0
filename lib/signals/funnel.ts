import type { SignalRow } from '@/services/signal-review/signal-types'
import { NETWORK_TEXT, NOT_FOUND_TEXT } from './decision-failure'

/**
 * Where a signal is in the funnel (S20): Signal -> PROSPECTING (its company's account, made by itself when the signal was saved) -> Convert to lead / Convert to
 * opportunity. Pure, so what the card shows and says is tested without a browser.
 */

export const IN_PROSPECTING = 'In Prospecting'
export const OPEN_IN_PROSPECTING = 'Open in Prospecting'
export const ADD_TO_PROSPECTING = 'Add to Prospecting'
export const ADDED_TO_PROSPECTING = 'Added to Prospecting'
export const ALREADY_IN_PROSPECTING = 'Already in Prospecting'

/** Where the Prospecting screen opens an account. The id is digits only (a table id), so nothing else can become part of the address. */
export const prospectingHref = (accountId: number) => `/gtm/prospecting?account=${accountId}`

export interface SignalProspecting {
  accountId: number
  stage: string
  contactsCount: number
  href: string
}

type ProspectingFields = Pick<SignalRow, 'prospecting'>
type OpportunityFields = Pick<SignalRow, 'converted_opportunity'>

const positive = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null)

/** The Prospecting account of this signal's company, or null when it has none (or the server sent something that is not an account id). */
export function prospectingOf(signal: ProspectingFields): SignalProspecting | null {
  const raw = signal.prospecting
  const accountId = positive(raw?.account_id)
  if (!raw || accountId === null) return null
  return { accountId, stage: typeof raw.stage === 'string' && raw.stage !== '' ? raw.stage : 'target', contactsCount: Math.max(0, Number(raw.contacts_count) || 0), href: prospectingHref(accountId) }
}

/** The signal with its company's account, once the server has said which (the answer names only the account's id). */
export function withProspecting<T extends ProspectingFields>(signal: T, accountId: number): T {
  if (signal.prospecting?.account_id === accountId) return signal
  return { ...signal, prospecting: { account_id: accountId, stage: 'target', contacts_count: 0 } }
}

/** The confirmation after "Add to Prospecting". A company that already had its account is not an error: it is simply told so. */
export const prospectingNotice = (created: boolean) => (created ? ADDED_TO_PROSPECTING : ALREADY_IN_PROSPECTING)

/** The account id out of an answer, or null when it does not name one. */
export function accountIdFrom(result: { data?: { account_id?: unknown } } | null | undefined): number | null {
  return positive(result?.data?.account_id)
}

export interface SignalOpportunity {
  id: number
  name: string
  href: string
}

/** Where an opportunity opens. */
export const opportunityHref = (id: number) => `/module/crm/sales/opportunities/${id}`

/** The CRM opportunity this signal was converted into, or null. */
export function opportunityOf(signal: OpportunityFields): SignalOpportunity | null {
  const raw = signal.converted_opportunity
  const id = positive(raw?.id)
  if (!raw || id === null) return null
  return { id, name: typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name.trim() : `Opportunity #${id}`, href: opportunityHref(id) }
}

/** The signal with its opportunity, once the server has said which. */
export function withOpportunity<T extends OpportunityFields>(signal: T, id: number, name: string): T {
  if (signal.converted_opportunity?.id === id) return signal
  return { ...signal, converted_opportunity: { id, name } }
}

export const OPPORTUNITY_CREATED = 'Opportunity created'
export const OPPORTUNITY_EXISTS = 'This signal already has an opportunity, so no second one was made.'
export const convertNotice = (created: boolean) => (created ? OPPORTUNITY_CREATED : OPPORTUNITY_EXISTS)

export const FUNNEL_FORBIDDEN_TEXT = 'You are not allowed to do this from a signal.'

export type FunnelFailure =
  | { kind: 'forbidden'; message: string }
  | { kind: 'missing'; message: string }
  /** Everything else, including a refusal the server explained (a 422) and a request that never reached the server. */
  | { kind: 'failed'; message: string }

const statusOf = (error: unknown): number | null => {
  const status = (error as { status?: unknown } | null)?.status
  return typeof status === 'number' ? status : null
}

const messageOf = (error: unknown): string | null => {
  const message = (error as { message?: unknown } | null)?.message
  return typeof message === 'string' && message.trim() !== '' ? message : null
}

/** Sorts what the funnel endpoints (or the network) answered into the few things the card can do about it. A 403 can carry the server's own sentence (which right is missing). */
export function classifyFunnelFailure(error: unknown): FunnelFailure {
  const status = statusOf(error)
  if (status === 403) return { kind: 'forbidden', message: messageOf(error) ?? FUNNEL_FORBIDDEN_TEXT }
  if (status === 404) return { kind: 'missing', message: messageOf(error) ?? NOT_FOUND_TEXT }
  return { kind: 'failed', message: status !== null ? (messageOf(error) ?? `The server answered ${status}.`) : NETWORK_TEXT }
}
