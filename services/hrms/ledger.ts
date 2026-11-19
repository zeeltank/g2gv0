import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'

/**
 * The Employee Ledger's API client: /api/ledger (HRMS\EmployeeLedgerController).
 *
 * One account per employee. Credit (+) is what the company owes them, debit (−)
 * is what has been paid or what they hold. A positive balance is money owed TO
 * the employee; a negative one is money they hold (an advance not yet claimed).
 *
 * The server returns only the caller's own row and statement unless they are HR
 * or an administrator, so a screen built on this cannot leak someone's salary by
 * asking for it.
 */

export type LedgerFigures = {
  /** Net of the most recent processed month. */
  latest_salary: number
  salary_earned: number
  salary_paid: number
  salary_due: number
  advance_paid: number
  advance_settled: number
  advance_unclaimed: number
  expense_approved: number
  expense_paid: number
  expense_due: number
  /** + the company owes them; − they hold an advance. */
  net_balance: number
}

export type LedgerRow = LedgerFigures & {
  employee_id: number
  employee_name: string
  employee_no: string | null
  department: string | null
  active: boolean
}

export type LedgerSummary = {
  scope: 'all' | 'own'
  data: LedgerRow[]
  totals: {
    employees: number
    salary_due: number
    advance_unclaimed: number
    expense_due: number
    net_balance: number
  }
}

export type LedgerLineType =
  | 'salary'
  | 'salary_payment'
  | 'advance_paid'
  | 'expense_approved'
  | 'advance_settled'
  | 'expense_paid'

export type LedgerLine = {
  /** YYYY-MM-DD */
  date: string
  type: LedgerLineType
  particulars: string
  reference: string | null
  debit: number
  credit: number
  balance: number
  /** Set on a salary payment, so it can be reversed. */
  payment_id: number | null
}

export type SalaryMonth = {
  month: string
  year: number
  label: string
  net: number
  paid: number
  due: number
}

export type LedgerStatement = {
  employee: { id: number; name: string; employee_no: string | null; department: string | null; active: boolean }
  summary: LedgerFigures
  opening_balance: number
  closing_balance: number
  lines: LedgerLine[]
  salary_months: SalaryMonth[]
  can: { record_payment: boolean; reverse_payment: boolean }
}

export type SalaryPaymentInput = {
  employee_id: number
  month: string
  year: number
  amount: number
  /** YYYY-MM-DD */
  paid_on: string
  payment_reference?: string
  note?: string
}

type StatusResponse = { status?: number | string; message?: string }

async function ensureSuccess<T extends StatusResponse>(request: Promise<T>): Promise<T> {
  const response = await request
  if (String(response.status) === '0') {
    throw new Error(response.message || 'The request was refused.')
  }
  return response
}

function baseParams(context: LaravelContext) {
  return {
    sub_institute_id: context.subInstituteId,
    ...(context.token ? { type: 'api', token: context.token } : {}),
  }
}

export const ledgerService = {
  summary: (context: LaravelContext) =>
    apiClient.get<StatusResponse & LedgerSummary>('/ledger', baseParams(context)),

  statement: (context: LaravelContext, employeeId: number, range: { from?: string; to?: string } = {}) =>
    apiClient.get<StatusResponse & { data: LedgerStatement }>(`/ledger/${employeeId}`, {
      ...baseParams(context),
      ...(range.from ? { from: range.from } : {}),
      ...(range.to ? { to: range.to } : {}),
    }),

  recordSalaryPayment: (context: LaravelContext, payload: SalaryPaymentInput) =>
    ensureSuccess(
      apiClient.post<StatusResponse>('/ledger/salary-payments', payload, { params: baseParams(context) }),
    ),

  reverseSalaryPayment: (context: LaravelContext, id: number) =>
    ensureSuccess(apiClient.delete<StatusResponse>(`/ledger/salary-payments/${id}`, baseParams(context))),
}
