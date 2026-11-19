import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'

/**
 * Expense Management's API client: /api/expenses (HRMS\ExpenseCategoryController
 * and HRMS\ExpenseClaimController).
 *
 * Mutations throw on a Laravel-level failure (status 0), so a refused action
 * cannot look done. Every claim comes back with `can` flags - the screen shows
 * exactly the actions the server would accept rather than re-deriving who may
 * do what.
 */

export type ExpenseStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid' | 'cancelled'

export type ExpenseCategory = {
  id: number
  name: string
  code: string | null
  description: string | null
  /** Largest single line allowed. Null = no limit. */
  max_amount: number | null
  requires_receipt: boolean
  /** 1 active, 0 inactive. */
  status: number
  /** Lines using it. Only on the list. */
  item_count?: number
}

export type ExpenseCategoryInput = {
  name: string
  code?: string
  description?: string
  max_amount?: number | null
  requires_receipt: boolean
  status: 0 | 1
}

export type ExpenseItem = {
  id?: number
  category_id: number
  category_name?: string
  /** YYYY-MM-DD */
  expense_date: string
  description: string | null
  amount: number
  receipt_ref: string | null
}

export type ExpenseClaim = {
  id: number
  claim_no: string
  employee_id: number
  employee_name: string
  title: string
  description: string | null
  total_amount: number
  currency: string
  /** The advance this claim is settled against, and how much of it. */
  advance_id: number | null
  advance_no: string | null
  advance_adjusted: number
  /** What is actually paid out: total less the advance adjusted. */
  net_payable: number
  status: ExpenseStatus
  item_count: number
  submitted_at: string | null
  decided_at: string | null
  decision_note: string | null
  paid_at: string | null
  payment_reference: string | null
  created_at: string
  /** What the signed-in user may do with this claim, decided by the server. */
  can: {
    edit: boolean
    submit: boolean
    cancel: boolean
    delete: boolean
    decide: boolean
    pay: boolean
  }
  /** Only on a single claim, not the list. */
  items?: ExpenseItem[]
}

export type ExpenseSummary = Partial<Record<ExpenseStatus, { claims: number; amount: number }>>

export type ClaimInput = {
  title: string
  description?: string
  items: {
    category_id: number
    expense_date: string
    description?: string
    amount: number
    receipt_ref?: string
  }[]
  /** File it straight away instead of saving a draft. */
  submit?: boolean
  /** Settle against one of the employee's own paid advances. */
  advance_id?: number
  advance_amount?: number
}

export type AdvanceStatus = 'requested' | 'approved' | 'rejected' | 'paid' | 'claimed' | 'cancelled'

export type ExpenseAdvance = {
  id: number
  advance_no: string
  employee_id: number
  employee_name: string
  purpose: string
  needed_by: string | null
  note: string | null
  advance_amount: number
  claimed_amount: number
  /** Paid but not yet used by paid claims. Zero until it is paid. */
  unclaimed_amount: number
  currency: string
  status: AdvanceStatus
  requested_at: string | null
  decided_at: string | null
  decision_note: string | null
  paid_at: string | null
  payment_reference: string | null
  created_at: string
  can: { cancel: boolean; decide: boolean; pay: boolean }
}

export type AdvanceSummary = Partial<Record<AdvanceStatus, { advances: number; amount: number; claimed: number }>>

export type AdvanceInput = {
  purpose: string
  advance_amount: number
  needed_by?: string
  note?: string
}

export type ExpenseDashboard = {
  /** 'organization' for HR/exec/auditor, otherwise 'mine' (own + routed to them). */
  scope: 'organization' | 'mine'
  monthly: { month: string; claimed: number; paid: number }[]
  by_status: Partial<Record<ExpenseStatus, { claims: number; amount: number }>>
  top_categories: { category: string; amount: number }[]
  shortcuts: { pending_claims: number; unclaimed_advances: number }
  totals: { this_month: number; awaiting_payment: number; advances_outstanding: number }
}

export type UnpaidClaimRow = {
  id: number
  claim_no: string
  employee_id: number
  employee_name: string
  department: string | null
  title: string
  approved_at: string | null
  days_waiting: number
  total_amount: number
  advance_adjusted: number
  net_payable: number
  currency: string
}

export type UnpaidClaimsReport = {
  data: UnpaidClaimRow[]
  totals: { claims: number; net_payable: number; aging: Record<string, number> }
}

export type AdvanceSummaryRow = {
  employee_id: number
  employee_name: string
  department: string | null
  advances: number
  paid: number
  claimed: number
  unclaimed: number
  pending: number
}

export type AdvanceSummaryReport = {
  data: AdvanceSummaryRow[]
  totals: { employees: number; paid: number; claimed: number; unclaimed: number; pending: number }
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

/** apiClient.post/put take params as an option; this is that shape. */
function opts(context: LaravelContext) {
  return { params: baseParams(context) }
}

type ClaimResponse = StatusResponse & { data: ExpenseClaim }

export const expenseService = {
  // Categories
  categories: (context: LaravelContext) =>
    apiClient.get<{ status: number; data: ExpenseCategory[] }>('/expenses/categories', baseParams(context)),

  createCategory: (context: LaravelContext, payload: ExpenseCategoryInput) =>
    ensureSuccess(apiClient.post<StatusResponse & { data: ExpenseCategory }>('/expenses/categories', payload, opts(context))),

  updateCategory: (context: LaravelContext, id: number, payload: ExpenseCategoryInput) =>
    ensureSuccess(apiClient.put<StatusResponse & { data: ExpenseCategory }>(`/expenses/categories/${id}`, payload, opts(context))),

  deleteCategory: (context: LaravelContext, id: number) =>
    ensureSuccess(apiClient.delete<StatusResponse>(`/expenses/categories/${id}`, baseParams(context))),

  // Claims
  claims: (context: LaravelContext, scope: 'mine' | 'approvals', status?: ExpenseStatus | '') =>
    apiClient.get<{ status: number; data: ExpenseClaim[]; summary: ExpenseSummary }>('/expenses/claims', {
      ...baseParams(context),
      scope,
      ...(status ? { status } : {}),
    }),

  claim: (context: LaravelContext, id: number) =>
    apiClient.get<ClaimResponse>(`/expenses/claims/${id}`, baseParams(context)),

  createClaim: (context: LaravelContext, payload: ClaimInput) =>
    ensureSuccess(apiClient.post<ClaimResponse>('/expenses/claims', payload, opts(context))),

  updateClaim: (context: LaravelContext, id: number, payload: ClaimInput) =>
    ensureSuccess(apiClient.put<ClaimResponse>(`/expenses/claims/${id}`, payload, opts(context))),

  deleteClaim: (context: LaravelContext, id: number) =>
    ensureSuccess(apiClient.delete<StatusResponse>(`/expenses/claims/${id}`, baseParams(context))),

  submitClaim: (context: LaravelContext, id: number) =>
    ensureSuccess(apiClient.post<ClaimResponse>(`/expenses/claims/${id}/submit`, {}, opts(context))),

  cancelClaim: (context: LaravelContext, id: number) =>
    ensureSuccess(apiClient.post<ClaimResponse>(`/expenses/claims/${id}/cancel`, {}, opts(context))),

  approveClaim: (context: LaravelContext, id: number, note?: string) =>
    ensureSuccess(apiClient.post<ClaimResponse>(`/expenses/claims/${id}/approve`, { note }, opts(context))),

  rejectClaim: (context: LaravelContext, id: number, note: string) =>
    ensureSuccess(apiClient.post<ClaimResponse>(`/expenses/claims/${id}/reject`, { note }, opts(context))),

  payClaim: (context: LaravelContext, id: number, paymentReference?: string) =>
    ensureSuccess(apiClient.post<ClaimResponse>(`/expenses/claims/${id}/pay`, { payment_reference: paymentReference }, opts(context))),

  // Advances
  advances: (context: LaravelContext, scope: 'mine' | 'approvals', status?: AdvanceStatus | '') =>
    apiClient.get<{ status: number; data: ExpenseAdvance[]; summary: AdvanceSummary }>('/expenses/advances', {
      ...baseParams(context),
      scope,
      ...(status ? { status } : {}),
    }),

  /** The caller's own paid advances that still have a balance - for the claim form. */
  openAdvances: (context: LaravelContext) =>
    apiClient.get<{ status: number; data: ExpenseAdvance[] }>('/expenses/advances/open', baseParams(context)),

  createAdvance: (context: LaravelContext, payload: AdvanceInput) =>
    ensureSuccess(apiClient.post<StatusResponse & { data: ExpenseAdvance }>('/expenses/advances', payload, opts(context))),

  cancelAdvance: (context: LaravelContext, id: number) =>
    ensureSuccess(apiClient.post<StatusResponse & { data: ExpenseAdvance }>(`/expenses/advances/${id}/cancel`, {}, opts(context))),

  approveAdvance: (context: LaravelContext, id: number, note?: string) =>
    ensureSuccess(apiClient.post<StatusResponse & { data: ExpenseAdvance }>(`/expenses/advances/${id}/approve`, { note }, opts(context))),

  rejectAdvance: (context: LaravelContext, id: number, note: string) =>
    ensureSuccess(apiClient.post<StatusResponse & { data: ExpenseAdvance }>(`/expenses/advances/${id}/reject`, { note }, opts(context))),

  payAdvance: (context: LaravelContext, id: number, paymentReference?: string) =>
    ensureSuccess(apiClient.post<StatusResponse & { data: ExpenseAdvance }>(`/expenses/advances/${id}/pay`, { payment_reference: paymentReference }, opts(context))),

  // Dashboard and reports
  dashboard: (context: LaravelContext) =>
    apiClient.get<{ status: number; data: ExpenseDashboard }>('/expenses/dashboard', baseParams(context)),

  unpaidClaimsReport: (context: LaravelContext) =>
    apiClient.get<StatusResponse & UnpaidClaimsReport>('/expenses/reports/unpaid-claims', baseParams(context)),

  advanceSummaryReport: (context: LaravelContext) =>
    apiClient.get<StatusResponse & AdvanceSummaryReport>('/expenses/reports/advance-summary', baseParams(context)),
}
