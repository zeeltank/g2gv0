import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'

/**
 * How far this organisation has got with setting itself up.
 *
 * ── NOTHING HERE IS STORED PROGRESS ─────────────────────────────────────────
 *
 * Every step's state is counted server-side from the tables the rest of the
 * product uses - departments from `hrms_departments`, people from `tbluser`,
 * and so on. There is no progress record to fall out of step with reality.
 *
 * That matters because the screen this replaces had two of them: a `Map` in the
 * Next.js process (`app/api/onboarding/route.ts`), keyed by user rather than
 * tenant and wiped on every redeploy, and a `localStorage` flag called
 * `gtg-portal-live` that lived in one person's browser. Both could say "set up"
 * about an organisation that was not.
 *
 * It also means an organisation that configured itself through the ordinary
 * screens, never opening this one, reads as done - and one that clicked through
 * a wizard changing nothing does not.
 */

export type SetupStepStatus = {
  key: string
  label: string
  done: boolean
  /** The real numbers - "49 departments", "3 of 9 exist". */
  detail: string
  action: string
  /** Where to go to do it. Null when the step is completed in place. */
  link: string | null
  /** Set when the step can be completed from this screen. */
  inline_action?: string
}

export type SetupStatusResponse = {
  status: boolean
  data: {
    steps: SetupStepStatus[]
    done: number
    total: number
    complete: boolean
  }
}

export type CreateRolesResponse = {
  status: boolean
  message: string
  data: { created: number; stamped: number }
}

function params(context: LaravelContext) {
  return {
    sub_institute_id: context.subInstituteId,
    ...(context.token ? { type: 'api', token: context.token } : {}),
  }
}

export const setupStatusService = {
  get: (context: LaravelContext) =>
    apiClient.get<SetupStatusResponse>('/organization/setup-status', params(context)),

  /**
   * Create the nine standard roles this organisation is missing.
   *
   * The only step completed in place, because the nine roles are the platform's
   * own vocabulary rather than the customer's authored content - the permission
   * system already assumes they exist. No user is assigned and no permissions
   * are granted; both are decisions for a person.
   */
  createRoles: (context: LaravelContext) =>
    apiClient.post<CreateRolesResponse>('/organization/setup/roles', params(context)),
}
