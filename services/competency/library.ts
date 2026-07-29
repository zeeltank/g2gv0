/**
 * Competency Library service.
 *
 * Backed by the additive Laravel competency-library JSON API on the existing
 * skill library controller (a competency IS an approved skill on
 * s_users_skills):
 *   GET    /skill_library/competency-list   - paginated list (+ filters/sort)
 *   GET    /skill_library/competency/{id}    - single competency
 *   POST   /skill_library/competency         - create
 *   PUT    /skill_library/competency/{id}     - update
 *   DELETE /skill_library/competency/{id}     - soft delete
 *
 * Every call carries the standard Laravel context (token, sub_institute_id,
 * user_id, syear, type=API) via withLaravelParams, exactly like
 * services/competency/command-center.ts.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

export interface CompetencyLibraryApiResponse<T> {
  status: number
  message: string
  data: T
}

export interface CompetencyLibraryPagination {
  page: number
  per_page: number
  total: number
  last_page: number
}

export interface CompetencyLibraryListResponse<T> extends CompetencyLibraryApiResponse<T> {
  pagination: CompetencyLibraryPagination
}

/** A competency row as returned by the list / show endpoints. */
export interface CompetencyLibraryItem {
  id: number
  name: string
  description: string | null
  category: string | null
  sub_category: string | null
  competency_type: string | null
  proficiency_level: string | null
  department: string | null
  department_id: number | null
  /** s_users_skills.status - Active | Inactive */
  status: string | null
  /** s_users_skills.approve_status - Approved | Pending | Cancelled */
  approve_status: string | null
  owner: string | null
  created_at: string | null
  updated_at: string | null
  created_by?: number | null
  /** present only on the single-record show() response */
  job_titles?: string | null
  related_skills?: string | null
  learning_resources?: string | null
}

export type CompetencySortField =
  | 'title'
  | 'category'
  | 'competency_type'
  | 'approve_status'
  | 'updated_at'
  | 'created_at'

export interface CompetencyLibraryListParams {
  search?: string
  category?: string
  competency_type?: string
  /** filters on approve_status: Approved | Pending | Cancelled */
  status?: string
  sort?: CompetencySortField
  direction?: 'asc' | 'desc'
  page?: number
  per_page?: number
}

/* -- Detail panel (Proficiency / Associations / Attachments / History tabs) -- */
export interface CompetencyDetailLevel {
  level: number
  label: string
  name: string | null
  description: string | null
}
export interface CompetencyAssociationRole {
  jobrole: string
  proficiency_level: string | null
}
export interface CompetencyAssociationFramework {
  id: number
  name: string
  status: string
  required_proficiency: string | null
}
export interface CompetencyAttachment {
  type: string
  value: string
}
export interface CompetencyHistoryEntry {
  action: string
  by: string
  date: string
}
/** The Overview tab's Summary block - where this competency is actually in use. */
export interface CompetencySummary {
  description: string | null
  category: string | null
  sub_category: string | null
  competency_type: string | null
  status: string | null
  role_count: number
  framework_count: number
  rated_employees: number
  plan_count: number
  certification_count: number
  /** Assessments run against the frameworks that contain this competency. */
  assessment_count: number
  learning_count: number
  evidence_count: number
}

/** A row of the Overview tab's "Top Associated Roles" block. */
export interface CompetencyTopRole {
  jobrole: string
  proficiency_level: string | null
  department: string | null
}

export interface CompetencyDetail {
  summary: CompetencySummary
  top_roles: CompetencyTopRole[]
  proficiency: { scale_label: string | null; scope: string; levels: CompetencyDetailLevel[] }
  associations: {
    roles: CompetencyAssociationRole[]
    frameworks: CompetencyAssociationFramework[]
    role_count: number
    framework_count: number
  }
  attachments: CompetencyAttachment[]
  history: CompetencyHistoryEntry[]
}

/** One row of a parsed import file. */
export interface CompetencyImportRow {
  name: string
  description?: string
  category?: string
  sub_category?: string
  competency_type?: string
  proficiency_level?: string
}

export interface CompetencyImportResult {
  imported: number
  skipped: number
  details: { row: number; name: string; reason: string }[]
}

export interface CompetencyLibraryPayload {
  name: string
  description?: string
  category?: string
  sub_category?: string
  competency_type?: string
  proficiency_level?: string
  department_id?: string | number
  /** approve_status: Approved | Pending | Cancelled */
  status?: string
}

const BASE = '/skill_library'

/** Serialise a mixed param bag into the string map apiClient.get expects, dropping blanks. */
function toStringParams(input: Record<string, string | number | undefined | null>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue
    const normalized = String(value).trim()
    if (normalized === '') continue
    out[key] = normalized
  }
  return out
}

export const competencyLibraryService = {
  list: (context: LaravelContext, params?: CompetencyLibraryListParams) =>
    apiClient.get<CompetencyLibraryListResponse<CompetencyLibraryItem[]>>(
      `${BASE}/competency-list`,
      withLaravelParams(context, toStringParams({ ...params })),
    ),

  get: (context: LaravelContext, id: number) =>
    apiClient.get<CompetencyLibraryApiResponse<CompetencyLibraryItem>>(
      `${BASE}/competency/${id}`,
      withLaravelParams(context),
    ),

  getDetail: (context: LaravelContext, id: number) =>
    apiClient.get<CompetencyLibraryApiResponse<CompetencyDetail>>(
      `${BASE}/competency/${id}/detail`,
      withLaravelParams(context),
    ),

  create: (context: LaravelContext, payload: CompetencyLibraryPayload) =>
    apiClient.post<CompetencyLibraryApiResponse<{ id: number }>>(`${BASE}/competency`, {
      ...withLaravelParams(context),
      ...payload,
    }),

  update: (context: LaravelContext, id: number, payload: CompetencyLibraryPayload) =>
    apiClient.put<CompetencyLibraryApiResponse<{ id: number }>>(`${BASE}/competency/${id}`, {
      ...withLaravelParams(context),
      ...payload,
    }),

  remove: (context: LaravelContext, id: number) =>
    apiClient.delete<CompetencyLibraryApiResponse<null>>(
      `${BASE}/competency/${id}`,
      withLaravelParams(context),
    ),

  /** Every row matching the current filters, for "Export Library". */
  exportRows: (context: LaravelContext, params?: CompetencyLibraryListParams) =>
    apiClient.get<CompetencyLibraryApiResponse<CompetencyLibraryItem[]>>(
      `${BASE}/competency-export`,
      withLaravelParams(context, toStringParams({ ...params })),
    ),

  /** Bulk-create from a file parsed in the browser ("Import Competencies"). */
  importRows: (context: LaravelContext, rows: CompetencyImportRow[]) =>
    apiClient.post<CompetencyLibraryApiResponse<CompetencyImportResult>>(
      `${BASE}/competency-import`,
      { ...withLaravelParams(context), rows },
    ),

  /** Duplicate a competency as a new Pending library entry. */
  clone: (context: LaravelContext, id: number, name?: string) =>
    apiClient.post<CompetencyLibraryApiResponse<{ id: number; name: string }>>(
      `${BASE}/competency/${id}/clone`,
      { ...withLaravelParams(context), ...(name ? { name } : {}) },
    ),

  /**
   * Archive (approve_status = Cancelled) or restore. Not a delete: the
   * competency stays referenced by role mappings, frameworks and assessments.
   */
  archive: (context: LaravelContext, id: number, restore = false) =>
    apiClient.put<CompetencyLibraryApiResponse<{ id: number; approve_status: string }>>(
      `${BASE}/competency/${id}/archive`,
      { ...withLaravelParams(context), restore },
    ),
}
