/**
 * The state of a list screen, kept in the URL so a refresh, the Back button and a pasted link all open the same view.
 *
 * Pure functions: no React and no Next, so they are tested on their own (lib/scaffolds/list-query.test.ts). use-list-query.ts wires them to the router.
 *
 * URL shape: ?q=text&sort=name&dir=desc&page=2&status=archived. A value equal to its default is left out, so the default view has a clean URL, and
 * parameters this module does not own (for example ?tab=) are left alone when it writes.
 */

export type SortDirection = 'asc' | 'desc'

export interface FilterSpec {
  default: string
  /** Any other value in the URL falls back to the default instead of reaching the screen. Omit to accept any value. */
  allowed?: readonly string[]
}

export interface ListQueryConfig {
  /** The column the list is sorted by when the URL names none. Omit for a list that has no sorting. */
  sort?: string
  /** The sort keys the URL may name; anything else falls back to the default. Omit to accept any. */
  sortKeys?: readonly string[]
  dir?: SortDirection
  filters?: Readonly<Record<string, FilterSpec>>
}

export interface ListQuery {
  q: string
  sort: string
  dir: SortDirection
  page: number
  filters: Record<string, string>
}

export type ListQueryPatch = Partial<Omit<ListQuery, 'filters'>> & { filters?: Record<string, string> }

const MAX_PAGE = 100000
const RESERVED = ['q', 'sort', 'dir', 'page']

type ParamReader = { get(name: string): string | null }

function assertFilterNames(config: ListQueryConfig) {
  for (const name of Object.keys(config.filters ?? {})) {
    if (RESERVED.includes(name)) throw new Error(`"${name}" is reserved by the list query and cannot be the name of a filter.`)
  }
}

/** A page number from a URL or a caller: a whole number from 1 up, anything else is page 1. */
export function cleanPage(raw: string | number | null | undefined): number {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : NaN
  return Number.isInteger(n) && n >= 1 && n <= MAX_PAGE ? n : 1
}

function cleanFilter(value: string | null | undefined, spec: FilterSpec): string {
  if (value === null || value === undefined) return spec.default
  if (spec.allowed && !spec.allowed.includes(value)) return spec.default
  return value
}

function cleanSort(value: string | null | undefined, config: ListQueryConfig): string {
  const fallback = config.sort ?? ''
  if (!value) return fallback
  return config.sortKeys && !config.sortKeys.includes(value) ? fallback : value
}

function cleanDir(value: string | null | undefined, config: ListQueryConfig): SortDirection {
  return value === 'asc' || value === 'desc' ? value : (config.dir ?? 'asc')
}

/** The list state a URL describes. Anything missing or not allowed becomes its default. */
export function readListQuery(params: ParamReader, config: ListQueryConfig = {}): ListQuery {
  assertFilterNames(config)
  const filters: Record<string, string> = {}
  for (const [name, spec] of Object.entries(config.filters ?? {})) filters[name] = cleanFilter(params.get(name), spec)

  return {
    q: (params.get('q') ?? '').trim(),
    sort: cleanSort(params.get('sort'), config),
    dir: cleanDir(params.get('dir'), config),
    page: cleanPage(params.get('page')),
    filters,
  }
}

/**
 * The state after a change. Changing the search, the sort or a filter goes back to page 1 (page 4 of the old result is meaningless for the new one),
 * unless the caller names a page. A filter the config does not define is ignored.
 */
export function patchListQuery(current: ListQuery, patch: ListQueryPatch, config: ListQueryConfig = {}): ListQuery {
  assertFilterNames(config)
  const next: ListQuery = { ...current, filters: { ...current.filters } }
  let narrowed = false

  if (patch.q !== undefined && patch.q.trim() !== current.q) {
    next.q = patch.q.trim()
    narrowed = true
  }
  if (patch.sort !== undefined && cleanSort(patch.sort, config) !== current.sort) {
    next.sort = cleanSort(patch.sort, config)
    narrowed = true
  }
  if (patch.dir !== undefined && cleanDir(patch.dir, config) !== current.dir) {
    next.dir = cleanDir(patch.dir, config)
    narrowed = true
  }
  for (const [name, value] of Object.entries(patch.filters ?? {})) {
    const spec = config.filters?.[name]
    if (!spec) continue
    const clean = cleanFilter(value, spec)
    if (clean !== current.filters[name]) {
      next.filters[name] = clean
      narrowed = true
    }
  }
  next.page = patch.page !== undefined ? cleanPage(patch.page) : narrowed ? 1 : current.page

  return next
}

/**
 * The URL parameters for a state: `base` with this module's parameters replaced by the non-default ones. Everything else in `base` is kept.
 */
export function writeListQuery(base: URLSearchParams, query: ListQuery, config: ListQueryConfig = {}): URLSearchParams {
  assertFilterNames(config)
  const out = new URLSearchParams(base)
  for (const name of [...RESERVED, ...Object.keys(config.filters ?? {})]) out.delete(name)

  if (query.q.trim() !== '') out.set('q', query.q.trim())
  if (query.sort !== '' && query.sort !== (config.sort ?? '')) out.set('sort', query.sort)
  if (query.dir !== (config.dir ?? 'asc')) out.set('dir', query.dir)
  if (query.page > 1) out.set('page', String(query.page))
  for (const [name, spec] of Object.entries(config.filters ?? {})) {
    const value = query.filters[name] ?? spec.default
    if (value !== spec.default) out.set(name, value)
  }

  return out
}

/** The query string (without the "?") for a state on its own. Empty for the default view. */
export function listQueryString(query: ListQuery, config: ListQueryConfig = {}): string {
  return writeListQuery(new URLSearchParams(), query, config).toString()
}
