'use client'

import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { toMessage, useLaravelContext } from '@/hooks/use-payroll-shared'
import { payrollService, type DeductionOrphan } from '@/services/hrms'

/** Why this row's pay head cannot be used, if it cannot. */
export type HeadProblem = 'missing' | 'deleted' | 'inactive' | 'foreign' | null

export interface OrphanRow {
  id: number | string
  /** The raw stored month - "8", "3". Shown verbatim; never normalised. */
  storedMonth: string
  year: string
  employeeId: number | string
  employeeNo: string
  employeeName: string
  headId: number | string
  headName: string
  headProblem: HeadProblem
  amount: number
  /** When it was entered - see DeductionOrphan.created_at. */
  enteredOn: string
}

function num(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function headProblem(row: DeductionOrphan, tenantId: string | number | undefined): HeadProblem {
  if (!row.payroll_name) return 'missing'
  if (row.head_deleted_at) return 'deleted'
  if (tenantId !== undefined && String(row.head_tenant ?? '') !== String(tenantId)) return 'foreign'
  if (String(row.head_status ?? '') !== '1') return 'inactive'
  return null
}

export const HEAD_PROBLEM_LABELS: Record<Exclude<HeadProblem, null>, string> = {
  missing: 'this pay head no longer exists',
  deleted: 'this pay head was deleted',
  inactive: 'this pay head is switched off',
  foreign: 'this pay head belongs to another organisation',
}

/**
 * Q9 / F-173. The payroll adjustments the calculation has never found.
 *
 * hrms_emp_payroll_deduction.month is matched exactly against the spelling the
 * screen posts ("Aug"). Eleven of the twelve live rows are spelled "8", "2" or
 * "3", so every payroll run since has skipped them - 343,001 entered by people
 * who watched the screen say it saved.
 *
 * F-143 stopped new ones being written and deliberately left these alone,
 * because "3" could be March or a March-year convention and only the tenant
 * knows which. This hook surfaces them; it never repairs one by itself.
 *
 * Note what it also exposes: all eleven point at pay head 2, which is itself
 * soft-deleted. Re-dating alone would not make them apply, so the head problem
 * is shown alongside the month problem rather than discovered afterwards.
 */
export function useDeductionOrphans() {
  const resolveContext = useLaravelContext()
  const { user, isLoading: authLoading } = useAuth()

  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [rows, setRows] = useState<OrphanRow[]>([])
  const [months, setMonths] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  /** Null until a load has actually succeeded, so "none" is never inferred from a failure. */
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await payrollService.getDeductionOrphans(resolveContext())
      const list = response.orphans ?? []

      setRows(
        list.map((row) => ({
          id: row.id,
          storedMonth: String(row.month ?? ''),
          year: String(row.year ?? ''),
          employeeId: row.employee_id,
          employeeNo: String(row.employee_no ?? '').trim(),
          employeeName:
            String(row.employee_name ?? '').replace(/\s+/g, ' ').trim() ||
            `Employee ${row.employee_id}`,
          headId: row.deduction_type,
          headName: String(row.payroll_name ?? '').trim() || `Head #${row.deduction_type}`,
          headProblem: headProblem(row, user?.subInstituteId),
          amount: num(row.deduction_amount),
          enteredOn: String(row.created_at ?? '').slice(0, 10),
        })),
      )
      setMonths(response.months ?? [])
      setTotal(num(response.total))
      setLoaded(true)
    } catch (loadError) {
      // A failed fetch is not "there are no orphans". On this panel that
      // distinction matters more than usual: the panel's absence is how HR
      // would conclude the problem is gone.
      setRows([])
      setLoaded(false)
      setError(toMessage(loadError, 'Could not check for unapplied adjustments.'))
    } finally {
      setLoading(false)
    }
  }, [resolveContext, user?.subInstituteId])

  useEffect(() => {
    if (authLoading) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading])

  const resolve = useCallback(
    async (id: number | string, action: 'set-month' | 'delete', month?: string) => {
      setProcessing(true)
      setError(null)
      setActionMessage(null)

      try {
        const response = await payrollService.resolveDeductionOrphan(resolveContext(), {
          id,
          action,
          month,
        })

        // The legacy envelope reports refusal in the body, not the status code,
        // so a 200 is not on its own a success.
        if (String(response.status_code ?? '') !== '200') {
          const message = response.message ?? 'That adjustment could not be updated.'
          setError(message)
          return { ok: false as const, message }
        }

        setActionMessage(response.message ?? 'Adjustment updated.')
        await load()
        return { ok: true as const, message: response.message ?? '' }
      } catch (resolveError) {
        const message = toMessage(resolveError, 'That adjustment could not be updated.')
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    [resolveContext, load],
  )

  return {
    loading,
    processing,
    error,
    actionMessage,
    rows,
    months,
    total,
    loaded,
    resolve,
    retry: load,
    clearMessages: () => {
      setError(null)
      setActionMessage(null)
    },
  }
}
