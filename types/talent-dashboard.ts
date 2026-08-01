/**
 * Talent Management dashboard.
 *
 * Mirrors the payload of GET /api/talent/dashboard
 * (App\Http\Controllers\Api\TalentDashboardController).
 *
 * Nullable numbers are deliberate: the controller returns null - never a
 * fabricated 0 - for any figure it cannot derive from real rows, so the UI can
 * render "no data" instead of a confident wrong number.
 */

/** Laravel returns numeric ids as numbers here, but tolerate string ids. */
export type LaravelId = number | string

export interface TalentDashboardKpis {
  open_positions: number
  critical_positions: number
  candidates: number
  /** Null when the preceding window had no applications to compare against. */
  candidate_trend_pct: number | null
  onboarding: number
  preboarding: number
  performance: number
  pending_reviews: number
  mobility: number
  mobility_applications: number
  offboarding: number
  clearances_pending: number
}

export interface TalentPipelineStage {
  key: 'requisition' | 'screening' | 'interview' | 'offer' | 'hired'
  label: string
  value: number
}

export interface TalentPipeline {
  stages: TalentPipelineStage[]
  /** Null until at least one candidate has been hired. */
  avg_time_to_hire_days: number | null
  /** Null until at least one offer has actually been extended. */
  offer_acceptance_rate: number | null
  /** How many extended offers the rate above was computed from. */
  offer_acceptance_basis: number
}

export interface TalentPerformanceCycle {
  cycle_id: LaravelId | null
  cycle_name: string | null
  cycle_status: string | null
  period_start: string | null
  period_end: string | null
  completed: number
  in_progress: number
  not_started: number
  total: number
  completed_pct: number
}

export interface TalentOnboardingProgress {
  completed: number
  in_progress: number
  not_started: number
  total: number
  completed_pct: number
  /** Null until at least one journey has been completed. */
  avg_completion_days: number | null
}

export type TalentTone = 'danger' | 'warning' | 'primary' | 'success' | 'neutral'

/** A row of "My Action Items". `menu` is the m3 menu id to navigate to. */
export interface TalentActionItem {
  key: string
  label: string
  count: number
  tone: TalentTone
  menu: 'recruitment' | 'performance' | 'onboarding' | 'offboarding' | 'mobility-succession'
}

export interface TalentActivityEntry {
  id: string
  type: 'application' | 'offer' | 'performance' | 'onboarding' | 'mobility' | 'offboarding'
  text: string
  context: string | null
  tone: TalentTone
  at: string | null
}

export interface TalentDashboardData {
  kpis: TalentDashboardKpis
  pipeline: TalentPipeline
  performance_cycle: TalentPerformanceCycle
  onboarding_progress: TalentOnboardingProgress
  action_items: TalentActionItem[]
  activity: TalentActivityEntry[]
}

/** The {status, message, data} envelope every /api/talent/* endpoint returns. */
export interface TalentEnvelope<T> {
  status: 0 | 1
  message: string
  data: T
}

export interface TalentDashboardResponse extends TalentEnvelope<TalentDashboardData> {
  meta: { from: string; to: string }
}

export interface TalentDepartmentOption {
  id: LaravelId
  department: string
}

export interface TalentDashboardFilterData {
  departments: TalentDepartmentOption[]
  locations: string[]
  business_units: string[]
  /**
   * False in this schema - no business unit master exists, so the select is
   * disabled rather than populated from departments.
   */
  business_units_available: boolean
  business_units_reason?: string
}

export type TalentDashboardFiltersResponse = TalentEnvelope<TalentDashboardFilterData>

/** Query parameters the dashboard endpoint accepts, beyond the tenant context. */
export interface TalentDashboardQuery {
  department_id?: string
  location?: string
  from?: string
  to?: string
}
