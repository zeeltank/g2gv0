import { apiClient, buildApiUrl } from '@/services/core'
import { readLaravelSession } from '@/lib/laravel-session'
import { OrgAccountsApiError } from './errors'
import type { OrgAccountsApi, OrgListParams } from './api-types'

/** Query values as strings, with a missing value left out entirely so the server applies no filter. */
export function listQuery(params: OrgListParams): Record<string, string> {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    query[key] = String(value)
  }
  return query
}

const idPath = (id: number | string) => encodeURIComponent(String(id))

/**
 * A write that keeps the refusal's whole body. Not apiClient.post: its error keeps only message/errors/detail, and the `code` and
 * `deleted_organization_id` of a 409 (or the field errors of a 422) would be lost. Same URL, token and headers.
 */
async function send<T>(method: 'POST' | 'PATCH', path: string, body: unknown): Promise<T> {
  const token = readLaravelSession()?.token
  const response = await fetch(buildApiUrl(path), {
    method,
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
    deleted_organization_id?: unknown
  }
  throw new OrgAccountsApiError(
    refusal.message || `API Error: ${response.status} ${response.statusText}`,
    response.status,
    refusal.errors,
    refusal.detail,
    typeof refusal.code === 'string' ? refusal.code : null,
    typeof refusal.deleted_organization_id === 'number' ? refusal.deleted_organization_id : null,
  )
}

/**
 * The Organisation 360 API (hp_erp `/api/org-accounts`). The organisation and the user come from the bearer token the shared client sends, never
 * from a parameter. A refusal arrives as an ApiError with `status` (403 not allowed, 404 not found in this organisation, 409 a clash, 422 invalid);
 * the writes throw an OrgAccountsApiError, which also keeps the body's `code` and `deleted_organization_id`.
 */
export const orgAccountsService: OrgAccountsApi = {
  list(params) {
    return apiClient.get('/org-accounts', listQuery(params))
  },

  meta() {
    return apiClient.get('/org-accounts/meta')
  },

  suggestions() {
    return apiClient.get('/org-accounts/suggestions')
  },

  get(id) {
    return apiClient.get(`/org-accounts/${idPath(id)}`)
  },

  link(body) {
    return send('POST', '/org-accounts/links', body)
  },

  patch(id, body) {
    return send('PATCH', `/org-accounts/${idPath(id)}`, body)
  },

  createCrmOrganisation(id, body = {}) {
    return send('POST', `/org-accounts/${idPath(id)}/create-crm-organisation`, body)
  },
}
