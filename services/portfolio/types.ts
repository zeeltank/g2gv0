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
  typical_deal_band?: string | null
  pricing_model?: string | null
  implementation_effort?: string | null
  delivery_owner?: string | null
  bundles_with?: string[]
  proof_points?: string | null
  partner_sellable: boolean
  notes?: string | null
  is_user_edited?: boolean
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

