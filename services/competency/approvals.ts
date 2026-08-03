/**
 * Competency approval queue service.
 *
 * One inbox for everything in M2 that needs a second pair of eyes:
 *   GET  /competency/approvals                  - queue + counts (status, subject_type)
 *   POST /competency/approvals                  - submit a competency / framework
 *   PUT  /competency/approvals/{id}             - approve | reject (with note)
 *   POST /competency/approvals/bulk-approve     - approve many
 *   GET  /competency/approvals/for/{type}/{id}  - one subject's approval trail
 *
 * Role-mapping reviews predate this and keep their own endpoints; the queue
 * unions them in for reading so the inbox is complete.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

export interface ApprovalApiResponse<T> {
  status: number
  message: string
  data: T
}

export interface ApprovalCounts {
  pending: number
  approved: number
  rejected: number
}

export interface ApprovalListResponse<T> extends ApprovalApiResponse<T> {
  counts: ApprovalCounts
}

/** What can be sent for approval. `role-mapping` is read-only in this queue. */
export type ApprovalSubjectType = 'competency' | 'framework' | 'role-mapping'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface ApprovalRequest {
  id: number
  /** 'approval' rows are actionable here; 'mapping-review' rows act via their own screen. */
  source: 'approval' | 'mapping-review'
  subject_type: ApprovalSubjectType
  subject_id: number
  subject_name: string | null
  status: ApprovalStatus
  note: string | null
  submitted_by_name: string | null
  submitted_at: string | null
  reviewer_name: string | null
  reviewed_at: string | null
  /** Only mapping reviews carry this. */
  changes_count: number | null
}

/** One entry in a subject's approval trail. */
export interface ApprovalTrailEntry {
  id: number
  status: ApprovalStatus
  note: string | null
  submitted_by_name: string | null
  submitted_at: string | null
  reviewer_name: string | null
  reviewed_at: string | null
}

export interface ApprovalListParams {
  status?: ApprovalStatus
  subject_type?: ApprovalSubjectType
}

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

const BASE = '/competency/approvals'

export const competencyApprovalService = {
  list: (context: LaravelContext, params?: ApprovalListParams) =>
    apiClient.get<ApprovalListResponse<ApprovalRequest[]>>(
      BASE,
      withLaravelParams(context, toStringParams({ ...params })),
    ),

  /** Moves the subject to its unpublished state and queues it. */
  submit: (
    context: LaravelContext,
    payload: { subject_type: 'competency' | 'framework'; subject_id: number; note?: string },
  ) =>
    apiClient.post<ApprovalApiResponse<{ subject_id: number }>>(BASE, {
      ...withLaravelParams(context),
      ...payload,
    }),

  /** Approving publishes the subject; rejecting leaves it unpublished with the note. */
  decide: (context: LaravelContext, id: number, decision: 'approve' | 'reject', note?: string) =>
    apiClient.put<ApprovalApiResponse<{ id: number }>>(`${BASE}/${id}`, {
      ...withLaravelParams(context),
      decision,
      ...(note ? { note } : {}),
    }),

  bulkApprove: (context: LaravelContext, ids?: number[]) =>
    apiClient.post<ApprovalApiResponse<{ approved: number }>>(`${BASE}/bulk-approve`, {
      ...withLaravelParams(context),
      ...(ids?.length ? { ids } : {}),
    }),

  trail: (context: LaravelContext, subjectType: 'competency' | 'framework', subjectId: number) =>
    apiClient.get<ApprovalApiResponse<ApprovalTrailEntry[]>>(
      `${BASE}/for/${subjectType}/${subjectId}`,
      withLaravelParams(context),
    ),
}
