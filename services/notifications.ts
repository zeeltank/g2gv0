/**
 * X-06 — the in-app inbox, `/api/notifications`.
 *
 * THE BELL IN THE HEADER HAD NO DATA SOURCE. It rendered "You're all caught up"
 * unconditionally, with a hardcoded "New" badge beside it — a control that told
 * the user two contradictory things, neither of them measured. This module is
 * what makes it mean something.
 *
 * THERE IS NO user_id PARAMETER, AND THERE MUST NEVER BE ONE. The server derives
 * the recipient from the token; an inbox that accepted a user id would be a read
 * leak with a friendly name.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

export interface NotificationRow {
  id: number
  event_type: string
  subject: string
  body: string
  /** Where the recipient goes to ACT. Null when there is nowhere to go. */
  action_url: string | null
  /** WHY this person got it — e.g. `task_assignee`, `certification_holder`. */
  recipient_reason: string
  read_at: string | null
  created_at: string
}

interface InboxResponse {
  status: number
  notifications: NotificationRow[]
  unread: number
}

interface CountResponse {
  status: number
  unread: number
}

interface MarkResponse {
  status: number
  updated: number
  unread: number
}

export const notificationService = {
  list: (context: LaravelContext, options?: { unreadOnly?: boolean; limit?: number }) =>
    apiClient.get<InboxResponse>(
      '/notifications',
      withLaravelParams(context, {
        ...(options?.unreadOnly ? { unread_only: '1' } : {}),
        ...(options?.limit ? { limit: String(options.limit) } : {}),
      }),
    ),

  unreadCount: (context: LaravelContext) =>
    apiClient.get<CountResponse>('/notifications/unread-count', withLaravelParams(context)),

  // PATCH carries the context in the BODY, not the query string — apiClient.patch
  // takes a body. The bearer token is added by authHeader() either way; this is
  // the belt-and-braces `?: $request->input('token')` path the client already
  // relies on elsewhere.
  markRead: (context: LaravelContext, id: number) =>
    apiClient.patch<MarkResponse>(`/notifications/${id}/read`, withLaravelParams(context)),

  markAllRead: (context: LaravelContext) =>
    apiClient.patch<MarkResponse>('/notifications/read-all', withLaravelParams(context)),
}
