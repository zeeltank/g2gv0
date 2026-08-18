/**
 * Agentic AI — multi-agent coordination.
 *
 *   GET/POST         /agentic/workflows
 *   GET/PUT/DELETE   /agentic/workflows/{id}
 *   POST             /agentic/workflows/{id}/steps
 *   PUT/DELETE       /agentic/workflows/{id}/steps/{stepId}
 *   POST             /agentic/workflows/{id}/run
 *   GET              /agentic/workflow-runs/{id}
 *   PUT              /agentic/workflow-runs/{id}/steps/{stepRunId}
 *   GET/POST         /agentic/messages
 *
 * The screen this backs used to animate fixture agents on a 15-second loop.
 * These are real workflows over the tenant's own agents, and a run records
 * which step reached which state and when.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

import { toStringParams, type AgenticApiResponse } from './agents'

export type WorkflowMode = 'sequential' | 'parallel'
export type WorkflowStatus = 'draft' | 'active' | 'archived'
/** The four states the flow diagram draws. */
export type StepState = 'idle' | 'processing' | 'completed' | 'error'

export interface Workflow {
  id: number
  name: string
  description: string | null
  mode: WorkflowMode
  status: WorkflowStatus
  step_count: number
  last_run_at: string | null
  created_at: string | null
}

export interface WorkflowStep {
  id: number
  agent_id: number
  agent_name: string
  agent_description: string | null
  model: string | null
  tools: string[]
  sequence: number
  name: string | null
  instruction: string | null
}

export interface WorkflowStepRun {
  id: number
  workflow_step_id: number | null
  agent_id: number | null
  agent_name: string
  agent_description: string | null
  model: string | null
  tools: string[]
  sequence: number
  status: StepState
  output: string | null
  error: string | null
  started_at: string | null
  completed_at: string | null
}

export interface WorkflowRun {
  id: number
  workflow_id: number
  status: 'running' | 'completed' | 'error'
  started_at: string | null
  completed_at: string | null
  steps: WorkflowStepRun[]
}

export interface WorkflowDetail {
  id: number
  name: string
  description: string | null
  mode: WorkflowMode
  status: WorkflowStatus
  steps: WorkflowStep[]
  latest_run: WorkflowRun | null
  created_at: string | null
}

export interface WorkflowPayload {
  name?: string
  description?: string
  mode?: WorkflowMode
  status?: WorkflowStatus
}

export interface WorkflowStepPayload {
  agent_id?: number
  sequence?: number
  name?: string
  instruction?: string
}

export interface AgentMessage {
  id: number
  from_agent: string
  to_agent: string
  message: string
  workflow_run_id: number | null
  created_at: string | null
}

const BASE = '/agentic/workflows'

export const workflowService = {
  list: (context: LaravelContext, params?: { search?: string; status?: string; mode?: string }) =>
    apiClient.get<AgenticApiResponse<Workflow[]>>(
      BASE,
      withLaravelParams(context, toStringParams({ ...params })),
    ),

  get: (context: LaravelContext, id: number) =>
    apiClient.get<AgenticApiResponse<WorkflowDetail>>(`${BASE}/${id}`, withLaravelParams(context)),

  create: (context: LaravelContext, payload: WorkflowPayload) =>
    apiClient.post<AgenticApiResponse<{ id: number }>>(BASE, { ...withLaravelParams(context), ...payload }),

  update: (context: LaravelContext, id: number, payload: WorkflowPayload) =>
    apiClient.put<AgenticApiResponse<{ id: number }>>(`${BASE}/${id}`, {
      ...withLaravelParams(context),
      ...payload,
    }),

  remove: (context: LaravelContext, id: number) =>
    apiClient.delete<AgenticApiResponse<{ id: number }>>(`${BASE}/${id}`, withLaravelParams(context)),

  addStep: (context: LaravelContext, id: number, payload: WorkflowStepPayload) =>
    apiClient.post<AgenticApiResponse<{ id: number; sequence: number }>>(`${BASE}/${id}/steps`, {
      ...withLaravelParams(context),
      ...payload,
    }),

  updateStep: (context: LaravelContext, id: number, stepId: number, payload: WorkflowStepPayload) =>
    apiClient.put<AgenticApiResponse<{ id: number }>>(`${BASE}/${id}/steps/${stepId}`, {
      ...withLaravelParams(context),
      ...payload,
    }),

  removeStep: (context: LaravelContext, id: number, stepId: number) =>
    apiClient.delete<AgenticApiResponse<{ id: number }>>(
      `${BASE}/${id}/steps/${stepId}`,
      withLaravelParams(context),
    ),

  /** Opens a run and starts step 1 (sequential) or every step (parallel). */
  run: (context: LaravelContext, id: number) =>
    apiClient.post<AgenticApiResponse<WorkflowRun>>(`${BASE}/${id}/run`, withLaravelParams(context)),

  getRun: (context: LaravelContext, runId: number) =>
    apiClient.get<AgenticApiResponse<WorkflowRun>>(
      `/agentic/workflow-runs/${runId}`,
      withLaravelParams(context),
    ),

  /**
   * Reports a step outcome. Completing a sequential step starts the next one;
   * an error stops the run rather than letting it continue silently.
   */
  updateStepRun: (
    context: LaravelContext,
    runId: number,
    stepRunId: number,
    payload: { status: StepState; output?: string; error?: string },
  ) =>
    apiClient.put<AgenticApiResponse<WorkflowRun>>(
      `/agentic/workflow-runs/${runId}/steps/${stepRunId}`,
      { ...withLaravelParams(context), ...payload },
    ),

  messages: (context: LaravelContext, workflowRunId?: number) =>
    apiClient.get<AgenticApiResponse<AgentMessage[]>>(
      '/agentic/messages',
      withLaravelParams(context, toStringParams({ workflow_run_id: workflowRunId })),
    ),

  sendMessage: (
    context: LaravelContext,
    payload: { from_agent_id?: number; to_agent_id?: number; workflow_run_id?: number; message: string },
  ) =>
    apiClient.post<AgenticApiResponse<{ id: number }>>('/agentic/messages', {
      ...withLaravelParams(context),
      ...payload,
    }),
}
