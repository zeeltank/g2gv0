import type { ListQuery } from '@/components/shared/scaffolds/list-query'
import type { PmOption } from '@/services/product-master/types'
import type { ProductFilterOption, SignalRow, SignalSummary } from '@/services/signal-review/signal-types'
import type { ReviewStatus } from '@/services/signal-review/types'
import { scoreText, statusChip } from './signal-display'

/**
 * What the signal list is made of, apart from its address: the status and freshness choices, the five states a list can be in, the product, fit and score
 * words, and the counts above the list. Pure. The address and the request of Company Opportunities are in opportunity-query.ts. (This file also held the Signal
 * Review's own address, request, sort choices and range text until 13 Nov 2026, when that screen was removed.)
 */

export interface Choice {
  value: string
  label: string
}

/** URL word -> stored `review_status`. The URL says "contacted"; the server stores `Follow-up`. */
const STATUS_BY_URL: Record<string, ReviewStatus | null> = { all: null, new: 'New', contacted: 'Follow-up', reviewed: 'Reviewed', dismissed: 'Dismissed' }

/** The stored `review_status` for a status word of the address ("contacted" is stored as "Follow-up"); null for "all" and for any word that is not one. */
export function reviewStatusOf(word: string | null | undefined): ReviewStatus | null {
  return typeof word === 'string' && Object.prototype.hasOwnProperty.call(STATUS_BY_URL, word) ? STATUS_BY_URL[word] : null
}

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

/** True when the search or a facet other than Status narrows the list. Status is left out: it has a default of its own. */
export function isNarrowed(query: ListQuery): boolean {
  return query.q !== '' || ['product', 'freshness', 'fit'].some((name) => (query.filters[name] ?? 'all') !== 'all')
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
