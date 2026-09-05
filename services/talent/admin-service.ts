import { apiClient as api } from '@/services/core/api-client'
import { getLaravelContext, withLaravelParams } from '@/lib/laravel-context'
import type { Workflow } from '@/components/domain/talent/administration/admin-data'

/**
 * Real counts for the Administration headline tiles.
 *
 * The screen used to render five hardcoded numbers above a live table. Four of
 * them now come from the server; the fifth, "Integrations", had no table, no
 * route and no concept behind it anywhere, so the tile is gone rather than made
 * up.
 */
export interface AdminSummary {
  active_workflows: number
  templates: number
  user_roles: number
  audit_events_30d: number
}

export interface AdminWorkflowsResponse {
  status: number
  message: string
  data: Omit<Workflow, 'stages' | 'approvers'>[]
  summary?: AdminSummary
  pagination: {
    total: number
    per_page: number
    current_page: number
    last_page: number
  }
}

export interface AdminWorkflowDetailResponse {
  status: number
  message: string
  data: Workflow
}

export const AdminService = {
  getWorkflows: async (params?: { page?: number; module?: string; search?: string }): Promise<AdminWorkflowsResponse> => {
    const context = getLaravelContext()
    return api.get('/talent/admin/workflows', withLaravelParams(context, params as Record<string, string> | undefined))
  },
  
  getWorkflowById: async (id: string): Promise<AdminWorkflowDetailResponse> => {
    const context = getLaravelContext()
    return api.get(`/talent/admin/workflows/${id}`, withLaravelParams(context))
  },

  /**
   * The audit trail, read straight from the event store.
   *
   * Not a separate log table: `g2g_event` is written in the same transaction as
   * the change it describes and has no update or delete path, so it cannot drift
   * from what actually happened.
   */
  getAuditLogs: async (params?: { page?: number; per_page?: number; type?: string; entity_type?: string; search?: string }): Promise<AdminAuditLogsResponse> => {
    const context = getLaravelContext()
    return api.get('/talent/admin/audit-logs', withLaravelParams(context, params as Record<string, string> | undefined))
  },
}

export interface AdminAuditEvent {
  id: number
  type: string
  entity_type: string | null
  entity_id: number | null
  /** 'System' when no person did it - a real value, not "unknown". */
  actor: string
  occurred_at: string
  payload: Record<string, unknown> | null
}

export interface AdminAuditLogsResponse {
  status: number
  data: AdminAuditEvent[]
  pagination?: { page: number; per_page: number; total: number; last_page: number }
  types?: string[]
  entity_types?: string[]
}
