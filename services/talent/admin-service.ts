import { apiClient as api } from '@/services/core/api-client'
import { getLaravelContext, withLaravelParams } from '@/lib/laravel-context'
import type { Workflow } from '@/components/domain/talent/administration/admin-data'

export interface AdminWorkflowsResponse {
  status: number
  message: string
  data: Omit<Workflow, 'stages' | 'approvers'>[]
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
  }
}
