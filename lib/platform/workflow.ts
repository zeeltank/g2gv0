/**
 * Workflow reads and writes.
 *
 * ── A POINT IS NOT A CHAIN ──────────────────────────────────────────────────
 *
 * A `WorkflowPoint` is a place in the product where an action can pause for a sign-off.
 * It is declared in `config/platform_services.php` and an organisation cannot add one.
 * A `WorkflowChain` is the ladder of approvers this organisation puts at that point.
 *
 * `points` returns every point INCLUDING the ones with no chain, because "which of our
 * approvals has nobody signing them off" is the question the screen exists to answer,
 * and a list of only the configured ones cannot answer it.
 */

import { platformRequest } from './client'

export type ApproverType = 'reporting_manager' | 'department_head' | 'role' | 'user'
export type EscalationAction = 'none' | 'remind' | 'escalate' | 'auto_approve' | 'auto_reject'
export type WorkflowStatus = 'draft' | 'active' | 'disabled'

export interface WorkflowStep {
  id: string
  /** 1-based, derived server-side from array position. A client-sent value is ignored. */
  order: number
  name: string
  approver_type: ApproverType
  /** Empty for the types resolved from the record; the server blanks those. */
  approver: string
  /** Hours before `on_breach` fires. 0 disables the SLA. */
  sla_hours: number
  on_breach: EscalationAction
  allow_delegate: boolean
  require_comment: boolean
}

export interface WorkflowChain {
  id: number
  flow_key: string
  module: string
  component: string
  name: string
  description: string | null
  status: WorkflowStatus
  /** Free text the engine evaluates. Empty means the chain always applies. */
  condition: string
  steps: WorkflowStep[]
  step_count: number
  /** The question a manager actually asks: how long can this take at worst? */
  total_sla_hours: number
  on_reject: 'return_to_requester' | 'close'
  notify_requester: boolean
  created_at: string | null
  created_by: string | null
  updated_at: string | null
  updated_by: string | null
  /**
   * Whether THIS chain is the one that would actually be used.
   *
   * Several chains can be active at one point, and only one is selected. A
   * shadowed chain looks identical in a list, so somebody edits it and wonders
   * why nothing changed — `ineffective_reason` is the sentence that explains it.
   */
  effective: boolean
  ineffective_reason: string | null
}

export interface WorkflowPoint {
  key: string
  module: string
  component: string
  label: string
  description: string
  /** What the record is called in an approval inbox. */
  subject: string
  /**
   * Whether anything in the product actually reads a chain saved here.
   *
   * ── THE FIELD THAT STOPS THIS SCREEN LYING ────────────────────────────────
   *
   * Exactly one point is enforced today: `hrms.leave.approval`, read by
   * `LeaveApprovalWorkflow`. The other seven are declared and consumed by
   * nothing, so a chain saved against one is a plan rather than a gate.
   *
   * Without this the console showed the same green "Governed" pill for all
   * eight and told the reader that an ungoverned point "goes through without a
   * sign-off" — both of which were false in the same way, because an active
   * chain at an unenforced point also goes through without a sign-off.
   */
  enforced: boolean
  /** What enforcement means here, shown beside the point. */
  enforced_note: string | null
  /** A starting ladder, offered when somebody adds the first chain here. */
  suggested_steps: WorkflowStep[]
  workflows: WorkflowChain[]
}

export interface WorkflowPayload {
  points: WorkflowPoint[]
  summary: {
    points: number
    /** Points with at least one ACTIVE chain. A draft governs nothing. */
    governed: number
    workflows: number
    active: number
    draft: number
    /** How many points anything actually reads. This is the honest headline. */
    enforced_points: number
    /** Enforced points that also have an active chain. */
    enforced_governed: number
  }
}

export interface WorkflowInput {
  flow_key?: string
  name?: string
  description?: string
  status?: WorkflowStatus
  condition?: string
  steps?: Partial<WorkflowStep>[]
  on_reject?: WorkflowChain['on_reject']
  notify_requester?: boolean
}

export interface RegistryOption {
  key: string
  label: string
  description?: string
  /** Approver types only: whether the step needs a role name or user id. */
  needs_value?: boolean
}

export interface PlatformRegistryPayload {
  modules: { key: string; label: string; description: string; icon: string }[]
  components: { key: string; module: string; label: string; description: string }[]
  workflows: { key: string; module: string; component: string; label: string }[]
  approver_types: RegistryOption[]
  escalation_actions: RegistryOption[]
  custom_field_tables: RegistryOption[]
  /** Where the config contradicts itself. Empty means coherent. */
  problems: string[]
}

export function fetchPlatformRegistry(): Promise<PlatformRegistryPayload> {
  return platformRequest<PlatformRegistryPayload>('/registry')
}

export function fetchWorkflowPoints(module?: string): Promise<WorkflowPayload> {
  return platformRequest<WorkflowPayload>('/workflow/points', { module })
}

export function createWorkflow(input: WorkflowInput): Promise<{ workflow: WorkflowChain }> {
  return platformRequest<{ workflow: WorkflowChain }>('/workflow', undefined, {
    method: 'POST',
    body: input,
  })
}

export function updateWorkflow(id: number, input: WorkflowInput): Promise<{ workflow: WorkflowChain }> {
  return platformRequest<{ workflow: WorkflowChain }>(`/workflow/${id}`, undefined, {
    method: 'PUT',
    body: input,
  })
}

export function deleteWorkflow(id: number): Promise<{ deleted: number }> {
  return platformRequest<{ deleted: number }>(`/workflow/${id}`, undefined, { method: 'DELETE' })
}
