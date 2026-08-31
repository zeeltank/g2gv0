import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'
import type {
  MeEnvelope,
  MeSummarySection,
  MeGrowthSection,
  MeSignalsSection,
} from '@/types/me-dashboard'

/**
 * THE EMPLOYEE'S OWN HOME DASHBOARD CLIENT.
 *
 * One call per SECTION, the same split the HR dashboard uses and for the same
 * reason: behind one call a single slow or broken source blanks the whole page.
 *
 *   /summary  task counts and status — cheap, paints first
 *   /growth   capability, execution model, learning — the join-heavy section
 *   /signals  the six-month attendance scan, leave, activity — the slow one
 *
 * NO SUBJECT IS SENT AND NONE MAY BE ADDED. These endpoints accept no user_id
 * of any kind; the caller is resolved from the token server-side. withLaravelParams
 * carries sub_institute_id, syear and profile_id as it does everywhere else, and
 * the backend treats every one of them as a hint rather than as identity.
 *
 * If a widget ever needs "this employee" for somebody else, that is the HR
 * dashboard's job, behind `profile:admin,hr`. Do not add a parameter here.
 */
export const meDashboardService = {
  /**
   * GET /api/dashboard/me/summary
   *
   * `syear` is REQUIRED — the task tables are scoped by academic year as well
   * as tenant, and the endpoint answers 422 without it rather than silently
   * mixing years. withLaravelParams already carries it from the session.
   */
  summary: (context: LaravelContext) =>
    apiClient.get<MeEnvelope<MeSummarySection>>(
      '/dashboard/me/summary',
      withLaravelParams(context),
    ),

  /** GET /api/dashboard/me/growth */
  growth: (context: LaravelContext) =>
    apiClient.get<MeEnvelope<MeGrowthSection>>(
      '/dashboard/me/growth',
      withLaravelParams(context),
    ),

  /** GET /api/dashboard/me/signals */
  signals: (context: LaravelContext) =>
    apiClient.get<MeEnvelope<MeSignalsSection>>(
      '/dashboard/me/signals',
      withLaravelParams(context),
    ),
}
