import type { ProductsResponse } from '../../services/portfolio/types'
import type { Opportunity, OpportunityListResponse } from '../../services/signals/opportunities'
import { REASONS } from './signal-fixtures'

/** Made-up Company Opportunities rows and products for the screen tests (the names, quotes and dates are examples). */

export function opportunity(over: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 1,
    company_id: 10,
    company_name: 'Example School District',
    website: null,
    industry: null,
    location: null,
    title: 'District office invites bids for a school management system',
    category: 'tender',
    category_label: 'Tender',
    signal_kind: null,
    signal_kind_label: null,
    observed_event: 'Invites sealed bids.',
    why_indicates_need: 'A district office is asking for bids on a school management system.',
    product_fit: 'Scholar',
    product_name: 'ScholarClone',
    recommended_action: 'Send a proposal.',
    priority: 'High',
    qualification: 'New Opportunity',
    confidence: 'High',
    review_status: 'New',
    primary_source: { url: 'https://district-notices.example/tenders/42', title: 'Tender notice 42', published_at: '2026-10-12' },
    source_count: 1,
    source_published_at: '2026-10-12',
    event_date: '2026-10-12',
    report_date: '2026-11-02',
    first_discovered_at: '2026-11-02T13:42:00+05:30',
    last_verified_at: '2026-11-02T13:42:00+05:30',
    research_run_id: 81,
    business_fit: 'scholar',
    product_master_id: 4,
    product_master_name: 'Scholar',
    date_info: { status: 'event_date_stated', date: '2026-10-12' },
    claim_level: 'confirmed',
    scores: { buying_signal: 5, problem_fit: 4, product_fit: 5, accessibility: 3, urgency: 4, potential_value: 3, evidence_quality: 4, total: 24 },
    assessment: {
      fit: { total: 71, band: 'High', components: { product: { score: 20, max: 25, why: 'asks for a school management system' } } },
      evidence: { quote_verified: true, read_as: 'page_text', date_provenance: 'visible_absolute' },
      provenance: { public_fact: { quote: 'invites sealed bids for the supply and rollout of a school management system across 14 schools', source_url: 'https://district-notices.example/tenders/42', source_title: 'Tender notice 42' } },
    } as unknown as Opportunity['assessment'],
    source_url: 'https://district-notices.example/tenders/42',
    source_title: 'Tender notice 42',
    ...over,
  }
}

export function opportunities(): Opportunity[] {
  return [
    opportunity({ id: 1 }),
    opportunity({ id: 2, title: 'Principal posts for a data-entry coordinator', company_name: 'Example Public School', review_status: 'Follow-up', priority: 'Medium', date_info: { status: 'source_date_only', date: '2026-10-03' }, event_date: null, source_published_at: '2026-10-03' }),
    opportunity({ id: 3, title: 'Board announces fee-collection upgrade', company_name: 'Example Trust Schools', review_status: 'Dismissed', date_info: { status: 'undated', date: null }, event_date: null, source_published_at: null }),
  ]
}

export function opportunityList(rows: Opportunity[] = opportunities(), over: Partial<OpportunityListResponse> = {}): OpportunityListResponse {
  return {
    status: 1,
    data: rows,
    meta: { page: 1, per_page: 5, total: rows.length, last_page: 1 },
    summary: { total: 73, new: 68, high_priority: 12, follow_up: 5 },
    filters: {
      categories: [], kinds: [], report_dates: [],
      business_fits: ['eb', 'scholar', 'g2g', 'multiple'],
      products: [{ value: 'scholarclone', label: 'ScholarClone', business_fit: 'scholar' }, { value: 'g2g', label: 'G2G', business_fit: 'g2g' }],
      review_reasons: REASONS,
    },
    ...over,
  }
}

/** The two products the screen offers: ScholarClone (ready, with one sub-product) and G2G (ready). */
export function portfolioProducts(): ProductsResponse {
  const base = {
    custom: false, generation_note: null, portfolio_name: null, icp: null, target_accounts: 0, contacts: 0, ready: true, state: 'ready' as const, next_step: null,
    draft_icp: null, missing: [] as string[], opportunities_count: 0, research_runs_count: 0,
    icp_models: { b2b: { ready: true, missing: [], configured: true }, b2c: { ready: true, missing: [], configured: true }, b2g: { ready: true, missing: [], configured: true } },
  }
  return {
    status: 1,
    data: {
      company_profile: null,
      products: [
        { ...base, key: 'scholarclone', label: 'ScholarClone', business_fit: 'scholar', offers: [{ id: 1, offer_id: 'SCH-11', name: 'Scholar Learn', what_it_does: null, readiness_status: null, needs_solved: null, primary_segments: null, trigger_signals: null, pricing_model: null, typical_deal_band: null, icp_ready: true }] },
        { ...base, key: 'g2g', label: 'G2G', business_fit: 'g2g', offers: [] },
      ],
    },
  } as unknown as ProductsResponse
}
