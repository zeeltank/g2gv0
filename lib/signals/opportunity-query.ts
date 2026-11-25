import type { ListQuery, ListQueryConfig, ListQueryPatch } from '@/components/shared/scaffolds/list-query'
import { resolveSelection } from '@/lib/product-selection'
import type { OpportunityQuery } from '@/services/signals/opportunities'
import { FRESHNESS_CHOICES, isNarrowed, listScreenState, reviewStatusOf, STATUS_CHOICES, type Choice, type ListScreenState } from './list-model'

/**
 * Company Opportunities' list as the address keeps it. The names are the Signal Review's own (`q`, `sort`, `page`, `product`, `status`, `freshness`,
 * `fit`), so a link made for the Review opens the same view here. No box on the screen sets `status`, `freshness`, `fit` or `sort` any more (the
 * Product, Sub-Product, ICP Type and Region selectors above the list are its filters); they stay readable from a link. Pure, so the rules that matter
 * (what a link with only a search means, what a number in `product` means, what a request carries) are proved without a browser.
 */

// ── The address ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Signals per page: five, as the screen always showed. There is no page-size box and no `per` in the address. */
export const DEFAULT_PER_PAGE = 5

/**
 * The orders a link can ask for (no box on the screen picks one any more). `default` is the order the screen has always used and the one it opens on; `recent` is the Signal Review's "newest
 * evidence first, undated last". The words match the Review where the order is the same.
 */
export const OPPORTUNITY_SORT_CHOICES: Choice[] = [
  { value: 'default', label: 'Newest first' },
  { value: 'recent', label: 'Newest evidence' },
  { value: 'priority', label: 'Priority' },
  { value: 'qualification', label: 'Qualification' },
]

/**
 * Defined once, outside any component (useListQuery depends on it). It differs from the Signal Review's own on purpose: Status opens on "All" (this screen
 * has always shown every status, and a bare /signals must look as it did), the order opens on the screen's usual one, and `product` has NO default:
 * an empty `product` means "not named", which the screen answers with the remembered product, or with All products for a link that only searches.
 */
export const OPPORTUNITIES_QUERY: ListQueryConfig = {
  sort: 'default',
  sortKeys: OPPORTUNITY_SORT_CHOICES.map((choice) => choice.value),
  dir: 'desc',
  filters: {
    product: { default: '' },
    status: { default: 'all', allowed: STATUS_CHOICES.map((choice) => choice.value) },
    freshness: { default: 'all', allowed: FRESHNESS_CHOICES.map((choice) => choice.value) },
    fit: { default: 'all' },
  },
}

/** The address parameters that, without a `product`, mean "show me this across every product" (Ask answers and Account 360 link with `?status=all&q=…`). */
export const SEARCH_PARAMS = ['q', 'status', 'freshness', 'fit'] as const

/** True when the address already asks a question of the list (a search or a facet), whatever the product. Blank values do not count. */
export function asksTheList(params: { get(name: string): string | null }): boolean {
  return SEARCH_PARAMS.some((name) => (params.get(name) ?? '').trim() !== '')
}

/** What the server accepts for `search` (`max:100`). A longer text from a link is cut to it, so a long title finds its signal instead of failing with a 422. */
export const SEARCH_MAX = 100

/** "Clear filters": no search, every status, any age, any fit. The product stays: it says which signals the screen is about, it is not a filter of them. */
export function clearOpportunityFiltersPatch(): ListQueryPatch {
  return { q: '', filters: { status: 'all', freshness: 'all', fit: 'all' } }
}

/** What the address says, as the list request's own fields. A facet left on "All" sends nothing, so the server applies no filter for it. */
export function listRequest(query: ListQuery): Pick<OpportunityQuery, 'search' | 'reviewStatus' | 'freshness' | 'businessFit' | 'sort' | 'page' | 'perPage'> {
  const freshness = query.filters.freshness
  const fit = query.filters.fit
  return {
    search: query.q !== '' ? query.q.slice(0, SEARCH_MAX) : undefined,
    reviewStatus: reviewStatusOf(query.filters.status) ?? undefined,
    freshness: freshness && freshness !== 'all' ? (freshness as OpportunityQuery['freshness']) : undefined,
    businessFit: fit && fit !== 'all' ? fit : undefined,
    sort: query.sort as OpportunityQuery['sort'],
    page: query.page,
    perPage: DEFAULT_PER_PAGE,
  }
}

/**
 * Which of the Review's five states the list is in. The product is a scope here, not a filter, so it is left out of "is the list narrowed"; the status is
 * a filter here (it opens on All), so a chosen status is counted by the caller, which also knows the source tab.
 */
export function opportunityListState(input: { loaded: boolean; error: string; rows: number; summaryTotal: number; query: ListQuery }): ListScreenState {
  const scoped: ListQuery = { ...input.query, filters: { ...input.query.filters, product: 'all' } }
  return listScreenState({ ...input, query: scoped })
}

/** True when the search or a facet narrows the list (the product is not counted, see above). */
export function isNarrowedHere(query: ListQuery): boolean {
  return isNarrowed({ ...query, filters: { ...query.filters, product: 'all' } }) || (query.filters.status ?? 'all') !== 'all'
}

// ── Which product the screen is about ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * What the screen shows: every product, one product (a key, or `key::SUB-ID` for one of its sub-products: the only scope a research run can have), or
 * the signals filed under one Product Master record (a number, the Signal Review's meaning of `product`).
 */
export type ProductScope =
  | { kind: 'all' }
  | { kind: 'product'; choice: string }
  | { kind: 'master'; id: number }

type ScopeProduct = { key: string; ready: boolean; offers?: { offer_id: string }[] }

/**
 * The scope for the `product` the address holds.
 *  - `all` is every product. A number is a Product Master record, unless a product really is called that.
 *  - A product key, or a key with a sub-product, is that product; anything else the screen does not know falls back to its usual start.
 *  - No `product` at all: a link that only searches or filters (`?status=all&q=…`, as the Ask answers and Account 360 make them) opens on All products,
 *    because the signal it points at may belong to any product; with no parameters at all the screen starts as it always did, on the product the person
 *    last used here, else on the first ready product.
 * Null while the products have not arrived and the answer depends on them (a link that names `all`, or only searches, never has to wait).
 */
export function resolveProductScope(input: {
  product: string
  asksTheList: boolean
  remembered: string | null
  products: readonly ScopeProduct[] | null
}): ProductScope | null {
  const named = input.product.trim()
  if (named === 'all') return { kind: 'all' }
  if (named === '' && input.asksTheList) return { kind: 'all' }
  if (!input.products) return null

  if (named === '') return { kind: 'product', choice: resolveSelection(input.remembered, [...input.products], false, true) }
  if (input.products.some((p) => p.key === named)) return { kind: 'product', choice: named }
  if (/^[1-9]\d*$/.test(named)) return { kind: 'master', id: Number(named) }
  return { kind: 'product', choice: resolveSelection(named, [...input.products], false, true) }
}

/** The `product` an address should hold for a choice of the dropdown: the key (or `key::SUB-ID`), `all`, or the Product Master number as it was. */
export function productParam(scope: ProductScope): string {
  switch (scope.kind) {
    case 'all': return 'all'
    case 'product': return scope.choice
    case 'master': return String(scope.id)
  }
}
