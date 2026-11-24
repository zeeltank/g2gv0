import type { ExtensionQueueParams, ExtensionQueueSort, ExtensionStatus } from '@/types/task-management'

/**
 * The saved views, as tabs. `overdue` has no server view of its own: it is the
 * "all" view with the overdue-at-request filter on, so it travels as a preset.
 */
export type ExtensionTab = 'awaiting_me' | 'mine' | 'all' | 'overdue' | 'decided'

export const EXTENSION_TABS: readonly ExtensionTab[] = ['awaiting_me', 'mine', 'all', 'overdue', 'decided']
export const EXTENSION_STATUSES: readonly ExtensionStatus[] = ['pending', 'approved', 'rejected', 'withdrawn']
export const EXTENSION_SORTS: readonly ExtensionQueueSort[] = ['default', 'newest', 'oldest', 'days_desc', 'due_asc']
export const PAGE_SIZES = [25, 50, 100] as const
export const DEFAULT_PER_PAGE = 25

export interface ExtensionFilters {
  tab: ExtensionTab
  status: ExtensionStatus[]
  q: string
  priority: string
  departmentId: string
  requesterId: string
  decidedBy: string
  requestedFrom: string
  requestedTo: string
  minDays: string
  maxDays: string
  repeat: boolean
  overdueAtRequest: boolean
  sort: ExtensionQueueSort
  page: number
  perPage: number
}

/** What a tab means before anyone edits a filter: the yardstick for "Custom" and for the applied-filter count. */
export function presetFor(tab: ExtensionTab): ExtensionFilters {
  return {
    tab, status: [], q: '', priority: '', departmentId: '', requesterId: '', decidedBy: '',
    requestedFrom: '', requestedTo: '', minDays: '', maxDays: '',
    repeat: false, overdueAtRequest: tab === 'overdue',
    sort: 'default', page: 1, perPage: DEFAULT_PER_PAGE,
  }
}

/* Every key this screen owns is prefixed so it can never collide with the dashboard's own `tab` / `layout`. */
const KEY = {
  tab: 'x_view', status: 'x_status', q: 'x_q', priority: 'x_priority', departmentId: 'x_dept',
  requesterId: 'x_requester', decidedBy: 'x_decider', requestedFrom: 'x_from', requestedTo: 'x_to',
  minDays: 'x_min', maxDays: 'x_max', repeat: 'x_repeat', overdueAtRequest: 'x_overdue',
  sort: 'x_sort', page: 'x_page', perPage: 'x_per',
} as const

const digits = (value: string | null) => (value && /^\d{1,4}$/.test(value) ? value : '')
const day = (value: string | null) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '')

/**
 * Reads the screen's filters out of a query string. Anything unrecognised falls
 * back to the default rather than throwing: a stale or hand-edited link must
 * open a working screen. `hadTab` says whether the link named a view, because
 * only a link that did not gets the "Awaiting me if there is anything" default.
 */
export function readFilters(search: string): { filters: ExtensionFilters; hadTab: boolean } {
  const params = new URLSearchParams(search)
  const rawTab = params.get(KEY.tab)
  const tab = EXTENSION_TABS.find((candidate) => candidate === rawTab)
  const base = presetFor(tab ?? 'all')

  const status = (params.get(KEY.status) ?? '').split(',').filter((item): item is ExtensionStatus => EXTENSION_STATUSES.includes(item as ExtensionStatus))
  const sort = EXTENSION_SORTS.find((candidate) => candidate === params.get(KEY.sort))
  const perPage = Number(params.get(KEY.perPage))
  const page = Number(params.get(KEY.page))

  return {
    hadTab: tab !== undefined,
    filters: {
      ...base,
      status: Array.from(new Set(status)),
      q: params.get(KEY.q) ?? '',
      priority: params.get(KEY.priority) ?? '',
      departmentId: digits(params.get(KEY.departmentId)),
      requesterId: digits(params.get(KEY.requesterId)),
      decidedBy: digits(params.get(KEY.decidedBy)),
      requestedFrom: day(params.get(KEY.requestedFrom)),
      requestedTo: day(params.get(KEY.requestedTo)),
      minDays: digits(params.get(KEY.minDays)),
      maxDays: digits(params.get(KEY.maxDays)),
      // The overdue tab's preset is the filter; a link that carries the tab but not the flag means the person switched it off.
      repeat: params.get(KEY.repeat) === '1',
      overdueAtRequest: params.has(KEY.overdueAtRequest) ? params.get(KEY.overdueAtRequest) === '1' : base.overdueAtRequest,
      sort: sort ?? 'default',
      page: Number.isInteger(page) && page > 1 ? page : 1,
      perPage: (PAGE_SIZES as readonly number[]).includes(perPage) ? perPage : DEFAULT_PER_PAGE,
    },
  }
}

/** `currentSearch` with this screen's keys replaced by `filters`'; every other key (the dashboard's own) is left exactly as it was. */
export function writeFilters(filters: ExtensionFilters, currentSearch: string): string {
  const params = new URLSearchParams(currentSearch)
  for (const key of Object.values(KEY)) params.delete(key)

  const preset = presetFor(filters.tab)
  params.set(KEY.tab, filters.tab)
  if (filters.status.length) params.set(KEY.status, filters.status.join(','))
  if (filters.q) params.set(KEY.q, filters.q)
  if (filters.priority) params.set(KEY.priority, filters.priority)
  if (filters.departmentId) params.set(KEY.departmentId, filters.departmentId)
  if (filters.requesterId) params.set(KEY.requesterId, filters.requesterId)
  if (filters.decidedBy) params.set(KEY.decidedBy, filters.decidedBy)
  if (filters.requestedFrom) params.set(KEY.requestedFrom, filters.requestedFrom)
  if (filters.requestedTo) params.set(KEY.requestedTo, filters.requestedTo)
  if (filters.minDays) params.set(KEY.minDays, filters.minDays)
  if (filters.maxDays) params.set(KEY.maxDays, filters.maxDays)
  if (filters.repeat) params.set(KEY.repeat, '1')
  // Written whenever it differs from the tab's own preset, in either direction, so "overdue tab, flag switched off" survives a reload.
  if (filters.overdueAtRequest !== preset.overdueAtRequest) params.set(KEY.overdueAtRequest, filters.overdueAtRequest ? '1' : '0')
  if (filters.sort !== 'default') params.set(KEY.sort, filters.sort)
  if (filters.page > 1) params.set(KEY.page, String(filters.page))
  if (filters.perPage !== DEFAULT_PER_PAGE) params.set(KEY.perPage, String(filters.perPage))
  return params.toString()
}

/** The queue endpoint's params. `overdue` is the "all" view; every empty filter is left out so an unfiltered call is a plain one. */
export function toQueueParams(filters: ExtensionFilters): ExtensionQueueParams {
  return {
    view: filters.tab === 'overdue' ? 'all' : filters.tab,
    status: filters.status.length ? filters.status.join(',') : undefined,
    q: filters.q.trim() || undefined,
    priority: filters.priority || undefined,
    departmentId: filters.departmentId || undefined,
    requesterId: filters.requesterId || undefined,
    decidedBy: filters.decidedBy || undefined,
    requestedFrom: filters.requestedFrom || undefined,
    requestedTo: filters.requestedTo || undefined,
    minDays: filters.minDays || undefined,
    maxDays: filters.maxDays || undefined,
    repeat: filters.repeat || undefined,
    overdueAtRequest: filters.overdueAtRequest || undefined,
    sort: filters.sort === 'default' ? undefined : filters.sort,
    page: filters.page,
    perPage: filters.perPage,
  }
}

/** Fields that count as "a filter" for the badge and the Custom hint (sort, page and page size are not). */
const FILTER_FIELDS = [
  'status', 'q', 'priority', 'departmentId', 'requesterId', 'decidedBy', 'requestedFrom', 'requestedTo',
  'minDays', 'maxDays', 'repeat', 'overdueAtRequest',
] as const

/**
 * How many filters differ from what the current tab already implies. The
 * date range and the days range each count once, however many ends are set,
 * because a person sees one control for each.
 */
export function countCustomFilters(filters: ExtensionFilters): number {
  const preset = presetFor(filters.tab)
  let count = 0
  for (const field of FILTER_FIELDS) {
    const now = filters[field]
    const base = preset[field]
    const same = Array.isArray(now) ? now.length === 0 : now === base
    if (!same) count += 1
  }
  if (filters.requestedFrom && filters.requestedTo) count -= 1
  if (filters.minDays && filters.maxDays) count -= 1
  return count
}

/** Back to what the current tab means, keeping the tab, the sort and the page size. */
export function clearedFilters(filters: ExtensionFilters): ExtensionFilters {
  return { ...presetFor(filters.tab), sort: filters.sort, perPage: filters.perPage }
}

export const TAB_LABELS: Record<ExtensionTab, string> = {
  awaiting_me: 'Awaiting me', mine: 'My requests', all: 'All', overdue: 'Overdue at request', decided: 'Decided',
}

export const STATUS_LABELS: Record<ExtensionStatus, string> = {
  pending: 'Pending', approved: 'Approved', rejected: 'Rejected', withdrawn: 'Withdrawn',
}

export const SORT_LABELS: Record<ExtensionQueueSort, string> = {
  default: 'Pending first, longest waiting', newest: 'Newest', oldest: 'Oldest', days_desc: 'Longest extension', due_asc: 'Requested date',
}

/**
 * The active filters in words, for an empty state that says WHY it is empty:
 * "status Pending, department Finance". Names come from the option lists the
 * screen already holds; an id with no known name is shown as itself.
 */
export function describeFilters(filters: ExtensionFilters, names: { department: (id: string) => string; requester: (id: string) => string; decider: (id: string) => string }): string[] {
  const parts: string[] = []
  if (filters.status.length) parts.push(`status ${filters.status.map((status) => STATUS_LABELS[status]).join(' or ')}`)
  if (filters.q.trim()) parts.push(`search "${filters.q.trim()}"`)
  if (filters.priority) parts.push(`priority ${filters.priority}`)
  if (filters.departmentId) parts.push(`department ${names.department(filters.departmentId)}`)
  if (filters.requesterId) parts.push(`requester ${names.requester(filters.requesterId)}`)
  if (filters.decidedBy) parts.push(`decided by ${names.decider(filters.decidedBy)}`)
  if (filters.requestedFrom || filters.requestedTo) parts.push(`requested ${filters.requestedFrom || '...'} to ${filters.requestedTo || '...'}`)
  if (filters.minDays || filters.maxDays) parts.push(`extension ${filters.minDays || '0'} to ${filters.maxDays || 'any'} days`)
  if (filters.repeat) parts.push('repeat extenders only')
  if (filters.overdueAtRequest) parts.push('overdue at request')
  return parts
}
