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
  standard_filter?: FieldRef & { preset: string; from?: string | null; to?: string | null }
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

export type TabularResult = { rows: Record<string, unknown>[]; total: number; page: number; per_page: number }
export type SummaryResult = { groups: Array<Record<string, unknown> & { label: string; count: number }> }
export type PivotResult = { row_labels: string[]; column_labels: string[]; matrix: number[][]; row_totals: number[]; column_totals: number[] }
export type ChartResult = { labels: string[]; series: Array<{ name: string; data: number[] }> }
export type ReportResult = TabularResult | SummaryResult | PivotResult | ChartResult

export type ModuleField = { key: string; label: string; type: string; groupable: boolean; aggregatable: boolean; is_custom_field: boolean }
export type ModuleOption = { key: string; label: string; joinable: string[] }

export type ReportShare = { id: number; viewer_user_id: number; can_edit: boolean; viewer_name: string | null }

function params(context: LaravelContext, extra: Record<string, unknown> = {}) {
  return {
    ...(context.token ? { type: 'api', token: context.token } : {}),
    ...extra,
  }
}

function qs(extra: Record<string, string | number | undefined>): string {
  const parts = Object.entries(extra)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)

  return parts.length ? `?${parts.join('&')}` : ''
}

export const reportBuilderService = {
  // Folders
  listFolders: (context: LaravelContext, scope: ReportScope) =>
    apiClient.get<{ status: boolean; data: { folders: ReportFolder[] } }>(
      `/report-builder/folders${qs({ scope })}`,
      params(context),
    ),

  createFolder: (context: LaravelContext, scope: ReportScope, name: string) =>
    apiClient.post<{ status: boolean; message: string; data: { id: number } }>(
      `/report-builder/folders${qs({ scope })}`,
      params(context, { name }),
    ),

  renameFolder: (context: LaravelContext, id: number, name: string) =>
    apiClient.put<{ status: boolean; message: string }>(`/report-builder/folders/${id}`, params(context, { name })),

  deleteFolder: (context: LaravelContext, id: number) =>
    apiClient.delete<{ status: boolean; message: string }>(`/report-builder/folders/${id}`, params(context)),

  // Modules / fields (for the builder)
  listModules: (context: LaravelContext, scope: ReportScope) =>
    apiClient.get<{ status: boolean; data: { modules: ModuleOption[] } }>(
      `/report-builder/modules${qs({ scope })}`,
      params(context),
    ),

  listFields: (context: LaravelContext, moduleKey: string) =>
    apiClient.get<{ status: boolean; data: { fields: ModuleField[] } }>(
      `/report-builder/modules/${encodeURIComponent(moduleKey)}/fields`,
      params(context),
    ),

  // Reports
  listReports: (context: LaravelContext, scope: ReportScope, view: ReportView, folderId?: number) =>
    apiClient.get<{ status: boolean; data: { reports: ReportSummary[] } }>(
      `/report-builder${qs({ scope, view, folder_id: folderId })}`,
      params(context),
    ),

  getReport: (context: LaravelContext, id: number) =>
    apiClient.get<{ status: boolean; data: ReportDetail }>(`/report-builder/${id}`, params(context)),

  createReport: (context: LaravelContext, payload: {
    scope: ReportScope; folder_id: number | null; report_type: ReportType; primary_module: string
    title: string; description?: string; sharingtype?: 'Private' | 'Public'; definition: ReportDefinition
  }) =>
    apiClient.post<{ status: boolean; message: string; data: ReportDetail }>('/report-builder', params(context, payload)),

  updateReport: (context: LaravelContext, id: number, payload: {
    scope: ReportScope; folder_id: number | null; report_type: ReportType; primary_module: string
    title: string; description?: string; sharingtype?: 'Private' | 'Public'; definition: ReportDefinition
  }) =>
    apiClient.put<{ status: boolean; message: string; data: ReportDetail }>(`/report-builder/${id}`, params(context, payload)),

  deleteReport: (context: LaravelContext, id: number) =>
    apiClient.delete<{ status: boolean; message: string }>(`/report-builder/${id}`, params(context)),

  preview: (context: LaravelContext, scope: ReportScope, reportType: ReportType, primaryModule: string, definition: ReportDefinition) =>
    apiClient.post<{ status: boolean; data: ReportResult; message?: string }>(
      '/report-builder/preview',
      params(context, { scope, report_type: reportType, primary_module: primaryModule, folder_id: null, title: '(preview)', definition }),
    ),

  run: (context: LaravelContext, id: number) =>
    apiClient.get<{ status: boolean; data: ReportResult; message?: string }>(`/report-builder/${id}/run`, params(context)),

  exportUrl: (context: LaravelContext, id: number) =>
    buildApiUrl(`/report-builder/${id}/export`, params(context)),

  // Sharing
  listShares: (context: LaravelContext, id: number) =>
    apiClient.get<{ status: boolean; data: { shares: ReportShare[] } }>(`/report-builder/${id}/shares`, params(context)),

  share: (context: LaravelContext, id: number, viewerUserId: number, canEdit: boolean) =>
    apiClient.post<{ status: boolean; message: string }>(`/report-builder/${id}/shares`, params(context, { viewer_user_id: viewerUserId, can_edit: canEdit })),

  unshare: (context: LaravelContext, id: number, shareId: number) =>
    apiClient.delete<{ status: boolean; message: string }>(`/report-builder/${id}/shares/${shareId}`, params(context)),
}
