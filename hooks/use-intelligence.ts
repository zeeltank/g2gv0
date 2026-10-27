'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/components/auth/gtg-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { intelligenceService } from '@/services/dashboard/intelligence'

/**
 * INTELLIGENCE OVERVIEW DATA.
 *
 * Its own query key, so it can never couple to (or blank) the Home dashboard's sections. `enabled` waits for login
 * to be ready; without it the first render calls the API with an empty token. `useAuth` comes from
 * '@/components/auth/gtg-auth' for the same reason as use-hr-dashboard.
 */
export function useIntelligence() {
  const { user } = useAuth()
  const context = getLaravelContext(user)
  const ready = isLaravelContextReady(context)

  const query = useQuery({
    queryKey: ['intelligence', 'overview', context.subInstituteId],
    queryFn: () => intelligenceService.overview(context),
    enabled: ready,
    staleTime: 2 * 60 * 1000,
  })

  const status = (query.error as { status?: number } | null)?.status

  return {
    ready,
    overview: query.data?.data ?? null,
    emptyReason: query.data?.empty_reason ?? null,
    isLoading: query.isLoading,
    isRefreshing: query.isFetching && !query.isLoading,
    error: query.error as Error | null,
    /** 403: the signed-in profile is not admin/hr. */
    denied: status === 403,
    refetch: query.refetch,
  }
}
