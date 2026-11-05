import { apiClient } from '@/services/core'
import type { PmEnvelope, PmListData, PmMeta, PmOption, PmRecord, PmStatusFilter, PmUsage } from './types'

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

  get(id: number | string): Promise<PmEnvelope<PmRecord>> {
    return apiClient.get(`/product-master/${encodeURIComponent(String(id))}`)
  },

  /** Signals, price books and quotes that use a record. */
  usage(id: number | string): Promise<PmEnvelope<PmUsage>> {
    return apiClient.get(`/product-master/${encodeURIComponent(String(id))}/usage`)
  },

  create(body: Record<string, unknown>): Promise<PmEnvelope<PmRecord>> {
    return apiClient.post('/product-master', body)
  },

  update(id: number | string, body: Record<string, unknown>): Promise<PmEnvelope<PmRecord>> {
    return apiClient.put(`/product-master/${encodeURIComponent(String(id))}`, body)
  },

  archive(id: number | string): Promise<PmEnvelope<PmRecord>> {
    return apiClient.post(`/product-master/${encodeURIComponent(String(id))}/archive`, {})
  },

  restore(id: number | string): Promise<PmEnvelope<PmRecord>> {
    return apiClient.post(`/product-master/${encodeURIComponent(String(id))}/restore`, {})
  },
}
