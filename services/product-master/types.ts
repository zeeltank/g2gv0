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

/**
 * The state of an ideal-customer profile (ICP): `active`, `draft` or `archived` (the best of the organisation's saved profiles), `template` (a built-in
 * product that runs on its built-in ICP and has none saved) or `none` (it could have one and has none). null: an ICP does not apply to this record.
 */
export type PmIcpState = 'active' | 'draft' | 'archived' | 'template' | 'none'

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
  /** Which CRM screen the catalogue item opens in (null when it is not sold, or sits in the Recycle Bin). */
  crmItemType: PmItemType | null
  /** Signals recorded for the sub-product by this organisation. */
  signalsFound: number | null
  icp: PmIcpState | null
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
  /** null when Signals has no value for this product, so no ICP applies. */
  icp: PmIcpState | null
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
  /** false: this server has no Product Master yet, so the lists are empty. Absent from a server that predates the field (treated as available). */
  available?: boolean
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
  /** The ICP's state (its content is never sent here). null for a catalogue-only item. */
  icp: PmIcpState | null
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
  /** Archiving is behind the screen's delete right; restoring is behind its edit right, so they are separate flags. */
  archive: boolean
  archiveProduct: boolean
  restore: boolean
  restoreProduct: boolean
}

export interface PmMeta {
  readinessStatuses: string[]
  itemTypes: PmItemType[]
  taxRates: PmTaxRate[]
  can: PmCan
}
