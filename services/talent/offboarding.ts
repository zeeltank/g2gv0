/**
 * Offboarding Center Service
 * Backed by the Laravel /api/offboarding/* endpoints.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

export interface OffbResponse<T> {
  status: number
  message: string
  data: T
}

export interface OffbPagination {
  page: number
  per_page: number
  total: number
  last_page: number
}

export interface OffbListResponse<T> extends OffbResponse<T> {
  pagination: OffbPagination
}

export interface ClearanceTask {
  id: string
  department: string
  item: string
  status: 'Pending' | 'Cleared' | 'N/A'
}

export interface DocumentItem {
  id: string
  title: string
  fileName: string | null
  status: 'Pending' | 'Submitted' | 'Verified' | 'Rejected'
  isMandatory: boolean
}

export interface CaseComment {
  id: string
  comment: string
  timestamp: string
  author: string
  initials: string
}

export interface ActivityLogItem {
  id: string
  action: string
  description: string
  timestamp: string
  actor: string
}

export interface ExitCase {
  id: string
  caseId: string
  employee: {
    name: string
    id: string
    initials: string
    title: string
    manager: string
    manager_id?: string | null
    doj: string
    email?: string
    location?: string
  }
  department: string
  department_id?: string | null
  location: string
  exitReason: string
  exitType: 'voluntary' | 'involuntary'
  status: 'Resignation Submitted' | 'Notice Period' | 'Clearance' | 'Exit Interview' | 'Awaiting F&F' | 'Closed'
  owner: string
  updatedOn: string
  noticeDate?: string | null
  lastWorkingDay: string
  clearance_tasks?: ClearanceTask[]
  documents?: DocumentItem[]
  comments?: CaseComment[]
  activity_log?: ActivityLogItem[]
  exit_interview_done?: boolean
  exit_interview_date?: string | null
  exit_interview_notes?: string
}

export interface OffbKPI {
  id: string
  title: string
  value: string
  subtitle: string
  icon: 'door-open' | 'log-out' | 'calendar' | 'shield' | 'users' | 'check-circle'
}

export interface OffbOverview {
  kpis: OffbKPI[]
  totals: {
    total_exits: number
    resignations: number
    notice_period: number
    clearance_pending: number
    exit_interviews: number
    closed: number
  }
}

export interface OffbFilterOption {
  value: string
  label: string
}

export interface EmployeeOption extends OffbFilterOption {
  employee_no: string | null
  department_id: string | null
  joined_date: string | null
}

export interface OffbFilterOptions {
  departments: OffbFilterOption[]
  employees: EmployeeOption[]
  reasons: OffbFilterOption[]
  exit_types: OffbFilterOption[]
  owners: OffbFilterOption[]
}

export interface CaseFilters {
  department_id?: string
  status?: string
  exit_reason?: string
  exit_type?: string
  search?: string
  page?: number
  per_page?: number
  sort_by?: string
  sort_dir?: string
}

export interface CasePayload {
  employee_id: number
  exit_type: 'voluntary' | 'involuntary'
  exit_reason: string
  notice_date: string
  last_working_day: string
  manager_id?: number
  location?: string
}

function params(context: LaravelContext, extra?: Record<string, string | number | undefined>) {
  const query: Record<string, string> = {}
  Object.entries(withLaravelParams(context)).forEach(([k, v]) => {
    if (v !== undefined && v !== null) {
      query[k] = String(v)
    }
  })
  if (extra) {
    Object.entries(extra).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        query[k] = String(v)
      }
    })
  }
  return query
}

function queryOf(filters?: CaseFilters): Record<string, string | number | undefined> {
  const query: Record<string, string | number | undefined> = {}
  if (!filters) return query
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query[key] = value
    }
  })
  return query
}

export const offboardingService = {
  getOverview(context: LaravelContext, departmentId?: string) {
    return apiClient.get<OffbResponse<OffbOverview>>(
      '/offboarding/overview',
      params(context, { department_id: departmentId })
    )
  },

  getFilters(context: LaravelContext) {
    return apiClient.get<OffbResponse<OffbFilterOptions>>('/offboarding/filters', params(context))
  },

  getCases(context: LaravelContext, filters?: CaseFilters) {
    return apiClient.get<OffbListResponse<ExitCase[]>>(
      '/offboarding/cases',
      params(context, queryOf(filters))
    )
  },

  getCase(context: LaravelContext, id: string) {
    return apiClient.get<OffbResponse<ExitCase>>(`/offboarding/cases/${id}`, params(context))
  },

  createCase(context: LaravelContext, payload: CasePayload) {
    return apiClient.post<OffbResponse<{ id: number }>>('/offboarding/cases', {
      ...payload,
      ...params(context)
    })
  },

  updateCase(context: LaravelContext, id: string, payload: Partial<CasePayload> & { status?: string }) {
    return apiClient.put<OffbResponse<ExitCase>>(`/offboarding/cases/${id}`, {
      ...payload,
      ...params(context)
    })
  },

  updateStatus(context: LaravelContext, id: string, status: string) {
    return apiClient.post<OffbResponse<ExitCase>>(`/offboarding/cases/${id}/status`, {
      status,
      ...params(context)
    })
  },

  updateClearance(context: LaravelContext, id: string, tasks: ClearanceTask[]) {
    return apiClient.post<OffbResponse<ClearanceTask[]>>(`/offboarding/cases/${id}/clearance`, {
      tasks,
      ...params(context)
    })
  },

  updateDocuments(context: LaravelContext, id: string, documents: DocumentItem[]) {
    return apiClient.post<OffbResponse<DocumentItem[]>>(`/offboarding/cases/${id}/documents`, {
      documents,
      ...params(context)
    })
  },

  addComment(context: LaravelContext, id: string, comment: string) {
    return apiClient.post<OffbResponse<CaseComment[]>>(`/offboarding/cases/${id}/comments`, {
      comment,
      ...params(context)
    })
  },

  updateExitInterview(context: LaravelContext, id: string, payload: { exit_interview_done: boolean; exit_interview_date?: string | null; exit_interview_notes?: string }) {
    return apiClient.post<OffbResponse<ExitCase>>(`/offboarding/cases/${id}/exit-interview`, {
      ...payload,
      ...params(context)
    })
  },

  withdrawCase(context: LaravelContext, id: string) {
    return apiClient.delete<OffbResponse<{ id: number }>>(`/offboarding/cases/${id}`, params(context))
  }
}
