import { apiClient } from '@/services/core'

/**
 * The calls the ONE shared product picker makes (slice 15, track P3-C). The organisation and the person come from the bearer token the shared client sends,
 * never from a parameter. Every other module that lets a person choose a product goes through here, so the address, the parameters and the token are
 * pinned by one fetch-level test (lib/product-picker/picker-service.test.ts).
 *
 * `search` is `GET /api/product-master/picker`: the Sub-products a DOCUMENT may sell (sold, active, not in the Recycle Bin, backed by a catalogue row), each with
 * `crmProductId`, the id every line-item table stores. A caller who may not view prices of the asked type gets 403; an unknown type is 422.
 * `lines` is `GET /api/product-master/lines`: the Products (level 1), names only, open to any signed-in person. `describe` and `describeMaster` read a record the
 * picker no longer offers (paused, in the Bin) by name, so a value already on a document is never shown blank.
 */

/** What the document pickers ask for. Nothing asks for both at once: no type means every kind the caller may view. */
export type PickerType = 'product' | 'service'

export interface PickerRow {
  /** The id every line-item table stores (`crm_products.id`). */
  crmProductId: number
  /** The Product Master id: the page address of the Sub-product. */
  masterId: number
  name: string
  /** The Product (level 1) the Sub-product sits under; null for one that has none yet. */
  productName: string | null
  sku: string | null
  /** The Sell price; the server sends it only to a caller who may view prices of this kind, so null is "not shown". */
  unitPrice: number | null
  currency: string | null
  taxRateId: number | null
  type: PickerType
}

export interface ProductLineRow {
  id: number
  key: string | null
  name: string
}

export interface PickerEnvelope<T> {
  status: number
  data: T
}

/** A record read by name: its own name, the Product above it and whether it can still be sold. */
export interface DescribedProduct {
  masterId: number
  name: string
  productName: string | null
  /** `sold`, `paused`, `binned` or `not_sold`; null when the caller may not see the Sell side (HR) or the record has none. */
  state: string | null
}

export const PICKER_LIMIT_DEFAULT = 20
export const PICKER_LIMIT_MAX = 50

interface MasterRecord {
  id: number
  name: string
  parent?: { id: number; name: string } | null
  sell?: { state?: string | null } | null
}

const idPath = (id: number | string) => encodeURIComponent(String(id))

export const productPickerService = {
  /** One search of the document picker. `q` is sent only when it holds text; `limit` is the page the server clamps to 50. */
  search(params: { type?: PickerType; q?: string; limit?: number } = {}): Promise<PickerEnvelope<PickerRow[]>> {
    const query: Record<string, string> = {}
    if (params.type) query.type = params.type
    const q = (params.q ?? '').trim()
    if (q !== '') query.q = q
    if (params.limit) query.limit = String(Math.max(1, Math.min(PICKER_LIMIT_MAX, Math.trunc(params.limit))))
    return apiClient.get('/product-master/picker', query)
  },

  /** The Products (level 1) a lead, a campaign or an opportunity may point at: names only, open to any signed-in person. */
  lines(): Promise<PickerEnvelope<ProductLineRow[]>> {
    return apiClient.get('/product-master/lines')
  },

  /** The master record that holds a catalogue id, also one the picker no longer offers. */
  byCrm(crmProductId: number | string): Promise<PickerEnvelope<{ id: number; kind: string }>> {
    return apiClient.get(`/product-master/by-crm/${idPath(crmProductId)}`)
  },

  /** One master record (names, the Product above it, and the Sell state for a caller who may see it). */
  get(masterId: number | string): Promise<PickerEnvelope<MasterRecord>> {
    return apiClient.get(`/product-master/${idPath(masterId)}`)
  },

  /** A catalogue id read by name: the master id first, then the record. Rejects when either call is refused or the id is unknown. */
  async describe(crmProductId: number | string): Promise<DescribedProduct> {
    const found = await productPickerService.byCrm(crmProductId)
    return productPickerService.describeMaster(found.data.id)
  },

  /** A Product Master id read by name. */
  async describeMaster(masterId: number | string): Promise<DescribedProduct> {
    const response = await productPickerService.get(masterId)
    const record = response.data
    return { masterId: Number(record.id), name: String(record.name), productName: record.parent?.name ?? null, state: record.sell?.state ?? null }
  },
}
