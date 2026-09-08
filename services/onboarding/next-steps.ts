import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'

/**
 * What this person should do next.
 *
 * ── THE ROLE IS NOT SENT ────────────────────────────────────────────────────
 *
 * Only the token goes up. The server reads the role from the token's OWNER and
 * decides the content, so this file cannot ask for somebody else's list, and a
 * stale `role` in localStorage cannot produce guidance for a role the user does
 * not hold.
 *
 * ── AND NOTHING IS AUTHORED HERE ────────────────────────────────────────────
 *
 * Every step's title, sentence, link and destination arrives from the API,
 * where it is measured against the tenant's real tables and filtered by what
 * this profile may actually open. A step list written in the frontend would be
 * the same fixture problem as the old setup wizard: text that keeps claiming
 * work is outstanding after somebody did it.
 */

export type NextStep = {
  key: string
  title: string
  /** The real numbers — "3 of 9 exist", "None of your 23 people have a manager". */
  detail: string
  action: string
  link: string
  /** Null for the one step that points outside the menu system. */
  menu_id: number | null
}

export type NextStepsResponse = {
  status: boolean
  data: {
    role: string | null
    steps: NextStep[]
    dismissed: number
    /** True when the role resolved and there is genuinely nothing outstanding. */
    complete: boolean
  }
}

function params(context: LaravelContext) {
  return {
    sub_institute_id: context.subInstituteId,
    ...(context.token ? { type: 'api', token: context.token } : {}),
  }
}

export const nextStepsService = {
  get: (context: LaravelContext) =>
    apiClient.get<NextStepsResponse>('/onboarding/next-steps', params(context)),

  /** Hide a step for this user. Recorded server-side, so it holds across devices. */
  dismiss: (context: LaravelContext, key: string) =>
    apiClient.post<{ status: boolean; message: string }>('/onboarding/next-steps/dismiss', {
      ...params(context),
      key,
    }),

  restore: (context: LaravelContext, key: string) =>
    apiClient.post<{ status: boolean; message: string }>('/onboarding/next-steps/restore', {
      ...params(context),
      key,
    }),
}
