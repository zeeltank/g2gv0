/**
 * THE HR/ADMIN HOME DASHBOARD CONTRACT.
 *
 * Mirrors GET /api/dashboard/hr/*. Two things in here are load-bearing and
 * should not be "simplified" away:
 *
 * 1. `value: number | null` — NULL MEANS NOT MEASURED, and it is a different
 *    fact from 0. "No attendance was recorded today" and "0% of staff attended"
 *    are not the same claim; the first is a Sunday, the second is a crisis.
 *    Every nullable value ships with an `empty_reason` naming the fix.
 *
 * 2. `empty_is_expected` / `empty_reason` sit OUTSIDE `data`, matching the
 *    backend envelope. A tenant with nothing yet is normal; an empty payload
 *    from a failed query is not, and the flag is what distinguishes them.
 */

export interface HrKpiTile {
  key: string
  label: string
  /** NULL = not measured. Never render this as 0. */
  value: number | null
  unit: string | null
  /** null until dashboard_metric_snapshot has run twice — no invented arrows. */
  trend: { value: number; direction: 'up' | 'down'; label: string } | null
  empty_reason: string | null
  menu: string | null
  breakdown?: { key: string; label: string; count: number; menu: string | null }[]
}

export interface HrActionRow {
  key: string
  label: string
  /**
   * NULL = not tracked at all. "Compliance Violations" keeps its row in the
   * design because the layout is the customer's, but no violations table
   * exists anywhere in the schema — so it renders a dash, not a zero. A zero
   * would claim nobody is in violation; a dash says nobody is counting.
   */
  count: number | null
  /** The short status phrase on the right of the row: "Needs Approval". */
  state: string
  tone: 'neutral' | 'warning' | 'danger'
  menu: string | null
}

export interface HrDepartmentSplit {
  segments: { id: number | null; name: string; value: number }[]
  /** Employees with no department. Kept explicit so segments + unassigned = headcount. */
  unassigned: number
  total: number
  /**
   * How many department NAMES are backed by more than one row. Those rows are
   * summed into one slice, because three slices sharing a label read as a
   * broken chart — but the merge is reported rather than hidden.
   */
  merged_duplicate_names?: number
}

export interface HrActivityRow {
  id: string
  type: string
  text: string
  context: string
  actor: string | null
  at: string | null
}

export interface HrDashboardSummary {
  kpis: HrKpiTile[]
  action_center: HrActionRow[]
  departments: HrDepartmentSplit
  activity: HrActivityRow[]
  /** Rows excluded from every count above because they belong to no tenant. */
  diagnostics: { employees_without_tenant: number; tasks_without_tenant: number }
}

export interface HrDashboardFilters {
  departments: { value: string; label: string }[]
  departments_empty_reason: string | null
  /**
   * Location and Business Unit are returned but NOT usable: they live on
   * s_user_jobrole and describe job roles, while tbluser has no such column —
   * so they cannot filter headcount, attendance, tasks or departments. The
   * select renders disabled with `*_reason` as its explanation, rather than
   * offering a control that silently does nothing.
   */
  locations: { value: string; label: string }[]
  locations_available: boolean
  locations_reason: string | null
  business_units: { value: string; label: string }[]
  business_units_available: boolean
  business_units_reason: string | null

  /**
   * DESTINATIONS FROM tblmenumaster_g2g, keyed by a stable slug.
   *
   * NULL means this organisation has no such menu — the control renders
   * disabled with a reason rather than routing to a screen that will bounce
   * back to /dashboard. Hardcoding these in the component is what made them
   * dead links every time a menu was renamed or moved.
   */
  links: Record<string, string | null>
  /** The `menu` value a tile carries -> a key in `links`. */
  menu_map: Record<string, string>
}

/** The envelope. Siblings live outside `data`, as the backend sends them. */
export interface HrDashboardEnvelope<T> {
  status: number
  message: string
  data: T
  empty_is_expected: boolean
  empty_reason: string | null
  truncated: boolean
  scope: string
  meta?: { as_of?: string; syear?: string; filters?: Record<string, string | null> }
}

/** One month of the workforce chart. NULL present = nothing was recorded. */
export interface HrWorkforceMonth {
  month: string
  present: number | null
  leave: number
  /** Derived: expected working days x headcount - present - leave. */
  absent: number | null
  attendance: number | null
  expected_working_days: number | null
  active_employees: number
}

export interface HrWorkforceSection {
  workforce: {
    months: HrWorkforceMonth[]
    calendar_available: boolean
    note: string | null
  }
  modules: {
    key: string
    title: string
    figures: { label: string; value: number | null; unit?: string | null }[]
  }[]
  learning: {
    key: string
    title: string
    /** NULL when the denominator is 0 - not measurable, not 0%. */
    percent: number | null
    current: number
    total: number
    variant: string
    empty_reason: string | null
  }[]
  funnel: { key: string; name: string; value: number }[]
}

export interface HrSignalsSection {
  events: {
    id: string
    date: string
    title: string
    subtitle: string | null
    time_label: string | null
    location: string | null
    source: string
  }[]
}
