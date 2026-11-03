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
  ai_cost_usd: number | null
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

/** Reads one run from the server's row. `productNames` maps Product Master ids to names. */
export function parseRun(raw: Record<string, unknown>, productNames: ReadonlyMap<number, string> = new Map()): SignalRun {
  const productId = num(raw.product_master_id)
  const seconds = num(raw.duration_seconds)
  const millis = num(raw.duration_ms)

  return {
    id: num(raw.id) ?? 0,
    trigger: text(raw.trigger) ?? 'unknown',
    status: text(raw.status) ?? 'unknown',
    started_at: text(raw.started_at),
    completed_at: text(raw.completed_at),
    // `duration_seconds` is the contract's field; `duration_ms` is what the endpoint sent before it, so older servers still show a duration.
    duration_seconds: seconds ?? (millis !== null ? Math.round(millis / 1000) : null),
    product_key: text(raw.product_key),
    product_master_id: productId,
    product_name: productId !== null ? productNames.get(productId) ?? null : null,
    signals_found: num(raw.opportunities_qualified),
    signals_new: num(raw.opportunities_new),
    ai_input_tokens: num(raw.ai_input_tokens),
    ai_output_tokens: num(raw.ai_output_tokens),
    ai_cost_usd: num(raw.ai_cost_usd),
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
    return response.data.map((row) => parseRun((row ?? {}) as Record<string, unknown>, names))
  },
}
