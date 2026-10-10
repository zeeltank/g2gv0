/**
 * CRM Service — Leads, Contacts, Organizations, Campaigns.
 *
 * One explicit function per endpoint, `taskService`-style: no generic
 * wrapper/hook abstraction, manual `LaravelContext` param passing, tenant
 * scope is `sub_institute_id` only (no `syear` - these entities aren't
 * academic-year-bound).
 */

import { apiClient, buildApiUrl } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import type {
  CampaignListQuery,
  CampaignListResponse,
  CampaignPayload,
  CampaignResponse,
  CampaignTargetsResponse,
  ContactListQuery,
  ContactListResponse,
  ContactPayload,
  ContactResponse,
  ConvertLeadPayload,
  ConvertLeadResponse,
  CrmBulkActionResponse,
  CrmDuplicateGroupsResponse,
  CrmImportResponse,
  CrmItemType,
  CrmMergeResponse,
  CrmModule,
  CrmOpportunityContactsResponse,
  CrmOpportunityListQuery,
  CrmOpportunityListResponse,
  CrmOpportunityPayload,
  CrmOpportunityPipelineResponse,
  CrmOpportunityProductsResponse,
  CrmOpportunityResponse,
  CrmOpportunityStageChangePayload,
  CrmOpportunityStageHistoryResponse,
  CrmPicklistAdminResponse,
  CrmPicklistMap,
  CrmPicklistValueResponse,
  CrmProductListQuery,
  CrmProductListResponse,
  CrmProductPayload,
  CrmProductResponse,
  CrmQuoteLineItemInput,
  CrmQuoteLineItemsResponse,
  CrmQuoteListQuery,
  CrmQuoteListResponse,
  CrmQuotePayload,
  CrmQuoteResponse,
  CrmRecycleBinListResponse,
  CrmRecycleBinType,
  CrmSavedViewListResponse,
  CrmSavedViewResponse,
  CrmSendSmsPayload,
  CrmSendSmsResponse,
  CrmSmsLogListResponse,
  CrmTaxRateListResponse,
  CrmTaxRatePayload,
  CrmTaxRateResponse,
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

  getPicklistAdmin: (context: LaravelContext) =>
    apiClient.get<CrmPicklistAdminResponse>('/crm/picklist-values/admin', baseParams(context)),

  createPicklistValue: (context: LaravelContext, payload: {
    module: CrmModule; fieldKey: string; value: string; label: string; sortOrder?: number; isDefault?: boolean
  }) =>
    apiClient.post<CrmPicklistValueResponse>('/crm/picklist-values', { ...payload, ...baseParams(context) }),

  updatePicklistValue: (context: LaravelContext, id: string, payload: Partial<{
    label: string; sortOrder: number; isDefault: boolean; status: boolean
  }>) =>
    apiClient.put<CrmPicklistValueResponse>(`/crm/picklist-values/${id}`, { ...payload, ...baseParams(context) }),

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

  bulkDeleteLeads: (context: LaravelContext, ids: string[]) =>
    apiClient.post<CrmBulkActionResponse>('/crm/leads/bulk/delete', { ids: ids.map(Number), ...baseParams(context) }),

  bulkAssignLeads: (context: LaravelContext, ids: string[], assignedTo: string) =>
    apiClient.post<CrmBulkActionResponse>('/crm/leads/bulk/assign', {
      ids: ids.map(Number), assignedTo, ...baseParams(context),
    }),

  getLeadDuplicates: (context: LaravelContext) =>
    apiClient.get<CrmDuplicateGroupsResponse>('/crm/leads/duplicates', baseParams(context)),

  mergeLeads: (context: LaravelContext, survivorId: string, duplicateIds: string[]) =>
    apiClient.post<CrmMergeResponse>('/crm/leads/merge', {
      survivorId: Number(survivorId), duplicateIds: duplicateIds.map(Number), ...baseParams(context),
    }),

  leadsExportUrl: (context: LaravelContext, search?: string) =>
    buildApiUrl('/crm/leads/export', { ...baseParams(context), ...(search ? { search } : {}) }),

  importLeads: (context: LaravelContext, rows: Record<string, unknown>[]) =>
    apiClient.post<CrmImportResponse>('/crm/leads/import', { rows, ...baseParams(context) }),

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

  bulkDeleteOrganizations: (context: LaravelContext, ids: string[]) =>
    apiClient.post<CrmBulkActionResponse>('/crm/organizations/bulk/delete', { ids: ids.map(Number), ...baseParams(context) }),

  bulkAssignOrganizations: (context: LaravelContext, ids: string[], assignedTo: string, cascadeToContacts = false) =>
    apiClient.post<CrmBulkActionResponse>('/crm/organizations/bulk/assign', {
      ids: ids.map(Number), assignedTo, cascadeToContacts, ...baseParams(context),
    }),

  getOrganizationDuplicates: (context: LaravelContext) =>
    apiClient.get<CrmDuplicateGroupsResponse>('/crm/organizations/duplicates', baseParams(context)),

  mergeOrganizations: (context: LaravelContext, survivorId: string, duplicateIds: string[]) =>
    apiClient.post<CrmMergeResponse>('/crm/organizations/merge', {
      survivorId: Number(survivorId), duplicateIds: duplicateIds.map(Number), ...baseParams(context),
    }),

  organizationsExportUrl: (context: LaravelContext, search?: string) =>
    buildApiUrl('/crm/organizations/export', { ...baseParams(context), ...(search ? { search } : {}) }),

  importOrganizations: (context: LaravelContext, rows: Record<string, unknown>[]) =>
    apiClient.post<CrmImportResponse>('/crm/organizations/import', { rows, ...baseParams(context) }),

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

  bulkDeleteContacts: (context: LaravelContext, ids: string[]) =>
    apiClient.post<CrmBulkActionResponse>('/crm/contacts/bulk/delete', { ids: ids.map(Number), ...baseParams(context) }),

  bulkAssignContacts: (context: LaravelContext, ids: string[], assignedTo: string) =>
    apiClient.post<CrmBulkActionResponse>('/crm/contacts/bulk/assign', {
      ids: ids.map(Number), assignedTo, ...baseParams(context),
    }),

  getContactDuplicates: (context: LaravelContext) =>
    apiClient.get<CrmDuplicateGroupsResponse>('/crm/contacts/duplicates', baseParams(context)),

  mergeContacts: (context: LaravelContext, survivorId: string, duplicateIds: string[]) =>
    apiClient.post<CrmMergeResponse>('/crm/contacts/merge', {
      survivorId: Number(survivorId), duplicateIds: duplicateIds.map(Number), ...baseParams(context),
    }),

  contactsExportUrl: (context: LaravelContext, search?: string) =>
    buildApiUrl('/crm/contacts/export', { ...baseParams(context), ...(search ? { search } : {}) }),

  importContacts: (context: LaravelContext, rows: Record<string, unknown>[]) =>
    apiClient.post<CrmImportResponse>('/crm/contacts/import', { rows, ...baseParams(context) }),

  // ── Campaigns ───────────────────────────────────────────────────────
  getCampaigns: (context: LaravelContext, query: CampaignListQuery = {}) =>
    apiClient.get<CampaignListResponse>('/crm/campaigns', {
      ...baseParams(context),
      ...(query.page ? { page: String(query.page) } : {}),
      ...(query.perPage ? { per_page: String(query.perPage) } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.sortBy ? { sort_by: query.sortBy } : {}),
      ...(query.sortDir ? { sort_dir: query.sortDir } : {}),
      ...(query.campaignStatus ? { campaign_status: query.campaignStatus } : {}),
    }),

  getCampaign: (context: LaravelContext, id: string) =>
    apiClient.get<CampaignResponse>(`/crm/campaigns/${id}`, baseParams(context)),

  createCampaign: (context: LaravelContext, payload: CampaignPayload) =>
    apiClient.post<CampaignResponse>('/crm/campaigns', { ...payload, ...baseParams(context) }),

  updateCampaign: (context: LaravelContext, id: string, payload: CampaignPayload) =>
    apiClient.put<CampaignResponse>(`/crm/campaigns/${id}`, { ...payload, ...baseParams(context) }),

  deleteCampaign: (context: LaravelContext, id: string) =>
    apiClient.delete<{ status: number; message: string }>(`/crm/campaigns/${id}`, baseParams(context)),

  getCampaignTargets: (context: LaravelContext, id: string) =>
    apiClient.get<CampaignTargetsResponse>(`/crm/campaigns/${id}/targets`, baseParams(context)),

  addCampaignTarget: (context: LaravelContext, id: string, targetType: 'lead' | 'contact' | 'organization', targetId: string) =>
    apiClient.post<{ status: number; message: string }>(`/crm/campaigns/${id}/targets`, {
      targetType, targetId, ...baseParams(context),
    }),

  bulkAddCampaignTargets: (
    context: LaravelContext, id: string, targetType: 'lead' | 'contact' | 'organization',
    criteria: { search: string } | { savedViewId: string },
  ) =>
    apiClient.post<{ status: number; message: string }>(`/crm/campaigns/${id}/targets/bulk`, {
      targetType, ...criteria, ...baseParams(context),
    }),

  removeCampaignTarget: (context: LaravelContext, id: string, targetRowId: string) =>
    apiClient.delete<{ status: number; message: string }>(`/crm/campaigns/${id}/targets/${targetRowId}`, baseParams(context)),

  updateCampaignTargetStatus: (context: LaravelContext, id: string, targetRowId: string, responseStatus: string) =>
    apiClient.put<{ status: number; message: string }>(`/crm/campaigns/${id}/targets/${targetRowId}`, {
      responseStatus, ...baseParams(context),
    }),

  bulkDeleteCampaigns: (context: LaravelContext, ids: string[]) =>
    apiClient.post<CrmBulkActionResponse>('/crm/campaigns/bulk/delete', { ids: ids.map(Number), ...baseParams(context) }),

  bulkAssignCampaigns: (context: LaravelContext, ids: string[], assignedTo: string) =>
    apiClient.post<CrmBulkActionResponse>('/crm/campaigns/bulk/assign', {
      ids: ids.map(Number), assignedTo, ...baseParams(context),
    }),

  campaignsExportUrl: (context: LaravelContext, search?: string) =>
    buildApiUrl('/crm/campaigns/export', { ...baseParams(context), ...(search ? { search } : {}) }),

  importCampaigns: (context: LaravelContext, rows: Record<string, unknown>[]) =>
    apiClient.post<CrmImportResponse>('/crm/campaigns/import', { rows, ...baseParams(context) }),

  // ── Recycle Bin (shared across all 4 modules) ──────────────────────
  getRecycleBin: (context: LaravelContext, query: { page?: number; perPage?: number } = {}) =>
    apiClient.get<CrmRecycleBinListResponse>('/crm/recycle-bin', {
      ...baseParams(context),
      ...(query.page ? { page: String(query.page) } : {}),
      ...(query.perPage ? { per_page: String(query.perPage) } : {}),
    }),

  restoreRecycleBinItem: (context: LaravelContext, type: CrmRecycleBinType, id: string) =>
    apiClient.post<{ status: number; message: string }>(`/crm/recycle-bin/${type}/${id}/restore`, baseParams(context)),

  forceDeleteRecycleBinItem: (context: LaravelContext, type: CrmRecycleBinType, id: string) =>
    apiClient.delete<{ status: number; message: string }>(`/crm/recycle-bin/${type}/${id}`, baseParams(context)),

  // ── Saved Views (shared across all 4 modules) ──────────────────────
  getSavedViews: (context: LaravelContext, module: CrmModule) =>
    apiClient.get<CrmSavedViewListResponse>('/crm/saved-views', { ...baseParams(context), module }),

  createSavedView: (context: LaravelContext, module: CrmModule, name: string, conditions: Record<string, unknown>) =>
    apiClient.post<CrmSavedViewResponse>('/crm/saved-views', { module, name, conditions, ...baseParams(context) }),

  deleteSavedView: (context: LaravelContext, id: string) =>
    apiClient.delete<{ status: number; message: string }>(`/crm/saved-views/${id}`, baseParams(context)),

  // ── Tax Rates (shared by Products and Quote line items) ────────────
  getTaxRates: (context: LaravelContext) =>
    apiClient.get<CrmTaxRateListResponse>('/crm/tax-rates', baseParams(context)),

  /** Every rate, active or not - the admin screen needs the inactive ones too, to let them be reactivated. Gated on the Quotes right server-side. */
  getTaxRatesAdmin: (context: LaravelContext) =>
    apiClient.get<CrmTaxRateListResponse>('/crm/tax-rates/admin', baseParams(context)),

  createTaxRate: (context: LaravelContext, payload: CrmTaxRatePayload) =>
    apiClient.post<CrmTaxRateResponse>('/crm/tax-rates', { ...payload, ...baseParams(context) }),

  updateTaxRate: (context: LaravelContext, id: string, payload: CrmTaxRatePayload) =>
    apiClient.put<CrmTaxRateResponse>(`/crm/tax-rates/${id}`, { ...payload, ...baseParams(context) }),

  // ── Products & Services (one table, item_type discriminates) ───────
  getProducts: (context: LaravelContext, itemType: CrmItemType, query: CrmProductListQuery = {}) =>
    apiClient.get<CrmProductListResponse>('/crm/products', {
      ...baseParams(context),
      itemType,
      ...(query.page ? { page: String(query.page) } : {}),
      ...(query.perPage ? { per_page: String(query.perPage) } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.sortBy ? { sort_by: query.sortBy } : {}),
      ...(query.sortDir ? { sort_dir: query.sortDir } : {}),
      ...(query.category ? { category: query.category } : {}),
    }),

  getProduct: (context: LaravelContext, id: string) =>
    apiClient.get<CrmProductResponse>(`/crm/products/${id}`, baseParams(context)),

  createProduct: (context: LaravelContext, payload: CrmProductPayload) =>
    apiClient.post<CrmProductResponse>('/crm/products', { ...payload, ...baseParams(context) }),

  updateProduct: (context: LaravelContext, id: string, payload: CrmProductPayload) =>
    apiClient.put<CrmProductResponse>(`/crm/products/${id}`, { ...payload, ...baseParams(context) }),

  deleteProduct: (context: LaravelContext, id: string) =>
    apiClient.delete<{ status: number; message: string }>(`/crm/products/${id}`, baseParams(context)),

  bulkDeleteProducts: (context: LaravelContext, ids: string[]) =>
    apiClient.post<CrmBulkActionResponse>('/crm/products/bulk/delete', { ids: ids.map(Number), ...baseParams(context) }),

  bulkAssignProducts: (context: LaravelContext, ids: string[], assignedTo: string) =>
    apiClient.post<CrmBulkActionResponse>('/crm/products/bulk/assign', {
      ids: ids.map(Number), assignedTo, ...baseParams(context),
    }),

  getProductDuplicates: (context: LaravelContext, itemType: CrmItemType) =>
    apiClient.get<CrmDuplicateGroupsResponse>('/crm/products/duplicates', { ...baseParams(context), itemType }),

  mergeProducts: (context: LaravelContext, survivorId: string, duplicateIds: string[]) =>
    apiClient.post<CrmMergeResponse>('/crm/products/merge', {
      survivorId: Number(survivorId), duplicateIds: duplicateIds.map(Number), ...baseParams(context),
    }),

  productsExportUrl: (context: LaravelContext, itemType: CrmItemType, search?: string) =>
    buildApiUrl('/crm/products/export', { ...baseParams(context), itemType, ...(search ? { search } : {}) }),

  importProducts: (context: LaravelContext, itemType: CrmItemType, rows: Record<string, unknown>[]) =>
    apiClient.post<CrmImportResponse>('/crm/products/import', { itemType, rows, ...baseParams(context) }),

  // ── Opportunities ────────────────────────────────────────────────────
  getOpportunities: (context: LaravelContext, query: CrmOpportunityListQuery = {}) =>
    apiClient.get<CrmOpportunityListResponse>('/crm/opportunities', {
      ...baseParams(context),
      ...(query.page ? { page: String(query.page) } : {}),
      ...(query.perPage ? { per_page: String(query.perPage) } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.sortBy ? { sort_by: query.sortBy } : {}),
      ...(query.sortDir ? { sort_dir: query.sortDir } : {}),
      ...(query.salesStage ? { sales_stage: query.salesStage } : {}),
      ...(query.organizationId ? { organization_id: query.organizationId } : {}),
    }),

  getOpportunityPipeline: (context: LaravelContext) =>
    apiClient.get<CrmOpportunityPipelineResponse>('/crm/opportunities/pipeline', baseParams(context)),

  getOpportunity: (context: LaravelContext, id: string) =>
    apiClient.get<CrmOpportunityResponse>(`/crm/opportunities/${id}`, baseParams(context)),

  createOpportunity: (context: LaravelContext, payload: CrmOpportunityPayload) =>
    apiClient.post<CrmOpportunityResponse>('/crm/opportunities', { ...payload, ...baseParams(context) }),

  updateOpportunity: (context: LaravelContext, id: string, payload: CrmOpportunityPayload) =>
    apiClient.put<CrmOpportunityResponse>(`/crm/opportunities/${id}`, { ...payload, ...baseParams(context) }),

  deleteOpportunity: (context: LaravelContext, id: string) =>
    apiClient.delete<{ status: number; message: string }>(`/crm/opportunities/${id}`, baseParams(context)),

  changeOpportunityStage: (context: LaravelContext, id: string, payload: CrmOpportunityStageChangePayload) =>
    apiClient.put<CrmOpportunityResponse>(`/crm/opportunities/${id}/stage`, { ...payload, ...baseParams(context) }),

  getOpportunityStageHistory: (context: LaravelContext, id: string) =>
    apiClient.get<CrmOpportunityStageHistoryResponse>(`/crm/opportunities/${id}/stage-history`, baseParams(context)),

  getOpportunityContacts: (context: LaravelContext, id: string) =>
    apiClient.get<CrmOpportunityContactsResponse>(`/crm/opportunities/${id}/contacts`, baseParams(context)),

  addOpportunityContact: (context: LaravelContext, id: string, contactId: string) =>
    apiClient.post<{ status: number; message: string }>(`/crm/opportunities/${id}/contacts`, {
      contactId, ...baseParams(context),
    }),

  removeOpportunityContact: (context: LaravelContext, id: string, rowId: string) =>
    apiClient.delete<{ status: number; message: string }>(`/crm/opportunities/${id}/contacts/${rowId}`, baseParams(context)),

  getOpportunityProducts: (context: LaravelContext, id: string) =>
    apiClient.get<CrmOpportunityProductsResponse>(`/crm/opportunities/${id}/products`, baseParams(context)),

  addOpportunityProduct: (context: LaravelContext, id: string, productId: string, quantity: number) =>
    apiClient.post<{ status: number; message: string }>(`/crm/opportunities/${id}/products`, {
      productId, quantity, ...baseParams(context),
    }),

  removeOpportunityProduct: (context: LaravelContext, id: string, rowId: string) =>
    apiClient.delete<{ status: number; message: string }>(`/crm/opportunities/${id}/products/${rowId}`, baseParams(context)),

  bulkDeleteOpportunities: (context: LaravelContext, ids: string[]) =>
    apiClient.post<CrmBulkActionResponse>('/crm/opportunities/bulk/delete', { ids: ids.map(Number), ...baseParams(context) }),

  bulkAssignOpportunities: (context: LaravelContext, ids: string[], assignedTo: string) =>
    apiClient.post<CrmBulkActionResponse>('/crm/opportunities/bulk/assign', {
      ids: ids.map(Number), assignedTo, ...baseParams(context),
    }),

  opportunitiesExportUrl: (context: LaravelContext, search?: string) =>
    buildApiUrl('/crm/opportunities/export', { ...baseParams(context), ...(search ? { search } : {}) }),

  importOpportunities: (context: LaravelContext, rows: Record<string, unknown>[]) =>
    apiClient.post<CrmImportResponse>('/crm/opportunities/import', { rows, ...baseParams(context) }),

  // ── Quotes ───────────────────────────────────────────────────────────
  getQuotes: (context: LaravelContext, query: CrmQuoteListQuery = {}) =>
    apiClient.get<CrmQuoteListResponse>('/crm/quotes', {
      ...baseParams(context),
      ...(query.page ? { page: String(query.page) } : {}),
      ...(query.perPage ? { per_page: String(query.perPage) } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.sortBy ? { sort_by: query.sortBy } : {}),
      ...(query.sortDir ? { sort_dir: query.sortDir } : {}),
      ...(query.quoteStage ? { quote_stage: query.quoteStage } : {}),
      ...(query.organizationId ? { organization_id: query.organizationId } : {}),
      ...(query.opportunityId ? { opportunity_id: query.opportunityId } : {}),
    }),

  getQuote: (context: LaravelContext, id: string) =>
    apiClient.get<CrmQuoteResponse>(`/crm/quotes/${id}`, baseParams(context)),

  createQuote: (context: LaravelContext, payload: CrmQuotePayload) =>
    apiClient.post<CrmQuoteResponse>('/crm/quotes', { ...payload, ...baseParams(context) }),

  updateQuote: (context: LaravelContext, id: string, payload: CrmQuotePayload) =>
    apiClient.put<CrmQuoteResponse>(`/crm/quotes/${id}`, { ...payload, ...baseParams(context) }),

  deleteQuote: (context: LaravelContext, id: string) =>
    apiClient.delete<{ status: number; message: string }>(`/crm/quotes/${id}`, baseParams(context)),

  /** Replaces the whole line-item set and returns the quote with server-recomputed totals - never a per-line endpoint. */
  saveQuoteLineItems: (context: LaravelContext, id: string, lineItems: CrmQuoteLineItemInput[]) =>
    apiClient.put<CrmQuoteResponse>(`/crm/quotes/${id}/line-items`, { lineItems, ...baseParams(context) }),

  getQuoteLineItems: (context: LaravelContext, id: string) =>
    apiClient.get<CrmQuoteLineItemsResponse>(`/crm/quotes/${id}/line-items`, baseParams(context)),

  downloadQuotePdf: (context: LaravelContext, id: string): Promise<Blob> =>
    apiClient.getBlob(`/crm/quotes/${id}/pdf`, baseParams(context)),

  bulkDeleteQuotes: (context: LaravelContext, ids: string[]) =>
    apiClient.post<CrmBulkActionResponse>('/crm/quotes/bulk/delete', { ids: ids.map(Number), ...baseParams(context) }),

  bulkAssignQuotes: (context: LaravelContext, ids: string[], assignedTo: string) =>
    apiClient.post<CrmBulkActionResponse>('/crm/quotes/bulk/assign', {
      ids: ids.map(Number), assignedTo, ...baseParams(context),
    }),

  quotesExportUrl: (context: LaravelContext, search?: string) =>
    buildApiUrl('/crm/quotes/export', { ...baseParams(context), ...(search ? { search } : {}) }),

  importQuotes: (context: LaravelContext, rows: Record<string, unknown>[]) =>
    apiClient.post<CrmImportResponse>('/crm/quotes/import', { rows, ...baseParams(context) }),

  // ── SMS Notifier ─────────────────────────────────────────────────────
  getSmsLog: (context: LaravelContext, query: { page?: number; perPage?: number } = {}) =>
    apiClient.get<CrmSmsLogListResponse>('/crm/sms-log', {
      ...baseParams(context),
      ...(query.page ? { page: String(query.page) } : {}),
      ...(query.perPage ? { per_page: String(query.perPage) } : {}),
    }),

  sendSms: (context: LaravelContext, payload: CrmSendSmsPayload) =>
    apiClient.post<CrmSendSmsResponse>('/crm/sms-log/send', { ...payload, ...baseParams(context) }),
}

export type { Lead }
