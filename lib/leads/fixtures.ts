import type { Lead, LeadSourceSignal } from '../../types/crm'
import type { PmOption } from '../../services/product-master/types'

/** One lead, shaped like the existing presenter's answer (camelCase), with none of slice 6's fields: what an older server sends. */
export function lead(over: Partial<Lead> = {}): Lead {
  return {
    id: '41', leadNo: 'LEAD-0041', salutation: null, firstName: 'Asha', lastName: 'Menon', company: 'Hillcrest Academy', designation: null,
    email: 'asha@hillcrest.example.edu', secondaryEmail: null, phone: null, mobile: null, fax: null, website: null, industry: null,
    leadSource: 'Signals', leadStatus: 'Not Contacted', rating: null, leadScore: 55, leadScoreBasis: [], annualRevenue: null, numberOfEmp: null,
    emailOptOut: false, lifecycleStatus: 'new', nextAction: null, followUpDueDate: null, consentStatus: null, suppressedAt: null, campaignText: null,
    street: null, city: null, state: null, country: null, postalCode: null, poBox: null, converted: false,
    convertedOrganizationId: null, convertedContactId: null, convertedOpportunityId: null, description: null, assignedTo: null, createdBy: null,
    createdAt: '2026-11-01 10:00:00', updatedAt: null, hasRealName: true, ...over,
  }
}

export function signal(over: Partial<LeadSourceSignal> = {}): LeadSourceSignal {
  return {
    id: 77, title: 'Hillcrest Academy plans a new ERP rollout', sourceUrl: 'https://news.example.com/hillcrest-erp', eventDate: '2026-10-12',
    businessFit: 'scholarclone', quote: null, ...over,
  }
}

export const options: PmOption[] = [
  { id: 4, key: 'scholarclone', name: 'ScholarClone', kind: 'product', parentId: null, label: 'ScholarClone' },
  { id: 9, key: 'scholarclone-erp', name: 'School ERP', kind: 'sub_product', parentId: 4, label: 'ScholarClone › School ERP' },
  { id: 12, key: 'g2g', name: 'G2G', kind: 'product', parentId: null, label: 'G2G' },
]

/** A lead as the S6a contract says the server will send it: the contract's snake_case names, the rest in the presenter's camelCase. */
export function contractLead(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...lead(),
    product: { id: 9, key: 'scholarclone-erp', name: 'School ERP' },
    organisation_account: { id: 58, name: 'Hillcrest Academy' },
    source_signal_id: 77,
    ...over,
  }
}
