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
  CrmProductBundleItem,
  CrmProductResponse,
  CrmQuoteLineItemInput,
  CrmQuoteLineItemsResponse,
  CrmQuoteListQuery,
  CrmPriceBook,
  CrmPriceBookItem,
  CrmPriceBookListResponse,
  CrmPriceBookPayload,
  CrmPriceBookResponse,
  CrmQuoteListResponse,
  CrmQuotePayload,
  CrmQuoteResponse,
  CrmRecycleBinListResponse,
  CrmRecycleBinType,
  CrmSavedViewListResponse,
  CrmSavedViewResponse,
  CrmBulkSendSmsResponse,
  CrmSendSmsPayload,
  CrmSendSmsResponse,
  CrmSmsLogListResponse,
  CrmSmsStatus,
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
  CrmVendor,
  CrmVendorPayload,
  CrmVendorListQuery,
  CrmVendorListResponse,
  CrmVendorResponse,
  CrmVendorContactsResponse,
  CrmSalesOrder,
  CrmSalesOrderLineItemInput,
  CrmSalesOrderLineItemsResponse,
  CrmSalesOrderListQuery,
  CrmSalesOrderListResponse,
  CrmSalesOrderPayload,
  CrmSalesOrderResponse,
  CrmSalesOrderStatusHistoryResponse,
  CrmPurchaseOrder,
  CrmPurchaseOrderLineItemInput,
  CrmPurchaseOrderLineItemsResponse,
  CrmPurchaseOrderListQuery,
  CrmPurchaseOrderListResponse,
  CrmPurchaseOrderPayload,
  CrmPurchaseOrderResponse,
  CrmPurchaseOrderStageChangePayload,
  CrmPurchaseOrderStageHistoryResponse,
  CrmInvoice,
  CrmInvoiceLineItemInput,
  CrmInvoiceLineItemsResponse,
  CrmInvoiceListQuery,
  CrmInvoiceListResponse,
  CrmInvoicePayload,
  CrmInvoiceResponse,
  CrmInvoiceStageChangePayload,
  CrmInvoiceStatusHistoryResponse,
  CrmServiceContract,
  CrmServiceContractListQuery,
  CrmServiceContractListResponse,
  CrmServiceContractPayload,
  CrmServiceContractResponse,
  CrmAsset,
  CrmAssetPayload,
  CrmAssetListQuery,
  CrmAssetListResponse,
  CrmAssetResponse,
  CrmTicket,
  CrmTicketComment,
  CrmTicketCommentsResponse,
  CrmTicketListQuery,
  CrmTicketListResponse,
  CrmTicketPayload,
  CrmTicketResponse,
  CrmTicketStatusChangePayload,
  CrmTicketStatusHistoryResponse,
  CrmFaq,
  CrmFaqListQuery,
  CrmFaqListResponse,
  CrmFaqPayload,
  CrmFaqResponse,
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

  getBundleItems: (context: LaravelContext, productId: string) =>
    apiClient.get<{ status: number; message: string; data: CrmProductBundleItem[] }>(
      `/crm/products/${productId}/bundle-items`, baseParams(context),
    ),

  addBundleItem: (context: LaravelContext, productId: string, componentProductId: string, quantity: number) =>
    apiClient.post<{ status: number; message: string }>(`/crm/products/${productId}/bundle-items`, {
      componentProductId: Number(componentProductId), quantity, ...baseParams(context),
    }),

  removeBundleItem: (context: LaravelContext, productId: string, rowId: string) =>
    apiClient.delete<{ status: number; message: string }>(
      `/crm/products/${productId}/bundle-items/${rowId}`, baseParams(context),
    ),

  uploadProductImage: (context: LaravelContext, productId: string, file: File) => {
    const body = new FormData()
    body.append('token', context.token)
    body.append('sub_institute_id', String(context.subInstituteId))
    body.append('image', file)

    return apiClient.postForm<CrmProductResponse>(`/crm/products/${productId}/image`, body)
  },

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
      ...(query.contactId ? { contact_id: query.contactId } : {}),
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
      ...(query.contactId ? { contact_id: query.contactId } : {}),
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

  // ── Price Books ──────────────────────────────────────────────────────
  getPriceBooks: (context: LaravelContext, query: { page?: number; perPage?: number; search?: string; sortBy?: string; sortDir?: 'asc' | 'desc' } = {}) =>
    apiClient.get<CrmPriceBookListResponse>('/crm/price-books', {
      ...baseParams(context),
      ...(query.page ? { page: String(query.page) } : {}),
      ...(query.perPage ? { per_page: String(query.perPage) } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.sortBy ? { sort_by: query.sortBy } : {}),
      ...(query.sortDir ? { sort_dir: query.sortDir } : {}),
    }),

  /** Active price books only, for a Quote's own picker - no pagination. */
  getActivePriceBooks: (context: LaravelContext) =>
    apiClient.get<{ status: number; message: string; data: CrmPriceBook[] }>('/crm/price-books/active', baseParams(context)),

  getPriceBook: (context: LaravelContext, id: string) =>
    apiClient.get<CrmPriceBookResponse>(`/crm/price-books/${id}`, baseParams(context)),

  createPriceBook: (context: LaravelContext, payload: CrmPriceBookPayload) =>
    apiClient.post<CrmPriceBookResponse>('/crm/price-books', { ...payload, ...baseParams(context) }),

  updatePriceBook: (context: LaravelContext, id: string, payload: CrmPriceBookPayload) =>
    apiClient.put<CrmPriceBookResponse>(`/crm/price-books/${id}`, { ...payload, ...baseParams(context) }),

  deletePriceBook: (context: LaravelContext, id: string) =>
    apiClient.delete<{ status: number; message: string }>(`/crm/price-books/${id}`, baseParams(context)),

  bulkDeletePriceBooks: (context: LaravelContext, ids: string[]) =>
    apiClient.post<CrmBulkActionResponse>('/crm/price-books/bulk/delete', { ids: ids.map(Number), ...baseParams(context) }),

  bulkAssignPriceBooks: (context: LaravelContext, ids: string[], assignedTo: string) =>
    apiClient.post<CrmBulkActionResponse>('/crm/price-books/bulk/assign', {
      ids: ids.map(Number), assignedTo, ...baseParams(context),
    }),

  priceBooksExportUrl: (context: LaravelContext, search?: string) =>
    buildApiUrl('/crm/price-books/export', { ...baseParams(context), ...(search ? { search } : {}) }),

  getPriceBookItems: (context: LaravelContext, priceBookId: string) =>
    apiClient.get<{ status: number; message: string; data: CrmPriceBookItem[] }>(`/crm/price-books/${priceBookId}/items`, baseParams(context)),

  addPriceBookItem: (context: LaravelContext, priceBookId: string, productId: string, listPrice: number) =>
    apiClient.post<{ status: number; message: string }>(`/crm/price-books/${priceBookId}/items`, {
      productId: Number(productId), listPrice, ...baseParams(context),
    }),

  updatePriceBookItem: (context: LaravelContext, priceBookId: string, rowId: string, listPrice: number) =>
    apiClient.put<{ status: number; message: string }>(`/crm/price-books/${priceBookId}/items/${rowId}`, {
      listPrice, ...baseParams(context),
    }),

  removePriceBookItem: (context: LaravelContext, priceBookId: string, rowId: string) =>
    apiClient.delete<{ status: number; message: string }>(`/crm/price-books/${priceBookId}/items/${rowId}`, baseParams(context)),

  // ── Vendors ─────────────────────────────────────────────────────────
  getVendors: (context: LaravelContext, query: CrmVendorListQuery = {}) =>
    apiClient.get<CrmVendorListResponse>('/crm/vendors', {
      ...baseParams(context),
      ...(query.page ? { page: String(query.page) } : {}),
      ...(query.perPage ? { per_page: String(query.perPage) } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.sortBy ? { sort_by: query.sortBy } : {}),
      ...(query.sortDir ? { sort_dir: query.sortDir } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.isActive !== undefined ? { isActive: String(query.isActive) } : {}),
    }),

  getVendor: (context: LaravelContext, id: string) =>
    apiClient.get<CrmVendorResponse>(`/crm/vendors/${id}`, baseParams(context)),

  createVendor: (context: LaravelContext, payload: CrmVendorPayload) =>
    apiClient.post<CrmVendorResponse>('/crm/vendors', { ...payload, ...baseParams(context) }),

  updateVendor: (context: LaravelContext, id: string, payload: CrmVendorPayload) =>
    apiClient.put<CrmVendorResponse>(`/crm/vendors/${id}`, { ...payload, ...baseParams(context) }),

  deleteVendor: (context: LaravelContext, id: string) =>
    apiClient.delete<{ status: number; message: string }>(`/crm/vendors/${id}`, baseParams(context)),

  bulkDeleteVendors: (context: LaravelContext, ids: string[]) =>
    apiClient.post<CrmBulkActionResponse>('/crm/vendors/bulk/delete', { ids: ids.map(Number), ...baseParams(context) }),

  bulkAssignVendors: (context: LaravelContext, ids: string[], assignedTo: string) =>
    apiClient.post<CrmBulkActionResponse>('/crm/vendors/bulk/assign', {
      ids: ids.map(Number), assignedTo, ...baseParams(context),
    }),

  getVendorDuplicates: (context: LaravelContext) =>
    apiClient.get<CrmDuplicateGroupsResponse>('/crm/vendors/duplicates', baseParams(context)),

  mergeVendors: (context: LaravelContext, survivorId: string, duplicateIds: string[]) =>
    apiClient.post<CrmMergeResponse>('/crm/vendors/merge', {
      survivorId: Number(survivorId), duplicateIds: duplicateIds.map(Number), ...baseParams(context),
    }),

  vendorsExportUrl: (context: LaravelContext, search?: string) =>
    buildApiUrl('/crm/vendors/export', { ...baseParams(context), ...(search ? { search } : {}) }),

  importVendors: (context: LaravelContext, rows: Record<string, unknown>[]) =>
    apiClient.post<CrmImportResponse>('/crm/vendors/import', { rows, ...baseParams(context) }),

  getVendorContacts: (context: LaravelContext, id: string) =>
    apiClient.get<CrmVendorContactsResponse>(`/crm/vendors/${id}/contacts`, baseParams(context)),

  addVendorContact: (context: LaravelContext, id: string, contactId: string) =>
    apiClient.post<{ status: number; message: string }>(`/crm/vendors/${id}/contacts`, {
      contactId, ...baseParams(context),
    }),

  removeVendorContact: (context: LaravelContext, id: string, rowId: string) =>
    apiClient.delete<{ status: number; message: string }>(`/crm/vendors/${id}/contacts/${rowId}`, baseParams(context)),

  // ── Sales Orders ─────────────────────────────────────────────────────
  getSalesOrders: (context: LaravelContext, query: CrmSalesOrderListQuery = {}) =>
    apiClient.get<CrmSalesOrderListResponse>('/crm/sales-orders', {
      ...baseParams(context),
      ...(query.page ? { page: String(query.page) } : {}),
      ...(query.perPage ? { per_page: String(query.perPage) } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.sortBy ? { sort_by: query.sortBy } : {}),
      ...(query.sortDir ? { sort_dir: query.sortDir } : {}),
      ...(query.soStage ? { so_stage: query.soStage } : {}),
      ...(query.organizationId ? { organization_id: query.organizationId } : {}),
      ...(query.contactId ? { contact_id: query.contactId } : {}),
      ...(query.opportunityId ? { opportunity_id: query.opportunityId } : {}),
      ...(query.quoteId ? { quote_id: query.quoteId } : {}),
    }),

  getSalesOrder: (context: LaravelContext, id: string) =>
    apiClient.get<CrmSalesOrderResponse>(`/crm/sales-orders/${id}`, baseParams(context)),

  createSalesOrder: (context: LaravelContext, payload: CrmSalesOrderPayload) =>
    apiClient.post<CrmSalesOrderResponse>('/crm/sales-orders', { ...payload, ...baseParams(context) }),

  /** Converts a Quote into a new Sales Order server-side (organization/addresses/terms/line items all copied over) - `subject` overrides the quote's own subject when given. */
  createSalesOrderFromQuote: (context: LaravelContext, quoteId: string, subject?: string) =>
    apiClient.post<CrmSalesOrderResponse>(`/crm/sales-orders/from-quote/${quoteId}`, {
      ...(subject ? { subject } : {}),
      ...baseParams(context),
    }),

  updateSalesOrder: (context: LaravelContext, id: string, payload: CrmSalesOrderPayload) =>
    apiClient.put<CrmSalesOrderResponse>(`/crm/sales-orders/${id}`, { ...payload, ...baseParams(context) }),

  changeSalesOrderStage: (context: LaravelContext, id: string, soStage: string) =>
    apiClient.put<CrmSalesOrderResponse>(`/crm/sales-orders/${id}/stage`, { soStage, ...baseParams(context) }),

  getSalesOrderStageHistory: (context: LaravelContext, id: string) =>
    apiClient.get<CrmSalesOrderStatusHistoryResponse>(`/crm/sales-orders/${id}/stage-history`, baseParams(context)),

  deleteSalesOrder: (context: LaravelContext, id: string) =>
    apiClient.delete<{ status: number; message: string }>(`/crm/sales-orders/${id}`, baseParams(context)),

  /** Replaces the whole line-item set and returns the sales order with server-recomputed totals - never a per-line endpoint. */
  saveSalesOrderLineItems: (context: LaravelContext, id: string, lineItems: CrmSalesOrderLineItemInput[]) =>
    apiClient.put<CrmSalesOrderResponse>(`/crm/sales-orders/${id}/line-items`, { lineItems, ...baseParams(context) }),

  getSalesOrderLineItems: (context: LaravelContext, id: string) =>
    apiClient.get<CrmSalesOrderLineItemsResponse>(`/crm/sales-orders/${id}/line-items`, baseParams(context)),

  bulkDeleteSalesOrders: (context: LaravelContext, ids: string[]) =>
    apiClient.post<CrmBulkActionResponse>('/crm/sales-orders/bulk/delete', { ids: ids.map(Number), ...baseParams(context) }),

  bulkAssignSalesOrders: (context: LaravelContext, ids: string[], assignedTo: string) =>
    apiClient.post<CrmBulkActionResponse>('/crm/sales-orders/bulk/assign', {
      ids: ids.map(Number), assignedTo, ...baseParams(context),
    }),

  salesOrdersExportUrl: (context: LaravelContext, search?: string) =>
    buildApiUrl('/crm/sales-orders/export', { ...baseParams(context), ...(search ? { search } : {}) }),

  importSalesOrders: (context: LaravelContext, rows: Record<string, unknown>[]) =>
    apiClient.post<CrmImportResponse>('/crm/sales-orders/import', { rows, ...baseParams(context) }),

  // ── Purchase Orders ───────────────────────────────────────────────────
  getPurchaseOrders: (context: LaravelContext, query: CrmPurchaseOrderListQuery = {}) =>
    apiClient.get<CrmPurchaseOrderListResponse>('/crm/purchase-orders', {
      ...baseParams(context),
      ...(query.page ? { page: String(query.page) } : {}),
      ...(query.perPage ? { per_page: String(query.perPage) } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.sortBy ? { sort_by: query.sortBy } : {}),
      ...(query.sortDir ? { sort_dir: query.sortDir } : {}),
      ...(query.poStage ? { po_stage: query.poStage } : {}),
      ...(query.vendorId ? { vendor_id: query.vendorId } : {}),
      ...(query.organizationId ? { organization_id: query.organizationId } : {}),
      ...(query.contactId ? { contact_id: query.contactId } : {}),
      ...(query.quoteId ? { quote_id: query.quoteId } : {}),
    }),

  getPurchaseOrder: (context: LaravelContext, id: string) =>
    apiClient.get<CrmPurchaseOrderResponse>(`/crm/purchase-orders/${id}`, baseParams(context)),

  createPurchaseOrder: (context: LaravelContext, payload: CrmPurchaseOrderPayload) =>
    apiClient.post<CrmPurchaseOrderResponse>('/crm/purchase-orders', { ...payload, ...baseParams(context) }),

  /** Transactional copy of a Quote's header + whole line-item set into a brand-new Purchase Order - vendorId is left null (Quotes have no vendor concept), set it afterward with updatePurchaseOrder. */
  createPurchaseOrderFromQuote: (context: LaravelContext, quoteId: string) =>
    apiClient.post<CrmPurchaseOrderResponse>(`/crm/purchase-orders/from-quote/${quoteId}`, { ...baseParams(context) }),

  updatePurchaseOrder: (context: LaravelContext, id: string, payload: CrmPurchaseOrderPayload) =>
    apiClient.put<CrmPurchaseOrderResponse>(`/crm/purchase-orders/${id}`, { ...payload, ...baseParams(context) }),

  deletePurchaseOrder: (context: LaravelContext, id: string) =>
    apiClient.delete<{ status: number; message: string }>(`/crm/purchase-orders/${id}`, baseParams(context)),

  changePurchaseOrderStage: (context: LaravelContext, id: string, payload: CrmPurchaseOrderStageChangePayload) =>
    apiClient.put<CrmPurchaseOrderResponse>(`/crm/purchase-orders/${id}/stage`, { ...payload, ...baseParams(context) }),

  getPurchaseOrderStageHistory: (context: LaravelContext, id: string) =>
    apiClient.get<CrmPurchaseOrderStageHistoryResponse>(`/crm/purchase-orders/${id}/stage-history`, baseParams(context)),

  /** Replaces the whole line-item set and returns the purchase order with server-recomputed totals - never a per-line endpoint. */
  savePurchaseOrderLineItems: (context: LaravelContext, id: string, lineItems: CrmPurchaseOrderLineItemInput[]) =>
    apiClient.put<CrmPurchaseOrderResponse>(`/crm/purchase-orders/${id}/line-items`, { lineItems, ...baseParams(context) }),

  getPurchaseOrderLineItems: (context: LaravelContext, id: string) =>
    apiClient.get<CrmPurchaseOrderLineItemsResponse>(`/crm/purchase-orders/${id}/line-items`, baseParams(context)),

  bulkDeletePurchaseOrders: (context: LaravelContext, ids: string[]) =>
    apiClient.post<CrmBulkActionResponse>('/crm/purchase-orders/bulk/delete', { ids: ids.map(Number), ...baseParams(context) }),

  bulkAssignPurchaseOrders: (context: LaravelContext, ids: string[], assignedTo: string) =>
    apiClient.post<CrmBulkActionResponse>('/crm/purchase-orders/bulk/assign', {
      ids: ids.map(Number), assignedTo, ...baseParams(context),
    }),

  purchaseOrdersExportUrl: (context: LaravelContext, search?: string) =>
    buildApiUrl('/crm/purchase-orders/export', { ...baseParams(context), ...(search ? { search } : {}) }),

  importPurchaseOrders: (context: LaravelContext, rows: Record<string, unknown>[]) =>
    apiClient.post<CrmImportResponse>('/crm/purchase-orders/import', { rows, ...baseParams(context) }),

  // ── Invoices ─────────────────────────────────────────────────────────
  getInvoices: (context: LaravelContext, query: CrmInvoiceListQuery = {}) =>
    apiClient.get<CrmInvoiceListResponse>('/crm/invoices', {
      ...baseParams(context),
      ...(query.page ? { page: String(query.page) } : {}),
      ...(query.perPage ? { per_page: String(query.perPage) } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.sortBy ? { sort_by: query.sortBy } : {}),
      ...(query.sortDir ? { sort_dir: query.sortDir } : {}),
      ...(query.invoiceStage ? { invoice_stage: query.invoiceStage } : {}),
      ...(query.organizationId ? { organization_id: query.organizationId } : {}),
      ...(query.contactId ? { contact_id: query.contactId } : {}),
      ...(query.salesOrderId ? { sales_order_id: query.salesOrderId } : {}),
    }),

  getInvoice: (context: LaravelContext, id: string) =>
    apiClient.get<CrmInvoiceResponse>(`/crm/invoices/${id}`, baseParams(context)),

  createInvoice: (context: LaravelContext, payload: CrmInvoicePayload) =>
    apiClient.post<CrmInvoiceResponse>('/crm/invoices', { ...payload, ...baseParams(context) }),

  /** Creates a new invoice by copying a Sales Order's header fields + a fresh copy of its line items, server-side. */
  createInvoiceFromSalesOrder: (context: LaravelContext, salesOrderId: string) =>
    apiClient.post<CrmInvoiceResponse>(`/crm/invoices/from-sales-order/${salesOrderId}`, { ...baseParams(context) }),

  updateInvoice: (context: LaravelContext, id: string, payload: CrmInvoicePayload) =>
    apiClient.put<CrmInvoiceResponse>(`/crm/invoices/${id}`, { ...payload, ...baseParams(context) }),

  deleteInvoice: (context: LaravelContext, id: string) =>
    apiClient.delete<{ status: number; message: string }>(`/crm/invoices/${id}`, baseParams(context)),

  changeInvoiceStage: (context: LaravelContext, id: string, payload: CrmInvoiceStageChangePayload) =>
    apiClient.put<CrmInvoiceResponse>(`/crm/invoices/${id}/stage`, { ...payload, ...baseParams(context) }),

  getInvoiceStageHistory: (context: LaravelContext, id: string) =>
    apiClient.get<CrmInvoiceStatusHistoryResponse>(`/crm/invoices/${id}/stage-history`, baseParams(context)),

  /** Replaces the whole line-item set and returns the invoice with server-recomputed totals - never a per-line endpoint. */
  saveInvoiceLineItems: (context: LaravelContext, id: string, lineItems: CrmInvoiceLineItemInput[]) =>
    apiClient.put<CrmInvoiceResponse>(`/crm/invoices/${id}/line-items`, { lineItems, ...baseParams(context) }),

  getInvoiceLineItems: (context: LaravelContext, id: string) =>
    apiClient.get<CrmInvoiceLineItemsResponse>(`/crm/invoices/${id}/line-items`, baseParams(context)),

  bulkDeleteInvoices: (context: LaravelContext, ids: string[]) =>
    apiClient.post<CrmBulkActionResponse>('/crm/invoices/bulk/delete', { ids: ids.map(Number), ...baseParams(context) }),

  bulkAssignInvoices: (context: LaravelContext, ids: string[], assignedTo: string) =>
    apiClient.post<CrmBulkActionResponse>('/crm/invoices/bulk/assign', {
      ids: ids.map(Number), assignedTo, ...baseParams(context),
    }),

  invoicesExportUrl: (context: LaravelContext, search?: string) =>
    buildApiUrl('/crm/invoices/export', { ...baseParams(context), ...(search ? { search } : {}) }),

  importInvoices: (context: LaravelContext, rows: Record<string, unknown>[]) =>
    apiClient.post<CrmImportResponse>('/crm/invoices/import', { rows, ...baseParams(context) }),

  // ── Service Contracts ────────────────────────────────────────────────
  getServiceContracts: (context: LaravelContext, query: CrmServiceContractListQuery = {}) =>
    apiClient.get<CrmServiceContractListResponse>('/crm/service-contracts', {
      ...baseParams(context),
      ...(query.page ? { page: String(query.page) } : {}),
      ...(query.perPage ? { per_page: String(query.perPage) } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.sortBy ? { sort_by: query.sortBy } : {}),
      ...(query.sortDir ? { sort_dir: query.sortDir } : {}),
      ...(query.contractStatus ? { contract_status: query.contractStatus } : {}),
      ...(query.organizationId ? { organization_id: query.organizationId } : {}),
      ...(query.contactId ? { contact_id: query.contactId } : {}),
    }),

  getServiceContract: (context: LaravelContext, id: string) =>
    apiClient.get<CrmServiceContractResponse>(`/crm/service-contracts/${id}`, baseParams(context)),

  createServiceContract: (context: LaravelContext, payload: CrmServiceContractPayload) =>
    apiClient.post<CrmServiceContractResponse>('/crm/service-contracts', { ...payload, ...baseParams(context) }),

  updateServiceContract: (context: LaravelContext, id: string, payload: CrmServiceContractPayload) =>
    apiClient.put<CrmServiceContractResponse>(`/crm/service-contracts/${id}`, { ...payload, ...baseParams(context) }),

  deleteServiceContract: (context: LaravelContext, id: string) =>
    apiClient.delete<{ status: number; message: string }>(`/crm/service-contracts/${id}`, baseParams(context)),

  bulkDeleteServiceContracts: (context: LaravelContext, ids: string[]) =>
    apiClient.post<CrmBulkActionResponse>('/crm/service-contracts/bulk/delete', { ids: ids.map(Number), ...baseParams(context) }),

  bulkAssignServiceContracts: (context: LaravelContext, ids: string[], assignedTo: string) =>
    apiClient.post<CrmBulkActionResponse>('/crm/service-contracts/bulk/assign', {
      ids: ids.map(Number), assignedTo, ...baseParams(context),
    }),

  serviceContractsExportUrl: (context: LaravelContext, search?: string) =>
    buildApiUrl('/crm/service-contracts/export', { ...baseParams(context), ...(search ? { search } : {}) }),

  importServiceContracts: (context: LaravelContext, rows: Record<string, unknown>[]) =>
    apiClient.post<CrmImportResponse>('/crm/service-contracts/import', { rows, ...baseParams(context) }),

  // ── Assets ────────────────────────────────────────────────────────────
  getAssets: (context: LaravelContext, query: CrmAssetListQuery = {}) =>
    apiClient.get<CrmAssetListResponse>('/crm/assets', {
      ...baseParams(context),
      ...(query.page ? { page: String(query.page) } : {}),
      ...(query.perPage ? { per_page: String(query.perPage) } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.sortBy ? { sort_by: query.sortBy } : {}),
      ...(query.sortDir ? { sort_dir: query.sortDir } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.productId ? { product_id: query.productId } : {}),
      ...(query.organizationId ? { organization_id: query.organizationId } : {}),
    }),

  getAsset: (context: LaravelContext, id: string) =>
    apiClient.get<CrmAssetResponse>(`/crm/assets/${id}`, baseParams(context)),

  createAsset: (context: LaravelContext, payload: CrmAssetPayload) =>
    apiClient.post<CrmAssetResponse>('/crm/assets', { ...payload, ...baseParams(context) }),

  updateAsset: (context: LaravelContext, id: string, payload: CrmAssetPayload) =>
    apiClient.put<CrmAssetResponse>(`/crm/assets/${id}`, { ...payload, ...baseParams(context) }),

  deleteAsset: (context: LaravelContext, id: string) =>
    apiClient.delete<{ status: number; message: string }>(`/crm/assets/${id}`, baseParams(context)),

  bulkDeleteAssets: (context: LaravelContext, ids: string[]) =>
    apiClient.post<CrmBulkActionResponse>('/crm/assets/bulk/delete', { ids: ids.map(Number), ...baseParams(context) }),

  bulkAssignAssets: (context: LaravelContext, ids: string[], assignedTo: string) =>
    apiClient.post<CrmBulkActionResponse>('/crm/assets/bulk/assign', {
      ids: ids.map(Number), assignedTo, ...baseParams(context),
    }),

  getAssetDuplicates: (context: LaravelContext) =>
    apiClient.get<CrmDuplicateGroupsResponse>('/crm/assets/duplicates', baseParams(context)),

  mergeAssets: (context: LaravelContext, survivorId: string, duplicateIds: string[]) =>
    apiClient.post<CrmMergeResponse>('/crm/assets/merge', {
      survivorId: Number(survivorId), duplicateIds: duplicateIds.map(Number), ...baseParams(context),
    }),

  assetsExportUrl: (context: LaravelContext, search?: string) =>
    buildApiUrl('/crm/assets/export', { ...baseParams(context), ...(search ? { search } : {}) }),

  importAssets: (context: LaravelContext, rows: Record<string, unknown>[]) =>
    apiClient.post<CrmImportResponse>('/crm/assets/import', { rows, ...baseParams(context) }),

  // ── Tickets ──────────────────────────────────────────────────────────
  getTickets: (context: LaravelContext, query: CrmTicketListQuery = {}) =>
    apiClient.get<CrmTicketListResponse>('/crm/tickets', {
      ...baseParams(context),
      ...(query.page ? { page: String(query.page) } : {}),
      ...(query.perPage ? { per_page: String(query.perPage) } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.sortBy ? { sort_by: query.sortBy } : {}),
      ...(query.sortDir ? { sort_dir: query.sortDir } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.organizationId ? { organization_id: query.organizationId } : {}),
      ...(query.contactId ? { contact_id: query.contactId } : {}),
      ...(query.assetId ? { asset_id: query.assetId } : {}),
      ...(query.serviceContractId ? { service_contract_id: query.serviceContractId } : {}),
      ...(query.assignedTo ? { assigned_to: query.assignedTo } : {}),
    }),

  getTicket: (context: LaravelContext, id: string) =>
    apiClient.get<CrmTicketResponse>(`/crm/tickets/${id}`, baseParams(context)),

  createTicket: (context: LaravelContext, payload: CrmTicketPayload) =>
    apiClient.post<CrmTicketResponse>('/crm/tickets', { ...payload, ...baseParams(context) }),

  updateTicket: (context: LaravelContext, id: string, payload: CrmTicketPayload) =>
    apiClient.put<CrmTicketResponse>(`/crm/tickets/${id}`, { ...payload, ...baseParams(context) }),

  changeTicketStatus: (context: LaravelContext, id: string, payload: CrmTicketStatusChangePayload) =>
    apiClient.put<CrmTicketResponse>(`/crm/tickets/${id}/status`, { ...payload, ...baseParams(context) }),

  getTicketStatusHistory: (context: LaravelContext, id: string) =>
    apiClient.get<CrmTicketStatusHistoryResponse>(`/crm/tickets/${id}/status-history`, baseParams(context)),

  getTicketComments: (context: LaravelContext, id: string) =>
    apiClient.get<CrmTicketCommentsResponse>(`/crm/tickets/${id}/comments`, baseParams(context)),

  addTicketComment: (context: LaravelContext, id: string, comment: string) =>
    apiClient.post<{ status: number; message: string; data: CrmTicketComment }>(`/crm/tickets/${id}/comments`, {
      comment, ...baseParams(context),
    }),

  deleteTicket: (context: LaravelContext, id: string) =>
    apiClient.delete<{ status: number; message: string }>(`/crm/tickets/${id}`, baseParams(context)),

  bulkDeleteTickets: (context: LaravelContext, ids: string[]) =>
    apiClient.post<CrmBulkActionResponse>('/crm/tickets/bulk/delete', { ids: ids.map(Number), ...baseParams(context) }),

  bulkAssignTickets: (context: LaravelContext, ids: string[], assignedTo: string) =>
    apiClient.post<CrmBulkActionResponse>('/crm/tickets/bulk/assign', {
      ids: ids.map(Number), assignedTo, ...baseParams(context),
    }),

  ticketsExportUrl: (context: LaravelContext, search?: string) =>
    buildApiUrl('/crm/tickets/export', { ...baseParams(context), ...(search ? { search } : {}) }),

  importTickets: (context: LaravelContext, rows: Record<string, unknown>[]) =>
    apiClient.post<CrmImportResponse>('/crm/tickets/import', { rows, ...baseParams(context) }),

  // ── FAQ ──────────────────────────────────────────────────────────────
  getFaqs: (context: LaravelContext, query: CrmFaqListQuery = {}) =>
    apiClient.get<CrmFaqListResponse>('/crm/faqs', {
      ...baseParams(context),
      ...(query.page ? { page: String(query.page) } : {}),
      ...(query.perPage ? { per_page: String(query.perPage) } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.sortBy ? { sort_by: query.sortBy } : {}),
      ...(query.sortDir ? { sort_dir: query.sortDir } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.productId ? { product_id: query.productId } : {}),
    }),

  getFaq: (context: LaravelContext, id: string) =>
    apiClient.get<CrmFaqResponse>(`/crm/faqs/${id}`, baseParams(context)),

  createFaq: (context: LaravelContext, payload: CrmFaqPayload) =>
    apiClient.post<CrmFaqResponse>('/crm/faqs', { ...payload, ...baseParams(context) }),

  updateFaq: (context: LaravelContext, id: string, payload: CrmFaqPayload) =>
    apiClient.put<CrmFaqResponse>(`/crm/faqs/${id}`, { ...payload, ...baseParams(context) }),

  deleteFaq: (context: LaravelContext, id: string) =>
    apiClient.delete<{ status: number; message: string }>(`/crm/faqs/${id}`, baseParams(context)),

  bulkDeleteFaqs: (context: LaravelContext, ids: string[]) =>
    apiClient.post<CrmBulkActionResponse>('/crm/faqs/bulk/delete', { ids: ids.map(Number), ...baseParams(context) }),

  bulkAssignFaqs: (context: LaravelContext, ids: string[], assignedTo: string) =>
    apiClient.post<CrmBulkActionResponse>('/crm/faqs/bulk/assign', {
      ids: ids.map(Number), assignedTo, ...baseParams(context),
    }),

  faqsExportUrl: (context: LaravelContext, search?: string) =>
    buildApiUrl('/crm/faqs/export', { ...baseParams(context), ...(search ? { search } : {}) }),

  importFaqs: (context: LaravelContext, rows: Record<string, unknown>[]) =>
    apiClient.post<CrmImportResponse>('/crm/faqs/import', { rows, ...baseParams(context) }),

  // ── SMS Notifier ─────────────────────────────────────────────────────
  getSmsLog: (context: LaravelContext, query: {
    page?: number; perPage?: number; search?: string; status?: CrmSmsStatus
    relatedType?: string; relatedId?: string
  } = {}) =>
    apiClient.get<CrmSmsLogListResponse>('/crm/sms-log', {
      ...baseParams(context),
      ...(query.page ? { page: String(query.page) } : {}),
      ...(query.perPage ? { per_page: String(query.perPage) } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.relatedType ? { related_type: query.relatedType } : {}),
      ...(query.relatedId ? { related_id: query.relatedId } : {}),
    }),

  sendSms: (context: LaravelContext, payload: CrmSendSmsPayload) =>
    apiClient.post<CrmSendSmsResponse>('/crm/sms-log/send', { ...payload, ...baseParams(context) }),

  bulkSendSms: (context: LaravelContext, relatedType: 'lead' | 'organization' | 'contact', ids: string[], message: string) =>
    apiClient.post<CrmBulkSendSmsResponse>('/crm/sms-log/bulk-send', {
      relatedType, ids: ids.map(Number), message, ...baseParams(context),
    }),

  smsLogExportUrl: (context: LaravelContext, query: { search?: string; status?: CrmSmsStatus } = {}) =>
    buildApiUrl('/crm/sms-log/export', {
      ...baseParams(context),
      ...(query.search ? { search: query.search } : {}),
      ...(query.status ? { status: query.status } : {}),
    }),
}

export type { Lead }
