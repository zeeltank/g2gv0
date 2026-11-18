import type { ProductInfo } from '@/services/portfolio/types'
import type { CustomerModel, RunSnapshot, StartRunRequest } from '@/services/signal-review/signal-run-service'

/**
 * The rules of the "Generate signals" dialog, kept apart from the screen so they can be tested: what the form asks, what each refusal of the run endpoint
 * is called in plain words, when following a run ends, and what a finished run says. Pure.
 */

// ── Following a run ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** How long to wait between two questions about a run. Never shorter: a run takes minutes, and every answer reads the database. */
export const POLL_MS = 3000
/** Consecutive unanswered polls (about 24 seconds) before the dialog says it lost contact. The run itself goes on. */
export const POLL_FAILURES_MAX = 8
/** Polls before the dialog stops watching a run that is still going (about 40 minutes). A run always ends on the server, so this is only a backstop. */
export const POLL_MAX = 800

/** Waiting, in a form a test can drive. The real one is setTimeout. */
export interface Timers {
  set(callback: () => void, ms: number): unknown
  clear(handle: unknown): void
}

/** A run that finished its work (fully, or with some searches or sources unreadable). */
export const COMPLETED_STATUSES: readonly string[] = ['success', 'partial']
/** A run that ended without finishing. The reaper closes a run that died as `timed_out`. */
export const FAILED_STATUSES: readonly string[] = ['failed', 'skipped', 'timed_out']

export type PollStep =
  | { kind: 'completed'; run: RunSnapshot }
  | { kind: 'ended'; run: RunSnapshot }
  | { kind: 'continue'; failures: number }
  | { kind: 'stalled'; reason: 'contact' | 'slow' }

/**
 * What to do after one poll. `run` is the answer, or null when the poll itself failed. An answer that says the run is over ends the watch; a failed poll
 * is counted, and a run of failures says contact was lost rather than looping forever; a run that is still going is watched until the backstop.
 */
export function nextPollStep(input: { run: RunSnapshot | null; failures: number; attempt: number }): PollStep {
  const { run } = input
  if (run) {
    if (COMPLETED_STATUSES.includes(run.status)) return { kind: 'completed', run }
    if (FAILED_STATUSES.includes(run.status)) return { kind: 'ended', run }
    return input.attempt + 1 >= POLL_MAX ? { kind: 'stalled', reason: 'slow' } : { kind: 'continue', failures: 0 }
  }
  const failures = input.failures + 1
  return failures >= POLL_FAILURES_MAX ? { kind: 'stalled', reason: 'contact' } : { kind: 'continue', failures }
}

/** The line and the counts shown while a run goes. The headline is the server's own message about the stage the run is in. */
export function progressLines(run: RunSnapshot | null): { headline: string; detail: string | null } {
  const headline = run?.stage_message ?? 'Research is running…'
  const parts: string[] = []
  if (run?.queries_run != null) parts.push(`${run.queries_run} ${run.queries_run === 1 ? 'search' : 'searches'} run`)
  if (run?.sources_found != null) parts.push(`${run.sources_found} ${run.sources_found === 1 ? 'source' : 'sources'} found`)
  return { headline, detail: parts.length > 0 ? `${parts.join(', ')} so far.` : null }
}

export interface RunNotice {
  tone: 'success' | 'warning'
  text: string
}

const newSignals = (n: number) => `${n} new ${n === 1 ? 'signal' : 'signals'}`

/** The notice after a run that finished its work; null for a run that did not (the dialog explains that one itself). */
export function finishedNotice(run: RunSnapshot): RunNotice | null {
  if (!COMPLETED_STATUSES.includes(run.status)) return null
  const base = run.opportunities_new === null ? 'Run finished.' : `Run finished: ${newSignals(run.opportunities_new)}.`
  return run.status === 'partial'
    ? { tone: 'warning', text: `${base} Some searches or sources could not be read, so the run may have missed signals.` }
    : { tone: 'success', text: base }
}

/** Why a run that did not finish did not. */
export function failedRunText(run: RunSnapshot): string {
  return run.error_message ?? run.stage_message ?? 'The run did not complete.'
}

// ── The form ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const CUSTOMER_MODELS: ReadonlyArray<{ value: CustomerModel; label: string }> = [
  { value: 'b2b', label: 'B2B — Business' },
  { value: 'b2c', label: 'B2C — Consumer' },
  { value: 'b2g', label: 'B2G — Government' },
]

export interface GenerateForm {
  /** A product key; '' until one is chosen. */
  product: string
  model: CustomerModel
  /** A sub-product's offer id; '' for the whole product. */
  offer: string
}

export const EMPTY_FORM: GenerateForm = { product: '', model: 'b2b', offer: '' }

/** The model's word as the server prints it: "B2B". */
export const modelWord = (model: CustomerModel) => model.toUpperCase()

type Offer = ProductInfo['offers'][number]

/** Whether the product's ICP for this customer model is complete. False when the server did not say, except for B2B, where the product's own flag speaks. */
export function productReadyFor(product: ProductInfo, model: CustomerModel): boolean {
  const entry = product.icp_models?.[model]
  return entry ? entry.ready : model === 'b2b' && product.ready
}

export function offerReadyFor(offer: Offer, model: CustomerModel): boolean {
  const entry = offer.icp_models?.[model]
  return entry ? entry.ready : model === 'b2b' && offer.icp_ready !== false
}

export interface SelectOption {
  value: string
  label: string
}

/** The products, each marked when its ICP for the chosen customer model is not set up (the server still has the last word when Start is pressed). */
export function productOptions(products: readonly ProductInfo[], model: CustomerModel): SelectOption[] {
  return products.map((p) => ({ value: p.key, label: productReadyFor(p, model) ? p.label : `${p.label} — ${modelWord(model)} ICP not set up` }))
}

/** "The whole product", then each sub-product of the chosen product. Empty when there is no product or it has none. */
export function subProductOptions(products: readonly ProductInfo[], productKey: string, model: CustomerModel): SelectOption[] {
  const offers = products.find((p) => p.key === productKey)?.offers ?? []
  if (offers.length === 0) return []
  return [
    { value: '', label: 'The whole product' },
    ...offers.map((o) => ({ value: o.offer_id, label: offerReadyFor(o, model) ? o.name : `${o.name} — ${modelWord(model)} ICP not set up` })),
  ]
}

/** The product when there is exactly one to choose from, so a person with a single product is not asked to pick it. */
export function onlyProduct(products: readonly ProductInfo[]): string {
  return products.length === 1 ? products[0].key : ''
}

export interface FormProblems {
  product?: string
}

export function validateGenerate(form: GenerateForm, products: readonly ProductInfo[]): FormProblems {
  if (form.product === '') return { product: 'Choose a product to continue.' }
  if (!products.some((p) => p.key === form.product)) return { product: 'That product is not available. Choose another.' }
  return {}
}

export function toRequest(form: GenerateForm): StartRunRequest {
  return { product: form.product, customer_model: form.model, ...(form.offer !== '' ? { offer_id: form.offer } : {}) }
}

// ── Refusals ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type FailureKind = 'not_ready' | 'not_configured' | 'running' | 'wait' | 'forbidden' | 'session' | 'rejected' | 'network' | 'server'

export interface StartFailure {
  kind: FailureKind
  title: string
  message: string
  /** What the product still lacks (the server's list), shown as bullets. */
  missing: string[]
  /** True when a run is already going, so the dialog can offer to follow it. */
  canWatch: boolean
}

/** What the form had chosen, to name it in a refusal. */
export interface FailureContext {
  productLabel: string
  subName: string | null
  model: CustomerModel
}

export function failureContext(form: GenerateForm, products: readonly ProductInfo[]): FailureContext {
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
