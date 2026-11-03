import { choiceOf } from '@/lib/product-selection'
import type { ListQueryConfig } from '@/components/shared/scaffolds/list-query'
import type { CrmProductLines } from '@/types/crm'
import type { PmIcpState, PmItemType, PmKind } from '@/services/product-master/types'

/**
 * The rules of the product lines inside the Products screen that need no browser: which scope the list is in, when the extra columns and the scope switch
 * are shown, the words and colours of an ICP state, which extra tabs a catalogue item's page gets, and the links between the pages. Tested on their own
 * (lib/product-master/lines-model.test.ts).
 *
 * "Product line" is the top-level group Signals and the Portfolio know (ScholarClone, Enterprise Brain, G2G, or one the organisation made); a
 * "sub-product" is an item inside it (a Portfolio offer); the "catalogue" is what the CRM sells (the Products list as it has always been). One sub-product
 * can also be in the catalogue. The Products screen shows the catalogue by default and the product lines beside it.
 */

export type ProductScope = 'catalogue' | 'lines'

/** Defined once, outside any component: useListQuery depends on it. The scope and the status filter live in the address, so a refresh and a pasted link open the same view. */
export const PRODUCT_LIST_QUERY: ListQueryConfig = {
  filters: {
    scope: { default: 'catalogue', allowed: ['catalogue', 'lines'] },
    status: { default: 'active', allowed: ['active', 'archived', 'all'] },
  },
}

export const SCOPE_LABELS: Record<ProductScope, string> = { catalogue: 'Catalogue', lines: 'Product lines' }

/** The scope the address names; anything else is the catalogue, so an old or mistyped link opens the screen as it has always been. */
export function readScope(value: string | null | undefined): ProductScope {
  return value === 'lines' ? 'lines' : 'catalogue'
}

/**
 * Whether the "Catalogue | Product lines" switch is drawn. Only on the Products screen (a service is not in a product line), and only where the product lines
 * exist on this server; while the product lines are open it stays, so there is always a way back to the catalogue.
 */
export function showScopeSwitch(itemType: PmItemType, lines: CrmProductLines | null | undefined, scope: ProductScope): boolean {
  if (itemType !== 'product') return false
  return scope === 'lines' || lines?.available === true
}

/** The Product line, Signals and ICP columns of the catalogue list: shown only when at least one item is tied to a sub-product, so a list with nothing to show has no empty columns. */
export function showLineColumns(lines: CrmProductLines | null | undefined): boolean {
  return (lines?.linked ?? 0) > 0
}

/** The number of columns of the catalogue table, for the rows that span it (loading, empty). */
export function catalogueColumnCount(itemType: PmItemType, showLines: boolean): number {
  // the tick box, name, category, unit price and active; products also have the stock column
  return 4 + 1 + (itemType === 'product' ? 1 : 0) + (showLines ? 3 : 0)
}

/** What an empty catalogue says about the product lines, when there are some: the catalogue is empty but the organisation is not. Null when there is nothing to add. */
export function emptyCatalogueHint(lines: CrmProductLines | null | undefined): string | null {
  if (!lines?.available) return null
  const lineCount = lines.productLines
  const subCount = lines.subProducts
  if (lineCount + subCount === 0) return null
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  return `Your product lines are in the other view: ${plural(lineCount, 'product line', 'product lines')} with ${plural(subCount, 'sub-product', 'sub-products')}.`
}

// ---- the state of an ideal-customer profile ----

const ICP_LABELS: Record<PmIcpState, string> = { active: 'Active', draft: 'Draft', archived: 'Archived', template: 'Built-in', none: 'Not set up' }

const ICP_TITLES: Record<PmIcpState, string> = {
  active: 'An ideal-customer profile is saved and in use.',
  draft: 'An ideal-customer profile is saved as a draft.',
  archived: 'The ideal-customer profile was archived.',
  template: 'A built-in product: it runs on its built-in ideal-customer profile, and none of your own is saved.',
  none: 'No ideal-customer profile is saved yet.',
}

/** The word for an ICP state, or null when none applies (the cell shows a dash). */
export function icpLabel(state: PmIcpState | null | undefined): string | null {
  return state ? ICP_LABELS[state] ?? null : null
}

/** The sentence a tooltip gives for an ICP state. */
export function icpTitle(state: PmIcpState | null | undefined): string | undefined {
  return state ? ICP_TITLES[state] : undefined
}

export type IcpTone = 'success' | 'primary' | 'pending' | 'inactive' | 'default'

/** The colour an ICP state is drawn in: in use reads as good, a draft as pending, archived as quiet, built-in as informational, none as plain. */
export function icpTone(state: PmIcpState | null | undefined): IcpTone {
  switch (state) {
    case 'active': return 'success'
    case 'draft': return 'pending'
    case 'archived': return 'inactive'
    case 'template': return 'primary'
    default: return 'default'
  }
}

// ---- the extra tabs of a catalogue item's page ----

export type ExtraTab = 'signals' | 'usage'

export const EXTRA_TAB_LABELS: Record<ExtraTab, string> = { signals: 'Signals & ICP', usage: 'Usage' }

/**
 * The tabs a catalogue item's page gains from the product lines behind it. A catalogue item tied to a sub-product gets both: what Signals found for it and
 * the state of its ICP, and where it is used (quotes, price books). An item that is only in the catalogue has no signals or ICP to show but does have
 * quotes and price books, so it gets Usage alone. An item with no record behind it gets neither.
 */
export function extraTabs(masterKind: PmKind | null | undefined): ExtraTab[] {
  if (masterKind === 'sub_product') return ['signals', 'usage']
  if (masterKind === 'item') return ['usage']
  return []
}

export type DetailTabId = 'details' | 'bundle' | 'history' | 'custom' | ExtraTab

/**
 * The tabs of a catalogue item's page, in order: Details, Bundle (products only), the extra tabs the product lines add, History, and Custom Fields when the
 * organisation has some. An item with no record behind it (`masterId` null) has exactly the tabs it had before the product lines existed.
 */
export function detailTabs(item: { bundleable: boolean; hasCustomFields: boolean; masterId: number | null | undefined; masterKind: PmKind | null | undefined }): Array<{ id: DetailTabId; label: string }> {
  const extra = item.masterId !== null && item.masterId !== undefined ? extraTabs(item.masterKind) : []
  return [
    { id: 'details', label: 'Details' },
    ...(item.bundleable ? [{ id: 'bundle' as const, label: 'Bundle' }] : []),
    ...extra.map((id) => ({ id, label: EXTRA_TAB_LABELS[id] })),
    { id: 'history', label: 'History' },
    ...(item.hasCustomFields ? [{ id: 'custom' as const, label: 'Custom Fields' }] : []),
  ]
}

// ---- links ----

/** The page of a catalogue item: Products or Services, by its type. */
export function catalogueItemHref(hrefs: { products: string; services: string }, crmProductId: number | string, type: PmItemType | null | undefined): string {
  return `${type === 'service' ? hrefs.services : hrefs.products}/${crmProductId}`
}

/** The page of a product line or of a sub-product that is not in the catalogue (it has no catalogue page of its own). */
export function lineRecordHref(productsHref: string, masterId: number | string): string {
  return `${productsHref}/lines/${masterId}`
}

/** The Products screen with the product lines open. */
export function linesScopeHref(productsHref: string): string {
  return `${productsHref}?scope=lines`
}

/**
 * Company Opportunities for one product line, or for one of its sub-products: the Signals screen's own `?product=` address, so the page that counts the
 * signals can also show them. The sub-product form is "line::ID", which a screen that only knows product lines reads as the line.
 */
export function signalsHref(lineKey: string | null | undefined, offerId?: string | null): string | null {
  if (!lineKey) return null
  return `/signals?product=${encodeURIComponent(choiceOf(lineKey, offerId))}`
}

/** "5 product lines and 25 sub-products", for the line under the title of the product lines. */
export function linesSummary(totals: { products: number; subProducts: number }): string {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  return `${plural(totals.subProducts, 'sub-product', 'sub-products')} in ${plural(totals.products, 'product line', 'product lines')}.`
}
