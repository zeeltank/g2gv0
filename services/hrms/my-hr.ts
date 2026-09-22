/**
 * My HR — what an employee can see about themselves. F-130.
 *
 * There is no `employeeId` parameter anywhere in this file, and that is the
 * design rather than an omission. The server resolves the subject from the
 * token, so "my payslip" cannot become "anyone's payslip" by adding an id to a
 * URL. A client that cannot express the wrong request cannot send it.
 */

import { apiClient } from '@/services/core'
import { withLaravelParams, type LaravelContext } from '@/lib/laravel-context'
import type { LeaveBalanceRow } from './leave'

/** One month the employee has been paid for. */
export interface MyPayslip {
  id: number
  month: string
  year: number
  gross: number
  deductions: number
  net: number
  days: number
  issued_at: string | null
  /** Built by the server. Never assembled in the browser. */
  pdf_url: string
}

/** One line of a payslip: a pay head and what it was worth that month. */
export interface PayComponent {
  head_id: number
  /** The head's name, or `Head #14` where the head itself has been deleted. */
  name: string
  kind: 'earning' | 'deduction'
  amount: number
}

/** A paid month with the components behind the figure, not just the figure. */
export interface PayMonth {
  id: number
  month: string
  year: number
  days: number
  gross: number
  deductions: number
  net: number
  components: PayComponent[]
  component_sum: number
  /**
   * Whether the components add up to what was filed. Surfaced rather than
   * hidden: eleven adjustments on this deployment were entered against a month
   * payroll never matched, and an employee comparing a payslip to a bank
   * statement should see the disagreement rather than a tidied total.
   */
  reconciles: boolean
  issued_at: string | null
}

export interface MyForm16 {
  from_date?: string
  to_date?: string
  year?: string | number
  get_employee_salary?: { employee_salary_data?: string | null } | null
  get_school_detail?: Record<string, unknown> | null
  get_employee_detail?: Record<string, unknown> | null
  department_name?: { department_name?: string | null } | null
  allowance?: unknown
  deduction?: unknown
}

/** A pending request and who it is actually sitting with. */
export interface MyAwaitingRequest {
  leave_id: number
  from_date: string
  to_date: string | null
  step: number
  waiting_on: string
  overdue: boolean
}

export interface MyHrSummary {
  year: number
  leave_balances: LeaveBalanceRow[]
  pending_leave: number
  awaiting: MyAwaitingRequest[]
  latest_payslip: { month: string; year: number; net: number } | null
  payslip_count: number
  unread_notifications: number
  /**
   * The years this employee has a salary structure for.
   *
   * Surfaced so the screen can say WHY a salary certificate is unavailable
   * rather than offering a button that will refuse — F-110's root cause was
   * exactly this missing row, and for two years it produced a stack trace.
   */
  salary_structure_years: number[]
}

interface Envelope<T> {
  status: number | string
  message?: string
  data: T
}

export const myHrService = {
  getSummary: (context: LaravelContext) =>
    apiClient.get<Envelope<MyHrSummary>>('/my-hr/summary', withLaravelParams(context)),

  getPayslips: (context: LaravelContext) =>
    apiClient.get<Envelope<MyPayslip[]>>('/my-hr/payslips', withLaravelParams(context)),

  /**
   * The payslip PDF itself. F-209.
   *
   * The URL is the server's own, taken verbatim from the row - the browser
   * still assembles nothing. What changed is that it is FETCHED rather than
   * navigated to: the route is `auth:sanctum`, and an `<a href>` carries no
   * Authorization header, so every employee who pressed Download got a 302 to
   * /login instead of their pay.
   */
  downloadPayslip: (payslip: MyPayslip) => apiClient.getBlob(payslip.pdf_url),

  /**
   * Every month's pay with the components behind it. F-209.
   *
   * The equivalent HR endpoint (`employee-payroll-history`) returns the whole
   * organisation's roster alongside the figures, so it is not reused here -
   * showing an employee their own payslip should not hand them the staff
   * directory.
   */
  getPayBreakdown: (context: LaravelContext, year?: number) =>
    apiClient.get<Envelope<{ months: PayMonth[]; years: number[] }>>(
      '/my-hr/pay-breakdown',
      withLaravelParams(context, year ? { year: String(year) } : undefined),
    ),

  /**
   * The employee's own salary certificate for a year, as a PDF.
   *
   * No certificate had ever been generated on this platform - the table held
   * zero rows - because the builder fatalled without a salary structure
   * (F-110) and, once that was fixed, a full year's worth of months would not
   * fit the column that records them (F-212).
   */
  downloadSalaryCertificate: (year: number) =>
    apiClient.getBlob(`/my-hr/salary-certificate/${year}`),

  /**
   * The employee's own Form 16 figures.
   *
   * NOT a statutory Form 16 - that is issued by the deductor against filed TDS
   * returns, and nothing here files anything. It is the same statement of pay
   * and deductions HR sees, which until F-210 threw a 500 for them too.
   */
  getForm16: (context: LaravelContext, year: number) =>
    apiClient.get<Envelope<MyForm16>>(`/my-hr/form-16/${year}`, withLaravelParams(context)),
}
