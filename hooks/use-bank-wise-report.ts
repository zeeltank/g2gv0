'use client'

import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { toMessage, useLaravelContext } from '@/hooks/use-payroll-shared'
import {
  bankWiseEmployee,
  payrollService,
  type BankWisePayslip,
} from '@/services/hrms'

/** One line of the payment advice, flattened for the table and the CSV. */
export interface BankAdviceRow {
  employeeId: number | string
  employeeNo: string
  name: string
  department: string
  bankName: string
  accountNo: string
  ifsc: string
  netPay: number
  /**
   * Whether this line is actually payable. A row missing an account number or
   * an IFSC cannot go in a transfer file, and the screen has to say so rather
   * than render a blank cell that looks like a rendering bug.
   */
  payable: boolean
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Laravel returns months/years as either a list or a keyed map. */
function toList(value: Record<string, string> | string[] | undefined, fallback: string[]): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (value && typeof value === 'object') return Object.values(value).map(String)
  return fallback
}

function fullName(details: ReturnType<typeof bankWiseEmployee>): string {
  return [details.first_name, details.middle_name, details.last_name]
    .filter((part) => part && String(part).trim() !== '' && String(part).trim() !== '-')
    .join(' ')
    .trim()
}

function mapRow(payslip: BankWisePayslip): BankAdviceRow {
  const details = bankWiseEmployee(payslip)
  const accountNo = String(details.account_no ?? '').trim()
  const ifsc = String(details.ifsc_code ?? '').trim()

  return {
    employeeId: payslip.employee_id,
    employeeNo: String(details.employee_no ?? '').trim(),
    name: fullName(details) || `Employee ${payslip.employee_id}`,
    department: String(details.department ?? '').trim(),
    bankName: String(details.bank_name ?? '').trim(),
    accountNo,
    ifsc,
    netPay: Number(payslip.total_payment ?? 0),
    payable: accountNo !== '' && ifsc !== '',
  }
}

/**
 * Bank-wise Payment Advice - POST /payroll-bank-wise-report.
 *
 * F-166. The endpoint was implemented and had no caller. It answers one
 * question: for this month, who was paid, how much, and into which account.
 * The controller filters on `whereNotNull('total_payment')`, so an employee
 * with a salary structure but no generated payslip is correctly absent - the
 * advice lists people who were actually paid, not people who could be.
 */
export function useBankWiseReport() {
  const resolveContext = useLaravelContext()
  const { isLoading: authLoading } = useAuth()

  const now = new Date()
  const [month, setMonth] = useState(MONTHS[now.getMonth()])
  const [year, setYear] = useState(String(now.getFullYear()))

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<BankAdviceRow[]>([])
  const [months, setMonths] = useState<string[]>(MONTHS)
  const [years, setYears] = useState<string[]>([String(now.getFullYear())])
  /** The month/year the rows on screen actually belong to. */
  const [loadedFor, setLoadedFor] = useState<{ month: string; year: string } | null>(null)

  const load = useCallback(
    async (next?: { month?: string; year?: string }) => {
      const targetMonth = next?.month ?? month
      const targetYear = next?.year ?? year

      setLoading(true)
      setError(null)

      try {
        const response = await payrollService.getBankWiseReport(resolveContext(), {
          month: targetMonth,
          year: targetYear,
        })

        setRows((response.employees ?? []).map(mapRow))
        setMonths(toList(response.months, MONTHS))
        setYears(toList(response.years, [String(now.getFullYear())]))
        setLoadedFor({ month: targetMonth, year: targetYear })
      } catch (loadError) {
        /*
         * A failed fetch is NOT an empty month.
         *
         * The rule my-hr/page.tsx states in capitals and leave-reports never
         * got: rows are cleared AND loadedFor is cleared, so the table renders
         * the error branch rather than "nobody was paid in August" - which on
         * this screen would be a sentence about money that is not true.
         */
        setRows([])
        setLoadedFor(null)
        setError(toMessage(loadError, 'Could not load the payment advice.'))
      } finally {
        setLoading(false)
      }
    },
    [month, year, resolveContext],
  )

  useEffect(() => {
    if (authLoading) return
    void load()
    // Deliberately once on mount: afterwards the user drives it with Apply.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading])

  const totalNet = rows.reduce((sum, row) => sum + (Number.isFinite(row.netPay) ? row.netPay : 0), 0)
  const unpayable = rows.filter((row) => !row.payable).length

  return {
    month,
    year,
    setMonth,
    setYear,
    months,
    years,
    loading,
    error,
    rows,
    totalNet,
    unpayable,
    loadedFor,
    apply: () => load(),
    retry: () => load(),
  }
}