'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/components/auth/gtg-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { meDashboardService } from '@/services/dashboard/me-dashboard'

/**
 * THE EMPLOYEE'S OWN HOME DASHBOARD DATA.
 *
 * ONE QUERY KEY PER SECTION, deliberately. Sharing a key would re-couple what
 * the sectioned endpoints exist to separate: a failing /growth would blank the
 * task tiles, and the six-month attendance scan would hold up numbers that are
 * already available. Separate keys give each section its own loading, error and
 * empty state, which is the whole point of the split.
 *
 * THE KEYS CARRY user_id. Two people signing in on the same browser — a shared
 * kiosk, a support session — would otherwise read each other's cached figures
 * from a key that only named the tenant. The server would answer correctly for
 * whoever's token was sent; react-query would never ask it.
 *
 * `enabled` guards on isLaravelContextReady so nothing fires before login;
 * without it the first render calls the API with an empty token and the
 * dashboard's opening state is a 401.
 *
 * `useAuth` comes from '@/components/auth/gtg-auth', NOT '@/hooks/use-auth' —
 * the latter declares its own stale User type while the runtime object is the
 * richer one.
 */
export function useMeDashboard() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const context = getLaravelContext(user)
  const ready = isLaravelContextReady(context)

  // CACHE KEY ONLY. withLaravelParams sends user_id on every request as it does
  // everywhere else, and the backend deliberately IGNORES it — the token decides
  // the subject. This value never reaches a query; it only stops one person's
  // cached figures being served to the next person on the same browser.
  const who = context.userId || String(user?.id ?? '')

  const summary = useQuery({
    queryKey: ['dashboard', 'me', 'summary', context.subInstituteId, who, context.syear],
    queryFn: () => meDashboardService.summary(context),
    enabled: ready,
  })

  const growth = useQuery({
    queryKey: ['dashboard', 'me', 'growth', context.subInstituteId, who],
    queryFn: () => meDashboardService.growth(context),
    enabled: ready,
    // Capability targets, the execution model and the course catalogue move on
    // the order of weeks, not minutes.
    staleTime: 5 * 60 * 1000,
  })

  const signals = useQuery({
    queryKey: ['dashboard', 'me', 'signals', context.subInstituteId, who, context.syear],
    queryFn: () => meDashboardService.signals(context),
    enabled: ready,
  })

  return {
    ready,

    me: summary.data?.data?.me ?? null,
    links: summary.data?.data?.links ?? null,
    tasks: summary.data?.data?.tasks ?? null,
    summaryLoading: summary.isLoading,
    summaryError: summary.error,
    tasksEmptyReason: summary.data?.empty_reason ?? null,

    growth: growth.data?.data ?? null,
    growthLoading: growth.isLoading,
    growthError: growth.error,
    growthEmptyReason: growth.data?.empty_reason ?? null,

    signals: signals.data?.data ?? null,
    signalsLoading: signals.isLoading,
    signalsError: signals.error,
    signalsEmptyReason: signals.data?.empty_reason ?? null,

    meta: summary.data?.meta ?? null,

    refresh: () => queryClient.invalidateQueries({ queryKey: ['dashboard', 'me'] }),
  }
}
