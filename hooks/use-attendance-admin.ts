'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import {
  hrmsService,
  type AttendanceCorrectionPayload,
  type AttendanceEditRow,
  type AttendanceEditsResponse,
  type AttendanceGridDay,
  type AttendanceGridEmployee,
} from '@/services/hrms'

type AttendanceEditsMeta = NonNullable<AttendanceEditsResponse['meta']>

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/** "YYYY-MM" for a Date. */
function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * The HR attendance desk - GET /attendance/admin/grid, POST
 * /attendance/admin/corrections, GET /attendance/admin/edits.
 *
 * ── THE SCREEN THIS SERVES DID NOT EXIST ────────────────────────────────────
 *
 * Attendance Tracking is an employee's own screen: punch in, punch out, see my
 * month. There was nothing for the person who has to CORRECT it. Three things
 * came close and none was usable - `update_user_att` has no caller in any
 * surface and writes across tenants; the two punch endpoints were self-service
 * gated only on "is logged in"; and the regularisation path writes correctly
 * but only ever for a request the employee raised themselves.
 *
 * ── ONE REQUEST FOR THE GRID, DELIBERATELY ──────────────────────────────────
 *
 * The grid is a single call. Built on the per-employee monthly report - the only
 * other endpoint that returns a month day by day - it would have been one
 * request per employee: fifty for a department, 2,283 for an organisation.
 *
 * ── NO ROLE GATE HERE ───────────────────────────────────────────────────────
 *
 * A hook is a hint, never the gate (F-91). The route carries profile:admin,hr
 * and the controller additionally checks that the employee being corrected is
 * in the caller's organisation - a role gate alone would let HR of one tenant
 * reach an employee id in another. Refusals are surfaced as the server words
 * them; its 404 for a cross-tenant employee is more precise than anything
 * worth inventing here.
 */
export function useAttendanceAdmin() {
  const { user, isLoading: authLoading } = useAuth()

  const [month, setMonth] = useState(() => monthKey(new Date()))
  const [departmentId, setDepartmentId] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPageRaw, setPerPageRaw] = useState(25)
  const perPage = perPageRaw

  const [days, setDays] = useState<AttendanceGridDay[]>([])
  const [employees, setEmployees] = useState<AttendanceGridEmployee[]>([])
  const [meta, setMeta] = useState({ page: 1, per_page: 25, total: 0, total_pages: 1, without_roster: 0 })
  const [departments, setDepartments] = useState<Array<{ value: string; label: string }>>([])

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [edits, setEdits] = useState<AttendanceEditRow[]>([])
  const [editsLoading, setEditsLoading] = useState(false)
  const [editsError, setEditsError] = useState<string | null>(null)
  const [editsMeta, setEditsMeta] = useState<AttendanceEditsMeta | null>(null)
  /** When the history last came back, so the screen can show its own freshness. */
  const [editsLoadedAt, setEditsLoadedAt] = useState<number | null>(null)

  /*
   * THE HISTORY'S OWN FILTERS, DECOUPLED FROM THE GRID'S.
   *
   * `month` above is shared grid state, and its setter also resets the page.
   * The history tab was handed that setter - so changing the month while
   * reading the history silently re-paged and re-fetched the grid sitting
   * behind it, and the user had no way to know.
   *
   * Seeded from the grid's month on first use and never written back.
   */
  const [historyMonth, setHistoryMonth] = useState<string | null>(null)
  const [historyUserId, setHistoryUserId] = useState<number | null>(null)
  const [historyDay, setHistoryDay] = useState<string | null>(null)

  /**
   * Poll the history while the tab is open. OFF by default.
   *
   * "Real time" was the ask, and this is the honest version of it: a visible
   * toggle whose cost the user can see and switch off, rather than a hidden
   * interval running all day on a 50-row join to catch an event that almost
   * always originates in this very tab.
   */
  const [liveHistory, setLiveHistory] = useState(false)

  /*
   * Whether the history has ever been loaded.
   *
   * A write invalidates it only if it has - so somebody who never opens the tab
   * pays nothing, and somebody watching it sees their own correction appear
   * without touching anything.
   */
  const editsEverLoaded = useRef(false)

  /*
   * The search box types faster than the request returns. Without a sequence
   * guard the grid can land on an older response and show results for a query
   * the user has already moved past - the classic last-write-wins race, and it
   * looks exactly like a broken filter.
   */
  const requestSeq = useRef(0)

  const loadGrid = useCallback(
    async (options?: { quiet?: boolean }) => {
      if (authLoading || !user) return

      const seq = requestSeq.current + 1
      requestSeq.current = seq

      if (!options?.quiet) setIsLoading(true)
      setError(null)

      try {
        const context = getLaravelContext(user)
        const response = await hrmsService.getAttendanceGrid(context, {
          month,
          departmentId,
          search: search.trim() || undefined,
          page,
          perPage,
        })

        if (requestSeq.current !== seq) return   // a newer request has started

        setDays(response.data?.days ?? [])
        setEmployees(response.data?.employees ?? [])
        if (response.data?.meta) setMeta(response.data.meta)
      } catch (caught) {
        if (requestSeq.current !== seq) return
        setError(toMessage(caught, 'Could not load the attendance grid.'))
        setDays([])
        setEmployees([])
      } finally {
        if (requestSeq.current === seq) setIsLoading(false)
      }
    },
    [authLoading, user, month, departmentId, search, page, perPage],
  )

  /* The department list, for the filter. Scoped to the caller's institute by
   * the route, so it needs no tenant argument of its own. */
  useEffect(() => {
    if (authLoading || !user) return
    let cancelled = false

    void (async () => {
      try {
        const response = await hrmsService.getAttendanceReportIndex(getLaravelContext(user))
        if (cancelled) return

        /*
         * Three shapes, not one. AttendanceReportIndexResponse.departments is
         * typed `Record<string,string> | string[] | AttendanceOption[]` because
         * the endpoint has answered all three over its life - today it is a
         * pluck('department','id'), so a Record, but assuming that is how the
         * filter silently empties the next time the controller changes.
         * Normalised the same way use-monthly-attendance does it.
         */
        const raw = response.departments
        const list: Array<{ value: string; label: string }> = Array.isArray(raw)
          ? raw.map((entry) =>
              typeof entry === 'string'
                ? { value: entry, label: entry }
                : { value: String(entry.value ?? ''), label: String(entry.label ?? '') },
            )
          : Object.entries(raw ?? {}).map(([value, label]) => ({ value, label: String(label) }))

        setDepartments(list.filter((entry) => entry.value !== '' && entry.label !== ''))
      } catch {
        // A missing department list is not worth failing the screen over - the
        // grid works unfiltered, and the filter simply stays empty.
        if (!cancelled) setDepartments([])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [authLoading, user])

  /* Debounced on the search term; immediate on every other filter. */
  useEffect(() => {
    const handle = setTimeout(() => void loadGrid(), search ? 350 : 0)
    return () => clearTimeout(handle)
  }, [loadGrid, search])

  /*
   * Narrowing the result has to return to page 1 - page 4 of a shorter list is
   * blank, and a blank grid reads as "no data" rather than "wrong page".
   *
   * Done in the setters rather than in an effect on purpose. As an effect it
   * fired a second request on every filter change: loadGrid depends on the
   * filter AND the page, so the filter change fetched with the stale page and
   * the follow-up setPage fetched again. One transition, one request.
   */
  const setMonthFiltered = useCallback((value: string) => {
    setMonth(value)
    setPage(1)
  }, [])

  const setDepartmentFiltered = useCallback((value: string) => {
    setDepartmentId(value)
    setPage(1)
  }, [])

  const setSearchFiltered = useCallback((value: string) => {
    setSearch(value)
    setPage(1)
  }, [])

  const setPerPageFiltered = useCallback((value: number) => {
    setPerPageRaw(value)
    setPage(1)
  }, [])

  /**
   * Load the change history.
   *
   * Reads the history's OWN filters, falling back to the grid's month only for
   * the very first load - see the state block for why they are separate.
   *
   * `quiet` skips the spinner, for the background refetches: a list that blinks
   * every time you tab back to the window is worse than one that just updates.
   */
  const loadEdits = useCallback(
    async (options?: { userId?: number | string; day?: string | null; quiet?: boolean }) => {
      if (authLoading || !user) return

      editsEverLoaded.current = true

      if (!options?.quiet) setEditsLoading(true)
      setEditsError(null)

      try {
        const response = await hrmsService.getAttendanceEdits(getLaravelContext(user), {
          month: historyMonth ?? month,
          ...(options?.userId !== undefined
            ? { userId: options.userId }
            : historyUserId !== null
              ? { userId: historyUserId }
              : {}),
          ...(options?.day !== undefined
            ? (options.day ? { day: options.day } : {})
            : historyDay
              ? { day: historyDay }
              : {}),
        })
        setEdits(response.data ?? [])
        setEditsMeta(response.meta ?? null)
        setEditsLoadedAt(Date.now())
      } catch (caught) {
        setEditsError(toMessage(caught, 'Could not load the change history.'))
        setEdits([])
        setEditsMeta(null)
      } finally {
        if (!options?.quiet) setEditsLoading(false)
      }
    },
    [authLoading, user, month, historyMonth, historyUserId, historyDay],
  )

  /**
   * Show one employee's changes, optionally for one day.
   *
   * This is the drill-down the grid's own comment has always promised - "the
   * screen shows WHO and WHY from /admin/edits when a marked cell is opened" -
   * and which was never wired. Called from a changed cell's reveal.
   */
  const focusHistory = useCallback(
    (userId: number | null, day?: string | null) => {
      setHistoryUserId(userId)
      setHistoryDay(day ?? null)
      if (day) setHistoryMonth(day.slice(0, 7))
    },
    [],
  )

  const clearHistoryFilters = useCallback(() => {
    setHistoryUserId(null)
    setHistoryDay(null)
  }, [])

  /**
   * Apply one correction.
   *
   * Returns true on success so the caller can close its dialog only when the
   * write actually landed. Reloads the grid quietly afterwards - the cell has
   * to change, and the `edited` marker on it comes from the server.
   */
  const correct = useCallback(
    async (payload: AttendanceCorrectionPayload): Promise<boolean> => {
      setIsSaving(true)
      setError(null)
      setNotice(null)
      try {
        const response = await hrmsService.correctAttendance(getLaravelContext(user), payload)
        setNotice(response.message || 'Attendance corrected.')
        await loadGrid({ quiet: true })
        // The history is stale the moment this lands. Refetched only if the tab
        // has ever been opened, so this costs nothing for somebody who never
        // looks at it.
        if (editsEverLoaded.current) void loadEdits({ quiet: true })
        return true
      } catch (caught) {
        setError(toMessage(caught, 'Could not change this day.'))
        return false
      } finally {
        setIsSaving(false)
      }
    },
    // `user` because getLaravelContext(user) reads it - without it this closes
    // over the identity that was signed in when the callback was first built.
    // `loadEdits` because this invalidates the history, and loadEdits carries
    // the history's own month/employee/day filters - a stale copy would refetch
    // with filters the user has already moved past.
    [loadGrid, user, loadEdits],
  )

  /**
   * Apply many corrections - the bulk action.
   *
   * allSettled, not all: a partial failure must report what actually happened.
   * "Changed 18 of 20" is the truth and is useful; "changed 20" when two were
   * refused is the kind of claim that gets found at payroll.
   */
  const correctMany = useCallback(
    async (payloads: AttendanceCorrectionPayload[]): Promise<{ ok: number; failed: number }> => {
      if (payloads.length === 0) return { ok: 0, failed: 0 }

      setIsSaving(true)
      setError(null)
      setNotice(null)

      const context = getLaravelContext(user)
      const results = await Promise.allSettled(
        payloads.map((payload) => hrmsService.correctAttendance(context, payload)),
      )

      const ok = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.length - ok

      if (failed === 0) {
        setNotice(`Changed ${ok} ${ok === 1 ? 'day' : 'days'}.`)
      } else {
        setError(
          `Changed ${ok} of ${results.length}. ${failed} could not be changed` +
            ' - the rest were applied.',
        )
      }

      await loadGrid({ quiet: true })
      if (editsEverLoaded.current) void loadEdits({ quiet: true })
      setIsSaving(false)
      return { ok, failed }
    },
    [loadGrid, user, loadEdits],
  )

  /*
   * "REAL TIME", THE HONEST VERSION.
   *
   * Three mechanisms, in order of how much of reality each covers:
   *
   * 1. Invalidation after a write (above). The person who changed something is
   *    almost always the person looking at the list, so this is most of it.
   * 2. Refetch when the window comes back. Covers the other HR user's write
   *    without any polling at all. Thresholded, so alt-tabbing is not a
   *    request storm.
   * 3. An opt-in interval, off by default, for somebody who genuinely wants to
   *    watch. A toggle makes the cost legible instead of hidden.
   *
   * Polling as the DEFAULT was rejected: a 15-second interval on a two-join
   * query, on a tab an HR user leaves open all day, to catch an event that
   * usually originates in that very tab.
   *
   * Optimistic append was rejected too - the correction response carries
   * neither the edit row's id nor the actor's display name, so an appended row
   * would be a partial fiction that then gets replaced by the real one.
   */
  const STALE_AFTER_MS = 20_000

  const refetchEditsIfStale = useCallback(() => {
    if (!editsEverLoaded.current) return
    if (editsLoadedAt !== null && Date.now() - editsLoadedAt < STALE_AFTER_MS) return
    void loadEdits({ quiet: true })
  }, [editsLoadedAt, loadEdits])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const onVisible = () => {
      if (document.visibilityState === 'visible') refetchEditsIfStale()
    }

    window.addEventListener('focus', refetchEditsIfStale)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.removeEventListener('focus', refetchEditsIfStale)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refetchEditsIfStale])

  useEffect(() => {
    if (!liveHistory) return
    if (typeof window === 'undefined') return

    const handle = setInterval(() => {
      // Only while the tab is actually being looked at - a background tab
      // polling every 30 seconds is pure waste.
      if (document.visibilityState === 'visible') void loadEdits({ quiet: true })
    }, 30_000)

    return () => clearInterval(handle)
  }, [liveHistory, loadEdits])

  const prettyMonth = (value: string) => {
    const [year, mon] = value.split('-').map(Number)
    if (!year || !mon) return value
    return new Date(year, mon - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  }

  const monthLabel = useMemo(() => prettyMonth(month), [month])
  const historyMonthLabel = useMemo(
    () => prettyMonth(historyMonth ?? month),
    [historyMonth, month],
  )

  return {
    // filters - the setters reset the page, see above
    month, setMonth: setMonthFiltered, monthLabel,
    departmentId, setDepartmentId: setDepartmentFiltered, departments,
    search, setSearch: setSearchFiltered,
    page, setPage, perPage, setPerPage: setPerPageFiltered,

    // the grid
    days, employees, meta,
    isLoading, error, notice, setNotice, setError,
    refresh: loadGrid,

    // writes
    correct, correctMany, isSaving,

    // the trail
    edits, editsLoading, editsError, editsMeta, editsLoadedAt, loadEdits,
    // its own filters, deliberately not the grid's
    historyMonth: historyMonth ?? month,
    setHistoryMonth,
    historyMonthLabel,
    historyUserId, historyDay,
    focusHistory, clearHistoryFilters,
    liveHistory, setLiveHistory,
  }
}
