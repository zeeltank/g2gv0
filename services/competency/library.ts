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
/** One capability item in a competency's composition. */
export interface CompetencyKasbaItem {
  kasba_type: 'skill' | 'knowledge' | 'ability' | 'attitude' | 'behaviour'
  /** The resolved library row. Null means it is still held as free text. */
  item_id: number | null
  item_label: string | null
  weight: number | string | null
}

export interface CompetencyLibraryItem {
  id: number
  name: string
  description: string | null
  /**
   * The competency's own taxonomy: which framework it is filed under.
   *
   * `category` below is NOT this - the API derives it from the framework's
   * name for display, and there is no `category` column on `competency`.
   */
  framework_id?: number | null
  /** The KASBA composition, present on the single-record show() response. */
  items?: CompetencyKasbaItem[]
  /**
   * The competency's scale, returned by `show()` only — the list payload omits
   * it. Always five entries, authored or inherited, so the edit dialog can seed
   * the editor without a second request.
   */
  levels?: CompetencyProficiencyLevel[]
  /**
   * Who a change here would reach. Returned by `show()` only.
   *
   * A competency's bundle and weights are shared by everyone assessed against
   * it, so re-weighting an item re-scores employees the editor is not looking
   * at. `employees_rated` is the number whose LEVEL actually moves;
   * `roles_requiring` is what matters for a rename.
   */
  usage?: { roles_requiring: number; employees_rated: number }
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
  /**
   * Detail columns, present only on the single-record show() response.
   *
   * They are deliberately off the list payload: the table never shows them and
   * they are long free text. The edit form fetches the record to prefill them.
   * Five of them are what the drawer's Attachments tab is built from.
   */
  job_titles?: string | null
  related_skills?: string | null
  learning_resources?: string | null
  bussiness_links?: string | null
  assesment_method?: string | null
  certification_qualifications?: string | null
  experience_project?: string | null
  sop_practice_link?: string | null
  custom_tags?: string | null
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
  /**
   * ⚠ THE SERVER DOES NOT FILTER ON THIS. `CompetencyLibraryCrudController`
   * lists `category` only in its SORTABLE map (`:62`) — you may order by it,
   * never filter on it. Sending it is silently ignored, which is exactly what
   * the library's category dropdown did for as long as it existed.
   *
   * To narrow by the competency taxonomy, use `framework_id`.
   */
  category?: string
  /** Filters by framework — the competency taxonomy. Honoured at `:95`. */
  framework_id?: number
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

/**
 * A capability item inside a competency — the KASBA breakdown.
 *
 * item_id is the TARGET: a row in a canonical table. item_label is the HOLDING:
 * free text for something not yet canonical. BOTH ARE VALID AND NEITHER IS
 * DERIVED FROM THE OTHER — a label is not a failed id, it is a different claim.
 */
export interface CompetencyKasbaItemInput {
  kasba_type: 'knowledge' | 'ability' | 'skill' | 'behaviour' | 'attitude'
  item_id?: number | null
  item_label?: string | null
  weight?: number
}

/** One authored level on a competency's scale. Blank fields clear the override. */
export interface CompetencyProficiencyLevelInput {
  level: number
  descriptor?: string | null
  indicators?: string | null
}

/** One level as READ back — carries what it inherits as well as what it overrides. */
export interface CompetencyProficiencyLevel {
  level: number
  descriptor: string | null
  indicators: string | null
  /**
   * The organisation's generic descriptor for this level. Shown behind an
   * unauthored field so an author can see what they would be replacing — an
   * empty box on its own says nothing.
   */
  default_descriptor: string | null
  is_authored: boolean
}

export interface CompetencyLibraryPayload {
  name: string
  /** The competency's own code, unique within the organisation. */
  code?: string
  /** The framework this competency is filed under. */
  framework_id?: number | null
  /**
   * THE CAPABILITY ITEMS. Without these a competency is a heading with nothing
   * measurable under it — people are rated on ITEMS, never on the competency
   * itself. Optional so a competency can be drafted first, but the server says
   * so in `next_step` when the list is empty.
   */
  items?: CompetencyKasbaItemInput[]
  /**
   * THE COMPETENCY'S OWN L1–L5 SCALE — what "Level 3" means for this one.
   *
   * Rides the same payload as `items` deliberately. Levels are keyed by
   * `competency_id`, which does not exist during create, and the mutation layer
   * discards the response body — so sending them together is what lets create
   * and edit behave identically without threading a new id back out.
   *
   * SPARSE: send a blank descriptor and the server DELETES that override, so
   * the level returns to the organisation default. It never stores `""` — an
   * empty override and no override look identical and mean opposite things.
   */
  levels?: CompetencyProficiencyLevelInput[]
  description?: string
  category?: string
  sub_category?: string
  competency_type?: string
  proficiency_level?: string
  department?: string
  department_id?: string | number
  /** approve_status: Approved | Pending | Cancelled */
  status?: string
  /* Detail columns folded in from the old separate skill library screen. */
  bussiness_links?: string
  learning_resources?: string
  assesment_method?: string
  certification_qualifications?: string
  experience_project?: string
  sop_practice_link?: string
  related_skills?: string
  custom_tags?: string
}

/**
 * THE COMPETENCY LIBRARY NOW READS COMPETENCIES.
 *
 * This was '/skill_library' — SkillLibraryCrudController on `s_users_skills`.
 * The screen showed skill rows under competency labels, which is G-RBAC-02b:
 * a name promising something the data was not.
 *
 * CompetencyLibraryCrudController serves the SAME response shape from
 * `competency` + `competency_kasba_item`, so this 1,799-line screen keeps every
 * feature — filters, sorting, detail drawer, pagination — and starts showing
 * real competencies. Only this line moved.
 *
 * The /skill_library routes are LEFT IN PLACE. Skill management has no other
 * home, and silently orphaning it would be invisible until someone needed to
 * add a skill.
 */
const BASE = '/competency-library'

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

  /**
   * One competency's L1–L5 scale — what each level actually means.
   *
   * Always five rows, authored or not: the scale has five levels regardless of
   * how many anyone has described. `is_authored` says whether this competency
   * overrides the organisation default, and `default_descriptor` carries what
   * it inherits.
   *
   * Read-only here, and read on demand: the employee drawer fetches it when a
   * competency is expanded, so "L2 versus L3" reads as a difference in
   * behaviour rather than two numbers.
   */
  getLevels: (context: LaravelContext, competencyId: number) =>
    apiClient.get<{ status: number; data: { levels: CompetencyProficiencyLevel[] } }>(
      `${BASE}/competency/${competencyId}/levels`,
      withLaravelParams(context),
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
