import type { ProductInfo } from '@/services/portfolio/types'

/**
 * Why a research run did not start, in plain words. The server's refusals carry a `code`; each one gets its own explanation, and the list of what a product
 * still lacks is passed through as the server sent it. Used by the Generate Signals button on Company Opportunities (and, until step 1.7 removes it, by the
 * Signal Review's Generate dialog, through lib/signals/generate-model.ts). Pure.
 */

export type CustomerModel = 'b2b' | 'b2c' | 'b2g'

/** The model's word as the server prints it: "B2B". */
export const modelWord = (model: CustomerModel) => model.toUpperCase()

export type FailureKind = 'not_ready' | 'not_configured' | 'running' | 'wait' | 'forbidden' | 'session' | 'rejected' | 'network' | 'server'

export interface StartFailure {
  kind: FailureKind
  title: string
  message: string
  /** What the product still lacks (the server's list), shown as bullets. */
  missing: string[]
  /** True when a run is already going, so the screen can offer to follow it. */
  canWatch: boolean
}

/** What was chosen, to name it in a refusal. */
export interface FailureContext {
  productLabel: string
  subName: string | null
  model: CustomerModel
}

/** The product, the model and the sub-product (an offer id, '' for the whole product) that were chosen, named from the products as the screen holds them. */
export function failureContext(form: { product: string; model: CustomerModel; offer: string }, products: readonly ProductInfo[]): FailureContext {
  const product = products.find((p) => p.key === form.product)
  const sub = form.offer === '' ? null : (product?.offers.find((o) => o.offer_id === form.offer)?.name ?? form.offer)
  return { productLabel: product?.label ?? form.product, subName: sub, model: form.model }
}

interface RefusalShape {
  status?: unknown
  code?: unknown
  missing?: unknown
  retryAfterSeconds?: unknown
  message?: unknown
}

const failure = (kind: FailureKind, title: string, message: string, extra: Partial<Pick<StartFailure, 'missing' | 'canWatch'>> = {}): StartFailure =>
  ({ kind, title, message, missing: [], canWatch: false, ...extra })

function waitText(seconds: unknown): string {
  const minutes = typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds / 60) : null
  return minutes === null
    ? 'Research ran a moment ago. Please wait a little before running it again.'
    : `Research ran a moment ago. Please wait about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} before running it again.`
}

/**
 * A failed start in plain words. The server's refusals carry a `code`; each one gets its own explanation, and a list of what is missing is passed through
 * as the server sent it. A request that never got an answer (no connection) is not a refusal and is told apart: the person can simply try again.
 */
export function describeStartFailure(error: unknown, context: FailureContext): StartFailure {
  const refusal: RefusalShape | null = error instanceof Error && typeof (error as RefusalShape).status === 'number' ? (error as RefusalShape) : null
  if (!refusal) {
    return error instanceof TypeError || !(error instanceof Error)
      ? failure('network', 'The run could not be started', 'The server could not be reached. Check your connection and try again.')
      : failure('server', 'The run could not be started', error.message || 'Something went wrong. Try again in a moment.')
  }

  const status = refusal.status as number
  const code = typeof refusal.code === 'string' ? refusal.code : null
  const missing = Array.isArray(refusal.missing) ? refusal.missing.filter((m): m is string => typeof m === 'string') : []
  const message = typeof refusal.message === 'string' && refusal.message.trim() !== '' ? refusal.message : null
  const subject = context.subName ?? 'That sub-product'

  if (status === 403) return failure('forbidden', 'Not allowed', 'You are not allowed to start research.')
  if (status === 401) return failure('session', 'Signed out', 'Your session has ended. Please sign in again.')
  if (status === 409) {
    return failure('running', 'Research is already running', 'Research is already running for your organisation. Watch it here instead of starting another.', { canWatch: true })
  }
  if (status === 429) return failure('wait', 'Please wait', code === 'cooldown' ? waitText(refusal.retryAfterSeconds) : 'Too many tries in a short time. Wait a moment and try again.')

  if (status === 422) {
    if (code === 'product_not_configured') {
      return failure('not_ready', 'Not ready for research', message ?? `${context.productLabel} (${modelWord(context.model)} ICP) is not ready for discovery.`, { missing })
    }
    if (code === 'sub_product_not_ready') {
      return failure('not_ready', 'Not ready for research', `${subject} (${modelWord(context.model)} ICP) is not ready for discovery.`, { missing })
    }
    if (code === 'research_not_configured') {
      return failure('not_configured', 'Research is not set up', 'No web search provider is configured, so research cannot run. Ask an administrator to set one up.')
    }
    if (code === 'ai_not_configured') {
      return failure('not_configured', 'Research is not set up', 'No AI provider is configured for your organisation, so research cannot run. Ask an administrator to set one up.')
    }
    return failure('rejected', 'The run was not accepted', message ?? 'The server did not accept this request.')
  }

  return failure('server', 'The run could not be started', status >= 500 ? 'The server had a problem starting the run. Try again in a moment.' : (message ?? 'The run could not be started.'))
}

/** The run a person asked to watch ended before the dialog found it. The screen refreshes its list, so what the run found is already there. */
export function runGoneFailure(): StartFailure {
  return failure('rejected', 'No run to watch', 'That run has just finished, and the list has been refreshed. You can start a new run if you need one.')
}

// ── On Company Opportunities ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** What the Generate Signals button shows for a run that would not start: how it should look, what it says, what the product still lacks, and what to do next. */
export interface FailureNotice {
  tone: 'error' | 'warning' | 'info'
  text: string
  missing?: string[]
  nextStep?: string
}

const COMPLETE_IN_PORTFOLIO = 'Complete it in Product Portfolio, then press Generate Signals again.'

/**
 * The failure as the Generate Signals button says it. A refusal that is only a matter of waiting (a run is going, the cool-down) or of set-up (the product,
 * a provider) is not an error and does not look like one; a refusal the person cannot fix by waiting (not allowed, signed out, a broken server, a lost
 * connection) is. A run that is already going cannot be "watched here" as the Review's dialog offered: this screen follows a run of the product on screen by
 * itself (see useGenerateSignals), so its sentence says what to do instead.
 */
export function failureNotice(failure: StartFailure): FailureNotice {
  switch (failure.kind) {
    case 'running':
      return { tone: 'info', text: 'Research is already running for your organisation. Wait for it to finish, then press Generate Signals again.' }
    case 'wait':
    case 'not_configured':
      return { tone: 'warning', text: failure.message }
    case 'not_ready':
      return { tone: 'warning', text: failure.message, ...(failure.missing.length > 0 ? { missing: failure.missing } : {}), nextStep: COMPLETE_IN_PORTFOLIO }
    default:
      return { tone: 'error', text: failure.message }
  }
}
