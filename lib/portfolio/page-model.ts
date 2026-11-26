import type { PmHistoryChange, PmHistoryRow, PmSell, PmUsageFull, PmUsageDoc } from '@/services/product-master/record-types'
import type { PmIcpState, PmItemType } from '@/services/product-master/types'
import { formatMoney as formatMoneyText } from '@/lib/money/format'
import { choiceOf } from '@/lib/product-selection'
import { PRODUCT_ONLY_SELL_FIELDS } from './form-model'

/*
 * What the Sub-product page and the Product page show, as plain functions: which tabs a caller gets, the rows of the Details tab (the fifteen fields the old
 * Products page read, plus who it is assigned to; a Service hides five), the words of a state, the lines of the Usage and History tabs. No React, so every
 * rule is tested without a browser. Words: Product and Sub-product.
 */

export type SubTabId = 'overview' | 'details' | 'bundle' | 'usage' | 'history' | 'signals' | 'custom'
export type ProductTabId = 'overview' | 'sub-products' | 'signals' | 'history'

export const SUB_TAB_LABELS: Record<SubTabId, string> = {
  overview: 'Overview', details: 'Details', bundle: 'Bundle', usage: 'Usage', history: 'History', signals: 'Signals & ICP', custom: 'Custom Fields',
}
export const PRODUCT_TAB_LABELS: Record<ProductTabId, string> = { overview: 'Overview', 'sub-products': 'Sub-products', signals: 'Signals & ICP', history: 'History' }
export const PRODUCT_TAB_IDS: readonly ProductTabId[] = ['overview', 'sub-products', 'signals', 'history']

/**
 * The tab a Product page opens on, from `?tab=`. The addresses that already exist keep working: `offers` (every link written before the merge) and `icp`
 * (an older one still) open the Sub-products; `sub-products` and `signals` are the new names; anything else opens the Overview.
 */
export function resolveProductTab(value: string | null | undefined): ProductTabId {
  if (value === 'offers' || value === 'icp' || value === 'sub-products') return 'sub-products'
  if (value === 'signals') return 'signals'
  return value === 'history' ? 'history' : 'overview'
}

export interface TabInput {
  /** The Sell section, null when there is none or the caller may not view it. */
  sell: PmSell | null
  /** The caller may view the Sell side of at least one type (the list's `can.viewSell`), also on a record that has no Sell section. */
  viewSell: boolean
  /** The organisation has custom field definitions for the catalogue (the hidden section reported some). */
  hasCustomFields: boolean
}

/**
 * The tabs a caller gets on a Sub-product. A tab the caller may not see is not drawn at all: no empty tab, no refusal text. Details, Bundle and Usage are the
 * Sell side (a record with a Sell section the caller may view); the Bundle is for products only, as the old Products page had it; History carries the Sell
 * lines, so it is for a Sell viewer; Custom Fields exist only when the record has a catalogue row AND the organisation has definitions for it.
 */
export function subProductTabs({ sell, viewSell, hasCustomFields }: TabInput): SubTabId[] {
  const tabs: SubTabId[] = ['overview']
  if (sell !== null) tabs.push('details')
  if (sell !== null && sell.type === 'product') tabs.push('bundle')
  if (sell !== null) tabs.push('usage')
  if (sell !== null || viewSell) tabs.push('history')
  tabs.push('signals')
  if (sell !== null && hasCustomFields) tabs.push('custom')

  return tabs
}

// ---------------------------------------------------------------------------------------------------------------------------- state words

export type SellStateWord = 'sold' | 'paused' | 'not_sold'

/** The state of the Sell side in words a person uses. A row in the Recycle Bin is Not sold: the Sub-product stays, its entry can be brought back. */
export function sellWord(state: 'sold' | 'paused' | 'binned' | 'not_sold' | null | undefined): SellStateWord {
  return state === 'sold' ? 'sold' : state === 'paused' ? 'paused' : 'not_sold'
}

export const SELL_STATE_LABEL: Record<SellStateWord, string> = { sold: 'Sold in CRM', paused: 'Paused', not_sold: 'Not sold' }

export function icpStateLabel(state: PmIcpState | null | undefined): string {
  switch (state) {
    case 'active': return 'In use'
    case 'draft': return 'Draft'
    case 'archived': return 'Archived'
    case 'template': return 'Built in'
    case 'none': return 'None yet'
    default: return 'Not applicable'
  }
}

// ---------------------------------------------------------------------------------------------------------------------------- Details

/** An amount with its currency's symbol ("₹1,500.00"); the one rule is `lib/money/format.ts`. */
export const formatMoney = (amount: number | null | undefined, currency: string | null | undefined): string | null => formatMoneyText(amount, currency)

const plain = (n: number | null | undefined): string | null => (n === null || n === undefined ? null : String(n))

export interface DetailRow { label: string; value: string | null }

/**
 * The Details tab: every field the old Products page read (SKU, category, GL account, unit price, cost price, commission, tax rate, status, usage unit,
 * vendor, stock, stock in demand, reorder level, weight, description on quotes) plus who it is assigned to. A Service hides vendor, stock, stock in demand,
 * reorder level and weight. A value with nothing stored is null (the screen says "Not recorded", it never invents one).
 */
export function detailRows(sell: PmSell, assignee: string | null): DetailRow[] {
  const service = sell.type === 'service'
  const rows: DetailRow[] = [
    { label: 'SKU', value: sell.sku },
    { label: 'Category', value: sell.category },
    { label: 'GL account', value: sell.glAccount },
    { label: 'Unit price', value: formatMoney(sell.unitPrice, sell.currency) },
    { label: 'Cost price', value: formatMoney(sell.costPrice, sell.currency) },
    { label: 'Commission %', value: sell.commissionRate === null ? null : `${sell.commissionRate}%` },
    { label: 'Tax rate', value: sell.taxRateName ?? (sell.taxRateId === null ? 'Default' : `Rate ${sell.taxRateId}`) },
    { label: 'Offered on new documents', value: sell.state === 'binned' ? 'No (in the Recycle Bin)' : sell.isActive ? 'On' : 'Paused' },
    { label: 'Usage unit', value: sell.usageUnit },
    { label: 'Vendor', value: sell.vendor },
    { label: 'Stock', value: plain(sell.qtyInStock) },
    { label: 'Stock in demand', value: plain(sell.qtyInDemand) },
    { label: 'Reorder level', value: plain(sell.reorderLevel) },
    { label: 'Weight (kg)', value: plain(sell.weight) },
    { label: 'Description on quotes', value: sell.descriptionOnQuotes },
    { label: 'Assigned to', value: assignee },
  ]
  const hidden: Record<string, string> = { vendor: 'Vendor', qtyInStock: 'Stock', qtyInDemand: 'Stock in demand', reorderLevel: 'Reorder level', weight: 'Weight (kg)' }
  const gone = service ? PRODUCT_ONLY_SELL_FIELDS.map((f) => hidden[f]) : []

  return rows.filter((r) => !gone.includes(r.label))
}

export const typeWord = (type: PmItemType | null | undefined): string => (type === 'service' ? 'Service' : 'Sub-product')

// ---------------------------------------------------------------------------------------------------------------------------- Usage

/** The counts of the Usage tab, in the order a person looks for them. A count of null (a host without that table) is left out, never drawn as 0. */
export const USAGE_COUNTS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'quotes', label: 'Quotes' },
  { key: 'salesOrders', label: 'Sales orders' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'opportunities', label: 'Opportunities' },
  { key: 'bundleParts', label: 'Parts in its bundle' },
  { key: 'usedInBundles', label: 'Bundles it is a part of' },
  { key: 'tickets', label: 'Tickets' },
  { key: 'assets', label: 'Assets' },
  { key: 'faqs', label: 'FAQs' },
  { key: 'campaigns', label: 'Campaigns' },
]

export function usageCounts(usage: PmUsageFull): Array<{ label: string; value: number }> {
  const counts = usage.counts ?? {}
  return USAGE_COUNTS.flatMap(({ key, label }) => (typeof counts[key] === 'number' ? [{ label, value: counts[key] as number }] : []))
}

export type DocKind = 'quotes' | 'salesOrders' | 'invoices'
export const DOC_KINDS: ReadonlyArray<{ key: DocKind; title: string; singular: string }> = [
  { key: 'quotes', title: 'Latest quotes', singular: 'quote' },
  { key: 'salesOrders', title: 'Latest sales orders', singular: 'sales order' },
  { key: 'invoices', title: 'Latest invoices', singular: 'invoice' },
]

export function latestDocs(usage: PmUsageFull, kind: DocKind): PmUsageDoc[] {
  return usage.latest?.[kind] ?? []
}

/** The address of a document's own page: the list's address, a slash and its id. */
export const docHref = (base: string, id: number): string => `${base.replace(/\/$/, '')}/${id}`

// ---------------------------------------------------------------------------------------------------------------------------- History

const FIELD_WORDS: Record<string, string> = {
  name: 'Name', sku: 'SKU', category: 'Category', gl_account: 'GL account', description: 'Description on quotes', unit_price: 'Unit price', cost_price: 'Cost price',
  commission_rate: 'Commission %', currency: 'Currency', tax_rate_id: 'Tax rate', is_active: 'Offered on new documents', vendor: 'Vendor', qty_in_stock: 'Stock',
  qty_in_demand: 'Stock in demand', reorder_level: 'Reorder level', weight: 'Weight (kg)', usage_unit: 'Usage unit', assigned_to: 'Assigned to', item_type: 'Type',
  product_master_id: 'Product', product_no: 'Number', deleted_at: 'Moved to the Recycle Bin', image: 'Picture',
  offer_id: 'ID', parent_product: 'Product', what_it_does: 'What it does', modules_components: 'Features and capabilities', needs_solved: 'Customer problems solved',
  primary_segments: 'Target customers', trigger_signals: 'Buying events', proof_points: 'Benefits and proof', pricing_model: 'Pricing model',
  typical_deal_band: 'Typical deal size', deployment_model: 'Deployment', implementation_effort: 'Implementation effort', delivery_owner: 'Delivery owner',
  notes: 'Notes', bundles_with: 'Often sold together', readiness_status: 'Readiness', readiness_confirmed: 'Readiness confirmed', partner_sellable: 'Partner sellable',
  status: 'Status', parent_id: 'Product', offer_row_id: 'About', crm_product_id: 'Sell in CRM', product_key: 'Key', kind: 'Kind', origin: 'Origin',
}

export function fieldWord(field: string | null | undefined): string {
  if (!field) return 'A field'
  if (FIELD_WORDS[field]) return FIELD_WORDS[field]
  const spaced = field.replace(/_/g, ' ').trim()

  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

const shown = (field: string | null, value: unknown): string => {
  if (value === null || value === undefined || value === '') return 'empty'
  if (field === 'is_active') return value === true || value === 1 || value === '1' ? 'On' : 'Paused'
  if (Array.isArray(value)) return value.length === 0 ? 'empty' : value.join(', ')
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)

  return text.length > 140 ? `${text.slice(0, 137)}…` : text
}

/**
 * The fields of a record that only the system fills in (its ids, its organisation, who and when it was made, the pointers between the three stores). A "Created" line of
 * the History used to list every one of them ("Sub institute id: empty → 6"), which says nothing to a person; they are left out, the person's own fields stay.
 */
export const SYSTEM_HISTORY_FIELDS: ReadonlySet<string> = new Set([
  'id', 'sub_institute_id', 'created_by', 'created_at', 'updated_at', 'product_key', 'key', 'origin', 'kind', 'offer_row_id', 'crm_product_id', 'product_master_id', 'item_type',
])

/** The changes of a history line a person reads: the system's own fields are left out. */
export const visibleChanges = (changes: readonly PmHistoryChange[]): PmHistoryChange[] => changes.filter((c) => c.field === null || !SYSTEM_HISTORY_FIELDS.has(c.field))

export function describeChange(change: PmHistoryChange): string {
  if (change.field === 'deleted_at') return change.new === null || change.new === undefined ? 'Brought back from the Recycle Bin' : 'Moved to the Recycle Bin'
  return `${fieldWord(change.field)}: ${shown(change.field, change.old)} → ${shown(change.field, change.new)}`
}

export const STORE_WORD: Record<PmHistoryRow['store'], string> = { about: 'About', sell: 'Sell in CRM', record: 'Record' }

export function eventWord(row: PmHistoryRow): string {
  return row.event === 'created' ? 'Created' : row.event === 'deleted' ? 'Moved to the Recycle Bin' : row.event === 'moved' ? 'Moved to another Product' : 'Changed'
}

/** The date of a history line as a person reads it. A value the browser cannot read is shown as it came. */
export function whenWord(at: string | null): string {
  if (!at) return 'Unknown time'
  const date = new Date(at.replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? at : date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ---------------------------------------------------------------------------------------------------------------------------- links

/**
 * Company Opportunities for one Product, or for one of its Sub-products: the Signals screen's own `?product=` address, so the page that counts the signals can
 * also show them. A Sub-product is "key::ID" (`choiceOf`); a record with no Product key has no address (null). Moved here from the old product-line model when
 * the old Products screens were removed (slice 15, WPD); its one caller is the Signals & ICP tab.
 */
export function signalsHref(productKey: string | null | undefined, offerId?: string | null): string | null {
  if (!productKey) return null
  return `/signals?product=${encodeURIComponent(choiceOf(productKey, offerId))}`
}
