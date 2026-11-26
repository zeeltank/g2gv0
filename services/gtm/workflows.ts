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
  /** The words that sit after "When" ("a lead is created"). Absent on a server that does not send them yet. */
  phrase?: string
  entity: string | null
  provides: string[]
  fields: Record<string, CatalogField>
}

/** How a typed action parameter is filled in. A `number` is a whole number. A `text` with `format: 'json'` is a structured value (an object). */
export type CatalogParamType = 'string' | 'text' | 'number' | 'bool' | 'enum' | 'user'

/** One typed action parameter, as the server's catalog describes it (so the screen never guesses a type from words). */
export interface CatalogParam {
  key: string
  label: string
  type: CatalogParamType
  required: boolean
  /** For `enum`: plain values, or value and label pairs. */
  options?: Array<string | { value: string; label?: string }>
  /** `json` for a text that holds a structured value (the input of an agent). */
  format?: string
  /** Optional extras a server may send; the screen uses them when present. */
  help?: string
  min?: number
  max?: number
  placeholders?: boolean
}

export interface CatalogAction {
  label: string
  /** Each parameter described in words (name to sentence): what the old form read. The screen reads it only when `param_fields` is absent. */
  params: Record<string, string>
  /** The parameters, typed. Absent on a server that does not send them yet (lib/workflows/catalog.ts, paramsOf). */
  param_fields?: CatalogParam[]
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
  /** True when any action is consequential or the workflow asks for approval: its runs wait for a person. List rows and detail. */
  needs_approval?: boolean
  /** The whole automation as one plain sentence. List rows, once the server sends it. */
  sentence?: string
  /** The latest outcome, from one aggregate over the workflow's runs. List rows, once the server sends it. */
  last_run?: WorkflowLastRun | null
}

/** What happened last, and how the last 7 days went. */
export interface WorkflowLastRun {
  status: string | null
  at: string | null
  done_7d: number
  failed_7d: number
  waiting: number
}

/** A ready-made automation the server can add as a draft. */
export interface WorkflowRecipe {
  key: string
  title: string
  sentence: string
  trigger: string
  trigger_label: string
  actions: Array<{ type: string; label: string }>
  consequential: boolean
  requires_approval: boolean
  /** The id of the workflow already made from this recipe in this organisation, or null. */
  installed_workflow_id: number | null
}

/** The answer to adding a recipe: 201 with `created: true` for a new draft, 200 with `created: false` when it was already there. */
export interface RecipeInstallResult {
  created: boolean
  id?: number
  workflow_id?: number
  workflow?: Partial<GtmWorkflow> & { id: number }
}

/** Whether the scheduler that starts automations is running. */
export interface WorkflowHealth {
  state: 'running' | 'stale' | 'unknown'
  last_tick_at: string | null
  last_events_at: string | null
  expected_every_minutes: number
  message: string
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
  /** The ready-made automations, with the id of the one already added where there is one. */
  recipes: () => apiClient.get<Env<{ items: WorkflowRecipe[] }>>('/gtm/workflows/recipes'),
  /** Adds a recipe as a DRAFT. Safe to repeat: a recipe already added answers with the same workflow and `created: false`. */
  installRecipe: (key: string) => apiClient.post<Env<RecipeInstallResult>>(`/gtm/workflows/recipes/${encodeURIComponent(key)}/install`, {}),
  /** Whether the clock that starts automations is running. */
  health: () => apiClient.get<Env<WorkflowHealth>>('/gtm/workflows/health'),
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
