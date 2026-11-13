import type { ListQuery, ListQueryConfig, ListQueryPatch } from '@/components/shared/scaffolds/list-query'
import type { PmOption } from '@/services/product-master/types'
import type { ProductFilterOption, SignalListMeta, SignalListParams, SignalRow, SignalSummary } from '@/services/signal-review/signal-types'
import type { ReviewStatus } from '@/services/signal-review/types'
import { scoreText, statusChip } from './signal-display'

/**
 * The Signal Review list's filters, how they live in the address, and how they become a request. Pure, so a link such as
 * `?product=4&freshness=last_30_days` is proved to read back the way it was written, and so the rule that undated signals stay visible is tested.
 */

export const PER_PAGE = 20

export interface Choice {
  value: string
  label: string
}

/** URL word -> stored `review_status`. The URL says "contacted"; the server stores `Follow-up`. */
const STATUS_BY_URL: Record<string, ReviewStatus | null> = { all: null, new: 'New', contacted: 'Follow-up', reviewed: 'Reviewed', dismissed: 'Dismissed' }

export const STATUS_CHOICES: Choice[] = [
  { value: 'all', label: 'All' },
  ...(['new', 'contacted', 'reviewed', 'dismissed'] as const).map((value) => ({ value, label: statusChip(STATUS_BY_URL[value] as ReviewStatus).label })),
]

export const FRESHNESS_CHOICES: Choice[] = [
  { value: 'all', label: 'All' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'last_90_days', label: 'Last 90 days' },
  { value: 'older', label: 'Older' },
  { value: 'undated', label: 'Date unknown' },
]

export const SORT_CHOICES: Choice[] = [
  { value: 'recent', label: 'Newest evidence' },
  { value: 'priority', label: 'Priority' },
]

/**
 * Defined once, outside any component (useListQuery depends on it). The screen opens on signals that still need a decision, newest evidence first, and
 * the freshness filter is "All": a signal with no date is shown (with a "Date unknown" badge), never hidden by default. `product` and `fit` accept any
 * value because their choices come from the server.
 */
export const SIGNAL_LIST_QUERY: ListQueryConfig = {
  sort: 'recent',
  sortKeys: SORT_CHOICES.map((c) => c.value),
  dir: 'desc',
  filters: {
    product: { default: 'all' },
    status: { default: 'new', allowed: STATUS_CHOICES.map((c) => c.value) },
    freshness: { default: 'all', allowed: FRESHNESS_CHOICES.map((c) => c.value) },
    fit: { default: 'all' },
  },
}

/** The request for what the address describes. A facet left on "All" sends nothing, so the server applies no filter for it. */
export function queryToParams(query: ListQuery, perPage: number = PER_PAGE): SignalListParams {
  const params: SignalListParams = { page: query.page, per_page: perPage, sort: query.sort === 'priority' ? 'priority' : 'recent' }

  if (query.q !== '') params.search = query.q

  const product = query.filters.product
  if (/^\d+$/.test(product ?? '') && Number(product) > 0) params.product_master_id = Number(product)

  const status = STATUS_BY_URL[query.filters.status ?? 'all']
  if (status) params.review_status = status

  const freshness = query.filters.freshness
  if (freshness && freshness !== 'all') params.freshness = freshness as SignalListParams['freshness']

  const fit = query.filters.fit
  if (fit && fit !== 'all') params.business_fit = fit

  return params
}

/** True when the search or a facet other than Status narrows the list. Status is left out: it has a default of its own. */
export function isNarrowed(query: ListQuery): boolean {
  return query.q !== '' || ['product', 'freshness', 'fit'].some((name) => (query.filters[name] ?? 'all') !== 'all')
}

/** "Clear filters" shows everything: Status goes to All too, because on a screen that opens on "Needs decision" the default would empty the list again. */
export function clearFiltersPatch(): ListQueryPatch {
  return { q: '', filters: { product: 'all', status: 'all', freshness: 'all', fit: 'all' } }
}

export type ListScreenState = 'loading' | 'error' | 'empty' | 'filtered-empty' | 'ready'

/**
 * Which of the five states the list is in. "empty" is only for an organisation with no signals at all (the server's own total is 0 and nothing narrows
 * the list); an empty answer to a search or a facet is "filtered-empty", with a way to clear it.
 */
export function listScreenState(input: { loaded: boolean; error: string; rows: number; summaryTotal: number; query: ListQuery }): ListScreenState {
  if (input.error) return 'error'
  if (!input.loaded) return 'loading'
  if (input.rows > 0) return 'ready'
  return input.summaryTotal === 0 && !isNarrowed(input.query) ? 'empty' : 'filtered-empty'
}

// ── Facet choices ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** "All products" and every Product Master record. A product in the address that is not in the list is kept so the box never shows a wrong value. */
export function productChoices(options: readonly PmOption[], current: string): Choice[] {
  const choices: Choice[] = [{ value: 'all', label: 'All products' }, ...options.map((o) => ({ value: String(o.id), label: o.label }))]
  if (current !== 'all' && !choices.some((c) => c.value === current)) choices.push({ value: current, label: `Product #${current}` })
  return choices
}

/** A `business_fit` code as a person reads it: the product's own name when the server named it, else a plain word. */
export function fitLabel(code: string, products: readonly ProductFilterOption[] = []): string {
  if (code === 'multiple') return 'Several products'
  const product = products.find((p) => p.business_fit === code)
  return product?.label ?? (code.length <= 3 ? code.toUpperCase() : code.charAt(0).toUpperCase() + code.slice(1))
}

/** The fit with the product, in the product's own name, and the score when the signal was scored. Null when neither is recorded. */
export function fitSummary(signal: Pick<SignalRow, 'business_fit' | 'scores'>, products?: readonly ProductFilterOption[]): string | null {
  const parts = [signal.business_fit ? fitLabel(signal.business_fit, products) : null, scoreText(signal)].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : null
}

/** "Any fit" and the codes the server accepts. The current value is kept even if the server has not listed it yet. */
export function fitChoices(codes: readonly string[] | undefined, products: readonly ProductFilterOption[] | undefined, current: string): Choice[] {
  const known = [...(codes ?? [])]
  if (current !== 'all' && !known.includes(current)) known.push(current)
  return [{ value: 'all', label: 'Any fit' }, ...known.map((code) => ({ value: code, label: fitLabel(code, products) }))]
}

// ── Summary ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Tile {
  label: string
  value: number
}

/** The counts above the list, from what the endpoint returned. "Decided so far" is everything that is no longer waiting for a decision. */
export function summaryTiles(summary: SignalSummary): Tile[] {
  return [
    { label: 'signals in total', value: summary.total },
    { label: 'need a decision', value: summary.new },
    { label: 'decided so far', value: Math.max(summary.total - summary.new, 0) },
    { label: 'high priority', value: summary.high_priority },
  ]
}

/**
 * The counts after one signal moved from one status to another, so the tiles agree with the row without asking the server again. `high_priority`
 * leaves out dismissed signals, so it moves only when a High signal crosses into or out of Dismissed.
 */
export function applyStatusChange(summary: SignalSummary, signal: Pick<SignalRow, 'priority'>, from: ReviewStatus, to: ReviewStatus): SignalSummary {
  if (from === to) return summary
  const next = { ...summary }
  const step = (key: 'new' | 'follow_up', status: ReviewStatus) => {
    next[key] = Math.max(0, next[key] + (to === status ? 1 : 0) - (from === status ? 1 : 0))
  }
  step('new', 'New')
  step('follow_up', 'Follow-up')
  if (signal.priority === 'High') {
    next.high_priority = Math.max(0, next.high_priority + (from === 'Dismissed' ? 1 : 0) - (to === 'Dismissed' ? 1 : 0))
  }
  return next
}

/** "Showing 21–40 of 73", or null when there is nothing to count. */
export function rangeText(meta: SignalListMeta | null | undefined, rows: number): string | null {
  if (!meta || meta.total <= 0 || rows <= 0) return null
  const from = (meta.page - 1) * meta.per_page + 1
  return `Showing ${from}–${from + rows - 1} of ${meta.total}`
}
