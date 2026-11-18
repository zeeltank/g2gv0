import type { ListQuery, ListQueryConfig, ListQueryPatch } from '@/components/shared/scaffolds/list-query'
import type { PageTab } from '@/components/shared/scaffolds/page-tabs'
import type { OrgListParams } from '@/services/org-accounts/api-types'
import type { OrgAccountSummary, OrgLifecycle, OrgListMeta } from '@/services/org-accounts/types'
import { LIFECYCLE_LABELS } from './display'

/**
 * The scope switch of the Organizations list (`?scope=crm|discovered|duplicates`), the filters of the Discovered scope, how they live in the address and
 * how they become a request. Pure, so a link such as `?scope=discovered&lifecycle=target` is proved to read back the way it was written.
 */

/** The three scopes. The first is the default and keeps the plain address: today's list, unchanged. */
export const SCOPE_IDS = ['crm', 'discovered', 'duplicates'] as const
export type OrgScope = (typeof SCOPE_IDS)[number]
export const SCOPE_PARAM = 'scope'

export const PER_PAGE = 20

// ── The counts on the switch ────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface ScopeCounts {
  /** Organisations found in Signals or GTM that have no CRM organisation yet; null until the summary has been read. */
  discovered: number | null
  /** Possible duplicates waiting for a person; null until known. */
  duplicates: number | null
}

/**
 * The counts come from the /api/org-accounts summary: the discovered ones are every organisation without a CRM organisation, and the duplicates are
 * the live number when the review has loaded (it falls as pairs are decided), else the summary's own. Nothing is guessed before the summary is there.
 */
export function scopeCounts(summary: OrgAccountSummary | null | undefined, liveDuplicates?: number | null): ScopeCounts {
  if (!summary) return { discovered: null, duplicates: liveDuplicates ?? null }
  return { discovered: Math.max(0, summary.total - summary.with_crm), duplicates: liveDuplicates ?? summary.suggestions }
}

/** The tabs of the switch. The CRM scope carries no count: its own list already says how many organizations there are. */
export function scopeTabs(counts: ScopeCounts): PageTab[] {
  return [
    { id: 'crm', label: 'Organizations' },
    { id: 'discovered', label: 'Discovered', count: counts.discovered },
    { id: 'duplicates', label: 'Possible duplicates', count: counts.duplicates },
  ]
}

// ── The Discovered scope's filters ──────────────────────────────────────────────────────────────────────────────────────────────────

const LIFECYCLES: readonly OrgLifecycle[] = ['discovered', 'target', 'engaged', 'customer', 'archived']

export interface Choice {
  value: string
  label: string
}

export const LIFECYCLE_CHOICES: Choice[] = [
  { value: 'all', label: 'All' },
  ...LIFECYCLES.map((value) => ({ value, label: LIFECYCLE_LABELS[value] })),
]

/** Defined once, outside any component (useListQuery depends on it). */
export const DISCOVERED_QUERY: ListQueryConfig = {
  filters: { lifecycle: { default: 'all', allowed: LIFECYCLE_CHOICES.map((c) => c.value) } },
}

/**
 * The request for what the address describes. Every request of this scope asks for the organisations with NO CRM organisation (`has_crm: 0`); a facet left
 * on "All" sends nothing, so the server applies no filter for it.
 */
export function discoveredParams(query: ListQuery, perPage: number = PER_PAGE): OrgListParams {
  const params: OrgListParams = { has_crm: 0, page: query.page, per_page: perPage }
  if (query.q !== '') params.q = query.q
  const lifecycle = query.filters.lifecycle
  if (lifecycle && lifecycle !== 'all' && (LIFECYCLES as readonly string[]).includes(lifecycle)) params.lifecycle = lifecycle as OrgLifecycle
  return params
}

/** True when the search or the Lifecycle choice narrows the list. */
export function isNarrowed(query: ListQuery): boolean {
  return query.q !== '' || (query.filters.lifecycle ?? 'all') !== 'all'
}

export function clearFiltersPatch(): ListQueryPatch {
  return { q: '', filters: { lifecycle: 'all' } }
}

export type DiscoveredState = 'loading' | 'forbidden' | 'unavailable' | 'error' | 'empty' | 'filtered-empty' | 'ready'

/**
 * Which of the states the Discovered list is in. "empty" is only for an organisation with nothing left to discover (the server's own total is 0 and
 * nothing narrows the list); an empty answer to a search or a facet is "filtered-empty", with a way to clear it. A 403 and a 503 are their own states,
 * not errors: retrying cannot help.
 */
export function discoveredState(input: { loaded: boolean; forbidden: boolean; unavailable: boolean; error: string; rows: number; query: ListQuery }): DiscoveredState {
  if (input.forbidden) return 'forbidden'
  if (input.unavailable) return 'unavailable'
  if (input.error) return 'error'
  if (!input.loaded) return 'loading'
  if (input.rows > 0) return 'ready'
  return isNarrowed(input.query) ? 'filtered-empty' : 'empty'
}

/** "Showing 21–40 of 73", or null when there is nothing to count. */
export function rangeText(meta: OrgListMeta | null | undefined, rows: number): string | null {
  if (!meta || meta.total <= 0 || rows <= 0) return null
  const from = (meta.page - 1) * meta.per_page + 1
  return `Showing ${from}–${from + rows - 1} of ${meta.total}`
}
