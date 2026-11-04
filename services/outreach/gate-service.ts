/**
 * The outreach checks (hp_erp slice 10, routes/outreach_gate.php). READ-ONLY: this file holds two GET calls and nothing else.
 *
 *   GET /api/outreach/gate?table=&id=       runs the checks on a draft now, records the set, and sends nothing. The server throttles it to 60 a minute, so a screen
 *                                          calls it when a draft is opened and when the person presses "Check again", never in a loop.
 *   GET /api/outreach/claims?status=...     the claims an organisation has approved for its products (needs the Products row). Proposing and approving a claim
 *                                          are POST and PUT on the same path; this screen does neither, so they are not here.
 *
 * The answers come back as `unknown` on purpose: lib/outreach/model.ts reads them, and a field the server does not send must not be taken on trust. The
 * organisation and the person come from the token on the server; nothing here sends either.
 */
import { apiClient } from '@/services/core'
import type { GateTable } from '@/lib/outreach/types'

export interface GateApi {
  /** Run the checks on one draft now. */
  checks: (table: GateTable, id: number) => Promise<unknown>
  /** The approved claims, of one product when `productId` is given. */
  approvedClaims: (productId: number | null) => Promise<unknown>
}

/** How many approved claims one request asks for (the server's own ceiling is 200). */
export const CLAIMS_PAGE = 100

export const gateService: GateApi = {
  checks: (table, id) => apiClient.get<unknown>('/outreach/gate', { table, id: String(id) }),
  approvedClaims: (productId) =>
    apiClient.get<unknown>('/outreach/claims', { status: 'approved', limit: String(CLAIMS_PAGE), ...(productId !== null ? { product_master_id: String(productId) } : {}) }),
}
