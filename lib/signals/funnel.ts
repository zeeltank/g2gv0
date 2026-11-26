import type { SignalRow } from '@/services/signal-review/signal-types'
import { NETWORK_TEXT, NOT_FOUND_TEXT } from './decision-failure'

/**
 * What a signal became (S20): Signal -> Convert to lead / Convert to opportunity. A signal that has an opportunity shows it as a link; one that has none offers the
 * button. Pure, so what the card shows and says is tested without a browser.
 */

type OpportunityFields = Pick<SignalRow, 'converted_opportunity'>

const positive = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null)

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
