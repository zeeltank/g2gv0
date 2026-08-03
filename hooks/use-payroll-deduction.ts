'use client'

import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { isLaravelContextReady } from '@/lib/laravel-context'
import { payrollEmployeeLabel, toMessage, useLaravelContext } from '@/hooks/use-payroll-shared'
import {
  payrollService,
  toRecord,
  type PayrollDeductionOption,
  type PayrollDeductionResponse,
} from '@/services/hrms'

export type DeductionCategory = '1' | '2'

export const DEDUCTION_CATEGORY_LABELS: Record<DeductionCategory, string> = {
  '1': 'Allowance',
  '2': 'Deduction',
}

export interface DeductionRow {
  employeeId: number | string
  employeeNo: string
  name: string
  department: string
  /** Current input value. */
  amount: string
  /** What the backend last returned, so unsaved edits can be flagged. */
  savedAmount: string
}

export interface DeductionQuery {
  payrollTypeId: string
  month: string
  year: string
}

/**
 * Payroll Deduction - GET /payroll-deduction and POST /payroll-deduction/store.
 *
 * One payroll head, one month and one year at a time: the screen lists every
 * employee and captures a per-employee adjustment on top of the salary
 * structure, which Monthly Payroll then folds into the payslip.
 */
export function usePayrollDeduction() {
  const resolveContext = useLaravelContext()
  const { isLoading: authLoading } = useAuth()

  const [loading, setLoading] = useState(false)
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [rows, setRows] = useState<DeductionRow[]>([])
  const [months, setMonths] = useState<string[]>([])
  const [years, setYears] = useState<string[]>([])
  const [headsByCategory, setHeadsByCategory] = useState<Record<string, PayrollDeductionOption[]>>({})
  const [lastQuery, setLastQuery] = useState<DeductionQuery | null>(null)

  const applyOptions = useCallback((response: PayrollDeductionResponse) => {
    setHeadsByCategory(toRecord<PayrollDeductionOption[]>(response.payrollTypes))
    setMonths(response.months ?? [])
    setYears((response.years ?? []).map(String))
  }, [])

  /**
   * The index action is also the option source, so it is called once with no
   * payroll head just to populate the head/month/year pickers.
   */
  useEffect(() => {
    if (authLoading) return
    let cancelled = false

    const load = async () => {
      const context = resolveContext()
      if (!isLaravelContextReady(context)) {
        setError('Your session could not be resolved. Please sign in again.')
        setOptionsLoading(false)
        return
      }

      try {
        const response = await payrollService.getPayrollDeductions(context, {
          payrollTypeId: '',
          month: '',
          year: String(new Date().getFullYear()),
        })
        if (!cancelled) applyOptions(response)
      } catch (loadError) {
        if (!cancelled) setError(toMessage(loadError, 'Failed to load payroll deduction options.'))
      } finally {
        if (!cancelled) setOptionsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [applyOptions, authLoading, resolveContext])

  const search = useCallback(
    async (query: DeductionQuery) => {
      setLoading(true)
      setError(null)
      setActionMessage(null)
      setLastQuery(query)

      const context = resolveContext()
      if (!isLaravelContextReady(context)) {
        setError('Your session could not be resolved. Please sign in again.')
        setLoading(false)
        return
      }

      try {
        const response = await payrollService.getPayrollDeductions(context, query)
        applyOptions(response)

        const saved = toRecord<number | string>(response.deductionArr)
        setRows(
          (response.all_emp ?? []).map((employee) => {
            const amount = saved[String(employee.id)]
            const value = amount === undefined || amount === null ? '' : String(amount)
            return {
              employeeId: employee.id,
              employeeNo: employee.employee_no ?? '',
              name: payrollEmployeeLabel(employee),
              department: employee.department ?? '-',
              amount: value,
              savedAmount: value,
            }
          }),
        )
        setSearched(true)
      } catch (loadError) {
        setError(toMessage(loadError, 'Failed to load employees for this payroll head.'))
        setRows([])
        setSearched(true)
      } finally {
        setLoading(false)
      }
    },
    [applyOptions, resolveContext],
  )

  const setAmount = useCallback((employeeId: number | string, amount: string) => {
    setRows((previous) =>
      previous.map((row) => (String(row.employeeId) === String(employeeId) ? { ...row, amount } : row)),
    )
  }, [])

  return {
    loading,
    optionsLoading,
    processing,
    error,
    actionMessage,
    searched,
    rows,
    months,
    years,
    headsByCategory,
    lastQuery,
    search,
    setAmount,
    retry: () => (lastQuery ? search(lastQuery) : undefined),
    clearMessages: () => {
      setError(null)
      setActionMessage(null)
    },
    save: async () => {
      if (!lastQuery) {
        return { ok: false as const, message: 'Search for a payroll head before saving.' }
      }

      // payrollDeductionStore iterates deductAmt without a null guard, so an
      // empty payload would 500 rather than no-op.
      const amounts = rows
        .filter((row) => row.amount.trim() !== '')
        .map((row) => ({ employeeId: row.employeeId, amount: Number(row.amount) || 0 }))

      if (amounts.length === 0) {
        const message = 'Enter at least one amount before saving.'
        setError(message)
        return { ok: false as const, message }
      }

      setProcessing(true)
      setError(null)
      setActionMessage(null)

      try {
        const response = await payrollService.savePayrollDeductions(resolveContext(), {
          payrollTypeId: lastQuery.payrollTypeId,
          month: lastQuery.month,
          year: lastQuery.year,
          amounts,
        })
        setActionMessage(response.message)
        await search(lastQuery)
        return { ok: true as const, message: response.message }
      } catch (saveError) {
        const message = toMessage(saveError, 'Failed to save the deduction amounts.')
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
  }
}
