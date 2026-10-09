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
