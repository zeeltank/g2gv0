/**
 * Sessions & Calendar Service
 *
 * Backed by /api/lms/sessions/* (App\Http\Controllers\Api\LmsSessionController).
 *
 * Sessions are rows in lms_virtual_classroom — the only table carrying
 * event_date plus from_time/to_time/url. lms/virtual_classroom_master exposes
 * the same table but is a Blade route behind the session middleware and
 * CSRF-blocked cross-origin, so the API equivalent is used here.
 *
 * Seat status is derived server-side from live registrations, never stored, so
 * it cannot drift from the actual attendee count.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

export interface SessionApiResponse<T> {
  status: boolean
  message?: string
  data: T
}

export type SessionType = 'virtual' | 'classroom'
export type SeatStatus = 'open' | 'almost-full' | 'full' | 'closed'
export type RegistrationStatus = 'registered' | 'attended' | 'cancelled' | 'no-show'

export interface TrainingSession {
  id: number
  room_name: string | null
  session_type: SessionType | null
  description: string | null
  notes: string | null
  trainer_name: string | null
  trainer_email: string | null
  venue: string | null
  /** Null means uncapped — seat status then stays 'open'. */
  seats_total: number | null
  event_date: string | null
  from_time: string | null
  to_time: string | null
  url: string | null
  status: string | null
  subject_id: number | null
  standard_id: number | null
  registered_count: number
  seats_available: number | null
  seat_status: SeatStatus
  is_past: boolean
  is_registered: boolean
  my_registration_status: RegistrationStatus | null
}

export interface SessionStats {
  upcoming_sessions: number
  total_registrations: number
  open_sessions: number
  full_sessions: number
  sessions_this_month: number
}

export interface SessionAttendee {
  id: number
  user_id: number
  learner_name: string
  employee_no: string | null
  email: string | null
  status: RegistrationStatus
  registered_at: string | null
}

export interface SessionListResponse {
  status: boolean
  data: TrainingSession[]
  meta: { from: string; to: string }
}

/** Fields the session form writes. Times are H:i; the API rejects to <= from. */
export interface SessionPayload {
  room_name: string
  session_type: SessionType
  description?: string | null
  notes?: string | null
  trainer_name?: string | null
  trainer_email?: string | null
  venue?: string | null
  seats_total?: number | null
  event_date: string
  from_time: string
  to_time: string
  url?: string | null
  subject_id?: number | null
}

/**
 * A whole-day marker drawn in the calendar's day header.
 *
 * Neither source carries a time — a course deadline is an end_date and a
 * calendar event is a school_date — so these never occupy an hour slot.
 * `learner_name` is only set for course deadlines, and only populated when an
 * admin is viewing (a learner sees just their own).
 */
export interface CalendarDeadline {
  date: string
  title: string | null
  user_id: number | null
  learner_name: string | null
  kind: 'course-deadline' | 'event'
}

function params(
  context: LaravelContext,
  profileName?: string,
  extra?: Record<string, string>,
) {
  return withLaravelParams(context, {
    ...(profileName ? { user_profile_name: profileName } : {}),
    ...extra,
  }) as Record<string, string>
}

export const lmsSessionService = {
  /** GET /api/lms/sessions — sessions in a date window, with my registration state. */
  list: (context: LaravelContext, from: string, to: string, search?: string) =>
    apiClient.get<SessionListResponse>(
      '/lms/sessions',
      params(context, undefined, { from, to, ...(search ? { search } : {}) }),
    ),

  /** GET /api/lms/sessions/stats */
  stats: (context: LaravelContext) =>
    apiClient.get<SessionApiResponse<SessionStats>>('/lms/sessions/stats', params(context)),

  /** GET /api/lms/sessions/deadlines — whole-day markers to overlay on the grid. */
  deadlines: (context: LaravelContext, from: string, to: string) =>
    apiClient.get<SessionApiResponse<CalendarDeadline[]>>(
      '/lms/sessions/deadlines',
      params(context, undefined, { from, to }),
    ),

  /** GET /api/lms/sessions/{id}/attendees */
  attendees: (context: LaravelContext, sessionId: number) =>
    apiClient.get<SessionApiResponse<SessionAttendee[]>>(
      `/lms/sessions/${sessionId}/attendees`,
      params(context),
    ),

  create: (context: LaravelContext, payload: SessionPayload, profileName?: string) =>
    apiClient.post<SessionApiResponse<TrainingSession>>('/lms/sessions', {
      ...params(context, profileName),
      ...payload,
    }),

  update: (context: LaravelContext, id: number, payload: SessionPayload, profileName?: string) =>
    apiClient.put<SessionApiResponse<TrainingSession>>(`/lms/sessions/${id}`, {
      ...params(context, profileName),
      ...payload,
    }),

  remove: (context: LaravelContext, id: number, profileName?: string) =>
    apiClient.delete<SessionApiResponse<{ id: number }>>(
      `/lms/sessions/${id}`,
      params(context, profileName),
    ),

  /**
   * POST /api/lms/sessions/{id}/register — take a seat.
   * Omit learnerId to register yourself; passing one is an admin action.
   */
  register: (context: LaravelContext, id: number, learnerId?: number, profileName?: string) =>
    apiClient.post<SessionApiResponse<unknown>>(`/lms/sessions/${id}/register`, {
      ...params(context, profileName),
      ...(learnerId ? { learner_id: learnerId } : {}),
    }),

  /** DELETE /api/lms/sessions/{id}/register — give up a seat. */
  cancelRegistration: (
    context: LaravelContext,
    id: number,
    learnerId?: number,
    profileName?: string,
  ) =>
    apiClient.delete<SessionApiResponse<{ id: number }>>(
      `/lms/sessions/${id}/register`,
      params(context, profileName, learnerId ? { learner_id: String(learnerId) } : undefined),
    ),
}
