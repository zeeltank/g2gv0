/**
 * Framework & Role Mapping Studio service.
 *
 * Backed by the additive Laravel studio API (token + sub_institute_id via
 * withLaravelParams, JSON envelope {status,message,data}) that reuses existing
 * tables plus two new studio tables:
 *   GET  /competency/studio/summary                      - 5 cards + coverage donut
 *   GET  /competency/studio/framework-structure          - category tree (s_users_skills)
 *   GET  /competency/studio/proficiency-scale            - s_proficiency_levels (+ KASA)
 *   GET/PUT /competency/studio/weights                   - default category weighting
 *   GET  /competency/frameworks                          - list (existing)
 *   POST /competency/frameworks                          - create (existing)
 *   GET/PUT/DELETE /competency/frameworks/{id}            - show / update / delete
 *   POST /competency/frameworks/{id}/clone               - clone
 *   GET/POST /competency/frameworks/{id}/items           - list / add item
 *   DELETE /competency/frameworks/{id}/items/{itemId}    - remove item
 *   GET  /competency/role-mapping/roles                  - roles ranked by mapping count
 *   GET  /competency/role-mapping/matrix                 - competency x role required levels
 *   PUT/DELETE /competency/role-mapping/cell             - set / clear one cell
 *   GET  /competency/mapping-reviews                     - approval queue (+ counts)
 *   POST /competency/mapping-reviews                     - submit for review
 *   PUT  /competency/mapping-reviews/{id}                - approve / reject
 *   POST /competency/mapping-reviews/bulk-approve        - approve many
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

export interface StudioApiResponse<T> {
  status: number
  message: string
  data: T
}

export interface StudioPagination {
  page: number
  per_page: number
  total: number
  last_page: number
}

export interface StudioListResponse<T> extends StudioApiResponse<T> {
  pagination: StudioPagination
}

/* ------------------------------------------------------------------ *
 * Summary
 * ------------------------------------------------------------------ */

export interface StudioMappingSummary {
  total_roles: number
  fully_mapped: number
  partially_mapped: number
  not_mapped: number
  fully_pct: number
  partial_pct: number
  not_pct: number
}

export interface StudioActiveFramework {
  id: number
  name: string
  status: string
  version: string
}

export interface StudioSummary {
  active_framework: StudioActiveFramework | null
  total_competencies: number
  roles_mapped: number
  total_roles: number
  coverage_percent: number
  last_published: string | null
  mapping_summary: StudioMappingSummary
}

/* ------------------------------------------------------------------ *
 * Framework structure / proficiency scale / weighting
 * ------------------------------------------------------------------ */

export interface FrameworkStructureChild {
  name: string
  count: number
}

export interface FrameworkStructureNode {
  index: number
  category: string
  count: number
  children: FrameworkStructureChild[]
}

export interface ProficiencyLevel {
  id?: number
  level: number
  label: string
  name: string | null
  description: string | null
}

export interface ProficiencyLevelPayload {
  name: string
  description?: string
  level?: number
  label?: string
}

export interface KasaItem {
  level: number
  descriptor: string | null
  indicators: string | null
}

export interface ProficiencyScale {
  levels: ProficiencyLevel[]
  kasa: {
    knowledge: KasaItem[]
    ability: KasaItem[]
    attitude: KasaItem[]
    behaviour: KasaItem[]
  }
}

export interface WeightRow {
  category: string
  weight: number
}

/* ------------------------------------------------------------------ *
 * Frameworks
 * ------------------------------------------------------------------ */

export interface FrameworkItem {
  id: number
  competency_id: number
  competency_name: string | null
  category: string | null
  sub_category: string | null
  competency_type: string | null
  required_proficiency: string | null
}

export interface Framework {
  id: number
  name: string
  description: string | null
  version: string
  status: string
  department_id: number | null
  jobrole: string | null
  created_at: string | null
  updated_at: string | null
  items?: FrameworkItem[]
}

export interface FrameworkPayload {
  name: string
  description?: string
  version?: string
  status?: string
  department_id?: string | number
  jobrole?: string
}

/* ------------------------------------------------------------------ *
 * Role mapping matrix
 * ------------------------------------------------------------------ */

export interface RoleRow {
  jobrole: string
  department: string | null
  mapped_count: number
}

export interface MatrixCompetency {
  id: number
  title: string
  description: string | null
  category: string | null
  sub_category: string | null
  competency_type: string | null
  proficiency_level: string | null
}

export interface MatrixCell {
  id: number
  level: number | null
  raw: string | null
}

export interface Matrix {
  category: string | null
  roles: string[]
  competencies: MatrixCompetency[]
  /** cells[jobrole][skillTitle] */
  cells: Record<string, Record<string, MatrixCell>>
}

/* ------------------------------------------------------------------ *
 * Mapping reviews (workflow)
 * ------------------------------------------------------------------ */

export interface MappingReview {
  id: number
  jobrole: string
  department: string | null
  framework_id: number | null
  submitted_by_name: string | null
  status: string
  changes_count: number
  changes: string | null
  note: string | null
  submitted_at: string | null
  reviewed_at: string | null
}

export interface ReviewCounts {
  pending: number
  approved: number
  rejected: number
}

export interface ReviewListResponse extends StudioListResponse<MappingReview[]> {
  counts: ReviewCounts
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

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

export const competencyStudioService = {
  /* -- read models -- */
  getSummary: (context: LaravelContext) =>
    apiClient.get<StudioApiResponse<StudioSummary>>(
      '/competency/studio/summary',
      withLaravelParams(context),
    ),

  getFrameworkStructure: (context: LaravelContext, search?: string) =>
    apiClient.get<StudioApiResponse<FrameworkStructureNode[]>>(
      '/competency/studio/framework-structure',
      withLaravelParams(context, toStringParams({ search })),
    ),

  getProficiencyScale: (context: LaravelContext) =>
    apiClient.get<StudioApiResponse<ProficiencyScale>>(
      '/competency/studio/proficiency-scale',
      withLaravelParams(context),
    ),

  createLevel: (context: LaravelContext, payload: ProficiencyLevelPayload) =>
    apiClient.post<StudioApiResponse<{ id: number }>>('/competency/studio/proficiency-scale', {
      ...withLaravelParams(context),
      ...payload,
    }),

  updateLevel: (context: LaravelContext, id: number, payload: ProficiencyLevelPayload) =>
    apiClient.put<StudioApiResponse<null>>(`/competency/studio/proficiency-scale/${id}`, {
      ...withLaravelParams(context),
      ...payload,
    }),

  deleteLevel: (context: LaravelContext, id: number) =>
    apiClient.delete<StudioApiResponse<null>>(
      `/competency/studio/proficiency-scale/${id}`,
      withLaravelParams(context),
    ),

  getWeights: (context: LaravelContext) =>
    apiClient.get<StudioApiResponse<WeightRow[]>>(
      '/competency/studio/weights',
      withLaravelParams(context),
    ),

  saveWeights: (context: LaravelContext, weights: WeightRow[]) =>
    apiClient.put<StudioApiResponse<null>>('/competency/studio/weights', {
      ...withLaravelParams(context),
      weights,
    }),

  /* -- frameworks -- */
  listFrameworks: (context: LaravelContext, params?: { search?: string; status?: string; per_page?: number }) =>
    apiClient.get<StudioListResponse<Framework[]>>(
      '/competency/frameworks',
      withLaravelParams(context, toStringParams({ per_page: 100, ...params })),
    ),

  getFramework: (context: LaravelContext, id: number) =>
    apiClient.get<StudioApiResponse<Framework>>(
      `/competency/frameworks/${id}`,
      withLaravelParams(context),
    ),

  createFramework: (context: LaravelContext, payload: FrameworkPayload) =>
    apiClient.post<StudioApiResponse<{ id: number }>>('/competency/frameworks', {
      ...withLaravelParams(context),
      ...payload,
    }),

  updateFramework: (context: LaravelContext, id: number, payload: FrameworkPayload) =>
    apiClient.put<StudioApiResponse<{ id: number }>>(`/competency/frameworks/${id}`, {
      ...withLaravelParams(context),
      ...payload,
    }),

  cloneFramework: (context: LaravelContext, id: number, name?: string) =>
    apiClient.post<StudioApiResponse<{ id: number; name: string }>>(`/competency/frameworks/${id}/clone`, {
      ...withLaravelParams(context),
      ...(name ? { name } : {}),
    }),

  deleteFramework: (context: LaravelContext, id: number) =>
    apiClient.delete<StudioApiResponse<null>>(
      `/competency/frameworks/${id}`,
      withLaravelParams(context),
    ),

  addFrameworkItem: (context: LaravelContext, id: number, competencyId: number, requiredProficiency?: string) =>
    apiClient.post<StudioApiResponse<{ id: number }>>(`/competency/frameworks/${id}/items`, {
      ...withLaravelParams(context),
      competency_id: competencyId,
      ...(requiredProficiency ? { required_proficiency: requiredProficiency } : {}),
    }),

  removeFrameworkItem: (context: LaravelContext, id: number, itemId: number) =>
    apiClient.delete<StudioApiResponse<null>>(
      `/competency/frameworks/${id}/items/${itemId}`,
      withLaravelParams(context),
    ),

  /* -- role mapping matrix -- */
  getRoles: (context: LaravelContext, params?: { search?: string; category?: string; page?: number; per_page?: number }) =>
    apiClient.get<StudioListResponse<RoleRow[]>>(
      '/competency/role-mapping/roles',
      withLaravelParams(context, toStringParams({ ...params })),
    ),

  getMatrix: (context: LaravelContext, params: { category?: string; jobroles: string[] }) =>
    apiClient.get<StudioApiResponse<Matrix>>(
      '/competency/role-mapping/matrix',
      withLaravelParams(context, toStringParams({
        category: params.category,
        jobroles: params.jobroles.join(','),
      })),
    ),

  saveCell: (context: LaravelContext, jobrole: string, skill: string, proficiencyLevel: string) =>
    apiClient.put<StudioApiResponse<{ id: number }>>('/competency/role-mapping/cell', {
      ...withLaravelParams(context),
      jobrole,
      skill,
      proficiency_level: proficiencyLevel,
    }),

  clearCell: (context: LaravelContext, jobrole: string, skill: string) =>
    apiClient.delete<StudioApiResponse<null>>(
      '/competency/role-mapping/cell',
      withLaravelParams(context, toStringParams({ jobrole, skill })),
    ),

  /* -- mapping reviews -- */
  listReviews: (context: LaravelContext, status: string) =>
    apiClient.get<ReviewListResponse>(
      '/competency/mapping-reviews',
      withLaravelParams(context, toStringParams({ status })),
    ),

  submitReview: (context: LaravelContext, payload: { jobrole: string; department?: string; framework_id?: number; changes_count?: number; changes?: string }) =>
    apiClient.post<StudioApiResponse<{ id: number }>>('/competency/mapping-reviews', {
      ...withLaravelParams(context),
      ...payload,
    }),

  reviewAction: (context: LaravelContext, id: number, action: 'approve' | 'reject', note?: string) =>
    apiClient.put<StudioApiResponse<null>>(`/competency/mapping-reviews/${id}`, {
      ...withLaravelParams(context),
      action,
      ...(note ? { note } : {}),
    }),

  bulkApprove: (context: LaravelContext, ids?: number[]) =>
    apiClient.post<StudioApiResponse<{ approved: number }>>('/competency/mapping-reviews/bulk-approve', {
      ...withLaravelParams(context),
      ...(ids && ids.length ? { ids } : {}),
    }),
}
