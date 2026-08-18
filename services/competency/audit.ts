/**
 * Audit & Activity Center service.
 *
 * Backed by the Laravel competency audit API, which reads the shared
 * s_competency_activity_log feed every competency controller writes to:
 *   GET /competency/audit                      - the main table (tab + filters + pagination)
 *   GET /competency/audit/metrics              - the five KPI cards
 *   GET /competency/audit/filters              - record type / module / user / range options
 *   GET /competency/audit/export               - every filtered row, uncapped (logs itself)
 *   GET /competency/audit/{id}                 - detail panel (overview + change summary + related)
 *   GET /competency/audit/user-actions         - User Actions Log tab: per-user rollup
 *   GET /competency/audit/user-actions/{userId}- that user's changes + screen-access history
 *
 * Every call carries the standard Laravel context (token, sub_institute_id,
 * user_id, syear, type=API) via withLaravelParams, exactly like
 * services/competency/certifications.ts.
 *
 * NOTE the user being filtered on travels as `user_id_filter`: plain `user_id`
 * is the calling actor on every /competency/* route.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

const BASE = '/competency/audit'

export interface AuditApiResponse<T> {
  status: number
  message: string
  data: T
}

export interface AuditPagination {
  page: number
  per_page: number
  total: number
  last_page: number
}

export interface AuditListResponse<T> extends AuditApiResponse<T> {
  pagination: AuditPagination
}

/** The six tabs across the top of the screen. */
export type AuditTab = 'timeline' | 'approvals' | 'comments' | 'history' | 'io' | 'actions'

/** Derived action grouping - drives the KPI cards, the row icon and the tabs. */
export type AuditActionClass =
  | 'create'
  | 'update'
  | 'delete'
  | 'approval'
  | 'comment'
  | 'io'
  | 'assignment'
  | 'mapping'
  | 'other'

/** One field-level before/after pair, rendered in the Change Summary card. */
export interface AuditChange {
  field: string
  label: string
  old: string | null
  new: string | null
}

/** One row of the activity table. */
export interface AuditEntry {
  id: number
  at: string | null
  date: string | null
  relative: string | null
  user_id: number | null
  user: string
  initials: string
  action: string
  action_class: AuditActionClass
  action_raw: string | null
  record_type: string
  record_type_key: string | null
  record_name: string | null
  record_id: number | null
  module: string
  module_key: string
  /** Where the "Open {record type}" link goes; null when the record has no screen. */
  submenu_id: string | null
  description: string | null
  changes: AuditChange[]
  changes_count: number
  has_changes: boolean
}

/** show() adds the other entries recorded against the same record. */
export interface AuditEntryDetail extends AuditEntry {
  related: AuditEntry[]
}

export interface AuditMetrics {
  total: number
  approvals: number
  updates: number
  comments: number
  imports_exports: number
  version_entries: number
  /** "All time", or the active date range - the KPI cards' sub-label. */
  range_label: string
}

export interface AuditFilterOption {
  value: string
  label: string
  count?: number
}

export interface AuditFilterOptions {
  record_types: AuditFilterOption[]
  modules: AuditFilterOption[]
  users: AuditFilterOption[]
  date_ranges: AuditFilterOption[]
  action_classes: AuditFilterOption[]
}

/** One row of the User Actions Log tab. */
export interface AuditUserSummary {
  user_id: number | null
  user: string
  initials: string
  total: number
  created: number
  updated: number
  deleted: number
  approved: number
  commented: number
  other: number
  last_at: string | null
  last_active: string | null
}

/** A screen-access event from tbl_user_journey_logs. */
export interface AuditAccessEntry {
  id: number
  screen: string
  event: string
  event_type: string | null
  link: string | null
  step_key: string | null
  at: string | null
  date: string | null
}

export interface AuditUserActivity {
  user: { id: number; name: string; initials: string }
  changes: AuditEntry[]
  access_log: AuditAccessEntry[]
}

export interface AuditListParams {
  tab?: AuditTab
  search?: string
  /** Preset key from filter options (`7d`, `30d`, `month`, ...). */
  range?: string
  from?: string
  to?: string
  record_type?: string
  module?: string
  user_id_filter?: string
  action_class?: string
  sort?: 'date' | 'user' | 'action' | 'record' | 'type'
  direction?: 'asc' | 'desc'
  page?: number
  per_page?: number
}

/** Drop empty values so a cleared filter is absent rather than sent as "". */
function toStringParams(params: Record<string, string | number | undefined | null>) {
  return Object.entries(params).reduce<Record<string, string>>((acc, [key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      acc[key] = String(value)
    }
    return acc
  }, {})
}

export const competencyAuditService = {
  list: (context: LaravelContext, params: AuditListParams = {}) =>
    apiClient.get<AuditListResponse<AuditEntry[]>>(
      BASE,
      withLaravelParams(context, toStringParams({ ...params })),
    ),

  metrics: (context: LaravelContext, params: AuditListParams = {}) =>
    apiClient.get<AuditApiResponse<AuditMetrics>>(
      `${BASE}/metrics`,
      withLaravelParams(context, toStringParams({ ...params })),
    ),

  filterOptions: (context: LaravelContext) =>
    apiClient.get<AuditApiResponse<AuditFilterOptions>>(
      `${BASE}/filters`,
      withLaravelParams(context),
    ),

  show: (context: LaravelContext, id: number) =>
    apiClient.get<AuditApiResponse<AuditEntryDetail>>(`${BASE}/${id}`, withLaravelParams(context)),

  /** Every filtered row; the CSV itself is assembled client side. */
  exportRows: (context: LaravelContext, params: AuditListParams = {}) =>
    apiClient.get<AuditApiResponse<AuditEntry[]>>(
      `${BASE}/export`,
      withLaravelParams(context, toStringParams({ ...params })),
    ),

  userActions: (context: LaravelContext, params: AuditListParams = {}) =>
    apiClient.get<AuditApiResponse<AuditUserSummary[]>>(
      `${BASE}/user-actions`,
      withLaravelParams(context, toStringParams({ ...params })),
    ),

  userActivity: (context: LaravelContext, userId: number, params: AuditListParams = {}) =>
    apiClient.get<AuditApiResponse<AuditUserActivity>>(
      `${BASE}/user-actions/${userId}`,
      withLaravelParams(context, toStringParams({ ...params })),
    ),
}
