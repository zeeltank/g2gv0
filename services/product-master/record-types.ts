/**
 * What the unified Product Portfolio reads for ONE record (hp_erp ProductMasterController: show, sell, usage, history, list, meta). Names are the API's own
 * camelCase. Read from the code on disk on 14 Nov 2026, not from the brief: where the two differ the code wins (see the P3-B log).
 *
 * A record is a Product (level 1) or a Sub-product (level 2: an About, a Sell section, ICPs, each optional). A Service is a Sub-product whose Sell type is
 * `service`. `sell` is always a key of the answer, and null for a caller who may not view the Sell section of that record's type: a person who may see
 * no price never receives one, so the screens draw a price only from a non-null `sell`.
 */
import type { PmCrmItem, PmIcpState, PmKind, PmPriceBookEntry, PmStatus, PmItemType } from './types'

export type PmSellState = 'sold' | 'paused' | 'binned'

/** The Sell section of a record: its catalogue row with every field, also one in the Recycle Bin (`state` says so). */
export interface PmSell {
  state: PmSellState
  /** The id every side call (image, bundle parts, custom fields, delete) is keyed by. */
  crmProductId: number
  productNo: string | null
  type: PmItemType | null
  sku: string | null
  category: string | null
  glAccount: string | null
  descriptionOnQuotes: string | null
  unitPrice: number | null
  costPrice: number | null
  commissionRate: number | null
  currency: string | null
  taxRateId: number | null
  /** "Offered on new documents": the ONE switch once the record has been saved. */
  isActive: boolean
  vendor: string | null
  qtyInStock: number | null
  qtyInDemand: number | null
  reorderLevel: number | null
  weight: number | null
  usageUnit: string | null
  assignedTo: number | null
  imageUrl: string | null
  taxRateName: string | null
  productMasterId: number | null
  createdBy: number | null
  createdAt: string | null
  updatedAt: string | null
}

/** The 13 fields of the About section (the Portfolio's own offer fields). */
export interface PmAboutFull {
  whatItDoes: string | null
  modulesComponents: string | null
  deploymentModel: string | null
  proofPoints: string | null
  notes: string | null
  needsSolved: string[]
  primarySegments: string[]
  triggerSignals: string[]
  pricingModel: string | null
  typicalDealBand: string | null
  implementationEffort: string | null
  deliveryOwner: string | null
  /** The offer ids of other Sub-products. */
  oftenSoldTogether: string[]
}

export interface PmOfferFull {
  /** The offer row's own id (the Portfolio's `/portfolio/offers/{id}`). */
  id: number
  /** The ID a person types and sees (SCH-01). */
  offerId: string
  name: string
  /** The Product's Portfolio group (a code). */
  product: string | null
  readiness: string | null
  readinessConfirmed: boolean
  about: PmAboutFull
}

export interface PmFullRecord {
  id: number
  key: string
  name: string
  kind: PmKind
  status: PmStatus
  origin: string
  shared: boolean
  signalKey: string | null
  portfolioName: string | null
  parent: { id: number; key: string; name: string } | null
  subProducts: Array<{ id: number; key: string; name: string; status: PmStatus }>
  offer: PmOfferFull | null
  /** The drawer's old key; null for a caller who may not view the Sell section. The screens read `sell` instead. */
  crmProduct: PmCrmItem | null
  /** null: no Sell section, or the caller may not view it. */
  sell: PmSell | null
  about: PmAboutFull | null
  icp: PmIcpState | null
  createdAt: string | null
  updatedAt: string | null
}

export interface PmUsageDoc {
  /** The document's id, for its link. */
  id: number
  number: string | null
  date: string | null
  status: string | null
}

/** `GET /{id}/usage` (Sell viewers only). `counts` and `latest` are null for a record with no catalogue row. A count is null on a host that lacks the table. */
export interface PmUsageFull {
  signals: number | null
  icp: PmIcpState | null
  priceBooks: PmPriceBookEntry[]
  quotes: number
  basePrice: number | null
  currency: string | null
  counts: Record<string, number | null> | null
  pointers: Record<string, number | null> | null
  latest: { quotes: PmUsageDoc[] | null; salesOrders: PmUsageDoc[] | null; invoices: PmUsageDoc[] | null } | null
}

export interface PmHistoryChange {
  field: string | null
  old: unknown
  new: unknown
}

export interface PmHistoryRow {
  at: string | null
  by: string | null
  byId: number | null
  store: 'about' | 'sell' | 'record'
  event: string
  type: string
  changes: PmHistoryChange[]
}

export interface PmPaging {
  total: number
  page: number
  perPage: number
  lastPage: number
}

/** One row of `GET /list` (a Product with its Sub-product count, or a Sub-product). Sell keys are there only for a caller who may view that row's Sell section. */
export interface PmListRow {
  id: number
  kind: PmKind
  name: string
  key: string
  status: PmStatus
  productId: number | null
  productName: string | null
  type: PmItemType | null
  state: 'not_sold' | 'sold' | 'paused' | 'binned' | null
  readiness: string | null
  signalsFound: number | null
  icp: PmIcpState | null
  hasAbout: boolean
  hasSell: boolean
  needsProduct: boolean
  shared: boolean
  subProductCount: number | null
  sku?: string | null
  category?: string | null
  qtyInStock?: number | null
  unitPrice?: number | null
  currency?: string | null
}

export interface PmListCan {
  createProduct: boolean
  createSubProduct: boolean
  editSubProduct: boolean
  viewSell: boolean
  confirmMatches: boolean
}

export interface PmListEnvelope {
  status: number
  data: PmListRow[]
  meta: PmPaging & { available: boolean; can: PmListCan }
}

export interface PmHistoryEnvelope {
  status: number
  data: PmHistoryRow[]
  meta: PmPaging
}

/** What the picker for a bundle's parts answers (products only; a bundle holds products). */
export interface PmPickerRow {
  crmProductId: number
  masterId: number
  name: string
  productName: string | null
  sku: string | null
  unitPrice: number | null
  currency: string | null
  taxRateId: number | null
  type: PmItemType
}
