'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/components/auth/gtg-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { hrDashboardService } from '@/services/dashboard/hr-dashboard'

/**
 * HR/ADMIN HOME DASHBOARD DATA.
 *
 * ONE QUERY KEY PER SECTION, deliberately. Sharing a key would re-couple what
 * the sectioned endpoints exist to separate: a failing /summary would blank the
 * filters, and a slow section would hold up the fast one. Separate keys give
 * each section its own loading, error and empty state — which is the whole
 * point of the split.
 *
 * `enabled` guards on isLaravelContextReady so nothing fires before login;
 * without it the first render calls the API with an empty token and the
 * dashboard's opening state is a 401.
 *
 * `useAuth` is imported from '@/components/auth/gtg-auth', NOT '@/hooks/use-auth'
 * — the latter declares its own stale User type (`role: string`, none of the
 * session fields) while the runtime object is the richer one.
 */
export function useHrDashboard(departmentId?: string) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const context = getLaravelContext(user)
  const ready = isLaravelContextReady(context)

  const filters = useQuery({
    queryKey: ['dashboard', 'hr', 'filters', context.subInstituteId],
    queryFn: () => hrDashboardService.filters(context),
    enabled: ready,
    staleTime: 5 * 60 * 1000, // vocabularies change rarely
  })

  const summary = useQuery({
    queryKey: ['dashboard', 'hr', 'summary', context.subInstituteId, context.syear, departmentId ?? null],
    queryFn: () => hrDashboardService.summary(context, { department_id: departmentId }),
    enabled: ready,
  })

  // Separate keys again: the six-month scan must not hold up the tiles, and a
  // failure in it must not blank them.
  const workforce = useQuery({
    queryKey: ['dashboard', 'hr', 'workforce', context.subInstituteId, context.syear],
    queryFn: () => hrDashboardService.workforce(context),
    enabled: ready,
  })

  const signals = useQuery({
    queryKey: ['dashboard', 'hr', 'signals', context.subInstituteId],
    queryFn: () => hrDashboardService.signals(context),
    enabled: ready,
    staleTime: 5 * 60 * 1000,
  })

  return {
    ready,

    workforce: workforce.data?.data ?? null,
    workforceLoading: workforce.isLoading,
    workforceNote: workforce.data?.empty_reason ?? null,

    events: signals.data?.data?.events ?? null,
    eventsLoading: signals.isLoading,
    eventsEmptyReason: signals.data?.empty_reason ?? null,

    filters: filters.data?.data ?? null,
    filtersLoading: filters.isLoading,
    filtersError: filters.error,

    summary: summary.data?.data ?? null,
    summaryLoading: summary.isLoading,
    summaryError: summary.error,
    /** A tenant with nothing yet is normal — this is what says so. */
    summaryEmptyIsExpected: summary.data?.empty_is_expected ?? false,
    summaryEmptyReason: summary.data?.empty_reason ?? null,
    meta: summary.data?.meta ?? null,

    refresh: () => queryClient.invalidateQueries({ queryKey: ['dashboard', 'hr'] }),
  }
}
