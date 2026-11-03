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

/** One judged part of the fit with the product (assessment.fit.components, hp_erp OpportunityFit): `score` out of `max`, with the reason in words. */
export interface FitComponent {
  score: number
  max: number
  why?: string | null
}

/**
 * How well a researched signal fits its product, worked out by the server from verified facts (hp_erp OpportunityFit). `band` is the priority band the
 * fit allows (High, Medium or Low). Signals that were imported or entered by hand carry none of this.
 */
export interface SignalFit {
  total: number
  band?: string | null
  components?: Record<string, FitComponent> | null
  version?: number
}

export interface SignalAssessment {
  evidence?: SignalEvidence
  fit?: SignalFit | null
  /** The wording copied from the source, when the researcher kept it. */
  provenance?: { public_fact?: { quote?: string | null; source_url?: string | null; source_title?: string | null } }
}

/** The seven parts of a signal's score and their total. A part is null when it was not recorded. */
export interface SignalScores {
  total: number
  buying_signal?: number | null
  problem_fit?: number | null
  product_fit?: number | null
  accessibility?: number | null
  urgency?: number | null
  potential_value?: number | null
  evidence_quality?: number | null
}

/** One product offer the matcher tied to a signal, best match first (`matched_offers` in the list and detail). */
export interface MatchedOffer {
  offer_id?: string | null
  offer_name?: string | null
  offer_category?: string | null
  /** Why it matches, in the words of the signal and the product; empty when it was stored without one. */
  rationale?: string | null
  match_score?: number | null
  matched_need_codes?: string[]
  match_status?: string | null
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
  scores?: SignalScores | null
  /** The researcher's reasoning for the score. `strength_reason` is the same text under its older name. */
  score_reasoning?: string | null
  strength_reason?: string | null
  /** High, Medium or Low, as the researcher stated it. */
  confidence?: string | null
  candidate_need_codes?: string[]
  matched_offers?: MatchedOffer[]
  /** The CRM lead made from this signal (a string id), or null when there is none. The number and status are the lead's own. */
  promoted_lead_id?: string | null
  promoted_lead_no?: string | null
  promoted_lead_status?: string | null
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

/** POST /opportunities/{id}/promote-to-crm. 201 when a lead was made now; 200 with `created: false` when the signal already had one. */
export interface SignalPromoteResponse {
  status: number
  data: { lead_id: string; created: boolean }
}
