import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'

/**
 * Travel Visit's API client: /api/travel-visits (HRMS\TravelVisitController).
 *
 * Trips are started, tracked and ended from the mobile app; the web only reads.
 * The server decides whose trips come back for a scope - ask for one the user
 * has no right to and it falls back to their own.
 */

export type TravelVisitScope = 'mine' | 'team' | 'all'
export type TravelVisitStatus = 'ongoing' | 'completed'

export type TravelPlace = { lat: number; lng: number; address: string | null }

export type TravelPoint = {
  lat: number
  lng: number
  accuracy: number | null
  speed: number | null
  /** "YYYY-MM-DD HH:mm:ss" */
  recorded_at: string
}

export type TravelVisit = {
  id: number
  visit_no: string
  employee_id: number
  employee_name: string | null
  employee_code: string | null
  purpose: string | null
  vehicle_type: string | null
  remarks: string | null
  status: TravelVisitStatus
  start_at: string
  end_at: string | null
  from: TravelPlace | null
  to: TravelPlace | null
  /** Kilometres, worked out by the server from the points. */
  distance: number
  /** Kilometres the phone reported. */
  app_distance: number | null
  amount: number
  /** Only on a single visit. */
  points?: TravelPoint[]
}

export type TravelVisitSummary = { visits: number; ongoing: number; distance: number }

export type TravelVisitFilters = {
  scope?: TravelVisitScope
  status?: TravelVisitStatus | ''
  from?: string
  to?: string
}

function baseParams(context: LaravelContext) {
  return {
    sub_institute_id: context.subInstituteId,
    ...(context.token ? { type: 'api', token: context.token } : {}),
  }
}

export const travelVisitService = {
  referenceData: (context: LaravelContext) =>
    apiClient.get<{ status: number; data: { purposes: string[]; vehicle_types: string[]; scopes: TravelVisitScope[] } }>(
      '/travel-visits/reference-data',
      baseParams(context),
    ),

  list: (context: LaravelContext, filters: TravelVisitFilters = {}) =>
    apiClient.get<{ status: number; scope: TravelVisitScope; data: TravelVisit[]; summary: TravelVisitSummary }>('/travel-visits', {
      ...baseParams(context),
      ...(filters.scope ? { scope: filters.scope } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.from ? { from: filters.from } : {}),
      ...(filters.to ? { to: filters.to } : {}),
    }),

  get: (context: LaravelContext, id: number) =>
    apiClient.get<{ status: number; message?: string; data: TravelVisit }>(`/travel-visits/${id}`, baseParams(context)),
}
