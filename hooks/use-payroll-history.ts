'use client'

import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { payrollEmployeeLabel, toMessage, useLaravelContext } from '@/hooks/use-payroll-shared'
import {
  payrollService,
  toRecord,
  type LaravelPayrollEmployee,
  type PayrollHistoryEntry,
} from '@/services/hrms'

/** The months of an Indian financial year, in payslip order. */
const FINANCIAL_MONTHS = [
  'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar',
] as const

/** A pay head as it appears in THIS result set. */
export interface HistoryHead {
  id: string
  label: string
  /**
   * True when the head appears in a payslip but not in the active head list -
   * deactivated, soft-deleted, or belonging to another organisation. The amount
   * is still real money that was paid, so it is shown; it is just not named.
   */
  unnamed: boolean
}

export interface HistoryMonth {
  month: string
  year: string
  /** head id -> amount, for every head present on this payslip. */
  amounts: Record<string, number>
  totalDays: number
  totalDeduction: number
  totalPayment: number
  /** Sum of the component amounts, which need not equal totalPayment. */
  componentSum: number
}

export interface PayrollHistoryState {
  employeeName: string
  employeeNo: string
  months: HistoryMonth[]
}

function num(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toList<T>(value: Record<string, T> | T[] | undefined): T[] {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') return Object.values(value)
  return []
}

/**
 * Employee Payroll History - POST /employee-payroll-history.
 *
 * F-169. A finished endpoint with no caller. It answers the question an
 * employee asks at loan time and HR asks in a pay dispute: what was actually
 * paid, month by month, broken down by component, across one financial year.
 * My HR's payslip list gives only month/gross/net - no components at all.
 *
 * The hook's real job is head reconciliation. `header` lists only ACTIVE pay
 * heads; a filed payslip stores amounts against whatever head ids were used
 * when it was generated. Rendering the intersection would silently drop money -
 * on one payslip in this deployment it would drop 52,500 of 81,300. So the
 * column set is the UNION of the active heads and every head id that actually
 * appears, and the ones that cannot be named are marked rather than hidden.
 */
export function usePayrollHistory() {
  const resolveContext = useLaravelContext()
  const { isLoading: authLoading } = useAuth()

  const [financialYear, setFinancialYear] = useState('')
  const [employeeId, setEmployeeId] = useState<string>('0')
  const [departmentId, setDepartmentId] = useState<string>('0')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [years, setYears] = useState<string[]>([])
  const [employees, setEmployees] = useState<LaravelPayrollEmployee[]>([])
  const [heads, setHeads] = useState<HistoryHead[]>([])
  const [people, setPeople] = useState<PayrollHistoryState[]>([])
  const [loadedFor, setLoadedFor] = useState<{ year: string; employeeId: string } | null>(null)

  const load = useCallback(
    async (next?: { financialYear?: string; employeeId?: string; departmentId?: string }) => {
      const targetYear = next?.financialYear ?? financialYear
      const targetEmployee = next?.employeeId ?? employeeId
      const targetDepartment = next?.departmentId ?? departmentId

      setLoading(true)
      setError(null)

      try {
        const response = await payrollService.getPayrollHistory(resolveContext(), {
          // On the very first load the year list has not arrived yet, so the
          // request is sent without one: the controller then returns the
          // pickers and an empty history rather than an error.
          financialYear: targetYear,
          employeeId: targetEmployee,
          departmentId: targetDepartment,
        })

        const yearList = toList<string>(response.years).map(String)
        setYears(yearList)
        setEmployees(toList<LaravelPayrollEmployee>(response.employeeLists))

        const activeHeads = toRecord<string>(response.header)

        // Drop the empty objects the controller's map emits for a row that
        // matched neither of its year branches.
        const entries = (response.currentYearemployeeDetails ?? []).filter(
          (entry): entry is PayrollHistoryEntry =>
            Boolean(entry && typeof entry === 'object' && entry.month),
        )

        // The union, in a stable order: named heads first (in the order the
        // server listed them), then whatever else the payslips actually used.
        const seen = new Set<string>()
        const headList: HistoryHead[] = []

        Object.entries(activeHeads).forEach(([id, label]) => {
          seen.add(String(id))
          headList.push({ id: String(id), label: String(label), unnamed: false })
        })

        entries.forEach((entry) => {
          Object.keys(toRecord<number | string>(entry.data)).forEach((id) => {
            if (seen.has(String(id))) return
            seen.add(String(id))
            headList.push({ id: String(id), label: `Head #${id}`, unnamed: true })
          })
        })

        // Group by person: the endpoint returns every employee's rows when no
        // employee filter is applied.
        const byPerson = new Map<string, PayrollHistoryState>()

        entries.forEach((entry) => {
          const key = String(entry.employee_id ?? entry.employee_no ?? 'unknown')
          if (!byPerson.has(key)) {
            byPerson.set(key, {
              employeeName: String(entry.employee_name ?? '').replace(/\s+/g, ' ').trim() || key,
              employeeNo: String(entry.employee_no ?? '').trim(),
              months: [],
            })
          }

          const amounts: Record<string, number> = {}
          let componentSum = 0
          Object.entries(toRecord<number | string>(entry.data)).forEach(([id, amount]) => {
            const value = num(amount)
            amounts[String(id)] = value
            componentSum += value
          })

          byPerson.get(key)!.months.push({
            month: String(entry.month ?? ''),
            year: String(entry.year ?? ''),
            amounts,
            totalDays: num(entry.total_day),
            totalDeduction: num(entry.total_deduction),
            totalPayment: num(entry.total_payment),
            componentSum,
          })
        })

        byPerson.forEach((person) => {
          person.months.sort(
            (a, b) => FINANCIAL_MONTHS.indexOf(a.month as never) - FINANCIAL_MONTHS.indexOf(b.month as never),
          )
        })

        setHeads(headList)
        setPeople(Array.from(byPerson.values()))
        setLoadedFor(targetYear ? { year: targetYear, employeeId: targetEmployee } : null)

        // Adopt the server's first financial year once, so the picker is never
        // empty and the first Apply has something valid to send.
        if (!targetYear && yearList.length > 0) setFinancialYear(yearList[yearList.length - 1])
      } catch (loadError) {
        // A failed fetch is not "this employee was never paid".
        setPeople([])
        setHeads([])
        setLoadedFor(null)
        setError(toMessage(loadError, 'Could not load the payroll history.'))
      } finally {
        setLoading(false)
      }
    },
    [financialYear, employeeId, departmentId, resolveContext],
  )

  useEffect(() => {
    if (authLoading) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading])

  const employeeOptions = [
    { value: '0', label: 'All employees' },
    ...employees.map((employee) => ({
      value: String(employee.id),
      label: payrollEmployeeLabel(employee),
    })),
  ]

  /** Months whose components do not add up to what was paid. */
  const unreconciled = people.flatMap((person) =>
    person.months.filter(
      (month) => Math.abs(month.componentSum - month.totalDeduction - month.totalPayment) > 0.5,
    ),
  ).length

  return {
    financialYear,
    setFinancialYear,
    employeeId,
    setEmployeeId,
    departmentId,
    setDepartmentId,
    years,
    employeeOptions,
    heads,
    people,
    loading,
    error,
    loadedFor,
    unnamedHeads: heads.filter((head) => head.unnamed).length,
    unreconciled,
    apply: () => load(),
    retry: () => load(),
  }
}
