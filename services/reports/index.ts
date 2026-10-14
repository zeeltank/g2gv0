import { apiClient, buildApiUrl } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'

/**
 * The generic report builder engine's API client — one client for every
 * registered module (Task Management, later CRM); `scope` says which.
 * Backend: Docs/reports-engine/PLAN.md, routes under /api/report-builder/*
 * (NOT /api/reports/* — that prefix already belongs to an unrelated
 * HR/Talent analytics namespace).
 */

export type ReportScope = 'task_management' | 'crm'
export type ReportType = 'tabular' | 'summary' | 'pivot' | 'chart'
export type ReportView = 'folder' | 'all' | 'shared'

export type ReportFolder = {
  id: number
  name: string
  is_system: boolean
  owner_id: number | null
  sort_order: number
}

export type ReportSummary = {
  id: number
  folder_id: number | null
  report_type: ReportType
  primary_module: string
  title: string
  description: string | null
  owner_id: number
  sharingtype: 'Private' | 'Public'
  last_run_at: string | null
  updated_at: string | null
}

export type FieldRef = { module: string; field: string }

export type ReportColumn = FieldRef & { label: string; visible?: boolean; aggregate?: 'sum' | 'avg' | 'min' | 'max' | null }

export type FilterLeaf = FieldRef & { operator: string; value?: unknown; from?: unknown; to?: unknown }
export type FilterGroup = { op: 'AND' | 'OR'; conditions: Array<FilterLeaf | FilterGroup> }

export type ReportDefinition = {
  secondary_modules?: string[]
  columns?: ReportColumn[]
  standard_filter?: FieldRef & { preset: string; from?: string | null; to?: string | null; n?: number }
  advanced_filter?: FilterGroup | null
  sort_columns?: Array<FieldRef & { direction: 'asc' | 'desc' }>
  group_by?: FieldRef[]
  pivot?: { rows: FieldRef[]; columns: FieldRef[]; values: Array<FieldRef & { aggregate: string; label?: string }> }
  chart?: { type: 'Pie' | 'VerticalBar' | 'HorizontalBar' | 'Line'; group_by: FieldRef; data_fields: Array<FieldRef & { aggregate: string; label?: string }> }
  page?: number
  per_page?: number
}

export type ReportDetail = {
  id: number
  folder_id: number | null
  report_type: ReportType
  primary_module: string
  title: string
  description: string | null
  owner_id: number
  sharingtype: 'Private' | 'Public'
  definition: ReportDefinition
  last_run_at: string | null
  updated_at: string | null
}

export type TabularResult = { rows: Record<string, unknown>[]; total: number; page: number; per_page: number; latest_date: string | null }
export type SummaryResult = { groups: Array<Record<string, unknown> & { label: string; count: number }> }
export type PivotResult = { row_labels: string[]; column_labels: string[]; matrix: number[][]; row_totals: number[]; column_totals: number[] }
export type ChartResult = { labels: string[]; series: Array<{ name: string; data: number[] }> }
export type ReportResult = TabularResult | SummaryResult | PivotResult | ChartResult

export type ModuleField = { key: string; label: string; type: string; groupable: boolean; aggregatable: boolean; is_custom_field: boolean }
export type ModuleOption = { key: string; label: string; joinable: string[] }

export type ReportShare = { id: number; viewer_user_id: number; can_edit: boolean; viewer_name: string | null }

export type ReportScheduleFrequency = 'daily' | 'weekly' | 'monthly'

export type ReportSchedule = {
  id: number
  frequency: ReportScheduleFrequency
  day_of_week: number | null
  day_of_month: number | null
  time_of_day: string
  recipients: string[]
  is_active: boolean
  last_sent_at: string | null
}

export type ReportSchedulePayload = {
  frequency: ReportScheduleFrequency
  day_of_week?: number | null
  day_of_month?: number | null
  time_of_day: string
  recipients: string[]
  is_active?: boolean
}

/*
 * TWO SEPARATE HELPERS, NOT ONE — a real bug caught live (a deployed "Unknown
 * scope" error): `apiClient.get`/`delete` take a `Record<string, string>`
 * that THEY turn into the query string internally (`api-client.ts`'s own
 * `request()` always does `url += '?' + new URLSearchParams(params)`,
 * unconditionally). Building a SECOND `?query` string by hand into the
 * endpoint path, the way an earlier version of this file did, produces a
 * literal second `?` in the final URL — not a syntax error, just silently
 * wrong: everything after the first `&` of the hand-built part gets
 * swallowed into the previous key's value by the query parser, so `scope`
 * from a hand-built qs() could arrive intact while `view`/`folder_id`
 * (or vice versa, depending on write order) arrive corrupted or missing.
 * `apiClient.post`/`put`'s second argument is a request BODY instead
 * (arbitrary JSON, sent via `JSON.stringify`, nested objects like
 * `definition` are fine) — a different contract, so it gets its own helper
 * rather than overloading one function for both shapes.
 */
function authParams(context: LaravelContext): Record<string, string> {
  return context.token ? { type: 'api', token: context.token } : {}
}

/** For GET/DELETE — everything becomes part of the URL's query string, so every value must already be a string; `undefined`/`null`/`''` are dropped rather than becoming the literal text "undefined". */
function queryParams(context: LaravelContext, extra: Record<string, string | number | boolean | undefined | null> = {}): Record<string, string> {
  const result = authParams(context)

  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined || value === null || value === '') continue
    result[key] = String(value)
  }

  return result
}

/** For POST/PUT — becomes the JSON request body, so nested objects (e.g. `definition`) pass through untouched. */
function bodyParams(context: LaravelContext, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...authParams(context), ...extra }
}

export const reportBuilderService = {
  // Folders
  listFolders: (context: LaravelContext, scope: ReportScope) =>
    apiClient.get<{ status: boolean; data: { folders: ReportFolder[] } }>(
      '/report-builder/folders',
      queryParams(context, { scope }),
    ),

  createFolder: (context: LaravelContext, scope: ReportScope, name: string) =>
    apiClient.post<{ status: boolean; message: string; data: { id: number } }>(
      '/report-builder/folders',
      bodyParams(context, { scope, name }),
    ),

  renameFolder: (context: LaravelContext, id: number, name: string) =>
    apiClient.put<{ status: boolean; message: string }>(`/report-builder/folders/${id}`, bodyParams(context, { name })),

  deleteFolder: (context: LaravelContext, id: number) =>
    apiClient.delete<{ status: boolean; message: string }>(`/report-builder/folders/${id}`, queryParams(context)),

  // Modules / fields (for the builder)
  listModules: (context: LaravelContext, scope: ReportScope) =>
    apiClient.get<{ status: boolean; data: { modules: ModuleOption[] } }>(
      '/report-builder/modules',
      queryParams(context, { scope }),
    ),

  listFields: (context: LaravelContext, moduleKey: string) =>
    apiClient.get<{ status: boolean; data: { fields: ModuleField[] } }>(
      `/report-builder/modules/${encodeURIComponent(moduleKey)}/fields`,
      queryParams(context),
    ),

  // Reports
  listReports: (context: LaravelContext, scope: ReportScope, view: ReportView, folderId?: number) =>
    apiClient.get<{ status: boolean; data: { reports: ReportSummary[] } }>(
      '/report-builder',
      queryParams(context, { scope, view, folder_id: folderId }),
    ),

  getReport: (context: LaravelContext, id: number) =>
    apiClient.get<{ status: boolean; data: ReportDetail }>(`/report-builder/${id}`, queryParams(context)),

  createReport: (context: LaravelContext, payload: {
    scope: ReportScope; folder_id: number | null; report_type: ReportType; primary_module: string
    title: string; description?: string; sharingtype?: 'Private' | 'Public'; definition: ReportDefinition
  }) =>
    apiClient.post<{ status: boolean; message: string; data: ReportDetail }>('/report-builder', bodyParams(context, payload)),

  updateReport: (context: LaravelContext, id: number, payload: {
    scope: ReportScope; folder_id: number | null; report_type: ReportType; primary_module: string
    title: string; description?: string; sharingtype?: 'Private' | 'Public'; definition: ReportDefinition
  }) =>
    apiClient.put<{ status: boolean; message: string; data: ReportDetail }>(`/report-builder/${id}`, bodyParams(context, payload)),

  deleteReport: (context: LaravelContext, id: number) =>
    apiClient.delete<{ status: boolean; message: string }>(`/report-builder/${id}`, queryParams(context)),

  preview: (context: LaravelContext, scope: ReportScope, reportType: ReportType, primaryModule: string, definition: ReportDefinition) =>
    apiClient.post<{ status: boolean; data: ReportResult; message?: string }>(
      '/report-builder/preview',
      bodyParams(context, { scope, report_type: reportType, primary_module: primaryModule, folder_id: null, title: '(preview)', definition }),
    ),

  run: (context: LaravelContext, id: number, opts?: { page?: number; perPage?: number; fresh?: boolean }) =>
    apiClient.get<{ status: boolean; data: ReportResult; message?: string }>(
      `/report-builder/${id}/run`,
      queryParams(context, { page: opts?.page, per_page: opts?.perPage, fresh: opts?.fresh ? '1' : undefined }),
    ),

  exportUrl: (context: LaravelContext, id: number) =>
    buildApiUrl(`/report-builder/${id}/export`, queryParams(context)),

  /** The member rows behind one summary/chart/pivot group — `values` is the group-by field(s) + the clicked group's own label value(s). The response's own `columns` (the primary module's default field set, server-chosen) are what to feed TabularView — a drill-down has no report-authored column list of its own. */
  drilldown: (context: LaravelContext, id: number, values: Array<FieldRef & { value: string | null }>) =>
    apiClient.post<{ status: boolean; data: TabularResult & { columns: ReportColumn[] }; message?: string }>(
      `/report-builder/${id}/drilldown`,
      bodyParams(context, { values }),
    ),

  // Sharing
  listShares: (context: LaravelContext, id: number) =>
    apiClient.get<{ status: boolean; data: { shares: ReportShare[] } }>(`/report-builder/${id}/shares`, queryParams(context)),

  share: (context: LaravelContext, id: number, viewerUserId: number, canEdit: boolean) =>
    apiClient.post<{ status: boolean; message: string }>(`/report-builder/${id}/shares`, bodyParams(context, { viewer_user_id: viewerUserId, can_edit: canEdit })),

  unshare: (context: LaravelContext, id: number, shareId: number) =>
    apiClient.delete<{ status: boolean; message: string }>(`/report-builder/${id}/shares/${shareId}`, queryParams(context)),

  // Scheduled/emailed runs
  listSchedules: (context: LaravelContext, id: number) =>
    apiClient.get<{ status: boolean; data: { schedules: ReportSchedule[] } }>(`/report-builder/${id}/schedules`, queryParams(context)),

  createSchedule: (context: LaravelContext, id: number, payload: ReportSchedulePayload) =>
    apiClient.post<{ status: boolean; message: string; data: ReportSchedule }>(`/report-builder/${id}/schedules`, bodyParams(context, payload)),

  updateSchedule: (context: LaravelContext, id: number, scheduleId: number, payload: ReportSchedulePayload) =>
    apiClient.put<{ status: boolean; message: string; data: ReportSchedule }>(`/report-builder/${id}/schedules/${scheduleId}`, bodyParams(context, payload)),

  toggleSchedule: (context: LaravelContext, id: number, scheduleId: number, isActive: boolean) =>
    apiClient.put<{ status: boolean; message: string; data: ReportSchedule }>(`/report-builder/${id}/schedules/${scheduleId}`, bodyParams(context, { is_active: isActive })),

  deleteSchedule: (context: LaravelContext, id: number, scheduleId: number) =>
    apiClient.delete<{ status: boolean; message: string }>(`/report-builder/${id}/schedules/${scheduleId}`, queryParams(context)),
}
