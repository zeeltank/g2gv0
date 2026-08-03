'use client'

import { useCallback, useState } from 'react'

import { isLaravelContextReady } from '@/lib/laravel-context'
import { parseSalaryDataJson, toMessage, useLaravelContext } from '@/hooks/use-payroll-shared'
import {
  payrollService,
  toList,
  type Form16Query,
  type Form16ReportResponse,
  type LaravelPayrollType,
} from '@/services/hrms'

export interface Form16Line {
  id: string
  name: string
  /** Annualised: the salary structure stores one month's figure. */
  amount: number
}

export interface Form16Data {
  employeeName: string
  employeeNo: string
  panNo: string
  department: string
  organizationName: string
  organizationPan: string
  organizationTan: string
  fromDate: string
  toDate: string
  year: string
  allowances: Form16Line[]
  deductions: Form16Line[]
  grossSalary: number
  totalDeductions: number
  netSalary: number
}

const MONTHS_IN_YEAR = 12

function textOf(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = String(value).trim()
  return text === '-' ? '' : text
}

function buildForm16(response: Form16ReportResponse, year: string): Form16Data | null {
  const salaryJson = response.get_employee_salary?.employee_salary_data
  if (!salaryJson) return null

  const monthlyAmounts = parseSalaryDataJson(salaryJson)
  const selectedAllowances = (response.selected_allowances ?? []).map(String)
  const selectedDeductions = (response.selected_deductions ?? []).map(String)

  const line = (payrollType: LaravelPayrollType): Form16Line => ({
    id: String(payrollType.id),
    name: payrollType.payroll_name ?? '',
    amount: (monthlyAmounts[String(payrollType.id)] ?? 0) * MONTHS_IN_YEAR,
  })

  // `->where()` on a Collection keeps the original keys, so these arrive as objects.
  const allowances = toList(response.allowance)
    .filter((payrollType) => selectedAllowances.includes(String(payrollType.id)))
    .map(line)
  const deductions = toList(response.deduction)
    .filter((payrollType) => selectedDeductions.includes(String(payrollType.id)))
    .map(line)

  const grossSalary = allowances.reduce((sum, item) => sum + item.amount, 0)
  const totalDeductions = deductions.reduce((sum, item) => sum + item.amount, 0)
  const employee = response.get_employee_detail ?? {}
  const school = response.get_school_detail ?? {}

  const employeeName =
    [employee.first_name, employee.middle_name, employee.last_name]
      .map(textOf)
      .filter(Boolean)
      .join(' ') || '-'

  return {
    employeeName,
    employeeNo: textOf(employee.employee_no) || '-',
    panNo: textOf(employee.pan_no) || '-',
    department: textOf(response.department_name?.department_name) || '-',
    organizationName: textOf(school.SchoolName) || '-',
    organizationPan: textOf(school.pan_no) || '-',
    organizationTan: textOf(school.tan_no) || '-',
    fromDate: response.from_date ?? '-',
    toDate: response.to_date ?? '-',
    year,
    allowances,
    deductions,
    grossSalary,
    totalDeductions,
    netSalary: grossSalary - totalDeductions,
  }
}

/**
 * Form 16 - POST /form16-report.
 *
 * The report action is used on its own: GET /form16, which would otherwise
 * supply the allowance/deduction pickers, calls an undefined `jwtToken()` helper
 * and fatals under type=API, so the pickers are fed from GET /payroll-type.
 */
export function useForm16() {
  const resolveContext = useLaravelContext()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form16, setForm16] = useState<Form16Data | null>(null)

  const generate = useCallback(
    async (query: Form16Query) => {
      setLoading(true)
      setError(null)
      setForm16(null)

      const context = resolveContext()
      if (!isLaravelContextReady(context)) {
        const message = 'Your session could not be resolved. Please sign in again.'
        setError(message)
        setLoading(false)
        return { ok: false as const, message }
      }

      try {
        const response = await payrollService.getForm16Report(context, query)

        // form16Report flags "no salary structure" with status_code 0, which
        // is_mobile renames to `status`.
        if (String(response.status ?? '') === '0') {
          throw new Error(response.message || 'Please add a salary structure for the selected year.')
        }

        const data = buildForm16(response, query.year)
        if (!data) {
          throw new Error('No salary structure found for this employee and year.')
        }

        setForm16(data)
        return { ok: true as const, message: 'Form 16 generated.' }
      } catch (generateError) {
        const message = toMessage(generateError, 'Failed to generate Form 16.')
        setError(message)
        return { ok: false as const, message }
      } finally {
        setLoading(false)
      }
    },
    [resolveContext],
  )

  return {
    loading,
    error,
    form16,
    generate,
    reset: () => {
      setForm16(null)
      setError(null)
    },
  }
}
