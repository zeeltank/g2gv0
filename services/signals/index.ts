/**
 * AI Signals service — the Laravel /api/signals endpoints.
 *
 * Tenant identity is decided server-side from the token; `sub_institute_id` is sent
 * only because the rest of this client does, and the server ignores it.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'

export type SignalPriority = 'High' | 'Medium' | 'Low'
export type SignalStatus = 'New' | 'Reviewed' | 'Dismissed'

export interface SignalEvidence {
  department_id: number | null
  metric: string
  value: number
}

export interface SignalSource {
  title: string
  url: string
  retrieved_at: string
}

export interface Signal {
  id: number
  title: string
  summary: string
  signal_type: string
  signal_type_label: string
  priority: SignalPriority
  status: SignalStatus
  department_id: number | null
  department_name: string | null
  why_it_matters: string
  recommended_action: string
  origin: 'internal' | 'external' | 'mixed'
  generated_at: string
  reviewed_at: string | null
  // Present on the detail response only.
  explanation?: string
  evidence?: SignalEvidence[]
  sources?: SignalSource[]
}

export interface SignalSummary {
  total: number
  new: number
  high_priority: number
  reviewed: number
}

export interface SignalListResponse {
  status: number
  data: Signal[]
  meta: { page: number; per_page: number; total: number; last_page: number }
  summary: SignalSummary
  filters: {
    types: { value: string; label: string }[]
    departments: { id: number; name: string }[]
  }
}

export interface SignalRunInfo {
  id: number
  trigger: 'scheduled' | 'manual'
  status: 'running' | 'success' | 'partial' | 'failed' | 'skipped'
  started_at: string | null
  completed_at: string | null
  duration_ms: number | null
  signals_generated: number
  signals_duplicate: number
  signals_rejected: number
  error_code: string | null
  error_message: string | null
}

export interface SignalStatusResponse {
  status: number
  data: {
    ai_configured: boolean
    running: boolean
    last_generated_at: string | null
    latest_run: SignalRunInfo | null
    schedule: { enabled: boolean; time: string; timezone: string }
  }
}

export interface SignalQuery {
  departmentId?: string
  type?: string
  priority?: string
  status?: string
  search?: string
  from?: string
  to?: string
  page?: number
  perPage?: number
}

function base(context: LaravelContext): Record<string, string> {
  return {
    sub_institute_id: context.subInstituteId,
    ...(context.token ? { type: 'api', token: context.token } : {}),
  }
}

function qs(context: LaravelContext) {
  return new URLSearchParams(base(context)).toString()
}

export const signalsService = {
  list: (context: LaravelContext, query: SignalQuery = {}) => {
    const params: Record<string, string> = { ...base(context) }
    if (query.departmentId) params.department_id = query.departmentId
    if (query.type) params.type = query.type
    if (query.priority) params.priority = query.priority
    if (query.status) params.status = query.status
    if (query.search) params.search = query.search
    if (query.from) params.from = query.from
    if (query.to) params.to = query.to
    params.page = String(query.page ?? 1)
    params.per_page = String(query.perPage ?? 10)
    return apiClient.get<SignalListResponse>('/signals', params)
  },

  get: (context: LaravelContext, id: number) =>
    apiClient.get<{ status: number; data: Signal }>(`/signals/${id}`, base(context)),

  review: (context: LaravelContext, id: number) =>
    apiClient.patch<{ status: number; data: Signal }>(`/signals/${id}/review?${qs(context)}`, {}),

  dismiss: (context: LaravelContext, id: number) =>
    apiClient.patch<{ status: number; data: Signal }>(`/signals/${id}/dismiss?${qs(context)}`, {}),

  generate: (context: LaravelContext) =>
    apiClient.post<{ status: number; message: string }>(`/signals/generate?${qs(context)}`, {}),

  getStatus: (context: LaravelContext) =>
    apiClient.get<SignalStatusResponse>('/signals/status', base(context)),

  getRuns: (context: LaravelContext) =>
    apiClient.get<{ status: number; data: SignalRunInfo[] }>('/signals/runs', base(context)),
}

export * from './opportunities'
