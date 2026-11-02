/**
 * The Product Master API (hp_erp routes/product_master.php, Docs/agentic-crm/_evidence/s1-task5-… and s1-task6-…). Names are the API's own camelCase.
 *
 * Three kinds of record: a product (a top-level group such as ScholarClone), a sub-product (an item inside it, which is a Portfolio offer and may also
 * be sold from the CRM catalogue) and an item (something only in the CRM catalogue, such as a training day).
 */

export type PmKind = 'product' | 'sub_product' | 'item'
export type PmStatus = 'active' | 'archived'
export type PmItemType = 'product' | 'service'
export type PmStatusFilter = PmStatus | 'all'

export interface PmEnvelope<T> {
  status: number
  data: T
}

export interface PmSubProductRow {
  id: number
  key: string
  name: string
  status: PmStatus
  origin: string
  offerId: string | null
  readiness: string | null
  soldInCrm: boolean
  crmProductId: number | null
}

export interface PmProductRow {
  id: number
  key: string
  name: string
  kind: 'product'
  status: PmStatus
  origin: string
  /** A built-in product shared by every organisation: it cannot be changed here. */
  shared: boolean
  signalKey: string | null
  portfolioName: string | null
  subProductCount: number
  soldInCrmCount: number
  /** Signals recorded for the product by this organisation; null when Signals has no value for this product. */
  signalsFound: number | null
  subProducts: PmSubProductRow[]
}

export interface PmItemRow {
  id: number
  key: string
  name: string
  status: PmStatus
  crmProductId: number | null
}

export interface PmListData {
  products: PmProductRow[]
  items: PmItemRow[]
  totals: { products: number; subProducts: number; items: number }
}

export interface PmAbout {
  whatItDoes: string | null
  modulesComponents: string | null
  deploymentModel: string | null
  proofPoints: string | null
  notes: string | null
  needsSolved: string[]
  primarySegments: string[]
  triggerSignals: string[]
}

export interface PmOffer {
  id: number
  offerId: string
  name: string
  product: string | null
  readiness: string | null
  /** A person confirmed the readiness through the Portfolio. Never set from the Product Master. */
  readinessConfirmed: boolean
  about: PmAbout
}

export interface PmCrmItem {
  id: number
  productNo: string | null
  name: string
  sku: string | null
  type: PmItemType | null
  glAccount: string | null
  unitPrice: number | null
  currency: string | null
  taxRateId: number | null
  active: boolean
}

export interface PmRecord {
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
  offer: PmOffer | null
  crmProduct: PmCrmItem | null
  createdAt: string | null
  updatedAt: string | null
}

export interface PmPriceBookEntry {
  priceBookId: number
  priceBookNo: string | null
  name: string
  currency: string | null
  active: boolean
  listPrice: number
}

export interface PmUsage {
  signals: number | null
  priceBooks: PmPriceBookEntry[]
  quotes: number
  basePrice: number | null
  currency: string | null
}

export interface PmOption {
  id: number
  key: string
  name: string
  kind: PmKind
  parentId: number | null
  label: string
}

export interface PmTaxRate {
  id: number
  name: string
  percentage: number
}

/** What the caller may do on this screen. The server works these out from the same rules it enforces on every write. */
export interface PmCan {
  createProduct: boolean
  createSubProduct: boolean
  createItem: Record<PmItemType, boolean>
  sellInCrm: Record<PmItemType, boolean>
  editSubProduct: boolean
  editItem: Record<PmItemType, boolean>
  archive: boolean
  archiveProduct: boolean
}

export interface PmMeta {
  readinessStatuses: string[]
  itemTypes: PmItemType[]
  taxRates: PmTaxRate[]
  can: PmCan
}
