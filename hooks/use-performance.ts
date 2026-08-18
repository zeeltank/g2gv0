'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import {
  performanceService,
  type AppraisalPayload,
  type AppraisalSummary,
  type BonusDecisionAction,
  type BonusPayload,
  type BonusSummary,
  type BoardColumn,
  type CalibrationGrid,
  type CalibrationSessionPayload,
  type CalibrationSummary,
  type CompensationPayload,
  type CompensationSummary,
  type CyclePayload,
  type DecisionAction,
  type GoalPayload,
  type GoalSummary,
  type GoalUpdatePayload,
  type LaunchPayload,
  type PerfActivityEntry,
  type PerfAppraisal,
  type PerfAttachment,
  type PerfBonus,
  type PerfCalibrationSession,
  type PerfCompensation,
  type PerfCycle,
  type PerfFilterOptions,
  type PerfGoal,
  type PerfKpi,
  type PerfNote,
  type PerfOption,
  type PerfOverview,
  type PerfPagination,
  type PerfReview,
  type PerfReviewDetail,
  type PerfSavedView,
  type PerfTab,
  type ReviewFilters,
  type ReviewStage,
  type ReviewUpdatePayload,
  type TeamComparison,
  type TimelineCycle,
  type BulkReviewAction,
} from '@/services/talent/performance'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/** The Laravel context is rebuilt per call - it reads live storage, not React state. */
function useLaravelContext() {
  const { user } = useAuth()
  return useCallback(() => getLaravelContext(user), [user])
}

export interface MutationResult {
  ok: boolean
  message: string
}

const EMPTY_PAGINATION: PerfPagination = { page: 1, per_page: 25, total: 0, last_page: 1 }

/* ------------------------------------------------------------------ *
 * Header: KPI cards
 * ------------------------------------------------------------------ */

export function usePerformanceOverview(cycleId: string | undefined, refreshKey: number) {
  const resolveContext = useLaravelContext()

  const [kpis, setKpis] = useState<PerfKpi[]>([])
  const [totals, setTotals] = useState<PerfOverview['totals'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await performanceService.getOverview(resolveContext(), cycleId)
      setKpis(response.data.kpis)
      setTotals(response.data.totals)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load performance metrics.'))
      setKpis([])
      setTotals(null)
    } finally {
      setLoading(false)
    }
  }, [resolveContext, cycleId])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { kpis, totals, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * Header: filter options + cycles (one fetch, both consumers)
 * ------------------------------------------------------------------ */

export function usePerformanceFilters() {
  const resolveContext = useLaravelContext()

  const [options, setOptions] = useState<PerfFilterOptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await performanceService.getFilters(resolveContext())
      setOptions(response.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load filter options.'))
      setOptions(null)
    } finally {
      setLoading(false)
    }
  }, [resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  /** The cycle that should be selected when the screen opens. */
  const defaultCycleId = useMemo(() => {
    if (!options?.cycles?.length) return undefined
    const active = options.cycles.find((cycle) => cycle.status === 'active')
    return (active ?? options.cycles[0]).value
  }, [options])

  return { options, defaultCycleId, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * Reviews: the main table
 * ------------------------------------------------------------------ */

export function usePerformanceReviews(filters: ReviewFilters, refreshKey: number) {
  const resolveContext = useLaravelContext()

  const [reviews, setReviews] = useState<PerfReview[]>([])
  const [pagination, setPagination] = useState<PerfPagination>(EMPTY_PAGINATION)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Serialising the filters keeps the effect key stable across object identity.
  const filterKey = JSON.stringify(filters)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await performanceService.getReviews(resolveContext(), JSON.parse(filterKey) as ReviewFilters)
      setReviews(response.data)
      setPagination(response.pagination ?? EMPTY_PAGINATION)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load employee reviews.'))
      setReviews([])
      setPagination(EMPTY_PAGINATION)
    } finally {
      setLoading(false)
    }
  }, [resolveContext, filterKey])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { reviews, pagination, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * Reviews: the Review Board kanban
 * ------------------------------------------------------------------ */

export function usePerformanceBoard(filters: ReviewFilters, enabled: boolean, refreshKey: number) {
  const resolveContext = useLaravelContext()

  const [columns, setColumns] = useState<BoardColumn[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filterKey = JSON.stringify(filters)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const response = await performanceService.getBoard(resolveContext(), JSON.parse(filterKey) as ReviewFilters)
      setColumns(response.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the review board.'))
      setColumns([])
    } finally {
      setLoading(false)
    }
  }, [resolveContext, filterKey, enabled])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { columns, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * Reviews: the Cycle Timeline view
 * ------------------------------------------------------------------ */

export function usePerformanceTimeline(cycleId: string | undefined, enabled: boolean, refreshKey: number) {
  const resolveContext = useLaravelContext()

  const [cycles, setCycles] = useState<TimelineCycle[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      // Deliberately unscoped: the timeline shows every cycle, not just the
      // one selected in the header, so the whole calendar is visible.
      const response = await performanceService.getTimeline(resolveContext())
      setCycles(response.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the cycle timeline.'))
      setCycles([])
    } finally {
      setLoading(false)
    }
  }, [resolveContext, enabled])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey, cycleId])

  return { cycles, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * Employee Overview sidebar (detail + team comparison + its tab data)
 * ------------------------------------------------------------------ */

export type SidebarTab = 'overview' | 'goals' | 'reviews' | 'compensation' | 'docs' | 'activity'

export function useReviewDetail(reviewId: number | null, refreshKey: number) {
  const resolveContext = useLaravelContext()

  const [detail, setDetail] = useState<PerfReviewDetail | null>(null)
  const [team, setTeam] = useState<TeamComparison | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!reviewId) {
      setDetail(null)
      setTeam(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await performanceService.getReview(resolveContext(), reviewId)
      setDetail(response.data)

      // Team Comparison needs the employee's department, which only arrives with
      // the detail - so it is a dependent second call, not a parallel one.
      if (response.data.department_id) {
        try {
          const teamResponse = await performanceService.getTeamComparison(
            resolveContext(),
            String(response.data.department_id),
            String(response.data.cycle_id),
          )
          setTeam(teamResponse.data)
        } catch {
          // A missing comparison must not blank the whole panel.
          setTeam(null)
        }
      } else {
        setTeam(null)
      }
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the employee overview.'))
      setDetail(null)
      setTeam(null)
    } finally {
      setLoading(false)
    }
  }, [resolveContext, reviewId])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { detail, team, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * Activity Feed / Comments / Notes / Attachments / Audit Trail
 * ------------------------------------------------------------------ */

export type ActivityTab = 'feed' | 'comments' | 'notes' | 'attachments' | 'audit'

export function useReviewActivity(reviewId: number | null, tab: ActivityTab, refreshKey: number) {
  const resolveContext = useLaravelContext()

  const [entries, setEntries] = useState<PerfActivityEntry[]>([])
  const [notes, setNotes] = useState<PerfNote[]>([])
  const [attachments, setAttachments] = useState<PerfAttachment[]>([])
  const [counts, setCounts] = useState({ comment: 0, note: 0, attachments: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /**
   * The tab counts are shown in the tab labels themselves, so they must be
   * loaded whether or not that tab is open. This runs once per review.
   */
  const loadCounts = useCallback(async () => {
    if (!reviewId) {
      setCounts({ comment: 0, note: 0, attachments: 0 })
      return
    }

    try {
      const [noteResponse, attachmentResponse] = await Promise.all([
        performanceService.getNotes(resolveContext(), reviewId),
        performanceService.getAttachments(resolveContext(), reviewId),
      ])

      setCounts({
        comment: noteResponse.counts?.comment ?? 0,
        note: noteResponse.counts?.note ?? 0,
        attachments: attachmentResponse.counts?.attachments ?? 0,
      })
    } catch {
      setCounts({ comment: 0, note: 0, attachments: 0 })
    }
  }, [resolveContext, reviewId])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (tab === 'comments' || tab === 'notes') {
        if (!reviewId) {
          setNotes([])
          return
        }
        const response = await performanceService.getNotes(
          resolveContext(),
          reviewId,
          tab === 'comments' ? 'comment' : 'note',
        )
        setNotes(response.data)
      } else if (tab === 'attachments') {
        if (!reviewId) {
          setAttachments([])
          return
        }
        const response = await performanceService.getAttachments(resolveContext(), reviewId)
        setAttachments(response.data)
      } else {
        const response = await performanceService.getActivity(resolveContext(), {
          tab: tab === 'audit' ? 'audit' : 'feed',
          ...(reviewId ? { review_id: reviewId } : {}),
          per_page: 20,
        })
        setEntries(response.data)
      }
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load activity.'))
      setEntries([])
      setNotes([])
      setAttachments([])
    } finally {
      setLoading(false)
    }
  }, [resolveContext, reviewId, tab])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  useEffect(() => {
    queueMicrotask(() => {
      loadCounts()
    })
  }, [loadCounts, refreshKey])

  return { entries, notes, attachments, counts, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * Tab data: Goals / Appraisals / Compensation / Bonus / Calibration
 * ------------------------------------------------------------------ */

export function usePerformanceGoals(
  filters: ReviewFilters & { category?: string; goal_status?: string },
  enabled: boolean,
  refreshKey: number,
) {
  const resolveContext = useLaravelContext()

  const [goals, setGoals] = useState<PerfGoal[]>([])
  const [summary, setSummary] = useState<GoalSummary | null>(null)
  const [pagination, setPagination] = useState<PerfPagination>(EMPTY_PAGINATION)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filterKey = JSON.stringify(filters)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const response = await performanceService.getGoals(resolveContext(), JSON.parse(filterKey))
      setGoals(response.data)
      setSummary(response.summary ?? null)
      setPagination(response.pagination ?? EMPTY_PAGINATION)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load goals.'))
      setGoals([])
      setSummary(null)
      setPagination(EMPTY_PAGINATION)
    } finally {
      setLoading(false)
    }
  }, [resolveContext, filterKey, enabled])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { goals, summary, pagination, loading, error, retry: load }
}

export function usePerformanceAppraisals(
  filters: ReviewFilters & { recommendation?: string },
  enabled: boolean,
  refreshKey: number,
) {
  const resolveContext = useLaravelContext()

  const [appraisals, setAppraisals] = useState<PerfAppraisal[]>([])
  const [summary, setSummary] = useState<AppraisalSummary | null>(null)
  const [pagination, setPagination] = useState<PerfPagination>(EMPTY_PAGINATION)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filterKey = JSON.stringify(filters)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const response = await performanceService.getAppraisals(resolveContext(), JSON.parse(filterKey))
      setAppraisals(response.data)
      setSummary(response.summary ?? null)
      setPagination(response.pagination ?? EMPTY_PAGINATION)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load appraisals.'))
      setAppraisals([])
      setSummary(null)
      setPagination(EMPTY_PAGINATION)
    } finally {
      setLoading(false)
    }
  }, [resolveContext, filterKey, enabled])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { appraisals, summary, pagination, loading, error, retry: load }
}

export function usePerformanceCompensation(
  filters: ReviewFilters & { revision_type?: string },
  enabled: boolean,
  refreshKey: number,
) {
  const resolveContext = useLaravelContext()

  const [revisions, setRevisions] = useState<PerfCompensation[]>([])
  const [summary, setSummary] = useState<CompensationSummary | null>(null)
  const [pagination, setPagination] = useState<PerfPagination>(EMPTY_PAGINATION)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filterKey = JSON.stringify(filters)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const response = await performanceService.getCompensation(resolveContext(), JSON.parse(filterKey))
      setRevisions(response.data)
      setSummary(response.summary ?? null)
      setPagination(response.pagination ?? EMPTY_PAGINATION)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load compensation revisions.'))
      setRevisions([])
      setSummary(null)
      setPagination(EMPTY_PAGINATION)
    } finally {
      setLoading(false)
    }
  }, [resolveContext, filterKey, enabled])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { revisions, summary, pagination, loading, error, retry: load }
}

export function usePerformanceBonus(
  filters: ReviewFilters & { bonus_type?: string; payout_month?: string },
  enabled: boolean,
  refreshKey: number,
) {
  const resolveContext = useLaravelContext()

  const [awards, setAwards] = useState<PerfBonus[]>([])
  const [summary, setSummary] = useState<BonusSummary | null>(null)
  const [payoutMonths, setPayoutMonths] = useState<PerfOption[]>([])
  const [pagination, setPagination] = useState<PerfPagination>(EMPTY_PAGINATION)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filterKey = JSON.stringify(filters)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const response = await performanceService.getBonus(resolveContext(), JSON.parse(filterKey))
      setAwards(response.data)
      setSummary(response.summary ?? null)
      setPayoutMonths(response.payout_months ?? [])
      setPagination(response.pagination ?? EMPTY_PAGINATION)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load bonus awards.'))
      setAwards([])
      setSummary(null)
      setPayoutMonths([])
      setPagination(EMPTY_PAGINATION)
    } finally {
      setLoading(false)
    }
  }, [resolveContext, filterKey, enabled])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { awards, summary, payoutMonths, pagination, loading, error, retry: load }
}

export function usePerformanceCalibration(filters: ReviewFilters, enabled: boolean, refreshKey: number) {
  const resolveContext = useLaravelContext()

  const [sessions, setSessions] = useState<PerfCalibrationSession[]>([])
  const [summary, setSummary] = useState<CalibrationSummary | null>(null)
  const [pagination, setPagination] = useState<PerfPagination>(EMPTY_PAGINATION)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filterKey = JSON.stringify(filters)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const response = await performanceService.getCalibrationSessions(resolveContext(), JSON.parse(filterKey))
      setSessions(response.data)
      setSummary(response.summary ?? null)
      setPagination(response.pagination ?? EMPTY_PAGINATION)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load calibration sessions.'))
      setSessions([])
      setSummary(null)
      setPagination(EMPTY_PAGINATION)
    } finally {
      setLoading(false)
    }
  }, [resolveContext, filterKey, enabled])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { sessions, summary, pagination, loading, error, retry: load }
}

/** The calibration grid, loaded only when a session is opened. */
export function useCalibrationGrid(sessionId: number | null, refreshKey: number) {
  const resolveContext = useLaravelContext()

  const [grid, setGrid] = useState<CalibrationGrid | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!sessionId) {
      setGrid(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await performanceService.getCalibrationGrid(resolveContext(), sessionId)
      setGrid(response.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the calibration grid.'))
      setGrid(null)
    } finally {
      setLoading(false)
    }
  }, [resolveContext, sessionId])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { grid, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * Saved views
 * ------------------------------------------------------------------ */

export function useSavedViews(tab: PerfTab, refreshKey: number) {
  const resolveContext = useLaravelContext()

  const [views, setViews] = useState<PerfSavedView[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await performanceService.getSavedViews(resolveContext(), tab)
      setViews(response.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load saved views.'))
      setViews([])
    } finally {
      setLoading(false)
    }
  }, [resolveContext, tab])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { views, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * Mutations
 * ------------------------------------------------------------------ *
 * One hook for every write on the screen. Each returns {ok, message} so the
 * component can surface the API's own message (including its 422 guard text,
 * e.g. "An approved appraisal cannot be edited") rather than inventing one.
 */
export function usePerformanceMutations() {
  const resolveContext = useLaravelContext()
  const [saving, setSaving] = useState(false)

  const run = useCallback(
    async (operation: () => Promise<{ message?: string }>, fallback: string): Promise<MutationResult> => {
      setSaving(true)
      try {
        const response = await operation()
        return { ok: true, message: response?.message || fallback }
      } catch (error) {
        return { ok: false, message: toMessage(error, `${fallback} failed.`) }
      } finally {
        setSaving(false)
      }
    },
    [],
  )

  /* -- Cycles -- */
  const createCycle = useCallback(
    (payload: CyclePayload) =>
      run(() => performanceService.createCycle(resolveContext(), payload), 'Review cycle created'),
    [run, resolveContext],
  )

  const updateCycle = useCallback(
    (id: number, payload: Partial<CyclePayload>) =>
      run(() => performanceService.updateCycle(resolveContext(), id, payload), 'Review cycle updated'),
    [run, resolveContext],
  )

  const launchCycle = useCallback(
    (id: number, payload: LaunchPayload = {}) =>
      run(() => performanceService.launchCycle(resolveContext(), id, payload), 'Review cycle launched'),
    [run, resolveContext],
  )

  const closeCycle = useCallback(
    (id: number, force = false) =>
      run(() => performanceService.closeCycle(resolveContext(), id, force), 'Review cycle closed'),
    [run, resolveContext],
  )

  const deleteCycle = useCallback(
    (id: number) => run(() => performanceService.deleteCycle(resolveContext(), id), 'Review cycle deleted'),
    [run, resolveContext],
  )

  /* -- Reviews -- */
  const updateReview = useCallback(
    (id: number, payload: ReviewUpdatePayload) =>
      run(() => performanceService.updateReview(resolveContext(), id, payload), 'Review updated'),
    [run, resolveContext],
  )

  const advanceReview = useCallback(
    (id: number, options: { stage?: ReviewStage; rating?: number } = {}) =>
      run(() => performanceService.advanceReview(resolveContext(), id, options), 'Review stage updated'),
    [run, resolveContext],
  )

  const sendReminder = useCallback(
    (id: number) => run(() => performanceService.sendReminder(resolveContext(), id), 'Reminder recorded'),
    [run, resolveContext],
  )

  const bulkReviews = useCallback(
    (
      ids: number[],
      action: BulkReviewAction,
      options: { stage?: ReviewStage; manager_id?: number; due_date?: string } = {},
    ) => run(() => performanceService.bulkReviews(resolveContext(), ids, action, options), 'Reviews updated'),
    [run, resolveContext],
  )

  const deleteReview = useCallback(
    (id: number) => run(() => performanceService.deleteReview(resolveContext(), id), 'Review removed'),
    [run, resolveContext],
  )

  /* -- Goals -- */
  const createGoal = useCallback(
    (payload: GoalPayload) => run(() => performanceService.createGoal(resolveContext(), payload), 'Goal created'),
    [run, resolveContext],
  )

  const updateGoal = useCallback(
    (id: number, payload: GoalUpdatePayload) =>
      run(() => performanceService.updateGoal(resolveContext(), id, payload), 'Goal updated'),
    [run, resolveContext],
  )

  const deleteGoal = useCallback(
    (id: number) => run(() => performanceService.deleteGoal(resolveContext(), id), 'Goal deleted'),
    [run, resolveContext],
  )

  /* -- Appraisals -- */
  const createAppraisal = useCallback(
    (payload: AppraisalPayload) =>
      run(() => performanceService.createAppraisal(resolveContext(), payload), 'Appraisal created'),
    [run, resolveContext],
  )

  const updateAppraisal = useCallback(
    (id: number, payload: Partial<Omit<AppraisalPayload, 'user_id_target'>>) =>
      run(() => performanceService.updateAppraisal(resolveContext(), id, payload), 'Appraisal updated'),
    [run, resolveContext],
  )

  const decideAppraisal = useCallback(
    (id: number, action: DecisionAction, remarks?: string) =>
      run(() => performanceService.decideAppraisal(resolveContext(), id, action, remarks), 'Appraisal updated'),
    [run, resolveContext],
  )

  const bulkAppraisals = useCallback(
    (ids: number[], action: DecisionAction) =>
      run(() => performanceService.bulkAppraisals(resolveContext(), ids, action), 'Appraisals updated'),
    [run, resolveContext],
  )

  const deleteAppraisal = useCallback(
    (id: number) => run(() => performanceService.deleteAppraisal(resolveContext(), id), 'Appraisal deleted'),
    [run, resolveContext],
  )

  /* -- Compensation -- */
  const createCompensation = useCallback(
    (payload: CompensationPayload) =>
      run(() => performanceService.createCompensation(resolveContext(), payload), 'Compensation revision created'),
    [run, resolveContext],
  )

  const updateCompensation = useCallback(
    (id: number, payload: Partial<Omit<CompensationPayload, 'user_id_target'>>) =>
      run(() => performanceService.updateCompensation(resolveContext(), id, payload), 'Compensation revision updated'),
    [run, resolveContext],
  )

  const decideCompensation = useCallback(
    (id: number, action: DecisionAction, remarks?: string) =>
      run(
        () => performanceService.decideCompensation(resolveContext(), id, action, remarks),
        'Compensation revision updated',
      ),
    [run, resolveContext],
  )

  const bulkCompensation = useCallback(
    (ids: number[], action: DecisionAction) =>
      run(() => performanceService.bulkCompensation(resolveContext(), ids, action), 'Compensation revisions updated'),
    [run, resolveContext],
  )

  const deleteCompensation = useCallback(
    (id: number) =>
      run(() => performanceService.deleteCompensation(resolveContext(), id), 'Compensation revision deleted'),
    [run, resolveContext],
  )

  /* -- Bonus -- */
  const createBonus = useCallback(
    (payload: BonusPayload) =>
      run(() => performanceService.createBonus(resolveContext(), payload), 'Bonus award created'),
    [run, resolveContext],
  )

  const updateBonus = useCallback(
    (id: number, payload: Partial<Omit<BonusPayload, 'user_id_target'>>) =>
      run(() => performanceService.updateBonus(resolveContext(), id, payload), 'Bonus award updated'),
    [run, resolveContext],
  )

  const decideBonus = useCallback(
    (id: number, action: BonusDecisionAction, remarks?: string) =>
      run(() => performanceService.decideBonus(resolveContext(), id, action, remarks), 'Bonus award updated'),
    [run, resolveContext],
  )

  const bulkBonus = useCallback(
    (ids: number[], action: BonusDecisionAction) =>
      run(() => performanceService.bulkBonus(resolveContext(), ids, action), 'Bonus awards updated'),
    [run, resolveContext],
  )

  const deleteBonus = useCallback(
    (id: number) => run(() => performanceService.deleteBonus(resolveContext(), id), 'Bonus award deleted'),
    [run, resolveContext],
  )

  /* -- Calibration -- */
  const createCalibrationSession = useCallback(
    (payload: CalibrationSessionPayload) =>
      run(() => performanceService.createCalibrationSession(resolveContext(), payload), 'Calibration session created'),
    [run, resolveContext],
  )

  const updateCalibrationSession = useCallback(
    (id: number, payload: Partial<Omit<CalibrationSessionPayload, 'cycle_id' | 'attach_reviews'>>) =>
      run(
        () => performanceService.updateCalibrationSession(resolveContext(), id, payload),
        'Calibration session updated',
      ),
    [run, resolveContext],
  )

  const calibrateRating = useCallback(
    (sessionId: number, reviewId: number, rating: number) =>
      run(
        () => performanceService.calibrateRatings(resolveContext(), sessionId, { review_id: reviewId, rating }),
        'Rating calibrated',
      ),
    [run, resolveContext],
  )

  const lockCalibrationSession = useCallback(
    (id: number, options: { force?: boolean; advance?: boolean } = {}) =>
      run(() => performanceService.lockCalibrationSession(resolveContext(), id, options), 'Calibration session locked'),
    [run, resolveContext],
  )

  const deleteCalibrationSession = useCallback(
    (id: number) =>
      run(() => performanceService.deleteCalibrationSession(resolveContext(), id), 'Calibration session deleted'),
    [run, resolveContext],
  )

  /* -- Notes / attachments -- */
  const createNote = useCallback(
    (reviewId: number, body: string, noteType: 'comment' | 'note' = 'comment') =>
      run(
        () => performanceService.createNote(resolveContext(), reviewId, { body, note_type: noteType }),
        noteType === 'note' ? 'Note added' : 'Comment added',
      ),
    [run, resolveContext],
  )

  const updateNote = useCallback(
    (id: number, body: string) =>
      run(() => performanceService.updateNote(resolveContext(), id, { body }), 'Note updated'),
    [run, resolveContext],
  )

  const deleteNote = useCallback(
    (id: number) => run(() => performanceService.deleteNote(resolveContext(), id), 'Note deleted'),
    [run, resolveContext],
  )

  const uploadAttachment = useCallback(
    (reviewId: number, file: File, meta: { title?: string; document_type?: string } = {}) =>
      run(() => performanceService.uploadAttachment(resolveContext(), reviewId, file, meta), 'Attachment uploaded'),
    [run, resolveContext],
  )

  const deleteAttachment = useCallback(
    (id: number) => run(() => performanceService.deleteAttachment(resolveContext(), id), 'Attachment deleted'),
    [run, resolveContext],
  )

  /* -- Saved views -- */
  const createSavedView = useCallback(
    (payload: { name: string; tab?: PerfTab; filters?: Record<string, string>; is_shared?: boolean; is_default?: boolean }) =>
      run(() => performanceService.createSavedView(resolveContext(), payload), 'View saved'),
    [run, resolveContext],
  )

  const deleteSavedView = useCallback(
    (id: number) => run(() => performanceService.deleteSavedView(resolveContext(), id), 'Saved view deleted'),
    [run, resolveContext],
  )

  return {
    saving,
    createCycle,
    updateCycle,
    launchCycle,
    closeCycle,
    deleteCycle,
    updateReview,
    advanceReview,
    sendReminder,
    bulkReviews,
    deleteReview,
    createGoal,
    updateGoal,
    deleteGoal,
    createAppraisal,
    updateAppraisal,
    decideAppraisal,
    bulkAppraisals,
    deleteAppraisal,
    createCompensation,
    updateCompensation,
    decideCompensation,
    bulkCompensation,
    deleteCompensation,
    createBonus,
    updateBonus,
    decideBonus,
    bulkBonus,
    deleteBonus,
    createCalibrationSession,
    updateCalibrationSession,
    calibrateRating,
    lockCalibrationSession,
    deleteCalibrationSession,
    createNote,
    updateNote,
    deleteNote,
    uploadAttachment,
    deleteAttachment,
    createSavedView,
    deleteSavedView,
  }
}
