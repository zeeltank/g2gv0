export type TaskStatus = 'PENDING' | 'IN-PROGRESS' | 'ON HOLD' | 'COMPLETED'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface TaskComment {
  id: string
  author: string
  content: string
  timestamp: string
}

export interface TaskAttachment {
  id: string
  name: string
  url: string
  type: string
}

export interface Task {
  id: string
  title: string
  description: string
  project: string
  department: string
  assignee: string
  owner: string
  status: 'draft' | 'in_progress' | 'review' | 'completed' | 'blocked'
  priority: TaskPriority
  dueDate: string
  completionPercentage: number
  comments: TaskComment[]
  attachments: TaskAttachment[]
}

export type MyTaskGroup = 'all' | 'today' | 'upcoming' | 'recent' | 'subordinates'
export type MyTaskPriority = 'High' | 'Medium' | 'Low'

export interface MyTaskAttachment {
  name: string
  type: string | null
  size: string | null
  /**
   * The attachment version the file can be served from, or null when it cannot.
   *
   * `task.task_attachment` holds only a bare filename, and the bytes live in
   * one of two stores depending on which path uploaded them — so a name alone
   * does not mean a downloadable file. Null renders as text, not a dead link.
   */
  download_version: number | null
}

export interface MyTask {
  id: string
  title: string
  description: string
  assignee: string
  assignee_id: string | null
  owner: string
  owner_id: string | null
  department: string
  status: TaskStatus
  /**
   * The tenant's own name for `status`. Custom statuses are labels mapped onto
   * the four system categories, so a task on "Awaiting Client" still reports
   * status ON HOLD - without this the custom name is invisible in the UI.
   */
  status_label: string | null
  priority: MyTaskPriority | null
  task_type: string | null
  due_date: string | null
  remarks: string | null
  created_at: string | null
  updated_at: string | null
  observation_point?: string | null
  attachment?: MyTaskAttachment | null
}

/** A deadline-extension request on a task, as the API returns it. */
export interface DeadlineExtension {
  id: string
  task_id: string
  task_title: string
  current_due_date: string | null
  requested_date: string
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  requested_by: string | null
  decided_by: string | null
  decided_on: string | null
  decision_remarks: string | null
  created_at: string | null
}

/** One audit-trail entry, as Administration > Audit Logs renders it. */
export interface TaskAuditLog {
  id: string
  task_id: string
  task_title: string | null
  event: string
  actor_id: string | null
  actor: string | null
  before: Record<string, unknown> | null
  created_at: string | null
}

/** One row of the enforced permission matrix. */
export interface PermissionAbility {
  key: string
  label: string
  roles: Record<string, boolean>
}

/** Configured-or-not state of one task-module integration. */
export interface IntegrationStatus {
  key: string
  name: string
  description: string
  configured: boolean
  env: string
}

/** One status in the tenant's vocabulary: system category or custom label. */
export interface TaskStatusOption {
  id: string | null
  name: string
  category: TaskStatus
  color: string | null
  sort_order: number
  is_system: boolean
  active: boolean
}

/** One priority level in the tenant's vocabulary. */
export interface TaskPriorityOption {
  id: string | null
  name: string
  sort_order: number
  sla_hours: number | null
  is_system: boolean
  active: boolean
}

/** Per-assignee productivity, from the reports endpoint. */
export interface ProductivityRow {
  user_id: string
  name: string
  total: number
  completed: number
  open: number
  overdue: number
  completion_rate: number
}

export interface DelayReport {
  by_category: Array<{ category: string; total: number }>
  overdue: Array<{
    id: string
    title: string
    due_date: string | null
    status: string | null
    delay_category: string | null
    assignee: string
    days_overdue: number
  }>
}

export interface MyTaskSummary {
  due_today: number
  on_hold: number
  in_progress: number
  completed_this_month: number
}

export interface TaskPagination {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export interface MyTasksQuery {
  group?: MyTaskGroup
  search?: string
  /** A system category or a tenant's custom status label. */
  status?: string
  priority?: MyTaskPriority
  page?: number
  perPage?: number
}

export interface MyTasksResponse {
  status: 1
  message: string
  data: {
    tasks: MyTask[]
    summary: MyTaskSummary
    pagination: TaskPagination
    filters: {
      statuses: TaskStatus[]
      priorities: MyTaskPriority[]
      status_options: TaskStatusOption[]
      priority_options: TaskPriorityOption[]
    }
  }
}

export interface MyTaskDetailResponse {
  status: 1
  message: string
  data: MyTask
}

export type ProjectStatus = 'PLANNING' | 'IN PROGRESS' | 'AT RISK' | 'COMPLETED' | 'ARCHIVED'
export type ProjectPriority = 'High' | 'Medium' | 'Low'

export interface ProjectMember { id: string; name: string; role: string }
export interface Workstream {
  id: string
  project_id: string
  name: string
  description: string | null
  owner_id: string | null
  owner_name?: string | null
  status: ProjectStatus
  start_date: string | null
  due_date: string | null
  sort_order: number
}

/* ------------------------------------------------------------------ *
 * WORKSTREAM 360 — the lifecycle model
 *
 * A workstream used to be a name, an owner and a status. These types carry
 * the nine fields the customer's operating model actually asks for: purpose,
 * contributors, responsibilities, deliverables, timeline and checkpoints,
 * dependencies, success metrics, scope boundaries, and risks.
 * ------------------------------------------------------------------ */

/**
 * DELIVERY is a stage in the flow; GOVERNANCE spans it.
 *
 * This is not cosmetic. The customer's model states that its governance
 * workstream "is deliberately horizontal ... instead of becoming another
 * sequential stage", so the lifecycle diagram draws a GOVERNANCE workstream as
 * a band ACROSS the delivery flow rather than as a step inside it.
 */
export type WorkstreamKind = 'DELIVERY' | 'GOVERNANCE'

/** FLOW is the chain, FEEDBACK closes the loop, GOVERNS is the horizontal layer. */
export type WorkstreamLinkType = 'FLOW' | 'FEEDBACK' | 'GOVERNS'

/**
 * NOT STARTED and UNMEASURED are distinct from ON TRACK, deliberately.
 * An empty workstream satisfies every "nothing is overdue" test trivially, and
 * a KPI with no reading is unread rather than failing.
 */
export type WorkstreamHealthState = 'NOT STARTED' | 'UNMEASURED' | 'ON TRACK' | 'AT RISK' | 'OFF TRACK'

export interface WorkstreamHealth {
  state: WorkstreamHealthState
  /** A sentence naming what actually triggered it, never a restated label. */
  state_reason: string
  deliverables: { total: number; done: number; in_flight: number; open: number; overdue: number }
  kpis: { total: number; met: number; on_track: number; at_risk: number; off_track: number; unmeasured: number }
  /** `regulated_open` is failure; `severe_open` (High) is drift. */
  risks: { open: number; closed: number; regulated_open: number; severe_open: number; moderate_open: number }
  tasks: { total: number; completed: number; overdue: number; blocked: number }
  milestones: { total: number; completed: number; overdue: number }
}

export interface WorkstreamSummary {
  id: string
  project_id: string
  parent_id: string | null
  /** WS01, WS02.1 — unique per project, null until somebody sets one. */
  code: string | null
  kind: WorkstreamKind
  name: string
  /** Field 1 of the model. Replaces `description`, which is retired. */
  purpose: string | null
  core_question: string | null
  owner_id: string | null
  owner_name: string | null
  status: ProjectStatus
  start_date: string | null
  due_date: string | null
  sort_order: number
  children_count: number
  /** NULL with no deliverables — not 0, which would assert work exists and none is done. */
  progress: number | null
  health: WorkstreamHealth
}

export interface WorkstreamLink {
  id: string
  project_id: string
  from_id: string
  to_id: string
  link_type: WorkstreamLinkType
  /** The model's own edge captions — "WHAT + WHY", "USER FEEDBACK", "Scope". */
  label: string | null
  note: string | null
}

export interface WorkstreamMember {
  id: string
  user_id: string
  user_name: string | null
  role: string
  /** "Backend, APIs, database, integrations" — what stops one workstream becoming three. */
  lane: string | null
}

export interface WorkstreamStatement { id: string; body: string }

export interface WorkstreamDeliverable {
  id: string
  name: string
  description: string | null
  acceptance_criteria: string | null
  status: string
  due_date: string | null
  delivered_at: string | null
  owner_id: string | null
  owner_name: string | null
  checkpoint_id: string | null
  checkpoint_name: string | null
}

export interface WorkstreamCheckpoint {
  id: string
  name: string
  description: string | null
  target_date: string | null
  status: string
  is_critical: boolean
  completed_at: string | null
}

export interface WorkstreamKpi {
  id: string
  name: string
  metric: string | null
  unit: string | null
  direction: 'UP' | 'DOWN'
  baseline_value: string | null
  /**
   * STRINGS, not numbers, and that is deliberate: the model's own examples are
   * "15% reduction in latency" and "100 units produced", and "Zero P1 incidents"
   * is a legitimate target that is not a number at all.
   */
  target_value: string | null
  /** NULL means NEVER MEASURED. Render it as such — never as 0. */
  current_value: string | null
  measured_at: string | null
  status: 'UNMEASURED' | 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'MET'
  weightage: number
  source: string | null
  owner_id: string | null
}

export interface WorkstreamRisk {
  id: string
  title: string
  description: string | null
  category: string | null
  probability: 'Low' | 'Medium' | 'High'
  impact: 'Low' | 'Medium' | 'High' | 'Regulated'
  /** Stored, computed from probability x impact — so the register can sort on it. */
  severity: 'Low' | 'Medium' | 'High' | 'Regulated'
  mitigation: string | null
  contingency: string | null
  status: string
  due_date: string | null
  closed_at: string | null
  owner_id: string | null
  owner_name: string | null
}

/** An upstream requirement or downstream impact that is NOT another workstream. */
export interface WorkstreamDependency {
  id: string
  description: string
  /** Free text — a vendor or a committee is not a row in this database. */
  source: string | null
  needed_by: string | null
  status: string
  is_blocking: boolean
}

export interface WorkstreamDetail extends WorkstreamSummary {
  members: WorkstreamMember[]
  statements: {
    responsibilities: WorkstreamStatement[]
    in_scope: WorkstreamStatement[]
    out_of_scope: WorkstreamStatement[]
  }
  deliverables: WorkstreamDeliverable[]
  checkpoints: WorkstreamCheckpoint[]
  kpis: WorkstreamKpi[]
  risks: WorkstreamRisk[]
  dependencies: { upstream: WorkstreamDependency[]; downstream: WorkstreamDependency[] }
  /** The graph half of field 6, split by the direction the reader cares about. */
  upstream: WorkstreamLink[]
  downstream: WorkstreamLink[]
  governs: WorkstreamLink[]
  governed_by: WorkstreamLink[]
  children: Array<{ id: string; code: string | null; name: string; kind: WorkstreamKind }>
  tasks: Array<{ id: string; title: string; status: string | null; due_date: string | null; assignee: string | null }>
  project: { id: string; code: string; name: string }
  can_manage: boolean
}

export interface WorkstreamListResponse {
  status: 1
  message: string
  data: {
    workstreams: WorkstreamSummary[]
    links: WorkstreamLink[]
    /** Dated deliverables and checkpoints, for the schedule. */
    schedule: ScheduleItem[]
    summary: {
      workstreams: number
      by_state: Partial<Record<WorkstreamHealthState, number>>
      open_risks: number
      deliverables_total: number
      deliverables_done: number
      kpis_needing_attention: number
    }
    project: { id: string; code: string; name: string; start_date: string | null; due_date: string | null }
  }
}

/**
 * A task offered by the Link task picker.
 *
 * `already_linked_project` is populated when the task belongs to a DIFFERENT
 * project. Such tasks are still offered — hiding them makes a task somebody is
 * searching for simply absent — but the picker says where it currently sits.
 */
/**
 * One dated thing on a project — a deliverable's due date or a checkpoint's
 * target date. Tasks are dated too but arrive on `ProjectRecord.tasks`, so the
 * schedule joins the two on the client rather than fetching tasks twice.
 *
 * Undated rows are NOT here: "no date" is a count the UI shows as a prompt,
 * not a row it can place on a schedule.
 */
export interface ScheduleItem {
  id: string
  kind: 'DELIVERABLE' | 'CHECKPOINT'
  title: string
  date: string
  status: string | null
  is_critical?: boolean
  workstream_id: string
  workstream_name: string
}

/**
 * A backlog item — work written down before it has an owner.
 *
 * `title` is the only thing the server requires. Everything else is optional
 * and can arrive later, which is the whole point: somebody has to be able to
 * write "post on social media" without first answering who, when, under which
 * project, or against which job role.
 */
export type BacklogType = 'NEW' | 'FIX' | 'IMPROVE' | 'SETUP' | 'ROUTINE' | 'REQUEST'
export type BacklogStatus = 'OPEN' | 'ASSIGNED' | 'DONE' | 'DROPPED'

export interface BacklogItem {
  id: string
  title: string
  notes: string | null
  type: BacklogType
  priority: string
  status: BacklogStatus
  rank: number
  /** Null means it has not been filed under a project yet. */
  project_id: string | null
  project_name: string | null
  project_code: string | null
  workstream_id: string | null
  workstream_name: string | null
  /** The task it became, once it has been assigned. */
  task_id: string | null
  task_title: string | null
  task_status: string | null
  created_at: string | null
}

export interface BacklogResponse {
  status: 1
  message: string
  data: {
    items: BacklogItem[]
    options: { types: BacklogType[]; priorities: string[]; statuses: BacklogStatus[] }
  }
}

export interface BacklogPayload {
  title: string
  notes?: string | null
  type?: BacklogType
  priority?: string
  status?: BacklogStatus
  project_id?: string | null
  workstream_id?: string | null
}

export interface ProgressBasis {
  done: number
  total: number
  deliverables: { done: number; total: number }
  tasks: { done: number; total: number }
  /** Linked to the project but not filed under any workstream. Still counted. */
  unplaced_tasks: { done: number; total: number }
  /** How many workstreams fed the number — governance layers are excluded. */
  delivery_workstreams: number
  source: 'WORKSTREAMS' | 'TASKS' | 'NONE'
}

export interface LinkableTask {
  id: string
  title: string
  status: string | null
  due_date: string | null
  assignee: string | null
  already_linked_project_id: string | null
  /** The project NAME. The code travels separately — a name is the identity. */
  already_linked_project: string | null
  already_linked_project_code: string | null
}

/**
 * A project as a picker option.
 *
 * The dependency and milestone responses used to carry `{ id, name }` — two
 * fields — so a picker had nothing richer to show even if it wanted to, while
 * the project endpoint was returning 26. Widening the TRANSPORT is the fix; a
 * display-only change could not have helped.
 */
export interface ProjectOption {
  id: string
  code: string
  name: string
  status: ProjectStatus
  manager: string | null
  department: string | null
  start_date: string | null
  due_date: string | null
}

/** Every vocabulary the editors need, owned by the server. */
export interface WorkstreamOptions {
  kinds: WorkstreamKind[]
  statuses: ProjectStatus[]
  link_types: WorkstreamLinkType[]
  member_roles: string[]
  statement_kinds: string[]
  deliverable_statuses: string[]
  checkpoint_statuses: string[]
  kpi_statuses: string[]
  kpi_directions: string[]
  risk_levels: string[]
  risk_probabilities: string[]
  risk_statuses: string[]
  dependency_directions: string[]
  dependency_statuses: string[]
}
/** One task linked to a project, as returned inside the project detail. */
export interface ProjectLinkedTask {
  id: string
  title: string
  status: string | null
  due_date: string | null
  assignee: string | null
  /** NULL = linked to the project but not placed in any workstream. */
  workstream_id: string | null
  workstream_name: string | null
}

export interface ProjectRecord {
  id: string; code: string; name: string; category: string | null; description: string
  department_id: string | null; department: string | null; sponsor_id: string | null; sponsor: string | null
  manager_id: string | null; manager: string | null; team_size: string | null; priority: ProjectPriority
  status: ProjectStatus; start_date: string | null; due_date: string | null; budget_estimate: string | null
  client_name: string | null; regulatory_flags: string[]; members_count: number; tasks_total: number
  tasks_completed: number; progress: number
  /**
   * The arithmetic behind `progress`, so the number is answerable.
   *
   * A bare 6% is a claim; "1 of 18 — 0 of 13 deliverables, 1 of 5 tasks" is a
   * statement somebody can check. `source` separates "0% because nothing is
   * done" from "0% because there is nothing to measure yet", which is the
   * project-level equivalent of a workstream's null progress.
   */
  progress_basis: ProgressBasis
  archived_at: string | null
  members?: ProjectMember[]; workstreams?: Workstream[]; task_ids?: string[]
  /**
   * The tasks actually linked to this project, hydrated from
   * task_management_project_tasks. `task_ids` above is the same set as bare
   * ids and is kept for the link-editing checklist.
   *
   * `workstream_id` is the field that made workstreams useful: it is written
   * when a task is attached to a project, and until now was never returned by
   * any endpoint — so a task's workstream placement could not be seen anywhere.
   */
  tasks?: ProjectLinkedTask[]
  /** Every department on the project, primary first. */
  departments?: Array<{ id: string; name: string | null; is_primary: boolean }>
}
export interface ProjectPayload {
  name: string; category?: string; description: string; department_id?: string; sponsor_id?: string
  /** Departments beyond the primary. `department_id` remains THE primary. */
  department_ids?: string[]
  manager_id: string; team_size?: string; member_ids: string[]; priority: ProjectPriority; status?: ProjectStatus
  start_date: string; due_date: string; budget_estimate?: string; client_name?: string; regulatory_flags: string[]
}
export interface ProjectOptions {
  users: Array<{ id: string; name: string }>
  departments: Array<{ id: string; name: string }>
  tasks: Array<{ id: string; title: string; status: string | null; department_id: string | null }>
  categories: string[]; statuses: ProjectStatus[]; priorities: ProjectPriority[]
}

export type WorkspaceScope = 'all' | 'mine' | 'created' | 'team' | 'department' | 'archived'

export interface WorkspaceTask {
  id: string
  title: string
  description: string
  project_id: string | null
  project: string
  department: string
  assignee_id: string | null
  assignee: string
  owner_id: string | null
  owner: string
  status: TaskStatus
  /** See {@link MyTask.status_label}. */
  status_label: string | null
  priority: MyTaskPriority | null
  /**
   * When the work is meant to START. Optional on the type because it is
   * genuinely absent from most rows: the column exists and is written by
   * TaskScheduleController, but no screen set it until the calendar's drag
   * handles, so `planned_start_date` is NULL for every task on both databases
   * today. A task without one is a single-day chip, never a fabricated span.
   */
  planned_start_date?: string | null
  /*
   * EDIT-ONLY FIELDS. Returned by `GET /workspace/{id}` and never by the list,
   * so they are optional on the type. The edit form needs them because the
   * task update is a FULL REPLACE - a field it cannot read is a field it would
   * blank on save.
   */
  kra?: string | null
  kpa?: string | null
  /** Skill names, comma-joined. Display text. */
  required_skills?: string | null
  /** The ids behind those names, comma-joined. What the capability chain uses. */
  skill_id?: string | null
  observation_point?: string | null
  /** The workstream inside `project_id`. Single-task read only. */
  workstream_id?: string | null
  due_date: string | null
  remarks: string | null
  approved: boolean
  approved_on: string | null
  /**
   * The decision itself. `approved` is a boolean derived from this and cannot
   * express "rejected" — which is why the Rejected tab used to guess from
   * `status === 'ON HOLD'`, a proxy that matched nothing on either database.
   */
  approve_status: 'approved' | 'rejected' | 'pending' | null
  /** Why it was sent back. Null on approval, and null on rejections recorded
   *  before the reason was captured. */
  approve_remarks: string | null
  created_at: string | null
  updated_at: string | null
  attachment: MyTaskAttachment | null
  comments?: Array<{ id: string; author: string; content: string; created_at: string }>
}

export interface WorkspaceResponse {
  status: 1
  message: string
  data: {
    tasks: WorkspaceTask[]
    summary: { active: number; pending_review: number; blocked_overdue: number; completed_this_month: number }
    pagination: TaskPagination
    filters: {
      statuses: TaskStatus[]
      priorities: MyTaskPriority[]
      users: Array<{ id: string; name: string }>
      status_options: TaskStatusOption[]
      priority_options: TaskPriorityOption[]
    }
  }
}

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF'
export interface DependencyTaskRef { id: string; title: string; status: string; due_date: string | null; start_date: string | null }
/**
 * WHAT THE TYPE AND LAG ACTUALLY IMPLY.
 *
 * `implied_date` is where the successor's `target_field` SHOULD sit given the
 * predecessor's anchor date, the dependency type and the lag. It is null when
 * the anchor is missing — SS and SF read `planned_start_date`, which no screen
 * sets — and `reason` then names what is missing rather than guessing.
 *
 * Nothing is ever moved automatically. `violates` only reports.
 */
export interface DependencySchedule {
  implied_date: string | null
  target_field: 'planned_start_date' | 'due_date'
  current_date: string | null
  violates: boolean
  reason: string | null
}
export interface TaskDependency {
  id: string
  type: DependencyType
  lag_days: number
  notes: string | null
  project_id: string | null
  /** Inferred from the successor's project link; kept in step with
      `project_id` on write, and returned so a divergence is visible. */
  derived_project_id: string | null
  workstream_id: string | null
  project: string
  assignee_id: string | null
  assignee: string
  predecessor: DependencyTaskRef
  successor: DependencyTaskRef
  blocking: boolean
  schedule: DependencySchedule
}
export interface DependencyNode {
  /** NULL for most tasks - the column is set by no screen, so the timeline
      shows a marker on the due date instead of a fabricated span. */
  planned_start_date?: string | null
  id: string; title: string; status: string; priority: string | null; due_date: string | null
  project: string; assignee: string; at_risk: boolean
  /** The map filters on the id, never on the rendered name. */
  assignee_id: string | null
  /** The board is grouped by WORKSTREAM, not by project. Both are nullable:
      a task can be linked to a project without belonging to a workstream. */
  project_id: string | null; workstream_id: string | null; workstream: string | null
  /** The ASSIGNEE's department - the same meaning WorkspaceController and
      MyTasksController give the word, not the project's own department. The map
      filters on the id and labels the menu with the name; both are null for a
      person with no department set. */
  department_id: string | null; department: string | null
}
export interface MilestoneCounts {
  total: number; completed: number; open: number; blocked: number; overdue: number
}
export interface TaskMilestone {
  id: string; project_id: string; workstream_id: string | null; name: string; description: string | null
  target_date: string; status: 'UPCOMING' | 'AT RISK' | 'COMPLETED'; project_name: string; workstream_name: string | null
  /** Scoped to THIS milestone's project (and workstream when it has one).
      The cards used to print one tenant-wide number on every card. */
  counts: MilestoneCounts
}
export interface MilestonesResponse {
  status: 1
  message: string
  data: {
    milestones: TaskMilestone[]
    options: {
      projects: ProjectOption[]
      workstreams: Array<{ id: string; name: string; project_id: string }>
      statuses: Array<'UPCOMING' | 'AT RISK' | 'COMPLETED'>
    }
  }
}
export interface DependenciesResponse {
  status: 1
  message: string
  data: {
    dependencies: TaskDependency[]
    tasks: DependencyNode[]
    milestones: TaskMilestone[]
    summary: { total: number; blocking: number; at_risk: number; on_track: number; milestones: number; critical_path: number }
    options: {
      types: DependencyType[]
      projects: ProjectOption[]
      /** project_id has always been returned by taskOptions(); it was never typed, so nothing used it. */
      tasks: Array<{ id: string; title: string; status: string; due_date: string | null; project_id: string | null }>
      users: Array<{ id: string; name: string }>
    }
  }
}
