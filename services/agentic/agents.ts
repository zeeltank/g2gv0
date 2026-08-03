/**
 * Agentic AI — agent registry service.
 *
 * Backs the Agent Library, Agent Dashboard and Create Agent screens:
 *   GET    /agentic/agents/meta          tool catalogue, models, modules, status counts
 *   GET    /agentic/agents               list (search / status / module / tool, sort, paginate)
 *   POST   /agentic/agents               create
 *   GET    /agentic/agents/{id}          one agent + recent runs + tool invocations
 *   PUT    /agentic/agents/{id}          update
 *   PATCH  /agentic/agents/{id}/status   deploy / pause / archive
 *   POST   /agentic/agents/{id}/clone    duplicate as a draft
 *   DELETE /agentic/agents/{id}          soft delete
 *
 * Every call carries the standard Laravel context (token, sub_institute_id,
 * user_id, syear, type=API) via withLaravelParams. The module this replaces
 * addressed a public HuggingFace Space by bare agent id with no auth at all.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

export interface AgenticApiResponse<T> {
  status: number
  message: string
  data: T
}

export interface AgenticPagination {
  page: number
  per_page: number
  total: number
  last_page: number
}

export interface AgenticListResponse<T> extends AgenticApiResponse<T> {
  pagination: AgenticPagination
}

/** draft → deployed → paused; archived is the soft retirement. */
export type AgentStatus = 'draft' | 'deployed' | 'paused' | 'archived'

/**
 * 'platform' agents are the shared capability catalogue (no owning tenant);
 * 'tenant' agents were created here. Only tenant agents are editable.
 */
export type AgentOrigin = 'platform' | 'tenant'

/** How a run is performed: recorded only, or dispatched over HTTP. */
export type ExecutionMode = 'none' | 'http'

/**
 * The input types an agent schema can declare. Agents do not share an input
 * contract - the Excel agent wants a spreadsheet, the SEO agent a URL and an
 * analysis mode - so each carries its own field list rather than the module
 * hard-coding a screen per agent.
 */
export type AgentFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'boolean'
  | 'date'
  | 'email'
  | 'url'
  | 'password'
  | 'file'
  | 'tags'

export interface AgentFieldOption {
  value: string
  label: string
}

export interface AgentField {
  name: string
  label: string
  type: AgentFieldType
  required: boolean
  /** Never returned to the client once saved; write-only. */
  secret: boolean
  placeholder?: string
  help?: string
  default?: unknown
  options?: AgentFieldOption[]
  rows?: number
  min?: number
  max?: number
  /** File input filter, e.g. '.xlsx' or '.json'. */
  accept?: string
  max_length?: number
}

/** Answers to an agent's launch form, keyed by field name. */
export type AgentInputValues = Record<string, unknown>

export interface AgentConfigState {
  agent_id: number
  agent_name: string
  schema: AgentField[]
  /** Non-secret answers only. */
  values: Record<string, unknown>
  /** Names of secret fields that hold a value - never the values themselves. */
  secrets_set: string[]
  configured: boolean
  updated_at: string | null
}

export interface Agent {
  id: number
  name: string
  description: string | null
  module: string | null
  sub_module: string | null
  role: string | null
  model: string
  temperature: number
  max_tokens: number
  system_prompt: string | null
  tools: string[]
  status: AgentStatus

  origin: AgentOrigin
  /** False for platform catalogue rows — the server refuses writes to them. */
  editable: boolean
  slug: string | null
  /** lucide icon name for the card. */
  icon: string | null
  function_text: string | null
  workflow: string[]
  outputs: string[]
  cta_label: string | null
  cta_link: string | null
  cta_target: 'internal' | 'external'

  execution_mode: ExecutionMode
  endpoint_url: string | null
  endpoint_method: string
  /** Headers are never returned — they hold API keys. This says whether any are set. */
  has_endpoint_headers: boolean

  /** Fields asked on every run. Empty means a single free-text input. */
  input_schema: AgentField[]
  /** Fields asked once and saved per organisation (credentials, sheet ids). */
  config_schema: AgentField[]
  /** Names a bespoke launch screen; null renders the generic form. */
  launch_component: string | null
  /** False when this agent needs setup this organisation has not done. */
  configured: boolean
  total_runs: number
  /** null when the agent has never run — not 0%, which would read as failure. */
  success_rate: number | null
  last_run_at: string | null
  created_at: string | null
  updated_at: string | null
}

/** A run summary as shown on the agent detail panel. */
export interface AgentRecentRun {
  id: number
  status: string
  input: string | null
  output: string | null
  duration_ms: number | null
  tokens_used: number | null
  cost: number | null
  created_at: string | null
}

export interface AgentToolInvocationSummary {
  id: number
  tool: string
  status: string
  created_at: string | null
}

export interface AgentDetail extends Agent {
  recent_runs: AgentRecentRun[]
  tool_invocations: AgentToolInvocationSummary[]
}

/** One entry of the tool catalogue the create wizard offers. */
export interface AgentToolOption {
  id: string
  label: string
  description: string
}

export interface AgentMeta {
  tools: AgentToolOption[]
  models: string[]
  modules: string[]
  statuses: AgentStatus[]
  counts: {
    total: number
    draft: number
    deployed: number
    paused: number
    archived: number
    /** Shared catalogue agents, visible to every tenant. */
    platform: number
    /** Agents this tenant created. */
    tenant: number
  }
}

export interface AgentListParams {
  search?: string
  status?: string
  module?: string
  /** 'platform' | 'tenant' — narrows the library to one kind. */
  origin?: string
  /** Only agents with this tool enabled. */
  tool?: string
  sort?: 'name' | 'status' | 'module' | 'created_at' | 'updated_at'
  direction?: 'asc' | 'desc'
  page?: number
  per_page?: number
}

export interface AgentPayload {
  name?: string
  description?: string
  module?: string
  sub_module?: string
  role?: string
  model?: string
  temperature?: number
  max_tokens?: number
  system_prompt?: string
  tools?: string[]
  status?: AgentStatus

  icon?: string
  function_text?: string
  workflow?: string[]
  outputs?: string[]
  cta_label?: string
  cta_link?: string
  cta_target?: 'internal' | 'external'

  execution_mode?: ExecutionMode
  endpoint_url?: string
  endpoint_method?: string
  /** Write-only: set here, never read back. */
  endpoint_headers?: Record<string, string>
  endpoint_timeout?: number
}

const BASE = '/agentic/agents'

/** Drop blanks so an unset filter never reaches the query string. */
export function toStringParams(input: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue
    const normalized = String(value).trim()
    if (normalized === '') continue
    out[key] = normalized
  }
  return out
}

export const agentService = {
  meta: (context: LaravelContext) =>
    apiClient.get<AgenticApiResponse<AgentMeta>>(`${BASE}/meta`, withLaravelParams(context)),

  list: (context: LaravelContext, params?: AgentListParams) =>
    apiClient.get<AgenticListResponse<Agent[]>>(
      BASE,
      withLaravelParams(context, toStringParams({ ...params })),
    ),

  get: (context: LaravelContext, id: number) =>
    apiClient.get<AgenticApiResponse<AgentDetail>>(`${BASE}/${id}`, withLaravelParams(context)),

  create: (context: LaravelContext, payload: AgentPayload) =>
    apiClient.post<AgenticApiResponse<{ id: number }>>(BASE, {
      ...withLaravelParams(context),
      ...payload,
    }),

  update: (context: LaravelContext, id: number, payload: AgentPayload) =>
    apiClient.put<AgenticApiResponse<{ id: number }>>(`${BASE}/${id}`, {
      ...withLaravelParams(context),
      ...payload,
    }),

  /**
   * Deploy / pause / archive. Deploying an agent with no system prompt is
   * refused server side — it would accept runs with no instructions.
   */
  setStatus: (context: LaravelContext, id: number, status: AgentStatus) =>
    apiClient.patch<AgenticApiResponse<{ id: number; status: AgentStatus }>>(`${BASE}/${id}/status`, {
      ...withLaravelParams(context),
      status,
    }),

  clone: (context: LaravelContext, id: number, name?: string) =>
    apiClient.post<AgenticApiResponse<{ id: number; name: string }>>(`${BASE}/${id}/clone`, {
      ...withLaravelParams(context),
      ...(name ? { name } : {}),
    }),

  remove: (context: LaravelContext, id: number) =>
    apiClient.delete<AgenticApiResponse<{ id: number }>>(`${BASE}/${id}`, withLaravelParams(context)),

  /** This organisation's saved setup for an agent — secrets reported as set, never returned. */
  getConfig: (context: LaravelContext, id: number) =>
    apiClient.get<AgenticApiResponse<AgentConfigState>>(`${BASE}/${id}/config`, withLaravelParams(context)),

  /**
   * Saves setup. Sent as multipart because config schemas can include a key
   * file; a blank secret means "keep the stored one" so an unrelated edit
   * never wipes a credential the user cannot retype.
   */
  saveConfig: (context: LaravelContext, id: number, values: Record<string, unknown>, files?: Record<string, File>) => {
    const form = new FormData()

    for (const [key, value] of Object.entries(withLaravelParams(context))) {
      form.append(key, String(value))
    }

    for (const [key, value] of Object.entries(values)) {
      if (value === undefined || value === null) continue
      form.append(key, Array.isArray(value) ? value.join(',') : String(value))
    }

    for (const [key, file] of Object.entries(files ?? {})) {
      form.append(key, file)
    }

    return apiClient.postForm<AgenticApiResponse<{ agent_id: number; configured: boolean }>>(
      `${BASE}/${id}/config`,
      form,
    )
  },

  clearConfig: (context: LaravelContext, id: number) =>
    apiClient.delete<AgenticApiResponse<{ agent_id: number }>>(`${BASE}/${id}/config`, withLaravelParams(context)),
}
