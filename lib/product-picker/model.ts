import type { PickerRow, PickerScope, PickerType, ProductLineRow } from '../../services/product-master/picker-service'
import type { PmOption } from '../../services/product-master/types'

/**
 * The pure rules of the shared product picker (slice 15, P3-C): how a typed text becomes a request, how the rows are grouped and worded, what a chosen row
 * hands back to the form, and what a refusal says. No React, no network: lib/product-picker/model.test.ts pins each rule.
 */

/** Wait this long after the last key before asking the server, so a word typed quickly is one search and not one per letter. */
export const SEARCH_DEBOUNCE_MS = 250

/** The rows one search asks for (the server's own default, and its cap is 50). */
export const DEFAULT_LIMIT = 20
export const MAX_LIMIT = 50

/** What the form receives when a person chooses a Sub-product: the id every document stores, and what the old pickers handed over with it. */
export interface PickedSubProduct {
  /** The catalogue id as a string, exactly as the old picker's `product.id` was, so a saved document body is byte for byte what it was. */
  productId: string
  /** Null for a row with no entry in CRM, which only a picker that opted in to `notSoldSelectable` can hand back. */
  crmProductId: number | null
  masterId: number
  name: string
  productName: string | null
  sku: string | null
  /** The Sell price, or null when the server did not send one (the person may not view prices of this kind). */
  unitPrice: number | null
  currency: string | null
  /** The default tax rate as a string id (the old picker's `product.taxRateId`), or null. */
  taxRateId: string | null
  type: PickerType
}

/** A chosen row as the form wants it. The id keeps the type the documents have always stored (a string), never the master id; a row with no entry in CRM has an empty one. */
export function pickedFromRow(row: PickerRow): PickedSubProduct {
  return {
    productId: row.crmProductId === null || row.crmProductId === undefined ? '' : String(row.crmProductId),
    crmProductId: row.crmProductId ?? null,
    masterId: row.masterId,
    name: row.name,
    productName: row.productName,
    sku: row.sku,
    unitPrice: row.unitPrice,
    currency: row.currency,
    taxRateId: row.taxRateId !== null && row.taxRateId !== undefined ? String(row.taxRateId) : null,
    type: row.type,
  }
}

/** The value a document holds, as the string the picker compares on. A blank, null or zero value is "nothing chosen". */
export function valueKey(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const text = String(value).trim()
  return text === '0' ? '' : text
}

/** What is typed, as it is sent: trimmed and with runs of white space collapsed. */
export function searchText(typed: string): string {
  return typed.replace(/\s+/g, ' ').trim()
}

/** How many rows to ask for: the default, and room for the rows the form hides on its own (those already on the price book). */
export function limitFor(excluded: number): number {
  return Math.min(MAX_LIMIT, DEFAULT_LIMIT + Math.max(0, Math.trunc(excluded)))
}

export interface PickerGroup {
  /** The Product above the Sub-products, or the words for those that have none yet. */
  title: string
  rows: PickerRow[]
}

export const NO_PRODUCT_TITLE = 'No Product yet'

/** The rows grouped by the Product above them, in the order the server sent (it sorts Product, then name), with the unplaced ones last. */
export function groupByProduct(rows: readonly PickerRow[]): PickerGroup[] {
  const groups: PickerGroup[] = []
  const unplaced: PickerRow[] = []
  for (const row of rows) {
    if (!row.productName) { unplaced.push(row); continue }
    const last = groups.find((group) => group.title === row.productName)
    if (last) last.rows.push(row)
    else groups.push({ title: row.productName, rows: [row] })
  }
  if (unplaced.length > 0) groups.push({ title: NO_PRODUCT_TITLE, rows: unplaced })
  return groups
}

/** `Product › Sub-product`, or the Sub-product alone when it has no Product yet. */
export function contextLabel(row: { name: string; productName: string | null }): string {
  return row.productName ? `${row.productName} › ${row.name}` : row.name
}

/** The price as a person reads it, or null when the server sent none: a price the person may not see is never drawn, not even as a zero. */
export function priceText(unitPrice: number | null | undefined, currency: string | null | undefined): string | null {
  if (unitPrice === null || unitPrice === undefined || !Number.isFinite(unitPrice)) return null
  const amount = unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${currency ?? ''} ${amount}`.trim()
}

/** The words next to a Sub-product that a document still holds but the picker no longer offers. */
export function notOfferedWords(state: string | null | undefined): string | null {
  if (state === 'paused') return 'Paused'
  if (state === 'binned' || state === 'not_sold') return 'Not sold'
  return null
}

/** The sentence under the list when it has no rows. A list of every Sub-product (`scope: 'all'`) does not say "sold": it holds the ones that are not sold too. */
export function emptyMessage(text: string, scope: PickerScope = 'sold'): string {
  if (scope === 'all') return text === '' ? 'No Sub-product yet.' : 'No sub-product matches'
  return text === '' ? 'No Sub-product is sold yet.' : 'No sold sub-product matches'
}

/** The sentence when the list is cut at its limit, so a missing row is never read as a missing record. */
export function cutMessage(shown: number, limit: number): string | null {
  return shown >= limit ? `Showing the first ${shown}. Keep typing to narrow the list.` : null
}

export interface PickerFailure {
  /** `forbidden`: the person may not view these (no Retry); `error`: it did not load (Retry). */
  kind: 'forbidden' | 'error'
  message: string
}

export function failureOf(error: unknown): PickerFailure {
  const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status?: unknown }).status) : 0
  if (status === 403) return { kind: 'forbidden', message: 'You do not have the right to choose Sub-products here.' }
  return { kind: 'error', message: 'Sub-products could not be loaded.' }
}

/** The row to highlight after a key, kept inside the list (the list neither wraps nor loses its place). */
export function moveActive(current: number, key: string, count: number): number {
  if (count <= 0) return 0
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  const next = key === 'ArrowDown' ? current + 1 : key === 'ArrowUp' ? current - 1 : current
  return Math.max(0, Math.min(count - 1, next))
}

/** The rows the form has not hidden itself, in the order the server sent. */
export function withoutExcluded(rows: readonly PickerRow[], excluded: ReadonlySet<string>): PickerRow[] {
  if (excluded.size === 0) return [...rows]
  return rows.filter((row) => row.crmProductId === null || row.crmProductId === undefined || !excluded.has(String(row.crmProductId)))
}

// ---------------------------------------------------------------------------------------------------------------------------- rows that are listed but cannot be chosen (S15 follow-up, D-7)

/** The tag on a Sub-product that has no entry in CRM, or no price: the owner's words. */
export const NOT_SOLD_TAG = 'Not sold in CRM'
export const PAUSED_TAG = 'Paused'

/**
 * Whether a row can be put on a document: it has an entry in CRM (the id every document stores) and that entry is sold. A row of the default answer carries
 * neither `sold` nor `state` and is sold; a row of a `scope: 'all'` answer says which it is.
 */
export function isOffered(row: Pick<PickerRow, 'crmProductId' | 'sold' | 'state'>): boolean {
  if (row.crmProductId === null || row.crmProductId === undefined) return false
  if (row.sold === false) return false
  return row.state === undefined || row.state === 'sold'
}

/** A row is chosen when it is offered, or when the form that holds the picker opted in to storing a row that is not (`notSoldSelectable`). */
export function isSelectable(row: Pick<PickerRow, 'crmProductId' | 'sold' | 'state'>, notSoldSelectable: boolean): boolean {
  return notSoldSelectable || isOffered(row)
}

/** The tag drawn on a row that is listed but not offered: Paused, or Not sold in CRM. Null for an offered row, which has none. */
export function rowTag(row: Pick<PickerRow, 'crmProductId' | 'sold' | 'state'>): string | null {
  if (isOffered(row)) return null
  return row.state === 'paused' ? PAUSED_TAG : NOT_SOLD_TAG
}

/** What a row is known by in the list: its catalogue id, or its master id when it has none. */
export function rowKey(row: Pick<PickerRow, 'crmProductId' | 'masterId'>): string {
  return row.crmProductId === null || row.crmProductId === undefined ? `master-${row.masterId}` : String(row.crmProductId)
}

/** The first row the keyboard may land on, or 0 when there is none (the list then has nothing to highlight). */
export function firstSelectable(selectable: readonly boolean[]): number {
  const index = selectable.indexOf(true)
  return index === -1 ? 0 : index
}

/**
 * The row to highlight after a key when some rows cannot be chosen: an arrow goes to the next row that can, Home and End to the first and the last that can, and
 * the highlight stays where it is when there is none in that direction. With every row choosable it is `moveActive`.
 */
export function moveAmongSelectable(current: number, key: string, selectable: readonly boolean[]): number {
  if (selectable.length === 0) return 0
  const first = selectable.indexOf(true)
  if (first === -1) return current
  if (key === 'Home') return first
  if (key === 'End') return selectable.lastIndexOf(true)
  const step = key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0
  if (step === 0) return current
  for (let index = current + step; index >= 0 && index < selectable.length; index += step) if (selectable[index]) return index
  return current
}

// ---------------------------------------------------------------------------------------------------------------------------- the Product box of the lead, campaign and opportunity forms

/** Four non-breaking spaces: a native list has no indent of its own, and an ordinary space at the start of an option's text is dropped. */
export const SUB_PRODUCT_INDENT = '\u00A0\u00A0\u00A0\u00A0'

/**
 * The words of one choice of the Product box. A Product is its name; a Sub-product or an item is "Fee module, under ScholarClone" (so it reads whole once it is
 * chosen and the list is closed), and one the server says is not sold in CRM carries "(Not sold)". The record that is chosen is stored by its own id, which a
 * Sub-product has, sold or not.
 */
export function lineLabel(line: Pick<ProductLineRow, 'name' | 'kind' | 'parentName' | 'sold'>): string {
  const name = String(line.name)
  const parent = line.parentName ? String(line.parentName) : null
  const base = (line.kind ?? 'product') === 'product' || parent === null ? name : `${name}, under ${parent}`
  return line.sold === false ? `${base} (Not sold)` : base
}

/** A choice as the list draws it: a Product at the left edge, its Sub-products and items indented under it. */
export function indentedLabel(option: Pick<PmOption, 'kind' | 'label'>): string {
  return option.kind === 'product' ? option.label : `${SUB_PRODUCT_INDENT}${option.label}`
}
