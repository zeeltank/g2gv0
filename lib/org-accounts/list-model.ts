import type { ListQuery, ListQueryConfig, ListQueryPatch } from '@/components/shared/scaffolds/list-query'
import type { OrgListParams } from '@/services/org-accounts/api-types'
import type { OrgAccountSummary, OrgLifecycle, OrgListMeta } from '@/services/org-accounts/types'
import { LIFECYCLE_LABELS } from './display'

/**
 * The Organisation 360 list's filters, how they live in the address, and how they become a request. Pure, so a link such as
 * `?lifecycle=target&crm=no` is proved to read back the way it was written.
 */

export const PER_PAGE = 20

export interface Choice {
  value: string
  label: string
}

/** The two tabs of the list; the first is the default and keeps the plain address. */
export const LIST_TAB_IDS = ['organisations', 'duplicates'] as const

const LIFECYCLES: readonly OrgLifecycle[] = ['discovered', 'target', 'engaged', 'customer', 'archived']

export const LIFECYCLE_CHOICES: Choice[] = [
  { value: 'all', label: 'All' },
  ...LIFECYCLES.map((value) => ({ value, label: LIFECYCLE_LABELS[value] })),
]

export const PRESENCE_CHOICES: Choice[] = [
  { value: 'any', label: 'Any' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
]

/** Defined once, outside any component (useListQuery depends on it). */
export const ORG_LIST_QUERY: ListQueryConfig = {
  filters: {
    lifecycle: { default: 'all', allowed: LIFECYCLE_CHOICES.map((c) => c.value) },
    crm: { default: 'any', allowed: PRESENCE_CHOICES.map((c) => c.value) },
    gtm: { default: 'any', allowed: PRESENCE_CHOICES.map((c) => c.value) },
    signals: { default: 'any', allowed: PRESENCE_CHOICES.map((c) => c.value) },
  },
}

const PRESENCE_FILTERS = ['crm', 'gtm', 'signals'] as const

const presence = (value: string | undefined): 0 | 1 | undefined => (value === 'yes' ? 1 : value === 'no' ? 0 : undefined)

/** The request for what the address describes. A facet left on "All" or "Any" sends nothing, so the server applies no filter for it. */
export function queryToParams(query: ListQuery, perPage: number = PER_PAGE): OrgListParams {
  const params: OrgListParams = { page: query.page, per_page: perPage }
  if (query.q !== '') params.q = query.q

  const lifecycle = query.filters.lifecycle
  if (lifecycle && lifecycle !== 'all' && (LIFECYCLES as readonly string[]).includes(lifecycle)) params.lifecycle = lifecycle as OrgLifecycle

  const crm = presence(query.filters.crm)
  if (crm !== undefined) params.has_crm = crm
  const gtm = presence(query.filters.gtm)
  if (gtm !== undefined) params.has_gtm = gtm
  const signals = presence(query.filters.signals)
  if (signals !== undefined) params.has_signals = signals

  return params
}

/** True when the search or any facet narrows the list. */
export function isNarrowed(query: ListQuery): boolean {
  return query.q !== ''
    || (query.filters.lifecycle ?? 'all') !== 'all'
    || PRESENCE_FILTERS.some((name) => (query.filters[name] ?? 'any') !== 'any')
}

export function clearFiltersPatch(): ListQueryPatch {
  return { q: '', filters: { lifecycle: 'all', crm: 'any', gtm: 'any', signals: 'any' } }
}

export type ListScreenState = 'loading' | 'forbidden' | 'error' | 'empty' | 'filtered-empty' | 'ready'

/**
 * Which of the six states the list is in. "empty" is only for an organisation with nothing in Organisation 360 at all (the server's own total is 0
 * and nothing narrows the list: the backfill has not run); an empty answer to a search or a facet is "filtered-empty", with a way to clear it.
 * A 403 is its own state, not an error: retrying cannot help.
 */
export function listScreenState(input: { loaded: boolean; forbidden: boolean; error: string; rows: number; summaryTotal: number; query: ListQuery }): ListScreenState {
  if (input.forbidden) return 'forbidden'
  if (input.error) return 'error'
  if (!input.loaded) return 'loading'
  if (input.rows > 0) return 'ready'
  return input.summaryTotal === 0 && !isNarrowed(input.query) ? 'empty' : 'filtered-empty'
}

export interface Tile {
  label: string
  value: number
}

/** The counts above the list. `suggestions` is the live number of possible duplicates (it falls as pairs are decided), else the summary's own. */
export function summaryTiles(summary: OrgAccountSummary, suggestions?: number | null): Tile[] {
  return [
    { label: 'organisations', value: summary.total },
    { label: 'discovered', value: summary.discovered },
    { label: 'target', value: summary.target },
    { label: 'engaged', value: summary.engaged },
    { label: 'customers', value: summary.customer },
    { label: 'possible duplicates', value: suggestions ?? summary.suggestions },
  ]
}

/** "Showing 21–40 of 73", or null when there is nothing to count. */
export function rangeText(meta: OrgListMeta | null | undefined, rows: number): string | null {
  if (!meta || meta.total <= 0 || rows <= 0) return null
  const from = (meta.page - 1) * meta.per_page + 1
  return `Showing ${from}–${from + rows - 1} of ${meta.total}`
}
