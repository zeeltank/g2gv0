'use client'

/**
 * Capability Gap Inbox — HR/Admin queue of competencies with nobody able to
 * close their gap because no course exists for it yet.
 *
 * Mirrors `useAssignments` (hooks/use-assignments.ts) deliberately: this
 * screen sits beside Assignments in navigation and should feel like the same
 * product. In particular: filter OPTIONS are derived from the rows actually
 * loaded (never hardcoded, never a value guaranteed to return nothing), and
 * every id driving a bulk action is the row's REAL id — this table renders a
 * page of a filtered list, so an index would be exactly the trap documented
 * on `getRowId` there.
 *
 * ONE ROW PER (TENANT, COMPETENCY), NOT PER EVENT OR PER EMPLOYEE. A later
 * rating tick that re-raises the same gap bumps `times_seen` on the existing
 * row rather than adding one — never assume list length tracks event count.
 * A row can also leave "needs action" on its own (status flips to
 * `superseded` once every affected rating has risen past the requirement),
 * so Dismiss is one exit, not the only one.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import {
  capabilityGapInboxService,
  type CapabilityCourseRequestRow,
  type CapabilityGapSummary,
} from '@/services/lms/capability-gap'

export type GapInboxTab = 'needs_action' | 'resolved' | 'dismissed'

export interface GapInboxFilters {
  search: string
  department: string
  competency: string
  jobrole: string
  /** 'All' | 'severe' (gap >= 2) | 'moderate' (0 < gap < 2) — computed client-side. */
  severity: string
  /** 'All' | '7' | '30' | '90' — days pending, at most. */
  daysPending: string
  mandatoryOnly: boolean
  quickFilter: string
}

const DEFAULT_FILTERS: GapInboxFilters = {
  search: '',
  department: 'All',
  competency: 'All',
  jobrole: 'All',
  severity: 'All',
  daysPending: 'All',
  mandatoryOnly: false,
  quickFilter: '',
}

function useLaravelContext() {
  const { user } = useAuth()
  return useCallback(() => getLaravelContext(user), [user])
}

/** How far a row's worst-case gap would read, for the severity filter — the
 * API does not return a per-row "worst gap" on the list endpoint (only the
 * drawer's `affected[]` does), so severity here is a coarse mandatory/count
 * proxy rather than a number nobody sent us. */
function severityBucket(row: CapabilityCourseRequestRow): 'severe' | 'moderate' {
  return row.is_mandatory && row.affected_count >= 5 ? 'severe' : 'moderate'
}

export function useCapabilityGapInbox() {
  const resolveContext = useLaravelContext()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<CapabilityCourseRequestRow[]>([])
  const [emptyIsExpected, setEmptyIsExpected] = useState(false)
  const [summary, setSummary] = useState<CapabilityGapSummary | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<GapInboxTab>('needs_action')
  const [filters, setFilters] = useState<GapInboxFilters>({ ...DEFAULT_FILTERS })
  const [actionError, setActionError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    const context = resolveContext()
    if (!isLaravelContextReady(context)) {
      setLoading(false)
      setError('Your session has expired. Sign in again to load the gap inbox.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Fetched with status 'all' and tabbed client-side: a status tab here is
      // a VIEW over one list, not a separate fetch, which keeps the KPI
      // strip's counts (from /summary) and the table rows from disagreeing
      // about what "all" means.
      const [listResponse, summaryResponse] = await Promise.all([
        capabilityGapInboxService.list(context, { status: 'all' }),
        capabilityGapInboxService.summary(context),
      ])
      setRows(listResponse?.data ?? [])
      setEmptyIsExpected(Boolean(listResponse?.empty_is_expected))
      setSummary(summaryResponse?.data ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the capability gap inbox')
      console.error('[useCapabilityGapInbox] load failed:', err)
    } finally {
      setLoading(false)
    }
  }, [resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  const setFilter = useCallback(
    <K extends keyof GapInboxFilters>(key: K, value: GapInboxFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const resetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS })
  }, [])

  const setQuickFilter = useCallback((filter: string) => {
    setFilters((prev) => ({ ...prev, quickFilter: prev.quickFilter === filter ? '' : filter }))
  }, [])

  const retry = useCallback(() => {
    void load()
  }, [load])

  const dismiss = useCallback(
    async (id: number, reason: string) => {
      const context = resolveContext()
      if (!isLaravelContextReady(context)) return { ok: false as const }

      setActing(true)
      setActionError(null)
      try {
        await capabilityGapInboxService.dismiss(context, id, reason)
        await load()
        return { ok: true as const }
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Could not dismiss this request.')
        return { ok: false as const }
      } finally {
        setActing(false)
      }
    },
    [resolveContext, load],
  )

  const bulkDismiss = useCallback(
    async (ids: number[], reason: string) => {
      const context = resolveContext()
      if (!isLaravelContextReady(context) || ids.length === 0) return { ok: false as const }

      setActing(true)
      setActionError(null)
      try {
        // No bulk endpoint exists server-side; dismissing several competencies
        // is several calls. Sequential, not Promise.all, so one bad id leaves
        // a predictable partial result rather than a scramble of races.
        for (const id of ids) {
          await capabilityGapInboxService.dismiss(context, id, reason)
        }
        setSelectedIds([])
        await load()
        return { ok: true as const }
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Could not dismiss every selected request.')
        return { ok: false as const }
      } finally {
        setActing(false)
      }
    },
    [resolveContext, load],
  )

  const reopen = useCallback(
    async (id: number) => {
      const context = resolveContext()
      if (!isLaravelContextReady(context)) return { ok: false as const }

      setActing(true)
      setActionError(null)
      try {
        await capabilityGapInboxService.reopen(context, id)
        await load()
        return { ok: true as const }
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Could not reopen this request.')
        return { ok: false as const }
      } finally {
        setActing(false)
      }
    },
    [resolveContext, load],
  )

  /* ---------------------------------------------------------------- *
   * Filter options — derived from the rows actually loaded.
   * ---------------------------------------------------------------- */

  const distinct = (pick: (r: CapabilityCourseRequestRow) => string | null | undefined) =>
    Array.from(new Set(rows.map(pick).filter((v): v is string => Boolean(v && v.trim())))).sort(
      (a, b) => a.localeCompare(b),
    )

  const departmentOptions = distinct((r) => r.department)
  const competencyOptions = distinct((r) => r.competency_name)
  const jobroleOptions = distinct((r) => r.jobrole_name)

  /* ---------------------------------------------------------------- *
   * Tab + filter predicate.
   * ---------------------------------------------------------------- */

  const tabStatuses: Record<GapInboxTab, CapabilityCourseRequestRow['status'][]> = {
    needs_action: ['open'],
    resolved: ['course_created', 'superseded'],
    dismissed: ['dismissed'],
  }

  const filteredRows = rows.filter((row) => {
    if (!tabStatuses[activeTab].includes(row.status)) return false

    if (filters.search) {
      const term = filters.search.toLowerCase()
      if (!row.competency_name.toLowerCase().includes(term)) return false
    }

    if (filters.department !== 'All' && (row.department ?? '') !== filters.department) return false
    if (filters.competency !== 'All' && row.competency_name !== filters.competency) return false
    if (filters.jobrole !== 'All' && (row.jobrole_name ?? '') !== filters.jobrole) return false
    if (filters.mandatoryOnly && !row.is_mandatory) return false
    if (filters.severity !== 'All' && severityBucket(row) !== filters.severity) return false

    if (filters.daysPending !== 'All') {
      const max = Number(filters.daysPending)
      if (Number.isFinite(max) && row.days_pending > max) return false
    }

    if (filters.quickFilter === 'mandatory' && !row.is_mandatory) return false
    if (filters.quickFilter === 'stale' && row.days_pending < 30) return false

    return true
  })

  const tabCounts = useMemo(
    () => ({
      needs_action: rows.filter((r) => tabStatuses.needs_action.includes(r.status)).length,
      resolved: rows.filter((r) => tabStatuses.resolved.includes(r.status)).length,
      dismissed: rows.filter((r) => tabStatuses.dismissed.includes(r.status)).length,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows],
  )

  return {
    loading,
    error,
    rows: filteredRows,
    allRowsCount: rows.length,
    emptyIsExpected,
    summary,
    selectedIds,
    setSelectedIds,
    activeTab,
    setActiveTab,
    tabCounts,
    filters,
    setFilter,
    resetFilters,
    setQuickFilter,
    departmentOptions,
    competencyOptions,
    jobroleOptions,
    dismiss,
    bulkDismiss,
    reopen,
    acting,
    actionError,
    dismissActionError: actionError,
    clearActionError: () => setActionError(null),
    retry,
  }
}

export type UseCapabilityGapInboxReturn = ReturnType<typeof useCapabilityGapInbox>
