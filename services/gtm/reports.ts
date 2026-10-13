/**
 * GTM reports (Laravel /api/gtm/reports). Viewing is Administrator/Executive; export is Administrator-only.
 * The catalogue the server returns is the source of truth for filters, columns and enum values.
 */

import { apiClient } from '@/services/core'

type Env<T> = { status: number; data: T; message?: string }

export type ReportFilterType = 'enum' | 'int' | 'date' | 'currency' | 'text'
export type ReportColumnType = 'number' | 'text' | 'date' | 'money'

export interface ReportColumn { label: string; type: ReportColumnType | string }

export interface ReportDef {
  key: string
  title: string
  description: string
  pii: boolean
  admin_only: boolean
  filters: Record<string, ReportFilterType | string>
  enums: Record<string, string[]> | never[]
  columns: Record<string, ReportColumn> | ReportColumn[]
}

export interface ReportCatalogue { reports: ReportDef[]; can_export: boolean; max_rows: number }

export type ReportRow = Record<string, unknown>

export interface ReportResult {
  report: { key: string; title: string; description: string; pii: boolean; masked: boolean; columns: Record<string, ReportColumn> | ReportColumn[] }
  filters: Record<string, unknown>
  summary: {
    rows: number
    value_by_currency?: Record<string, number>
    basis?: string
    total_tokens?: number
    failed?: number
  } & Record<string, unknown>
  truncated: boolean
  total: number
  page: number
  per_page: number
  rows: ReportRow[]
}

export type ExportFormat = 'csv' | 'json'
export type ReportFilters = Record<string, string>

const clean = (f: ReportFilters): Record<string, string> =>
  Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''))

export const reportsService = {
  catalogue: () => apiClient.get<Env<ReportCatalogue>>('/gtm/reports'),

  run: (key: string, filters: ReportFilters, page: number, perPage: number) =>
    apiClient.get<Env<ReportResult>>(`/gtm/reports/${encodeURIComponent(key)}`, {
      ...clean(filters), page: String(page), per_page: String(perPage),
    }),

  /** Fetched with the Authorization header (a plain link cannot carry it) and returned as a blob. */
  exportBlob: (key: string, filters: ReportFilters, format: ExportFormat) =>
    apiClient.getBlob(`/gtm/reports/${encodeURIComponent(key)}/export`, { ...clean(filters), format }),
}
