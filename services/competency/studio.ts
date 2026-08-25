/**
 * Framework & Role Mapping Studio service.
 *
 * Backed by the additive Laravel studio API (token + sub_institute_id via
 * withLaravelParams, JSON envelope {status,message,data}) that reuses existing
 * tables plus two new studio tables:
 *   GET  /competency/studio/summary                      - 5 cards + coverage donut
 *   GET  /competency/studio/framework-structure          - framework -> competency -> KASBA bundle
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

/**
 * FRAMEWORK -> COMPETENCY -> KASBA BUNDLE.
 *
 * This used to be a SKILL CATEGORY tree (`{ category, children: [{name, count}] }`)
 * read from `s_users_skills`, which is why a screen called Competency Framework
 * showed the skill taxonomy and why framework, competency and KASBA were
 * impossible to tell apart on it. The competency table was never consulted.
 */

/** One KASBA atom inside a competency's bundle. */
export interface FrameworkBundleItem {
  kasba_type: string
  /** Set when the item resolves into a library table; null when it is a held label. */
  item_id: number | null
  title: string | null
  /**
   * The id resolved to nothing — the library row was hard-deleted. A real
   * condition worth showing, not an empty cell to hide.
   */
  title_missing: boolean
  /** Drives the roll-up: level = Σ(weight × rating) ÷ Σ(weight measured). */
  weight: number
}

export interface FrameworkCompetency {
  competency_id: number
  name: string
  code: string | null
  /**
   * The framework's DEFAULT target level, or null if none is set.
   * A role may override it; effective target = role override ?? this.
   */
  framework_target: number | null
  items: FrameworkBundleItem[]
}

export interface FrameworkStructureNode {
  index: number
  framework_id: number
  name: string
  status: string
  version: string | null
  department_id: number | null
  jobrole_id: number | null
  jobrole: string | null
  /** How many competencies are filed under this framework. */
  count: number
  competencies: FrameworkCompetency[]
}

/**
 * What the tree does NOT contain, reported alongside it.
 *
 * Both numbers are broken links made visible rather than swallowed — a
 * structure view that omitted them would show a tidy tree while most of a
 * library sat outside it.
 */
export interface FrameworkStructureMeta {
  frameworks: number
  competencies: number
  /** Competencies filed under no framework — 199 of them on tenant 1. */
  unfiled_count: number
  unfiled: { id: number; name: string; code: string | null }[]
  /**
   * Target rows describing a (framework, competency) pairing the competency
   * itself does not claim. `competency.framework_id` and
   * `s_competency_framework_items` have never once agreed — 0 overlap on both
   * databases — so this is the size of that disagreement.
   */
  orphan_targets: number
}

/** The structure call carries `meta`, which the shared envelope does not. */
export interface FrameworkStructureResponse {
  status: number
  message: string
  data: FrameworkStructureNode[]
  meta: FrameworkStructureMeta
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
  /**
   * The role's NAME. Kept as the human label and as the fallback for the two
   * frameworks whose name is ambiguous — NOT the link. Read `jobrole_id`.
   */
  jobrole: string | null
  /**
   * THE LINK. `s_competency_frameworks.jobrole` was a name until 2026-08-24,
   * which meant renaming a role silently unhooked its framework and two roles
   * sharing a name could not be told apart. 30 of the 32 frameworks carrying a
   * name were backfilled to an id; the 2 ambiguous ones were deliberately left
   * NULL rather than guessed, so `null` here means "not linked yet", never
   * "no role".
   */
  jobrole_id: number | null
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
  /** Sent alongside the id so the stored label stays readable. */
  jobrole?: string
  /**
   * The id the server keys on. It is validated against the caller's OWN roles —
   * another organisation's id is dropped to NULL rather than accepted, so this
   * cannot be used to link across tenants.
   */
  jobrole_id?: number | null
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
    apiClient.get<FrameworkStructureResponse>(
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
