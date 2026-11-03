/**
 * The Organisation 360 API (hp_erp `/api/org-accounts`, contract: hp_erp docs/agentic-crm/slices/S03-organisation-360.md). Names are the API's own snake_case.
 * `null` always means "not known" or "this organisation has no row there", never zero or empty.
 *
 * One organisation is ONE identity row that points at whichever of three source rows exist: the CRM organisation (quotes, orders, invoices, tickets, contacts),
 * the GTM account and the Signals company.
 */

export type OrgSourceType = 'crm_organization' | 'gtm_account' | 'g2g_company'

/** Where an organisation stands. `customer` is set by a person; nothing guesses it. */
export type OrgLifecycle = 'discovered' | 'target' | 'engaged' | 'customer' | 'archived'

/** Why a source row is tied to the identity. Fuzzy matches are never a basis: they are only suggestions until a person confirms them (`manual`). */
export type OrgLinkBasis = 'existing_link' | 'exact_name' | 'exact_domain' | 'manual'

export interface OrgSourcePointer {
  id: number
  basis: OrgLinkBasis | null
}

/** One organisation in the list. */
export interface OrgAccountItem {
  id: number
  name: string
  domain: string | null
  lifecycle: OrgLifecycle
  owner_user_id: number | null
  owner_name: string | null
  /** Which sources this organisation has a row in. */
  sources: {
    crm: { id: number; account_no: string | null } | null
    gtm: { id: number; stage: string | null } | null
    signals: { company_id: number; open_signals: number; last_signal_at: string | null } | null
  }
  updated_at: string | null
}

export interface OrgAccountSummary {
  total: number
  discovered: number
  target: number
  engaged: number
  customer: number
  archived: number
  with_crm: number
  with_gtm: number
  with_signals: number
  /** How many possible-duplicate suggestions wait for a person. */
  suggestions: number
}

export interface OrgListMeta {
  page: number
  per_page: number
  total: number
  last_page: number
}

export interface OrgListResponse {
  status: 1
  data: OrgAccountItem[]
  meta: OrgListMeta
  summary: OrgAccountSummary
}

export interface OrgMeta {
  lifecycles: OrgLifecycle[]
  can: {
    create_crm_organization: boolean
    edit: boolean
    confirm_links: boolean
  }
}

/** A possible duplicate a person is asked about. `key` identifies the pair. */
export interface OrgSuggestion {
  key: string
  left: { type: OrgSourceType; id: number; name: string }
  right: { type: OrgSourceType; id: number; name: string }
  basis: 'name_overlap'
  /** 0 to 1: the share of name words the two have in common. */
  score: number
}

export interface OrgSignalLine {
  id: number
  title: string
  review_status: 'New' | 'Reviewed' | 'Follow-up' | 'Dismissed'
  date_info: { status: 'event_date_stated' | 'source_date_only' | 'undated'; date: string | null }
  business_fit: string | null
  product_master_name: string | null
}

export interface OrgContactLine {
  source: 'crm' | 'gtm'
  id: number
  name: string
  email: string | null
  phone: string | null
  role: string | null
}

export interface OrgDealLine {
  source: 'crm' | 'gtm'
  id: number
  name: string
  stage: string | null
  amount: number | null
  currency: string | null
  closing_date: string | null
}

export interface OrgActivityLine {
  kind: 'note' | 'task' | 'decision' | 'lead'
  at: string
  by_name: string | null
  text: string
  /** Which table it came from, for the link and the badge. */
  source: string
}

/** The 360 view of one organisation: the identity, what each source knows, and capped lists (20 each; `totals` says how many exist). */
export interface Org360 {
  identity: {
    id: number
    name: string
    domain: string | null
    lifecycle: OrgLifecycle
    owner_user_id: number | null
    owner_name: string | null
    links: { crm: OrgSourcePointer | null; gtm: OrgSourcePointer | null; company: OrgSourcePointer | null }
    created_at: string | null
    updated_at: string | null
  }
  crm: {
    id: number
    account_no: string | null
    name: string
    industry: string | null
    phone: string | null
    email: string | null
    website: string | null
    billing_city: string | null
    billing_state: string | null
    assigned_to_name: string | null
  } | null
  gtm: { id: number; name: string; stage: string | null; domain: string | null; icp_fit_score: number | null; owner_name: string | null } | null
  company: { id: number; name: string; website: string | null; industry: string | null; location: string | null; state: string | null; type: string | null; first_seen_at: string | null } | null
  signals: { total: number; needing_decision: number; decided: number; latest: OrgSignalLine[] }
  contacts: OrgContactLine[]
  deals: OrgDealLine[]
  activity: OrgActivityLine[]
  totals: { contacts: number; deals: number; activity: number }
}

export interface OrgEnvelope<T> {
  status: 1
  data: T
}

/** POST /links */
export interface OrgLinkRequest {
  left_type: OrgSourceType
  left_id: number
  right_type: OrgSourceType
  right_id: number
  action: 'confirm' | 'reject'
}

/** POST /{id}/create-crm-organisation */
export interface OrgCreateCrmResult {
  status: 1
  data: { created: boolean; crm_organization_id: number; restored: boolean }
}

/** The 409 body of create-crm-organisation when a deleted organisation holds the name. */
export interface OrgDeletedNameConflict {
  status: 0
  code: 'deleted_name_exists'
  message: string
  deleted_organization_id: number
}
