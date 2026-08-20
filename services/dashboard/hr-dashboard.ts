import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'
import type {
  HrDashboardEnvelope,
  HrDashboardFilters,
  HrDashboardSummary,
  HrWorkforceSection,
  HrSignalsSection,
} from '@/types/hr-dashboard'

/**
 * THE HR/ADMIN HOME DASHBOARD CLIENT.
 *
 * One call per SECTION, not one per dashboard and not one per widget:
 *
 *   /filters   vocabularies, rarely change
 *   /summary   cheap counts — paints first
 *   /workforce the six-month scan            (batch 2)
 *   /signals   readiness + events            (batch 3)
 *
 * The whole dashboard is ~45 aggregate queries against a remote database.
 * Behind one call, a single slow or broken source blanks the entire page —
 * which is how the LMS dashboard fails today with its one Promise.all. Split
 * this way, the headline numbers arrive while the heavy work is still running
 * and a failure is contained to its own section.
 *
 * AUTHORISATION IS NOT NEGOTIATED HERE. These routes sit behind
 * `profile:admin,hr`, which reads role_key from the TOKEN OWNER. The
 * `profile_id` withLaravelParams sends comes from localStorage and is a UI hint
 * only — an employee calling these gets a 403, which the screen must render as
 * an error state rather than as an empty dashboard.
 */
export const hrDashboardService = {
  /** GET /api/dashboard/hr/filters */
  filters: (context: LaravelContext) =>
    apiClient.get<HrDashboardEnvelope<HrDashboardFilters>>(
      '/dashboard/hr/filters',
      withLaravelParams(context),
    ),

  /**
   * GET /api/dashboard/hr/summary
   *
   * `syear` is REQUIRED — the task tables are scoped by academic year as well
   * as tenant, and the endpoint answers 422 without it rather than silently
   * mixing years. withLaravelParams already carries it from the session.
   */
  summary: (context: LaravelContext, filters?: { department_id?: string }) =>
    apiClient.get<HrDashboardEnvelope<HrDashboardSummary>>(
      '/dashboard/hr/summary',
      withLaravelParams(context, {
        ...(filters?.department_id ? { department_id: filters.department_id } : {}),
      }),
    ),

  /**
   * GET /api/dashboard/hr/workforce
   *
   * The heavy section - a six-month attendance scan plus module rollups,
   * learning rings and the recruitment funnel. Separate from /summary so this
   * scan can never delay or blank the headline numbers.
   */
  workforce: (context: LaravelContext) =>
    apiClient.get<HrDashboardEnvelope<HrWorkforceSection>>(
      '/dashboard/hr/workforce',
      withLaravelParams(context),
    ),

  /** GET /api/dashboard/hr/signals - upcoming events from every dated source. */
  signals: (context: LaravelContext) =>
    apiClient.get<HrDashboardEnvelope<HrSignalsSection>>(
      '/dashboard/hr/signals',
      withLaravelParams(context),
    ),
}
