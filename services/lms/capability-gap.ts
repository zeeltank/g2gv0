/**
 * Capability Gap Inbox — HR/Admin side of auto course assignment.
 *
 * Backed by `App\Http\Controllers\Api\Competency\CapabilityCourseRequestController`,
 * gated `profile:admin,hr`. One row per (tenant, competency) that the reactor
 * could not auto-assign a course for — NEVER one row per employee and NEVER
 * one row per event: re-raising the same gap on a later rating tick bumps
 * `times_seen` / `last_seen_at` on the existing row rather than creating a new
 * one, and the row self-resolves to `superseded` once nobody is affected any
 * more. Dismiss is one way out, not the only way out.
 *
 * `GET /competency/course-map` + `POST /competency/course-map` (the "map an
 * existing course" action) already exist in
 * `services/competency/course-competencies.ts` — this module does not
 * duplicate them. Reuse `courseCompetenciesService.list` to fetch a course's
 * CURRENT full mapping before appending to it: that POST is a destructive
 * sync of the whole set, not an append.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

export interface CapabilityGapApiResponse<T> {
  status: number
  message?: string
  data: T
}

/**
 * `open`            needs a course mapped — the row HR actually has to act on.
 * `course_created`  resolved: a course was mapped and everyone waiting got assigned.
 * `dismissed`       HR said no, with a reason.
 * `superseded`      resolved itself: every affected rating rose past the requirement.
 */
export type CapabilityCourseRequestStatus = 'open' | 'course_created' | 'dismissed' | 'superseded'

export interface CapabilityCourseRequestRow {
  id: number
  competency_id: number
  competency_name: string
  jobrole_id: number
  jobrole_name?: string | null
  required_proficiency: number
  is_mandatory: boolean
  /** How many employees currently sit below the requirement on this competency. */
  affected_count: number
  status: CapabilityCourseRequestStatus
  created_course_id: number | null
  dismissed_reason: string | null
  dismissed_at: string | null
  days_pending: number
  first_raised_at: string
  last_seen_at: string
  /** Re-raises on the SAME (tenant, competency) row, not a count of new rows. */
  times_seen: number
  /** Only present where the API has enough rows loaded to compute it — degrade gracefully. */
  department?: string | null
}

export interface CapabilityCourseRequestListResponse {
  status: number
  data: CapabilityCourseRequestRow[]
  /** True when an empty list is the expected state, not evidence of a failed fetch. */
  empty_is_expected: boolean
}

export interface CapabilityCourseRequestQuery {
  /** Omit, or 'all', for every status. */
  status?: CapabilityCourseRequestStatus | 'all'
  competencyId?: number
  jobroleId?: number
  mandatoryOnly?: boolean
}

export interface CapabilityGapSummary {
  needs_action: number
  auto_assigned: number
  dismissed: number
  superseded: number
  people_affected: number
  avg_days_pending: number
}

/**
 * The FULL tenant catalog a filter may offer — never narrowed to whatever
 * happens to be in the currently-loaded list of requests. Departments and
 * competencies are the tenant's complete set (either could have a request
 * tomorrow); job roles are scoped to ones that actually carry a competency
 * requirement, since a role with none defined can never raise one.
 */
export interface CapabilityGapFilterOptions {
  departments: string[]
  competencies: { id: number; name: string }[]
  jobroles: { id: number; name: string }[]
}

export interface CapabilityAffectedEmployee {
  user_id: number
  name: string
  department: string | null
  required_proficiency: number
  measured_level: number | null
  gap: number | null
  added_at: string
}

export interface CapabilityCourseRequestDetail extends CapabilityCourseRequestRow {
  /** Sorted by gap descending — worst gap first. */
  affected: CapabilityAffectedEmployee[]
}

function params(context: LaravelContext, extra?: Record<string, string>) {
  return withLaravelParams(context, extra) as Record<string, string>
}

function clean(extra: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(extra).filter(([, value]) => value !== undefined && value !== ''),
  ) as Record<string, string>
}

const BASE = '/competency/course-requests'

export const capabilityGapInboxService = {
  /** GET /competency/course-requests */
  list: (context: LaravelContext, query: CapabilityCourseRequestQuery = {}) =>
    apiClient.get<CapabilityCourseRequestListResponse>(
      BASE,
      params(
        context,
        clean({
          status: query.status,
          competency_id: query.competencyId ? String(query.competencyId) : undefined,
          jobrole_id: query.jobroleId ? String(query.jobroleId) : undefined,
          mandatory_only: query.mandatoryOnly ? '1' : undefined,
        }),
      ),
    ),

  /** GET /competency/course-requests/summary — the 5 KPI numbers for the header strip. */
  summary: (context: LaravelContext) =>
    apiClient.get<CapabilityGapApiResponse<CapabilityGapSummary>>(
      `${BASE}/summary`,
      params(context),
    ),

  /** GET /competency/course-requests/filter-options — the full tenant catalog. */
  filterOptions: (context: LaravelContext) =>
    apiClient.get<CapabilityGapApiResponse<CapabilityGapFilterOptions>>(
      `${BASE}/filter-options`,
      params(context),
    ),

  /** GET /competency/course-requests/{id} — the drawer payload, with affected employees. */
  get: (context: LaravelContext, id: number) =>
    apiClient.get<CapabilityGapApiResponse<CapabilityCourseRequestDetail>>(
      `${BASE}/${id}`,
      params(context),
    ),

  /** POST /competency/course-requests/{id}/dismiss — reason is required server-side. */
  dismiss: (context: LaravelContext, id: number, reason: string) =>
    apiClient.post<CapabilityGapApiResponse<null>>(`${BASE}/${id}/dismiss`, {
      ...params(context),
      reason,
    }),

  /** POST /competency/course-requests/{id}/reopen — un-dismiss, or un-supersede. */
  reopen: (context: LaravelContext, id: number) =>
    apiClient.post<CapabilityGapApiResponse<null>>(`${BASE}/${id}/reopen`, {
      ...params(context),
    }),
}
