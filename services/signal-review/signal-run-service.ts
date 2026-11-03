import { apiClient, buildApiUrl } from '@/services/core'
import { getLaravelContext } from '@/lib/laravel-context'
import { readLaravelSession } from '@/lib/laravel-session'
import { portfolioService } from '@/services/portfolio/portfolio-service'
import type { ProductInfo } from '@/services/portfolio/types'

/**
 * Starting a research run from the Signal Review screen and following it to its end (hp_erp `/api/signals/research/...`, the same endpoints the original
 * Signals screen uses). Components take `SignalRunApi`, so a test can hand them a fake.
 */

export type CustomerModel = 'b2b' | 'b2c' | 'b2g'

/** What the run endpoint takes. `offer_id` is one sub-product of the product; left out, the run is about the whole product. */
export interface StartRunRequest {
  product: string
  customer_model: CustomerModel
  offer_id?: string
}

/** The part of a run the progress view and the finished notice read. A figure the server did not send is null, never zero. */
export interface RunSnapshot {
  id: number
  /** `running`, `success`, `partial`, `failed`, `skipped` or `timed_out`. */
  status: string
  stage_message: string | null
  queries_run: number | null
  sources_found: number | null
  opportunities_qualified: number | null
  opportunities_new: number | null
  error_message: string | null
}

export interface StartedRun {
  runId: number
  run: RunSnapshot | null
}

export interface SignalRunApi {
  /** The products and their sub-products, with what each is missing for research (the Product Portfolio's list, as the original screen reads it). */
  products(): Promise<ProductInfo[]>
  start(request: StartRunRequest): Promise<StartedRun>
  get(runId: number): Promise<RunSnapshot>
  /** The run that is going now, or null when none is. Used to follow a run someone else started. */
  findRunning(): Promise<RunSnapshot | null>
}

/**
 * The server refused to start a run. It is its own class, not an ApiError, because the shared client's error keeps only `message`, `errors` and `detail`:
 * the `code` ("product_not_configured", "already_running"…) and the `missing` list are the whole point of these refusals and would be thrown away.
 */
export class RunRefusalError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
    /** What the product or sub-product still lacks, in the server's words (empty for any other refusal). */
    readonly missing: string[],
    readonly retryAfterSeconds: number | null,
  ) {
    super(message)
    this.name = 'RunRefusalError'
  }
}

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value : null)
const count = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)

/** One run from the server's row; null when it has no id or status to go by. */
export function parseRunSnapshot(raw: unknown): RunSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const id = count(row.id)
  const status = text(row.status)
  if (id === null || status === null) return null

  return {
    id,
    status,
    stage_message: text(row.stage_message),
    queries_run: count(row.queries_run),
    sources_found: count(row.sources_found),
    opportunities_qualified: count(row.opportunities_qualified),
    opportunities_new: count(row.opportunities_new),
    error_message: text(row.error_message),
  }
}

/** The server's refusal as an error that keeps everything the screen needs to explain it. */
export function refusalFrom(status: number, payload: unknown, retryAfterHeader: string | null = null): RunRefusalError {
  const body = (payload && typeof payload === 'object' ? payload : {}) as { message?: unknown; code?: unknown; missing?: unknown; retry_after_seconds?: unknown }
  const missing = Array.isArray(body.missing) ? body.missing.filter((item): item is string => typeof item === 'string' && item.trim() !== '') : []
  const header = retryAfterHeader !== null && retryAfterHeader.trim() !== '' ? Number(retryAfterHeader) : null
  const retry = count(body.retry_after_seconds) ?? (header !== null && Number.isFinite(header) ? header : null)

  return new RunRefusalError(text(body.message) ?? `The run could not be started (${status}).`, status, text(body.code), missing, retry)
}

export const signalRunService: SignalRunApi = {
  async products() {
    const response = await portfolioService.getProducts(getLaravelContext())
    return response.data.products
  },

  async start(request) {
    // Not apiClient.post: its error keeps only message/errors/detail, and a refusal's `code` and `missing` would be lost. Same URL, token and headers.
    const token = readLaravelSession()?.token
    const response = await fetch(buildApiUrl('/signals/research/run'), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(request),
    })
    const payload: unknown = await response.json().catch(() => null)
    if (!response.ok) throw refusalFrom(response.status, payload, response.headers.get('Retry-After'))

    const data = (payload && typeof payload === 'object' ? (payload as { data?: { run_id?: unknown; run?: unknown } }).data : undefined) ?? {}
    const runId = count(data.run_id)
    if (runId === null) throw new Error('The server started a run but did not say which one. Check the Runs tab.')

    return { runId, run: parseRunSnapshot(data.run) }
  },

  async get(runId) {
    const response = await apiClient.get<{ data?: unknown }>(`/signals/research/runs/${encodeURIComponent(String(runId))}`)
    const run = parseRunSnapshot(response.data)
    if (!run) throw new Error('The server answered with a run this screen cannot read.')
    return run
  },

  async findRunning() {
    const response = await apiClient.get<{ data?: unknown }>('/signals/research/runs')
    const rows = Array.isArray(response.data) ? response.data : []
    for (const row of rows) {
      const run = parseRunSnapshot(row)
      if (run?.status === 'running') return run
    }
    return null
  },
}
