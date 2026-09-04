/**
 * Learning Catalog Service
 *
 * Every call goes to the token-authenticated /api/lms/courses endpoints
 * (App\Http\Controllers\Api\LmsCourseController).
 *
 * Create deliberately does NOT reuse /school_setup/master_setup, which is what
 * the previous frontend posted to: it is a web route, and Laravel's CSRF guard
 * rejects a cross-origin POST with 419 (the csrf `except` list matches request
 * paths, so its localhost entries never apply). The API endpoint reimplements
 * the same rules - tenant-owned department, unique display_name + standard_id,
 * DigitalOcean image upload - over a transport the browser can use.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

export interface CatalogApiResponse<T> {
  status: boolean
  message?: string
  data: T
}

export interface CatalogListMeta {
  page: number
  per_page: number
  total: number
  last_page: number
}

export interface CatalogListResponse {
  status: boolean
  data: CatalogCourse[]
  meta: CatalogListMeta
}

/**
 * A catalogue row.
 *
 * `status` is sub_std_map's 0/1 flag - this schema has no draft/archived state.
 * `learners` / `completion_rate` are derived from lms_course_enroll by the API;
 * they are not stored columns.
 */
export interface CatalogCourse {
  id: number
  display_name: string | null
  display_image: string | null
  subject_category: string | null
  subject_type: string | null
  subject_code: string | null
  short_name: string | null
  jobrole: string | null
  proficiency: string | null
  sort_order: number | null
  /** Months a certificate stays valid; null = never expires. */
  certificate_validity_months: number | null
  status: number
  standard_id: number | null
  standard_name: string | null
  created_at: string | null
  updated_at: string | null
  learners: number
  completed_learners: number
  completion_rate: number
}

/** GET /api/lms/courses/{id} returns the whole row plus the chapter count. */
export interface CatalogCourseDetail extends CatalogCourse {
  subject_id: number | null
  allow_grades: string | null
  allow_content: string | null
  elective_subject: string | null
  add_content: string | null
  content_quantity: number | null
  chapter_count: number
}

export interface CatalogKpis {
  total_courses: number
  active_courses: number
  inactive_courses: number
  categories: number
  total_learners: number
  total_enrolments: number
  avg_completion_rate: number
}

/** Same-named departments exist; course_count is what tells them apart. */
export interface CatalogDepartment {
  id: number
  department: string
}

/** A real job role from `s_user_jobrole`, not a string somebody once typed. */
export interface CatalogJobRole {
  id: number
  jobrole: string
  department_id: number | null
}

export interface CatalogFilterOptions {
  categories: string[]
  subject_types: string[]
  /**
   * DISTINCT sub_std_map.jobrole - free text previously typed into the course
   * form itself. Empty on a fresh tenant, and it propagates typos. Kept only
   * for the legacy free-text datalist; prefer `job_roles`.
   */
  jobroles: string[]
  /**
   * The organisation's actual roles, from the same table the task-assignment
   * cascade reads. On tenant 3 that is 332 roles against 45 typed strings.
   */
  job_roles: CatalogJobRole[]
  departments: CatalogDepartment[]
  /** From config('lms.languages') — server-controlled, not hardcoded in the UI. */
  languages: string[]
  /** From config('lms.certificate_templates'); `view` is not exposed. */
  certificate_templates: { value: string; label: string }[]
}

export type CatalogSortBy =
  | 'title'
  | 'category'
  | 'type'
  | 'status'
  | 'learners'
  | 'completion'
  | 'updated_at'

export type CatalogSortDir = 'asc' | 'desc'

export interface CatalogFilters {
  search?: string
  category?: string
  subjectType?: string
  /** 1 = active, 0 = inactive, undefined = any. */
  status?: number
  jobrole?: string
  sortBy?: CatalogSortBy
  sortDir?: CatalogSortDir
  page?: number
  perPage?: number
}

/** Fields the catalog may write. subject_id and tenant are not editable. */
export interface CourseUpdatePayload {
  display_name: string
  standard_id: number
  subject_category?: string | null
  subject_code?: string | null
  subject_type?: string | null
  short_name?: string | null
  jobrole?: string | null
  proficiency?: string | null
  sort_order?: number | null
  certificate_validity_months?: number | null
  status: number
}

/** Create goes to master_setup as multipart, so the image can ride along. */
export interface CourseCreatePayload extends CourseUpdatePayload {
  display_image?: File | null
}

export type CatalogBulkAction = 'activate' | 'deactivate' | 'delete'

export interface CatalogBulkResult {
  affected: number
  ids: number[]
  skipped: number
}

function params(context: LaravelContext, extra?: Record<string, string>) {
  return withLaravelParams(context, extra) as Record<string, string>
}

/** Only send filter params that are actually set - Laravel treats '' as a value. */
function listParams(context: LaravelContext, filters: CatalogFilters) {
  const extra: Record<string, string> = {
    page: String(filters.page ?? 1),
    per_page: String(filters.perPage ?? 10),
    sort_by: filters.sortBy ?? 'updated_at',
    sort_dir: filters.sortDir ?? 'desc',
  }

  if (filters.search?.trim()) extra.search = filters.search.trim()
  if (filters.category) extra.category = filters.category
  if (filters.subjectType) extra.subject_type = filters.subjectType
  if (filters.jobrole) extra.jobrole = filters.jobrole
  if (filters.status !== undefined) extra.status = String(filters.status)

  return params(context, extra)
}

export const lmsCatalogService = {
  /** GET /api/lms/courses */
  getCourses: (context: LaravelContext, filters: CatalogFilters = {}) =>
    apiClient.get<CatalogListResponse>('/lms/courses', listParams(context, filters)),

  /** GET /api/lms/courses/kpis */
  getKpis: (context: LaravelContext) =>
    apiClient.get<CatalogApiResponse<CatalogKpis>>('/lms/courses/kpis', params(context)),

  /** GET /api/lms/courses/filters - the distinct values present in this tenant. */
  getFilterOptions: (context: LaravelContext) =>
    apiClient.get<CatalogApiResponse<CatalogFilterOptions>>(
      '/lms/courses/filters',
      params(context),
    ),

  /** GET /api/lms/courses/{id} */
  getCourse: (context: LaravelContext, id: number) =>
    apiClient.get<CatalogApiResponse<CatalogCourseDetail>>(`/lms/courses/${id}`, params(context)),

  /** PUT /api/lms/courses/{id} */
  updateCourse: (context: LaravelContext, id: number, payload: CourseUpdatePayload) =>
    apiClient.put<CatalogApiResponse<CatalogCourse>>(`/lms/courses/${id}`, {
      ...params(context),
      ...payload,
    }),

  /** DELETE /api/lms/courses/{id} - soft delete, scoped to the tenant. */
  deleteCourse: (context: LaravelContext, id: number) =>
    apiClient.delete<CatalogApiResponse<{ id: number }>>(`/lms/courses/${id}`, params(context)),

  /** POST /api/lms/courses/bulk */
  bulkAction: (context: LaravelContext, action: CatalogBulkAction, ids: number[]) =>
    apiClient.post<CatalogApiResponse<CatalogBulkResult>>('/lms/courses/bulk', {
      ...params(context),
      action,
      ids,
    }),

  /**
   * POST /api/lms/courses
   *
   * Multipart so the cover image can ride along. This does NOT post to
   * /school_setup/master_setup - that is a web route, and Laravel's CSRF guard
   * answers a cross-origin POST with 419 (verified). The API route applies the
   * same rules over a transport the browser can actually use.
   */
  createCourse: (context: LaravelContext, payload: CourseCreatePayload) => {
    const form = new FormData()

    Object.entries(params(context)).forEach(([key, value]) => {
      form.append(key, value)
    })

    form.append('display_name', payload.display_name)
    form.append('standard_id', String(payload.standard_id))
    form.append('status', String(payload.status))
    form.append('sort_order', String(payload.sort_order ?? 1))
    if (payload.certificate_validity_months) {
      form.append('certificate_validity_months', String(payload.certificate_validity_months))
    }
    form.append('subject_category', payload.subject_category ?? '')
    form.append('subject_code', payload.subject_code ?? '')
    form.append('subject_type', payload.subject_type ?? '')
    form.append('short_name', payload.short_name ?? '')
    form.append('jobrole', payload.jobrole ?? '')

    if (payload.display_image) {
      form.append('display_image', payload.display_image)
    }

    return apiClient.postForm<CatalogApiResponse<CatalogCourse> & { course_id: number }>(
      '/lms/courses',
      form,
    )
  },
}
