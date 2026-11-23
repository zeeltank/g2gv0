import type { ListQuery, ListQueryConfig, ListQueryPatch } from '@/components/shared/scaffolds/list-query'
import type { PortfolioListQuery } from '@/services/product-master/portfolio-list-types'

/**
 * The Product Portfolio list as the address keeps it (slice 15, track P3-A). A refresh, the Back button and a pasted link open the same view, and the
 * Services entry of the sidebar is just `/portfolio?type=service`. The names are the API's own where it has one (`q`, `type`, `sold`, `readiness`, `status`,
 * `sort`, `dir`, `page`), so a link reads like the request it makes. Pure: the rules are proved without a browser.
 */

export const PER_PAGE_CHOICES = ['20', '50', '100'] as const
export const DEFAULT_PER_PAGE = 20

export const SORT_KEYS = ['name', 'readiness', 'signals', 'price'] as const
export type SortKey = (typeof SORT_KEYS)[number]

export interface Choice {
  value: string
  label: string
}

export const TYPE_CHOICES: Choice[] = [
  { value: 'all', label: 'All types' },
  { value: 'subproduct', label: 'Sub-product' },
  { value: 'service', label: 'Service' },
]

export const SOLD_CHOICES: Choice[] = [
  { value: 'all', label: 'All' },
  { value: 'yes', label: 'Sold' },
  { value: 'no', label: 'Not sold' },
  { value: 'paused', label: 'Paused' },
]

export const STATUS_CHOICES: Choice[] = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
]

export const PER_PAGE_LABELS: Choice[] = PER_PAGE_CHOICES.map((value) => ({ value, label: `${value} per page` }))

/**
 * Defined once, outside any component (useListQuery depends on it). `product` is a Product's number ("" = every Product), `readiness` the Portfolio's own
 * readiness words ("" = any), and `view` is `list` or `matches` (the pair review, a section of this same page).
 */
export const PORTFOLIO_QUERY: ListQueryConfig = {
  sort: 'name',
  sortKeys: SORT_KEYS,
  dir: 'asc',
  filters: {
    product: { default: '' },
    type: { default: 'all', allowed: TYPE_CHOICES.map((c) => c.value) },
    sold: { default: 'all', allowed: SOLD_CHOICES.map((c) => c.value) },
    readiness: { default: '' },
    status: { default: 'active', allowed: STATUS_CHOICES.map((c) => c.value) },
    per: { default: String(DEFAULT_PER_PAGE), allowed: PER_PAGE_CHOICES },
    view: { default: 'list', allowed: ['list', 'matches'] },
  },
}

/** What the server accepts for a search; a longer text from a link is cut to it, so a long title finds its row instead of failing. */
export const SEARCH_MAX = 100

export function perPageOf(query: Pick<ListQuery, 'filters'>): number {
  const value = Number(query.filters.per)
  return (PER_PAGE_CHOICES as readonly string[]).includes(String(value)) ? value : DEFAULT_PER_PAGE
}

/** The Product the address names, as the API's `productId`; anything that is not a whole number from 1 up names none. */
export function productIdOf(query: Pick<ListQuery, 'filters'>): number | undefined {
  const raw = (query.filters.product ?? '').trim()
  return /^[1-9]\d{0,14}$/.test(raw) ? Number(raw) : undefined
}

/** Which sort the list really uses: price belongs to the people who may see prices (the server answers Name to anybody else, and so does this). */
export function effectiveSort(query: Pick<ListQuery, 'sort'>, canViewSell: boolean): SortKey {
  const sort = (SORT_KEYS as readonly string[]).includes(query.sort) ? (query.sort as SortKey) : 'name'
  return sort === 'price' && !canViewSell ? 'name' : sort
}

/** What the address says, as the list request's own fields. A choice left on "All" sends nothing, so the server applies no filter for it. */
export function listRequest(query: ListQuery): PortfolioListQuery {
  const type = query.filters.type
  const sold = query.filters.sold
  const readiness = (query.filters.readiness ?? '').trim()
  const status = query.filters.status
  return {
    q: query.q !== '' ? query.q.slice(0, SEARCH_MAX) : undefined,
    productId: productIdOf(query),
    type: type === 'subproduct' || type === 'service' ? type : undefined,
    sold: sold === 'yes' || sold === 'no' || sold === 'paused' ? sold : undefined,
    readiness: readiness !== '' ? readiness : undefined,
    status: status === 'archived' || status === 'all' ? status : 'active',
    // The server answers Name to a caller who may not view prices, whatever the address says; the screen draws the order the server used (effectiveSort).
    sort: effectiveSort(query, true),
    dir: query.dir,
    page: query.page,
    per: perPageOf(query),
  }
}

/** True when the search or a choice narrows the list (an archived or "all" status counts: it changes which records are shown). */
export function isNarrowed(query: ListQuery): boolean {
  return query.q !== ''
    || productIdOf(query) !== undefined
    || query.filters.type !== 'all'
    || query.filters.sold !== 'all'
    || (query.filters.readiness ?? '') !== ''
    || query.filters.status !== 'active'
}

/** "Clear filters": no search, every Product, any type, any sold state, any readiness, the active records. The page size and the order stay. */
export function clearFiltersPatch(): ListQueryPatch {
  return { q: '', filters: { product: '', type: 'all', sold: 'all', readiness: '', status: 'active' } }
}

/** The choices of the Product filter: "All products", every Product, and a Product the address names that is not in the list (kept, so the box never shows a wrong value). */
export function productChoices(lines: ReadonlyArray<{ id: number; name: string }>, current: string): Choice[] {
  const choices: Choice[] = [{ value: '', label: 'All products' }, ...lines.map((l) => ({ value: String(l.id), label: l.name }))]
  if (current !== '' && !choices.some((c) => c.value === current)) choices.push({ value: current, label: `Product #${current}` })
  return choices
}

/** The choices of the Readiness filter: "Any readiness", the Portfolio's words, and a word the address names that is not among them. */
export function readinessChoices(words: readonly string[], current: string): Choice[] {
  const choices: Choice[] = [{ value: '', label: 'Any readiness' }, ...words.map((w) => ({ value: w, label: w }))]
  if (current !== '' && !words.includes(current)) choices.push({ value: current, label: current })
  return choices
}
