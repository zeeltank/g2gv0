/**
 * The Outreach tab of Market Signals (27 Nov 2026): the companies that signals found, the people found (or added by hand) at them, and the messages written to them.
 * These are the shapes of hp_erp `/api/signals/outreach/...` (Api\Signals\SignalOutreachController). A refusal arrives as an ApiError (403 not allowed, 404 not found, 422 invalid).
 * Contacts found on the public web are NEVER verified: `verification_status` is always `unverified` and the screen says so.
 */

/** What can be done with a person or company, worked out on the server from the details held and the consent flags. */
export type OutreachReach = 'ready' | 'email_only' | 'phone_only' | 'needs_details' | 'blocked'

/** `found` = the signal's contact research found it; `manual` = a person added it. */
export type OutreachSource = 'found' | 'manual'

export type ConsentStatus = 'unknown' | 'opted_in' | 'opted_out' | 'suppressed'

export interface OutreachBestContact {
  id: number
  name: string | null
  designation: string | null
  email: string | null
  phone: string | null
}

/** The most recent signal that brought the company here (null for a company added by hand). */
export interface OutreachSignalRef {
  id: number
  title: string
  product_name: string | null
  review_status: string
  pipeline_status: string | null
  first_discovered_at: string | null
}

export interface OutreachCompany {
  id: number
  name: string
  website: string | null
  domain: string | null
  industry: string | null
  location: string | null
  type: string | null
  state: string | null
  phone: string | null
  email: string | null
  description: string | null
  source: OutreachSource
  assigned_to: number | null
  assigned_to_name: string | null
  signals_count: number
  people_count: number
  /** People who can be reached by email or phone right now (not blocked). */
  reachable_people_count: number
  best_contact: OutreachBestContact | null
  /** The best reach among its people; `needs_details` with no people. */
  reach: OutreachReach
  /** The latest time a message to anyone here was sent; null when none was. */
  last_contacted_at: string | null
  first_seen_at: string | null
  /** The lead this company became, if it has been converted. */
  lead_id: number | null
  latest_signal: OutreachSignalRef | null
}

export interface OutreachPerson {
  id: number
  company_id: number
  company_name: string
  /** null for the organisation's own published line (a general email or phone with no named person). */
  full_name: string | null
  designation: string | null
  department: string | null
  contact_role: string | null
  is_primary: boolean
  email: string | null
  secondary_email: string | null
  phone: string | null
  mobile: string | null
  linkedin_url: string | null
  website: string | null
  location: string | null
  description: string | null
  source: OutreachSource
  source_url: string | null
  email_source_url: string | null
  phone_source_url: string | null
  /** Always `unverified` for a found contact: nobody has checked that the address works or the number rings. */
  verification_status: string
  consent_status: ConsentStatus
  email_opt_out: boolean
  do_not_call: boolean
  suppressed_reason: string | null
  assigned_to: number | null
  assigned_to_name: string | null
  reach: OutreachReach
  last_contacted_at: string | null
  researched_at: string | null
  created_at: string | null
  lead_id: number | null
}

export interface OutreachCompanyDetail extends OutreachCompany {
  /** Why it is here: the signals that found it, newest first. Empty for a company added by hand. */
  signals: OutreachSignalRef[]
  people: OutreachPerson[]
  /** Where the public contact search stands for this company (same words as the signal card). */
  research: { state: 'found' | 'none_found' | 'not_searched' | 'not_set_up'; searched_at: string | null; can_search: boolean }
}

export interface OutreachListMeta {
  page: number
  per_page: number
  total: number
  last_page: number
}

/** The number on each filter chip, for the whole list (not just this page). */
export interface OutreachSummary {
  all: number
  reachable: number
  needs_details: number
  blocked: number
  found: number
  manual: number
  mine: number
}

export interface OutreachListResponse<T> {
  status: number
  data: T[]
  meta: OutreachListMeta
  summary: OutreachSummary
}

export interface OutreachOneResponse<T> {
  status: number
  data: T
  message?: string
}

/** `reachable` = ready, email_only or phone_only: anyone who can be written to now. */
export type OutreachReachFilter = 'all' | 'reachable' | OutreachReach

export interface OutreachListQuery {
  search?: string
  reach?: OutreachReachFilter
  source?: 'all' | OutreachSource
  /** Only rows assigned to the signed-in person. */
  mine?: boolean
  company_id?: number
  page?: number
  per_page?: number
  sort?: string
  dir?: 'asc' | 'desc'
}

export interface NewCompanyBody {
  name: string
  website?: string
  industry?: string
  location?: string
  type?: string
  state?: string
  phone?: string
  email?: string
  description?: string
  assigned_to?: number | null
}

export interface NewPersonBody {
  company_id: number
  full_name?: string
  designation?: string
  department?: string
  contact_role?: string
  is_primary?: boolean
  email?: string
  secondary_email?: string
  phone?: string
  mobile?: string
  linkedin_url?: string
  description?: string
  assigned_to?: number | null
}

export type UpdatePersonBody = Partial<Omit<NewPersonBody, 'company_id'>>
export type UpdateCompanyBody = Partial<NewCompanyBody>

export interface ConsentBody {
  consent_status?: ConsentStatus
  email_opt_out?: boolean
  do_not_call?: boolean
  reason?: string
}

export interface AssignBody {
  company_ids?: number[]
  person_ids?: number[]
  assigned_to: number | null
}

/** Writing to people: one DRAFT per person, never sent from here. `{{first_name}}` and `{{company}}` are filled in per person on the server. */
export interface WriteMessagesBody {
  person_ids: number[]
  subject: string
  body: string
}

export interface WriteMessageResult {
  person_id: number
  ok: boolean
  /** The GTM outreach message id (a draft) when ok. */
  message_id: number | null
  /** Why not, in words: no email, opted out, on the suppression list, ... */
  code: string | null
  message: string | null
}

export interface WriteMessagesResponse {
  status: number
  data: { results: WriteMessageResult[]; drafted: number; refused: number }
}

export interface ConvertToLeadResponse {
  status: number
  data: { lead_id: number; created: boolean }
}

export interface PersonMessage {
  id: number
  subject: string
  status: string
  created_at: string | null
  sent_at: string | null
}

export interface FindContactsResponse {
  status: number
  message: string
}
