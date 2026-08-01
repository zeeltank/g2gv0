/**
 * Agentic AI — runs, traces and tool invocations.
 *
 *   GET    /agentic/runs                    list (agent / status / search / date range)
 *   POST   /agentic/agents/{id}/run         start a run
 *   GET    /agentic/runs/{id}               one run + its trace
 *   GET    /agentic/runs/{id}/trace         ordered task list
 *   PUT    /agentic/runs/{id}               record the outcome
 *   POST   /agentic/runs/{id}/tasks         append a trace step
 *   POST   /agentic/runs/{id}/cancel        stop a run still in flight
 *   DELETE /agentic/runs/{id}               soft delete
 *
 *   GET    /agentic/tools                   catalogue + usage counts
 *   GET    /agentic/tools/invocations       history
 *   GET    /agentic/tools/invocations/{id}  one invocation with its payload
 *   POST   /agentic/tools/{tool}/invoke     record an invocation
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

import { toStringParams, type AgenticApiResponse, type AgenticListResponse } from './agents'

export type RunStatus = 'pending' | 'running' | 'success' | 'error' | 'cancelled'

export interface AgentRun {
  id: number
  agent_id: number
  /** Resolved server side, so a deleted agent still reads as "Deleted agent". */
  agent_name: string
  status: RunStatus
  trigger: string
  input: string | null
  output: string | null
  error_message: string | null
  duration_ms: number | null
  tokens_used: number | null
  cost: number | null
  started_at: string | null
  completed_at: string | null
  created_at: string | null
}

/** One step of a run's trace. */
export interface RunTask {
  id: number
  run_id: number
  sequence: number
  description: string | null
  status: 'running' | 'success' | 'error'
  tool: string | null
  result: string | null
  error: string | null
  duration_ms: number | null
  created_at: string | null
}

export interface RunDetail extends AgentRun {
  tasks: RunTask[]
}

export interface RunListParams {
  agent_id?: string | number
  status?: string
  search?: string
  from?: string
  to?: string
  page?: number
  per_page?: number
}

export interface RunOutcomePayload {
  status?: RunStatus
  output?: string
  error_message?: string
  tokens_used?: number
  cost?: number
  duration_ms?: number
}

export interface RunTaskPayload {
  description: string
  status?: 'running' | 'success' | 'error'
  tool?: string
  result?: string
  error?: string
  duration_ms?: number
}

/* ------------------------------------------------------------------ *
 * Tools
 * ------------------------------------------------------------------ */

/** The six tool ids the detail screen renders a form for. */
export type ToolKey = 'knowledge' | 'email' | 'web_search' | 'sql_exec' | 'visualization' | 'file'

export interface ToolCatalogueEntry {
  tool: ToolKey
  label: string
  /** The id this tool has on an agent's `tools` array. */
  agent_tool: string
  fields: string[]
  required: string[]
  invocations: number
}

export interface ToolInvocation {
  id: number
  agent_id: number
  agent_name: string
  run_id: number | null
  tool: ToolKey
  label: string
  status: string
  error_message: string | null
  created_at: string | null
}

export interface ToolInvocationDetail extends Omit<ToolInvocation, 'agent_name'> {
  payload: Record<string, unknown> | null
  response: Record<string, unknown> | null
}

/** A tool payload: the fields differ per tool, agent_id is always required. */
export type ToolPayload = Record<string, string | number | undefined> & { agent_id: number; run_id?: number }

const RUNS = '/agentic/runs'
const TOOLS = '/agentic/tools'

export const runService = {
  list: (context: LaravelContext, params?: RunListParams) =>
    apiClient.get<AgenticListResponse<AgentRun[]>>(
      RUNS,
      withLaravelParams(context, toStringParams({ ...params })),
    ),

  get: (context: LaravelContext, id: number) =>
    apiClient.get<AgenticApiResponse<RunDetail>>(`${RUNS}/${id}`, withLaravelParams(context)),

  trace: (context: LaravelContext, id: number) =>
    apiClient.get<AgenticApiResponse<{ run_id: number; tasks: RunTask[] }>>(
      `${RUNS}/${id}/trace`,
      withLaravelParams(context),
    ),

  /** Only a deployed agent may run; the server refuses drafts and paused ones. */
  /**
   * `inputs` carries the answers to the agent's own input_schema; `input` is
   * the free-text fallback for agents that declare no schema. The server
   * validates `inputs` against the schema and refuses the run on a mismatch.
   */
  start: (
    context: LaravelContext,
    agentId: number,
    input?: string,
    trigger?: string,
    inputs?: Record<string, unknown>,
  ) =>
    apiClient.post<AgenticApiResponse<{ id: number; status: RunStatus; output?: string | null; error_message?: string | null }>>(
      `/agentic/agents/${agentId}/run`,
      {
        ...withLaravelParams(context),
        ...(input ? { input } : {}),
        ...(trigger ? { trigger } : {}),
        ...(inputs ? { inputs } : {}),
      },
    ),

  recordOutcome: (context: LaravelContext, id: number, payload: RunOutcomePayload) =>
    apiClient.put<AgenticApiResponse<{ id: number }>>(`${RUNS}/${id}`, {
      ...withLaravelParams(context),
      ...payload,
    }),

  addTask: (context: LaravelContext, id: number, payload: RunTaskPayload) =>
    apiClient.post<AgenticApiResponse<{ id: number; sequence: number }>>(`${RUNS}/${id}/tasks`, {
      ...withLaravelParams(context),
      ...payload,
    }),

  cancel: (context: LaravelContext, id: number) =>
    apiClient.post<AgenticApiResponse<{ id: number }>>(`${RUNS}/${id}/cancel`, withLaravelParams(context)),

  remove: (context: LaravelContext, id: number) =>
    apiClient.delete<AgenticApiResponse<{ id: number }>>(`${RUNS}/${id}`, withLaravelParams(context)),
}

export const toolService = {
  catalogue: (context: LaravelContext) =>
    apiClient.get<AgenticApiResponse<ToolCatalogueEntry[]>>(TOOLS, withLaravelParams(context)),

  invocations: (
    context: LaravelContext,
    params?: { agent_id?: number; tool?: string; status?: string; page?: number; per_page?: number },
  ) =>
    apiClient.get<AgenticListResponse<ToolInvocation[]>>(
      `${TOOLS}/invocations`,
      withLaravelParams(context, toStringParams({ ...params })),
    ),

  invocation: (context: LaravelContext, id: number) =>
    apiClient.get<AgenticApiResponse<ToolInvocationDetail>>(
      `${TOOLS}/invocations/${id}`,
      withLaravelParams(context),
    ),

  /**
   * Records a tool call. Refused when the agent does not have that tool
   * enabled, and — for sql_exec — when the statement is not a read.
   */
  invoke: (context: LaravelContext, tool: ToolKey, payload: ToolPayload) =>
    apiClient.post<AgenticApiResponse<{ id: number }>>(`${TOOLS}/${tool}/invoke`, {
      ...withLaravelParams(context),
      ...payload,
    }),
}
