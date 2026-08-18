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

            return {
              employeeId: employee.id,
              employeeNo: employee.employee_no ?? '',
              name: payrollEmployeeLabel(employee),
              department: employee.department ?? '-',
              departmentId: String(employee.department_id ?? ''),
              gender: employee.gender ?? '',
              status: String(employee.status ?? '1') === '1' ? 'Active' : 'Inactive',
              values,
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
