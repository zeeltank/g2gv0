'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import {
  leaveService,
  type HolidayPayload,
  type LeaveApplyPayload,
  type LeaveBalancesData,
  type LeaveDashboardData,
  type LeaveDepartmentSummaryRow,
  type LeaveHolidayRow,
  type LeaveOptionsData,
  type LeaveBalanceReportData,
  type LeaveRegisterRow,
  type LeaveReportCatalog,
  type LeaveReportFilters,
  type LeaveReportSummaryData,
  type LeaveRequestDetail,
  type LeaveRequestFilters,
  type LeaveRequestRow,
  type LeaveRolePermission,
  type LeaveStatus,
  type LeaveTrendPoint,
  type LeaveTypeConfig,
  type LeaveTypeDistributionRow,
  type LeaveTypePayload,
  type LeaveUpcomingHoliday,
  type LeaveWeekday,
  type LeaveWorkflowSettings,
} from '@/services/hrms'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/** The Laravel context is rebuilt per call - it reads live storage, not React state. */
function useLaravelContext() {
  const { user } = useAuth()
  return useCallback(() => getLaravelContext(user), [user])
}

/* ------------------------------------------------------------------ *
 * Dashboard
 * ------------------------------------------------------------------ */

export interface LeaveDashboardState {
  loading: boolean
  processingRequestId: string | null
  error: string | null
  actionError: string | null
  summary: LeaveDashboardData | null
  trend: LeaveTrendPoint[]
  departments: LeaveDepartmentSummaryRow[]
  leaveTypes: LeaveTypeDistributionRow[]
  holidays: LeaveUpcomingHoliday[]
  balances: LeaveBalancesData | null
  pending: LeaveRequestRow[]
  recent: LeaveRequestRow[]
  upcoming: LeaveRequestRow[]
  retry: () => void
  /**
   * F-183. Widened from `'approved' | 'rejected'` and no remarks.
   *
   * The dashboard's detail drawer offers Send Back, Cancel Request and an HR
   * remark - the same drawer the Leave Requests screen uses - so a signature
   * that only took approve/reject made those unreachable from here and left
   * the remark box saving nothing.
   */
  decide: (
    id: number | string,
    status: LeaveStatus,
    remarks?: { hodComment?: string; hrRemarks?: string },
  ) => Promise<{ ok: boolean; message: string }>
}

export function useLeaveDashboard(departmentId?: string): LeaveDashboardState {
  const resolveContext = useLaravelContext()
  const [loading, setLoading] = useState(true)
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [summary, setSummary] = useState<LeaveDashboardData | null>(null)
  const [trend, setTrend] = useState<LeaveTrendPoint[]>([])
  const [departments, setDepartments] = useState<LeaveDepartmentSummaryRow[]>([])
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeDistributionRow[]>([])
  const [holidays, setHolidays] = useState<LeaveUpcomingHoliday[]>([])
  const [balances, setBalances] = useState<LeaveBalancesData | null>(null)
  const [pending, setPending] = useState<LeaveRequestRow[]>([])
  const [recent, setRecent] = useState<LeaveRequestRow[]>([])
  const [upcoming, setUpcoming] = useState<LeaveRequestRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const context = resolveContext()
      const today = new Date().toISOString().slice(0, 10)

      const [
        summaryResponse,
        trendResponse,
        departmentResponse,
        typeResponse,
        holidayResponse,
        balanceResponse,
        pendingResponse,
        recentResponse,
        upcomingResponse,
      ] = await Promise.all([
        leaveService.getDashboard(context, departmentId),
        leaveService.getTrend(context, departmentId),
        leaveService.getDepartmentSummary(context),
        leaveService.getTypeDistribution(context, departmentId),
        leaveService.getUpcomingHolidays(context, 5),
        leaveService.getBalances(context),
        leaveService.getRequests(context, {
          status: ['pending'],
          departmentId,
          perPage: 5,
          sortBy: 'submittedDate',
          sortDir: 'desc',
        }),
        leaveService.getRequests(context, {
          departmentId,
          perPage: 10,
          sortBy: 'submittedDate',
          sortDir: 'desc',
        }),
        leaveService.getRequests(context, {
          status: ['approved'],
          departmentId,
          fromDate: today,
          perPage: 5,
          sortBy: 'fromDate',
          sortDir: 'asc',
        }),
      ])

      setSummary(summaryResponse.data)
      setTrend(trendResponse.data ?? [])
      setDepartments(departmentResponse.data ?? [])
      setLeaveTypes(typeResponse.data ?? [])
      setHolidays(holidayResponse.data ?? [])
      setBalances(balanceResponse.data)
      setPending(pendingResponse.data ?? [])
      setRecent(recentResponse.data ?? [])
      setUpcoming(upcomingResponse.data ?? [])
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the leave dashboard.'))
      setSummary(null)
      setTrend([])
      setDepartments([])
      setLeaveTypes([])
      setHolidays([])
      setBalances(null)
      setPending([])
      setRecent([])
      setUpcoming([])
    } finally {
      setLoading(false)
    }
  }, [departmentId, resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const decide = useCallback(
    async (
      id: number | string,
      status: LeaveStatus,
      remarks?: { hodComment?: string; hrRemarks?: string },
    ) => {
      setProcessingRequestId(String(id))
      setActionError(null)

      try {
        const response = await leaveService.decideRequest(resolveContext(), id, { status, ...remarks })
        // Reload every dashboard endpoint so counts, lists, balances and activity
        // all reflect the decision returned by Laravel.
        await load()
        return { ok: true, message: response.message }
      } catch (decisionError) {
        const message = toMessage(decisionError, 'Failed to update the leave request.')
        setActionError(message)
        return { ok: false, message }
      } finally {
        setProcessingRequestId(null)
      }
    },
    [load, resolveContext],
  )

  return {
    loading,
    processingRequestId,
    error,
    actionError,
    summary,
    trend,
    departments,
    leaveTypes,
    holidays,
    balances,
    pending,
    recent,
    upcoming,
    retry: load,
    decide,
  }
}

/* ------------------------------------------------------------------ *
 * Shared dropdown options
 * ------------------------------------------------------------------ */

export function useLeaveOptions(departmentId?: string) {
  const resolveContext = useLaravelContext()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [options, setOptions] = useState<LeaveOptionsData | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await leaveService.getOptions(resolveContext(), departmentId)
      setOptions(response.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load leave options.'))
      setOptions(null)
    } finally {
      setLoading(false)
    }
  }, [departmentId, resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  return { loading, error, options, retry: load }
}

/**
 * Which leave reports exist, from the server.
 *
 * The catalogue was a module-level constant in the Leave Reports screen, so
 * adding or renaming a report needed a frontend deploy, and the category counts
 * derived from it were computed once with an empty dependency array - frozen at
 * 3 / 2 / 1 regardless of the tab or the search box, while the "Showing X of Y"
 * line on the same card used the real number.
 *
 * Returns null rather than an empty list on failure, so the caller can tell
 * "the server has no reports" from "we could not ask" and fall back to the
 * definitions this build ships with.
 */
export function useLeaveReportCatalog() {
  const resolveContext = useLaravelContext()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<LeaveReportCatalog | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await leaveService.getReportCatalog(resolveContext())
      setCatalog(response.data ?? null)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the report catalog.'))
      setCatalog(null)
    } finally {
      setLoading(false)
    }
  }, [resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  return { loading, error, catalog, retry: load }
}

/* ------------------------------------------------------------------ *
 * Leave requests
 * ------------------------------------------------------------------ */

export function useLeaveRequests(filters: LeaveRequestFilters) {
  const resolveContext = useLaravelContext()
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [requests, setRequests] = useState<LeaveRequestRow[]>([])
  const [total, setTotal] = useState(0)
  const [lastPage, setLastPage] = useState(1)

  // Serialised so the effect only refires when a filter value actually changes.
  const filterKey = JSON.stringify(filters)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await leaveService.getRequests(resolveContext(), JSON.parse(filterKey))
      setRequests(response.data ?? [])
      setTotal(response.pagination?.total ?? 0)
      setLastPage(response.pagination?.last_page ?? 1)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load leave requests.'))
      setRequests([])
      setTotal(0)
      setLastPage(1)
    } finally {
      setLoading(false)
    }
  }, [filterKey, resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const applyLeave = useCallback(
    async (payload: LeaveApplyPayload) => {
      setProcessing(true)
      setError(null)
      setActionMessage(null)

      try {
        const response = await leaveService.applyLeave(resolveContext(), payload)
        setActionMessage(response.message)
        await load()
        return { ok: true as const, message: response.message }
      } catch (submitError) {
        const message = toMessage(submitError, 'Failed to submit the leave request.')
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    [load, resolveContext],
  )

  const decide = useCallback(
    async (id: number | string, status: LeaveStatus, remarks?: { hodComment?: string; hrRemarks?: string }) => {
      setProcessing(true)
      setError(null)
      setActionMessage(null)

      try {
        const response = await leaveService.decideRequest(resolveContext(), id, { status, ...remarks })
        setActionMessage(response.message)
        await load()
        return { ok: true as const, message: response.message }
      } catch (decisionError) {
        const message = toMessage(decisionError, 'Failed to update the leave request.')
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    [load, resolveContext],
  )

  const bulkDecide = useCallback(
    async (ids: (number | string)[], status: LeaveStatus, remarks?: { hodComment?: string; hrRemarks?: string }) => {
      setProcessing(true)
      setError(null)
      setActionMessage(null)

      try {
        const response = await leaveService.bulkDecideRequests(resolveContext(), { ids, status, ...remarks })
        setActionMessage(response.message)
        await load()
        return { ok: true as const, message: response.message }
      } catch (decisionError) {
        const message = toMessage(decisionError, 'Failed to update the selected leave requests.')
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    [load, resolveContext],
  )

  /*
   * F-164. Taking your own request back.
   *
   * Two operations, not one, because the API separates them and refuses the
   * wrong one with a reason:
   *   withdraw - your own request, still PENDING. Soft-deletes it.
   *   cancel   - your own APPROVED request that has not started. Returns the
   *              days to your balance and closes any open approval step.
   *
   * Both endpoints already existed and were permission-correct. Neither had a
   * caller, so an employee could apply for leave and never take it back.
   *
   * The server's message is surfaced verbatim on success AND on refusal: it is
   * more specific than anything worth writing here ("This leave has already
   * started. Ask HR to correct it.").
   */
  const withdraw = useCallback(
    async (id: number | string) => {
      setProcessing(true)
      setError(null)
      setActionMessage(null)

      try {
        const response = await leaveService.withdrawRequest(resolveContext(), id)
        setActionMessage(response.message)
        await load()
        return { ok: true as const, message: response.message }
      } catch (withdrawError) {
        const message = toMessage(withdrawError, 'Failed to withdraw the leave request.')
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    [load, resolveContext],
  )

  const cancel = useCallback(
    async (id: number | string, reason?: string) => {
      setProcessing(true)
      setError(null)
      setActionMessage(null)

      try {
        const response = await leaveService.cancelRequest(resolveContext(), id, reason)
        setActionMessage(response.message)
        await load()
        return { ok: true as const, message: response.message }
      } catch (cancelError) {
        const message = toMessage(cancelError, 'Failed to cancel the leave request.')
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    [load, resolveContext],
  )

  return {
    loading,
    processing,
    error,
    actionMessage,
    requests,
    total,
    lastPage,
    applyLeave,
    decide,
    bulkDecide,
    withdraw,
    cancel,
    retry: load,
    clearMessages: () => {
      setError(null)
      setActionMessage(null)
    },
  }
}

/** Detail drawer - fetched on demand so the list stays light. */
export function useLeaveRequestDetail(id: number | string | null) {
  const resolveContext = useLaravelContext()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<LeaveRequestDetail | null>(null)

  const load = useCallback(async () => {
    if (!id) {
      setDetail(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await leaveService.getRequest(resolveContext(), id)
      setDetail(response.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the leave request.'))
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [id, resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  return { loading, error, detail, retry: load }
}

/* ------------------------------------------------------------------ *
 * Reports
 * ------------------------------------------------------------------ */

export function useLeaveReports(filters: LeaveReportFilters) {
  const resolveContext = useLaravelContext()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<LeaveReportSummaryData | null>(null)
  const [register, setRegister] = useState<LeaveRegisterRow[]>([])
  const [balance, setBalance] = useState<LeaveBalanceReportData | null>(null)
  /**
   * F-189. Whether a load has actually SUCCEEDED.
   *
   * On failure this hook sets summary=null, register=[], balance=null - and the
   * screen rendered that as "No leave data for this period", "Total Requests 0
   * / Approved 0 (0%)" and the insight "No leave was taken in the selected
   * period." Those are claims about an organisation's leave, produced by a
   * network error. Worse, exportCsv would then write them to
   * leave-summary-<from>-to-<to>.csv and that file leaves the building.
   *
   * Three empty datasets are indistinguishable from three empty datasets. This
   * flag is the only thing that separates them.
   */
  const [loaded, setLoaded] = useState(false)

  const filterKey = JSON.stringify(filters)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const context = resolveContext()
      const parsed = JSON.parse(filterKey) as LeaveReportFilters

      const [summaryResponse, registerResponse, balanceResponse] = await Promise.all([
        leaveService.getReportSummary(context, parsed),
        leaveService.getReportRegister(context, { ...parsed, limit: 1000 }),
        leaveService.getReportBalance(context, parsed),
      ])

      setSummary(summaryResponse.data)
      setRegister(registerResponse.data ?? [])
      setBalance(balanceResponse.data)
      setLoaded(true)
    } catch (loadError) {
      // F-189. `loaded` stays false, so the screen can tell "this organisation
      // took no leave" from "the request failed". Clearing the three datasets
      // without that distinction is what made a 500 render as a zeroed report -
      // and made it exportable.
      setLoaded(false)
      setError(toMessage(loadError, 'Failed to load the leave report.'))
      setSummary(null)
      setRegister([])
      setBalance(null)
    } finally {
      setLoading(false)
    }
  }, [filterKey, resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  return { loading, error, summary, register, balance, loaded, retry: load }
}

/* ------------------------------------------------------------------ *
 * Configuration - leave types
 * ------------------------------------------------------------------ */

export function useLeaveTypes() {
  const resolveContext = useLaravelContext()
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeConfig[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await leaveService.getLeaveTypes(resolveContext())
      setLeaveTypes(response.data ?? [])
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load leave types.'))
      setLeaveTypes([])
    } finally {
      setLoading(false)
    }
  }, [resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const run = useCallback(
    async (action: () => Promise<{ message: string }>, fallback: string) => {
      setProcessing(true)
      setError(null)
      setActionMessage(null)

      try {
        const response = await action()
        setActionMessage(response.message)
        await load()
        return { ok: true as const, message: response.message }
      } catch (actionError) {
        const message = toMessage(actionError, fallback)
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    [load],
  )

  return {
    loading,
    processing,
    error,
    actionMessage,
    leaveTypes,
    retry: load,
    clearMessages: () => {
      setError(null)
      setActionMessage(null)
    },
    save: (payload: LeaveTypePayload) =>
      run(() => leaveService.saveLeaveType(resolveContext(), payload), 'Failed to save the leave type.'),
    toggleStatus: (id: number | string, status: boolean) =>
      run(
        () => leaveService.toggleLeaveTypeStatus(resolveContext(), id, status),
        'Failed to change the leave type status.',
      ),
    remove: (id: number | string) =>
      run(() => leaveService.deleteLeaveType(resolveContext(), id), 'Failed to delete the leave type.'),
  }
}

/* ------------------------------------------------------------------ *
 * Configuration - holidays and weekly off
 * ------------------------------------------------------------------ */

export function useHolidays(calendarYear?: string) {
  const resolveContext = useLaravelContext()
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [holidays, setHolidays] = useState<LeaveHolidayRow[]>([])
  const [weekdays, setWeekdays] = useState<LeaveWeekday[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const context = resolveContext()
      const [holidayResponse, weekdayResponse] = await Promise.all([
        leaveService.getHolidays(context, { calendarYear }),
        leaveService.getWeekdays(context),
      ])

      setHolidays(holidayResponse.data ?? [])
      setWeekdays(weekdayResponse.data ?? [])
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load holidays.'))
      setHolidays([])
      setWeekdays([])
    } finally {
      setLoading(false)
    }
  }, [calendarYear, resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const run = useCallback(
    async (action: () => Promise<{ message: string }>, fallback: string) => {
      setProcessing(true)
      setError(null)
      setActionMessage(null)

      try {
        const response = await action()
        setActionMessage(response.message)
        await load()
        return { ok: true as const, message: response.message }
      } catch (actionError) {
        const message = toMessage(actionError, fallback)
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    [load],
  )

  return {
    loading,
    processing,
    error,
    actionMessage,
    holidays,
    weekdays,
    retry: load,
    clearMessages: () => {
      setError(null)
      setActionMessage(null)
    },
    save: (payload: HolidayPayload, id?: number | string) =>
      run(() => leaveService.saveHoliday(resolveContext(), payload, id), 'Failed to save the holiday.'),
    remove: (id: number | string) =>
      run(() => leaveService.deleteHoliday(resolveContext(), id), 'Failed to delete the holiday.'),
    saveWeekdays: (pattern: Record<string, string>) =>
      run(() => leaveService.saveWeekdays(resolveContext(), pattern), 'Failed to save the weekly off pattern.'),
  }
}

/* ------------------------------------------------------------------ *
 * Configuration - approval workflow and roles
 * ------------------------------------------------------------------ */

export function useLeaveWorkflow() {
  const resolveContext = useLaravelContext()
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [workflow, setWorkflow] = useState<LeaveWorkflowSettings | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await leaveService.getWorkflow(resolveContext())
      setWorkflow(response.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the approval workflow.'))
      setWorkflow(null)
    } finally {
      setLoading(false)
    }
  }, [resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const save = useCallback(
    async (settings: Omit<LeaveWorkflowSettings, 'id'>) => {
      setProcessing(true)
      setError(null)
      setActionMessage(null)

      try {
        const response = await leaveService.saveWorkflow(resolveContext(), settings)
        setWorkflow(response.data)
        setActionMessage(response.message)
        return { ok: true as const, message: response.message }
      } catch (saveError) {
        const message = toMessage(saveError, 'Failed to save the approval workflow.')
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    [resolveContext],
  )

  return {
    loading,
    processing,
    error,
    actionMessage,
    workflow,
    save,
    retry: load,
    clearMessages: () => {
      setError(null)
      setActionMessage(null)
    },
  }
}

export function useLeaveRoles() {
  const resolveContext = useLaravelContext()
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [roles, setRoles] = useState<LeaveRolePermission[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await leaveService.getRoles(resolveContext())
      setRoles(response.data ?? [])
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load role permissions.'))
      setRoles([])
    } finally {
      setLoading(false)
    }
  }, [resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const save = useCallback(
    async (next: LeaveRolePermission[]) => {
      setProcessing(true)
      setError(null)
      setActionMessage(null)

      try {
        const response = await leaveService.saveRoles(resolveContext(), next)
        setRoles(response.data ?? next)
        setActionMessage(response.message)
        return { ok: true as const, message: response.message }
      } catch (saveError) {
        const message = toMessage(saveError, 'Failed to save role permissions.')
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    [resolveContext],
  )

  return {
    loading,
    processing,
    error,
    actionMessage,
    roles,
    setRoles,
    save,
    retry: load,
    clearMessages: () => {
      setError(null)
      setActionMessage(null)
    },
  }
}

/* ------------------------------------------------------------------ *
 * Presentation helpers shared by the Leave screens
 * ------------------------------------------------------------------ */

/** Laravel's status vocabulary, mapped to the labels the design system shows. */
export const LEAVE_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  sent_back: 'Sent Back',
  cancelled: 'Cancelled',
  approved_lwp: 'Approved LWP',
}

export function leaveStatusLabel(status: string) {
  return LEAVE_STATUS_LABELS[status] ?? status
}

/** StatusBadge understands the hyphenated form the design system already uses. */
export function leaveStatusTone(status: string) {
  return status === 'sent_back' ? 'sent-back' : status
}

export function useLeaveTypeOptions(options: LeaveOptionsData | null) {
  return useMemo(
    () => (options?.leave_types ?? []).map((type) => ({ value: type.value, label: type.label })),
    [options],
  )
}

export function useDepartmentOptions(options: LeaveOptionsData | null) {
  return useMemo(
    () => (options?.departments ?? []).map((department) => ({ value: department.value, label: department.label })),
    [options],
  )
}
