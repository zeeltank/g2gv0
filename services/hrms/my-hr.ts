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
}
