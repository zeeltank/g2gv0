import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'

/**
 * Shift Master's API client. Talks to /api/shifts (HRMS\ShiftController).
 *
 * Reads need a token; writes are HR/admin only on the server. Mutations throw
 * on a Laravel-level failure (status 0) so a refused save cannot look saved.
 */

export type Shift = {
  id: number
  name: string
  code: string | null
  /** "HH:mm". */
  start_time: string
  end_time: string
  /** End is not after start, so the shift runs past midnight. Set by the server. */
  is_overnight: boolean | number
  break_minutes: number
  grace_minutes: number
  color: string | null
  description: string | null
  /** 1 active, 0 inactive. */
  status: number
  /** How many employees are on it. Only on the list. */
  employee_count?: number
}

export type ShiftInput = {
  name: string
  code?: string
  start_time: string
  end_time: string
  break_minutes?: number
  grace_minutes?: number
  color?: string
  description?: string
  status: 0 | 1
}

type StatusResponse = { status?: number | string; message?: string }

async function ensureSuccess<T extends StatusResponse>(request: Promise<T>): Promise<T> {
  const response = await request
  if (String(response.status) === '0') {
    throw new Error(response.message || 'The request was refused.')
  }
  return response
}

function baseParams(context: LaravelContext) {
  return {
    sub_institute_id: context.subInstituteId,
    ...(context.token ? { type: 'api', token: context.token } : {}),
  }
}

export const shiftService = {
  list: (context: LaravelContext) =>
    apiClient.get<{ status: number; data: Shift[] }>('/shifts', baseParams(context)),

  create: (context: LaravelContext, payload: ShiftInput) =>
    ensureSuccess(
      apiClient.post<StatusResponse & { data: Shift }>('/shifts', payload, { params: baseParams(context) }),
    ),

  update: (context: LaravelContext, id: number, payload: ShiftInput) =>
    ensureSuccess(
      apiClient.put<StatusResponse & { data: Shift }>(`/shifts/${id}`, payload, { params: baseParams(context) }),
    ),

  /** Put a selection of employees on one (active) shift. Admin/HR only. */
  assign: (context: LaravelContext, shiftId: number, employeeIds: number[]) =>
    ensureSuccess(
      apiClient.post<StatusResponse & { updated: number }>(
        '/shifts/assign',
        { shift_id: shiftId, employee_ids: employeeIds },
        { params: baseParams(context) },
      ),
    ),

  remove: (context: LaravelContext, id: number) =>
    ensureSuccess(apiClient.delete<StatusResponse>(`/shifts/${id}`, baseParams(context))),
}
