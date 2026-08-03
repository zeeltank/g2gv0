'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { isLaravelContextReady } from '@/lib/laravel-context'
import { toMessage, useLaravelContext } from '@/hooks/use-payroll-shared'
import {
  normalizePayrollType,
  payrollService,
  payrollTypeToPayload,
  type PayrollTypePayload,
  type PayrollTypeRow,
} from '@/services/hrms'

export interface PayrollTypeSummary {
  total: number
  active: number
  inactive: number
  earnings: number
  deductions: number
}

/**
 * Payroll Type master - GET /payroll-type, POST /payroll-type/store and
 * POST /payroll-type/destroy/{id}.
 *
 * The list endpoint returns every non-deleted row for the tenant (active and
 * inactive alike), so the KPI counts and the Earnings/Deductions tabs are all
 * derived from this one response rather than from extra requests.
 */
export function usePayrollTypes() {
  const resolveContext = useLaravelContext()
  const { isLoading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [payrollTypes, setPayrollTypes] = useState<PayrollTypeRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const context = resolveContext()

    // Firing without a token would only ever earn a 401 from the controller.
    if (!isLaravelContextReady(context)) {
      setPayrollTypes([])
      setError('Your session could not be resolved. Please sign in again.')
      setLoading(false)
      return
    }

    try {
      const response = await payrollService.getPayrollTypes(context)
      setPayrollTypes((response.data ?? []).map(normalizePayrollType))
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load payroll types.'))
      setPayrollTypes([])
    } finally {
      setLoading(false)
    }
  }, [resolveContext])

  useEffect(() => {
    if (authLoading) return
    queueMicrotask(() => {
      load()
    })
  }, [authLoading, load])

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

  const summary = useMemo<PayrollTypeSummary>(
    () => ({
      total: payrollTypes.length,
      active: payrollTypes.filter((row) => row.status === 'Active').length,
      inactive: payrollTypes.filter((row) => row.status === 'Inactive').length,
      earnings: payrollTypes.filter((row) => row.kind === 'Earning').length,
      deductions: payrollTypes.filter((row) => row.kind === 'Deduction').length,
    }),
    [payrollTypes],
  )

  return {
    loading,
    processing,
    error,
    actionMessage,
    payrollTypes,
    summary,
    retry: load,
    clearMessages: () => {
      setError(null)
      setActionMessage(null)
    },
    save: (payload: PayrollTypePayload) =>
      run(
        () => payrollService.savePayrollType(resolveContext(), payload),
        'Failed to save the payroll type.',
      ),
    /**
     * There is no dedicated status route - payrollStore is the only writer, and
     * it overwrites every column, so the whole row is resent with status flipped.
     */
    toggleStatus: (row: PayrollTypeRow) =>
      run(
        () =>
          payrollService.savePayrollType(resolveContext(), {
            ...payrollTypeToPayload(row),
            status: row.status === 'Active' ? 'Inactive' : 'Active',
          }),
        'Failed to change the payroll type status.',
      ),
    remove: (id: number | string) =>
      run(
        () => payrollService.deletePayrollType(resolveContext(), id),
        'Failed to delete the payroll type.',
      ),
  }
}
