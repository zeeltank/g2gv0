/**
 * LMS Assignment Service
 *
 * Backed by the Laravel endpoints:
 *   - App\Http\Controllers\lms\assignment\assignmentController
 *
 * Every call carries the standard Laravel context (token, sub_institute_id,
 * syear, user_id, type=API) via withLaravelParams, exactly like the dashboard
 * service.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

/* ------------------------------------------------------------------ *
 * Response envelope
 * ------------------------------------------------------------------ */

export interface AssignmentApiResponse<T> {
  status: boolean
  message?: string
  data: T
}

/* ------------------------------------------------------------------ *
 * Data shapes
 * ------------------------------------------------------------------ */

export interface LmsAssignment {
  id: number
  learner_name: string
  initials: string
  course_name: string
  type: string
  assignment_type: string
  due_date: string | null
  status: string
  progress: number
  assigned_by: string
  assigned_on: string
}

export interface AssignmentStats {
  total_assigned: number
  in_progress: number
  completed: number
  overdue: number
  pending_approval: number
}

export interface CreateAssignmentPayload {
  user_ids: number[]
  course_id: number
  assignment_type: string
  due_date?: string
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function params(context: LaravelContext, extra?: Record<string, string>) {
  return withLaravelParams(context, extra) as Record<string, string>
}

/* ------------------------------------------------------------------ *
 * Service
 * ------------------------------------------------------------------ */

export const assignmentService = {
  /** GET /api/lmsAssignment — list all assignments for this tenant. */
  getAssignments: (context: LaravelContext, filters?: { search?: string }) =>
    apiClient.get<AssignmentApiResponse<LmsAssignment[]>>(
      '/lmsAssignment',
      params(context, {
        ...(filters?.search ? { search: filters.search } : {}),
      }),
    ),

  /** GET /api/lmsAssignment/stats — KPI stats for this tenant. */
  getStats: (context: LaravelContext) =>
    apiClient.get<AssignmentApiResponse<AssignmentStats>>(
      '/lmsAssignment/stats',
      params(context),
    ),

  /** POST /api/lmsAssignment — assign courses to users. */
  createAssignments: (context: LaravelContext, payload: CreateAssignmentPayload) =>
    apiClient.post<AssignmentApiResponse<unknown>>('/lmsAssignment', {
      ...params(context),
      ...payload,
    }),

  /** POST /api/lmsAssignment/updateStatus/{id} — update a single assignment. */
  updateStatus: (context: LaravelContext, id: number, status: string) =>
    apiClient.post<AssignmentApiResponse<unknown>>(
      `/lmsAssignment/updateStatus/${id}`,
      { ...params(context), status },
    ),

  /** POST /api/lmsAssignment/bulkUpdateStatus — batch status update. */
  bulkUpdateStatus: (context: LaravelContext, ids: number[], status: string) =>
    apiClient.post<AssignmentApiResponse<unknown>>(
      '/lmsAssignment/bulkUpdateStatus',
      { ...params(context), ids, status },
    ),
}

/* ------------------------------------------------------------------ *
 * Learner picker + CSV import
 * ------------------------------------------------------------------ */

export interface AssignmentLearner {
  id: number
  employee_no: string | null
  email: string | null
  name: string
}

export interface ImportRowError {
  line: number
  message: string
}

export interface ImportResult {
  imported: number
  skipped: number
  errors: ImportRowError[]
}

export const assignmentPickerService = {
  /** GET /api/lmsAssignment/learners — learners in this tenant, for the picker. */
  searchLearners: (context: LaravelContext, search: string) =>
    apiClient.get<AssignmentApiResponse<AssignmentLearner[]>>(
      '/lmsAssignment/learners',
      params(context, { ...(search ? { search } : {}), limit: '50' }),
    ),

  /**
   * POST /api/lmsAssignment/import — bulk-create from a CSV.
   *
   * Strict by default: if any row fails, nothing is written and every failing
   * line is reported. Pass skipInvalid to import the good rows regardless.
   */
  importCsv: (context: LaravelContext, file: File, skipInvalid: boolean) => {
    const form = new FormData()
    Object.entries(params(context)).forEach(([key, value]) => form.append(key, value))
    form.append('file', file)
    form.append('skip_invalid', skipInvalid ? '1' : '0')

    return apiClient.postForm<AssignmentApiResponse<ImportResult>>(
      '/lmsAssignment/import',
      form,
    )
  },
}

/* ------------------------------------------------------------------ *
 * Approvals + enrollments
 * ------------------------------------------------------------------ */

export type ApprovalStatus = 'approved' | 'pending' | 'rejected'

/** A learner-initiated enrolment from lms_course_enroll — not an assignment. */
export interface CourseEnrollment {
  id: number
  course_id: number
  user_id: number
  learner_name: string
  employee_no: string | null
  course_name: string | null
  type: string | null
  status: string | null
  start_date: string | null
  end_date: string | null
  enrolled_on: string | null
  initials: string
}

export interface ReviewResult {
  affected: number
  skipped: number
}

export const assignmentApprovalService = {
  /**
   * GET /api/lmsAssignment?approval_status=pending — the approval queue.
   * The default list returns approved rows only, so a pending request never
   * shows up as an active assignment.
   */
  getPending: (context: LaravelContext) =>
    apiClient.get<AssignmentApiResponse<LmsAssignment[]>>(
      '/lmsAssignment',
      params(context, { approval_status: 'pending' }),
    ),

  /** POST /api/lmsAssignment/review/{id} — approve or reject one request. */
  review: (
    context: LaravelContext,
    id: number,
    decision: 'approved' | 'rejected',
    profileName?: string,
    note?: string,
  ) =>
    apiClient.post<AssignmentApiResponse<unknown>>(`/lmsAssignment/review/${id}`, {
      ...params(context, profileName ? { user_profile_name: profileName } : undefined),
      decision,
      ...(note ? { review_note: note } : {}),
    }),

  /** POST /api/lmsAssignment/bulkReview — decide on several at once. */
  bulkReview: (
    context: LaravelContext,
    ids: number[],
    decision: 'approved' | 'rejected',
    profileName?: string,
  ) =>
    apiClient.post<AssignmentApiResponse<ReviewResult>>('/lmsAssignment/bulkReview', {
      ...params(context, profileName ? { user_profile_name: profileName } : undefined),
      ids,
      decision,
    }),

  /** GET /api/lmsAssignment/enrollments — learner-initiated enrolments. */
  getEnrollments: (context: LaravelContext, search?: string) =>
    apiClient.get<AssignmentApiResponse<CourseEnrollment[]>>(
      '/lmsAssignment/enrollments',
      params(context, { ...(search ? { search } : {}), limit: '200' }),
    ),
}
