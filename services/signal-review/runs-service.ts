import { apiClient } from '@/services/core'
import { productMasterService } from '@/services/product-master/product-master-service'

/**
 * One research run, as the Runs tab needs it. Parsed from GET /signals/research/runs (hp_erp OpportunityController::presentRun), which has more fields
 * than `SignalRunRow` names. Anything the server did not record is null and stays null: a cost that was never captured is unknown, not zero.
 */
export interface SignalRun {
  id: number
  /** `manual` or `scheduled`. */
  trigger: string
  /** `running`, `success`, `partial`, `failed`, `skipped` or `timed_out`. */
  status: string
  started_at: string | null
  completed_at: string | null
  /** Whole seconds; null while the run is still going, or for a run that never recorded a duration. */
  duration_seconds: number | null
  product_key: string | null
  product_master_id: number | null
  /** The Product Master name for `product_master_id`, when it could be looked up. */
  product_name: string | null
  /** Signals the run qualified, and how many of those were new. */
  signals_found: number | null
  signals_new: number | null
  ai_input_tokens: number | null
  ai_output_tokens: number | null
  /** What the run's AI calls cost, in `ai_cost_currency`. Null is unknown (a call with no price, or calls in two currencies), never zero. */
  ai_cost: number | null
  /** `INR`, `USD` or another code; null when the run has no cost. An amount without a currency is not shown as money. */
  ai_cost_currency: string | null
  search_requests: number | null
  search_credits: number | null
  error_code: string | null
  error_message: string | null
  stage_message: string | null
}

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value : null)

/** A number from JSON. Laravel sends a DECIMAL column as a string ("0.041200"), so a numeric string counts; anything else is unknown. */
const num = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/**
 * The cost a row carries, with its currency. `ai_cost` and `ai_cost_currency` are the contract's fields. A server that has not been updated sends only
 * `ai_cost_usd`, which was always dollars, so that is read as USD rather than dropping a cost the server did record. `ai_cost` wins whenever it is there.
 */
function readCost(raw: Record<string, unknown>): { amount: number | null; currency: string | null } {
  const amount = num(raw.ai_cost)
  if (amount !== null) return { amount, currency: text(raw.ai_cost_currency)?.trim().toUpperCase() ?? null }

  const dollars = num(raw.ai_cost_usd)
  return dollars !== null ? { amount: dollars, currency: 'USD' } : { amount: null, currency: null }
}

/**
 * Reads one run from the server's row. `productNames` maps Product Master ids to names. A run made before runs recorded a Product Master id has only its
 * product key, so `productNamesByKey` (lower-case product key to name) names it too; with neither the key itself is shown, never a guess.
 */
export function parseRun(raw: Record<string, unknown>, productNames: ReadonlyMap<number, string> = new Map(), productNamesByKey: ReadonlyMap<string, string> = new Map()): SignalRun {
  const productId = num(raw.product_master_id)
  const seconds = num(raw.duration_seconds)
  const millis = num(raw.duration_ms)
  const productKey = text(raw.product_key)
  const cost = readCost(raw)

  return {
    id: num(raw.id) ?? 0,
    trigger: text(raw.trigger) ?? 'unknown',
    status: text(raw.status) ?? 'unknown',
    started_at: text(raw.started_at),
    completed_at: text(raw.completed_at),
    // `duration_seconds` is the contract's field; `duration_ms` is what the endpoint sent before it, so older servers still show a duration.
    duration_seconds: seconds ?? (millis !== null ? Math.round(millis / 1000) : null),
    product_key: productKey,
    product_master_id: productId,
    product_name: (productId !== null ? productNames.get(productId) : undefined) ?? (productKey !== null ? productNamesByKey.get(productKey.toLowerCase()) : undefined) ?? null,
    signals_found: num(raw.opportunities_qualified),
    signals_new: num(raw.opportunities_new),
    ai_input_tokens: num(raw.ai_input_tokens),
    ai_output_tokens: num(raw.ai_output_tokens),
    ai_cost: cost.amount,
    ai_cost_currency: cost.currency,
    search_requests: num(raw.search_requests),
    search_credits: num(raw.search_credits),
    error_code: text(raw.error_code),
    error_message: text(raw.error_message),
    stage_message: text(raw.stage_message),
  }
}

/**
 * The research run history. The organisation comes from the bearer token the shared client sends, never from a parameter. The server returns the
 * latest 60 runs of the organisation, newest first.
 */
export const signalRunsService = {
  async list(): Promise<SignalRun[]> {
    // Product names are a courtesy: a user without Product Master access still gets the runs, with the product key where a name would be.
    const [response, options] = await Promise.all([
      apiClient.get<{ status: number; data?: unknown }>('/signals/research/runs'),
      productMasterService.options().catch(() => null),
    ])
    if (!Array.isArray(response.data)) throw new Error('The server answered with run history this screen cannot read.')

    const optionList = Array.isArray(options?.data) ? options.data : []
    const names = new Map<number, string>(optionList.map((option) => [option.id, option.name]))
    // Only a top-level product owns a key a run can carry; a sub-product's key must not name a run.
    const namesByKey = new Map<string, string>(optionList.filter((option) => option.kind === 'product').map((option) => [option.key.toLowerCase(), option.name]))
    return response.data.map((row) => parseRun((row ?? {}) as Record<string, unknown>, names, namesByKey))
  },
}
