/**
 * Where the old Signal Review addresses land (owner decision of 13 Nov 2026; hp_erp docs/agentic-crm/slices/S15-product-portfolio-merge.md, track P1-B).
 *
 * The Signal Review screen was merged into Company Opportunities, so both of its addresses (the menu row's own and the one under the CRM root) are redirect pages
 * that send a visitor to `/signals` with the SAME query string. The pages are the two `page.tsx` files under app/ whose folders are the old addresses. They stay for
 * ever: an Ask answer or an agent run saved before the merge keeps the old address inside its stored text, and so does any bookmark.
 *
 * The query is not translated. Company Opportunities reads the names the old screen used: `q`, `status`, `product`, `freshness`, `fit`, `sort` and `page`.
 */

/** What Next hands a page as `searchParams` once awaited: a key seen once is a string, a key repeated is a list. */
export type RawSearchParams = Record<string, string | string[] | undefined>

/** Company Opportunities, the first tab of Market Signals. */
export const SIGNALS_ADDRESS = '/signals'

/**
 * `/signals` plus the same query. Every key and value is written with `encodeURIComponent`, so a space is `%20` as in the links we make (never `+`), a repeated
 * key stays repeated in the order it arrived in, and a key sent with no value stays a key with an empty value. The path is fixed, so nothing in the query can
 * send a person anywhere else.
 */
export function signalsRedirectTarget(params: RawSearchParams): string {
  const pairs: string[] = []
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    for (const one of Array.isArray(value) ? value : [value]) pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(one)}`)
  }
  return pairs.length === 0 ? SIGNALS_ADDRESS : `${SIGNALS_ADDRESS}?${pairs.join('&')}`
}
