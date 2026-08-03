/**
 * Excel Automation agent — the Google Sheet side.
 *
 * These endpoints predate the agentic module and live outside its prefix, so
 * they keep their own service rather than being bent into agentService:
 *   GET  /excel-agent/credentials  connected sheet + its column template
 *   POST /excel-agent/upload       append rows, or dry-run with validate_only
 *
 * Note the envelope differs from the rest of the module: these return
 * `{status: boolean, message}` rather than `{status: 1|0, message, data}`.
 */

import { apiClient, buildApiUrl } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'

export interface ExcelTemplate {
  id: number
  name: string
  columns: string[]
}

export interface ExcelCredentialStatus {
  status: boolean
  has_google_credentials: boolean
  google_credential: { id: number; google_sheet_id: string; is_active: boolean } | null
  template: ExcelTemplate | null
}

/** One cell the template's validation rules rejected. */
export interface ExcelRowError {
  row: number
  column: string
  message: string
}

export interface ExcelUploadResult {
  status: boolean
  message: string
  /** True when the server validated only and wrote nothing. */
  validated_only?: boolean
  rows_ready?: number
  rows_uploaded?: number
  written_range?: string
  skipped_empty_rows?: number
  header_row?: number
  sheet_title?: string
  google_sheet_id?: string
  expected_headers?: string[]
  received_headers?: string[]
  extra_headers?: string[]
  mismatches?: { column: string; expected: string; received: string }[]
  preview_rows?: string[][]
  /** Per-cell failures — present when the headers matched but data did not. */
  errors?: ExcelRowError[]
}

export interface ExcelConnectionTest {
  status: boolean
  message: string
  sheet_title?: string
  expected_headers?: string[]
  received_headers?: string[]
  error?: string
}

export const excelAgentService = {
  credentials: (context: LaravelContext) =>
    apiClient.get<ExcelCredentialStatus>('/excel-agent/credentials', { token: context.token }),

  /**
   * `validateOnly` runs every check — parse, header comparison, row rules —
   * and reports what would be written without touching the sheet.
   */
  upload: (context: LaravelContext, file: File, validateOnly = false) => {
    const form = new FormData()

    form.append('token', context.token)
    form.append('sub_institute_id', context.subInstituteId)
    form.append('file', file)
    if (validateOnly) form.append('validate_only', '1')

    return apiClient.postForm<ExcelUploadResult>('/excel-agent/upload', form)
  },

  /** Confirms the sheet is still reachable and its headers still match. */
  testConnection: (context: LaravelContext) =>
    apiClient.post<ExcelConnectionTest>('/excel-agent/test-connection', {
      token: context.token,
      sub_institute_id: context.subInstituteId,
    }),

  /**
   * Absolute URL for the blank workbook. A download has to reach the browser's
   * download manager, which fetch cannot do, so this is an href rather than a
   * request. The file is built server-side from this organisation's own
   * template headers, so what you download is what upload will accept.
   */
  templateUrl: (context: LaravelContext) =>
    buildApiUrl('/excel-agent/template', {
      token: context.token,
      sub_institute_id: context.subInstituteId,
    }),
}
