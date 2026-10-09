/**
 * CRM Service — Leads, Contacts, Organizations, Campaigns.
 *
 * One explicit function per endpoint, `taskService`-style: no generic
 * wrapper/hook abstraction, manual `LaravelContext` param passing, tenant
 * scope is `sub_institute_id` only (no `syear` - these entities aren't
 * academic-year-bound).
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import type {
  ConvertLeadPayload,
  ConvertLeadResponse,
  CrmPicklistMap,
  Lead,
  LeadListQuery,
  LeadListResponse,
  LeadPayload,
  LeadResponse,
} from '@/types/crm'

function baseParams(context: LaravelContext): Record<string, string> {
  return { token: context.token, sub_institute_id: context.subInstituteId }
}

export const crmService = {
  getPicklistValues: (context: LaravelContext, module?: string) =>
    apiClient.get<{ status: number; message: string; data: CrmPicklistMap }>('/crm/picklist-values', {
      ...baseParams(context),
      ...(module ? { module } : {}),
    }),

  // ── Leads ──────────────────────────────────────────────────────────
  getLeads: (context: LaravelContext, query: LeadListQuery = {}) =>
    apiClient.get<LeadListResponse>('/crm/leads', {
      ...baseParams(context),
      ...(query.page ? { page: String(query.page) } : {}),
      ...(query.perPage ? { per_page: String(query.perPage) } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.sortBy ? { sort_by: query.sortBy } : {}),
      ...(query.sortDir ? { sort_dir: query.sortDir } : {}),
      ...(query.leadStatus ? { lead_status: query.leadStatus } : {}),
      ...(query.assignedTo ? { assigned_to: query.assignedTo } : {}),
    }),

  getLead: (context: LaravelContext, id: string) =>
    apiClient.get<LeadResponse>(`/crm/leads/${id}`, baseParams(context)),

  createLead: (context: LaravelContext, payload: LeadPayload) =>
    apiClient.post<LeadResponse>('/crm/leads', { ...payload, ...baseParams(context) }),

  updateLead: (context: LaravelContext, id: string, payload: LeadPayload) =>
    apiClient.put<LeadResponse>(`/crm/leads/${id}`, { ...payload, ...baseParams(context) }),

  deleteLead: (context: LaravelContext, id: string) =>
    apiClient.delete<{ status: number; message: string }>(`/crm/leads/${id}`, baseParams(context)),

  convertLead: (context: LaravelContext, id: string, payload: ConvertLeadPayload) =>
    apiClient.post<ConvertLeadResponse>(`/crm/leads/${id}/convert`, { ...payload, ...baseParams(context) }),
}

export type { Lead }
