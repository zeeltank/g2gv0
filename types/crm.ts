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
  description: string | null
  assignedTo: string | null
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type LeadPayload = Partial<
  Omit<Lead, 'id' | 'converted' | 'convertedOrganizationId' | 'convertedContactId' | 'createdAt' | 'updatedAt' | 'createdBy'>
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
  assignedTo: string
}

export interface ConvertLeadResponse {
  status: number
  message: string
  data: {
    organizationId: string | null
    contactId: string | null
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

// ── Recycle Bin (shared across all 4 modules) ─────────────────────────────

export type CrmRecycleBinType = 'leads' | 'contacts' | 'organizations' | 'campaigns'

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
