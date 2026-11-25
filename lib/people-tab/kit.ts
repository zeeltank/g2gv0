import { screenKit, type Call } from '../facts/screen-kit'
import { consentData, entityData } from '../facts/fixtures'
import type { Contact, CrmAuditEntry, CrmComment, CrmEmailLinkEntry, CrmLinkedDocument, ContactDeals, Organization } from '../../types/crm'

/**
 * Test support for the People tab, the Person panel and the company-wide tabs (S18): a fake browser (the facts screen kit), a menu whose Contacts row carries
 * the `can_*` flags the server sends, and a stand-in for the CRM API with a little state (the people of the company, Primary, deletes) that records every call.
 * It has no tests of its own and never touches the network.
 */

export type { Call }

export interface Rights { view?: boolean; add?: boolean; edit?: boolean; delete?: boolean }

export const ALL_RIGHTS: Rights = { view: true, add: true, edit: true, delete: true }

const flag = (value: boolean | undefined) => (value ? 1 : 0)

/** The part of the menu these screens use, as `ajax_sidebar_menu_g2g` answers it: the Contacts row with the person's rights, or no Contacts row at all (revoked). */
export function menuWith(rights: Rights | null) {
  const leaf = (id: number, label: string, access_link: string, extra: Record<string, unknown> = {}) => ({ id, label, icon: null, access_link, page_type: 'page', sort_order: id, parent_id: 199, children: [], ...extra })
  const children = [
    leaf(452, 'Organizations', '/module/crm/marketing/organizations'),
    leaf(461, 'Opportunities', '/module/crm/sales/opportunities'),
    leaf(462, 'Quotes', '/module/crm/sales/quotes'),
    leaf(463, 'Sales Orders', '/module/crm/sales/sales-orders'),
    leaf(464, 'Invoices', '/module/crm/sales/invoices'),
    leaf(465, 'Tickets', '/module/crm/support/tickets'),
  ]
  if (rights) children.push(leaf(451, 'Contacts', '/module/crm/marketing/contacts', { can_view: flag(rights.view ?? true), can_add: flag(rights.add), can_edit: flag(rights.edit), can_delete: flag(rights.delete) }))
  return [{ id: 199, label: 'Sales & Marketing', icon: null, access_link: '/module/crm', page_type: null, sort_order: 1, parent_id: null, children }]
}

export function person(over: Partial<Contact> = {}): Contact {
  return {
    id: '31', contactNo: 'CON-0031', organizationId: '135', organizationName: 'Hillcrest Academy', salutation: 'Mrs.', firstName: 'Meera', lastName: 'Patel', title: 'Principal', department: 'Management',
    email: 'meera@hillcrest.example.edu', secondaryEmail: null, phone: '079 4000 1200', mobile: '98250 11122', fax: null, homePhone: null, assistant: null, assistantPhone: null, reportsToId: null,
    birthday: null, leadSource: null, doNotCall: false, emailOptOut: false, mailingStreet: null, mailingCity: null, mailingState: null, mailingCode: null, mailingCountry: null,
    mailingPoBox: null, otherStreet: null, otherCity: null, otherState: null, otherCode: null, otherCountry: null, otherPoBox: null, description: null, assignedTo: '2', createdBy: null,
    createdAt: null, updatedAt: null, isPrimary: false, contactRole: null, reportsToName: null, linkedinUrl: null, ...over,
  }
}

export const meera = () => person({ isPrimary: true, contactRole: 'Decision maker' })
export const rakesh = () => person({ id: '32', contactNo: 'CON-0032', salutation: null, firstName: 'Rakesh', lastName: 'Shah', title: 'Accountant', department: 'Finance', email: 'rakesh@hillcrest.example.edu', phone: '079 4000 1203', mobile: null, contactRole: 'Billing', assignedTo: '9' })
export const nidhi = () => person({ id: '33', contactNo: 'CON-0033', salutation: null, firstName: 'Nidhi', lastName: 'Joshi', title: 'IT Coordinator', department: 'IT', email: null, phone: null, mobile: '98250 33344', doNotCall: true, contactRole: 'Technical' })

export function organization(over: Partial<Organization> = {}): Organization {
  return {
    id: '135', accountNo: 'ACC-000135', name: 'Hillcrest Academy', parentId: null, accountType: 'Customer', industry: 'Education', rating: null, ownership: null, annualRevenue: null, employees: null,
    sicCode: null, tickerSymbol: null, phone: '079 4000 1000', secondaryPhone: null, email: 'office@hillcrest.example.edu', secondaryEmail: null, website: null, fax: null, emailOptOut: false,
    billingStreet: null, billingCity: 'Ahmedabad', billingState: null, billingCode: null, billingCountry: null, billingPoBox: null, shippingStreet: null, shippingCity: null, shippingState: null,
    shippingCode: null, shippingCountry: null, shippingPoBox: null, description: null, assignedTo: '2', createdBy: null, createdAt: null, updatedAt: null, ...over,
  }
}

/** A row of a company-wide list as the server tags it: `personName` is null for the company's own row. */
export const tagged = <T extends object>(row: T, personName: string | null, personId: string | null = null): T & { personId: string | null; personName: string | null } => ({ ...row, personId, personName })

export interface World {
  people: Contact[]
  /** Who a person can be assigned to (default: Milan Baldaniya, user 2). */
  employees?: Array<{ id: number; first_name: string; last_name?: string }>
  /** The companies the company picker offers (default: Hillcrest Academy and Sunrise Academy). */
  companies?: Organization[]
  /** The rows of each company-wide list, company rows first; `include=company` answers only those with a null `personName`. */
  emails?: Array<CrmEmailLinkEntry>
  comments?: Array<CrmComment>
  documents?: Array<CrmLinkedDocument>
  history?: Array<CrmAuditEntry>
  quotes?: Array<Record<string, unknown>>
  events?: Array<Record<string, unknown>>
  deals?: Partial<ContactDeals>
  /** What the Account 360 call answers as contact lines (the GTM strip keeps the ones whose source is `gtm`). */
  gtm?: Array<{ source: 'crm' | 'gtm'; id: number; name: string; email: string | null; phone: string | null; role: string | null; consent_status: string | null }> | 'fails'
  roles?: Array<{ value: string; label: string }>
  /** The custom field definitions of `crm_contacts` (none by default). */
  customFields?: Array<{ id: number; field_label: string; field_type: string; value: string | null }>
  /** A refusal for the next write, as `[status, message]`. */
  refuse?: [number, string]
  created?: Contact
}

const page = (items: unknown[]) => ({ status: 1, message: 'ok', data: { items, pagination: { current_page: 1, last_page: 1, per_page: 100, total: items.length } } })
const refused = (status: number, message: string) => ({ __status: status, status: 0, message })
const lower = (value: string | null | undefined) => (value ?? '').toLowerCase()

/** The CRM API as the screens call it, answering from `world` (which a test can change between steps). */
export function crmApi(world: World) {
  return (call: Call): unknown => {
    const path = call.path.replace(/^.*?\/(?=crm\/|org-accounts\/|task-management\/|platform\/)/, '/')
    const q = call.query
    const by = (id: string) => world.people.find((p) => p.id === id)

    if (call.method === 'GET' && path === '/crm/contacts') {
      const needle = lower(q.get('search'))
      const rows = world.people.filter((p) => (!q.get('organization_id') || p.organizationId === q.get('organization_id'))
        && (q.get('primary') !== '1' || p.isPrimary)
        && (!q.get('owner') || p.assignedTo === q.get('owner'))
        && (q.get('do_not_call') !== '1' || p.doNotCall)
        && (!needle || [p.firstName, p.lastName, p.email, p.phone, p.mobile, p.title].some((v) => lower(v).includes(needle))))
      return page(rows)
    }
    if (call.method === 'POST' && path === '/crm/contacts') {
      if (world.refuse) { const [s, m] = world.refuse; return refused(s, m) }
      const made = world.created ?? person({ id: '99', contactNo: 'CON-0099', firstName: String((call.body as { firstName?: string }).firstName ?? ''), lastName: String((call.body as { lastName?: string }).lastName ?? 'New') })
      world.people.push(made)
      return { status: 1, message: 'Contact created.', data: made }
    }
    const one = /^\/crm\/contacts\/(\d+)(?:\/([a-z-]+))?$/.exec(path)
    if (one) {
      const [, id, sub] = one
      const found = by(id)
      if (!sub) {
        if (!found) return refused(404, 'Contact not found.')
        if (call.method === 'GET') return { status: 1, message: 'Contact.', data: found }
        if (call.method === 'PUT') { Object.assign(found, call.body as object); return { status: 1, message: 'Contact updated.', data: found } }
        if (call.method === 'DELETE') { world.people = world.people.filter((p) => p.id !== id); return { status: 1, message: 'Contact moved to Recycle Bin.' } }
      }
      if (sub === 'primary' && found) {
        if (call.method === 'POST') {
          if (!found.organizationId) return refused(422, 'A person needs a company before it can be the primary contact.')
          for (const p of world.people) if (p.organizationId === found.organizationId) p.isPrimary = false
          found.isPrimary = true
        } else { found.isPrimary = false }
        return { status: 1, message: 'Primary updated.', data: found }
      }
      if (sub === 'deals') return { status: 1, message: 'Deals.', data: { opportunities: [], quotes: [], salesOrders: [], invoices: [], tickets: [], ...world.deals } }
      if (['comments', 'documents', 'emails', 'history'].includes(sub ?? '')) return { status: 1, message: 'ok', data: [] }
    }

    const company = /^\/crm\/organizations\/(\d+)\/(emails|comments|documents|history)$/.exec(path)
    if (company && call.method === 'GET') {
      const rows = (world[company[2] as 'emails'] ?? []) as Array<{ personName?: string | null }>
      return { status: 1, message: 'ok', data: q.get('include') === 'company' ? rows.filter((r) => !r.personName) : rows }
    }
    if (call.method === 'GET' && path === '/crm/quotes') {
      const rows = (world.quotes ?? []) as Array<{ personName?: string | null }>
      return { status: 1, message: 'ok', data: { items: q.get('include') === 'company' ? rows.filter((r) => !r.personName) : rows, pagination: { current_page: 1, last_page: 1, per_page: 50, total: rows.length } } }
    }
    if (call.method === 'GET' && /^\/crm\/opportunities$/.test(path)) return page([])
    if (call.method === 'GET' && path === '/crm/organizations') return page(world.companies ?? [organization(), organization({ id: '200', name: 'Sunrise Academy', accountNo: 'ACC-000200' })])
    if (call.method === 'GET' && /^\/crm\/organizations\/\d+\/projects$/.test(path)) return { status: 1, message: 'ok', data: [] }
    if (call.method === 'GET' && /^\/task-management\/calendar\/events\/linked\//.test(path)) {
      const rows = (world.events ?? []) as Array<{ personName?: string | null }>
      return { status: 1, message: 'ok', data: { entries: q.get('include') === 'company' ? rows.filter((r) => !r.personName) : rows } }
    }
    if (call.method === 'POST' && /^\/org-accounts\/for-crm\//.test(path)) {
      if (world.gtm === 'fails') return refused(403, 'No access.')
      return { status: 1, created: false, data: { contacts: world.gtm ?? [] } }
    }
    if (call.method === 'GET' && /\/table_data$/.test(call.path)) return world.employees ?? [{ id: 2, first_name: 'Milan', last_name: 'Baldaniya' }]
    if (call.method === 'GET' && path === '/crm/picklist-values') {
      return { status: 1, message: 'ok', data: { contacts: { salutation: [{ value: 'Mrs.', label: 'Mrs.' }], lead_source: [{ value: 'Referral', label: 'Referral' }], contact_role: (world.roles ?? []).map((r, i) => ({ id: String(i), module: 'contacts', fieldKey: 'contact_role', sortOrder: i, isDefault: false, ...r })) } } }
    }
    if (/\/platform\/fields\/values\//.test(call.path)) {
      return { success: true, message: 'ok', errors: null, data: { record_table: 'crm_contacts', record_id: 31, fields: (world.customFields ?? []).map((f) => ({ field_name: `f${f.id}`, field_message: null, required: false, sort_order: f.id, min_value: null, max_value: null, validation_pattern: null, options: [], ...f })), saved: 1, ignored: [], invalid: {} } }
    }
    if (/\/facts\/entity\//.test(call.path)) return entityData({ facts: [], counts: { proposed: 0, applied: 0, dismissed: 0 } })
    if (/\/consent\/[a-z]+\/\d+$/.test(call.path)) return consentData()
    return undefined
  }
}

/** Opens a fake browser signed in with the given rights on the Contacts rows (`null`: no Contacts row at all). */
export async function peopleKit(options: { rights?: Rights | null; world?: Partial<World>; search?: string; pathname?: string } = {}) {
  const world: World = { people: [meera(), rakesh(), nidhi()], ...options.world }
  const screen = await screenKit({ search: options.search ?? '', pathname: options.pathname ?? '/module/crm/marketing/organizations/135', respond: crmApi(world) })
  const rights = options.rights === undefined ? ALL_RIGHTS : options.rights
  screen.k.w.sessionStorage.setItem('gtg-sidebar-cache-v3:1:16', JSON.stringify({ status_code: 200, message: 'ok', data: menuWith(rights) }))
  /** Calls to a path, by a regular expression on it. */
  const callsTo = (pattern: RegExp, method?: string) => screen.calls.filter((c) => pattern.test(c.path) && (!method || c.method === method))
  return { ...screen, world, callsTo }
}
