import { apiClient, buildApiUrl } from '@/services/core'
import { readLaravelSession } from '@/lib/laravel-session'
import { AgentApiError } from './errors'
import type { AgentApi } from './api-types'
import type { AgentProposal } from './types'

/** Query values as strings, with a missing value left out entirely so the server applies no filter. */
export function runsQuery(params: object): Record<string, string> {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    query[key] = String(value)
  }
  return query
}

const idPath = (id: number | string) => encodeURIComponent(String(id))

/**
 * A write that keeps the refusal's whole body. Not apiClient.post or apiClient.put: their error keeps only message/errors/detail, and the `code` of a refusal
 * (`daily_cap`, `agent_off`, `already_decided`, `could_not_apply`, `administrators_only`, `unknown_action`, `unknown_level`) and the proposal a 409 carries would
 * be lost. Same URL, token and headers. A POST unless told otherwise (the autonomy settings are PUT).
 */
async function send<T>(path: string, body: unknown, method: 'POST' | 'PUT' = 'POST'): Promise<T> {
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
    data?: { proposal?: unknown }
  }
  const proposal = refusal.data && typeof refusal.data === 'object' && refusal.data.proposal && typeof refusal.data.proposal === 'object' ? (refusal.data.proposal as AgentProposal) : null
  throw new AgentApiError(
    refusal.message || `API Error: ${response.status} ${response.statusText}`,
    response.status,
    refusal.errors,
    refusal.detail,
    typeof refusal.code === 'string' ? refusal.code : null,
    proposal,
  )
}

/**
 * The agent API (hp_erp `/api/agent`). The organisation and the user come from the bearer token the shared client sends, never from a parameter. A refusal
 * arrives as an ApiError with `status` (403 not allowed, 404 not found in this organisation, 409 a clash, 422 invalid, 429 the day's cap); the writes throw an
 * AgentApiError, which also keeps the body's `code` and, for a proposal, the proposal as it now stands.
 */
export const agentService: AgentApi = {
  state(orgAccountId) {
    return apiClient.get(`/agent/organisations/${idPath(orgAccountId)}`)
  },

  async resolve(crmOrganizationId) {
    // The Organisation 360 API: it makes the identity of a CRM organisation that has none (a CRM organisation made after the backfill) and answers with its
    // 360, so the agent can run on every CRM organisation. Only the identity's id is wanted here. (The agent API also has a read-only
    // GET /agent/organisations/resolve that never writes, for a caller that must not create anything.)
    const response = await send<{ status: 1; data: { identity: { id: number } } }>(`/org-accounts/for-crm/${idPath(crmOrganizationId)}`, {})
    const id = response.data?.identity?.id
    if (typeof id !== 'number') throw new AgentApiError('The organisation could not be opened.', 502, undefined, undefined, null, null)
    return { status: 1, data: { org_account_id: id } }
  },

  run(orgAccountId) {
    return send(`/agent/organisations/${idPath(orgAccountId)}/run`, {})
  },

  accept(proposalId) {
    return send(`/agent/proposals/${idPath(proposalId)}/accept`, {})
  },

  dismiss(proposalId, reason) {
    const text = reason?.trim()
    return send(`/agent/proposals/${idPath(proposalId)}/dismiss`, text ? { reason: text } : {})
  },

  runs(params) {
    return apiClient.get('/agent/runs', runsQuery(params))
  },

  runDetail(runId) {
    return apiClient.get(`/agent/runs/${idPath(runId)}`)
  },

  // ── S7b: the waiting queue and the autonomy settings ──────────────────────────────────────────────────────────────────────────────────────

  proposals(params) {
    return apiClient.get('/agent/proposals', runsQuery(params))
  },

  autonomy() {
    return apiClient.get('/agent/autonomy')
  },

  setAutonomy(actionKey, level, reason) {
    const text = reason?.trim()
    // The key is one path segment: it cannot add a segment, a query or a fragment.
    return send(`/agent/autonomy/${idPath(actionKey)}`, text ? { level, reason: text } : { level }, 'PUT')
  },

  setKillSwitch(on, reason) {
    const text = reason?.trim()
    return send('/agent/autonomy-kill-switch', text ? { on, reason: text } : { on }, 'PUT')
  },
}
