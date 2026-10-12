'use client'

import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import {
  hrmsService,
  type OfficeHoursDay,
  type OfficeHoursRequestPayload,
  type OfficeHoursRequestRow,
} from '@/services/hrms'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/**
 * An employee's own office hours, and their proposal to change them.
 *
 * ── ONE REQUEST, NOT THREE ──────────────────────────────────────────────────
 *
 * `GET /attendance/my-office-hours` returns the current week, the department
 * template, anything pending and the recent history together - because two of
 * those an employee is not permitted to fetch separately.
 * `/employees-management/{id}` is gated `profile:admin,hr`, so an employee
 * cannot read their own `tbluser` schedule through it.
 *
 * ── NO SUBJECT PARAMETER ANYWHERE IN HERE ───────────────────────────────────
 *
 * Every call resolves its subject from the token. A client that cannot express
 * the wrong request cannot send it, and that - not a role gate - is what makes
 * these endpoints safe for every employee to reach.
 *
 * ── NOTHING HERE CHANGES PAY ────────────────────────────────────────────────
 *
 * `submit` writes a REQUEST. Only an HR approval writes the `tbluser` weekday
 * columns, and those columns are a payroll input - PayrollController reads
 * `saturday_in_date` when counting 2nd-Saturday lateness, which is subtracted
 * from payable days. The screen says so where it is true.
 */
export function useMyOfficeHours() {
  const { user, isLoading: authLoading } = useAuth()

  const [current, setCurrent] = useState<OfficeHoursDay[]>([])
  const [template, setTemplate] = useState<OfficeHoursDay[] | null>(null)
  const [hasSchedule, setHasSchedule] = useState<boolean | null>(null)
  const [departmentName, setDepartmentName] = useState<string | null>(null)
  const [pending, setPending] = useState<OfficeHoursRequestRow | null>(null)
  const [history, setHistory] = useState<OfficeHoursRequestRow[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (authLoading || !user) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await hrmsService.getMyOfficeHours(getLaravelContext(user))
      const data = response.data

      setCurrent(data?.current ?? [])
      setTemplate(data?.template ?? null)
      setHasSchedule(data?.has_schedule ?? null)
      setDepartmentName(data?.department_name ?? null)
      setPending(data?.pending ?? null)
      setHistory(data?.history ?? [])
    } catch (caught) {
      setError(toMessage(caught, 'Could not load your office hours.'))
    } finally {
      setIsLoading(false)
    }
  }, [authLoading, user])

  /*
   * Deferred by a tick rather than called straight from the effect body - the
   * same reason as every other loader in this module: `load` sets state before
   * its first await, which from inside an effect is a cascading render.
   */
  useEffect(() => {
    const handle = setTimeout(() => void load(), 0)
    return () => clearTimeout(handle)
  }, [load])

  /**
   * Propose a change. Returns true only when it actually landed.
   *
   * Only the weekdays being changed are sent. A weekday left out is left
   * exactly as it is - which is why the server stores a row per weekday rather
   * than 21 columns: an absent row means "not asked about", and a NULL column
   * cannot distinguish that from "asked for it off".
   */
  const submit = useCallback(
    async (payload: OfficeHoursRequestPayload): Promise<boolean> => {
      setIsSaving(true)
      setError(null)
      setNotice(null)

      try {
        const response = await hrmsService.submitOfficeHoursRequest(getLaravelContext(user), payload)
        setNotice(
          response.message
            || 'Your request has been submitted. Nothing changes until HR approves it.',
        )
        await load()
        return true
      } catch (caught) {
        setError(toMessage(caught, 'Could not submit your request.'))
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [load, user],
  )

  const withdraw = useCallback(
    async (id: number): Promise<boolean> => {
      setIsSaving(true)
      setError(null)
      setNotice(null)

      try {
        const response = await hrmsService.withdrawOfficeHoursRequest(getLaravelContext(user), id)
        setNotice(response.message || 'Request withdrawn.')
        await load()
        return true
      } catch (caught) {
        setError(toMessage(caught, 'Could not withdraw your request.'))
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [load, user],
  )

  return {
    current, template, hasSchedule, departmentName, pending, history,
    isLoading, isSaving, error, notice, setError, setNotice,
    refresh: load, submit, withdraw,
  }
}
