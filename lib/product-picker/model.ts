import type { PickerRow, PickerType } from '../../services/product-master/picker-service'

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
  crmProductId: number
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

/** A chosen row as the form wants it. The id keeps the type the documents have always stored (a string), never the master id. */
export function pickedFromRow(row: PickerRow): PickedSubProduct {
  return {
    productId: String(row.crmProductId),
    crmProductId: row.crmProductId,
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

/** The sentence under the list when it has no rows. */
export function emptyMessage(text: string): string {
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
  return rows.filter((row) => !excluded.has(String(row.crmProductId)))
}
