import { apiClient } from '@/services/core'
import type { PmEnvelope, PmListData, PmMeta, PmOption, PmStatusFilter } from './types'

/**
 * The Product Master API. The organisation and the user come from the bearer token the shared client sends, never from a parameter, so there is no
 * `context` argument here: a caller only checks that a session exists before calling. A refusal arrives as an ApiError whose `errors` are keyed by
 * field (name, offerId, sell.taxRateId, …) and whose `status` is 403 (not allowed), 404 (not found), 409 (a clash) or 422 (invalid).
 */
export const productMasterService = {
  /** Products with their sub-products nested, then the catalogue-only items. */
  list(params: { status?: PmStatusFilter; q?: string } = {}): Promise<PmEnvelope<PmListData>> {
    const query: Record<string, string> = {}
    if (params.status) query.status = params.status
    if (params.q) query.q = params.q
    return apiClient.get('/product-master', query)
  },

  /** A flat list of every active product, sub-product and item, for pickers. */
  options(): Promise<PmEnvelope<PmOption[]>> {
    return apiClient.get('/product-master/options')
  },

  /** Active product lines for pickers. */
  lines(): Promise<PmEnvelope<{ id: number; key: string; name: string }[]>> {
    return apiClient.get('/product-master/lines')
  },

  /** The choices a form may offer and what the caller may do. */
  meta(): Promise<PmEnvelope<PmMeta>> {
    return apiClient.get('/product-master/meta')
  },

  // The read of one record, its usage and the writes (create, update, archive, restore) of the S1 Products screen were removed with that screen (slice 15, WPD):
  // the pages and the form of the Product Portfolio use productRecordService (record-service.ts) for them.
}
