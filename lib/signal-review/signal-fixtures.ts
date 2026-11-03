import type { SignalListResponse, SignalRow } from '../../services/signal-review/signal-types'
import type { ReasonOption, ReviewHistoryEntry } from '../../services/signal-review/types'

/** Made-up signals for the Signal Review tests (the names, quotes and dates are examples, as in the approved mock-up). */

export const REASONS: ReasonOption[] = [
  { value: 'not_a_buyer', label: 'Not a buyer for our products' },
  { value: 'wrong_product', label: 'Real signal, wrong product' },
  { value: 'other', label: 'Other (a note is required)' },
]

export function signalRow(over: Partial<SignalRow> = {}): SignalRow {
  return {
    id: 1,
    title: 'District office invites bids for a school management system',
    company_name: 'Example School District',
    review_status: 'New',
    review_notes: null,
    priority: 'High',
    business_fit: 'scholar',
    product_master_id: 4,
    product_master_name: 'Scholar',
    date_info: { status: 'event_date_stated', date: '2026-10-12' },
    event_date: '2026-10-12',
    source_published_at: null,
    first_discovered_at: '2026-11-02T13:42:00+05:30',
    research_run_id: 81,
    entered_manually: false,
    why_indicates_need: 'A district office is asking for bids on a school management system.',
    observed_event: 'Invites sealed bids.',
    claim_level: 'confirmed',
    scores: { total: 24 },
    source_url: 'https://district-notices.example/tenders/42',
    source_title: 'Tender notice 42',
    primary_source: { url: 'https://district-notices.example/tenders/42', title: 'Tender notice 42', excerpt: 'Invites sealed bids for the supply of a school management system.' },
    assessment: { evidence: { date_provenance: 'visible_absolute' }, provenance: { public_fact: { quote: 'invites sealed bids for the supply and rollout of a school management system across 14 schools' } } },
    ...over,
  }
}

/** The three kinds of date, a Contacted row and a row with no product: the five rows of the mock-up. */
export function mockupRows(): SignalRow[] {
  return [
    signalRow({ id: 1 }),
    signalRow({ id: 2, title: 'Principal posts for a data-entry coordinator', company_name: 'Example Public School', date_info: { status: 'source_date_only', date: '2026-10-03' }, event_date: null, source_published_at: '2026-10-03', business_fit: 'g2g', product_master_id: 5, product_master_name: 'G2G' }),
    signalRow({ id: 3, title: 'Board announces fee-collection upgrade', company_name: 'Example Trust Schools', date_info: { status: 'undated', date: null }, event_date: null, source_published_at: null }),
    signalRow({ id: 4, title: 'Rival vendor wins a district contract', company_name: 'Example Education Board', review_status: 'Follow-up', priority: 'Low' }),
    signalRow({ id: 5, title: 'Academy lists a vacancy for an ERP administrator', company_name: 'Example Academy', review_status: 'Dismissed', product_master_id: null, product_master_name: null, business_fit: null, scores: null }),
  ]
}

export function listResponse(rows: SignalRow[] = mockupRows(), over: Partial<SignalListResponse> = {}): SignalListResponse {
  return {
    status: 1,
    data: rows,
    meta: { page: 1, per_page: 20, total: rows.length, last_page: 1 },
    summary: { total: 73, new: 68, high_priority: 12, follow_up: 5 },
    filters: {
      business_fits: ['eb', 'scholar', 'g2g', 'multiple'],
      products: [{ value: 'scholar', label: 'Scholar', business_fit: 'scholar' }, { value: 'g2g', label: 'G2G', business_fit: 'g2g' }],
      review_reasons: REASONS,
    },
    ...over,
  }
}

export function historyEntry(over: Partial<ReviewHistoryEntry> = {}): ReviewHistoryEntry {
  return {
    id: 12, decision: 'follow_up', reason_code: null, reason_label: null, note: 'Called the office.', from_status: 'New', to_status: 'Follow-up', via: 'signal_review',
    decided_by: 3, decided_by_name: 'Anil', decided_at: '2026-11-03T10:15:00+05:30', ...over,
  }
}
