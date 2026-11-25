/**
 * What the unified Product Portfolio reads for ONE record (hp_erp ProductMasterController: show, sell, usage, history, list, meta). Names are the API's own
 * camelCase. Read from the code on disk on 14 Nov 2026, not from the brief: where the two differ the code wins (see the P3-B log).
 *
 * A record is a Product (level 1) or a Sub-product (level 2: an About, a Sell section, ICPs, each optional). A Service is a Sub-product whose Sell type is
 * `service`. `sell` is always a key of the answer, and null for a caller who may not view the Sell section of that record's type: a person who may see
 * no price never receives one, so the screens draw a price only from a non-null `sell`.
 */
import type { PmCrmItem, PmIcpState, PmKind, PmStatus, PmItemType } from './types'

/**
 * What the Sub-products of a Product add up to in ONE currency (S16): `subtotal` is the sum of their prices, `tax` the sum of the tax each one's own rate adds,
 * `total` the two together, `counted` how many Sub-products are in it. `uncounted` is how many active Sub-products of the Product are in no total (no price yet,
 * paused, not sold): the same number in every block. Figures are JSON numbers rounded to the currency's digits.
 */
export interface PmPriceTotal {
  currency: string | null
  subtotal: number
  tax: number
  total: number
  counted: number
  uncounted: number
}

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
  /** The percentage of its tax rate (S16), null with no rate. Absent from a server that predates S16. */
  taxPercent?: number | null
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
  /** The record a pair review merged this one into; null (or absent on an older server) for every other record. */
  mergedInto?: { id: number; key: string | null; name: string } | null
  /** A Product's total, one block per currency (S16). Empty for a caller who may not view prices and for a Product with nothing priced; absent on any other record. */
  priceTotals?: PmPriceTotal[]
  /** How many Sub-products the totals hold. */
  subProductsCounted?: number
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
  /** The percentage of the Sub-product's tax rate (S16); null with no rate. */
  taxPercent?: number | null
  /** A Product row's total, one block per currency (S16); absent on a Sub-product row and for a caller who may not view prices. */
  priceTotals?: PmPriceTotal[]
  subProductsCounted?: number
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
  /** Null for a row with no entry in CRM (only in a `scope: 'all'` answer). */
  crmProductId: number | null
  masterId: number
  name: string
  productName: string | null
  sku: string | null
  unitPrice: number | null
  currency: string | null
  taxRateId: number | null
  type: PmItemType
  /** Sent only by a `scope: 'all'` answer: false when the row cannot be put on a document. */
  sold?: boolean
  state?: 'sold' | 'paused' | 'not_sold'
}

// ---------------------------------------------------------------------------------------------------------------------------- delete and move (S15 follow-up, contract 4.1 to 4.3)

/** What stops a record being deleted: a code, how many things hold it, and the plain sentence a non-technical person reads (the server writes it). */
export interface PmRemovalBlock {
  code: 'sold_on_documents' | 'records_point_at_it' | 'offer_in_use' | 'has_sub_products_blocked' | (string & {})
  count: number
  message: string
}

/** A Sub-product (or item) under a Product being deleted, and whether it can go. */
export interface PmRemovalSub {
  id: number
  name: string
  kind: 'sub_product' | 'item'
  canDelete: boolean
  blockedBy: PmRemovalBlock[]
}

/** A Product the record (or the Sub-products of a Product) may move to. */
export interface PmRemovalTarget {
  id: number
  name: string
}

/** `GET /product-master/{id}/removal`: what deleting the record would do, read before anything is asked. */
export interface PmRemovalPreview {
  id: number
  kind: PmKind
  name: string
  canDelete: boolean
  blockedBy: PmRemovalBlock[]
  subProducts: PmRemovalSub[]
  targets: PmRemovalTarget[]
}

/** The body of `POST /product-master/{id}/remove`: empty for a Sub-product, the ask-each-time answer for a Product that has Sub-products. */
export type PmRemoveBody = { subProducts: 'move'; toProductId: number } | { subProducts: 'delete' } | Record<string, never>

export interface PmRemoveResult {
  removed: number[]
  moved?: number[]
  toProductId?: number | null
}

/** The body of `POST /product-master/move`. */
export interface PmMoveBody {
  subProductIds: number[]
  toProductId: number
}

export interface PmMoveResult {
  moved: number[]
  unchanged: number[]
  toProductId: number
}
