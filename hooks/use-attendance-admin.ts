'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import {
  hrmsService,
  type AttendanceCorrectionPayload,
  type AttendanceEditRow,
  type AttendanceGridDay,
  type AttendanceGridEmployee,
} from '@/services/hrms'

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

  const loadEdits = useCallback(
    async (params?: { userId?: number | string }) => {
      if (authLoading || !user) return
      setEditsLoading(true)
      setEditsError(null)
      try {
        const response = await hrmsService.getAttendanceEdits(getLaravelContext(user), {
          month,
          ...(params?.userId ? { userId: params.userId } : {}),
        })
        setEdits(response.data ?? [])
      } catch (caught) {
        setEditsError(toMessage(caught, 'Could not load the change history.'))
        setEdits([])
      } finally {
        setEditsLoading(false)
      }
    },
    [authLoading, user, month],
  )

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
    [loadGrid, user],
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
      setIsSaving(false)
      return { ok, failed }
    },
    [loadGrid, user],
  )

  const monthLabel = useMemo(() => {
    const [year, mon] = month.split('-').map(Number)
    if (!year || !mon) return month
    return new Date(year, mon - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  }, [month])

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
    edits, editsLoading, editsError, loadEdits,
  }
}
