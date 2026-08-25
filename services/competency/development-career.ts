/**
 * Development & Career Path Workspace service.
 *
 * Backed by the additive Laravel development-plan / career-path / learning
 * endpoints (token + sub_institute_id via withLaravelParams, JSON envelope
 * {status,message,data}):
 *
 *   Development plans
 *     GET    /competency/development-plans                       - list (+ filters/sort/paging)
 *     GET    /competency/development-plans/metrics               - the 5 KPI cards
 *     GET    /competency/development-plans/owners                - "Plan Owner: All" options
 *     GET    /competency/employee-options                        - employee picker
 *     POST   /competency/development-plans                       - create (existing route)
 *     GET/PUT/DELETE /competency/development-plans/{id}          - detail / edit / delete
 *     GET    /competency/development-plans/{id}/gaps             - Competency Gaps tab
 *     GET    /competency/development-plans/{id}/history          - Notes & History tab
 *     GET/POST /competency/development-plans/{id}/actions        - Actions tab
 *     PUT/DELETE /competency/development-plans/{id}/actions/{aid}
 *
 *   Career paths
 *     GET/POST /competency/career-paths                          - list / create
 *     GET/PUT/DELETE /competency/career-paths/{id}
 *     GET    /competency/career-paths/explorer                   - Career Path Explorer
 *     GET    /competency/career-paths/role-options               - step picker
 *
 *   Learning assignments (lms_assignments rows tagged source='competency')
 *     GET/POST /competency/learning-assignments
 *     PUT/DELETE /competency/learning-assignments/{id}
 *     GET    /competency/learning-assignments/courses            - course picker
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

export interface DevCareerApiResponse<T> {
  status: number
  message: string
  data: T
}

export interface DevCareerPagination {
  page: number
  per_page: number
  total: number
  last_page: number
}

export interface DevCareerListResponse<T> extends DevCareerApiResponse<T> {
  pagination: DevCareerPagination
}

/* ------------------------------------------------------------------ *
 * Development plans
 * ------------------------------------------------------------------ */

/** s_competency_development_plans.status - the raw values the API filters on. */
export type PlanStatus = 'active' | 'completed' | 'overdue' | 'on_hold'

export interface DevelopmentPlan {
  id: number
  title: string
  user_id: number | null
  employee_name: string | null
  employee_initials: string | null
  employee_no: string | null
  jobrole: string | null
  department_id: number | null
  department: string | null
  status: string
  /** Display label derived server-side: active -> "In Progress", etc. */
  status_label: string
  progress: number
  start_date: string | null
  due_date: string | null
  start_date_label: string | null
  due_date_label: string | null
  approver_id: number | null
  owner_name: string | null
  owner_initials: string | null
  approval_status: string | null
  competency_id: number | null
  framework_id: number | null
  career_path_id: number | null
  completed_at: string | null
}

export interface PlanMilestone {
  id: number
  title: string
  status: string
  due_date: string | null
}

export interface DevelopmentPlanDetail extends DevelopmentPlan {
  objective: string | null
  focus_areas: string[]
  career_path: { id: number; name: string; status: string } | null
  next_milestone: PlanMilestone | null
  action_counts: { total: number; completed: number }
}

export type PlanSortField = 'title' | 'status' | 'progress' | 'due_date' | 'created_at'

export interface DevelopmentPlanListParams {
  search?: string
  status?: string
  department_id?: string
  approver_id?: string
  jobrole?: string
  career_path_id?: string
  /** Drill-through from a competency's detail panel. */
  competency_id?: string
  /** Command Center drilldown: only plans awaiting approval. */
  pending_approval?: string
  sort?: PlanSortField
  direction?: 'asc' | 'desc'
  page?: number
  per_page?: number
}

export interface DevelopmentPlanPayload {
  title: string
  objective?: string
  focus_areas?: string[]
  /** The employee the plan is FOR. Distinct from the context user_id (the actor). */
  user_id_target?: number | string
  jobrole?: string
  department_id?: number | string
  approver_id?: number | string
  career_path_id?: number | string
  competency_id?: number | string
  framework_id?: number | string
  status?: PlanStatus
  progress?: number
  start_date?: string
  due_date?: string
}

export interface PlanMetrics {
  active_plans: number
  active_plans_delta: number
  in_progress: number
  in_progress_percent: number
  completed: number
  completed_delta: number
  career_paths: number
  career_paths_delta: number
  learning_assigned: number
  learning_delta: number
  total_plans: number
  overdue: number
  on_hold: number
  pending_approval: number
}

export interface FilterOption {
  value: string
  label: string
}

export interface EmployeeOption {
  id: number
  name: string
  initials: string
  employee_no: string | null
  jobrole: string | null
  jobrole_id: number | null
  department_id: number | null
}

/* -- Plan detail tabs -- */

/**
 * TWO ARMS, AND THEY ARE NOT THE SAME QUESTION.
 *
 * This tab used to render ONE list under a heading that said "Competency",
 * built from the SKILL library, in which an unrated item was scored 0 and
 * therefore shown as a shortfall. Measured on live: **3,274 of the 3,643 rows
 * it presented as shortfalls (89.9%) were items nobody had ever assessed**, and
 * 55 of 164 plans displayed a person failing everything.
 *
 *   competency_gaps - the ASSESSMENT arm, from the one server-side gap engine
 *   skill_gaps      - the GUIDANCE arm, kept because it is what 161 of 164
 *                     plans actually have
 *
 * NO ARITHMETIC IN THE CLIENT. Every level and every state is decided by the
 * server; this module shapes types.
 */

/** Measured verdicts vs the states that are NOT findings about the person. */
export type GapItemState = 'met' | 'gap' | 'not_assessed' | 'unmeasured' | 'no_target'

interface PlanGapItemBase {
  name: string
  required: number | null
  /** NULL means NOT ASSESSED — never render this as 0. */
  current: number | null
  /** Only present where something was measured AND a target exists. */
  gap: number | null
  state: GapItemState
  is_focus: boolean
}

/** The assessment arm. `competency_id` is a real competency id. */
export interface CompetencyGapItem extends PlanGapItemBase {
  competency_id: number
  code: string | null
  is_mandatory: boolean
  /** 0–1. How much of the competency's weight the level speaks for. */
  coverage: number
}

/**
 * The guidance arm. Carries `skill_id`, NOT `competency_id` — the old shape
 * named this field for one id-space and filled it from another, and those ids
 * were then saved onto plan actions. 61 rows on live held a skill id in a
 * competency column because of it.
 */
export interface SkillGapItem extends PlanGapItemBase {
  skill_id: number | null
  category: string | null
  /** The stored text, shown where it is not a number (live holds "Advanced"). */
  required_raw: string
  last_assessed: string | null
}

export interface GapSummary {
  total: number
  met: number
  gaps: number
  /** Its own number. Neither a pass nor a shortfall. */
  not_assessed: number
  /** Requirements whose level is not a number on the scale. */
  no_target: number
  measured: number
  /** Share of what was MEASURED, so unassessed items cannot inflate it. */
  met_percent: number
}

export interface MandatoryItemBelow {
  competency_id: number
  competency_name: string
  kasba_item_id: number
  kasba_type: string
  item_label: string | null
  rating: number
  required: number
}

export interface PlanGaps {
  jobrole: string | null
  jobrole_id: number | null
  competency_gaps: {
    items: CompetencyGapItem[]
    summary: GapSummary
    mandatory_below_required: MandatoryItemBelow[]
    /** Distinguishes "no requirements set" from "everything met". */
    has_requirements: boolean
    /** False when the plan's role name matches several roles, or none. */
    jobrole_resolved: boolean
  }
  skill_gaps: {
    items: SkillGapItem[]
    summary: GapSummary
  }
  /** @deprecated Legacy mirror of `skill_gaps`. Use the named arms. */
  items: SkillGapItem[]
  /** @deprecated Legacy mirror of `skill_gaps.summary`. */
  summary: GapSummary
}

export type PlanActionType = 'milestone' | 'training' | 'mentoring' | 'project' | 'reading' | 'other'
export type PlanActionStatus = 'pending' | 'in_progress' | 'completed' | 'blocked'

export interface PlanAction {
  id: number
  title: string
  description: string | null
  action_type: string
  status: string
  competency_id: number | null
  competency_name: string | null
  owner_id: number | null
  owner_name: string | null
  due_date: string | null
  due_date_label: string | null
  completed_at: string | null
  sequence: number
}

export interface PlanActionPayload {
  title: string
  description?: string
  action_type?: PlanActionType
  status?: PlanActionStatus
  competency_id?: number
  owner_id?: number
  due_date?: string
  sequence?: number
}

export interface PlanHistoryEntry {
  id: number
  action: string
  description: string | null
  by: string
  date: string | null
}

/* ------------------------------------------------------------------ *
 * Career paths
 * ------------------------------------------------------------------ */

export interface CareerPathSummary {
  id: number
  name: string
  description: string | null
  department_id: number | null
  department: string | null
  job_family: string | null
  status: string
  step_count: number
  roles: string[]
  linked_plans: number
  created_at: string | null
}

export interface CareerPathStep {
  id?: number
  jobrole: string
  jobrole_id: number | null
  job_level: string | null
  step_order: number
  step_type: string
  description: string | null
}

export interface CareerPathDetail {
  id: number
  name: string
  description: string | null
  department_id: number | null
  department: string | null
  job_family: string | null
  status: string
  steps: CareerPathStep[]
}

export interface CareerPathPayload {
  name: string
  description?: string
  department_id?: number | string
  department?: string
  job_family?: string
  status?: 'draft' | 'active' | 'archived'
  steps?: Array<{ jobrole: string; jobrole_id?: number | null; job_level?: string | null; step_type?: string }>
}

/**
 * Readiness for a target role, on ONE arm.
 *
 * `percent` is the share of what was MEASURED, and `coverage` says how much of
 * the requirement that speaks for. The two travel together because the percent
 * alone is misleading: on live, one employee read "3% ready" under the old
 * formula because 16 of 17 requirements were unassessed and counted as zeros —
 * they had in fact met the only one anybody had looked at.
 */
export interface RoleMatch {
  /** NULL means nothing was measured — "unknown", not "none of it". */
  percent: number | null
  /** 0–1. Share of the requirement that has actually been assessed. */
  coverage: number
  measured: number
  required: number
}

export interface ExplorerNode extends CareerPathStep {
  is_current: boolean
  /** The ASSESSMENT arm — competencies, via the one gap engine. NULL if none set. */
  competency_match: RoleMatch | null
  /** The GUIDANCE arm — skills. NULL if the role has no skill requirements. */
  skill_match: RoleMatch | null
  /**
   * The skill percent, kept for callers that read a single number.
   * NULL where nothing was measured — it used to be a confident 0.
   */
  match_percent: number | null
  required_skills: number
}

export interface ExplorerLateralRole {
  jobrole: string
  jobrole_id: number
  job_level: string | null
  skill_match: RoleMatch | null
  match_percent: number | null
}

export interface CareerExplorer {
  career_path_id: number | null
  name: string
  current_role: string | null
  employee_id: number | null
  /** career_path | career_journey | related | department | none */
  source: string
  nodes: ExplorerNode[]
  lateral_roles: ExplorerLateralRole[]
}

export interface RoleOption {
  id: number
  jobrole: string
  job_level: string | null
  department: string | null
  department_id: number | null
}

/* ------------------------------------------------------------------ *
 * Learning assignments
 * ------------------------------------------------------------------ */

export type LearningStatus = 'Not Started' | 'In Progress' | 'Completed' | 'Overdue'
export type LearningType = 'Mandatory' | 'Optional' | 'Recommended'

export interface LearningAssignment {
  id: number
  user_id: number
  employee_name: string | null
  employee_initials: string | null
  course_id: number
  course_name: string | null
  course_type: string | null
  course_category: string | null
  assignment_type: string
  status: string
  progress: number
  approval_status: string
  due_date: string | null
  due_date_label: string | null
  assigned_by: string | null
  assigned_on: string | null
  development_plan_id: number | null
  plan_title: string | null
  competency_id: number | null
  competency_name: string | null
}

export interface LearningAssignmentListParams {
  search?: string
  status?: string
  assignment_type?: string
  development_plan_id?: string
  employee_id?: string
  /** Drill-through from a competency's detail panel. */
  competency_id?: string
  page?: number
  per_page?: number
}

export interface LearningAssignmentPayload {
  course_id: number
  user_ids: number[]
  assignment_type?: LearningType
  status?: LearningStatus
  due_date?: string
  development_plan_id?: number
  competency_id?: number
}

export interface CourseOption {
  id: number
  name: string
  type: string | null
  category: string | null
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** Serialise a mixed param bag into the string map apiClient.get expects, dropping blanks and 'all'. */
function toStringParams(input: Record<string, string | number | undefined | null>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue
    const normalized = String(value).trim()
    if (normalized === '' || normalized === 'all') continue
    out[key] = normalized
  }
  return out
}

/** Laravel reads focus_areas as a comma-separated string; arrays are joined here. */
function serializePayload(payload: object): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue
    out[key] = Array.isArray(value) ? value.join(',') : value
  }
  return out
}

export const developmentCareerService = {
  /* -- Development plans -- */
  listPlans: (context: LaravelContext, params?: DevelopmentPlanListParams) =>
    apiClient.get<DevCareerListResponse<DevelopmentPlan[]>>(
      '/competency/development-plans',
      withLaravelParams(context, toStringParams({ ...params })),
    ),

  getMetrics: (context: LaravelContext) =>
    apiClient.get<DevCareerApiResponse<PlanMetrics>>(
      '/competency/development-plans/metrics',
      withLaravelParams(context),
    ),

  getOwners: (context: LaravelContext) =>
    apiClient.get<DevCareerApiResponse<FilterOption[]>>(
      '/competency/development-plans/owners',
      withLaravelParams(context),
    ),

  getEmployees: (context: LaravelContext, search?: string) =>
    apiClient.get<DevCareerApiResponse<EmployeeOption[]>>(
      '/competency/employee-options',
      withLaravelParams(context, toStringParams({ search })),
    ),

  getPlan: (context: LaravelContext, id: number) =>
    apiClient.get<DevCareerApiResponse<DevelopmentPlanDetail>>(
      `/competency/development-plans/${id}`,
      withLaravelParams(context),
    ),

  createPlan: (context: LaravelContext, payload: DevelopmentPlanPayload) =>
    apiClient.post<DevCareerApiResponse<{ id: number }>>('/competency/development-plans', {
      ...withLaravelParams(context),
      ...serializePayload(payload),
    }),

  updatePlan: (context: LaravelContext, id: number, payload: Partial<DevelopmentPlanPayload>) =>
    apiClient.put<DevCareerApiResponse<{ id: number }>>(`/competency/development-plans/${id}`, {
      ...withLaravelParams(context),
      ...serializePayload(payload),
    }),

  deletePlan: (context: LaravelContext, id: number) =>
    apiClient.delete<DevCareerApiResponse<null>>(
      `/competency/development-plans/${id}`,
      withLaravelParams(context),
    ),

  /* -- Plan detail tabs -- */
  getGaps: (context: LaravelContext, id: number) =>
    apiClient.get<DevCareerApiResponse<PlanGaps>>(
      `/competency/development-plans/${id}/gaps`,
      withLaravelParams(context),
    ),

  getActions: (context: LaravelContext, id: number) =>
    apiClient.get<DevCareerApiResponse<PlanAction[]>>(
      `/competency/development-plans/${id}/actions`,
      withLaravelParams(context),
    ),

  createAction: (context: LaravelContext, id: number, payload: PlanActionPayload) =>
    apiClient.post<DevCareerApiResponse<{ id: number; plan_progress: number | null }>>(
      `/competency/development-plans/${id}/actions`,
      { ...withLaravelParams(context), ...serializePayload(payload) },
    ),

  updateAction: (context: LaravelContext, id: number, actionId: number, payload: Partial<PlanActionPayload>) =>
    apiClient.put<DevCareerApiResponse<{ id: number; plan_progress: number | null }>>(
      `/competency/development-plans/${id}/actions/${actionId}`,
      { ...withLaravelParams(context), ...serializePayload(payload) },
    ),

  deleteAction: (context: LaravelContext, id: number, actionId: number) =>
    apiClient.delete<DevCareerApiResponse<{ plan_progress: number | null }>>(
      `/competency/development-plans/${id}/actions/${actionId}`,
      withLaravelParams(context),
    ),

  getHistory: (context: LaravelContext, id: number) =>
    apiClient.get<DevCareerApiResponse<PlanHistoryEntry[]>>(
      `/competency/development-plans/${id}/history`,
      withLaravelParams(context),
    ),

  /* -- Career paths -- */
  listCareerPaths: (context: LaravelContext, params?: { search?: string; status?: string; page?: number; per_page?: number }) =>
    apiClient.get<DevCareerListResponse<CareerPathSummary[]>>(
      '/competency/career-paths',
      withLaravelParams(context, toStringParams({ ...params })),
    ),

  getCareerPath: (context: LaravelContext, id: number) =>
    apiClient.get<DevCareerApiResponse<CareerPathDetail>>(
      `/competency/career-paths/${id}`,
      withLaravelParams(context),
    ),

  createCareerPath: (context: LaravelContext, payload: CareerPathPayload) =>
    apiClient.post<DevCareerApiResponse<{ id: number }>>('/competency/career-paths', {
      ...withLaravelParams(context),
      ...payload,
    }),

  updateCareerPath: (context: LaravelContext, id: number, payload: Partial<CareerPathPayload>) =>
    apiClient.put<DevCareerApiResponse<{ id: number }>>(`/competency/career-paths/${id}`, {
      ...withLaravelParams(context),
      ...payload,
    }),

  deleteCareerPath: (context: LaravelContext, id: number) =>
    apiClient.delete<DevCareerApiResponse<null>>(
      `/competency/career-paths/${id}`,
      withLaravelParams(context),
    ),

  getExplorer: (context: LaravelContext, params?: { plan_id?: number; career_path_id?: number; employee_id?: number }) =>
    apiClient.get<DevCareerApiResponse<CareerExplorer>>(
      '/competency/career-paths/explorer',
      withLaravelParams(context, toStringParams({ ...params })),
    ),

  getRoleOptions: (context: LaravelContext, search?: string) =>
    apiClient.get<DevCareerApiResponse<RoleOption[]>>(
      '/competency/career-paths/role-options',
      withLaravelParams(context, toStringParams({ search })),
    ),

  /* -- Learning assignments -- */
  listLearning: (context: LaravelContext, params?: LearningAssignmentListParams) =>
    apiClient.get<DevCareerListResponse<LearningAssignment[]>>(
      '/competency/learning-assignments',
      withLaravelParams(context, toStringParams({ ...params })),
    ),

  assignLearning: (context: LaravelContext, payload: LearningAssignmentPayload) =>
    apiClient.post<DevCareerApiResponse<{ assigned: number }>>('/competency/learning-assignments', {
      ...withLaravelParams(context),
      ...payload,
    }),

  updateLearning: (
    context: LaravelContext,
    id: number,
    payload: { status?: LearningStatus; progress?: number; due_date?: string; assignment_type?: LearningType },
  ) =>
    apiClient.put<DevCareerApiResponse<{ id: number }>>(`/competency/learning-assignments/${id}`, {
      ...withLaravelParams(context),
      ...payload,
    }),

  deleteLearning: (context: LaravelContext, id: number) =>
    apiClient.delete<DevCareerApiResponse<null>>(
      `/competency/learning-assignments/${id}`,
      withLaravelParams(context),
    ),

  getCourses: (context: LaravelContext, search?: string) =>
    apiClient.get<DevCareerApiResponse<CourseOption[]>>(
      '/competency/learning-assignments/courses',
      withLaravelParams(context, toStringParams({ search })),
    ),
}
