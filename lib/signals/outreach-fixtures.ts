import type {
  OutreachCompany, OutreachCompanyDetail, OutreachListMeta, OutreachListResponse, OutreachPerson, OutreachSummary, OutreachSignalRef,
} from '../../services/signals/outreach-types'

/** Rows as the server sends them, for the tests of the Outreach tab. Every field is present, so a test overrides only what it is about. */

export function signalRef(over: Partial<OutreachSignalRef> = {}): OutreachSignalRef {
  return { id: 501, title: 'School announces new campus', product_name: 'School ERP', review_status: 'New', pipeline_status: 'NEW', first_discovered_at: '2026-11-20T09:00:00+00:00', ...over }
}

export function person(over: Partial<OutreachPerson> = {}): OutreachPerson {
  return {
    id: 11, company_id: 1, company_name: 'Riverdale Public School', full_name: 'Meera Patel', designation: 'Principal', department: null, contact_role: 'Decision maker', is_primary: true,
    email: 'principal@riverdale.example', secondary_email: null, phone: '+919876543210', mobile: null, linkedin_url: null, website: null, location: 'Ahmedabad', description: null,
    source: 'found', source_url: 'https://riverdale.example/team', email_source_url: 'https://riverdale.example/contact', phone_source_url: null, verification_status: 'unverified',
    consent_status: 'unknown', email_opt_out: false, do_not_call: false, suppressed_reason: null, assigned_to: null, assigned_to_name: null, reach: 'ready',
    last_contacted_at: null, researched_at: '2026-11-21T10:00:00+00:00', created_at: '2026-11-21T10:00:00+00:00', lead_id: null, ...over,
  }
}

export function company(over: Partial<OutreachCompany> = {}): OutreachCompany {
  return {
    id: 1, name: 'Riverdale Public School', website: 'https://riverdale.example', domain: 'riverdale.example', industry: 'Education', location: 'Ahmedabad, Gujarat', type: 'School', state: 'Gujarat',
    phone: null, email: null, description: null, source: 'found', assigned_to: null, assigned_to_name: null, signals_count: 2, people_count: 1, reachable_people_count: 1,
    best_contact: { id: 11, name: 'Meera Patel', designation: 'Principal', email: 'principal@riverdale.example', phone: '+919876543210' }, reach: 'ready', last_contacted_at: null,
    first_seen_at: '2026-11-20T09:00:00+00:00', lead_id: null, latest_signal: signalRef(), ...over,
  }
}

export function companyDetail(over: Partial<OutreachCompanyDetail> = {}): OutreachCompanyDetail {
  return { ...company(), signals: [signalRef(), signalRef({ id: 502, title: 'Board hires a new administrator', review_status: 'Reviewed' })], people: [person()], research: { state: 'found', searched_at: '2026-11-21T10:00:00+00:00', can_search: true }, ...over }
}

export function summary(over: Partial<OutreachSummary> = {}): OutreachSummary {
  return { all: 3, reachable: 2, needs_details: 1, blocked: 0, found: 2, manual: 1, mine: 0, ...over }
}

export function meta(over: Partial<OutreachListMeta> = {}): OutreachListMeta {
  return { page: 1, per_page: 20, total: 3, last_page: 1, ...over }
}

export function listOf<T>(data: T[], over: { meta?: Partial<OutreachListMeta>; summary?: Partial<OutreachSummary> } = {}): OutreachListResponse<T> {
  return { status: 1, data, meta: meta({ total: data.length, ...over.meta }), summary: summary(over.summary) }
}

/** Three companies that cover every reach: one ready, one that needs details, one added by hand with no people. */
export function companies(): OutreachCompany[] {
  return [
    company(),
    company({ id: 2, name: 'Sunrise Academy', reach: 'needs_details', people_count: 0, reachable_people_count: 0, best_contact: null, signals_count: 1, latest_signal: signalRef({ id: 503 }) }),
    company({ id: 3, name: 'Greenfield Traders', source: 'manual', industry: 'Retail', location: 'Surat', signals_count: 0, people_count: 1, reach: 'email_only', latest_signal: null, best_contact: { id: 12, name: 'Ravi Shah', designation: 'Owner', email: 'ravi@greenfield.example', phone: null } }),
  ]
}

export function people(): OutreachPerson[] {
  return [
    person(),
    person({ id: 12, company_id: 3, company_name: 'Greenfield Traders', full_name: 'Ravi Shah', designation: 'Owner', source: 'manual', email: 'ravi@greenfield.example', phone: null, reach: 'email_only', is_primary: true, source_url: null, email_source_url: null }),
    person({ id: 13, company_id: 1, company_name: 'Riverdale Public School', full_name: null, designation: null, is_primary: false, email: 'info@riverdale.example', phone: null, reach: 'email_only', contact_role: null }),
    person({ id: 14, company_id: 2, company_name: 'Sunrise Academy', full_name: 'Anita Rao', designation: 'Trustee', email: null, phone: null, reach: 'needs_details', is_primary: true }),
    person({ id: 15, company_id: 2, company_name: 'Sunrise Academy', full_name: 'Kiran Desai', designation: 'Director', consent_status: 'opted_out', reach: 'blocked', is_primary: false }),
  ]
}
