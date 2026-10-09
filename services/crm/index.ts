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
  ContactListQuery,
  ContactListResponse,
  ContactPayload,
  ContactResponse,
  ConvertLeadPayload,
  ConvertLeadResponse,
  CrmPicklistMap,
  Lead,
  LeadListQuery,
  LeadListResponse,
  LeadPayload,
  LeadResponse,
  OrganizationHierarchyResponse,
  OrganizationListQuery,
  OrganizationListResponse,
  OrganizationPayload,
  OrganizationResponse,
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

  // ── Organizations ──────────────────────────────────────────────────
  getOrganizations: (context: LaravelContext, query: OrganizationListQuery = {}) =>
    apiClient.get<OrganizationListResponse>('/crm/organizations', {
      ...baseParams(context),
      ...(query.page ? { page: String(query.page) } : {}),
      ...(query.perPage ? { per_page: String(query.perPage) } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.sortBy ? { sort_by: query.sortBy } : {}),
      ...(query.sortDir ? { sort_dir: query.sortDir } : {}),
      ...(query.accountType ? { account_type: query.accountType } : {}),
    }),

  getOrganization: (context: LaravelContext, id: string) =>
    apiClient.get<OrganizationResponse>(`/crm/organizations/${id}`, baseParams(context)),

  getOrganizationHierarchy: (context: LaravelContext, id: string) =>
    apiClient.get<OrganizationHierarchyResponse>(`/crm/organizations/${id}/hierarchy`, baseParams(context)),

  createOrganization: (context: LaravelContext, payload: OrganizationPayload) =>
    apiClient.post<OrganizationResponse>('/crm/organizations', { ...payload, ...baseParams(context) }),

  updateOrganization: (context: LaravelContext, id: string, payload: OrganizationPayload) =>
    apiClient.put<OrganizationResponse>(`/crm/organizations/${id}`, { ...payload, ...baseParams(context) }),

  deleteOrganization: (context: LaravelContext, id: string) =>
    apiClient.delete<{ status: number; message: string }>(`/crm/organizations/${id}`, baseParams(context)),

  transferOrganizationOwnership: (context: LaravelContext, id: string, assignedTo: string, cascadeToContacts: boolean) =>
    apiClient.post<{ status: number; message: string }>(`/crm/organizations/${id}/transfer-ownership`, {
      assignedTo, cascadeToContacts, ...baseParams(context),
    }),

  // ── Contacts ────────────────────────────────────────────────────────
  getContacts: (context: LaravelContext, query: ContactListQuery = {}) =>
    apiClient.get<ContactListResponse>('/crm/contacts', {
      ...baseParams(context),
      ...(query.page ? { page: String(query.page) } : {}),
      ...(query.perPage ? { per_page: String(query.perPage) } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.sortBy ? { sort_by: query.sortBy } : {}),
      ...(query.sortDir ? { sort_dir: query.sortDir } : {}),
      ...(query.organizationId ? { organization_id: query.organizationId } : {}),
    }),

  getContact: (context: LaravelContext, id: string) =>
    apiClient.get<ContactResponse>(`/crm/contacts/${id}`, baseParams(context)),

  createContact: (context: LaravelContext, payload: ContactPayload) =>
    apiClient.post<ContactResponse>('/crm/contacts', { ...payload, ...baseParams(context) }),

  updateContact: (context: LaravelContext, id: string, payload: ContactPayload) =>
    apiClient.put<ContactResponse>(`/crm/contacts/${id}`, { ...payload, ...baseParams(context) }),

  deleteContact: (context: LaravelContext, id: string) =>
    apiClient.delete<{ status: number; message: string }>(`/crm/contacts/${id}`, baseParams(context)),

  transferContactOwnership: (context: LaravelContext, id: string, assignedTo: string) =>
    apiClient.post<{ status: number; message: string }>(`/crm/contacts/${id}/transfer-ownership`, {
      assignedTo, ...baseParams(context),
    }),
}

export type { Lead }
