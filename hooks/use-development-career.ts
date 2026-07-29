'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import {
  developmentCareerService,
  competencyCommandCenterService,
  type CareerExplorer,
  type CareerPathDetail,
  type CareerPathPayload,
  type CareerPathSummary,
  type CourseOption,
  type DevCareerPagination,
  type DevelopmentPlan,
  type DevelopmentPlanDetail,
  type DevelopmentPlanListParams,
  type DevelopmentPlanPayload,
  type EmployeeOption,
  type FilterOption,
  type LearningAssignment,
  type LearningAssignmentListParams,
  type LearningAssignmentPayload,
  type LearningStatus,
  type LearningType,
  type PlanAction,
  type PlanActionPayload,
  type PlanGaps,
  type PlanHistoryEntry,
  type PlanMetrics,
  type RoleOption,
} from '@/services/competency'

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

/* ------------------------------------------------------------------ *
 * KPI cards
 * ------------------------------------------------------------------ */

export function usePlanMetrics(refreshKey: number) {
  const resolveContext = useLaravelContext()

  const [metrics, setMetrics] = useState<PlanMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await developmentCareerService.getMetrics(resolveContext())
      setMetrics(response.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load workspace metrics.'))
      setMetrics(null)
    } finally {
      setLoading(false)
    }
  }, [resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { metrics, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * Filter dropdown options (departments / owners / employees)
 * ------------------------------------------------------------------ */

export function useWorkspaceLookups() {
  const resolveContext = useLaravelContext()

  const [departments, setDepartments] = useState<FilterOption[]>([])
  const [owners, setOwners] = useState<FilterOption[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    queueMicrotask(async () => {
      setLoading(true)
      const context = resolveContext()
      // Each lookup is independent - one failing must not blank the others.
      const [filters, ownerList, employeeList] = await Promise.allSettled([
        competencyCommandCenterService.getFilters(context),
        developmentCareerService.getOwners(context),
        developmentCareerService.getEmployees(context),
      ])
      if (cancelled) return

      if (filters.status === 'fulfilled') {
        setDepartments(filters.value.data?.departments ?? [])
      }
      if (ownerList.status === 'fulfilled') {
        setOwners(ownerList.value.data ?? [])
      }
      if (employeeList.status === 'fulfilled') {
        setEmployees(employeeList.value.data ?? [])
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [resolveContext])

  return { departments, owners, employees, loading }
}

/* ------------------------------------------------------------------ *
 * Development plans list + CRUD
 * ------------------------------------------------------------------ */

export interface UseDevelopmentPlansState {
  loading: boolean
  error: string | null
  plans: DevelopmentPlan[]
  pagination: DevCareerPagination | null
  saving: boolean
  actionMessage: string | null
  actionError: string | null
  retry: () => void
  create: (payload: DevelopmentPlanPayload) => Promise<MutationResult>
  update: (id: number, payload: Partial<DevelopmentPlanPayload>) => Promise<MutationResult>
  remove: (id: number) => Promise<MutationResult>
  clearMessages: () => void
}

export function useDevelopmentPlans(params: DevelopmentPlanListParams): UseDevelopmentPlansState {
  const resolveContext = useLaravelContext()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [plans, setPlans] = useState<DevelopmentPlan[]>([])
  const [pagination, setPagination] = useState<DevCareerPagination | null>(null)

  const [saving, setSaving] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Serialised so the effect only refires when a param value actually changes.
  const paramsKey = JSON.stringify(params)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await developmentCareerService.listPlans(
        resolveContext(),
        JSON.parse(paramsKey) as DevelopmentPlanListParams,
      )
      setPlans(response.data ?? [])
      setPagination(response.pagination ?? null)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load development plans.'))
      setPlans([])
      setPagination(null)
    } finally {
      setLoading(false)
    }
  }, [paramsKey, resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const runMutation = useCallback(
    async (action: () => Promise<{ message: string }>, fallback: string): Promise<MutationResult> => {
      setSaving(true)
      setActionError(null)
      setActionMessage(null)
      try {
        const response = await action()
        setActionMessage(response.message)
        await load()
        return { ok: true, message: response.message }
      } catch (mutationError) {
        const message = toMessage(mutationError, fallback)
        setActionError(message)
        return { ok: false, message }
      } finally {
        setSaving(false)
      }
    },
    [load],
  )

  return {
    loading,
    error,
    plans,
    pagination,
    saving,
    actionMessage,
    actionError,
    retry: load,
    create: (payload) =>
      runMutation(
        () => developmentCareerService.createPlan(resolveContext(), payload),
        'Failed to create the development plan.',
      ),
    update: (id, payload) =>
      runMutation(
        () => developmentCareerService.updatePlan(resolveContext(), id, payload),
        'Failed to update the development plan.',
      ),
    remove: (id) =>
      runMutation(
        () => developmentCareerService.deletePlan(resolveContext(), id),
        'Failed to delete the development plan.',
      ),
    clearMessages: () => {
      setActionMessage(null)
      setActionError(null)
    },
  }
}

/* ------------------------------------------------------------------ *
 * Plan detail panel (header + 4 tabs)
 * ------------------------------------------------------------------ */

export function usePlanDetail(planId: number | null) {
  const resolveContext = useLaravelContext()

  const [detail, setDetail] = useState<DevelopmentPlanDetail | null>(null)
  const [gaps, setGaps] = useState<PlanGaps | null>(null)
  const [actions, setActions] = useState<PlanAction[]>([])
  const [history, setHistory] = useState<PlanHistoryEntry[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (planId == null) {
      setDetail(null)
      setGaps(null)
      setActions([])
      setHistory([])
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    const context = resolveContext()

    try {
      const detailResponse = await developmentCareerService.getPlan(context, planId)
      setDetail(detailResponse.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the plan.'))
      setDetail(null)
      setLoading(false)
      return
    }

    // Tab payloads are independent - a failure in one leaves the others usable.
    const [gapResult, actionResult, historyResult] = await Promise.allSettled([
      developmentCareerService.getGaps(context, planId),
      developmentCareerService.getActions(context, planId),
      developmentCareerService.getHistory(context, planId),
    ])

    setGaps(gapResult.status === 'fulfilled' ? gapResult.value.data : null)
    setActions(actionResult.status === 'fulfilled' ? actionResult.value.data ?? [] : [])
    setHistory(historyResult.status === 'fulfilled' ? historyResult.value.data ?? [] : [])
    setLoading(false)
  }, [planId, resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const runMutation = useCallback(
    async (action: () => Promise<{ message: string }>, fallback: string): Promise<MutationResult> => {
      setSaving(true)
      try {
        const response = await action()
        await load()
        return { ok: true, message: response.message }
      } catch (mutationError) {
        return { ok: false, message: toMessage(mutationError, fallback) }
      } finally {
        setSaving(false)
      }
    },
    [load],
  )

  return {
    detail,
    gaps,
    actions,
    history,
    loading,
    error,
    saving,
    retry: load,
    createAction: (payload: PlanActionPayload) =>
      runMutation(
        () => developmentCareerService.createAction(resolveContext(), planId as number, payload),
        'Failed to add the action.',
      ),
    updateAction: (actionId: number, payload: Partial<PlanActionPayload>) =>
      runMutation(
        () => developmentCareerService.updateAction(resolveContext(), planId as number, actionId, payload),
        'Failed to update the action.',
      ),
    deleteAction: (actionId: number) =>
      runMutation(
        () => developmentCareerService.deleteAction(resolveContext(), planId as number, actionId),
        'Failed to delete the action.',
      ),
  }
}

/* ------------------------------------------------------------------ *
 * Career paths
 * ------------------------------------------------------------------ */

export function useCareerPaths(params: { search?: string; status?: string }, refreshKey: number) {
  const resolveContext = useLaravelContext()

  const [paths, setPaths] = useState<CareerPathSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const paramsKey = JSON.stringify(params)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await developmentCareerService.listCareerPaths(
        resolveContext(),
        { ...(JSON.parse(paramsKey) as { search?: string; status?: string }), per_page: 100 },
      )
      setPaths(response.data ?? [])
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load career paths.'))
      setPaths([])
    } finally {
      setLoading(false)
    }
  }, [paramsKey, resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  const runMutation = useCallback(
    async (action: () => Promise<{ message: string }>, fallback: string): Promise<MutationResult> => {
      setSaving(true)
      setActionError(null)
      setActionMessage(null)
      try {
        const response = await action()
        setActionMessage(response.message)
        await load()
        return { ok: true, message: response.message }
      } catch (mutationError) {
        const message = toMessage(mutationError, fallback)
        setActionError(message)
        return { ok: false, message }
      } finally {
        setSaving(false)
      }
    },
    [load],
  )

  return {
    paths,
    loading,
    error,
    saving,
    actionMessage,
    actionError,
    retry: load,
    create: (payload: CareerPathPayload) =>
      runMutation(
        () => developmentCareerService.createCareerPath(resolveContext(), payload),
        'Failed to create the career path.',
      ),
    update: (id: number, payload: Partial<CareerPathPayload>) =>
      runMutation(
        () => developmentCareerService.updateCareerPath(resolveContext(), id, payload),
        'Failed to update the career path.',
      ),
    remove: (id: number) =>
      runMutation(
        () => developmentCareerService.deleteCareerPath(resolveContext(), id),
        'Failed to delete the career path.',
      ),
    clearMessages: () => {
      setActionMessage(null)
      setActionError(null)
    },
  }
}

/** Full detail (ordered steps) for the path being edited. */
export function useCareerPathDetail(pathId: number | null) {
  const resolveContext = useLaravelContext()

  const [detail, setDetail] = useState<CareerPathDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    queueMicrotask(async () => {
      if (pathId == null) {
        setDetail(null)
        return
      }
      setLoading(true)
      try {
        const response = await developmentCareerService.getCareerPath(resolveContext(), pathId)
        if (!cancelled) setDetail(response.data)
      } catch {
        if (!cancelled) setDetail(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [pathId, resolveContext])

  return { detail, loading }
}

/** Career Path Explorer card. */
export function useCareerExplorer(params: { planId?: number | null; careerPathId?: number | null; employeeId?: number | null }) {
  const resolveContext = useLaravelContext()

  const [explorer, setExplorer] = useState<CareerExplorer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const key = `${params.planId ?? ''}|${params.careerPathId ?? ''}|${params.employeeId ?? ''}`

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [planId, careerPathId, employeeId] = key.split('|')
    try {
      const response = await developmentCareerService.getExplorer(resolveContext(), {
        ...(planId ? { plan_id: Number(planId) } : {}),
        ...(careerPathId ? { career_path_id: Number(careerPathId) } : {}),
        ...(employeeId ? { employee_id: Number(employeeId) } : {}),
      })
      setExplorer(response.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the career path.'))
      setExplorer(null)
    } finally {
      setLoading(false)
    }
  }, [key, resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  return { explorer, loading, error, retry: load }
}

export function useRoleOptions() {
  const resolveContext = useLaravelContext()
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    queueMicrotask(async () => {
      try {
        const response = await developmentCareerService.getRoleOptions(resolveContext())
        if (!cancelled) setRoles(response.data ?? [])
      } catch {
        if (!cancelled) setRoles([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [resolveContext])

  return { roles, loading }
}

/* ------------------------------------------------------------------ *
 * Learning assignments
 * ------------------------------------------------------------------ */

export function useLearningAssignments(params: LearningAssignmentListParams, refreshKey: number) {
  const resolveContext = useLaravelContext()

  const [assignments, setAssignments] = useState<LearningAssignment[]>([])
  const [pagination, setPagination] = useState<DevCareerPagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const paramsKey = JSON.stringify(params)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await developmentCareerService.listLearning(
        resolveContext(),
        JSON.parse(paramsKey) as LearningAssignmentListParams,
      )
      setAssignments(response.data ?? [])
      setPagination(response.pagination ?? null)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load learning assignments.'))
      setAssignments([])
      setPagination(null)
    } finally {
      setLoading(false)
    }
  }, [paramsKey, resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  const runMutation = useCallback(
    async (action: () => Promise<{ message: string }>, fallback: string): Promise<MutationResult> => {
      setSaving(true)
      setActionError(null)
      setActionMessage(null)
      try {
        const response = await action()
        setActionMessage(response.message)
        await load()
        return { ok: true, message: response.message }
      } catch (mutationError) {
        const message = toMessage(mutationError, fallback)
        setActionError(message)
        return { ok: false, message }
      } finally {
        setSaving(false)
      }
    },
    [load],
  )

  return {
    assignments,
    pagination,
    loading,
    error,
    saving,
    actionMessage,
    actionError,
    retry: load,
    assign: (payload: LearningAssignmentPayload) =>
      runMutation(
        () => developmentCareerService.assignLearning(resolveContext(), payload),
        'Failed to assign the learning.',
      ),
    update: (id: number, payload: { status?: LearningStatus; progress?: number; due_date?: string; assignment_type?: LearningType }) =>
      runMutation(
        () => developmentCareerService.updateLearning(resolveContext(), id, payload),
        'Failed to update the assignment.',
      ),
    remove: (id: number) =>
      runMutation(
        () => developmentCareerService.deleteLearning(resolveContext(), id),
        'Failed to remove the assignment.',
      ),
    clearMessages: () => {
      setActionMessage(null)
      setActionError(null)
    },
  }
}

export function useCourseOptions() {
  const resolveContext = useLaravelContext()
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    queueMicrotask(async () => {
      try {
        const response = await developmentCareerService.getCourses(resolveContext())
        if (!cancelled) setCourses(response.data ?? [])
      } catch {
        if (!cancelled) setCourses([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [resolveContext])

  const options = useMemo(
    () => courses.map((course) => ({ label: course.name, value: String(course.id) })),
    [courses],
  )

  return { courses, options, loading }
}
