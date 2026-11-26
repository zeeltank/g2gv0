import { ApiError, apiClient, buildApiUrl } from '@/services/core'
import { readLaravelSession } from '@/lib/laravel-session'
import { productMasterService } from '@/services/product-master/product-master-service'
import type { PmEnvelope, PmOption } from '@/services/product-master/types'
import { DecisionConflictError } from './decision-error'
import type {
  SignalDecisionResponse, SignalDetailResponse, SignalHistoryResponse, SignalListParams, SignalListResponse, SignalPromoteResponse,
} from './signal-types'
import type { DecisionConflictBody, DecisionRequest } from './types'

/** What the Signal Review screen needs from the server. Components take this shape, so a test can hand them a fake. */
export interface SignalReviewApi {
  list(params: SignalListParams): Promise<SignalListResponse>
  get(id: number): Promise<SignalDetailResponse>
  decide(id: number, body: DecisionRequest): Promise<SignalDecisionResponse>
  history(id: number): Promise<SignalHistoryResponse>
  promote(id: number): Promise<SignalPromoteResponse>
  productOptions(): Promise<PmEnvelope<PmOption[]>>
}

/** Query values as strings, with a missing value left out entirely so the server applies no filter. */
export function listQuery(params: SignalListParams): Record<string, string> {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    query[key] = String(value)
  }
  return query
}

const isConflictBody = (body: unknown): body is DecisionConflictBody =>
  typeof body === 'object' && body !== null && ((body as { code?: unknown }).code === 'conflict' || (body as { code?: unknown }).code === 'unchanged')

/**
 * The Signal Review API (hp_erp `/api/signals/...`). The organisation and the user come from the bearer token the shared client sends, never from a
 * parameter. A refusal arrives as an ApiError with `status` (403 not allowed, 404 not found, 422 invalid) and, for a 422, `errors` keyed by field.
 * The one exception is a 409 from `decide`: that arrives as a DecisionConflictError, which keeps the server's `code` and the decision that got there first.
 */
export const signalReviewService: SignalReviewApi = {
  list(params) {
    return apiClient.get('/signals/opportunities', listQuery(params))
  },

  get(id) {
    return apiClient.get(`/signals/opportunities/${encodeURIComponent(String(id))}`)
  },

  /** Newest first. */
  history(id) {
    return apiClient.get(`/signals/opportunities/${encodeURIComponent(String(id))}/reviews`)
  },

  async decide(id, body) {
    // Not apiClient.post: its error keeps only message/errors/detail, and a 409's `code` and `current` would be lost. Same URL, token and headers.
    const token = readLaravelSession()?.token
    const response = await fetch(buildApiUrl(`/signals/opportunities/${encodeURIComponent(String(id))}/decisions`), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    })
    if (response.ok) return response.json() as Promise<SignalDecisionResponse>

    const payload: unknown = await response.json().catch(() => null)
    if (response.status === 409 && isConflictBody(payload)) throw new DecisionConflictError(payload)

    const refusal = (payload && typeof payload === 'object' ? payload : {}) as { message?: string; errors?: Record<string, string[]>; detail?: string }
    throw new ApiError(refusal.message || `API Error: ${response.status} ${response.statusText}`, response.status, refusal.errors, refusal.detail)
  },

  /**
   * Makes a CRM lead from the signal. A signal that already has one answers 200 with `created: false` and the same `lead_id`, so pressing twice is safe.
   * A refusal arrives as an ApiError (403 not allowed to edit signals, 404 not found in this organisation).
   */
  promote(id) {
    return apiClient.post(`/signals/opportunities/${encodeURIComponent(String(id))}/promote-to-crm`, {})
  },

  /** The same product list the Product Master uses; a signal's `product_master_id` is one of these ids. */
  productOptions() {
    return productMasterService.options()
  },
}
