import { apiClient } from '@/services/core'
import { getLaravelContext, withLaravelParams } from '@/lib/laravel-context'
import type {
  TalentDashboardData,
  TalentDashboardFilterData,
  TalentDashboardFiltersResponse,
  TalentDashboardQuery,
  TalentDashboardResponse,
} from '@/types/talent-dashboard'

/**
 * Tenant coordinates for every call, exactly as recruitment.ts builds them.
 *
 * There are deliberately no defaults: a hardcoded sub_institute_id or token
 * would point every browser at the same tenant with one shared credential.
 */
function contextParams(extra?: Record<string, string>) {
  const context = getLaravelContext()
  if (!context.token || !context.subInstituteId) {
    throw new Error('Your Laravel session is unavailable. Please sign in again.')
  }
  return withLaravelParams(context, extra)
}

/** Drop empty filters so the API sees "no filter" rather than an empty string. */
function activeParams(query: TalentDashboardQuery): Record<string, string> {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => Boolean(value && value !== 'all')),
  ) as Record<string, string>
}

export const talentDashboardService = {
  /**
   * One aggregate covering recruitment, performance, onboarding, mobility and
   * offboarding - five modules in a single request on page load.
   */
  async getDashboard(query: TalentDashboardQuery = {}): Promise<{
    data: TalentDashboardData
    meta: { from: string; to: string }
  }> {
    const response = await apiClient.get<TalentDashboardResponse>(
      '/talent/dashboard',
      contextParams(activeParams(query)),
    )

    return { data: response.data, meta: response.meta }
  },

  /** Real options for the Department and Location selects. */
  async getFilters(): Promise<TalentDashboardFilterData> {
    const response = await apiClient.get<TalentDashboardFiltersResponse>(
      '/talent/dashboard/filters',
      contextParams(),
    )

    return response.data
  },
}
