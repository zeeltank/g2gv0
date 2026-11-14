import { apiClient } from '@/services/core'
import type { PmEnvelope, PmMeta } from './types'
import type { PmFullRecord, PmHistoryEnvelope, PmListEnvelope, PmPickerRow, PmSell, PmUsageFull } from './record-types'
import { productMasterService } from './product-master-service'

/**
 * The calls ONE Sub-product or Product screen makes (slice 15, track P3-B). The organisation and the person come from the bearer token the shared client
 * sends, never from a parameter. A refusal arrives as an ApiError whose `status` is 403 (not allowed: `errors` names the refused section), 404, 409 or 422
 * (`errors` keyed by field path: `name`, `offerId`, `about.whatItDoes`, `sell.unitPrice`, `sell.isActive`, …). Nothing here sends a message to anybody.
 *
 * `create` and `update` are the one-record writer (POST and PUT /api/product-master): one transaction, About, Sell and ICP in one body. The picture,
 * the bundle parts, the custom fields and the delete from the catalogue are separate calls keyed by `sell.crmProductId`; they live in `services/crm`.
 */
export const productRecordService = {
  /** One record with its About, its ICP state and (only for a caller who may view it) its Sell section. */
  get(id: number | string): Promise<PmEnvelope<PmFullRecord>> {
    return apiClient.get(`/product-master/${encodeURIComponent(String(id))}`)
  },

  /** The Sell section alone (403 for a caller who may not view it). */
  sell(id: number | string): Promise<PmEnvelope<PmSell>> {
    return apiClient.get(`/product-master/${encodeURIComponent(String(id))}/sell`)
  },

  /** What uses the record: counts and the newest quotes, orders and invoices (403 for a caller who may not view the Sell side). */
  usage(id: number | string): Promise<PmEnvelope<PmUsageFull>> {
    return apiClient.get(`/product-master/${encodeURIComponent(String(id))}/usage`)
  },

  /** Every change of the record in its three stores, newest first, in pages. */
  history(id: number | string, params: { page?: number; per?: number } = {}): Promise<PmHistoryEnvelope> {
    const query: Record<string, string> = {}
    if (params.page) query.page = String(params.page)
    if (params.per) query.per = String(params.per)
    return apiClient.get(`/product-master/${encodeURIComponent(String(id))}/history`, query)
  },

  /** A page of the flat list. The Product page asks for its own Sub-products with `productId`; a record's header looks itself up with `q`. */
  list(params: { page?: number; per?: number; q?: string; productId?: number; status?: 'active' | 'archived' | 'all' } = {}): Promise<PmListEnvelope> {
    const query: Record<string, string> = {}
    if (params.page) query.page = String(params.page)
    if (params.per) query.per = String(params.per)
    if (params.q) query.q = params.q
    if (params.productId) query.productId = String(params.productId)
    if (params.status) query.status = params.status
    return apiClient.get('/product-master/list', query)
  },

  /** The choices a form may offer and what the caller may do (the same answer the S1 screens read). */
  meta(): Promise<PmEnvelope<PmMeta>> {
    return productMasterService.meta()
  },

  /** Products with their Sub-products nested, every status: the Product choices, the IDs already used and the Sub-products "often sold together" can name. */
  everything: () => productMasterService.list({ status: 'all' }),

  /** Products a bundle may hold as parts (sold, active, in the catalogue). */
  pickerParts(q: string, limit = 20): Promise<PmEnvelope<PmPickerRow[]>> {
    const query: Record<string, string> = { type: 'product', limit: String(limit) }
    if (q.trim() !== '') query.q = q.trim()
    return apiClient.get('/product-master/picker', query)
  },

  /** One save for every section the body carries. `kind` is `sub_product` (or `product` for the administrators' Add product). */
  create(body: Record<string, unknown>): Promise<PmEnvelope<PmFullRecord>> {
    return apiClient.post('/product-master', body)
  },

  update(id: number | string, body: Record<string, unknown>): Promise<PmEnvelope<PmFullRecord>> {
    return apiClient.put(`/product-master/${encodeURIComponent(String(id))}`, body)
  },

  archive(id: number | string): Promise<PmEnvelope<PmFullRecord>> {
    return apiClient.post(`/product-master/${encodeURIComponent(String(id))}/archive`, {})
  },

  restore(id: number | string): Promise<PmEnvelope<PmFullRecord>> {
    return apiClient.post(`/product-master/${encodeURIComponent(String(id))}/restore`, {})
  },
}

/** The part of the service the form writes through; a stand-in in a test. */
export type ProductRecordWriter = Pick<typeof productRecordService, 'create' | 'update'>
