/**
 * GTM workflow endpoints (Laravel /api/gtm/workflows*, /api/gtm/workflow-runs*).
 *
 * Reads need Administrator or Executive, writes and every run decision need Administrator. The builder is
 * generated from GET /gtm/workflows/catalog - triggers, condition facts, operators and actions all come from
 * the server, so nothing here lists them.
 */

import { apiClient } from '@/services/core'

type Env<T> = { status: number; data: T; message?: string }

export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'archived'

export interface CatalogField {
  type: 'number' | 'string' | 'enum' | 'bool'
  label: string
  options?: string[]
}

export interface CatalogTrigger {
  label: string
  entity: string | null
  provides: string[]
  fields: Record<string, CatalogField>
}

export interface CatalogAction {
  label: string
  params: Record<string, string>
  needs: string[]
  consequential: boolean
  description: string
}

export interface WorkflowCatalog {
  triggers: Record<string, CatalogTrigger>
  operators: string[]
  actions: Record<string, CatalogAction>
  notes: string[]
}

export interface WorkflowCondition {
  field: string
  op: string
  value?: unknown
}

export interface WorkflowAction {
  type: string
  params?: Record<string, unknown>
}

export interface GtmWorkflow {
  id: number
  name: string
  description: string | null
  trigger_event: string
  trigger_label?: string
  conditions: WorkflowCondition[]
  actions: WorkflowAction[]
  requires_approval: number | boolean
  max_runs_per_day: number
  status: WorkflowStatus
  activated_at: string | null
  created_at: string
  updated_at: string
  /** list rows: run counts in the last 7 days by status (PHP sends [] when there are none) */
  runs_7d?: Record<string, number> | []
  /** detail only */
  needs_approval?: boolean
}

export interface WorkflowInput {
  name: string
  description: string | null
  /** create only - the server refuses a changed trigger on update */
  trigger_event?: string
  conditions: WorkflowCondition[]
  actions: WorkflowAction[]
  requires_approval: boolean
  max_runs_per_day: number
}

export interface WorkflowRunRow {
  id: number
  workflow_id: number
  workflow_name?: string
  event_type: string
  entity_type: string | null
  entity_id: number | null
  status: string
  error: string | null
  attempts: number
  next_attempt_at: string | null
  decision_note?: string | null
  created_at: string
  finished_at: string | null
}

export interface ConditionTrace {
  field: string
  op: string
  expected: unknown
  actual: unknown
  pass: boolean
}

export interface RunStep {
  id: number
  step: number
  action: string
  status: string
  result: unknown
  error: string | null
  started_at: string | null
  finished_at: string | null
}

export interface RunDetail {
  run: WorkflowRunRow & {
    context: { values?: Record<string, unknown>; ids?: Record<string, number>; trace?: ConditionTrace[] } | null
    decided_at?: string | null
    started_at?: string | null
  }
  workflow: { id: number; name: string; trigger_event: string; status: string } | null
  steps: RunStep[]
}

export interface DryRunResult {
  dry_run: boolean
  would_run: boolean
  conditions: ConditionTrace[]
  needs_approval: boolean
  actions: { type: string; label: string; consequential: boolean; params: Record<string, unknown> }[]
  facts: Record<string, unknown>
}

export interface RunDecisionResult {
  status: string
  run: Pick<WorkflowRunRow, 'id' | 'workflow_id' | 'status' | 'error' | 'attempts' | 'next_attempt_at' | 'finished_at'> | null
}

export const workflowsService = {
  catalog: () => apiClient.get<Env<WorkflowCatalog>>('/gtm/workflows/catalog'),
  list: () => apiClient.get<Env<{ items: GtmWorkflow[] }>>('/gtm/workflows'),
  get: (id: number) =>
    apiClient.get<Env<{ workflow: GtmWorkflow; transitions: WorkflowStatus[]; runs: WorkflowRunRow[] }>>(`/gtm/workflows/${id}`),
  create: (input: WorkflowInput) => apiClient.post<Env<{ workflow: GtmWorkflow }>>('/gtm/workflows', input),
  update: (id: number, input: Omit<WorkflowInput, 'trigger_event'>) =>
    apiClient.patch<Env<{ workflow: GtmWorkflow }>>(`/gtm/workflows/${id}`, input),
  /** archiving is final and needs confirm: true or the server answers 409 */
  setStatus: (id: number, status: 'active' | 'paused' | 'archived', confirm = false) =>
    apiClient.post<Env<{ workflow: GtmWorkflow; runs_cancelled: number }>>(`/gtm/workflows/${id}/status`, { status, confirm }),
  test: (id: number, entityId: number) =>
    apiClient.post<Env<DryRunResult>>(`/gtm/workflows/${id}/test`, { entity_id: entityId }),

  runs: (params: { status?: string; workflow_id?: number; limit?: number } = {}) => {
    const q: Record<string, string> = {}
    if (params.status) q.status = params.status
    if (params.workflow_id) q.workflow_id = String(params.workflow_id)
    if (params.limit) q.limit = String(params.limit)
    return apiClient.get<Env<{ items: WorkflowRunRow[]; counts: Record<string, number> | [] }>>('/gtm/workflow-runs', q)
  },
  run: (id: number) => apiClient.get<Env<RunDetail>>(`/gtm/workflow-runs/${id}`),
  /** executes the run's actions on the record now - the server answers 409 unless confirm is true */
  approve: (id: number, note: string) =>
    apiClient.post<Env<RunDecisionResult>>(`/gtm/workflow-runs/${id}/approve`, { confirm: true, note: note || null }),
  reject: (id: number, note: string) => apiClient.post<Env<RunDecisionResult>>(`/gtm/workflow-runs/${id}/reject`, { note }),
  retry: (id: number) => apiClient.post<Env<RunDecisionResult>>(`/gtm/workflow-runs/${id}/retry`, {}),
  cancel: (id: number) => apiClient.post<Env<RunDecisionResult>>(`/gtm/workflow-runs/${id}/cancel`, {}),
}
