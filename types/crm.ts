/**
 * CRM Marketing module — Leads, Contacts, Organizations, Campaigns.
 *
 * Tenant-scoped by `sub_institute_id` only - none of these 4 entities are
 * academic-year-bound the way Task Management's are, so no `syear` anywhere
 * in this module's types/service calls.
 */

export interface CrmPicklistValue {
  value: string
  label: string
  sortOrder: number
  isDefault: boolean
}

/** `module` -> `field_key` -> ordered options, as returned by GET /crm/picklist-values. */
export type CrmPicklistMap = Record<string, Record<string, CrmPicklistValue[]>>

export interface CrmPicklistAdminRow {
  id: string
  module: CrmModule
  fieldKey: string
  value: string
  label: string
  sortOrder: number
  isDefault: boolean
  status: boolean
}

export interface CrmPicklistAdminResponse {
  status: number
  message: string
  data: {
    fieldKeys: Record<string, string[]>
    rows: CrmPicklistAdminRow[]
  }
}

export interface CrmPicklistValueResponse {
  status: number
  message: string
  data: CrmPicklistAdminRow
}

export interface CrmPagination {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export interface Lead {
  id: string
  leadNo: string | null
  salutation: string | null
  firstName: string | null
  lastName: string
  company: string | null
  designation: string | null
  email: string | null
  secondaryEmail: string | null
  phone: string | null
  mobile: string | null
  fax: string | null
  website: string | null
  industry: string | null
  leadSource: string | null
  leadStatus: string | null
  rating: string | null
  annualRevenue: number | null
  numberOfEmp: string | null
  emailOptOut: boolean
  campaignText: string | null
  street: string | null
  city: string | null
  state: string | null
  country: string | null
  postalCode: string | null
  poBox: string | null
  converted: boolean
  convertedOrganizationId: string | null
  convertedContactId: string | null
  convertedOpportunityId: string | null
  description: string | null
  assignedTo: string | null
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type LeadPayload = Partial<
  Omit<Lead, 'id' | 'converted' | 'convertedOrganizationId' | 'convertedContactId' | 'convertedOpportunityId' | 'createdAt' | 'updatedAt' | 'createdBy'>
>

export interface LeadListResponse {
  status: number
  message: string
  data: {
    items: Lead[]
    pagination: CrmPagination
  }
}

export interface LeadResponse {
  status: number
  message: string
  data: Lead
}

export interface LeadListQuery {
  page?: number
  perPage?: number
  search?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  leadStatus?: string
  assignedTo?: string
}

export interface ConvertLeadPayload {
  createOrganization: boolean
  createContact: boolean
  organizationName?: string
  existingContactId?: string
  createOpportunity?: boolean
  assignedTo: string
}

export interface ConvertLeadResponse {
  status: number
  message: string
  data: {
    organizationId: string | null
    contactId: string | null
    opportunityId: string | null
  }
}

export interface Organization {
  id: string
  accountNo: string | null
  name: string
  parentId: string | null
  accountType: string | null
  industry: string | null
  rating: string | null
  ownership: string | null
  annualRevenue: number | null
  employees: number | null
  sicCode: string | null
  tickerSymbol: string | null
  phone: string | null
  secondaryPhone: string | null
  email: string | null
  secondaryEmail: string | null
  website: string | null
  fax: string | null
  emailOptOut: boolean
  billingStreet: string | null
  billingCity: string | null
  billingState: string | null
  billingCode: string | null
  billingCountry: string | null
  billingPoBox: string | null
  shippingStreet: string | null
  shippingCity: string | null
  shippingState: string | null
  shippingCode: string | null
  shippingCountry: string | null
  shippingPoBox: string | null
  description: string | null
  assignedTo: string | null
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type OrganizationPayload = Partial<Omit<Organization, 'id' | 'accountNo' | 'createdAt' | 'updatedAt' | 'createdBy'>>

export interface OrganizationListResponse {
  status: number
  message: string
  data: { items: Organization[]; pagination: CrmPagination }
}

export interface OrganizationResponse {
  status: number
  message: string
  data: Organization
}

export interface OrganizationListQuery {
  page?: number
  perPage?: number
  search?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  accountType?: string
}

export interface OrganizationHierarchyNode {
  id: string
  name: string
  depth?: number
}

export interface OrganizationHierarchyResponse {
  status: number
  message: string
  data: {
    ancestors: OrganizationHierarchyNode[]
    current: OrganizationHierarchyNode
    descendants: OrganizationHierarchyNode[]
  }
}

export interface Contact {
  id: string
  contactNo: string | null
  organizationId: string | null
  organizationName: string | null
  salutation: string | null
  firstName: string | null
  lastName: string
  title: string | null
  department: string | null
  email: string | null
  secondaryEmail: string | null
  phone: string | null
  mobile: string | null
  fax: string | null
  homePhone: string | null
  assistant: string | null
  assistantPhone: string | null
  reportsToId: string | null
  birthday: string | null
  leadSource: string | null
  doNotCall: boolean
  emailOptOut: boolean
  mailingStreet: string | null
  mailingCity: string | null
  mailingState: string | null
  mailingCode: string | null
  mailingCountry: string | null
  mailingPoBox: string | null
  otherStreet: string | null
  otherCity: string | null
  otherState: string | null
  otherCode: string | null
  otherCountry: string | null
  otherPoBox: string | null
  description: string | null
  assignedTo: string | null
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type ContactPayload = Partial<
  Omit<Contact, 'id' | 'contactNo' | 'organizationName' | 'createdAt' | 'updatedAt' | 'createdBy'>
>

export interface ContactListResponse {
  status: number
  message: string
  data: { items: Contact[]; pagination: CrmPagination }
}

export interface ContactResponse {
  status: number
  message: string
  data: Contact
}

export interface ContactListQuery {
  page?: number
  perPage?: number
  search?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  organizationId?: string
}

export interface Campaign {
  id: string
  campaignNo: string | null
  name: string
  campaignType: string | null
  campaignStatus: string | null
  expectedRevenue: number | null
  budgetCost: number | null
  actualCost: number | null
  expectedResponse: string | null
  numSent: number | null
  sponsor: string | null
  targetAudience: string | null
  targetSize: number | null
  expectedResponseCount: number | null
  expectedSalesCount: number | null
  actualResponseCount: number | null
  actualSalesCount: number | null
  expectedRoi: number | null
  actualRoi: number | null
  closingDate: string | null
  productId: string | null
  description: string | null
  assignedTo: string | null
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type CampaignPayload = Partial<Omit<Campaign, 'id' | 'campaignNo' | 'createdAt' | 'updatedAt' | 'createdBy'>>

export interface CampaignListResponse {
  status: number
  message: string
  data: { items: Campaign[]; pagination: CrmPagination }
}

export interface CampaignResponse {
  status: number
  message: string
  data: Campaign
}

export interface CampaignListQuery {
  page?: number
  perPage?: number
  search?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  campaignStatus?: string
}

// ── Bulk actions (shared across all 4 modules) ───────────────────────────

export interface CrmBulkResult {
  id: string
  ok: boolean
  reason?: string
}

export interface CrmBulkActionResponse {
  status: number
  message: string
  data: {
    results: CrmBulkResult[]
    summary: { succeeded: number; failed: number }
  }
}

/**
 * The CRM modules, by their list-view route segment. 'products' and
 * 'services' are two routes/menu rights over the same `crm_products` table
 * (see CrmProduct's own `itemType`) - deliberately still two CrmModule
 * values, since Recycle Bin/Saved Views/bulk-rights all scope by module.
 *
 * SMS Notifier (`sms_log`) is a member here (Saved Views/bulk-rights can
 * still scope by it) but has no detail page, and `CrmRecycleBinType` below
 * explicitly excludes it - `crm_sms_log` is an append-only log, never
 * soft-deleted, so it has nothing to recycle.
 */
export type CrmModule =
  | 'leads' | 'contacts' | 'organizations' | 'campaigns'
  | 'opportunities' | 'quotes' | 'products' | 'services' | 'sms_log' | 'price_books'
  | 'vendors' | 'sales_orders' | 'purchase_orders' | 'invoices'
  | 'tickets' | 'faqs' | 'service_contracts' | 'assets'

// ── Saved Views (shared across all 4 modules) ─────────────────────────────

export interface CrmSavedView {
  id: string
  module: CrmModule
  name: string
  /** That module's own query-param shape (search/status filter/sortBy/sortDir) - opaque here, applied back by the list view that saved it. */
  conditions: Record<string, unknown>
  createdAt: string | null
}

export interface CrmSavedViewListResponse {
  status: number
  message: string
  data: CrmSavedView[]
}

export interface CrmSavedViewResponse {
  status: number
  message: string
  data: CrmSavedView
}

// ── Duplicate detection + merge (Leads, Contacts, Organizations only -
// Campaigns aren't a "duplicate record" the way those 3 are) ─────────────

export interface CrmDuplicateGroup {
  key: string
  reason: string
  /** Shape varies per module (Lead/Contact/Organization) - read via getLabel/getSubLabel, not indexed directly. */
  rows: Array<Record<string, unknown> & { id: string }>
}

export interface CrmDuplicateGroupsResponse {
  status: number
  message: string
  data: CrmDuplicateGroup[]
}

export interface CrmMergeResponse {
  status: number
  message: string
  data: { survivorId: string; merged: number }
}

// ── CSV import/export (shared across all 4 modules) ──────────────────────

export interface CrmImportRowResult {
  row: number
  ok: boolean
  reason?: string
}

export interface CrmImportResponse {
  status: number
  message: string
  data: {
    created: number
    results: CrmImportRowResult[]
  }
}

// ── Recycle Bin (shared across all 4 modules) ─────────────────────────────

/**
 * Explicitly excludes 'sms_log', not just every other CrmModule member -
 * crm_sms_log has no `deleted_at` column at all (append-only by design,
 * confirmed in its own migration docblock), so CrmRecycleBinController's
 * own TYPES const was never given an sms_log entry either. A blind
 * `= CrmModule` alias would silently claim Recycle Bin support that
 * cannot exist.
 */
export type CrmRecycleBinType = Exclude<CrmModule, 'sms_log'>

export interface CrmRecycleBinItem {
  type: CrmRecycleBinType
  id: string
  name: string
  subLabel: string | null
  deletedAt: string
  deletedBy: string | null
}

export interface CrmRecycleBinListResponse {
  status: number
  message: string
  data: {
    items: CrmRecycleBinItem[]
    pagination: CrmPagination
  }
}

/** One targeted lead/contact/organization row on a campaign - `targetRowId` identifies the join row itself (for remove/status updates), `targetId` the underlying lead/contact/organization. */
export interface CampaignTarget {
  targetRowId: string
  targetId: string
  name: string
  subLabel: string | null
  responseStatus: string
}

export interface CampaignTargetsResponse {
  status: number
  message: string
  data: {
    leads: CampaignTarget[]
    contacts: CampaignTarget[]
    organizations: CampaignTarget[]
  }
}

// ═══════════════════════════════════════════════════════════════════════
// CRM Sales - Opportunities, Quotes, Products & Services, SMS Notifier.
//
// Named `CrmOpportunity`/`CrmQuote`/`CrmProduct`, never a bare `Opportunity`/
// `Quote`/`Product` - `services/signals/opportunities.ts` already exports a
// bare `Opportunity` (an unrelated AI buying-signal feature), and GTM's own
// `ACCOUNT_STAGES` includes the literal string 'opportunity'. Namespacing
// here avoids both collisions.
// ═══════════════════════════════════════════════════════════════════════

export interface CrmTaxRate {
  id: string
  name: string
  percentage: number
  isDefault: boolean
  isActive: boolean
}

export type CrmTaxRatePayload = Partial<Omit<CrmTaxRate, 'id'>>

export interface CrmTaxRateListResponse {
  status: number
  message: string
  data: CrmTaxRate[]
}

export interface CrmTaxRateResponse {
  status: number
  message: string
  data: CrmTaxRate
}

// ── Products & Services (one table, two routes - see CrmModule) ──────────

export type CrmItemType = 'product' | 'service'

export interface CrmProduct {
  id: string
  itemType: CrmItemType
  productNo: string | null
  name: string
  sku: string | null
  category: string | null
  glAccount: string | null
  description: string | null
  unitPrice: number | null
  costPrice: number | null
  commissionRate: number | null
  currency: string | null
  taxRateId: string | null
  taxRateName: string | null
  isActive: boolean
  /** Product-only - always null for a service row. */
  vendor: string | null
  qtyInStock: number | null
  /** Product-only - always null for a service row. */
  qtyInDemand: number | null
  reorderLevel: number | null
  weight: number | null
  usageUnit: string | null
  imageUrl: string | null
  assignedTo: string | null
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type CrmProductPayload = Partial<
  Omit<CrmProduct, 'id' | 'productNo' | 'taxRateName' | 'imageUrl' | 'createdAt' | 'updatedAt' | 'createdBy'>
>

export interface CrmProductBundleItem {
  id: string
  productId: string
  name: string
  itemType: CrmItemType
  unitPrice: number | null
  quantity: number
}

export interface CrmProductListResponse {
  status: number
  message: string
  data: { items: CrmProduct[]; pagination: CrmPagination }
}

export interface CrmProductResponse {
  status: number
  message: string
  data: CrmProduct
}

export interface CrmProductListQuery {
  page?: number
  perPage?: number
  search?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  category?: string
}

// ── Opportunities ──────────────────────────────────────────────────────────

export interface CrmOpportunity {
  id: string
  opportunityNo: string | null
  name: string
  organizationId: string | null
  organizationName: string | null
  campaignId: string | null
  campaignName: string | null
  amount: number | null
  currency: string | null
  closingDate: string | null
  salesStage: string | null
  probability: number | null
  /** Computed server-side (amount x probability / 100) - never sent in a payload. */
  weightedRevenue: number | null
  leadSource: string | null
  potentialType: string | null
  nextStep: string | null
  forecastCategory: string | null
  description: string | null
  convertedFromGtmDealId: string | null
  assignedTo: string | null
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type CrmOpportunityPayload = Partial<
  Omit<
    CrmOpportunity,
    'id' | 'opportunityNo' | 'organizationName' | 'campaignName' | 'weightedRevenue'
    | 'convertedFromGtmDealId' | 'createdAt' | 'updatedAt' | 'createdBy'
  >
>

export interface CrmOpportunityListResponse {
  status: number
  message: string
  data: { items: CrmOpportunity[]; pagination: CrmPagination }
}

export interface CrmOpportunityResponse {
  status: number
  message: string
  data: CrmOpportunity
}

export interface CrmOpportunityListQuery {
  page?: number
  perPage?: number
  search?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  salesStage?: string
  organizationId?: string
  contactId?: string
}

/** Stage-bucketed counts/values for the kanban board - mirrors GTM's own DealController::pipeline() shape. */
export interface CrmOpportunityPipelineResponse {
  status: number
  message: string
  data: {
    stages: Array<{
      stage: string
      label: string
      color: string | null
      count: number
      totalAmount: number
    }>
  }
}

export interface CrmOpportunityStageChangePayload {
  salesStage: string
  amount?: number | null
  probability?: number | null
  closingDate?: string | null
}

export interface CrmOpportunityStageHistoryEntry {
  id: string
  fromStage: string | null
  toStage: string | null
  amount: number | null
  probability: number | null
  closingDate: string | null
  changedBy: string | null
  createdAt: string | null
}

export interface CrmOpportunityStageHistoryResponse {
  status: number
  message: string
  data: CrmOpportunityStageHistoryEntry[]
}

/** A Contact linked to an Opportunity - `id` is the junction row (crm_opportunity_contacts), for removal. */
export interface CrmOpportunityContact {
  id: string
  contactId: string
  name: string
  subLabel: string | null
}

export interface CrmOpportunityContactsResponse {
  status: number
  message: string
  data: CrmOpportunityContact[]
}

/** A Product/Service tagged as "interested" on an Opportunity - unpriced, NOT a line item. `id` is the junction row (crm_opportunity_products). */
export interface CrmOpportunityProduct {
  id: string
  productId: string
  name: string
  itemType: CrmItemType
  quantity: number
}

export interface CrmOpportunityProductsResponse {
  status: number
  message: string
  data: CrmOpportunityProduct[]
}

// ── Quotes ─────────────────────────────────────────────────────────────────

export interface CrmQuote {
  id: string
  quoteNo: string | null
  subject: string
  organizationId: string | null
  organizationName: string | null
  contactId: string | null
  contactName: string | null
  opportunityId: string | null
  opportunityName: string | null
  priceBookId: string | null
  priceBookName: string | null
  quoteStage: string | null
  validTill: string | null
  currency: string | null
  subtotal: number
  discountPercent: number | null
  discountAmount: number
  shippingHandlingAmount: number
  adjustment: number
  taxTotal: number
  /** Server-authoritative - recomputed from line items on every save, never trusted from the client. */
  total: number
  billingStreet: string | null
  billingCity: string | null
  billingState: string | null
  billingCode: string | null
  billingCountry: string | null
  billingPoBox: string | null
  shippingStreet: string | null
  shippingCity: string | null
  shippingState: string | null
  shippingCode: string | null
  shippingCountry: string | null
  shippingPoBox: string | null
  termsConditions: string | null
  description: string | null
  assignedTo: string | null
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
}

/**
 * shippingHandlingAmount/adjustment ARE genuine inputs (CrmQuoteController's
 * own payload() mapper accepts both) - only subtotal/discountAmount/taxTotal/
 * total are server-computed outputs, recomputed from line items on every
 * save and never accepted from the client.
 */
export type CrmQuotePayload = Partial<
  Omit<
    CrmQuote,
    'id' | 'quoteNo' | 'organizationName' | 'contactName' | 'opportunityName' | 'priceBookName'
    | 'subtotal' | 'discountAmount' | 'taxTotal' | 'total'
    | 'createdAt' | 'updatedAt' | 'createdBy'
  >
>

export interface CrmQuoteListResponse {
  status: number
  message: string
  data: { items: CrmQuote[]; pagination: CrmPagination }
}

export interface CrmPriceBook {
  id: string
  priceBookNo: string | null
  name: string
  currency: string | null
  isActive: boolean
  description: string | null
  assignedTo: string | null
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type CrmPriceBookPayload = Partial<
  Omit<CrmPriceBook, 'id' | 'priceBookNo' | 'createdAt' | 'updatedAt' | 'createdBy'>
>

export interface CrmPriceBookListResponse {
  status: number
  message: string
  data: { items: CrmPriceBook[]; pagination: CrmPagination }
}

export interface CrmPriceBookResponse {
  status: number
  message: string
  data: CrmPriceBook
}

export interface CrmPriceBookItem {
  id: string
  productId: string
  name: string
  itemType: CrmItemType
  basePrice: number | null
  listPrice: number
}

export interface CrmQuoteResponse {
  status: number
  message: string
  data: CrmQuote
}

export interface CrmQuoteListQuery {
  page?: number
  perPage?: number
  search?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  quoteStage?: string
  organizationId?: string
  contactId?: string
  opportunityId?: string
}

export interface CrmQuoteLineItem {
  id: string
  productId: string | null
  description: string | null
  quantity: number
  unitPrice: number
  discountPercent: number | null
  discountAmount: number | null
  taxRateId: string | null
  /** Frozen at save time - editing crm_tax_rates later never changes an already-saved quote's total. */
  taxNameSnapshot: string | null
  taxPercentSnapshot: number | null
  lineTotal: number
  sequenceNo: number
}

/** The whole line-item set is replaced wholesale on every save - no per-line create/update/delete endpoints. */
export type CrmQuoteLineItemInput = Omit<CrmQuoteLineItem, 'id' | 'lineTotal' | 'taxNameSnapshot' | 'taxPercentSnapshot'>

export interface CrmQuoteLineItemsResponse {
  status: number
  message: string
  data: CrmQuoteLineItem[]
}

// ── Vendors ───────────────────────────────────────────────────────────────
// `CrmVendor`, never bare `Vendor` - `services/lms/governance.ts` already
// exports a bare `Vendor` type for an unrelated LMS-training-suppliers
// concept (same collision-avoidance reasoning this file already documents
// for CrmOpportunity/CrmQuote/CrmProduct).

export interface CrmVendor {
  id: string
  legacyId: string | null
  vendorNo: string | null
  name: string
  phone: string | null
  email: string | null
  website: string | null
  glAccount: string | null
  category: string | null
  street: string | null
  city: string | null
  state: string | null
  country: string | null
  postalCode: string | null
  poBox: string | null
  description: string | null
  isActive: boolean
  assignedTo: string | null
  assignedToName: string | null
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type CrmVendorPayload = Partial<Omit<CrmVendor, 'id' | 'vendorNo' | 'assignedToName' | 'createdAt' | 'updatedAt' | 'createdBy'>>

export interface CrmVendorListResponse {
  status: number
  message: string
  data: { items: CrmVendor[]; pagination: CrmPagination }
}

export interface CrmVendorResponse {
  status: number
  message: string
  data: CrmVendor
}

export interface CrmVendorListQuery {
  page?: number
  perPage?: number
  search?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  category?: string
  isActive?: boolean
}

/** A Contact linked to a Vendor - `id` is the junction row (crm_vendor_contacts), for removal. */
export interface CrmVendorContact {
  id: string
  contactId: string
  name: string
  subLabel: string | null
}

export interface CrmVendorContactsResponse {
  status: number
  message: string
  data: CrmVendorContact[]
}

// ── Sales Orders ───────────────────────────────────────────────────────────

export interface CrmSalesOrder {
  id: string
  legacyId: string | null
  soNo: string | null
  subject: string
  organizationId: string | null
  organizationName: string | null
  contactId: string | null
  contactName: string | null
  opportunityId: string | null
  opportunityName: string | null
  quoteId: string | null
  /** The source quote's own quoteNo, for display next to the quoteId link - denormalized the same way organizationName/contactName/opportunityName are. */
  quoteNo: string | null
  soStage: string | null
  dueDate: string | null
  carrier: string | null
  currency: string | null
  subtotal: number
  discountPercent: number | null
  discountAmount: number
  shippingHandlingAmount: number
  adjustment: number
  taxTotal: number
  /** Server-authoritative - recomputed from line items on every save, never trusted from the client. */
  total: number
  billingStreet: string | null
  billingCity: string | null
  billingState: string | null
  billingCode: string | null
  billingCountry: string | null
  billingPoBox: string | null
  shippingStreet: string | null
  shippingCity: string | null
  shippingState: string | null
  shippingCode: string | null
  shippingCountry: string | null
  shippingPoBox: string | null
  termsConditions: string | null
  description: string | null
  assignedTo: string | null
  assignedToName: string | null
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type CrmSalesOrderPayload = Partial<
  Omit<
    CrmSalesOrder,
    'id' | 'legacyId' | 'soNo' | 'organizationName' | 'contactName' | 'opportunityName' | 'quoteNo'
    | 'assignedToName' | 'subtotal' | 'discountAmount' | 'taxTotal' | 'total'
    | 'createdAt' | 'updatedAt' | 'createdBy'
  >
>

export interface CrmSalesOrderListResponse {
  status: number
  message: string
  data: { items: CrmSalesOrder[]; pagination: CrmPagination }
}

export interface CrmSalesOrderResponse {
  status: number
  message: string
  data: CrmSalesOrder
}

export interface CrmSalesOrderListQuery {
  page?: number
  perPage?: number
  search?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  soStage?: string
  organizationId?: string
  contactId?: string
  opportunityId?: string
  quoteId?: string
}

export interface CrmSalesOrderLineItem {
  id: string
  productId: string | null
  description: string | null
  quantity: number
  unitPrice: number
  discountPercent: number | null
  discountAmount: number | null
  taxRateId: string | null
  /** Frozen at save time - editing crm_tax_rates later never changes an already-saved sales order's total. */
  taxNameSnapshot: string | null
  taxPercentSnapshot: number | null
  lineTotal: number
  sequenceNo: number
}

/** The whole line-item set is replaced wholesale on every save - no per-line create/update/delete endpoints. */
export type CrmSalesOrderLineItemInput = Omit<CrmSalesOrderLineItem, 'id' | 'lineTotal' | 'taxNameSnapshot' | 'taxPercentSnapshot'>

export interface CrmSalesOrderLineItemsResponse {
  status: number
  message: string
  data: CrmSalesOrderLineItem[]
}

export interface CrmSalesOrderStatusHistoryEntry {
  id: string
  fromStage: string | null
  toStage: string | null
  total: number | null
  changedBy: string | null
  createdAt: string | null
}

export interface CrmSalesOrderStatusHistoryResponse {
  status: number
  message: string
  data: CrmSalesOrderStatusHistoryEntry[]
}

// ── Purchase Orders ──────────────────────────────────────────────────────

export interface CrmPurchaseOrder {
  id: string
  poNo: string | null
  subject: string
  vendorId: string | null
  vendorName: string | null
  organizationId: string | null
  organizationName: string | null
  contactId: string | null
  contactName: string | null
  quoteId: string | null
  quoteNo: string | null
  poStage: string | null
  requisitionNo: string | null
  trackingNo: string | null
  dueDate: string | null
  currency: string | null
  subtotal: number
  discountPercent: number | null
  discountAmount: number
  shippingHandlingAmount: number
  adjustment: number
  taxTotal: number
  /** Server-authoritative - recomputed from line items on every save, never trusted from the client. */
  total: number
  billingStreet: string | null
  billingCity: string | null
  billingState: string | null
  billingCode: string | null
  billingCountry: string | null
  billingPoBox: string | null
  shippingStreet: string | null
  shippingCity: string | null
  shippingState: string | null
  shippingCode: string | null
  shippingCountry: string | null
  shippingPoBox: string | null
  termsConditions: string | null
  description: string | null
  assignedTo: string | null
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
}

/**
 * vendorId IS a genuine input and is REQUIRED at the application-validation
 * level in store()/update() even though nullable at the DB level (legacy
 * marks Vendor mandatory on a Purchase Order) - every other FK here stays
 * optional, same as Quotes. subtotal/discountAmount/taxTotal/total are
 * server-computed outputs only, recomputed from line items on every save.
 */
export type CrmPurchaseOrderPayload = Partial<
  Omit<
    CrmPurchaseOrder,
    'id' | 'poNo' | 'vendorName' | 'organizationName' | 'contactName' | 'quoteNo'
    | 'subtotal' | 'discountAmount' | 'taxTotal' | 'total'
    | 'createdAt' | 'updatedAt' | 'createdBy'
  >
>

export interface CrmPurchaseOrderListResponse {
  status: number
  message: string
  data: { items: CrmPurchaseOrder[]; pagination: CrmPagination }
}

export interface CrmPurchaseOrderResponse {
  status: number
  message: string
  data: CrmPurchaseOrder
}

export interface CrmPurchaseOrderListQuery {
  page?: number
  perPage?: number
  search?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  poStage?: string
  vendorId?: string
  organizationId?: string
  contactId?: string
  quoteId?: string
}

export interface CrmPurchaseOrderLineItem {
  id: string
  productId: string | null
  description: string | null
  quantity: number
  unitPrice: number
  discountPercent: number | null
  discountAmount: number | null
  taxRateId: string | null
  /** Frozen at save time - editing crm_tax_rates later never changes an already-saved purchase order's total. */
  taxNameSnapshot: string | null
  taxPercentSnapshot: number | null
  lineTotal: number
  sequenceNo: number
}

/** The whole line-item set is replaced wholesale on every save - no per-line create/update/delete endpoints. */
export type CrmPurchaseOrderLineItemInput = Omit<CrmPurchaseOrderLineItem, 'id' | 'lineTotal' | 'taxNameSnapshot' | 'taxPercentSnapshot'>

export interface CrmPurchaseOrderLineItemsResponse {
  status: number
  message: string
  data: CrmPurchaseOrderLineItem[]
}

export interface CrmPurchaseOrderStageChangePayload {
  poStage: string
}

export interface CrmPurchaseOrderStatusHistoryEntry {
  id: string
  fromStage: string | null
  toStage: string | null
  total: number | null
  changedBy: string | null
  createdAt: string | null
}

export interface CrmPurchaseOrderStageHistoryResponse {
  status: number
  message: string
  data: CrmPurchaseOrderStatusHistoryEntry[]
}

// ── Invoices ───────────────────────────────────────────────────────────────

export interface CrmInvoice {
  id: string
  legacyId: string | null
  invoiceNo: string | null
  subject: string
  salesOrderId: string | null
  salesOrderNo: string | null
  organizationId: string | null
  organizationName: string | null
  contactId: string | null
  contactName: string | null
  invoiceStage: string | null
  invoiceDate: string | null
  dueDate: string | null
  currency: string | null
  subtotal: number
  discountPercent: number | null
  discountAmount: number
  shippingHandlingAmount: number
  adjustment: number
  taxTotal: number
  /** Server-authoritative - recomputed from line items (or copied from the source Sales Order via fromSalesOrder()) on every save, never trusted from the client. */
  total: number
  billingStreet: string | null
  billingCity: string | null
  billingState: string | null
  billingCode: string | null
  billingCountry: string | null
  billingPoBox: string | null
  shippingStreet: string | null
  shippingCity: string | null
  shippingState: string | null
  shippingCode: string | null
  shippingCountry: string | null
  shippingPoBox: string | null
  termsConditions: string | null
  description: string | null
  assignedTo: string | null
  assignedToName: string | null
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
}

/**
 * shippingHandlingAmount/adjustment ARE genuine inputs - only subtotal/
 * discountAmount/taxTotal/total are server-computed outputs, recomputed
 * from line items on every save and never accepted from the client.
 * invoiceStage is NOT mandatory (unlike so_stage/po_stage on its siblings).
 */
export type CrmInvoicePayload = Partial<
  Omit<
    CrmInvoice,
    'id' | 'legacyId' | 'invoiceNo' | 'salesOrderNo' | 'organizationName' | 'contactName' | 'assignedToName'
    | 'subtotal' | 'discountAmount' | 'taxTotal' | 'total'
    | 'createdAt' | 'updatedAt' | 'createdBy'
  >
>

export interface CrmInvoiceListResponse {
  status: number
  message: string
  data: { items: CrmInvoice[]; pagination: CrmPagination }
}

export interface CrmInvoiceResponse {
  status: number
  message: string
  data: CrmInvoice
}

export interface CrmInvoiceListQuery {
  page?: number
  perPage?: number
  search?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  invoiceStage?: string
  organizationId?: string
  contactId?: string
  salesOrderId?: string
}

export interface CrmInvoiceStageChangePayload {
  invoiceStage: string
}

export interface CrmInvoiceStatusHistoryEntry {
  id: string
  fromStage: string | null
  toStage: string | null
  total: number | null
  changedBy: string | null
  createdAt: string | null
}

export interface CrmInvoiceStatusHistoryResponse {
  status: number
  message: string
  data: CrmInvoiceStatusHistoryEntry[]
}

export interface CrmInvoiceLineItem {
  id: string
  productId: string | null
  description: string | null
  quantity: number
  unitPrice: number
  discountPercent: number | null
  discountAmount: number | null
  taxRateId: string | null
  /** Frozen at save time - editing crm_tax_rates later never changes an already-saved invoice's total. */
  taxNameSnapshot: string | null
  taxPercentSnapshot: number | null
  lineTotal: number
  sequenceNo: number
}

/** The whole line-item set is replaced wholesale on every save - no per-line create/update/delete endpoints. Structurally identical to CrmQuoteLineItemInput, so quote-line-item-table.tsx's QuoteLineItemTable is reused as-is for Invoices. */
export type CrmInvoiceLineItemInput = Omit<CrmInvoiceLineItem, 'id' | 'lineTotal' | 'taxNameSnapshot' | 'taxPercentSnapshot'>

export interface CrmInvoiceLineItemsResponse {
  status: number
  message: string
  data: CrmInvoiceLineItem[]
}

// ── Service Contracts ────────────────────────────────────────────────────

export interface CrmServiceContract {
  id: string
  legacyId: string | null
  contractNo: string | null
  subject: string
  organizationId: string | null
  organizationName: string | null
  contactId: string | null
  contactName: string | null
  startDate: string | null
  endDate: string | null
  dueDate: string | null
  trackingUnit: string | null
  totalUnits: number | null
  /** Server-authoritative - written only by Tickets' consumption-math when a linked ticket closes/reopens/changes, and by this controller's own manual-complete auto-stamp. Never accept this from the client. */
  usedUnits: number | null
  /** Server-authoritative - same reasoning as usedUnits. */
  progress: number | null
  contractStatus: string | null
  contractType: string | null
  priority: string | null
  assignedTo: string | null
  assignedToName: string | null
  createdAt: string | null
  updatedAt: string | null
}

/**
 * totalUnits/trackingUnit/etc ARE genuine inputs - only usedUnits/progress
 * are server-computed outputs, never accepted from the client (same
 * reasoning as CrmQuote's subtotal/total fields being excluded here).
 */
export type CrmServiceContractPayload = Partial<
  Omit<
    CrmServiceContract,
    'id' | 'legacyId' | 'contractNo' | 'organizationName' | 'contactName' | 'assignedToName'
    | 'usedUnits' | 'progress' | 'createdAt' | 'updatedAt'
  >
>

export interface CrmServiceContractListResponse {
  status: number
  message: string
  data: { items: CrmServiceContract[]; pagination: CrmPagination }
}

export interface CrmServiceContractResponse {
  status: number
  message: string
  data: CrmServiceContract
}

export interface CrmServiceContractListQuery {
  page?: number
  perPage?: number
  search?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  contractStatus?: string
  organizationId?: string
  contactId?: string
}

// ── Assets (Support phase) ────────────────────────────────────────────────
// `CrmAsset`, never bare `Asset` - `components/domain/talent/onboarding/
// onboarding-tabs.tsx` already exports a bare `OnbAsset`/`AssetsPanel` for an
// unrelated employee IT-equipment-issuance concept (same collision-avoidance
// reasoning this file already documents for CrmOpportunity/CrmQuote/
// CrmProduct/CrmVendor).

export interface CrmAsset {
  id: string
  legacyId: string | null
  assetNo: string | null
  assetName: string
  productId: string | null
  productName: string | null
  organizationId: string | null
  organizationName: string | null
  serialNumber: string | null
  tagNumber: string | null
  dateSold: string | null
  dateInService: string | null
  status: string | null
  shippingMethod: string | null
  shippingTrackingNumber: string | null
  invoiceId: string | null
  invoiceNo: string | null
  description: string | null
  assignedTo: string | null
  assignedToName: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type CrmAssetPayload = Partial<
  Omit<CrmAsset, 'id' | 'legacyId' | 'assetNo' | 'productName' | 'organizationName' | 'invoiceNo' | 'assignedToName' | 'createdAt' | 'updatedAt'>
>

export interface CrmAssetListResponse {
  status: number
  message: string
  data: { items: CrmAsset[]; pagination: CrmPagination }
}

export interface CrmAssetResponse {
  status: number
  message: string
  data: CrmAsset
}

export interface CrmAssetListQuery {
  page?: number
  perPage?: number
  search?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  status?: string
  productId?: string
  organizationId?: string
}

// ── Tickets (legacy "HelpDesk") ─────────────────────────────────────────

export interface CrmTicket {
  id: string
  legacyId: string | null
  ticketNo: string | null
  title: string
  organizationId: string | null
  organizationName: string | null
  contactId: string | null
  contactName: string | null
  productId: string | null
  productName: string | null
  assetId: string | null
  assetName: string | null
  serviceContractId: string | null
  serviceContractNo: string | null
  status: string | null
  priority: string | null
  severity: string | null
  category: string | null
  description: string | null
  solution: string | null
  hours: number | null
  days: number | null
  assignedTo: string | null
  assignedToName: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type CrmTicketPayload = Partial<
  Omit<
    CrmTicket,
    'id' | 'legacyId' | 'ticketNo' | 'organizationName' | 'contactName' | 'productName'
    | 'assetName' | 'serviceContractNo' | 'assignedToName' | 'createdAt' | 'updatedAt'
  >
>

export interface CrmTicketListResponse {
  status: number
  message: string
  data: { items: CrmTicket[]; pagination: CrmPagination }
}

export interface CrmTicketResponse {
  status: number
  message: string
  data: CrmTicket
}

export interface CrmTicketListQuery {
  page?: number
  perPage?: number
  search?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  status?: string
  priority?: string
  severity?: string
  category?: string
  organizationId?: string
  contactId?: string
  assetId?: string
  serviceContractId?: string
  assignedTo?: string
}

export interface CrmTicketStatusChangePayload {
  status: string
}

export interface CrmTicketComment {
  id: string
  comment: string
  createdBy: string | null
  createdByName: string | null
  createdAt: string | null
}

export interface CrmTicketCommentsResponse {
  status: number
  message: string
  data: CrmTicketComment[]
}

export interface CrmTicketStatusHistoryEntry {
  id: string
  fromStatus: string | null
  toStatus: string | null
  changedBy: string | null
  changedByName: string | null
  createdAt: string | null
}

export interface CrmTicketStatusHistoryResponse {
  status: number
  message: string
  data: CrmTicketStatusHistoryEntry[]
}

// ── FAQ ──────────────────────────────────────────────────────────────────

export interface CrmFaq {
  id: string
  legacyId: string | null
  faqNo: string | null
  question: string
  answer: string | null
  category: string | null
  status: string | null
  productId: string | null
  productName: string | null
  assignedTo: string | null
  assignedToName: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type CrmFaqPayload = Partial<
  Omit<CrmFaq, 'id' | 'legacyId' | 'faqNo' | 'productName' | 'assignedToName' | 'createdAt' | 'updatedAt'>
>

export interface CrmFaqListResponse {
  status: number
  message: string
  data: { items: CrmFaq[]; pagination: CrmPagination }
}

export interface CrmFaqResponse {
  status: number
  message: string
  data: CrmFaq
}

export interface CrmFaqListQuery {
  page?: number
  perPage?: number
  search?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  category?: string
  status?: string
  productId?: string
}

// ── SMS Notifier ───────────────────────────────────────────────────────────

export type CrmSmsStatus = 'queued' | 'sent' | 'failed'

export interface CrmSmsLogEntry {
  id: string
  toNumber: string
  message: string
  status: CrmSmsStatus
  errorReason: string | null
  relatedType: string | null
  relatedId: string | null
  sentBy: string | null
  createdAt: string | null
}

export interface CrmSmsLogListResponse {
  status: number
  message: string
  data: { items: CrmSmsLogEntry[]; pagination: CrmPagination }
}

export interface CrmSendSmsPayload {
  toNumber: string
  message: string
  relatedType?: string
  relatedId?: string
}

export interface CrmSendSmsResponse {
  status: number
  message: string
  data: CrmSmsLogEntry
}

export interface CrmBulkSendSmsResponse {
  status: number
  message: string
  data: {
    sent: number
    failed: number
    results: Array<{ id: string; ok: boolean; reason?: string }>
  }
}
