export interface ReadinessLogEntry {
  id: number
  action: 'confirmed' | 'unconfirmed'
  readiness_status: string | null
  actor_id: number | null
  note: string | null
  created_at: string
}

export interface ProductOffer {
  id: number
  sub_institute_id?: number | null
  offer_id: string
  name: string
  parent_product: string
  modules_components?: string | null
  what_it_does?: string | null
  needs_solved?: string[]
  primary_segments?: string[]
  trigger_signals?: string[]
  deployment_model?: string | null
  readiness_status: string
  readiness_confirmed: boolean
  /** Who confirmed readiness and when. Set only by the audited administrator action. */
  readiness_confirmed_by?: number | null
  readiness_confirmed_at?: string | null
  typical_deal_band?: string | null
  pricing_model?: string | null
  implementation_effort?: string | null
  delivery_owner?: string | null
  bundles_with?: string[]
  proof_points?: string | null
  partner_sellable: boolean
  notes?: string | null
  is_user_edited?: boolean
  individual_icp?: Record<string, unknown> | null
  icp_config?: Record<string, unknown> | null
  bundled_offer_details?: {
    id: number
    offer_id: string
    name: string
    parent_product: string
    readiness_status: string
    partner_sellable: boolean
  }[]
  created_at?: string
  updated_at?: string
}

export interface Partner {
  id: number
  sub_institute_id?: number | null
  partner_id: string
  partner_name: string
  partner_type: string
  hq_state?: string | null
  states_covered?: string[]
  segments_covered?: string[]
  needs_addressed?: string[]
  procurement_routes?: string[]
  offers_authorized?: string[]
  empanelments?: string[]
  certifications?: string[]
  key_buyer_relationships?: string | null
  delivery_capability?: string | null
  max_concurrent_deals: number
  active_deals_now: number
  capacity_available: number
  sales_contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  preferred_channel?: string | null
  commercial_model?: string | null
  referral_margin_pct?: number | null
  deal_registration_agreed: boolean
  conflicts?: string | null
  leads_received: number
  acknowledged_within_sla: number
  deals_won: number
  partner_status: string
  conversion_rate?: number | null
  avg_days_to_first_meeting?: number | null
  notes?: string | null
  is_example?: boolean
  created_at?: string
  updated_at?: string
}

export interface TaxonomyData {
  needs: Record<string, string>
  segments: Record<string, string>
  signals: Record<string, string>
  /** The ten signal families (what kind of event a signal is about): label, what it covers, and why it matters. */
  signal_families?: Record<string, { label: string; examples: string; relevance: string }>
  parent_products: Record<string, string>
  readiness_statuses: Record<string, string>
  partner_sellable_readiness: string[]
  deployment_models: Record<string, string>
  deal_bands: Record<string, string>
  procurement_routes: Record<string, string>
  geographies: Record<string, string>
  partner_types: Record<string, string>
  delivery_capabilities: Record<string, string>
  preferred_channels: Record<string, string>
  partner_statuses: Record<string, string>
}

export interface RuleEvaluation {
  passed: boolean
  detail: string
}

export interface PartnerEvaluation {
  partner: Partner
  eligibility_status: 'eligible' | 'ineligible' | 'needs_review'
  rule_evaluations: Record<string, RuleEvaluation>
}

export interface OfferMatchResult {
  offer: ProductOffer
  match_score: number
  /** Need codes an imported signal carried that this offer solves (each adds to the score). */
  matched_need_codes?: string[]
  /** Readiness is reported, never scored. `is_deliverable` = confirmed by an administrator. */
  is_deliverable?: boolean
  matched_needs: string[]
  matched_segments: string[]
  matched_signals: string[]
  match_reasons: string[]
  satisfied_criteria: string[]
  missing_criteria: string[]
  partner_evaluations: PartnerEvaluation[]
  match_status?: 'Matched' | 'Reviewed' | 'Follow-up' | 'Dismissed' | string
  review_notes?: string | null
  match_id?: number | null
}

export interface SignalMatchingResponse {
  evidence: {
    identified_needs: string[]
    target_segments: string[]
    trigger_signals: string[]
    geography: string
  }
  offer_matches: OfferMatchResult[]
}

/** One product as stored: its portfolio offers, its ICP and what is still missing for discovery. */
export interface ProductInfo {
  key: string
  label: string
  /** True for a product this organisation created itself (not one of the built-in products). */
  custom?: boolean
  /** Why signals cannot be generated for this product yet (an own product whose generation is not switched on), or null. */
  generation_note?: string | null
  business_fit: string
  /** The name the Product Portfolio uses for this product (its `parent_product`). */
  portfolio_name: string | null
  offers: Array<{
    id: number
    offer_id: string
    name: string
    what_it_does: string | null
    readiness_status: string | null
    needs_solved: string[] | null
    primary_segments: string[] | null
    trigger_signals: string[] | null
    pricing_model: string | null
    typical_deal_band: string | null
  }>
  icp: null | {
    profile_id: number | null
    source: 'database' | 'template' | null
    name: string | null
    pitch: string | null
    ideal_customer: string | null
    buyer_types: string[]
    regions: string[]
    triggers: string[]
    parts: Record<string, string>
    searches: number
    /** The portfolio products this ICP lists, by Offer ID (null for an older ICP that has no list). */
    offer_ids?: string[] | null
  }
  target_accounts: number
  contacts: number
  ready: boolean
  /** ready | needs_setup (no usable active ICP, or parts missing) | invalid (a saved ICP fails validation) */
  state: 'ready' | 'needs_setup' | 'invalid'
  next_step: string | null
  draft_icp: { id: number; name: string } | null
  missing: string[]
  opportunities_count: number
  research_runs_count: number
}

/** What a run for one product will be built from: which saved product details and ICP fields exist, what each is used for, and what is missing. */
export interface ResearchContext {
  product: { key: string | null; label: string | null; custom: boolean }
  icp: { source: 'database' | 'template' | null; profile_id: number | null; name: string | null; version: number | null; regions: string[]; saved: boolean } | null
  product_fields: { field: string; saved: boolean; used_for: string; stages?: string[] }[]
  icp_fields: { field: string; saved: boolean; used_for: string; stages?: string[] }[]
  /** Saved on the product but not read by research (pricing, deal size, deployment, delivery owner, notes, company profile). */
  kept_for_people?: { field: string; saved: boolean; used_for: string; stages?: string[] }[]
  offer_count: number
  warnings: string[]
}

export interface ProductsResponse {
  status: number
  data: {
    products: ProductInfo[]
    company_profile: { name: string | null; description: string | null; target_industries: string[] | null; target_markets: string[] | null } | null
  }
}

