/**
 * Performance & Rewards Center service.
 *
 * Backed by the Laravel /api/performance/* module (token + sub_institute_id via
 * withLaravelParams, JSON envelope {status, message, data}). This module was
 * built for this screen - nothing here reuses the phantom `/performance-reviews`
 * calls in services/talent/index.ts, which point at routes that do not exist.
 *
 *   Header
 *     GET  /performance/overview           - the 7 KPI cards
 *     GET  /performance/filters            - cycle / department / manager / enum options
 *     GET  /performance/team-comparison    - sidebar Team Comparison panel
 *     GET  /performance/timeline           - Cycle Timeline view
 *
 *   Cycles (Create / Launch)
 *     GET|POST /performance/cycles
 *     GET|PUT|DELETE /performance/cycles/{id}
 *     POST /performance/cycles/{id}/launch, /close
 *
 *   Reviews (main table, Review Board, sidebar)
 *     GET  /performance/reviews             - list + paging + sort + filters
 *     GET  /performance/reviews/board       - kanban columns
 *     POST /performance/reviews/bulk        - Start Action / More
 *     GET|PUT|DELETE /performance/reviews/{id}
 *     POST /performance/reviews/{id}/advance, /reminder
 *
 *   Tabs
 *     GET|POST /performance/goals, PUT|DELETE /performance/goals/{id}
 *     GET|POST /performance/appraisals, PUT /performance/appraisals/{id}[/decision], DELETE, POST /bulk
 *     GET|POST /performance/compensation, PUT .../{id}[/decision], DELETE, POST /bulk
 *     GET|POST /performance/bonus, PUT .../{id}[/decision], DELETE, POST /bulk
 *     GET|POST /performance/calibration-sessions, GET .../{id}/grid,
 *              PUT .../{id}/calibrate, POST .../{id}/lock, PUT|DELETE .../{id}
 *
 *   Activity / Comments / Notes / Attachments / Saved Views
 *     GET  /performance/activity[/filters]
 *     GET|POST /performance/reviews/{id}/notes, PUT|DELETE /performance/notes/{id}
 *     GET|POST /performance/reviews/{id}/attachments, DELETE /performance/attachments/{id}
 *     GET|POST /performance/saved-views, PUT|DELETE /performance/saved-views/{id}
 *
 * NOTE: `user_id` is the CONTEXT ACTOR on every call (withLaravelParams sends
 * the signed-in user). The subject employee travels as `user_id_target` on
 * writes and `user_id_filter` on reads - never as `user_id`.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

/* ------------------------------------------------------------------ *
 * Envelopes
 * ------------------------------------------------------------------ */

export interface PerfResponse<T> {
  status: number
  message: string
  data: T
}

export interface PerfPagination {
  page: number
  per_page: number
  total: number
  last_page: number
}

export interface PerfListResponse<T> extends PerfResponse<T> {
  pagination: PerfPagination
}

export interface PerfSummaryListResponse<T, S> extends PerfListResponse<T> {
  summary: S
}

/* ------------------------------------------------------------------ *
 * Shared vocabulary (mirrors the Laravel enums exactly)
 * ------------------------------------------------------------------ */

export type ReviewStage = 'self_review' | 'manager_review' | 'calibration' | 'final_review' | 'completed'
export type ReviewStatus = 'pending' | 'in_progress' | 'completed'
export type DecisionStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected'
export type BonusStatus = DecisionStatus | 'paid'
export type CycleStatus = 'draft' | 'active' | 'calibration' | 'closed'
export type CycleType = 'annual' | 'half_yearly' | 'quarterly' | 'probation' | 'project'
export type GoalCategory = 'kra' | 'kpi' | 'okr' | 'competency' | 'project'
export type GoalStatus = 'draft' | 'active' | 'achieved' | 'partially_achieved' | 'missed' | 'cancelled'
export type Recommendation = 'promote' | 'retain' | 'pip' | 'exit' | 'lateral_move'
export type RevisionType = 'merit' | 'promotion' | 'market_correction' | 'retention' | 'probation_confirmation'
export type BonusType = 'performance' | 'retention' | 'spot' | 'festival' | 'referral' | 'project'
export type CalibrationStatus = 'scheduled' | 'in_progress' | 'completed' | 'locked'
export type PerfTab = 'goals' | 'reviews' | 'appraisals' | 'compensation' | 'bonus' | 'calibration'

export interface PerfOption {
  value: string
  label: string
}

export interface CycleOption extends PerfOption {
  status: CycleStatus
  cycle_type: CycleType
  period_label: string | null
}

export interface EmployeeOption extends PerfOption {
  employee_no: string | null
  department_id: string | null
}

/* ------------------------------------------------------------------ *
 * Header
 * ------------------------------------------------------------------ */

/** Icon keys the KPI row maps to lucide components. */
export type PerfKpiIcon = 'calendar' | 'users' | 'user-clock' | 'user-check' | 'scale' | 'check-circle' | 'gift'

export interface PerfKpi {
  id: string
  title: string
  value: string
  subtitle: string
  icon: PerfKpiIcon
  /** Present only on the "Final Ratings Completed" card (the progress ring). */
  progress?: number
}

export interface PerfOverview {
  kpis: PerfKpi[]
  totals: {
    total_employees: number
    total_reviews: number
    comp_pending: number
    bonus_pending: number
  }
}

export interface PerfFilterOptions {
  cycles: CycleOption[]
  departments: PerfOption[]
  managers: PerfOption[]
  employees: EmployeeOption[]
  jobroles: PerfOption[]
  stages: PerfOption[]
  statuses: PerfOption[]
  decision_statuses: PerfOption[]
  goal_categories: PerfOption[]
  recommendations: PerfOption[]
  revision_types: PerfOption[]
  bonus_types: PerfOption[]
  cycle_types: PerfOption[]
}

export interface RatingBand {
  band: number
  label: string | null
  count: number
}

export interface TeamComparison {
  department_id: number
  department: string | null
  total_reviews: number
  rated_count: number
  average_rating: number | null
  average_label: string | null
  top_performer_pct: number
  low_performer_pct: number
  top_performers: number
  low_performers: number
  distribution: RatingBand[]
  calibration: {
    id: number
    name: string
    status: CalibrationStatus
    status_label: string | null
    scheduled_at: string | null
    scheduled_label: string | null
  } | null
}

export interface TimelineMilestone {
  key: ReviewStage
  label: string
  due_date: string | null
  due_label: string | null
  at_stage: number
  pct: number
  is_overdue: boolean
}

export interface TimelineCycle {
  id: number
  name: string
  code: string | null
  cycle_type: CycleType
  status: CycleStatus
  status_label: string | null
  period_start: string | null
  period_end: string | null
  period_label: string | null
  launched_at: string | null
  total_reviews: number
  milestones: TimelineMilestone[]
}

/* ------------------------------------------------------------------ *
 * Cycles
 * ------------------------------------------------------------------ */

export interface PerfCycle {
  id: number
  name: string
  code: string | null
  cycle_type: CycleType
  cycle_type_label: string
  description: string | null
  period_start: string | null
  period_end: string | null
  period_label: string | null
  self_review_due: string | null
  manager_review_due: string | null
  calibration_due: string | null
  final_review_due: string | null
  status: CycleStatus
  status_label: string | null
  rating_scale_max: number
  launched_at: string | null
  launched_label: string | null
  closed_at: string | null
  total_reviews: number
  completed_reviews: number
  completion_pct: number
}

export interface CyclePayload {
  name: string
  code?: string | null
  cycle_type?: CycleType
  description?: string | null
  period_start?: string | null
  period_end?: string | null
  self_review_due?: string | null
  manager_review_due?: string | null
  calibration_due?: string | null
  final_review_due?: string | null
  status?: CycleStatus
  rating_scale_max?: number
}

export interface LaunchPayload {
  user_ids?: number[]
  department_ids?: number[]
  due_date?: string | null
}

export interface LaunchResult {
  cycle: PerfCycle
  created_reviews: number
  skipped_existing: number
}

/* ------------------------------------------------------------------ *
 * Reviews
 * ------------------------------------------------------------------ */

export interface ReviewEmployee {
  id: number
  name: string
  employee_no: string | null
  initials: string
  image: string | null
  joined_date: string | null
  joined_label: string | null
  location: string | null
}

export interface PerfReview {
  id: number
  employee: ReviewEmployee
  department_id: number | null
  department: string | null
  jobrole: string | null
  manager_id: number | null
  manager: string | null
  manager_initials: string | null
  cycle_id: number
  cycle: string | null
  cycle_type: CycleType | null
  cycle_type_label: string | null
  stage: ReviewStage
  stage_label: string | null
  status: ReviewStatus
  status_label: string | null
  self_rating: number | null
  manager_rating: number | null
  calibrated_rating: number | null
  overall_rating: number | null
  overall_rating_label: string | null
  potential_rating: number | null
  potential_rating_label: string | null
  is_draft: boolean
  self_comments: string | null
  manager_comments: string | null
  due_date: string | null
  due_label: string | null
  is_overdue: boolean
  self_submitted_label: string | null
  manager_submitted_label: string | null
  calibrated_label: string | null
  finalized_label: string | null
  last_reminder_label: string | null
  updated_at: string | null
  updated_label: string | null
  updated_by_id: number | null
  updated_by: string | null
  updated_by_initials: string | null
}

export interface ReviewStep {
  step: number
  key: ReviewStage
  label: string
  status: 'completed' | 'current' | 'upcoming'
  due_date: string | null
  due_label: string | null
}

export interface ReviewHistoryItem {
  id: number
  cycle: string | null
  stage: ReviewStage
  stage_label: string | null
  status: ReviewStatus
  status_label: string | null
  overall_rating: number | null
  overall_rating_label: string | null
  due_label: string | null
  is_current: boolean
}

export interface PerfReviewDetail extends PerfReview {
  steps: ReviewStep[]
  counts: {
    goals: number
    compensation: number
    bonus: number
    documents: number
    comments: number
    notes: number
    reviews: number
  }
  review_history: ReviewHistoryItem[]
}

export interface BoardColumn {
  stage: ReviewStage
  stage_label: string | null
  column_total: number
  truncated: boolean
  cards: PerfReview[]
}

/** The shared filter bar + More Filters sheet, as the API reads them. */
export interface ReviewFilters {
  cycle_id?: string
  department_id?: string
  manager_id?: string
  status?: string
  stage?: string
  search?: string
  user_id_filter?: string
  jobrole?: string
  rating_min?: string
  rating_max?: string
  overdue_only?: string
  page?: number
  per_page?: number
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

export type BulkReviewAction = 'advance' | 'remind' | 'assign_manager' | 'set_due_date' | 'complete'

export interface ReviewUpdatePayload {
  self_rating?: number | null
  manager_rating?: number | null
  overall_rating?: number | null
  potential_rating?: number | null
  self_comments?: string | null
  manager_comments?: string | null
  due_date?: string | null
  manager_id?: number | null
  status?: ReviewStatus
  is_draft?: boolean
}

/* ------------------------------------------------------------------ *
 * Goals
 * ------------------------------------------------------------------ */

export interface PerfGoal {
  id: number
  title: string
  description: string | null
  category: GoalCategory
  category_label: string
  weightage: number | null
  metric: string | null
  target_value: string | null
  achieved_value: string | null
  unit: string | null
  progress: number
  status: GoalStatus
  status_label: string | null
  start_date: string | null
  start_label: string | null
  due_date: string | null
  due_label: string | null
  is_overdue: boolean
  self_rating: number | null
  manager_rating: number | null
  manager_comments: string | null
  user_id: number
  employee_name: string
  employee_initials: string
  employee_no: string | null
  department_id: number | null
  department: string | null
  cycle_id: number | null
  cycle: string | null
  review_id: number | null
}

export interface GoalSummary {
  total: number
  active: number
  achieved: number
  missed: number
  avg_progress: number
  total_weight: number
}

export interface GoalPayload {
  /** The goal owner. Sent as user_id_target - `user_id` is the actor. */
  user_id_target: number
  title: string
  description?: string | null
  category?: GoalCategory
  weightage?: number | null
  metric?: string | null
  target_value?: string | null
  achieved_value?: string | null
  unit?: string | null
  start_date?: string | null
  due_date?: string | null
  progress?: number
  status?: GoalStatus
  cycle_id?: number | null
  review_id?: number | null
}

export interface GoalUpdatePayload extends Partial<Omit<GoalPayload, 'user_id_target'>> {
  self_rating?: number | null
  manager_rating?: number | null
  manager_comments?: string | null
}

/* ------------------------------------------------------------------ *
 * Appraisals
 * ------------------------------------------------------------------ */

export interface PerfAppraisal {
  id: number
  user_id: number
  employee_name: string
  employee_initials: string
  employee_no: string | null
  department_id: number | null
  department: string | null
  jobrole: string | null
  cycle_id: number | null
  cycle: string | null
  review_id: number | null
  final_rating: number | null
  final_rating_label: string | null
  recommendation: Recommendation | null
  recommendation_label: string | null
  current_designation: string | null
  proposed_designation: string | null
  current_grade: string | null
  proposed_grade: string | null
  is_promotion: boolean
  effective_date: string | null
  effective_label: string | null
  status: DecisionStatus
  status_label: string | null
  approver_id: number | null
  approver: string | null
  approved_label: string | null
  remarks: string | null
  created_at: string | null
}

export interface AppraisalSummary {
  total: number
  draft: number
  pending_approval: number
  approved: number
  rejected: number
  promotions: number
}

export interface AppraisalPayload {
  user_id_target: number
  review_id?: number | null
  cycle_id?: number | null
  final_rating?: number | null
  recommendation?: Recommendation | null
  current_designation?: string | null
  proposed_designation?: string | null
  current_grade?: string | null
  proposed_grade?: string | null
  effective_date?: string | null
  status?: DecisionStatus
  remarks?: string | null
}

export type DecisionAction = 'submit' | 'approve' | 'reject'
export type BonusDecisionAction = DecisionAction | 'mark_paid'

/* ------------------------------------------------------------------ *
 * Compensation
 * ------------------------------------------------------------------ */

export interface PerfCompensation {
  id: number
  user_id: number
  employee_name: string
  employee_initials: string
  employee_no: string | null
  department_id: number | null
  department: string | null
  cycle_id: number | null
  cycle: string | null
  review_id: number | null
  appraisal_id: number | null
  currency: string
  current_ctc: number | null
  proposed_ctc: number | null
  increment_amount: number | null
  increment_pct: number | null
  revision_type: RevisionType
  revision_type_label: string
  effective_date: string | null
  effective_label: string | null
  status: DecisionStatus
  status_label: string | null
  approver_id: number | null
  approver: string | null
  approved_label: string | null
  remarks: string | null
  created_at: string | null
}

export interface CompensationSummary {
  total: number
  draft: number
  pending_approval: number
  approved: number
  rejected: number
  total_increment: number
  avg_increment_pct: number
}

export interface CompensationPayload {
  user_id_target: number
  review_id?: number | null
  appraisal_id?: number | null
  cycle_id?: number | null
  currency?: string
  current_ctc?: number | null
  /** Send proposed_ctc OR increment_pct/increment_amount - the API derives the rest. */
  proposed_ctc?: number | null
  increment_amount?: number | null
  increment_pct?: number | null
  revision_type?: RevisionType
  effective_date?: string | null
  status?: DecisionStatus
  remarks?: string | null
}

/* ------------------------------------------------------------------ *
 * Bonus
 * ------------------------------------------------------------------ */

export interface PerfBonus {
  id: number
  user_id: number
  employee_name: string
  employee_initials: string
  employee_no: string | null
  department_id: number | null
  department: string | null
  cycle_id: number | null
  cycle: string | null
  review_id: number | null
  appraisal_id: number | null
  bonus_type: BonusType
  bonus_type_label: string
  currency: string
  amount: number | null
  pct_of_ctc: number | null
  payout_month: string | null
  payout_label: string | null
  payout_date: string | null
  payout_date_label: string | null
  status: BonusStatus
  status_label: string | null
  approver_id: number | null
  approver: string | null
  approved_label: string | null
  remarks: string | null
  created_at: string | null
}

export interface BonusSummary {
  total: number
  draft: number
  pending_approval: number
  approved: number
  rejected: number
  paid: number
  total_amount: number
}

export interface BonusPayload {
  user_id_target: number
  review_id?: number | null
  appraisal_id?: number | null
  cycle_id?: number | null
  bonus_type?: BonusType
  currency?: string
  amount?: number | null
  pct_of_ctc?: number | null
  payout_month?: string | null
  payout_date?: string | null
  status?: BonusStatus
  remarks?: string | null
}

/* ------------------------------------------------------------------ *
 * Calibration
 * ------------------------------------------------------------------ */

export interface PerfCalibrationSession {
  id: number
  name: string
  cycle_id: number
  cycle: string | null
  department_id: number | null
  department: string | null
  facilitator_id: number | null
  facilitator: string | null
  facilitator_initials: string | null
  scheduled_at: string | null
  scheduled_label: string | null
  status: CalibrationStatus
  status_label: string | null
  participant_count: number
  calibrated_count: number
  calibrated_pct: number
  average_rating: number | null
  distribution_target: Record<string, number> | null
  notes: string | null
  locked_at: string | null
  locked_label: string | null
  is_locked: boolean
}

export interface CalibrationSummary {
  total: number
  scheduled: number
  in_progress: number
  completed: number
  locked: number
}

export interface CalibrationParticipant {
  review_id: number
  user_id: number
  employee_name: string
  employee_initials: string
  employee_no: string | null
  department: string | null
  jobrole: string | null
  manager: string | null
  stage: ReviewStage
  stage_label: string | null
  self_rating: number | null
  manager_rating: number | null
  proposed_rating: number | null
  proposed_label: string | null
  calibrated_rating: number | null
  calibrated_label: string | null
  overall_rating: number | null
  overall_rating_label: string | null
  potential_rating: number | null
  delta: number | null
}

export interface CalibrationDistribution extends RatingBand {
  actual_pct: number
  target_pct: number | null
  variance: number | null
}

export interface CalibrationGrid {
  session: PerfCalibrationSession
  participants: CalibrationParticipant[]
  distribution: CalibrationDistribution[]
  rated_count: number
  total_count: number
}

export interface CalibrationSessionPayload {
  name: string
  cycle_id: number
  department_id?: number | null
  facilitator_id?: number | null
  scheduled_at?: string | null
  status?: CalibrationStatus
  distribution_target?: Record<string, number> | null
  notes?: string | null
  attach_reviews?: boolean
}

/* ------------------------------------------------------------------ *
 * Activity / notes / attachments / saved views
 * ------------------------------------------------------------------ */

export interface ActivityChange {
  field: string
  label: string
  old: unknown
  new: unknown
}

export type ActivityEntryType = 'status_change' | 'reminder' | 'approval' | 'comment' | 'system'

export interface PerfActivityEntry {
  id: number
  actor_id: number | null
  actor_name: string
  actor_initials: string
  action: string
  action_label: string
  description: string | null
  subject_type: string | null
  module: string
  subject_id: number | null
  subject_name: string | null
  review_id: number | null
  cycle_id: number | null
  changes: ActivityChange[] | null
  has_changes: boolean
  created_at: string | null
  created_label: string | null
  entry_type: ActivityEntryType
}

export interface PerfNote {
  id: number
  review_id: number
  note_type: 'comment' | 'note'
  visibility: 'all' | 'manager' | 'hr' | 'private'
  body: string
  author_id: number | null
  author_name: string
  author_initials: string
  created_at: string | null
  created_label: string | null
  updated_label: string | null
}

export interface PerfAttachment {
  id: number
  review_id: number
  title: string | null
  file_name: string
  file_path: string | null
  url: string | null
  mime_type: string | null
  file_size: number | null
  file_size_label: string | null
  document_type: string
  document_type_label: string
  uploaded_by: string | null
  uploaded_by_initials: string | null
  created_at: string | null
  created_label: string | null
}

export interface PerfSavedView {
  id: number
  name: string
  tab: PerfTab
  filters: Record<string, string>
  is_shared: boolean
  is_default: boolean
  user_id: number
  owner: string | null
  is_mine: boolean
  created_at: string | null
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/**
 * Query params must be strings. Drops null / undefined / '' so an unset filter
 * is absent rather than sent as the literal "undefined" (which the API would
 * treat as an active filter).
 *
 * Takes `object` rather than an indexed record so the typed filter interfaces
 * can be passed directly, with no cast at each call site.
 */
function toParams(input: object): Record<string, string> {
  const params: Record<string, string> = {}

  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === undefined || value === '') continue
    params[key] = typeof value === 'string' ? value : String(value)
  }

  return params
}

/** Same trimming for JSON bodies, but `null` is kept - it clears a column. */
function toBody(input: object): Record<string, unknown> {
  const body: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue
    body[key] = value
  }

  return body
}

/* ------------------------------------------------------------------ *
 * Service
 * ------------------------------------------------------------------ */

export const performanceService = {
  /* -- Header -- */

  getOverview: (context: LaravelContext, cycleId?: string) =>
    apiClient.get<PerfResponse<PerfOverview>>(
      '/performance/overview',
      withLaravelParams(context, toParams({ cycle_id: cycleId })),
    ),

  getFilters: (context: LaravelContext) =>
    apiClient.get<PerfResponse<PerfFilterOptions>>('/performance/filters', withLaravelParams(context)),

  getTeamComparison: (context: LaravelContext, departmentId: string, cycleId?: string) =>
    apiClient.get<PerfResponse<TeamComparison>>(
      '/performance/team-comparison',
      withLaravelParams(context, toParams({ department_id: departmentId, cycle_id: cycleId })),
    ),

  getTimeline: (context: LaravelContext, cycleId?: string) =>
    apiClient.get<PerfResponse<TimelineCycle[]>>(
      '/performance/timeline',
      withLaravelParams(context, toParams({ cycle_id: cycleId })),
    ),

  /* -- Cycles -- */

  getCycles: (context: LaravelContext, status?: string) =>
    apiClient.get<PerfResponse<PerfCycle[]>>(
      '/performance/cycles',
      withLaravelParams(context, toParams({ status })),
    ),

  getCycle: (context: LaravelContext, id: number) =>
    apiClient.get<PerfResponse<PerfCycle>>(`/performance/cycles/${id}`, withLaravelParams(context)),

  createCycle: (context: LaravelContext, payload: CyclePayload) =>
    apiClient.post<PerfResponse<PerfCycle>>('/performance/cycles', {
      ...withLaravelParams(context),
      ...toBody(payload),
    }),

  updateCycle: (context: LaravelContext, id: number, payload: Partial<CyclePayload>) =>
    apiClient.put<PerfResponse<PerfCycle>>(`/performance/cycles/${id}`, {
      ...withLaravelParams(context),
      ...toBody(payload),
    }),

  launchCycle: (context: LaravelContext, id: number, payload: LaunchPayload = {}) =>
    apiClient.post<PerfResponse<LaunchResult>>(`/performance/cycles/${id}/launch`, {
      ...withLaravelParams(context),
      ...toBody(payload),
    }),

  closeCycle: (context: LaravelContext, id: number, force = false) =>
    apiClient.post<PerfResponse<PerfCycle>>(`/performance/cycles/${id}/close`, {
      ...withLaravelParams(context),
      ...(force ? { force: 1 } : {}),
    }),

  deleteCycle: (context: LaravelContext, id: number) =>
    apiClient.delete<PerfResponse<{ id: number }>>(`/performance/cycles/${id}`, withLaravelParams(context)),

  /* -- Reviews -- */

  getReviews: (context: LaravelContext, filters: ReviewFilters = {}) =>
    apiClient.get<PerfListResponse<PerfReview[]>>(
      '/performance/reviews',
      withLaravelParams(context, toParams(filters)),
    ),

  getBoard: (context: LaravelContext, filters: ReviewFilters = {}, columnLimit = 50) =>
    apiClient.get<PerfResponse<BoardColumn[]>>(
      '/performance/reviews/board',
      withLaravelParams(context, toParams({ ...filters, column_limit: columnLimit })),
    ),

  getReview: (context: LaravelContext, id: number) =>
    apiClient.get<PerfResponse<PerfReviewDetail>>(`/performance/reviews/${id}`, withLaravelParams(context)),

  updateReview: (context: LaravelContext, id: number, payload: ReviewUpdatePayload) =>
    apiClient.put<PerfResponse<PerfReview>>(`/performance/reviews/${id}`, {
      ...withLaravelParams(context),
      ...toBody(payload),
    }),

  advanceReview: (context: LaravelContext, id: number, options: { stage?: ReviewStage; rating?: number } = {}) =>
    apiClient.post<PerfResponse<PerfReview>>(`/performance/reviews/${id}/advance`, {
      ...withLaravelParams(context),
      ...toBody(options),
    }),

  sendReminder: (context: LaravelContext, id: number) =>
    apiClient.post<PerfResponse<{ id: number; last_reminder_label: string | null }>>(
      `/performance/reviews/${id}/reminder`,
      withLaravelParams(context),
    ),

  bulkReviews: (
    context: LaravelContext,
    ids: number[],
    action: BulkReviewAction,
    options: { stage?: ReviewStage; manager_id?: number; due_date?: string } = {},
  ) =>
    apiClient.post<PerfResponse<{ affected: number; skipped: number[] }>>('/performance/reviews/bulk', {
      ...withLaravelParams(context),
      ids,
      action,
      ...toBody(options),
    }),

  deleteReview: (context: LaravelContext, id: number) =>
    apiClient.delete<PerfResponse<{ id: number }>>(`/performance/reviews/${id}`, withLaravelParams(context)),

  /* -- Goals -- */

  getGoals: (context: LaravelContext, filters: ReviewFilters & { category?: string; goal_status?: string; review_id?: number } = {}) =>
    apiClient.get<PerfSummaryListResponse<PerfGoal[], GoalSummary>>(
      '/performance/goals',
      withLaravelParams(context, toParams(filters)),
    ),

  createGoal: (context: LaravelContext, payload: GoalPayload) =>
    apiClient.post<PerfResponse<PerfGoal>>('/performance/goals', {
      ...withLaravelParams(context),
      ...toBody(payload),
    }),

  updateGoal: (context: LaravelContext, id: number, payload: GoalUpdatePayload) =>
    apiClient.put<PerfResponse<PerfGoal>>(`/performance/goals/${id}`, {
      ...withLaravelParams(context),
      ...toBody(payload),
    }),

  deleteGoal: (context: LaravelContext, id: number) =>
    apiClient.delete<PerfResponse<{ id: number }>>(`/performance/goals/${id}`, withLaravelParams(context)),

  /* -- Appraisals -- */

  getAppraisals: (context: LaravelContext, filters: ReviewFilters & { recommendation?: string } = {}) =>
    apiClient.get<PerfSummaryListResponse<PerfAppraisal[], AppraisalSummary>>(
      '/performance/appraisals',
      withLaravelParams(context, toParams(filters)),
    ),

  createAppraisal: (context: LaravelContext, payload: AppraisalPayload) =>
    apiClient.post<PerfResponse<PerfAppraisal>>('/performance/appraisals', {
      ...withLaravelParams(context),
      ...toBody(payload),
    }),

  updateAppraisal: (context: LaravelContext, id: number, payload: Partial<Omit<AppraisalPayload, 'user_id_target'>>) =>
    apiClient.put<PerfResponse<PerfAppraisal>>(`/performance/appraisals/${id}`, {
      ...withLaravelParams(context),
      ...toBody(payload),
    }),

  decideAppraisal: (context: LaravelContext, id: number, action: DecisionAction, remarks?: string) =>
    apiClient.put<PerfResponse<PerfAppraisal>>(`/performance/appraisals/${id}/decision`, {
      ...withLaravelParams(context),
      action,
      ...toBody({ remarks }),
    }),

  bulkAppraisals: (context: LaravelContext, ids: number[], action: DecisionAction) =>
    apiClient.post<PerfResponse<{ affected: number }>>('/performance/appraisals/bulk', {
      ...withLaravelParams(context),
      ids,
      action,
    }),

  deleteAppraisal: (context: LaravelContext, id: number) =>
    apiClient.delete<PerfResponse<{ id: number }>>(`/performance/appraisals/${id}`, withLaravelParams(context)),

  /* -- Compensation -- */

  getCompensation: (context: LaravelContext, filters: ReviewFilters & { revision_type?: string } = {}) =>
    apiClient.get<PerfSummaryListResponse<PerfCompensation[], CompensationSummary>>(
      '/performance/compensation',
      withLaravelParams(context, toParams(filters)),
    ),

  createCompensation: (context: LaravelContext, payload: CompensationPayload) =>
    apiClient.post<PerfResponse<PerfCompensation>>('/performance/compensation', {
      ...withLaravelParams(context),
      ...toBody(payload),
    }),

  updateCompensation: (
    context: LaravelContext,
    id: number,
    payload: Partial<Omit<CompensationPayload, 'user_id_target'>>,
  ) =>
    apiClient.put<PerfResponse<PerfCompensation>>(`/performance/compensation/${id}`, {
      ...withLaravelParams(context),
      ...toBody(payload),
    }),

  decideCompensation: (context: LaravelContext, id: number, action: DecisionAction, remarks?: string) =>
    apiClient.put<PerfResponse<PerfCompensation>>(`/performance/compensation/${id}/decision`, {
      ...withLaravelParams(context),
      action,
      ...toBody({ remarks }),
    }),

  bulkCompensation: (context: LaravelContext, ids: number[], action: DecisionAction) =>
    apiClient.post<PerfResponse<{ affected: number }>>('/performance/compensation/bulk', {
      ...withLaravelParams(context),
      ids,
      action,
    }),

  deleteCompensation: (context: LaravelContext, id: number) =>
    apiClient.delete<PerfResponse<{ id: number }>>(`/performance/compensation/${id}`, withLaravelParams(context)),

  /* -- Bonus -- */

  getBonus: (context: LaravelContext, filters: ReviewFilters & { bonus_type?: string; payout_month?: string } = {}) =>
    apiClient.get<PerfSummaryListResponse<PerfBonus[], BonusSummary> & { payout_months: PerfOption[] }>(
      '/performance/bonus',
      withLaravelParams(context, toParams(filters)),
    ),

  createBonus: (context: LaravelContext, payload: BonusPayload) =>
    apiClient.post<PerfResponse<PerfBonus>>('/performance/bonus', {
      ...withLaravelParams(context),
      ...toBody(payload),
    }),

  updateBonus: (context: LaravelContext, id: number, payload: Partial<Omit<BonusPayload, 'user_id_target'>>) =>
    apiClient.put<PerfResponse<PerfBonus>>(`/performance/bonus/${id}`, {
      ...withLaravelParams(context),
      ...toBody(payload),
    }),

  decideBonus: (context: LaravelContext, id: number, action: BonusDecisionAction, remarks?: string) =>
    apiClient.put<PerfResponse<PerfBonus>>(`/performance/bonus/${id}/decision`, {
      ...withLaravelParams(context),
      action,
      ...toBody({ remarks }),
    }),

  bulkBonus: (context: LaravelContext, ids: number[], action: BonusDecisionAction) =>
    apiClient.post<PerfResponse<{ affected: number }>>('/performance/bonus/bulk', {
      ...withLaravelParams(context),
      ids,
      action,
    }),

  deleteBonus: (context: LaravelContext, id: number) =>
    apiClient.delete<PerfResponse<{ id: number }>>(`/performance/bonus/${id}`, withLaravelParams(context)),

  /* -- Calibration -- */

  getCalibrationSessions: (context: LaravelContext, filters: ReviewFilters = {}) =>
    apiClient.get<PerfSummaryListResponse<PerfCalibrationSession[], CalibrationSummary>>(
      '/performance/calibration-sessions',
      withLaravelParams(context, toParams(filters)),
    ),

  getCalibrationGrid: (context: LaravelContext, id: number) =>
    apiClient.get<PerfResponse<CalibrationGrid>>(
      `/performance/calibration-sessions/${id}/grid`,
      withLaravelParams(context),
    ),

  createCalibrationSession: (context: LaravelContext, payload: CalibrationSessionPayload) =>
    apiClient.post<PerfResponse<PerfCalibrationSession>>('/performance/calibration-sessions', {
      ...withLaravelParams(context),
      ...toBody(payload),
    }),

  updateCalibrationSession: (
    context: LaravelContext,
    id: number,
    payload: Partial<Omit<CalibrationSessionPayload, 'cycle_id' | 'attach_reviews'>>,
  ) =>
    apiClient.put<PerfResponse<PerfCalibrationSession>>(`/performance/calibration-sessions/${id}`, {
      ...withLaravelParams(context),
      ...toBody(payload),
    }),

  calibrateRatings: (
    context: LaravelContext,
    id: number,
    payload:
      | { review_id: number; rating: number; potential_rating?: number }
      | { ratings: Array<{ review_id: number; rating: number }> },
  ) =>
    apiClient.put<PerfResponse<{ updated: number; skipped: number[] }>>(
      `/performance/calibration-sessions/${id}/calibrate`,
      { ...withLaravelParams(context), ...toBody(payload) },
    ),

  lockCalibrationSession: (context: LaravelContext, id: number, options: { force?: boolean; advance?: boolean } = {}) =>
    apiClient.post<PerfResponse<{ session: PerfCalibrationSession; advanced_reviews: number }>>(
      `/performance/calibration-sessions/${id}/lock`,
      {
        ...withLaravelParams(context),
        ...(options.force ? { force: 1 } : {}),
        ...(options.advance === false ? { advance: 0 } : {}),
      },
    ),

  deleteCalibrationSession: (context: LaravelContext, id: number) =>
    apiClient.delete<PerfResponse<{ id: number }>>(
      `/performance/calibration-sessions/${id}`,
      withLaravelParams(context),
    ),

  /* -- Activity -- */

  getActivity: (
    context: LaravelContext,
    filters: {
      tab?: 'feed' | 'audit'
      review_id?: number
      cycle_id?: string
      subject_type?: string
      actor_id?: string
      search?: string
      date_from?: string
      date_to?: string
      page?: number
      per_page?: number
    } = {},
  ) =>
    apiClient.get<PerfListResponse<PerfActivityEntry[]>>(
      '/performance/activity',
      withLaravelParams(context, toParams(filters)),
    ),

  getActivityFilters: (context: LaravelContext) =>
    apiClient.get<PerfResponse<{ actors: PerfOption[]; modules: PerfOption[] }>>(
      '/performance/activity/filters',
      withLaravelParams(context),
    ),

  /* -- Notes and comments -- */

  getNotes: (context: LaravelContext, reviewId: number, noteType?: 'comment' | 'note') =>
    apiClient.get<PerfResponse<PerfNote[]> & { counts: { comment: number; note: number } }>(
      `/performance/reviews/${reviewId}/notes`,
      withLaravelParams(context, toParams({ note_type: noteType })),
    ),

  createNote: (
    context: LaravelContext,
    reviewId: number,
    payload: { body: string; note_type?: 'comment' | 'note'; visibility?: PerfNote['visibility'] },
  ) =>
    apiClient.post<PerfResponse<PerfNote>>(`/performance/reviews/${reviewId}/notes`, {
      ...withLaravelParams(context),
      ...toBody(payload),
    }),

  updateNote: (context: LaravelContext, id: number, payload: { body?: string; visibility?: PerfNote['visibility'] }) =>
    apiClient.put<PerfResponse<PerfNote>>(`/performance/notes/${id}`, {
      ...withLaravelParams(context),
      ...toBody(payload),
    }),

  deleteNote: (context: LaravelContext, id: number) =>
    apiClient.delete<PerfResponse<{ id: number }>>(`/performance/notes/${id}`, withLaravelParams(context)),

  /* -- Attachments -- */

  getAttachments: (context: LaravelContext, reviewId: number) =>
    apiClient.get<PerfResponse<PerfAttachment[]> & { counts: { attachments: number } }>(
      `/performance/reviews/${reviewId}/attachments`,
      withLaravelParams(context),
    ),

  /**
   * Real upload. The auth params ride as query params because the body must stay
   * a multipart FormData for Laravel to see the file.
   */
  uploadAttachment: (
    context: LaravelContext,
    reviewId: number,
    file: File,
    meta: { title?: string; document_type?: string } = {},
  ) => {
    const form = new FormData()
    form.append('file', file)
    if (meta.title) form.append('title', meta.title)
    if (meta.document_type) form.append('document_type', meta.document_type)

    const query = new URLSearchParams(withLaravelParams(context)).toString()

    return apiClient.postForm<PerfResponse<PerfAttachment>>(
      `/performance/reviews/${reviewId}/attachments?${query}`,
      form,
    )
  },

  deleteAttachment: (context: LaravelContext, id: number) =>
    apiClient.delete<PerfResponse<{ id: number }>>(`/performance/attachments/${id}`, withLaravelParams(context)),

  /* -- Saved views -- */

  getSavedViews: (context: LaravelContext, tab?: PerfTab) =>
    apiClient.get<PerfResponse<PerfSavedView[]>>(
      '/performance/saved-views',
      withLaravelParams(context, toParams({ tab })),
    ),

  createSavedView: (
    context: LaravelContext,
    payload: { name: string; tab?: PerfTab; filters?: Record<string, string>; is_shared?: boolean; is_default?: boolean },
  ) =>
    apiClient.post<PerfResponse<PerfSavedView>>('/performance/saved-views', {
      ...withLaravelParams(context),
      ...toBody(payload),
    }),

  updateSavedView: (
    context: LaravelContext,
    id: number,
    payload: { name?: string; filters?: Record<string, string>; is_shared?: boolean; is_default?: boolean },
  ) =>
    apiClient.put<PerfResponse<PerfSavedView>>(`/performance/saved-views/${id}`, {
      ...withLaravelParams(context),
      ...toBody(payload),
    }),

  deleteSavedView: (context: LaravelContext, id: number) =>
    apiClient.delete<PerfResponse<{ id: number }>>(`/performance/saved-views/${id}`, withLaravelParams(context)),
}
