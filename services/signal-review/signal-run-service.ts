import { apiClient } from '@/services/core'
import { getLaravelContext } from '@/lib/laravel-context'
import { portfolioService } from '@/services/portfolio/portfolio-service'
import type { ProductInfo } from '@/services/portfolio/types'
import { postRefusing } from '@/services/signals/run-refusal'

// The refusal of a run (its class and its reader) moved to services/signals/run-refusal.ts when the Generate Signals button on Company Opportunities began to
// explain refusals in the same words (docs/agentic-crm/slices/S15-product-portfolio-merge.md, P1-A2). They are re-exported here so the Review's dialog and
// its tests keep their imports until step 1.7 removes this file with that screen.
export { RunRefusalError, refusalFrom } from '@/services/signals/run-refusal'

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

export const signalRunService: SignalRunApi = {
  async products() {
    const response = await portfolioService.getProducts(getLaravelContext())
    return response.data.products
  },

  async start(request) {
    // Not apiClient.post: its error keeps only message/errors/detail, and a refusal's `code` and `missing` would be lost. Same URL, token and headers.
    const payload = await postRefusing<unknown>('/signals/research/run', request)

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
