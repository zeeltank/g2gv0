import { apiClient } from '@/services/core'
import type { SignalConvertResponse, SignalSendToProspectingResponse } from './signal-types'

/** What "Convert to opportunity" sends (hp_erp S20): the same choices as the Convert Lead pop-up, with the person optional. Every field is optional. */
export interface SignalConvertBody {
  organizationName?: string
  industry?: string
  existingOrganizationId?: number
  existingContactId?: number
  person?: { firstName?: string; lastName?: string; email?: string; phone?: string; title?: string }
  makePrimary?: boolean
  contactRole?: string
  opportunity?: { name?: string; amount?: number; currency?: string; closeDate?: string; stage?: string }
  assignedTo?: number
}

/** The two signal actions that belong to the funnel after the signal itself. Components take this shape, so a test can hand them a fake. */
export interface SignalFunnelApi {
  sendToProspecting(id: number): Promise<SignalSendToProspectingResponse>
  convertToOpportunity(id: number, body: SignalConvertBody): Promise<SignalConvertResponse>
}

const base = (id: number) => `/signals/opportunities/${encodeURIComponent(String(id))}`

/**
 * A signal goes into Prospecting by itself when it is saved; `sendToProspecting` is the fallback for one that did not (a company whose account was removed on purpose,
 * or one saved before this existed). Idempotent: 201 when the account was made now, 200 with `created: false` when the company already had one.
 * `convertToOpportunity` makes the organization, the optional person and the opportunity in one step; idempotent per signal. A refusal arrives as an ApiError
 * (403 a right is missing, 404 not found, 422 something to correct, 503 the server's database is not updated yet).
 */
export const signalFunnelService: SignalFunnelApi = {
  sendToProspecting(id) {
    return apiClient.post(`${base(id)}/send-to-prospecting`, {})
  },

  convertToOpportunity(id, body) {
    return apiClient.post(`${base(id)}/convert-to-opportunity`, body)
  },
}
