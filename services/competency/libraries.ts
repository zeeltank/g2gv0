/**
 * Libraries & Taxonomy service.
 *
 * Backs the eight library tabs the competency module owns - Skill, Job Role,
 * Job Role Task, Knowledge, Ability, Attitude, Behaviour and Invisible - plus
 * the taxonomy editors and the skill taxonomy tree.
 *
 * Laravel side (all token + tenant scoped via withLaravelParams):
 *   GET    /competency/library/meta                     - shared dropdown options + tab counts
 *   GET    /competency/library/skill-taxonomy-tree      - category > sub-category > skill tree
 *   GET    /competency/library/{resource}               - paginated list (filters + sort)
 *   POST   /competency/library/{resource}               - create
 *   GET    /competency/library/{resource}/{id}          - single row (+ associations)
 *   PUT    /competency/library/{resource}/{id}          - update
 *   DELETE /competency/library/{resource}/{id}          - delete (soft where supported)
 *   POST   /competency/library/invisible/{id}/clone     - copy a shared entry into this tenant
 *   GET/POST/PUT/DELETE /competency/library/taxonomy/{type}
 *
 * `{resource}` is skills | jobroles | jobrole-tasks | kasa/{knowledge|ability|attitude|behaviour}
 * | invisible, so one set of types covers every tab.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

export interface LibraryApiResponse<T> {
  status: number
  message: string
  data: T
}

export interface LibraryPagination {
  page: number
  per_page: number
  total: number
  last_page: number
}

export interface LibraryListResponse<T> extends LibraryApiResponse<T> {
  pagination: LibraryPagination
}

/* ------------------------------------------------------------------ *
 * Tab identity
 * ------------------------------------------------------------------ */

export type LibraryTabId =
  | 'skill'
  | 'jobrole'
  | 'jobrole-task'
  | 'knowledge'
  | 'ability'
  | 'attitude'
  | 'behaviour'
  | 'invisible'

/** The four KASA tabs share one endpoint that takes the attribute as a segment. */
export const KASA_TABS = ['knowledge', 'ability', 'attitude', 'behaviour'] as const
export type KasaTabId = (typeof KASA_TABS)[number]

export function isKasaTab(tab: LibraryTabId): tab is KasaTabId {
  return (KASA_TABS as readonly string[]).includes(tab)
}

/** Tabs whose categories this tenant may edit (Invisible is platform-curated). */
export const TAXONOMY_TABS: LibraryTabId[] = [
  'skill',
  'jobrole',
  'jobrole-task',
  'knowledge',
  'ability',
  'attitude',
  'behaviour',
]

const BASE = '/competency/library'

/** Map a tab to its endpoint path segment. */
function pathFor(tab: LibraryTabId): string {
  if (isKasaTab(tab)) return `${BASE}/kasa/${tab}`
  if (tab === 'skill') return `${BASE}/skills`
  if (tab === 'jobrole') return `${BASE}/jobroles`
  if (tab === 'jobrole-task') return `${BASE}/jobrole-tasks`
  return `${BASE}/invisible`
}

/* ------------------------------------------------------------------ *
 * Row shapes
 * ------------------------------------------------------------------ */

/**
 * Library rows come straight off their table, so the columns differ per tab.
 * The shared keys every tab renders are typed; the rest stay indexable so a
 * detail panel can show a column without a per-tab interface.
 */
export interface LibraryRow {
  id: number
  sub_institute_id?: number | null
  created_at?: string | null
  updated_at?: string | null
  [column: string]: unknown
}

export interface SkillRow extends LibraryRow {
  title: string
  description: string | null
  category: string | null
  sub_category: string | null
  department: string | null
  proficiency_level: string | null
  approve_status: string | null
  competency_type: string | null
}

export interface JobroleRow extends LibraryRow {
  jobrole: string
  description: string | null
  department: string | null
  jobrole_category: string | null
  performance_expectation: string | null
  status: string | null
}

export interface JobroleTaskRow extends LibraryRow {
  task: string
  jobrole: string | null
  critical_work_function: string | null
  task_type: string | null
  task_category: string | null
}

export interface KasaRow extends LibraryRow {
  title: string
  description: string | null
  category: string | null
  sub_category: string | null
  assessment_method: string | null
  business_link: string | null
}

export interface InvisibleRow extends LibraryRow {
  type: string
  title: string
  description: string | null
  purpose: string | null
  when_to_use: string | null
  benefits: string | null
  limitations: string | null
  example_use_case: string | null
  tags: string | null
  difficulty_level: string | null
}

/* ------------------------------------------------------------------ *
 * Detail payloads
 * ------------------------------------------------------------------ */

export interface SkillJobroleLink {
  id: number
  jobrole: string
  proficiency_level: string | null
  proficiency_description: string | null
  track: string | null
  sector: string | null
}

export interface SkillProficiencyLevel {
  id: number
  proficiency_level: string | null
  description: string | null
  proficiency_type: string | null
  type_description: string | null
}

export interface SkillClassificationItem {
  id: number
  classification: string | null
  classification_category: string | null
  classification_sub_category: string | null
  classification_item: string | null
  proficiency_level: string | null
}

export interface SkillApplication {
  id: number
  application: string | null
  proficiency_level: string | null
}

export interface SkillDetail {
  record: SkillRow
  jobroles: SkillJobroleLink[]
  proficiency: SkillProficiencyLevel[]
  classification: Record<KasaTabId, SkillClassificationItem[]>
  applications: SkillApplication[]
}

export interface JobroleTaskLink {
  id: number
  critical_work_function: string | null
  task: string
  task_type: string | null
  task_category: string | null
}

export interface JobroleSkillLink {
  id: number
  skill: string
  proficiency_level: string | null
  proficiency_description: string | null
  type: string | null
}

/** A knowledge / ability / attitude / behaviour item mapped to a job role. */
export interface MappedAttribute {
  id: number
  title: string
  category: string | null
  sub_category: string | null
  description: string | null
}

export interface JobroleDetail {
  record: JobroleRow
  tasks: JobroleTaskLink[]
  skills: JobroleSkillLink[]
  /** From s_library_map — what the legacy job description screen listed. */
  kasa: Record<KasaTabId, MappedAttribute[]>
}

/** Every tab's show() answers at least this. */
export interface GenericDetail {
  record: LibraryRow
}

/* ------------------------------------------------------------------ *
 * Meta + taxonomy + tree
 * ------------------------------------------------------------------ */

export interface LibraryMeta {
  departments: string[]
  /** Second level below department, from both the skill and job role tables. */
  sub_departments: string[]
  /** Third taxonomy level, below category and sub category. */
  micro_categories: string[]
  industries: string[]
  jobroles_by_department: Record<string, { id: number; jobrole: string }[]>
  proficiency_levels: string[]
  invisible_types: string[]
  task_types: string[]
  counts: Record<LibraryTabId, number>
}

export interface TaxonomySubCategory {
  name: string
  total: number
}

export interface TaxonomyCategory {
  category: string
  total: number
  sub_categories: TaxonomySubCategory[]
}

export interface TaxonomyTree {
  type: string
  has_sub_level: boolean
  categories: TaxonomyCategory[]
}

export interface SkillTaxonomyLeaf {
  id: number
  name: string
  department: string | null
  proficiency_level: string | null
  approve_status: string | null
}

export interface SkillTaxonomyBranch {
  name: string
  total: number
  children: SkillTaxonomyLeaf[]
}

export interface SkillTaxonomyRoot {
  name: string
  total: number
  children: SkillTaxonomyBranch[]
}

export interface SkillTaxonomy {
  total_skills: number
  total_categories: number
  /** True when the 5000-row cap trimmed the tree, so the UI can say so. */
  truncated: boolean
  categories: SkillTaxonomyRoot[]
}

/* ------------------------------------------------------------------ *
 * Levels of responsibility (the ladder beside the job role taxonomy)
 * ------------------------------------------------------------------ */

export interface ResponsibilityAttribute {
  code: string | null
  name: string | null
  overall_description: string | null
  guidance_notes: string | null
  description: string | null
}

export interface ResponsibilityAttributeGroup {
  name: string
  attributes: ResponsibilityAttribute[]
}

export interface ResponsibilityLevel {
  level: string
  guiding_phrase: string | null
  essence: string | null
  guidance_notes: string | null
  groups: ResponsibilityAttributeGroup[]
}

/* ------------------------------------------------------------------ *
 * Request params
 * ------------------------------------------------------------------ */

export interface LibraryListParams {
  search?: string
  category?: string
  sub_category?: string
  /** Skill + Job Role tabs. */
  department?: string
  /** Skill tab: only skills mapped to this role. Job Role Task tab: that role's tasks. */
  jobrole?: string
  proficiency_level?: string
  approve_status?: string
  status?: string
  critical_work_function?: string
  task_type?: string
  difficulty_level?: string
  sort?: string
  direction?: 'asc' | 'desc'
  page?: number
  per_page?: number
}

/** A create/update body: plain column values, blank strings meaning "clear". */
export type LibraryPayload = Record<string, string | number | null | undefined>

export interface TaxonomyPayload {
  category: string
  sub_category?: string
  old_category?: string
  old_sub_category?: string
}

/** Drop blank params so an unset filter never reaches the query string. */
function toStringParams(input: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue
    const normalized = String(value).trim()
    if (normalized === '') continue
    out[key] = normalized
  }
  return out
}

export const competencyLibrariesService = {
  meta: (context: LaravelContext) =>
    apiClient.get<LibraryApiResponse<LibraryMeta>>(`${BASE}/meta`, withLaravelParams(context)),

  list: <T = LibraryRow>(context: LaravelContext, tab: LibraryTabId, params?: LibraryListParams) =>
    apiClient.get<LibraryListResponse<T[]>>(
      pathFor(tab),
      withLaravelParams(context, toStringParams({ ...params })),
    ),

  get: <T = GenericDetail>(context: LaravelContext, tab: LibraryTabId, id: number) =>
    apiClient.get<LibraryApiResponse<T>>(`${pathFor(tab)}/${id}`, withLaravelParams(context)),

  create: (context: LaravelContext, tab: LibraryTabId, payload: LibraryPayload) =>
    apiClient.post<LibraryApiResponse<{ id: number }>>(pathFor(tab), {
      ...withLaravelParams(context),
      ...payload,
    }),

  update: (context: LaravelContext, tab: LibraryTabId, id: number, payload: LibraryPayload) =>
    apiClient.put<LibraryApiResponse<{ id: number }>>(`${pathFor(tab)}/${id}`, {
      ...withLaravelParams(context),
      ...payload,
    }),

  remove: (context: LaravelContext, tab: LibraryTabId, id: number) =>
    apiClient.delete<LibraryApiResponse<{ id: number }>>(
      `${pathFor(tab)}/${id}`,
      withLaravelParams(context),
    ),

  /**
   * Copy a platform-curated Invisible entry into this tenant. Shared rows are
   * read-only, so this is how a tenant makes an editable version.
   */
  cloneInvisible: (context: LaravelContext, id: number, title?: string) =>
    apiClient.post<LibraryApiResponse<{ id: number; title: string }>>(
      `${BASE}/invisible/${id}/clone`,
      { ...withLaravelParams(context), ...(title ? { title } : {}) },
    ),

  taxonomy: (context: LaravelContext, tab: LibraryTabId) =>
    apiClient.get<LibraryApiResponse<TaxonomyTree>>(
      `${BASE}/taxonomy/${tab}`,
      withLaravelParams(context),
    ),

  createTaxonomy: (context: LaravelContext, tab: LibraryTabId, payload: TaxonomyPayload) =>
    apiClient.post<LibraryApiResponse<null>>(`${BASE}/taxonomy/${tab}`, {
      ...withLaravelParams(context),
      ...payload,
    }),

  renameTaxonomy: (context: LaravelContext, tab: LibraryTabId, payload: TaxonomyPayload) =>
    apiClient.put<LibraryApiResponse<{ affected: number }>>(`${BASE}/taxonomy/${tab}`, {
      ...withLaravelParams(context),
      ...payload,
    }),

  /** Only succeeds for an empty branch - the API refuses to orphan entries. */
  deleteTaxonomy: (context: LaravelContext, tab: LibraryTabId, category: string, subCategory?: string) =>
    apiClient.delete<LibraryApiResponse<null>>(
      `${BASE}/taxonomy/${tab}`,
      withLaravelParams(context, toStringParams({ category, sub_category: subCategory })),
    ),

  /**
   * Distinct critical work functions, optionally for one job role - the Job
   * Role Task tab's second drill-down level.
   */
  workFunctions: (context: LaravelContext, jobrole?: string) =>
    apiClient.get<LibraryApiResponse<string[]>>(
      `${BASE}/work-functions`,
      withLaravelParams(context, toStringParams({ jobrole })),
    ),

  /** Reference ladder shown beside the job role taxonomy. */
  levelsOfResponsibility: (context: LaravelContext) =>
    apiClient.get<LibraryApiResponse<ResponsibilityLevel[]>>(
      `${BASE}/levels-of-responsibility`,
      withLaravelParams(context),
    ),

  skillTaxonomyTree: (
    context: LaravelContext,
    params?: { search?: string; category?: string; department?: string },
  ) =>
    apiClient.get<LibraryApiResponse<SkillTaxonomy>>(
      `${BASE}/skill-taxonomy-tree`,
      withLaravelParams(context, toStringParams({ ...params })),
    ),
}
