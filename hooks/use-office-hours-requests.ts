'use client'

import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { hrmsService, type OfficeHoursRequestRow } from '@/services/hrms'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/**
 * The approver's side: employees' office-hours proposals, and deciding them.
 *
 * ── THE SERVER DECIDES WHO SEES THIS, NOT THIS HOOK ─────────────────────────
 *
 * It asks for `?scope=team`. The endpoint answers 403 unless the caller holds
 * BOTH an admin/hr role and `approve_leave` in `hrms_leave_role_permissions`.
 * On a 403 `permitted` goes false and the component renders nothing.
 *
 * That ordering is the point, and it is the idiom `RegularisationQueue` already
 * established: hiding a panel is not access control. Deciding what to render
 * *from what the endpoint allowed* means the two can never disagree - whereas a
 * component gating itself on `HR_ADMIN_ROLES.includes(user.role)` is a guess
 * that drifts from the server's answer the moment either changes.
 *
 * ── WHY APPROVING THIS IS NOT LIKE APPROVING A LEAVE DAY ────────────────────
 *
 * An approval writes the employee's `tbluser` weekday columns, which are a
 * payroll input: PayrollController reads `saturday_in_date` when counting
 * 2nd-Saturday lateness, and lateness is subtracted from payable days. So it
 * needs admin/hr authority on top of the leave scope - `approve_leave` alone is
 * held by Reporting Manager and Department Head in some tenants.
 */
export function useOfficeHoursRequests() {
  const { user } = useAuth()

  const [rows, setRows] = useState<OfficeHoursRequestRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [permitted, setPermitted] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)

    try {
      const response = await hrmsService.getOfficeHoursRequests(getLaravelContext(user), {
        scope: 'team',
        status: 'pending',
      })
      setPermitted(true)
      setRows(response.data ?? [])
    } catch {
      /*
       * 403 is the NORMAL case for most people - they are not an approver, so
       * this panel simply does not exist for them. Deliberately not surfaced as
       * an error: an error banner saying "you are not allowed to see this" on a
       * screen somebody legitimately opened is noise.
       */
      setPermitted(false)
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    const handle = setTimeout(() => void load(), 0)
    return () => clearTimeout(handle)
  }, [load])

  const decide = useCallback(
    async (id: number, status: 'approved' | 'rejected', comment?: string): Promise<boolean> => {
      setBusyId(id)
      setError(null)
      setNotice(null)

      try {
        const response = await hrmsService.decideOfficeHoursRequest(
          getLaravelContext(user),
          id,
          status,
          comment,
        )
        setNotice(
          response.message
            || (status === 'approved'
              ? 'Approved. The employee’s office hours have been updated.'
              : 'Rejected. Nothing was changed.'),
        )
        await load()
        return true
      } catch (caught) {
        setError(toMessage(caught, 'Could not record that decision.'))
        return false
      } finally {
        setBusyId(null)
      }
    },
    [load, user],
  )

  return { rows, isLoading, permitted, busyId, error, notice, setError, setNotice, decide, refresh: load }
}
