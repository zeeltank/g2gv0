import type { DateInfo, ReasonOption, ReviewHistoryEntry, ReviewStatus } from './types'

/**
 * The Signal Review list and detail (hp_erp OpportunityController::index / show, contract: hp_erp docs/agentic-crm/slices/S02-contract.md).
 * Only the fields this screen reads are named; the server sends many more. Names are the API's own snake_case.
 */

export type SignalPriority = 'High' | 'Medium' | 'Low'
export type ClaimLevel = 'confirmed' | 'inference' | 'hypothesis'

export interface SignalSource {
  url: string
  title?: string | null
  published_at?: string | null
  excerpt?: string | null
}

/** What the source itself showed about the date, when the researcher recorded it (assessment.evidence). */
export interface SignalEvidence {
  date_provenance?: 'structured_data' | 'meta_tag' | 'time_element' | 'visible_absolute' | 'visible_relative' | 'search_provider' | null
  quote_verified?: boolean
  read_as?: 'page_text' | 'search_snippet'
}

export interface SignalAssessment {
  evidence?: SignalEvidence
  /** The wording copied from the source, when the researcher kept it. */
  provenance?: { public_fact?: { quote?: string | null; source_url?: string | null; source_title?: string | null } }
}

/** One signal: a row of the list and, with a few more fields, the detail. A decision's answer carries the same shape. */
export interface SignalRow {
  id: number
  title: string
  company_name: string
  review_status: ReviewStatus
  review_notes?: string | null
  priority?: SignalPriority | null
  business_fit: string | null
  /** Null when the signal is not matched to a Product Master record. */
  product_master_id: number | null
  product_master_name: string | null
  /** How old the signal really is and what kind of date that is. Built on the server from the date columns. */
  date_info: DateInfo
  event_date?: string | null
  source_published_at?: string | null
  first_discovered_at?: string | null
  research_run_id?: number | null
  entered_manually?: boolean
  why_indicates_need?: string | null
  observed_event?: string | null
  recommended_action?: string | null
  claim_level?: ClaimLevel | null
  scores?: { total: number } | null
  source_url?: string | null
  source_title?: string | null
  primary_source?: SignalSource | null
  relevant_offer_name?: string | null
  assessment?: SignalAssessment | null
  /** Detail only. */
  reviewed_at?: string | null
  sources?: SignalSource[]
  [key: string]: unknown
}

/** The counts above the list. `total` and `new` are what the tiles use; the rest are shown only where they mean something. */
export interface SignalSummary {
  total: number
  new: number
  high_priority: number
  follow_up: number
  [key: string]: number | undefined
}

export interface ProductFilterOption {
  value: string
  label: string
  business_fit: string | null
}

export interface SignalListFilters {
  /** The `business_fit` values the server accepts. */
  business_fits?: string[]
  /** Product definitions, used only to turn a `business_fit` code into the product's own name. */
  products?: ProductFilterOption[]
  /** The reasons a person can give for dismissing. */
  review_reasons?: ReasonOption[]
  [key: string]: unknown
}

export interface SignalListMeta {
  page: number
  per_page: number
  total: number
  last_page: number
}

export interface SignalListResponse {
  status: number
  data: SignalRow[]
  meta: SignalListMeta
  summary: SignalSummary
  filters: SignalListFilters
}

/** The query the list endpoint takes, in the API's own names. A missing key means "no filter". */
export interface SignalListParams {
  page?: number
  per_page?: number
  search?: string
  product_master_id?: number
  review_status?: ReviewStatus
  freshness?: 'last_30_days' | 'last_90_days' | 'older' | 'undated'
  business_fit?: string
  sort?: 'recent' | 'priority'
}

export interface SignalDetailResponse {
  status: number
  data: SignalRow
}

export interface SignalHistoryResponse {
  status: number
  data: ReviewHistoryEntry[]
}

export interface SignalDecisionResponse {
  status: number
  data: SignalRow
  review: ReviewHistoryEntry
}
