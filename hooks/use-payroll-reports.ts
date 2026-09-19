'use client'

import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { toMessage, useLaravelContext } from '@/hooks/use-payroll-shared'
import {
  payrollService,
  toRecord,
  type PayrollRegisterRow,
  type SalaryStructureReportRow,
} from '@/services/hrms'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function num(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toList<T>(value: Record<string, T> | T[] | undefined): T[] {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') return Object.values(value)
  return []
}

export interface YearOption {
  value: string
  label: string
}

/**
 * Laravel's year lists come in two shapes and the difference is load-bearing.
 *
 *   Helpers::getYears()      [2021, 2022, ...]                  a plain list
 *   Helpers::getPairYears()  {'2025': '2025-2026', ...}         KEYED
 *
 * The keyed one is a financial year: the KEY is what the query wants and the
 * VALUE is only the label. The Blade dropdowns have always posted the key -
 * `<option value="2025">2025-2026</option>` - which is why /payroll-report
 * works there and 500s when handed "2025-2026" (Carbon: "Trailing data").
 *
 * So this must NOT flatten to Object.values(). Doing that sends a label where a
 * value belongs, and the label happens to parse far enough to produce a wrong
 * year rather than an obvious failure.
 */
function toYearOptions(value: Record<string, string> | string[] | undefined): YearOption[] {
  if (Array.isArray(value)) {
    return value.map((item) => ({ value: String(item), label: String(item) }))
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).map(([key, label]) => ({ value: String(key), label: String(label) }))
  }
  return []
}

/* ------------------------------------------------------------------ *
 * Payroll Register
 * ------------------------------------------------------------------ */

export interface RegisterRow {
  key: string
  employeeId: number | string
  employeeNo: string
  name: string
  totalDays: number
  lwpDays: number
  leaveDays: number
  absentDays: number
  deduction: number
  netPay: number
  receivedBy: string
}

function mapRegister(row: PayrollRegisterRow): RegisterRow {
  return {
    key: `${row.employee_id}-${row.month}-${row.year}`,
    employeeId: row.employee_id,
    employeeNo: String(row.employee_no ?? '').trim(),
    name: String(row.full_name ?? '')
      .replace(/(^|\s)-(\s|$)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || `Employee ${row.employee_id}`,
    totalDays: num(row.total_day),
    lwpDays: num(row.lwp_days),
    leaveDays: num(row.leave_days),
    absentDays: num(row.absent_days),
    deduction: num(row.total_deduction),
    netPay: num(row.total_payment),
    receivedBy: String(row.received_by ?? '').trim(),
  }
}

/**
 * Payroll Register - POST /payroll-report (F-172).
 *
 * The month's payslips with the day counts reconciled against attendance,
 * leave and the holiday calendar. It is the pre-payment sanity check: "why is
 * this person's pay low" answered in the same row as the pay, which nothing
 * else in the frontend does because nothing else joins payroll to attendance.
 */
export function usePayrollRegister() {
  const resolveContext = useLaravelContext()
  const { isLoading: authLoading } = useAuth()

  const now = new Date()
  const [month, setMonth] = useState(MONTHS[now.getMonth()])
  const [year, setYear] = useState(String(now.getFullYear()))

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<RegisterRow[]>([])
  const [months, setMonths] = useState<string[]>(MONTHS)
  const [years, setYears] = useState<YearOption[]>([
    { value: String(now.getFullYear()), label: String(now.getFullYear()) },
  ])
  const [loadedFor, setLoadedFor] = useState<{ month: string; year: string } | null>(null)

  const load = useCallback(
    async (next?: { month?: string; year?: string }) => {
      const targetMonth = next?.month ?? month
      const targetYear = next?.year ?? year

      setLoading(true)
      setError(null)

      try {
        const response = await payrollService.getPayrollRegister(resolveContext(), {
          month: targetMonth,
          year: targetYear,
        })

        setRows((response.employeeDetails ?? []).map(mapRegister))
        setMonths(toList<string>(response.months).map(String))
        const yearList = toYearOptions(response.years)
        if (yearList.length > 0) setYears(yearList)
        setLoadedFor({ month: targetMonth, year: targetYear })
      } catch (loadError) {
        setRows([])
        setLoadedFor(null)
        setError(toMessage(loadError, 'Could not load the payroll register.'))
      } finally {
        setLoading(false)
      }
    },
    [month, year, resolveContext],
  )

  useEffect(() => {
    if (authLoading) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading])

  return {
    month,
    year,
    setMonth,
    setYear,
    months: months.length > 0 ? months : MONTHS,
    years,
    loading,
    error,
    rows,
    loadedFor,
    totals: {
      net: rows.reduce((sum, row) => sum + row.netPay, 0),
      deduction: rows.reduce((sum, row) => sum + row.deduction, 0),
      lwp: rows.reduce((sum, row) => sum + row.lwpDays, 0),
      absent: rows.reduce((sum, row) => sum + row.absentDays, 0),
    },
    /** Rows where unpaid days or absences explain a reduced payment. */
    flagged: rows.filter((row) => row.lwpDays > 0 || row.absentDays > 0).length,
    apply: () => load(),
    retry: () => load(),
  }
}

/* ------------------------------------------------------------------ *
 * Salary Structure Report
 * ------------------------------------------------------------------ */

export interface StructureHead {
  id: string
  label: string
  unnamed: boolean
}

export interface StructureRow {
  key: string
  employeeId: number | string
  employeeNo: string
  name: string
  department: string
  year: string
  amounts: Record<string, number>
  total: number
}

/**
 * Salary Structure Report - POST /salary-structure-report.
 *
 * Every employee's structure for a year, as a grid. Until F-160 the endpoint
 * read session() with no type=API branch, resolved to tenant null and returned
 * an empty list however it was filtered - so this screen could not have existed.
 *
 * Same head-naming rule as the payroll history (F-169): `headers` names only
 * ACTIVE heads, while a stored structure can reference heads since deactivated
 * or deleted. The column set is the union, and unnameable heads are marked
 * rather than dropped.
 */
export function useSalaryStructureReport() {
  const resolveContext = useLaravelContext()
  const { isLoading: authLoading } = useAuth()

  const [year, setYear] = useState('0')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [years, setYears] = useState<YearOption[]>([])
  const [heads, setHeads] = useState<StructureHead[]>([])
  const [rows, setRows] = useState<StructureRow[]>([])
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  const load = useCallback(
    async (nextYear?: string) => {
      const targetYear = nextYear ?? year

      setLoading(true)
      setError(null)

      try {
        const response = await payrollService.getSalaryStructureReport(resolveContext(), {
          year: targetYear,
        })

        const active = toRecord<string>(response.headers)
        const structures = response.salaryStructure ?? []

        const seen = new Set<string>()
        const headList: StructureHead[] = []

        Object.entries(active).forEach(([id, label]) => {
          seen.add(String(id))
          headList.push({ id: String(id), label: String(label), unnamed: false })
        })

        const parsed = structures.map((row: SalaryStructureReportRow) => {
          let amounts: Record<string, number> = {}
          try {
            // employee_salary_data is a JSON STRING here, unlike the payroll
            // history where the controller has already decoded it.
            const decoded = JSON.parse(String(row.employee_salary_data ?? '{}'))
            if (decoded && typeof decoded === 'object' && !Array.isArray(decoded)) {
              amounts = Object.fromEntries(
                Object.entries(decoded as Record<string, unknown>).map(([id, amount]) => [
                  String(id),
                  num(amount),
                ]),
              )
            }
          } catch {
            // A structure whose JSON will not parse is shown with no
            // components rather than crashing the whole grid.
            amounts = {}
          }

          Object.keys(amounts).forEach((id) => {
            if (seen.has(id)) return
            seen.add(id)
            headList.push({ id, label: `Head #${id}`, unnamed: true })
          })

          return {
            key: `${row.employee_id}-${row.year}-${row.id}`,
            employeeId: row.employee_id,
            employeeNo: String(row.employee_no ?? '').trim(),
            name: String(row.employee_name ?? '').replace(/\s+/g, ' ').trim() ||
              `Employee ${row.employee_id}`,
            department: String(row.department ?? '').trim(),
            year: String(row.year ?? ''),
            amounts,
            total: Object.values(amounts).reduce((sum, value) => sum + value, 0),
          }
        })

        setHeads(headList)
        setRows(parsed)

        /*
         * The picker is the server's list PLUS whatever years the data
         * actually holds.
         *
         * Helpers::getPairYears() stops at 2025, and this deployment already
         * has a structure filed for 2026. Offering only the server's list
         * would make an existing structure unreachable except through "All
         * years" - a filter that cannot reach its own data reads as missing
         * data.
         */
        const fromServer = toYearOptions(response.years)
        const known = new Set(fromServer.map((option) => option.value))
        const fromData = Array.from(new Set(parsed.map((row) => row.year)))
          .filter((value) => value !== '' && !known.has(value))
          .map((value) => ({ value, label: value }))

        const merged = [...fromServer, ...fromData].sort(
          (a, b) => Number(b.value) - Number(a.value),
        )
        if (merged.length > 0) setYears(merged)
        setLoadedFor(targetYear)
      } catch (loadError) {
        setRows([])
        setHeads([])
        setLoadedFor(null)
        setError(toMessage(loadError, 'Could not load the salary structure report.'))
      } finally {
        setLoading(false)
      }
    },
    [year, resolveContext],
  )

  useEffect(() => {
    if (authLoading) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading])

  return {
    year,
    setYear,
    years,
    loading,
    error,
    heads,
    rows,
    loadedFor,
    unnamedHeads: heads.filter((head) => head.unnamed).length,
    apply: () => load(),
    retry: () => load(),
  }
}
