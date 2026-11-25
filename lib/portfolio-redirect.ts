/**
 * Where the old Products and Services addresses land (owner decision of 13 Nov 2026; hp_erp docs/agentic-crm/slices/S15-product-portfolio-merge.md, track P3-A).
 *
 * The Products and Services screens were merged into the Product Portfolio, so each of their addresses is a redirect page that sends a visitor to the new place with
 * the SAME query string. They stay for ever: an Ask answer, an agent run, a saved quote link and any bookmark carry the old address. The pages are the `page.tsx` files
 * under app/module/crm/sales/products and app/module/crm/sales/services (their folders ARE the old addresses). Pattern: lib/signal-review-redirect.ts.
 *
 *   /module/crm/sales/products                 -> /signals/portfolio                 (the list, a tab of Market Signals)
 *   /module/crm/sales/services                 -> /signals/portfolio?type=service    (the list, on Services)
 *   /module/crm/sales/products/{crmId}         -> /portfolio/products/{masterId}     (through GET /api/product-master/by-crm/{crmId})
 *   /module/crm/sales/services/{crmId}         -> /portfolio/products/{masterId}     (the same)
 *   /module/crm/sales/products/lines/{masterId} -> the Sub-product page, or the Product page for a Product (by `kind`)
 *   /module/crm/sales/price-books (and /{id})  -> /signals/portfolio                 (S16, 25 Nov 2026: Price Books were removed, a Sub-product holds its own price)
 *
 * The query is not translated: it is written back as it came (`encodeURIComponent` per key and value, a repeated key kept, a key sent with no value kept).
 */

/** What Next hands a page as `searchParams` once awaited: a key seen once is a string, a key repeated is a list. */
export type RawSearchParams = Record<string, string | string[] | undefined>

/** The Product Portfolio's own pages: a Product (`/portfolio/{key}`) and a Sub-product (`/portfolio/products/{id}`). */
export const PORTFOLIO_ADDRESS = '/portfolio'

/** The LIST: the Product Portfolio tab of Market Signals (owner, 24 Nov 2026: the sidebar has no Product Portfolio entry, the list lives in Market Signals). */
export const PORTFOLIO_LIST_ADDRESS = '/signals/portfolio'

/** The pairs of a query, written as the links we make write them: a space is `%20` (never `+`), the order is the order it arrived in. */
function pairsOf(params: RawSearchParams, skip?: string): string[] {
  const pairs: string[] = []
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || key === skip) continue
    for (const one of Array.isArray(value) ? value : [value]) pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(one)}`)
  }
  return pairs
}

const withQuery = (path: string, pairs: string[]): string => (pairs.length === 0 ? path : `${path}?${pairs.join('&')}`)

/** `/signals/portfolio` (the list) plus the same query. The path is fixed, so nothing in the query can send a person anywhere else. */
export function portfolioRedirectTarget(params: RawSearchParams): string {
  return withQuery(PORTFOLIO_LIST_ADDRESS, pairsOf(params))
}

/**
 * Where the removed Price Books addresses (the list and a book's page) land: the list, with NO query. A price book's `search`, `page` or `sort` means nothing in the portfolio
 * (a `search` could even be read as a filter it never meant), so nothing is carried. The path is fixed.
 */
export function priceBooksRedirectTarget(): string {
  return PORTFOLIO_LIST_ADDRESS
}

/** `/signals/portfolio?type=service` plus the rest of the query. A `type` the old address carried is replaced: the Services address IS the Service view. */
export function servicesRedirectTarget(params: RawSearchParams): string {
  return withQuery(PORTFOLIO_LIST_ADDRESS, [...pairsOf(params, 'type'), 'type=service'])
}

/** The Sub-product page of a master record, with the query kept. A number only: anything else is not an id. */
export function subProductTarget(masterId: number, params: RawSearchParams): string {
  return withQuery(`${PORTFOLIO_ADDRESS}/products/${masterId}`, pairsOf(params))
}

/** The Product page of a Product key, with the query kept. */
export function productTarget(key: string, params: RawSearchParams): string {
  return withQuery(`${PORTFOLIO_ADDRESS}/${encodeURIComponent(key)}`, pairsOf(params))
}

/** The page of a master record by what it is: a Product opens `/portfolio/{key}`, anything else `/portfolio/products/{id}`. */
export function recordTarget(record: { id: number; kind: string; key: string }, params: RawSearchParams): string {
  return record.kind === 'product' ? productTarget(record.key, params) : subProductTarget(record.id, params)
}

/** An id of an old address: a whole number from 1 up. Anything else (a typo, a path trick, a number too long to be real) is not looked up at all. */
export function parseOldId(raw: string | undefined): number | null {
  return typeof raw === 'string' && /^[1-9]\d{0,14}$/.test(raw) ? Number(raw) : null
}
