'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { talentDashboardService } from '@/services/talent'
import type {
  TalentDashboardData,
  TalentDashboardFilterData,
  TalentDashboardQuery,
} from '@/types/talent-dashboard'

/** Laravel's `date` rule expects Y-m-d, not an ISO timestamp. */
export function toDateParam(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

/** "1 May - 31 May 2025" - what the date-range button shows. */
export function formatRangeLabel(from: string, to: string) {
  const fromDate = new Date(from)
  const toDate = new Date(to)

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return `${from} - ${to}`
  }

  const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' })
  const full = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  return `${day.format(fromDate)} - ${full.format(toDate)}`
}

export interface TalentDashboardFilters {
  departmentId: string
  location: string
  businessUnit: string
  from: string
  to: string
}

const DEFAULT_FILTERS: TalentDashboardFilters = {
  departmentId: 'all',
  location: 'all',
  businessUnit: 'all',
  from: toDateParam(startOfMonth()),
  to: toDateParam(endOfMonth()),
}

function toQuery(filters: TalentDashboardFilters): TalentDashboardQuery {
  return {
    // 'all' is the UI's no-filter sentinel; the service strips it before sending.
    department_id: filters.departmentId,
    location: filters.location,
    from: filters.from,
    to: filters.to,
  }
}

/**
 * The Talent Management dashboard.
 *
 * One request for all six sections (GET /api/talent/dashboard), plus a second
 * for the real filter options. Both are gated on a complete Laravel session:
 * firing before login would 401 and surface as an error state on a page the
 * user has not finished authenticating into.
 */
export function useTalentDashboard() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<TalentDashboardFilters>(DEFAULT_FILTERS)

  const ready = useMemo(() => isLaravelContextReady(getLaravelContext(user)), [user])

  const query = useQuery({
    queryKey: ['talent-dashboard', filters.departmentId, filters.location, filters.from, filters.to],
    queryFn: () => talentDashboardService.getDashboard(toQuery(filters)),
    enabled: ready,
  })

  const filterOptions = useQuery({
    queryKey: ['talent-dashboard-filters'],
    queryFn: () => talentDashboardService.getFilters(),
    enabled: ready,
    // Departments and locations change far less often than the metrics.
    staleTime: 5 * 60 * 1000,
  })

  const setFilter = useCallback(
    <K extends keyof TalentDashboardFilters>(key: K, value: TalentDashboardFilters[K]) => {
      setFilters((current) => ({ ...current, [key]: value }))
    },
    [],
  )

  const setRange = useCallback((from: string, to: string) => {
    setFilters((current) => ({ ...current, from, to }))
  }, [])

  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), [])

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['talent-dashboard'] }),
    [queryClient],
  )

  const data: TalentDashboardData | null = query.data?.data ?? null
  const options: TalentDashboardFilterData | null = filterOptions.data ?? null

  return {
    data,
    meta: query.data?.meta ?? { from: filters.from, to: filters.to },
    options,
    filters,
    setFilter,
    setRange,
    resetFilters,
    rangeLabel: formatRangeLabel(filters.from, filters.to),
    /** True only while there is nothing to show - a refetch keeps the old data. */
    loading: query.isPending && ready,
    fetching: query.isFetching,
    optionsLoading: filterOptions.isPending && ready,
    error: query.error instanceof Error ? query.error.message : null,
    /** Session not yet established: render the signed-out prompt, not an error. */
    unauthenticated: !ready,
    refresh,
  }
}
