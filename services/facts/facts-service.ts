import { apiClient, buildApiUrl } from '@/services/core'
import { readLaravelSession } from '@/lib/laravel-session'
import { FactsApiError } from './errors'
import type { FactsApi, FactsQueueParams } from './api-types'
import type { Fact } from './types'

/** Query values as strings, with a missing value left out entirely so the server applies no filter. */
export function queueQuery(params: FactsQueueParams): Record<string, string> {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    query[key] = String(value)
  }
  return query
}

/** An id or a type as ONE path segment: it cannot add a segment, a query or a fragment. */
const segment = (value: number | string) => encodeURIComponent(String(value))

/**
 * A write that keeps the refusal's whole body. Not apiClient.post: its error keeps only message/errors/detail, and the `code` of a refusal (`not_pending`,
 * `entity_gone`, `no_right`) and the fact a 409 carries would be lost. Same URL, token and headers.
 */
async function send<T>(path: string, body: unknown): Promise<T> {
  const token = readLaravelSession()?.token
  const response = await fetch(buildApiUrl(path), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  if (response.ok) return response.json() as Promise<T>

  const payload: unknown = await response.json().catch(() => null)
  const refusal = (payload && typeof payload === 'object' ? payload : {}) as {
    message?: string
    errors?: Record<string, string[]>
    detail?: string
    code?: unknown
    data?: { fact?: unknown }
  }
  const fact = refusal.data && typeof refusal.data === 'object' && refusal.data.fact && typeof refusal.data.fact === 'object' ? (refusal.data.fact as Fact) : null
  throw new FactsApiError(
    refusal.message || `API Error: ${response.status} ${response.statusText}`,
    response.status,
    refusal.errors,
    refusal.detail,
    typeof refusal.code === 'string' ? refusal.code : null,
    fact,
  )
}

/**
 * The facts API (hp_erp `/api/facts` and `/api/consent`). The organisation and the user come from the bearer token the shared client sends, never from a
 * parameter. A refusal arrives as an ApiError with `status` (403 not allowed, 404 not found in this organisation, 409 a clash, 422 invalid); the writes throw
 * a FactsApiError, which also keeps the body's `code` and, for a fact, the fact as it now stands.
 */
export const factsService: FactsApi = {
  entity(type, id) {
    return apiClient.get(`/facts/entity/${segment(type)}/${segment(id)}`)
  },

  queue(params) {
    return apiClient.get('/facts/queue', queueQuery(params))
  },

  accept(factId) {
    return send(`/facts/${segment(factId)}/accept`, {})
  },

  dismiss(factId, reason) {
    const text = reason?.trim()
    return send(`/facts/${segment(factId)}/dismiss`, text ? { reason: text } : {})
  },

  consent(type, id) {
    return apiClient.get(`/consent/${segment(type)}/${segment(id)}`)
  },
}
