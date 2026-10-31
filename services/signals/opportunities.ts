/**
 * Company-opportunity research + manual ingestion endpoints (Laravel /api/signals/*).
 * Tenant identity is decided server-side from the token.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'

export type ReviewStatus = 'New' | 'Reviewed' | 'Follow-up' | 'Dismissed'
export type Level = 'High' | 'Medium' | 'Low'
export type Qualification = 'New Opportunity' | 'Needs Verification' | 'Relevant Requirement Found' | 'Monitoring'
export type RunStatus = 'running' | 'success' | 'partial' | 'failed' | 'skipped'

export interface ProductProfile {
  product_name: string | null
  description: string | null
  problems_solved: string | null
  features: string | null
  target_industries: string[] | null
  target_company_types: string[] | null
  target_company_size: string | null
  target_markets: string[] | null
  ideal_customer_profile: string | null
  keywords: string[] | null
  excluded: string[] | null
  competitors: string[] | null
  research_enabled: boolean
  research_frequency: 'daily' | 'weekdays' | 'weekly'
  schedule_time: string | null
  recency_days: number
}

export interface ProfileResponse {
  status: number
  data: {
    profile: ProductProfile | null
    completeness: { complete: boolean; missing: string[] }
    defaults: { schedule_time: string; timezone: string; recency_days: number }
  }
}

export interface OpportunitySource {
  url: string
  title: string
  published_at: string | null
  excerpt?: string
  retrieved_at?: string
  page_fetched?: boolean
}

/** How strongly the source supports the claim. A snippet or a blocked page can never be 'confirmed'. */
export type ClaimLevel = 'confirmed' | 'inference' | 'hypothesis'
/** What was actually read: the whole document, the page text, only a search snippet, or nothing (blocked). */
export type FetchLevel = 'full_document' | 'page_text' | 'search_snippet' | 'blocked'
export type PipelineStatus = 'NEW' | 'REVIEWING' | 'ENGAGED' | 'WON' | 'LOST' | 'ARCHIVED'

/** An offer matched to a signal. `is_deliverable` is what the offer is NOW; readiness never changes the score. */
export interface MatchedOffer {
  offer_id: string
  offer_name: string | null
  offer_category?: string | null
  rationale?: string | null
  match_score: number | null
  matched_need_codes: string[]
  readiness_status: string | null
  readiness_at_match: string | null
  is_deliverable: boolean
  match_status: string | null
}

export interface MarketScores {
  buying_signal: number | null
  problem_fit: number | null
  product_fit: number | null
  accessibility: number | null
  urgency: number | null
  potential_value: number | null
  evidence_quality: number | null
  total: number
}

/** The plain-English face of a lead, built on the server (CardPresenter). The client never re-derives it. */
export interface OpportunityAccount {
  /** CRM lead number: look the contact up there (phone and email are not copied into signals). */
  crm_ref: string | null
  crm_owner: string | null
  contact_name: string | null
  city: string | null
  icp_status: 'candidate' | 'low_fit' | 'unscored' | 'disqualified' | string
  icp_tier: 'A' | 'B' | 'C' | null
}

export interface OpportunityCardFace {
  /** One plain sentence: who needs what and why now. Null for leads written before this existed. */
  needs_line: string | null
  /** The CRM school this lead is about, when it is on the target list. */
  account: OpportunityAccount | null
  urgency_band: 'act_this_week' | 'act_this_month' | 'nurture'
  urgency_line: string
  organisation_line: string
  headline: string
  context: string
  so_what: string
  what_to_do: string
  how_sure: string
  source: { text: string; url: string | null }
  /** false for leads written before the plain-English rules (older research, or imported text). */
  written_plainly: boolean
}

export type SignalStrength = 'hot' | 'warm' | 'watch'

export type BuyingIntentLevel = 'explicit' | 'strong' | 'moderate' | 'weak' | 'unconfirmed'

/** The separate assessments behind a ScholarClone signal. Built and verified on the server; the client only displays them. */
export interface SignalAssessment {
  /** What the source itself showed about the requested place (absent when the run was not limited to a region). */
  region?: { requested: string | null; status: 'confirmed' | 'unconfirmed'; matched: string | null; basis: string } | null
  source_reliability?: { class: 'official' | 'job_post' | 'social_post' | 'third_party'; reliability: 'high' | 'medium' | 'low'; host: string }
  evidence?: {
    quote_verified: boolean
    read_as: 'page_text' | 'search_snippet'
    sources_naming_school: number
    stated_or_inferred: 'stated' | 'inferred'
    date_status: 'event_date_stated' | 'source_date_only' | 'undated'
    /** The date the SOURCE was published (null when unknown). Never the day it was retrieved. */
    source_published_at?: string | null
    date_provenance?: 'structured_data' | 'meta_tag' | 'time_element' | 'visible_absolute' | 'visible_relative' | 'search_provider' | null
    date_confidence?: 'high' | 'medium' | null
    retrieved_at?: string | null
    inference_reasoning: string | null
  }
  /** Is this organisation one of the target schools? Decided on name, place and website together. */
  identity?: {
    status: 'target_exact' | 'target_possible' | 'unrelated'
    account_id: number | null
    account_name: string | null
    crm_ref: string | null
    reasons: string[]
    scan_target?: string
    for_scan_target?: boolean
  }
  buying_intent?: { level: BuyingIntentLevel; meaning: string; indicators: { indicator: string; tier: string; quote: string }[] }
  sales_pull?: { category: string; label: string; basis: 'observed' | 'inferred'; rationale: string; quote: string | null }[]
  product_fit?: {
    part: string; what_it_does: string; reason: string
    /** Added with child-product research: older signals have none of these. */
    kind?: 'child_product' | 'product_part'; name?: string; parent_product?: string; solves?: string[]; needs_further_research?: boolean
  } | null
  /** direct_evidence | strong_indicator | weak_indicator | needs_further_research, decided on the server from what it verified. */
  evidence_class?: string
  research_status?: 'verified' | 'reviewable' | 'needs_further_research'
  missing_evidence?: string[]
  provenance?: { public_fact?: { quote: string; source_url: string; source_title: string }; interpretation?: Record<string, string> }
  unverified?: string[]
  opportunity?: { strength: SignalStrength; reason: string; age_days: number | null } | null
}

export interface Opportunity {
  /** ScholarClone signals: how hot (plain rules on the server), and the separate assessments behind it. */
  strength?: SignalStrength
  strength_reason?: string | null
  buying_intent?: BuyingIntentLevel | null
  assessment?: SignalAssessment | null
  card?: OpportunityCardFace
  id: number
  company_id: number
  company_name: string
  website: string | null
  industry: string | null
  location: string | null
  title: string
  category: string
  category_label: string
  signal_kind: string | null
  signal_kind_label: string | null
  observed_event: string
  why_indicates_need: string
  product_fit: string
  product_name: string | null
  recommended_action: string
  priority: Level
  qualification: Qualification
  confidence: Level
  review_status: ReviewStatus
  /** True when the signal was first discovered on the research day it is listed under; false when that day's run only re-observed it; null when there is no run date. */
  discovered_on_report_date?: boolean | null
  primary_source: OpportunitySource | null
  source_count: number
  source_published_at: string | null
  event_date: string | null
  report_date: string | null
  first_discovered_at: string
  last_verified_at: string
  research_run_id: number | null
  confirmed_facts?: string[]
  unverified_claims?: string[]
  urgency?: string | null
  feed_section?: 'immediate_action' | 'watchlist' | 'market_intelligence' | 'competitor_intelligence' | 'top_actions' | string | null
  relevant_offer_id?: string | null
  relevant_offer_name?: string | null
  /** The ten-family classification of what kind of signal this is (code, label, examples). */
  signal_family?: { code: string; label: string; examples: string } | null
  ingestion_source_id?: number | null
  review_notes?: string | null
  sources?: OpportunitySource[]
  reviewed_at?: string | null

  // ── Imported (demand-side) signals. Null / absent on researched rows. ──
  pipeline_status?: PipelineStatus
  trigger_type?: string | null
  trigger_summary?: string | null
  reference_no?: string | null
  source_url?: string | null
  source_title?: string | null
  expires_at?: string | null
  /** Whole days until expiry (negative once expired); null when the signal has no expiry. */
  days_left?: number | null
  is_expired?: boolean
  claim_level?: ClaimLevel | null
  fetch_level?: FetchLevel | null
  evidence_note?: string | null
  business_fit?: 'eb' | 'scholar' | 'g2g' | 'multiple' | null
  /** The product this record is stored for (null = unassigned or several products). */
  product?: string | null
  candidate_need_codes?: string[]
  buyer_segment?: string | null
  buyer_type?: string | null
  buyer_state?: string | null
  likely_problem?: string | null
  likely_stakeholder?: string | null
  what_we_could_sell?: string | null
  entry_point?: string | null
  scale?: string | null
  estimated_value?: string | null
  is_government_track?: boolean
  partner_route_note?: string | null
  soft_marketing_angle?: string | null
  scores?: MarketScores | null
  score_reasoning?: string | null
  is_sample?: boolean
  matched_offers?: MatchedOffer[]
  promoted_lead_id?: string | null
  promoted_lead_no?: string | null
  promoted_lead_status?: string | null
  crm_qualification?: {
    can_promote: boolean
    promotion_requirements_met: boolean
    outreach_ready: boolean
    verified_fields: string[]
    missing_for_outreach: string[]
    enrichment_status: 'Complete' | 'Partially Complete' | 'Needs Review' | 'Unable to Verify'
  }
}

/** Result of one structured market import (POST /signals/market/import). */
export interface MarketImportResult {
  scan_log_id: number | null
  received: number
  accepted: number
  updated: number
  duplicate: number
  rejected: number
  results: { index: number; outcome: string; reason_code?: string; reason?: string; id?: number }[]
}

export interface OpportunityListResponse {
  status: number
  data: Opportunity[]
  /** `resolved_run_date`: with `latestSaved`, the research day the rows came from (null when the product has none). */
  meta: { page: number; per_page: number; total: number; last_page: number; resolved_run_date?: string | null }
  summary: {
    total: number
    new: number
    high_priority: number
    follow_up: number
    immediate?: number
    watchlist?: number
    market_intelligence?: number
    competitor_intelligence?: number
    /** Hidden by default: shown under the Expired view / Include samples toggle. */
    expired?: number
    samples?: number
  }
  filters: {
    categories: { value: string; label: string }[]
    kinds: { value: string; label: string }[]
    report_dates: string[]
    claim_levels?: ClaimLevel[]
    fetch_levels?: FetchLevel[]
    business_fits?: string[]
    pipeline_statuses?: PipelineStatus[]
  }
}

export type ResearchStage = 'preparing' | 'searching' | 'collecting' | 'analyzing' | 'saving' | 'completed' | 'failed'

export interface RunStageStats {
  queries: { planned: number; attempted: number; succeeded: number; with_results: number | null; empty: number | null; failed: number; cache_hits: number; skipped: number; skipped_by_reason: Record<string, number> }
  results: { returned: number; dropped_too_old: number; screened_out: number; kept: number }
  /** `skipped`: sources whose page was deliberately not requested (an unreadable social host); not a read and not a failure. The maps are null when the run did not record them. */
  pages: {
    fetched: number
    failed: number
    blocked_by_robots?: number
    skipped?: number | null
    skipped_by_reason?: Record<string, number> | null
    failed_by_category?: Record<string, number> | null
    failed_by_host_class?: Record<string, number> | null
  }
  candidates: { proposed: number; rejected_before_gate: number; rejected_by_gate: number }
  outcome: { new: number; updated: number; unchanged_existing: number; qualified_total: number }
  errors_by_stage: Record<string, Record<string, number>>
  /** Registry sources SELECTED vs searches that really RAN against them. `null` = this run kept no registry record (unavailable, not zero). `verified` is always false: searching a source never verifies it. */
  registry?: { selected: number; eligible: number; attempted: number; searched: number; succeeded_with_results: number | null; succeeded_empty: number | null; failed: number; served_from_cache: number; skipped_other: number; not_selected_reason: string | null; verified: boolean } | null
  /** Verified sources read directly (feed or announcement listing). `null` = the run did not do that. */
  direct?: { sources_selected: number; listings_read: number; items_found: number; items_read: number; items_skipped_seen: number; refused_robots: number; failed_by_category: Record<string, number>; by_source?: { id: string; name: string; method: string | null; found: number; read: number; failed: number }[] } | null
  /** Schools with no verified website that were searched by name. `null` = no record for this run. Candidate sites are never verified by this step. */
  name_search?: { skipped_missing_context: number; schools_selected: number; searches_run: number; schools_with_candidate_site: number; candidate_sites: number; candidate_sites_verified: number } | null
  /** Verification runs only: the hard ceilings and what was used/refused. null on ordinary runs. */
  budget?: { limits: Record<string, number> | null; used: Record<string, number>; refused: Record<string, number> } | null
  /** The geography this run was limited to, with what its sources showed. null = All Regions (or an older run). */
  region?: { label: string; places: number; confirmed: number; unconfirmed: number; outside: number } | null
  /** Counts only: why candidates were rejected, in more detail than the code (for example quote not found vs. the source not naming the school). null = not recorded. */
  rejection_detail?: Record<string, Record<string, number>> | null
  /** AI calls that failed in this run. null = not recorded. */
  ai?: { main_failed: number; followup_failed: number } | null
  /** Budgets reached: pages beyond the page cap left unread, or the run's time limit. null = not recorded. */
  limits?: { pages_cap_reached: number; pages_time_limited: number; time_limited: boolean } | null
  /** Did the research finish what it set out to do? 'incomplete' (an AI failure, a time or page limit) is different from 'completed_no_qualified'. */
  completion?: 'completed' | 'completed_no_qualified' | 'incomplete'
  completion_reasons?: string[]
  zero_reasons: { code: string; label: string; count: number }[]
  next_action: string
}

export interface ResearchRun {
  id: number
  product_key?: string | null
  report_date: string | null
  trigger: 'scheduled' | 'manual'
  status: RunStatus
  stage?: ResearchStage | string | null
  stage_message?: string | null
  /** The run's heartbeat: changes whenever the backend saves progress. */
  updated_at?: string | null
  started_at: string | null
  completed_at: string | null
  duration_ms: number | null
  queries_run: number
  queries_failed: number
  sources_found: number
  companies_researched: number
  opportunities_qualified: number
  /** Stage-by-stage accounting of the run (null for runs made before it existed). Every number is a counter the run kept. */
  stage_stats?: RunStageStats | null
  /** False when the backend has no stage_stats column yet (its migration has not been applied): the breakdown is then unavailable, not empty. */
  stage_stats_persisted?: boolean
  opportunities_new: number
  opportunities_rejected: number
  search_provider: string | null
  ai_provider?: string | null
  ai_model?: string | null
  error_code: string | null
  error_message: string | null
}

export interface ResearchStatusResponse {
  status: number
  data: {
    requirements: {
      profile_complete: boolean
      profile_missing: string[]
      search_configured: boolean
      search_driver: string | null
      ai_configured: boolean
      research_enabled: boolean
    }
    /** Present when a product was asked about: whether it is configured for discovery, and what is still missing. */
    product?: { key: string; label: string; ready: boolean; missing: string[] } | null
    running: boolean
    /** Another product's run holds the organisation's single run slot. */
    busy_elsewhere?: boolean
    latest_run: ResearchRun | null
    last_successful_run: ResearchRun | null
    next_scheduled_at: string | null
    /** The daily run time (HH:MM in `timezone`). */
    daily_time?: string
    timezone: string
  }
}

export interface RunDatesResponse {
  status: number
  data: {
    product: string
    timezone: string
    dates: {
      date: string
      runs: number
      status: 'success' | 'partial'
      last_completed_at: string | null
      qualified: number
      /** What the day's runs did, so an empty day can say why. */
      searches: number
      sources: number
      organisations: number
      rejected: number
      note: string | null
    }[]
  }
}

export interface OpportunityQuery {
  /** The newest research day that has saved signals, instead of a chosen day (the screen's fallback). Reads stored rows only. */
  latestSaved?: boolean
  search?: string
  category?: string
  kind?: string
  priority?: string
  qualification?: string
  reviewStatus?: string
  feedSection?: string
  reportDate?: string
  page?: number
  /** 'hide' (default): active only. 'only': the Expired view. 'include': both. */
  expired?: 'hide' | 'only' | 'include'
  /** Sample rows never appear unless this is on. */
  includeSamples?: boolean
  claimLevel?: string
  businessFit?: string
  /** Only what the successful research runs of this day (YYYY-MM-DD, the application's timezone) saved. Reads stored rows; starts no research. */
  runDate?: string
  /** Page size (the server allows up to 50). Defaults to 10. */
  perPage?: number
  /** A product key, 'unassigned' (records with no product) or 'all'/empty (no filter). Uses the product stored on each record. */
  product?: string
  offerId?: string | null
  customerModel?: 'b2b' | 'b2c' | 'b2g'
  regions?: { country: string; state?: string; city?: string }[]
  needCode?: string
}

export interface ProviderCheck {
  ok: boolean
  category: string
  message: string
  provider?: string | null
  model?: string | null
  driver?: string | null
  results?: number
  latency_ms: number
  tested_at: string
  last_success_at: string | null
}

export interface ProvidersResponse {
  status: number
  data: {
    ai: {
      provider: string | null
      provider_label: string | null
      model: string | null
      credential_source: string | null
      key_masked: string | null
      configured: boolean
      last_test: ProviderCheck | null
    }
    search: {
      driver: string
      env_keys: string
      key_masked: string | null
      configured: boolean
      last_test: ProviderCheck | null
    }
    schedule: { enabled: boolean; frequency: string; time: string; timezone: string; next_run_at: string | null }
    runtime: {
      scheduler_last_tick_at: string | null
      scheduler_running: boolean
      queue_connection: string
      queue_name: string
      queue_jobs_waiting_over_2_min: number
      queue_worker_suspected_down: boolean
    }
  }
}

export interface ResearchSourceInfo {
  url: string
  title: string
  domain: string | null
  snippet: string | null
  published_at: string | null
  retrieved_at: string | null
  page_fetched: boolean
  cited: boolean
}

export interface IngestionRun {
  id: number
  status: 'running' | 'success' | 'partial' | 'failed'
  started_at: string | null
  completed_at: string | null
  duration_ms: number | null
  findings_count: number
  findings_rejected: number
  error_code: string | null
  error_message: string | null
}

export type ProcessingStatus = 'uploaded' | 'generating' | 'completed' | 'completed_with_warnings' | 'failed'

export interface IngestionSourceInfo {
  id: number
  /** The product this document or link was added for (null = added before products were recorded). */
  product_key?: string | null
  type: 'file' | 'url'
  name: string
  url: string | null
  page_title: string | null
  mime: string | null
  size_bytes: number | null
  status: 'ready' | 'failed'
  error_message: string | null
  char_count: number
  truncated: boolean
  extracted_summary?: string | null
  identified_entities?: { name: string; type: string; context: string }[]
  discovered_news?: { title: string; url: string; snippet: string; published_at: string | null; source: string }[]
  retrieved_at: string | null
  created_at: string | null
  last_analyzed_at: string | null
  /** Derived server-side from real state: what the UI shows for this source. */
  processing_status: ProcessingStatus
  processing_label: string
  processing_message: string | null
  can_retry: boolean
  findings_count: number
  latest_analysis: IngestionRun | null
}

export interface IngestionFindingInfo {
  id: number
  analysis_id: number
  kind: string
  title: string
  detail: string
  business_impact: string | null
  suggested_action: string | null
  priority: Level | null
  confidence: Level | null
  evidence: { ref: string; quote: string }[]
  review_status: ReviewStatus
}

/** A generated signal in the cross-source list, with its provenance. */
export interface IngestionSignal extends IngestionFindingInfo {
  source_id: number
  source_name: string
  source_type: 'file' | 'url'
  source_url: string | null
  created_at: string
}

export interface IngestionSignalListResponse {
  status: number
  data: IngestionSignal[]
  meta: { page: number; per_page: number; total: number; last_page: number }
  kind_counts: Record<string, number>
}

export interface IngestResponse {
  status: number
  message: string
  data: IngestionSourceInfo
  analysis_started?: boolean
  analysis_code?: string | null
}

export interface IngestionSourceDetail extends IngestionSourceInfo {
  preview: { ref: string; text: string }[]
  analyses: IngestionRun[]
  findings: IngestionFindingInfo[]
  linked_opportunities?: Opportunity[]
}

function base(context: LaravelContext): Record<string, string> {
  return {
    sub_institute_id: context.subInstituteId,
    ...(context.token ? { token: context.token } : {}),
  }
}

const qs = (context: LaravelContext) => new URLSearchParams(base(context)).toString()
const regionQuery = (regions: { country: string; state?: string; city?: string }[]) => {
  const out: Record<string, string> = {}
  regions.forEach((region, i) => {
    if (region.country) out[`regions[${i}][country]`] = region.country
    if (region.state) out[`regions[${i}][state]`] = region.state
    if (region.city) out[`regions[${i}][city]`] = region.city
  })
  return out
}

export type IcpCriterionStatus = 'Matched' | 'Not found' | 'Needs review' | 'Excluded'

export interface IcpCriterionRow {
  kind: 'must_have' | 'exclusion'
  criterion: string
  status: IcpCriterionStatus
  evidence_available: boolean
  /** Only ever a stored value: a recorded fact, the text that was checked, or a flag a person set. */
  evidence: { kind: 'account_fact' | 'recorded_text' | 'account_flag'; text: string } | null
  source: { label: string | null; url: string | null; ref: string | null } | null
  reason: string
}

/** One stored opportunity laid next to its product's ICP. Read-only; the qualification it shows was decided by the server when the signal was stored. */
export interface IcpComparisonResponse {
  status: number
  data: {
    available: boolean
    reason?: string
    product: { key: string; label: string; custom?: boolean } | null
    icp: { profile_id: number | null; name: string | null; version: number | null; status: string | null; source: string | null } | null
    stored_result: { qualification: string | null; claim_level: string | null; evidence_class: string | null; research_status: string | null; note: string }
    evidence: { available: boolean; quote: string | null; source_title: string | null; source_url: string | null; quote_verified: boolean | null; read_as: string | null; missing_evidence: string[] }
    account_linked?: boolean
    criteria: IcpCriterionRow[]
    summary: Record<IcpCriterionStatus, number> | null
    notes: string[]
  }
}

export const opportunitiesService = {
  getIcpComparison: (c: LaravelContext, id: number) =>
    apiClient.get<IcpComparisonResponse>(`/signals/opportunities/${id}/icp-comparison`, base(c)),

  getProfile: (c: LaravelContext) => apiClient.get<ProfileResponse>('/signals/product-profile', base(c)),

  saveProfile: (c: LaravelContext, profile: Partial<ProductProfile>) =>
    apiClient.put<ProfileResponse>(`/signals/product-profile?${qs(c)}`, profile),

  getStatus: (c: LaravelContext, product?: string, customerModel?: 'b2b' | 'b2c' | 'b2g', offerId?: string | null, regions: { country: string; state?: string; city?: string }[] = []) =>
    apiClient.get<ResearchStatusResponse>('/signals/research/status', { ...base(c), ...(product && product !== 'all' ? { product } : {}), ...(customerModel ? { customer_model: customerModel } : {}), ...(offerId ? { offer_id: offerId } : {}), ...regionQuery(regions) }),

  /** The days on which the product has a successful research run (newest first). Reads stored runs only. */
  getRunDates: (c: LaravelContext, product: string, customerModel: 'b2b' | 'b2c' | 'b2g' = 'b2b', offerId?: string | null, regions: { country: string; state?: string; city?: string }[] = []) =>
    apiClient.get<RunDatesResponse>('/signals/research/dates', { ...base(c), product, customer_model: customerModel, ...(offerId ? { offer_id: offerId } : {}), ...regionQuery(regions) }),

  getRuns: (c: LaravelContext) => apiClient.get<{ status: number; data: ResearchRun[] }>('/signals/research/runs', base(c)),

  getProviders: (c: LaravelContext) => apiClient.get<ProvidersResponse>('/signals/providers', base(c)),

  testProvider: (c: LaravelContext, which: 'ai' | 'search') =>
    apiClient.post<{ status: number; data: ProviderCheck }>(`/signals/providers/${which}/test?${qs(c)}`, {}),

  getRun: (c: LaravelContext, runId: number) =>
    apiClient.get<{ status: number; data: ResearchRun }>(`/signals/research/runs/${runId}`, base(c)),

  getRunSources: (c: LaravelContext, runId: number) =>
    apiClient.get<{ status: number; data: ResearchSourceInfo[] }>(`/signals/research/runs/${runId}/sources`, base(c)),

  runResearch: (c: LaravelContext, customParams?: { topic?: string; company?: string; industry?: string; geography?: string; signal_type?: string; recency_days?: number }, product?: string, regions?: { country: string; state?: string; city?: string }[], offerId?: string | null, customerModel?: 'b2b' | 'b2c' | 'b2g') =>
    apiClient.post<{ status: number; message: string; data?: { run_id: number; run: ResearchRun } }>(`/signals/research/run?${qs(c)}`, { ...(customParams ?? {}), ...(product ? { product } : {}), ...(regions && regions.length > 0 ? { regions } : {}), ...(offerId ? { offer_id: offerId } : {}), ...(customerModel ? { customer_model: customerModel, icp_type: customerModel } : {}) }),

  list: (c: LaravelContext, q: OpportunityQuery = {}) => {
    const params: Record<string, string> = { ...base(c), page: String(q.page ?? 1), per_page: String(q.perPage ?? 5) }
    if (q.search) params.search = q.search
    if (q.category) params.category = q.category
    if (q.kind) params.kind = q.kind
    if (q.priority) params.priority = q.priority
    if (q.qualification) params.qualification = q.qualification
    if (q.reviewStatus) params.review_status = q.reviewStatus
    if (q.feedSection) params.feed_section = q.feedSection
    if (q.reportDate) params.report_date = q.reportDate
    if (q.expired && q.expired !== 'hide') params.expired = q.expired
    if (q.includeSamples) params.include_samples = '1'
    if (q.claimLevel) params.claim_level = q.claimLevel
    if (q.businessFit) params.business_fit = q.businessFit
    if (q.product && q.product !== 'all') params.product = q.product
    if (q.customerModel) params.customer_model = q.customerModel
    if (q.offerId) params.offer_id = q.offerId
    Object.assign(params, regionQuery(q.regions ?? []))
    if (q.runDate) params.run_date = q.runDate
    if (q.latestSaved) params.latest_saved = '1'
    if (q.needCode) params.need_code = q.needCode
    return apiClient.get<OpportunityListResponse>('/signals/opportunities', params)
  },

  /**
   * Structured demand-side import (JSON or CSV). Rejected rows come back with a reason and are kept
   * server-side; `dryRun` validates without writing anything.
   */
  importMarket: (c: LaravelContext, file: File, opts: { dryRun?: boolean; label?: string } = {}) => {
    const form = new FormData()
    form.append('file', file)
    if (opts.label) form.append('source_label', opts.label)
    if (opts.dryRun) form.append('dry_run', '1')
    return apiClient.postForm<{ status: number; message: string; data: MarketImportResult }>(`/signals/market/import?${qs(c)}`, form)
  },

  get: (c: LaravelContext, id: number) => apiClient.get<{ status: number; data: Opportunity }>(`/signals/opportunities/${id}`, base(c)),

  act: (c: LaravelContext, id: number, action: 'review' | 'dismiss' | 'follow-up', notes?: string) =>
    apiClient.patch<{ status: number; data: Opportunity }>(`/signals/opportunities/${id}/${action}?${qs(c)}`, notes ? { notes } : {}),

  // Sales & Marketing unification, Phase 4: promote an unqualified signal into a CRM Lead.
  // Idempotent (created:false on repeat) - see Docs/sales-marketing-merge/DECISIONS.md.
  promoteToCrm: (c: LaravelContext, id: number) =>
    apiClient.post<{ status: number; data: { lead_id: string; created: boolean } }>(`/signals/opportunities/${id}/promote-to-crm?${qs(c)}`, {}),

  // ── ingestion ──
  /** `product` lists only the documents added for that product (ones added before products were recorded count as ScholarClone's). */
  listSources: (c: LaravelContext, product?: string) =>
    apiClient.get<{ status: number; data: IngestionSourceInfo[] }>('/signals/ingestion/sources', product ? { ...base(c), product } : base(c)),

  getSource: (c: LaravelContext, id: number) =>
    apiClient.get<{ status: number; data: IngestionSourceDetail }>(`/signals/ingestion/sources/${id}`, base(c)),

  upload: (c: LaravelContext, file: File, product?: string) => {
    const form = new FormData()
    form.append('file', file)
    if (product) form.append('product', product)
    return apiClient.postForm<IngestResponse>(`/signals/ingestion/upload?${qs(c)}`, form)
  },

  addUrl: (c: LaravelContext, url: string, product?: string) =>
    apiClient.post<IngestResponse>(`/signals/ingestion/url?${qs(c)}`, { url, ...(product ? { product } : {}) }),

  listSignals: (c: LaravelContext, q: { sourceId?: number; kind?: string; search?: string; product?: string; page?: number } = {}) => {
    const params: Record<string, string> = { ...base(c), page: String(q.page ?? 1), per_page: '12' }
    if (q.sourceId) params.source_id = String(q.sourceId)
    if (q.product) params.product = q.product
    if (q.kind) params.kind = q.kind
    if (q.search) params.search = q.search
    return apiClient.get<IngestionSignalListResponse>('/signals/ingestion/findings', params)
  },

  /** Retry: analysis normally starts automatically; this re-runs a failed or never-started one. */
  analyze: (c: LaravelContext, id: number) =>
    apiClient.post<{ status: number; message: string }>(`/signals/ingestion/sources/${id}/analyze?${qs(c)}`, {}),

  deleteSource: (c: LaravelContext, id: number) =>
    apiClient.delete<{ status: number; message: string }>(`/signals/ingestion/sources/${id}`, base(c)),

  actOnFinding: (c: LaravelContext, id: number, action: 'review' | 'dismiss') =>
    apiClient.patch<{ status: number; data: { id: number; review_status: ReviewStatus } }>(`/signals/ingestion/findings/${id}/${action}?${qs(c)}`, {}),
}
