'use client'

import { useCallback, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { isLaravelContextReady } from '@/lib/laravel-context'
import {
  parseSalaryDataJson,
  payrollEmployeeLabel,
  toMessage,
  useLaravelContext,
  type PayrollOption,
} from '@/hooks/use-payroll-shared'
import {
  payrollService,
  toRecord,
  type MonthlyPayrollEmployee,
  type MonthlyPayrollQuery,
  type MonthlyPayrollSaveRow,
} from '@/services/hrms'

export interface MonthlyPayrollRow {
  employeeId: number | string
  employeeNo: string
  name: string
  department: string
  totalDay: string
  receivedBy: string
  /** payroll_type_id -> amount for this month */
  values: Record<string, number>
  totalDeduction: number
  totalPayment: number
  /** employee_monthly_salary_data.id, present once the month has been saved. */
  savedId: number | string | null
  isSaved: boolean
  recalculating: boolean
}

/** The three synthetic header keys Laravel appends after the payroll type ids. */
export const MONTHLY_SUMMARY_KEYS = new Set(['total_deduction', 'total_payment', 'received_by'])

function toMonthlyRow(employee: MonthlyPayrollEmployee): MonthlyPayrollRow {
  const saved = employee.monthlyData ?? null
  const values = parseSalaryDataJson(saved?.employee_salary_data)

  return {
    employeeId: employee.id,
    employeeNo: employee.employee_no ?? '',
    name: payrollEmployeeLabel(employee),
    department: employee.department ?? '-',
    totalDay: String(saved?.total_day ?? employee.totalDay ?? 0),
    receivedBy: saved?.received_by ?? 'Self',
    values,
    totalDeduction: Number(saved?.total_deduction ?? 0) || 0,
    totalPayment: Number(saved?.total_payment ?? 0) || 0,
    savedId: saved?.id ?? null,
    isSaved: Boolean(saved?.id),
    recalculating: false,
  }
}

/**
 * Monthly Payroll - GET /monthly-payroll/create, GET /getMonthlyData,
 * POST /monthly-payroll-store and POST /monthly-payroll-delete/{month}.
 *
 * Rows arrive with their attendance-derived attended days; changing that number
 * re-asks the backend for the payslip lines rather than recomputing locally,
 * because PF/PT slabs and day-wise pro-rating live in the controller.
 */
export function useMonthlyPayroll() {
  const resolveContext = useLaravelContext()
  const { user } = useAuth()

  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [rows, setRows] = useState<MonthlyPayrollRow[]>([])
  const [header, setHeader] = useState<Array<{ id: string; label: string }>>([])
  const [months, setMonths] = useState<string[]>([])
  const [years, setYears] = useState<PayrollOption[]>([])
  const [employeeOptions, setEmployeeOptions] = useState<PayrollOption[]>([])
  const [lastQuery, setLastQuery] = useState<MonthlyPayrollQuery | null>(null)

  const search = useCallback(
    async (query: MonthlyPayrollQuery) => {
      setLoading(true)
      setError(null)
      setActionMessage(null)
      setLastQuery(query)

      const context = resolveContext()
      if (!isLaravelContextReady(context)) {
        setError('Your session could not be resolved. Please sign in again.')
        setLoading(false)
        setSearched(true)
        return
      }

      try {
        const response = await payrollService.getMonthlyPayroll(context, {
          ...query,
          userProfileName: query.userProfileName ?? '',
        })

        const headerMap = toRecord<string>(response.header)
        setHeader(
          Object.entries(headerMap)
            .filter(([key]) => !MONTHLY_SUMMARY_KEYS.has(key))
            .map(([id, label]) => ({ id, label })),
        )
        setMonths(response.months ?? [])
        setYears(
          Object.entries(toRecord<string>(response.years)).map(([value, label]) => ({ value, label })),
        )

        const employees = response.employeeDetails ?? []
        setEmployeeOptions(
          employees.map((employee) => ({
            value: String(employee.id),
            label: payrollEmployeeLabel(employee),
          })),
        )
        setRows(employees.map(toMonthlyRow))

        // status_code 0 reaches the client as `status` after is_mobile renames it.
        if (String(response.status ?? '') === '0' && response.message) {
          setError(response.message)
        }
        setSearched(true)
      } catch (loadError) {
        setError(toMessage(loadError, 'Failed to load the monthly payroll.'))
        setRows([])
        setSearched(true)
      } finally {
        setLoading(false)
      }
    },
    [resolveContext],
  )

  /**
   * Re-derives one row's payslip lines for a new attended-day count. Saved rows
   * are frozen: their stored JSON is what the generated payslip PDF reflects.
   */
  const recalculate = useCallback(
    async (employeeId: number | string, totalDay: string) => {
      if (!lastQuery) return

      setRows((previous) =>
        previous.map((row) =>
          String(row.employeeId) === String(employeeId)
            ? { ...row, totalDay, recalculating: true }
            : row,
        ),
      )

      try {
        const response = await payrollService.getMonthlySalaryBreakdown(resolveContext(), {
          employeeId,
          totalDay: totalDay || '0',
          month: lastQuery.month,
          year: lastQuery.year,
        })

        if (String(response.status_code ?? '') === '0') {
          throw new Error(response.message || 'Salary structure not found for this employee.')
        }

        const salaryData = response.salaryData ?? {}
        const values: Record<string, number> = {}
        Object.entries(salaryData).forEach(([key, value]) => {
          if (!MONTHLY_SUMMARY_KEYS.has(key)) values[key] = Number(value) || 0
        })

        setRows((previous) =>
          previous.map((row) =>
            String(row.employeeId) === String(employeeId)
              ? {
                  ...row,
                  values,
                  totalDeduction: Number(salaryData.total_deduction ?? 0) || 0,
                  totalPayment: Number(salaryData.total_payment ?? 0) || 0,
                  recalculating: false,
                }
              : row,
          ),
        )
      } catch (recalcError) {
        setError(toMessage(recalcError, 'Failed to recalculate this payslip.'))
        setRows((previous) =>
          previous.map((row) =>
            String(row.employeeId) === String(employeeId) ? { ...row, recalculating: false } : row,
          ),
        )
      }
    },
    [lastQuery, resolveContext],
  )

  const setReceivedBy = useCallback((employeeId: number | string, receivedBy: string) => {
    setRows((previous) =>
      previous.map((row) =>
        String(row.employeeId) === String(employeeId) ? { ...row, receivedBy } : row,
      ),
    )
  }, [])

  const run = useCallback(
    async (action: () => Promise<{ message: string }>, fallback: string) => {
      setProcessing(true)
      setError(null)
      setActionMessage(null)

      try {
        const response = await action()
        setActionMessage(response.message)
        if (lastQuery) await search(lastQuery)
        return { ok: true as const, message: response.message }
      } catch (actionError) {
        const message = toMessage(actionError, fallback)
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    [lastQuery, search],
  )

  return {
    loading,
    processing,
    error,
    actionMessage,
    searched,
    rows,
    header,
    months,
    years,
    employeeOptions,
    lastQuery,
    currentUserRole: user?.role ?? '',
    search,
    recalculate,
    setReceivedBy,
    retry: () => (lastQuery ? search(lastQuery) : undefined),
    clearMessages: () => {
      setError(null)
      setActionMessage(null)
    },
    /**
     * Only unsaved rows are submitted. monthlyPayrollStore INSERTs with no
     * upsert, so re-posting a saved row would duplicate that month's payslip -
     * delete the row first to regenerate it.
     */
    save: async () => {
      if (!lastQuery) {
        return { ok: false as const, message: 'Search for a month before saving.' }
      }

      const pending: MonthlyPayrollSaveRow[] = rows
        .filter((row) => !row.isSaved)
        .map((row) => ({
          employeeId: row.employeeId,
          totalDay: row.totalDay || '0',
          totalDeduction: row.totalDeduction,
          totalPayment: row.totalPayment,
          receivedBy: row.receivedBy || 'Self',
          payrollHead: row.values,
        }))

      if (pending.length === 0) {
        const message = 'Every row for this month is already saved. Delete a row to regenerate it.'
        setError(message)
        return { ok: false as const, message }
      }

      return run(
        () =>
          payrollService.saveMonthlyPayroll(resolveContext(), {
            month: lastQuery.month,
            year: lastQuery.year,
            rows: pending,
          }),
        'Failed to save the monthly payroll.',
      )
    },
    remove: (row: MonthlyPayrollRow) => {
      if (!lastQuery || row.savedId === null) {
        return Promise.resolve({ ok: false as const, message: 'This row has not been saved yet.' })
      }

      return run(
        () =>
          payrollService.deleteMonthlyPayroll(resolveContext(), {
            month: lastQuery.month,
            year: lastQuery.year,
            entries: [{ dataId: row.savedId as number | string, employeeId: row.employeeId }],
          }),
        'Failed to delete this payroll record.',
      )
    },
  }
}
