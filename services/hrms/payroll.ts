/**
 * Payroll Service
 *
 * Backed by the legacy Laravel payroll routes registered in routes/hrms.php
 * (App\Http\Controllers\Payroll\PayrollController). They live on the web router
 * rather than under /api, so they go through webClient - the same pattern the
 * organization and task services already use for Laravel's `type=API` web
 * routes. Every call carries the standard Laravel context (token,
 * sub_institute_id, user_id) via withLaravelParams.
 */

import { webClient } from '@/services/core'
import { resolveWebBaseUrl } from '@/lib/api-config'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

/** A payroll_types row exactly as PayrollController@payrollType returns it. */
export interface LaravelPayrollType {
  id: number | string
  /** 1 = Earning, 2 = Deduction */
  payroll_type: number | string | null
  payroll_name: string | null
  /** 1 = Flat, 2 = Percentage */
  amount_type: number | string | null
  /** 1 = Active, 0 = Inactive */
  status: number | string | null
  sort_order: number | string | null
  sub_institute_id: number | string | null
  /**
   * Holds the flat amount *and* the percentage - payroll_types has a single
   * column for both, selected by amount_type.
   */
  payroll_percentage: number | string | null
  /** char(1): '1' when the component is pro-rated by attended days. */
  day_count: number | string | null
  created_by?: number | string | null
  updated_by?: number | string | null
  created_at?: string | null
  updated_at?: string | null
  deleted_at?: string | null
}

/** GET /payroll-type - is_mobile() wraps the collection in a `data` key. */
export interface PayrollTypeListResponse {
  data?: LaravelPayrollType[]
}

/** payrollStore and payrollDestroy both answer with this envelope. */
export interface PayrollStatusResponse {
  status_code?: number | string
  status?: number | string
  message?: string
}

/**
 * Whether a payroll month is still writable. F-129.
 *
 * `locked` is derived on the server from locked_at vs reopened_at rather than
 * stored as a flag, so a month that was locked, reopened and locked again keeps
 * its whole history instead of collapsing to one boolean.
 */
export interface PayrollMonthLockResponse extends PayrollStatusResponse {
  locked?: boolean
  locked_at?: string | null
  /** The person's name, not their id - this goes straight into a sentence. */
  locked_by?: string | null
  reopened_at?: string | null
  reopen_reason?: string | null
  month?: string
  year?: number
}

export type PayrollTypeKind = 'Earning' | 'Deduction'
export type PayrollAmountType = 'Flat' | 'Percentage'
export type PayrollTypeStatus = 'Active' | 'Inactive'

/** The row shape the Payroll Type screen renders. */
export interface PayrollTypeRow {
  id: number
  srNo: number
  kind: PayrollTypeKind
  name: string
  amountType: PayrollAmountType
  /** null when the backend has no value - rendered as a dash, never as 0. */
  amountOrPercentage: number | null
  dayCount: boolean
  status: PayrollTypeStatus
  sortOrder: number | null
}

/**
 * payrollStore overwrites every column from the request, so a save always sends
 * the complete row - a partial payload would blank the omitted fields.
 */
export interface PayrollTypePayload {
  /** Present = update (Laravel branches on `$request->id > 0`), absent = create. */
  id?: number | null
  kind: PayrollTypeKind
  name: string
  amountType: PayrollAmountType
  amountOrPercentage: string
  dayCount: boolean
  status: PayrollTypeStatus
  sortOrder?: string
}

function toNullableNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** Laravel stores these as ints, tinyints and char(1) - compare as strings. */
function isFlag(value: number | string | null | undefined): boolean {
  return String(value ?? '') === '1'
}

/**
 * Maps one Laravel row onto the view model. `srNo` is positional, matching the
 * legacy screen: payroll_types has no display-index column of its own.
 */
export function normalizePayrollType(item: LaravelPayrollType, index: number): PayrollTypeRow {
  return {
    id: Number(item.id),
    srNo: index + 1,
    kind: isFlag(item.payroll_type) ? 'Earning' : 'Deduction',
    name: item.payroll_name ?? '',
    amountType: isFlag(item.amount_type) ? 'Flat' : 'Percentage',
    amountOrPercentage: toNullableNumber(item.payroll_percentage),
    dayCount: isFlag(item.day_count),
    status: isFlag(item.status) ? 'Active' : 'Inactive',
    sortOrder: toNullableNumber(item.sort_order),
  }
}

/** Rebuilds a save payload from an existing row, for row actions like the status toggle. */
export function payrollTypeToPayload(row: PayrollTypeRow): PayrollTypePayload {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    amountType: row.amountType,
    amountOrPercentage: row.amountOrPercentage === null ? '' : String(row.amountOrPercentage),
    dayCount: row.dayCount,
    status: row.status,
    sortOrder: row.sortOrder === null ? '' : String(row.sortOrder),
  }
}

/* ------------------------------------------------------------------ *
 * Shared shapes across the payroll screens
 * ------------------------------------------------------------------ */

/** One row of the employeeDetails() helper (app/Helpers/helpers.php). */
export interface LaravelPayrollEmployee {
  id: number | string
  employee_no?: string | null
  first_name?: string | null
  middle_name?: string | null
  last_name?: string | null
  gender?: string | null
  department?: string | null
  department_id?: number | string | null
  user_profile?: string | null
  status?: number | string | null
  pf_deduction?: string | null
  pt_deduction?: string | null
  join_year?: string | number | null
}

/**
 * Laravel serialises an empty keyed Collection as `[]` and a populated one as an
 * object, so every "map" the payroll controller returns has to be narrowed
 * before use.
 */
export function toRecord<V>(value: Record<string, V> | unknown[] | null | undefined): Record<string, V> {
  if (!value || Array.isArray(value)) return {}
  return value
}

/**
 * `->where()` on a Collection preserves the original keys, so several payroll
 * responses arrive as objects where an array is expected.
 */
export function toList<T>(value: T[] | Record<string, T> | null | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : Object.values(value)
}

/**
 * Builds a query string carrying the Laravel context plus scalars and PHP-style
 * `name[0]`, `name[1]` array params. URLSearchParams via webClient.get cannot
 * express the array form, so these endpoints take a pre-built query string.
 */
function payrollQuery(
  context: LaravelContext,
  params: Record<string, string | number | undefined | null> = {},
  arrays: Record<string, Array<string | number>> = {},
) {
  const search = new URLSearchParams(withLaravelParams(context))

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  })

  Object.entries(arrays).forEach(([key, values]) => {
    values.forEach((value, index) => search.append(`${key}[${index}]`, String(value)))
  })

  return search.toString()
}

/* ------------------------------------------------------------------ *
 * Salary Structure - /employee-salary-structure
 * ------------------------------------------------------------------ */

export interface SalaryStructureQuery {
  year: string
  /** '1' active, '0' inactive; omitted means the controller's default of active. */
  employeeStatus?: string
  employeeIds?: Array<string | number>
  departmentIds?: Array<string | number>
}

export interface SalaryStructureResponse {
  employees?: LaravelPayrollEmployee[]
  employeeLists?: LaravelPayrollEmployee[]
  payrollTypes?: LaravelPayrollType[]
  /** employee_id -> { payroll_type_id: amount } */
  employeeSalaryStructures?: Record<string, Record<string, number | string>> | unknown[]
  emp_status?: number | string
}

export interface SalaryStructureSavePayload {
  year: string
  payrollTypes: LaravelPayrollType[]
  employees: Array<{
    employeeId: number | string
    gender: string
    /** payroll_type_id (as string) -> amount */
    values: Record<string, number>
    /**
     * F-174. Amounts stored against heads this screen does NOT render, because
     * the head is deactivated, soft-deleted, or belongs to another
     * organisation.
     *
     * They have to be posted back. employeeSalaryStructureStore rebuilds
     * `employee_salary_data` from the posted rows and OVERWRITES the column -
     * it does not merge - so a head that is not posted is deleted. Since the
     * grid only renders active heads, an ordinary Save on an untouched screen
     * silently destroyed every amount on a non-active head. On this deployment
     * that is all eight live structures.
     */
    carriedValues?: Record<string, number>
  }>
}

/* ------------------------------------------------------------------ *
 * Payroll Deduction - /payroll-deduction
 * ------------------------------------------------------------------ */

export interface PayrollDeductionQuery {
  /** The payroll type id, not the 1/2 category - see getPayrollDeductions. */
  payrollTypeId: string | number
  /** Three-letter month as produced by Helpers::getMonths() - 'Apr', 'May', ... */
  month: string
  year: string
}

export interface PayrollDeductionOption {
  id: number | string
  payroll_name: string
}

export interface PayrollDeductionResponse {
  selMonth?: string
  selYear?: string | number
  selDeduction?: string | number
  selType?: string | number
  all_emp?: LaravelPayrollEmployee[]
  /** employee_id -> saved amount for the queried month/year/payroll type. */
  deductionArr?: Record<string, number | string> | unknown[]
  /** '1' (earnings) and '2' (deductions) -> the active payroll types in each. */
  payrollTypes?: Record<string, PayrollDeductionOption[]> | unknown[]
  months?: string[]
  years?: Array<number | string>
}

export interface PayrollDeductionSavePayload {
  payrollTypeId: string | number
  month: string
  year: string
  amounts: Array<{ employeeId: number | string; amount: number | string }>
}

/* ------------------------------------------------------------------ *
 * Monthly Payroll - /monthly-payroll/*
 * ------------------------------------------------------------------ */

export interface MonthlyPayrollQuery {
  month: string
  year: string
  /** Non-admin profiles are narrowed to their subordinates by employeeDetails(). */
  userProfileName?: string
  employeeIds?: Array<string | number>
  departmentIds?: Array<string | number>
}

/** A previously saved employee_monthly_salary_data row. */
export interface MonthlyPayrollSavedRow {
  id: number | string
  month?: string | null
  year?: number | string | null
  employee_id?: number | string | null
  total_deduction?: number | string | null
  total_payment?: number | string | null
  received_by?: string | null
  total_day?: number | string | null
  employee_salary_data?: string | null
}

export interface MonthlyPayrollEmployee extends LaravelPayrollEmployee {
  /** Attended days: from the saved row when present, else attendance-derived. */
  totalDay?: number | string | null
  json?: string | null
  monthlyData?: MonthlyPayrollSavedRow | null
}

export interface MonthlyPayrollCreateResponse {
  /** payroll_type_id -> name, plus the total_deduction/total_payment/received_by labels. */
  header?: Record<string, string> | unknown[]
  employeeDetails?: MonthlyPayrollEmployee[]
  months?: string[]
  years?: Record<string, string> | unknown[]
  selYear?: string | number
  selMonth?: string
  status?: number | string
  message?: string
}

export interface MonthlyBreakdownQuery {
  employeeId: number | string
  totalDay: number | string
  month: string
  year: string
}

export interface MonthlySalaryBreakdownResponse {
  /** payroll_type_id -> amount, plus total_deduction and total_payment. */
  salaryData?: Record<string, number | string>
  totalDay?: number | string
  allowanceTypes?: Array<Record<string, string>>
  deductionTypes?: Array<Record<string, string>>
  /** getEmpMonthlyData returns its array raw, so this stays `status_code`. */
  status_code?: number | string
  message?: string
}

export interface MonthlyPayrollSaveRow {
  employeeId: number | string
  totalDay: number | string
  totalDeduction: number | string
  totalPayment: number | string
  receivedBy: string
  /** payroll_type_id -> amount; stored verbatim as employee_salary_data. */
  payrollHead: Record<string, number>
}

export interface MonthlyPayrollSavePayload {
  month: string
  year: string
  rows: MonthlyPayrollSaveRow[]
}

/* ------------------------------------------------------------------ *
 * Form 16 - /form16-report
 * ------------------------------------------------------------------ */

export interface Form16Query {
  year: string
  departmentId: string | number
  employeeId: string | number
  allowanceIds?: Array<string | number>
  deductionIds?: Array<string | number>
}

export interface Form16SchoolDetail {
  SchoolName?: string | null
  Address?: string | null
  City?: string | null
  State?: string | null
  Zipcode?: string | null
  pan_no?: string | null
  tan_no?: string | null
  [key: string]: unknown
}

export interface Form16EmployeeDetail {
  id?: number | string
  first_name?: string | null
  middle_name?: string | null
  last_name?: string | null
  employee_no?: string | null
  pan_no?: string | null
  join_year?: string | number | null
  [key: string]: unknown
}

export interface Form16ReportResponse {
  payrollTypes?: LaravelPayrollType[] | Record<string, LaravelPayrollType>
  allowance?: LaravelPayrollType[] | Record<string, LaravelPayrollType>
  deduction?: LaravelPayrollType[] | Record<string, LaravelPayrollType>
  /** null when the employee has no structure for the year - see `message`. */
  get_employee_salary?: { employee_salary_data?: string | null } | null
  get_school_detail?: Form16SchoolDetail | null
  get_employee_detail?: Form16EmployeeDetail | null
  from_date?: string
  to_date?: string
  department_name?: { department_name?: string | null } | null
  year?: string | number
  employee_id?: string | number
  department_id?: string | number
  selected_allowances?: Array<string | number>
  selected_deductions?: Array<string | number>
  status?: number | string
  message?: string
}

/* ------------------------------------------------------------------ *
 * Salary Certificate - /hrms-salary-certificate*
 * ------------------------------------------------------------------ */

export interface SalaryCertificateIndexResponse {
  employee_id?: string | number | null
  /** '1' -> 'Jan' ... '12' -> 'Dec' */
  month_ids?: Record<string, string>
  departments?: Record<string, string> | unknown[]
  years?: Array<number | string>
  year?: string | number
  /** Earning heads only - the controller filters payroll_type = 1. */
  payrollTypes?: LaravelPayrollType[]
}

export interface SalaryCertificateQuery {
  departmentId: string | number
  employeeId: string | number
  year: string
  monthIds: Array<string | number>
  payrollTypeIds: Array<string | number>
  reason?: string
}

export interface SalaryCertificateReportResponse {
  pdfName?: string
  employees?: LaravelPayrollEmployee[]
  employee_id?: string | number
  department_id?: string | number
  year?: string | number
  selMonths?: Array<string | number>
  payroll_type_ids?: Array<string | number>
  reason?: string | null
  departments?: Record<string, string> | unknown[]
  department_name?: { department_name?: string | null } | null
  payrollTypes?: LaravelPayrollType[]
  month_ids?: Record<string, string>
  years?: Array<number | string>
  status?: number | string
  message?: string
}

/**
 * These controller actions authenticate off the request body, so the context
 * travels in the FormData rather than the query string.
 */
function payrollFormData(context: LaravelContext, fields: Record<string, string> = {}) {
  const formData = new FormData()
  formData.append('type', 'API')
  formData.append('token', context.token)
  formData.append('sub_institute_id', context.subInstituteId)
  formData.append('user_id', context.userId)

  Object.entries(fields).forEach(([key, value]) => {
    formData.append(key, value)
  })

  return formData
}

/**
 * payrollStore/payrollDestroy answer 200 with status_code 0 on failure, so a
 * non-throwing fetch is not enough to call it a success.
 */
async function ensurePayrollSuccess(request: Promise<PayrollStatusResponse>, fallback: string) {
  const response = await request
  const status = response.status_code ?? response.status

  if (String(status) === '0') {
    throw new Error(response.message || fallback)
  }

  return { message: response.message || fallback }
}

export const payrollService = {
  /**
   * Returns every non-soft-deleted payroll type for the tenant. The legacy
   * `status=1` query param is deliberately omitted: payrollType() ignores it and
   * always returns active and inactive rows, which is what the screen filters on.
   */
  getPayrollTypes: (context: LaravelContext) =>
    webClient.get<PayrollTypeListResponse>('/payroll-type', withLaravelParams(context)),

  /** Upsert - Laravel treats a positive `id` as an update of that row. */
  savePayrollType: (context: LaravelContext, payload: PayrollTypePayload) =>
    ensurePayrollSuccess(
      webClient.postForm<PayrollStatusResponse>(
        '/payroll-type/store',
        payrollFormData(context, {
          payroll_type: payload.kind === 'Earning' ? '1' : '2',
          payroll_name: payload.name,
          amount_type: payload.amountType === 'Flat' ? '1' : '2',
          payroll_percentage: payload.amountOrPercentage,
          status: payload.status === 'Active' ? '1' : '0',
          day_count: payload.dayCount ? '1' : '0',
          ...(payload.sortOrder ? { sort_order: payload.sortOrder } : {}),
          ...(payload.id ? { id: String(payload.id) } : {}),
        }),
      ),
      payload.id ? 'Payroll type updated successfully.' : 'Payroll type added successfully.',
    ),

  /** Soft delete - the controller stamps deleted_at/deleted_by, it does not purge. */
  deletePayrollType: (context: LaravelContext, id: number | string) =>
    ensurePayrollSuccess(
      webClient.postForm<PayrollStatusResponse>(
        `/payroll-type/destroy/${id}`,
        payrollFormData(context),
      ),
      'Payroll type deleted successfully.',
    ),

  /* ---------------- Salary Structure ---------------- */

  /**
   * GET /employee-salary-structure - PayrollController@employeeSalaryStructure.
   * `employeeLists` is the full picker list, `employees` the filtered result and
   * `employeeSalaryStructures` the saved amounts keyed by employee then payroll type.
   */
  getSalaryStructure: (context: LaravelContext, params: SalaryStructureQuery) =>
    webClient.get<SalaryStructureResponse>(
      `/employee-salary-structure?${payrollQuery(
        context,
        { syear: params.year, emp_status: params.employeeStatus },
        { employee_id: params.employeeIds ?? [], department_id: params.departmentIds ?? [] },
      )}`,
    ),

  /**
   * POST /employee-salary-structure/store.
   *
   * The controller reads `emp[employeeId][0]` as the gender and
   * `emp[employeeId][payrollTypeId][0..3]` as [id, amount, name, payroll_type];
   * it re-derives PF/PT from the payroll type config, so the name and type parts
   * are load-bearing, not decoration.
   */
  saveSalaryStructure: (context: LaravelContext, payload: SalaryStructureSavePayload) => {
    const formData = payrollFormData(context, { syear: payload.year })

    payload.employees.forEach((employee) => {
      formData.append(`emp[${employee.employeeId}][0]`, employee.gender ?? '')

      payload.payrollTypes.forEach((payrollType) => {
        const key = `emp[${employee.employeeId}][${payrollType.id}]`
        formData.append(`${key}[0]`, String(payrollType.id))
        formData.append(`${key}[1]`, String(employee.values[String(payrollType.id)] ?? 0))
        formData.append(`${key}[2]`, payrollType.payroll_name ?? '')
        formData.append(`${key}[3]`, String(payrollType.payroll_type ?? ''))
      })

      /*
       * F-174. Carry the unrendered heads through the rewrite.
       *
       * The controller overwrites employee_salary_data with exactly what is
       * posted, so anything omitted is deleted. These are amounts on heads the
       * grid cannot show; they are posted back unchanged so a Save preserves
       * them instead of destroying them.
       *
       * name and payroll_type are sent as placeholders on purpose: the
       * controller reads [2] only to spot the literal strings 'PF' and 'PT',
       * and a head id can never collide with those. The amount at [1] is what
       * matters, and for a head PayrollType cannot resolve the controller
       * passes it through untouched.
       */
      Object.entries(employee.carriedValues ?? {}).forEach(([headId, amount]) => {
        const key = `emp[${employee.employeeId}][${headId}]`
        formData.append(`${key}[0]`, headId)
        formData.append(`${key}[1]`, String(amount))
        formData.append(`${key}[2]`, `head-${headId}`)
        formData.append(`${key}[3]`, '0')
      })
    })

    return ensurePayrollSuccess(
      webClient.postForm<PayrollStatusResponse>('/employee-salary-structure/store', formData),
      'Salary structure saved successfully.',
    )
  },

  /**
   * POST /rollover-employee-salary-structure/store - copies each selected
   * employee's structure from `year` into year + 1. This action answers with a
   * plain `status` key rather than `status_code`.
   */
  rolloverSalaryStructure: (
    context: LaravelContext,
    params: { year: string; employeeIds?: Array<string | number>; departmentIds?: Array<string | number> },
  ) =>
    ensurePayrollSuccess(
      webClient.postForm<PayrollStatusResponse>(
        `/rollover-employee-salary-structure/store?${payrollQuery(
          context,
          { year: params.year },
          { employee_id: params.employeeIds ?? [], department_id: params.departmentIds ?? [] },
        )}`,
        new FormData(),
      ),
      'Salary structures rolled over successfully.',
    ),

  /* ---------------- Payroll Deduction ---------------- */

  /**
   * GET /payroll-deduction - PayrollController@payrollDeduction.
   *
   * `deduction_type` is the *payroll type id*, not the 1/2 category: that is what
   * the read filter here and getEmpMonthlyData (the downstream consumer in
   * Monthly Payroll) both match on.
   */
  getPayrollDeductions: (context: LaravelContext, params: PayrollDeductionQuery) =>
    webClient.get<PayrollDeductionResponse>(
      `/payroll-deduction?${payrollQuery(context, {
        status: '1',
        submit: 'Search',
        deduction_type: params.payrollTypeId,
        month: params.month,
        year: params.year,
      })}`,
    ),

  /**
   * POST /payroll-deduction/store.
   *
   * The controller writes `deduction_type` from the request's `payroll_type`, so
   * this must carry the payroll type *id* for the row to be found again by
   * getPayrollDeductions and by the Monthly Payroll calculation. (The legacy
   * screen sent the 1/2 category here, which is why its saved amounts never
   * reappeared.) `deductAmt` is iterated without a null guard server side, so at
   * least one entry is always sent.
   */
  savePayrollDeductions: (context: LaravelContext, payload: PayrollDeductionSavePayload) => {
    const formData = payrollFormData(context, {
      payroll_type: String(payload.payrollTypeId),
      deduction_type_id: String(payload.payrollTypeId),
      month: payload.month,
      year: payload.year,
    })

    payload.amounts.forEach((entry) => {
      formData.append(`deductAmt[${entry.employeeId}]`, String(entry.amount))
    })

    return ensurePayrollSuccess(
      webClient.postForm<PayrollStatusResponse>('/payroll-deduction/store', formData),
      'Deduction amounts saved successfully.',
    )
  },

  /* ---------------- Monthly Payroll ---------------- */

  /**
   * GET /monthly-payroll/create - PayrollController@monthlyPayrollCreate.
   * Returns each employee with their already-saved `monthlyData` row (if any)
   * and the attendance-derived `totalDay` when nothing is saved yet.
   */
  getMonthlyPayroll: (context: LaravelContext, params: MonthlyPayrollQuery) =>
    webClient.get<MonthlyPayrollCreateResponse>(
      `/monthly-payroll/create?${payrollQuery(
        context,
        {
          month: params.month,
          year: params.year,
          user_profile_name: params.userProfileName,
        },
        { emp_id: params.employeeIds ?? [], department_id: params.departmentIds ?? [] },
      )}`,
    ),

  /**
   * GET /getMonthlyData - recomputes one employee's payslip lines for a given
   * number of attended days. Returns `status_code: 0` (not `status`) when the
   * employee has no salary structure for the year.
   */
  getMonthlySalaryBreakdown: (context: LaravelContext, params: MonthlyBreakdownQuery) =>
    webClient.get<MonthlySalaryBreakdownResponse>(
      `/getMonthlyData?${payrollQuery(context, {
        emp_id: params.employeeId,
        totalDay: params.totalDay,
        month: params.month,
        year: params.year,
      })}`,
    ),

  /**
   * POST /monthly-payroll-store.
   *
   * The warning that used to live here - "the controller INSERTs unconditionally
   * so only rows without an existing monthlyData record may be submitted,
   * otherwise the month gets duplicate payslips" - was TRUE, and describing a
   * data-integrity hazard in a comment is not the same as fixing it. Live data
   * held 17 payslips for one employee-month.
   *
   * Sprint 6 (F-109) made the controller match on
   * (employee_id, month, year, sub_institute_id) and update in place, so
   * re-saving a month CORRECTS it. Sprint 7 (F-129) added a lock, so a month
   * that has been declared finished refuses the save outright - see
   * getMonthLock / setMonthLock below.
   */
  saveMonthlyPayroll: (context: LaravelContext, payload: MonthlyPayrollSavePayload) =>
    ensurePayrollSuccess(
      webClient.post<PayrollStatusResponse>('/monthly-payroll-store', {
        ...withLaravelParams(context),
        month: payload.month,
        year: payload.year,
        payrollVal: Object.fromEntries(
          payload.rows.map((row) => [
            String(row.employeeId),
            {
              total_day: row.totalDay,
              total_deduction: row.totalDeduction,
              total_payment: row.totalPayment,
              received_by: row.receivedBy,
              payrollHead: row.payrollHead,
            },
          ]),
        ),
      }),
      'Monthly payroll saved successfully.',
    ),

  /**
   * GET /monthly-payroll-lock - is this month still writable?
   *
   * F-129. Read from the SAME endpoint that enforces it at the write, so the
   * screen cannot show "open" for a month the server will refuse. A lock the
   * browser decides is the defect F-91 already found in this module's payroll.
   */
  getMonthLock: (context: LaravelContext, params: { month: string; year: number }) =>
    webClient.get<PayrollMonthLockResponse>(
      `/monthly-payroll-lock?${payrollQuery(context, {
        month: params.month,
        year: String(params.year),
      })}`,
    ),

  /**
   * POST /monthly-payroll-lock - close the month, or reopen it with a reason.
   *
   * `reason` is required by the server when reopening, not optional-with-a-
   * default. A lock that can be lifted silently is not a lock.
   */
  setMonthLock: (
    context: LaravelContext,
    params: { month: string; year: number; action: 'lock' | 'reopen'; reason?: string },
  ) =>
    webClient.post<PayrollMonthLockResponse>('/monthly-payroll-lock', {
      ...withLaravelParams(context),
      month: params.month,
      year: params.year,
      action: params.action,
      ...(params.reason ? { reason: params.reason } : {}),
    }),

  /**
   * POST /monthly-payroll-delete/{month}.
   *
   * `deleteId` entries must be `"<employee_monthly_salary_data.id>###<employee_id>"`.
   * Sending a bare employee id (as the legacy screen did) makes the controller
   * treat it as the salary-data row id and delete an unrelated payslip.
   */
  deleteMonthlyPayroll: (
    context: LaravelContext,
    params: { month: string; year: string; entries: Array<{ dataId: number | string; employeeId: number | string }> },
  ) =>
    ensurePayrollSuccess(
      webClient.postForm<PayrollStatusResponse>(
        `/monthly-payroll-delete/${params.month}?${payrollQuery(
          context,
          { month: params.month, year: params.year },
          { deleteId: params.entries.map((entry) => `${entry.dataId}###${entry.employeeId}`) },
        )}`,
        new FormData(),
      ),
      'Payroll record deleted successfully.',
    ),

  /* ---------------- Form 16 ---------------- */

  /**
   * POST /form16-report - PayrollController@form16Report.
   *
   * GET /form16 (the index that would supply the allowance/deduction pickers)
   * calls an undefined `jwtToken()` helper and fatals under `type=API`, so the
   * pickers are fed from GET /payroll-type instead and only the report call is
   * used here.
   */
  getForm16Report: (context: LaravelContext, params: Form16Query) =>
    webClient.postForm<Form16ReportResponse>(
      `/form16-report?${payrollQuery(
        context,
        {
          syear: params.year,
          year: params.year,
          department_id: params.departmentId,
          emp_id: params.employeeId,
        },
        { allowance: params.allowanceIds ?? [], deduction: params.deductionIds ?? [] },
      )}`,
      new FormData(),
    ),

  /* ---------------- Salary Certificate ---------------- */

  /** GET /hrms-salary-certificate - departments, years, months and earning heads. */
  getSalaryCertificateOptions: (context: LaravelContext) =>
    webClient.get<SalaryCertificateIndexResponse>(
      `/hrms-salary-certificate?${payrollQuery(context)}`,
    ),

  /**
   * POST /hrms-salary-certificate-report - renders the certificate HTML and
   * upserts it into hrms_salary_certificate. The PDF is then streamed by
   * salaryCertificatePdfUrl().
   */
  generateSalaryCertificate: (context: LaravelContext, params: SalaryCertificateQuery) =>
    webClient.postForm<SalaryCertificateReportResponse>(
      `/hrms-salary-certificate-report?${payrollQuery(
        context,
        {
          department_id: params.departmentId,
          employee_id: params.employeeId,
          year: params.year,
          reason: params.reason,
        },
        { month_id: params.monthIds, payroll_type_id: params.payrollTypeIds },
      )}`,
      new FormData(),
    ),

  /**
   * POST /payroll-bank-wise-report - the month's payment advice (F-166).
   *
   * Month and year are required by the controller: without both it returns the
   * pickers and an empty employee list rather than an error, so the screen must
   * send them rather than rely on a default.
   */
  getBankWiseReport: (
    context: LaravelContext,
    params: { month: string; year: string | number },
  ) =>
    webClient.postForm<BankWiseReportResponse>(
      `/payroll-bank-wise-report?${payrollQuery(context, {
        month: params.month,
        year: params.year,
      })}`,
      new FormData(),
    ),

  /**
   * POST /employee-payroll-history - one financial year of payslips (F-169).
   *
   * `year` is a PAIR ("2025-2026"), not a single year: the controller splits on
   * the hyphen and reads Jan/Feb/Mar from the later year. Sending "2025" would
   * make `$year[0]+1` produce NaN-ish behaviour and return nothing.
   *
   * `emp_id` and `department_id` are compared with `!= 0`, so "no filter" is the
   * literal 0, not an omitted parameter.
   */
  getPayrollHistory: (
    context: LaravelContext,
    params: { financialYear: string; employeeId?: string | number; departmentId?: string | number },
  ) =>
    webClient.postForm<PayrollHistoryResponse>(
      `/employee-payroll-history?${payrollQuery(context, {
        year: params.financialYear,
        emp_id: params.employeeId ?? 0,
        department_id: params.departmentId ?? 0,
      })}`,
      new FormData(),
    ),

  /**
   * POST /payroll-report - the month's payroll register (F-172).
   *
   * Beware the year. The controller puts `Helpers::getPairYears()` into
   * `res['years']`, so it OFFERS "2025-2026" style pairs - but the query does
   * `where('year', $searchedYear)` against a single year, and bumps it by one
   * for Jan/Feb/Mar. Sending a pair matches nothing and returns an empty
   * register that looks like "no payroll was run". A single calendar year is
   * what this takes.
   */
  getPayrollRegister: (
    context: LaravelContext,
    params: { month: string; year: string | number; departmentId?: string | number },
  ) =>
    webClient.postForm<PayrollRegisterResponse>(
      `/payroll-report?${payrollQuery(context, {
        month: params.month,
        year: params.year,
        department_id: params.departmentId ?? 0,
      })}`,
      new FormData(),
    ),

  /**
   * POST /salary-structure-report - every employee's structure for a year.
   *
   * Until F-160 this read session() with no type=API branch, so an API caller
   * resolved to tenant null and it returned an empty list however it was
   * filtered. The screen could not have been built on it.
   */
  /**
   * GET /payroll-deduction/orphans - adjustments the calculation cannot find
   * (Q9 / F-173).
   *
   * Their `month` is stored as "8"/"2"/"3" rather than "Aug"/"Feb"/"Mar", and
   * the calculation matches the spelling exactly, so every payroll run since
   * they were entered has skipped them. 343,001 on this deployment, all
   * entered on a screen that reported success.
   */
  getDeductionOrphans: (context: LaravelContext) =>
    webClient.get<DeductionOrphansResponse>(
      '/payroll-deduction/orphans',
      withLaravelParams(context),
    ),

  /**
   * POST /payroll-deduction/orphans/resolve - one explicit decision, one row.
   *
   * There is no bulk repair on purpose: no rule can derive the right month
   * from "3", and a "fix all" button would be that guess wearing a label.
   */
  resolveDeductionOrphan: (
    context: LaravelContext,
    params: { id: number | string; action: 'set-month' | 'delete'; month?: string },
  ) =>
    webClient.postForm<PayrollStatusResponse>(
      `/payroll-deduction/orphans/resolve?${payrollQuery(context, {
        id: params.id,
        action: params.action,
        ...(params.month ? { month: params.month } : {}),
      })}`,
      new FormData(),
    ),

  getSalaryStructureReport: (
    context: LaravelContext,
    params: { year?: string | number; employeeIds?: Array<string | number>; departmentIds?: Array<string | number> },
  ) =>
    webClient.postForm<SalaryStructureReportResponse>(
      `/salary-structure-report?${payrollQuery(
        context,
        {
          year: params.year ?? 0,
          // The controller tests `$request->emp_id != 0` and only then does
          // implode(), so "no filter" has to be the literal 0 - an omitted
          // parameter is null, null != 0 is FALSE in PHP, and it happens to
          // work, but a `0` says what is meant. When a filter IS set the
          // array form below supplies emp_id[0], emp_id[1]... instead.
          ...(params.employeeIds?.length ? {} : { emp_id: 0 }),
          ...(params.departmentIds?.length ? {} : { department_id: 0 }),
        },
        {
          ...(params.employeeIds?.length ? { emp_id: params.employeeIds } : {}),
          ...(params.departmentIds?.length ? { department_id: params.departmentIds } : {}),
        },
      )}`,
      new FormData(),
    ),
}

/* ------------------------------------------------------------------ *
 * Bank-wise Payment Advice - /payroll-bank-wise-report
 *
 * F-166. The endpoint has been implemented, routed, gated and returning clean
 * JSON the whole time, with no caller anywhere. It is the one payroll report
 * that produces something the business cannot get any other way: for a given
 * month, every employee who was ACTUALLY PAID (the query is
 * `whereNotNull('total_payment')`), with the bank_name / account_no / ifsc_code
 * needed to move the money. Until now finance re-keyed that by hand.
 * ------------------------------------------------------------------ */

/** The tbluser row the controller attaches to each payslip as `usersDetails`. */
export interface BankWiseEmployeeDetails {
  id?: number | string
  employee_no?: string | null
  first_name?: string | null
  middle_name?: string | null
  last_name?: string | null
  department?: string | null
  bank_name?: string | null
  account_no?: string | null
  ifsc_code?: string | null
}

export interface BankWisePayslip {
  id: number | string
  employee_id: number | string
  month?: string | null
  year?: string | number | null
  total_payment?: string | number | null
  total_deduction?: string | number | null
  total_day?: string | number | null
  /**
   * `[]` when the employee row could not be resolved, an object when it could -
   * Laravel serialises an empty array and a populated map differently, which is
   * why this is not simply `BankWiseEmployeeDetails`.
   */
  usersDetails?: BankWiseEmployeeDetails | unknown[]
}

export interface BankWiseReportResponse {
  status_code?: number
  message?: string
  employees?: BankWisePayslip[]
  list?: { month?: string; year?: string | number }
  months?: Record<string, string> | string[]
  years?: Record<string, string> | string[]
  currentYear?: string | number
}

/** Narrows the `[] | object` union above to something renderable. */
export function bankWiseEmployee(row: BankWisePayslip): BankWiseEmployeeDetails {
  const details = row.usersDetails
  return details && !Array.isArray(details) ? details : {}
}

/* ------------------------------------------------------------------ *
 * Employee Payroll History - /employee-payroll-history
 *
 * F-169. One employee's payslips across a FINANCIAL year (Apr-Mar): the
 * controller takes `year` as a PAIR - "2025-2026" - splits it, and pulls
 * Jan/Feb/Mar from the second year and everything else from the first.
 *
 * The screen built on this has to be careful with one thing. `header` is built
 * from payroll_types WHERE status = 1, but a filed payslip's
 * `employee_salary_data` stores amounts against whatever head ids were used at
 * the time - including heads since deactivated, soft-deleted, or (on payslip 22
 * in this deployment) belonging to a DIFFERENT organisation entirely. Of that
 * payslip's stated 81,300, only 6,205 sits on a live head of its own tenant;
 * 35,000 is on soft-deleted heads and 52,500 on tenant 1's.
 *
 * So a table that renders only the `header` columns silently loses most of the
 * money and does not add up. Every id present in `data` is rendered.
 * ------------------------------------------------------------------ */

export interface PayrollHistoryEntry {
  employee_id?: number | string
  employee_no?: string | null
  employee_name?: string | null
  /** payroll_type_id -> amount. Keys are NOT guaranteed to exist in `header`. */
  data?: Record<string, number | string> | unknown[]
  total_day?: string | number | null
  month?: string | null
  year?: string | number | null
  total_deduction?: string | number | null
  total_payment?: string | number | null
}

/* ------------------------------------------------------------------ *
 * Payroll Register - /payroll-report  (F-172)
 *
 * The month's payslips with the DAY COUNTS reconciled against attendance,
 * leave and the holiday calendar: lwp_days, leave_days and absent_days are
 * computed per employee by walking the month. Nothing else in the frontend
 * joins payroll to attendance, so this is the only place "why is this person's
 * pay low" is answered in the same row as the pay.
 * ------------------------------------------------------------------ */

export interface PayrollRegisterRow {
  /** The payslip's own id. Was overwritten by u.id until F-172. */
  id: number | string
  employee_id: number | string
  /** The joined tbluser id, aliased by F-172 so it stops shadowing `id`. */
  user_id?: number | string
  full_name?: string | null
  employee_no?: string | null
  department_ids?: number | string | null
  month?: string | null
  year?: string | number | null
  total_day?: string | number | null
  total_deduction?: string | number | null
  total_payment?: string | number | null
  received_by?: string | null
  /** JSON STRING of payroll_type_id -> amount, not an object. */
  employee_salary_data?: string | null
  /** Computed by the controller, not stored on the payslip. */
  lwp_days?: number | string | null
  leave_days?: number | string | null
  absent_days?: number | string | null
}

export interface PayrollRegisterResponse {
  months?: Record<string, string> | string[]
  /** Pair years ("2025-2026") even though the query wants a single one. */
  years?: Record<string, string> | string[]
  month?: string
  year?: string | number
  employeeDetails?: PayrollRegisterRow[]
  department_id?: string | number | null
}

/* ------------------------------------------------------------------ *
 * Salary Structure Report - /salary-structure-report
 * ------------------------------------------------------------------ */

export interface SalaryStructureReportRow {
  id: number | string
  employee_id: number | string
  /** JSON STRING of payroll_type_id -> amount. */
  employee_salary_data?: string | null
  year?: string | number | null
  employee_name?: string | null
  employee_no?: string | null
  department?: string | null
}

export interface SalaryStructureReportResponse {
  year?: string | number
  selected_emp?: unknown
  department_id?: unknown
  /** payroll_type_id -> name, ACTIVE heads only - same caveat as F-169. */
  headers?: Record<string, string> | unknown[]
  years?: Record<string, string> | string[]
  salaryStructure?: SalaryStructureReportRow[]
}

export interface PayrollHistoryResponse {
  employeeLists?: LaravelPayrollEmployee[]
  /**
   * The controller's map returns `[]` for a row matching neither of its two
   * year branches, so this array can contain empty objects. They are dropped
   * rather than rendered as a blank month.
   */
  currentYearemployeeDetails?: PayrollHistoryEntry[]
  /** payroll_type_id -> name, ACTIVE heads only. */
  header?: Record<string, string> | unknown[]
  list?: { month?: string; year?: string; employee_id?: string | number }
  /** "2025-2026" style pairs. */
  years?: Record<string, string> | string[]
  selEmp?: string | number
  selDept?: string | number
  selYear?: string
}

/**
 * GET /salary-certificate-pdf-download streams a PDF attachment rather than
 * JSON, so it is opened directly instead of going through the fetch client.
 */
export function salaryCertificatePdfUrl(
  context: LaravelContext,
  params: { employeeId: string | number; year: string | number },
) {
  const query = payrollQuery(context, { employee_id: params.employeeId, year: params.year })
  return `${resolveWebBaseUrl()}/salary-certificate-pdf-download?${query}`
}

/**
 * GET /monthly-payroll-report/pdf/{id}/{month}/{year} - the payslip Laravel
 * generates and files under the employee's staff documents on save.
 */
export function monthlyPayslipPdfUrl(
  context: LaravelContext,
  params: { employeeId: string | number; month: string; year: string | number },
) {
  const query = payrollQuery(context)
  return `${resolveWebBaseUrl()}/monthly-payroll-report/pdf/${params.employeeId}/${params.month}/${params.year}?${query}`
}

/* ------------------------------------------------------------------ *
 * Q9 / F-173 - payroll adjustments the calculation has never found
 * ------------------------------------------------------------------ */

export interface DeductionOrphan {
  id: number | string
  /** The raw stored value - "8", "2", "3". Deliberately NOT normalised. */
  month: string | null
  year: string | number | null
  employee_id: number | string
  deduction_type: number | string
  deduction_amount: string | number | null
  employee_name?: string | null
  employee_no?: string | null
  /** Null when the head itself no longer exists. */
  payroll_name?: string | null
  head_status?: number | string | null
  head_deleted_at?: string | null
  head_tenant?: number | string | null
  /**
   * When the row was ENTERED - the evidence that decides what its month meant.
   *
   * A row stored as month "8" but entered in December, or year 2020 entered in
   * 2025, says far more about what happened than the month field does. Shown
   * beside the stored month so the person deciding has both.
   */
  created_at?: string | null
  updated_at?: string | null
}

export interface DeductionOrphansResponse {
  status_code?: number
  orphans?: DeductionOrphan[]
  months?: string[]
  total?: number
}
