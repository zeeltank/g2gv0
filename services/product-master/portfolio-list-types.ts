/**
 * What the Product Portfolio LIST and its pair review read and send (hp_erp ProductMasterController::list, ProductMatchController, ProductMatchSuggester).
 * Names are the API's own camelCase, read from the code on disk on 14 Nov 2026 (slice 15, track P3-A). Words on screen: Product and Sub-product.
 */

export type PortfolioKind = 'product' | 'sub_product' | 'item'
export type PortfolioItemType = 'product' | 'service'
export type PortfolioSellState = 'not_sold' | 'sold' | 'paused' | 'binned'
export type PortfolioIcpState = 'active' | 'draft' | 'archived' | 'template' | 'none'

/**
 * One row of `GET /api/product-master/list`: a Product (kind `product`, with its Sub-product count) or a Sub-product. The five Sell keys (`sku`, `category`,
 * `qtyInStock`, `unitPrice`, `currency`) are ABSENT, not null, for a caller who may not view the Sell section of that row's type.
 */
export interface PortfolioRow {
  id: number
  kind: PortfolioKind
  name: string
  key: string
  status: 'active' | 'archived'
  productId: number | null
  productName: string | null
  type: PortfolioItemType | null
  state: PortfolioSellState | null
  readiness: string | null
  signalsFound: number | null
  icp: PortfolioIcpState | null
  hasAbout: boolean
  hasSell: boolean
  needsProduct: boolean
  shared: boolean
  subProductCount: number | null
  /** The catalogue id. The API does not send it in a list row today (the Sell read does); when it does, the bulk actions use it without asking again. */
  crmProductId?: number | null
  sku?: string | null
  category?: string | null
  qtyInStock?: number | null
  unitPrice?: number | null
  currency?: string | null
}

export interface PortfolioCan {
  createProduct: boolean
  createSubProduct: boolean
  editSubProduct: boolean
  viewSell: boolean
  confirmMatches: boolean
}

export interface PortfolioListMeta {
  available: boolean
  total: number
  page: number
  perPage: number
  lastPage: number
  can: PortfolioCan
}

export interface PortfolioListEnvelope {
  status: number
  data: PortfolioRow[]
  meta: PortfolioListMeta
}

/** What the list may be asked for. Every field is optional: an absent one means "no filter" (or the server's default). */
export interface PortfolioListQuery {
  q?: string
  productId?: number
  type?: 'subproduct' | 'service'
  sold?: 'yes' | 'no' | 'paused'
  readiness?: string
  status?: 'active' | 'archived' | 'all'
  sort?: 'name' | 'readiness' | 'signals' | 'price'
  dir?: 'asc' | 'desc'
  page?: number
  per?: number
}

// ---------------------------------------------------------------------------------------------------------------------------- the pair review

/** The verdict words exactly as the API sends them. Only the first three come with a Sub-product to decide about. */
export type MatchVerdict = 'MATCH-HIGH' | 'EDITION' | 'AMBIGUOUS' | 'SERVICE' | 'NO-MATCH' | 'STRAY' | 'JUNK?'

export interface MatchCandidate {
  masterId: number
  offerRowId: number | null
  offerCode: string | null
  name: string
  readiness: string | null
}

/** One entry sold in CRM that may be the same product as a Sub-product. */
export interface MatchRow {
  itemMasterId: number
  crmId: number
  productNo: string
  name: string
  sku: string | null
  category: string | null
  type: PortfolioItemType
  price: number | null
  currency: string | null
  productId: number | null
  productName: string | null
  usage: Record<string, number>
  verdict: MatchVerdict
  candidate: MatchCandidate | null
  score: number
  margin: number
  reasons: string[]
  sharedWith: number[]
  alternatives: Array<{ masterId: number; offerCode: string | null; name: string; score: number }>
}

export interface MatchDecisionRow {
  id: number
  itemMasterId: number
  itemName: string | null
  survivorMasterId: number
  survivorName: string | null
  decision: 'same' | 'different'
  score: number | null
  signals: string | null
  nameKept: 'portfolio' | 'catalogue' | null
  decidedBy: number | null
  decidedAt: string | null
}

export interface MatchesData {
  matches: MatchRow[]
  unmatchedSubProducts: unknown[]
  binnedItems: unknown[]
  decisions: MatchDecisionRow[]
  counts: { items: number; byVerdict: Record<string, number> }
  notes: string[]
}

export interface MatchesEnvelope {
  status: number
  data: MatchesData
}

export type MatchDecisionWord = 'same' | 'different'

export interface MatchDecisionBody {
  itemMasterId: number
  survivorMasterId: number
  decision: MatchDecisionWord
  nameKept?: 'portfolio' | 'catalogue'
}

/** The answer to a decision: `result` is `merged`, `already_merged`, `recorded` or `already_decided`. */
export interface MatchDecisionResult {
  status: number
  data: {
    decision: MatchDecisionWord
    result: string
    merged: boolean
    itemMasterId: number
    survivorMasterId: number
    name?: string
    nameKept?: string
  }
}

/** The part of a master record the redirects need: where it lives, and what kind it is. */
export interface RecordHead {
  id: number
  kind: PortfolioKind
  key: string
  name: string
}

export interface ByCrmAnswer {
  status: number
  /** `mergedInto`: the record a pair review merged this one into (the server's alias of a retired record), null for every other record. */
  data: { id: number; kind: PortfolioKind; mergedInto?: { id: number; key: string | null; name: string } | null }
}
