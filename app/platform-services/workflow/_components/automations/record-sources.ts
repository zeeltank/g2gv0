import { getLaravelContext } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import { dealService, gtmService } from '@/services/gtm/gtm'
import { renewalService } from '@/services/gtm/customers'

/** A real record an automation can be tried on, named the way a person knows it. */
export interface RecordChoice {
  id: number
  label: string
  hint?: string
}

const PER_PAGE = 8

const numeric = (id: string | number): number => Number(id)
const named = (...parts: Array<string | null | undefined>): string => parts.map((p) => (p ?? '').trim()).filter(Boolean).join(' ')

/**
 * Where to find the records of each kind an automation can be about. Leads, opportunities, quotes, sales orders and invoices come from the CRM, accounts,
 * deals and renewals from the GTM screens. A kind not listed here (a contact, an outreach message) has no list to pick from, and the person types the
 * record's number instead.
 */
const SOURCES: Readonly<Record<string, (search: string) => Promise<RecordChoice[]>>> = {
  crm_leads: async (search) => {
    const r = await crmService.getLeads(getLaravelContext(), { search: search || undefined, perPage: PER_PAGE })
    return r.data.items.map((l) => ({ id: numeric(l.id), label: named(l.firstName, l.lastName) || l.company || `Lead ${l.id}`, hint: l.company ?? undefined }))
  },
  crm_opportunities: async (search) => {
    const r = await crmService.getOpportunities(getLaravelContext(), { search: search || undefined, perPage: PER_PAGE })
    return r.data.items.map((o) => ({ id: numeric(o.id), label: o.name, hint: o.organizationName ?? undefined }))
  },
  crm_quotes: async (search) => {
    const r = await crmService.getQuotes(getLaravelContext(), { search: search || undefined, perPage: PER_PAGE })
    return r.data.items.map((q) => ({ id: numeric(q.id), label: q.subject, hint: q.organizationName ?? undefined }))
  },
  crm_sales_orders: async (search) => {
    const r = await crmService.getSalesOrders(getLaravelContext(), { search: search || undefined, perPage: PER_PAGE })
    return r.data.items.map((o) => ({ id: numeric(o.id), label: o.subject, hint: o.organizationName ?? undefined }))
  },
  crm_invoices: async (search) => {
    const r = await crmService.getInvoices(getLaravelContext(), { search: search || undefined, perPage: PER_PAGE })
    return r.data.items.map((i) => ({ id: numeric(i.id), label: i.subject, hint: i.organizationName ?? undefined }))
  },
  gtm_accounts: async (search) => {
    const r = await gtmService.listAccounts({ q: search || undefined })
    return r.data.items.slice(0, PER_PAGE).map((a) => ({ id: a.id, label: a.name, hint: a.industry ?? undefined }))
  },
  gtm_deals: async (search) => {
    const r = await dealService.list({ q: search || undefined })
    return r.data.items.slice(0, PER_PAGE).map((d) => ({ id: d.id, label: d.name, hint: d.account_name }))
  },
  gtm_renewals: async (search) => {
    const r = await renewalService.list()
    const q = search.trim().toLowerCase()
    return r.data.items
      .filter((x) => q === '' || x.name.toLowerCase().includes(q) || (x.account_name ?? '').toLowerCase().includes(q))
      .slice(0, PER_PAGE)
      .map((x) => ({ id: x.id, label: x.name, hint: x.account_name }))
  },
}

/** True when there is a list of this kind of record to pick from. */
export function hasRecordSource(entity: string | null | undefined): boolean {
  return Boolean(entity && SOURCES[entity])
}

/** The first records of this kind, or those that match the search. */
export function loadRecords(entity: string, search: string): Promise<RecordChoice[]> {
  const source = SOURCES[entity]
  return source ? source(search.trim()) : Promise.resolve([])
}
