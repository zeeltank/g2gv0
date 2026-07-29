'use client'

import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import {
  competencyAuditService,
  type AuditEntry,
  type AuditEntryDetail,
  type AuditFilterOptions,
  type AuditListParams,
  type AuditMetrics,
  type AuditPagination,
  type AuditUserActivity,
  type AuditUserSummary,
} from '@/services/competency'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/** The Laravel context is rebuilt per call - it reads live storage, not React state. */
function useLaravelContext() {
  const { user } = useAuth()
  return useCallback(() => getLaravelContext(user), [user])
}

/* ------------------------------------------------------------------ *
 * The activity table + KPI cards + filter options
 * ------------------------------------------------------------------ */

export interface UseCompetencyAuditState {
  loading: boolean
  error: string | null
  entries: AuditEntry[]
  pagination: AuditPagination | null
  metrics: AuditMetrics | null
  metricsLoading: boolean
  filterOptions: AuditFilterOptions | null
  exporting: boolean
  exportError: string | null
  retry: () => void
  exportRows: () => Promise<AuditEntry[]>
}

export function useCompetencyAudit(params: AuditListParams): UseCompetencyAuditState {
  const resolveContext = useLaravelContext()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [pagination, setPagination] = useState<AuditPagination | null>(null)

  const [metrics, setMetrics] = useState<AuditMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [filterOptions, setFilterOptions] = useState<AuditFilterOptions | null>(null)

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  // Serialised so the effect only refires when a param value actually changes.
  const paramsKey = JSON.stringify(params)

  // The KPI cards describe the filtered set, so they follow every filter except
  // the tab and the pagination - those only narrow what the table shows.
  const metricsKey = JSON.stringify({
    search: params.search,
    range: params.range,
    from: params.from,
    to: params.to,
    record_type: params.record_type,
    module: params.module,
    user_id_filter: params.user_id_filter,
    action_class: params.action_class,
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await competencyAuditService.list(
        resolveContext(),
        JSON.parse(paramsKey) as AuditListParams,
      )
      setEntries(response.data ?? [])
      setPagination(response.pagination ?? null)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the activity log.'))
      setEntries([])
      setPagination(null)
    } finally {
      setLoading(false)
    }
  }, [paramsKey, resolveContext])

  const loadAggregates = useCallback(async () => {
    setMetricsLoading(true)
    try {
      const [metricsResponse, filtersResponse] = await Promise.all([
        competencyAuditService.metrics(resolveContext(), JSON.parse(metricsKey) as AuditListParams),
        competencyAuditService.filterOptions(resolveContext()),
      ])
      setMetrics(metricsResponse.data ?? null)
      setFilterOptions(filtersResponse.data ?? null)
    } catch {
      // The table carries its own error surface; a failed KPI fetch just leaves
      // the cards empty rather than blanking the screen.
      setMetrics(null)
    } finally {
      setMetricsLoading(false)
    }
  }, [metricsKey, resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  useEffect(() => {
    queueMicrotask(() => {
      loadAggregates()
    })
  }, [loadAggregates])

  const exportRows = useCallback(async () => {
    setExporting(true)
    setExportError(null)

    try {
      const response = await competencyAuditService.exportRows(
        resolveContext(),
        JSON.parse(paramsKey) as AuditListParams,
      )
      // The export is itself an audited event, so refresh to show it.
      await Promise.all([load(), loadAggregates()])
      return response.data ?? []
    } catch (error_) {
      setExportError(toMessage(error_, 'Failed to export the activity log.'))
      return []
    } finally {
      setExporting(false)
    }
  }, [paramsKey, resolveContext, load, loadAggregates])

  const retry = useCallback(() => {
    load()
    loadAggregates()
  }, [load, loadAggregates])

  return {
    loading,
    error,
    entries,
    pagination,
    metrics,
    metricsLoading,
    filterOptions,
    exporting,
    exportError,
    retry,
    exportRows,
  }
}

/* ------------------------------------------------------------------ *
 * Detail panel - fetched per selected row so the list stays light
 * ------------------------------------------------------------------ */

export interface UseAuditEntryState {
  loading: boolean
  error: string | null
  entry: AuditEntryDetail | null
  retry: () => void
}

export function useAuditEntry(id: number | null): UseAuditEntryState {
  const resolveContext = useLaravelContext()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [entry, setEntry] = useState<AuditEntryDetail | null>(null)

  const load = useCallback(async () => {
    if (!id) {
      setEntry(null)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await competencyAuditService.show(resolveContext(), id)
      setEntry(response.data ?? null)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the activity details.'))
      setEntry(null)
    } finally {
      setLoading(false)
    }
  }, [id, resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  return { loading, error, entry, retry: load }
}

/* ------------------------------------------------------------------ *
 * User Actions Log tab - per-user rollup, with a nested access log
 * ------------------------------------------------------------------ */

export interface UseAuditUserActionsState {
  loading: boolean
  error: string | null
  users: AuditUserSummary[]
  selectedUserId: number | null
  selectUser: (userId: number | null) => void
  detailLoading: boolean
  detailError: string | null
  detail: AuditUserActivity | null
  retry: () => void
}

export function useAuditUserActions(
  params: AuditListParams,
  enabled: boolean,
): UseAuditUserActionsState {
  const resolveContext = useLaravelContext()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [users, setUsers] = useState<AuditUserSummary[]>([])

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detail, setDetail] = useState<AuditUserActivity | null>(null)

  const paramsKey = JSON.stringify(params)

  const load = useCallback(async () => {
    if (!enabled) return

    setLoading(true)
    setError(null)

    try {
      const response = await competencyAuditService.userActions(
        resolveContext(),
        JSON.parse(paramsKey) as AuditListParams,
      )
      setUsers(response.data ?? [])
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the user actions log.'))
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [enabled, paramsKey, resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const loadDetail = useCallback(async () => {
    if (!selectedUserId) {
      setDetail(null)
      setDetailError(null)
      return
    }

    setDetailLoading(true)
    setDetailError(null)

    try {
      const response = await competencyAuditService.userActivity(
        resolveContext(),
        selectedUserId,
        JSON.parse(paramsKey) as AuditListParams,
      )
      setDetail(response.data ?? null)
    } catch (loadError) {
      setDetailError(toMessage(loadError, 'Failed to load this user’s activity.'))
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [selectedUserId, paramsKey, resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      loadDetail()
    })
  }, [loadDetail])

  const selectUser = useCallback((userId: number | null) => {
    setSelectedUserId(userId)
  }, [])

  return {
    loading,
    error,
    users,
    selectedUserId,
    selectUser,
    detailLoading,
    detailError,
    detail,
    retry: load,
  }
}
