'use client'

import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { isLaravelContextReady } from '@/lib/laravel-context'
import {
  payrollEmployeeLabel,
  toMessage,
  useLaravelContext,
  type PayrollOption,
} from '@/hooks/use-payroll-shared'
import {
  payrollService,
  toRecord,
  type LaravelPayrollType,
  type SalaryStructureQuery,
} from '@/services/hrms'

export interface SalaryStructureRow {
  employeeId: number | string
  employeeNo: string
  name: string
  department: string
  departmentId: string
  gender: string
  status: 'Active' | 'Inactive'
  /** payroll_type_id (as a string key) -> amount */
  values: Record<string, number>
  /**
   * F-174 / Q10. Amounts stored against heads this grid does NOT render,
   * because the head is deactivated, soft-deleted, or belongs to another
   * organisation.
   *
   * They are kept so a Save can post them back: employeeSalaryStructureStore
   * overwrites employee_salary_data with exactly what it receives, so a head
   * that is not posted is a head that has been deleted. They are also what the
   * warning above the grid counts.
   */
  carriedValues: Record<string, number>
}

/** Earnings add, deductions subtract - the same arithmetic the payslip uses. */
export function salaryStructureNet(row: SalaryStructureRow, payrollTypes: LaravelPayrollType[]) {
  return payrollTypes.reduce((total, payrollType) => {
    const amount = Number(row.values[String(payrollType.id)] ?? 0) || 0
    return String(payrollType.payroll_type) === '1' ? total + amount : total - amount
  }, 0)
}

/**
 * Employee Salary Structure - GET /employee-salary-structure and
 * POST /employee-salary-structure/store, plus the year rollover.
 *
 * The grid is one row per employee and one column per active payroll type; the
 * saved amounts arrive keyed by employee then payroll type id.
 */
export function useSalaryStructure() {
  const resolveContext = useLaravelContext()
  const { isLoading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [payrollTypes, setPayrollTypes] = useState<LaravelPayrollType[]>([])
  const [rows, setRows] = useState<SalaryStructureRow[]>([])
  const [employeeOptions, setEmployeeOptions] = useState<PayrollOption[]>([])
  const [lastQuery, setLastQuery] = useState<SalaryStructureQuery | null>(null)

  const search = useCallback(
    async (query: SalaryStructureQuery) => {
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
        const response = await payrollService.getSalaryStructure(context, query)
        const types = response.payrollTypes ?? []
        // `employees` is the filtered result, `employeeLists` the picker source.
        const employees = response.employees ?? response.employeeLists ?? []
        const saved = toRecord<Record<string, number | string>>(response.employeeSalaryStructures)

        setPayrollTypes(types)
        setEmployeeOptions(
          (response.employeeLists ?? employees).map((employee) => ({
            value: String(employee.id),
            label: payrollEmployeeLabel(employee),
          })),
        )
        setRows(
          employees.map((employee) => {
            const savedValues = saved[String(employee.id)] ?? {}
            const values: Record<string, number> = {}
            types.forEach((payrollType) => {
              values[String(payrollType.id)] = Number(savedValues[String(payrollType.id)] ?? 0) || 0
            })

            /*
             * F-174. Everything the grid will not show.
             *
             * `types` is payroll_types WHERE status = 1, so a structure that
             * references a deactivated, deleted or foreign head has amounts
             * with nowhere to render. Before this they were simply dropped -
             * and because Save rewrites the whole JSON from the posted rows,
             * dropping them on load meant DELETING them on save. An ordinary
             * Save on a screen nobody had edited destroyed them.
             */
            const active = new Set(types.map((payrollType) => String(payrollType.id)))
            const carriedValues: Record<string, number> = {}
            Object.entries(savedValues).forEach(([headId, amount]) => {
              if (active.has(String(headId))) return
              const parsed = Number(amount)
              if (Number.isFinite(parsed) && parsed !== 0) carriedValues[String(headId)] = parsed
            })

            return {
              employeeId: employee.id,
              employeeNo: employee.employee_no ?? '',
              name: payrollEmployeeLabel(employee),
              department: employee.department ?? '-',
              departmentId: String(employee.department_id ?? ''),
              gender: employee.gender ?? '',
              status: String(employee.status ?? '1') === '1' ? 'Active' : 'Inactive',
              values,
              carriedValues,
            }
          }),
        )
        setSearched(true)
      } catch (loadError) {
        setError(toMessage(loadError, 'Failed to load salary structures.'))
        setRows([])
        setPayrollTypes([])
        setSearched(true)
      } finally {
        setLoading(false)
      }
    },
    [resolveContext],
  )

  // Default view: the current year's active employees, once auth has settled.
  useEffect(() => {
    if (authLoading || searched) return
    queueMicrotask(() => {
      search({ year: String(new Date().getFullYear()), employeeStatus: '1' })
    })
  }, [authLoading, search, searched])

  const setValue = useCallback(
    (employeeId: number | string, payrollTypeId: string, amount: number) => {
      setRows((previous) =>
        previous.map((row) =>
          String(row.employeeId) === String(employeeId)
            ? { ...row, values: { ...row.values, [payrollTypeId]: amount } }
            : row,
        ),
      )
    },
    [],
  )

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

  const year = lastQuery?.year ?? String(new Date().getFullYear())

  return {
    loading,
    processing,
    error,
    actionMessage,
    searched,
    rows,
    payrollTypes,
    employeeOptions,
    year,
    search,
    setValue,
    retry: () => (lastQuery ? search(lastQuery) : undefined),
    clearMessages: () => {
      setError(null)
      setActionMessage(null)
    },
    /**
     * Sends the full grid: employeeSalaryStructureStore rewrites each employee's
     * JSON blob from the posted rows, so a partial post would drop heads.
     */
    save: (employees: SalaryStructureRow[]) =>
      run(
        () =>
          payrollService.saveSalaryStructure(resolveContext(), {
            year,
            payrollTypes,
            employees: employees.map((row) => ({
              employeeId: row.employeeId,
              gender: row.gender,
              values: row.values,
              // F-174. Without this, Save deletes them.
              carriedValues: row.carriedValues,
            })),
          }),
        'Failed to save the salary structure.',
      ),
    /** Copies the searched year's structures into year + 1. */
    rollover: () =>
      run(
        () =>
          payrollService.rolloverSalaryStructure(resolveContext(), {
            year,
            employeeIds: lastQuery?.employeeIds,
            departmentIds: lastQuery?.departmentIds,
          }),
        'Failed to roll over the salary structures.',
      ),
  }
}
