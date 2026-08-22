/**
 * Employee Profile Service
 * Handles REST API integrations for Employee View Profile tabs
 */

import { apiClient, webClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { getLaravelContext, withLaravelParams } from '@/lib/laravel-context'

export interface EmployeeProfileFullResponse {
  status_code?: number | string
  status?: number | string
  message?: string
  data?: Record<string, any>
  jobroleSkills?: any[]
  skills?: any[]
  userRatedSkills?: any[]
  jobroleTasks?: any[]
  userLevelOfResponsibility?: Record<string, any>
  user_profiles?: any[]
  employees?: any[]
  documentTypeLists?: any[]
  documentLists?: any[]
  departments?: any[]
  jobroleList?: any[]
}

export async function fetchEmployeeProfile(
  id: string | number,
  context?: LaravelContext
): Promise<EmployeeProfileFullResponse> {
  const ctx = context || getLaravelContext()
  const params = withLaravelParams(ctx)
  return webClient.get<EmployeeProfileFullResponse>(`/user/add_user/${id}/edit`, params)
}

export async function updateEmployeeProfile(
  id: string | number,
  payload: Record<string, any>,
  context?: LaravelContext
): Promise<{ status?: string | number; message?: string }> {
  const ctx = context || getLaravelContext()
  const params = withLaravelParams(ctx)
  return webClient.post(`/user/add_user/${id}`, payload, { params })
}

export async function uploadEmployeeDocument(
  id: string | number,
  formData: FormData,
  context?: LaravelContext
): Promise<{ status?: string | number; message?: string }> {
  const ctx = context || getLaravelContext()
  const params = withLaravelParams(ctx)
  return webClient.post(`/user/user_document/${id}`, formData, { params })
}

export async function fetchCompetencyProfile(
  id: string | number,
  context?: LaravelContext
): Promise<any> {
  const ctx = context || getLaravelContext()
  const params = withLaravelParams(ctx)
  return apiClient.get(`/competency/employee-profiles/${id}`, params)
}

/*
 * fetchJobRoleKaba() WAS REMOVED HERE.
 *
 * It read GET /get-kaba, which walks `s_library_map` - a NAME-keyed side table
 * that is not the competency model - and it had exactly one caller: the
 * employee drawer's Competency Rating tab. That tab now reads
 * fetchKasbaRatings() below, which walks the real chain, so this had no callers
 * left.
 *
 * THE ENDPOINT ITSELF IS NOT RETIRED, and that is worth being precise about.
 * lib/ai/services/hp-api.ts still calls /get-kaba directly for the AI
 * generator's job-role skill lookup. So `s_library_map` still has a reader and
 * cannot be dropped - only this client of it is gone.
 */

/**
 * THE COMPETENCY CHAIN, which is what this tab was always meant to show.
 *
 * `fetchJobRoleKaba` above reads /get-kaba, which walks `s_library_map` — a
 * NAME-keyed side table that is not the competency model. This one walks the
 * real chain:
 *
 *   jobrole_competency_map -> competency_kasba_item -> competency
 *
 * and LEFT JOINs the employee's own ratings, so an unrated item comes back with
 * `rating: null`. That distinction is the point: /get-kaba defaults
 * proficiency_level to "5", which is what made every unassessed competency
 * render as full marks.
 *
 * It is tenant-scoped on both joined tables from the token, resolves the
 * employee's role through both the id column and the legacy text one, and says
 * honestly which of the two empty states it is in.
 */
export interface KasbaRatingItem {
  kasba_item_id: number
  kasba_type: string
  item_id: number | null
  item_label: string | null
  /** Resolved from the dimension's library when item_id is set, else item_label. */
  title: string | null
  /** The id points at a library row that no longer exists. Shown, not hidden. */
  title_missing: boolean
  competency_id: number
  competency_name: string | null
  /** What the ROLE requires. Never this person's score. */
  required_proficiency: number | null
  is_mandatory: number | boolean | null
  /** null means nobody has assessed them — not zero. */
  rating: number | null
  note: string | null
  rated_at: string | null
}

export interface KasbaRatingResponse {
  status: number
  data: {
    user_id: number
    jobrole_id: number | null
    items: KasbaRatingItem[]
    rated: number
    total: number
  }
  empty_is_expected: boolean
  empty_reason: string | null
  rating_range: { min: number; max: number }
}

export async function fetchKasbaRatings(
  userId: string | number,
  context?: LaravelContext,
): Promise<KasbaRatingResponse> {
  const ctx = context || getLaravelContext()
  return apiClient.get<KasbaRatingResponse>(
    '/competency/kasba-rating',
    withLaravelParams(ctx, { user_id: String(userId) }),
  )
}

/*
 * JobRoleNotMappedError WAS REMOVED HERE, with fetchJobRoleKaba that threw it.
 *
 * It existed to turn /get-kaba's 404 into "not mapped yet" rather than an error
 * card. The replacement endpoint does not need it: it answers 200 with
 * `empty_is_expected` and a reason naming WHICH empty it is - no job role, or a
 * role with no competencies mapped. An expected state is better as a field than
 * as an exception, because there are two of them and an exception only carries
 * one.
 */

export async function updateSkillRating(
  id: string | number,
  matrixId: number | string,
  level: number,
  context?: LaravelContext
): Promise<any> {
  const ctx = context || getLaravelContext()
  const params = withLaravelParams(ctx)
  return apiClient.put(`/competency/employee-profiles/${id}/skills/${matrixId}`, { proficiency_level: level }, { params })
}

/**
 * THE EMPLOYEE LIST — GET /competency/employee-profiles.
 *
 * Added because Employee Profiles took a `userId` prop and NOTHING COULD SUPPLY
 * ONE: the backend had show/{id} and no index, so HR always saw their own record.
 * Same shape of gap as the AI generator's job-role list.
 *
 * Tenant-scoped server-side from the token; guarded profile:admin,hr. An HR user
 * cannot list another organization's people, and an employee cannot call it.
 */
export interface EmployeeListItem {
  id: number
  first_name: string | null
  last_name: string | null
  email: string | null
  jobtitle_id: number | null
  jobrole: string | null
}

export async function fetchEmployeeList(
  context: LaravelContext,
  q?: string,
): Promise<{
  employees: EmployeeListItem[]
  shown: number
  total: number
  truncated: boolean
  empty_reason: string | null
}> {
  const res = await apiClient.get<{
    status: number
    data: { employees: EmployeeListItem[]; shown: number; total: number }
    truncated: boolean
    empty_reason: string | null
  }>(
    '/competency/employee-profiles',
    withLaravelParams(context, q ? { q } : {}),
  )

  return {
    ...res.data,
    truncated: res.truncated,
    empty_reason: res.empty_reason,
  }
}
