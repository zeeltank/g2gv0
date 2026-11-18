import type {
  Org360, OrgAccountItem, OrgAccountSummary, OrgListResponse, OrgMeta, OrgSignalLine, OrgSuggestion,
} from '../../services/org-accounts/types'
import type { OldAccount360 } from './old-sections'

/** Fixed example data for the Organisation 360 tests. School names are made up. */

export const summary = (over: Partial<OrgAccountSummary> = {}): OrgAccountSummary => ({
  total: 5, discovered: 2, target: 1, engaged: 1, customer: 1, archived: 0, with_crm: 2, with_gtm: 2, with_signals: 3, suggestions: 2, ...over,
})

export const orgItem = (over: Partial<OrgAccountItem> = {}): OrgAccountItem => ({
  id: 1, name: 'Riverdale Public School', domain: 'riverdale.example', lifecycle: 'engaged', owner_user_id: 5, owner_name: 'Anil Shah',
  sources: {
    crm: { id: 11, account_no: 'ACC-0011' },
    gtm: { id: 21, stage: 'Qualified' },
    signals: { company_id: 31, open_signals: 3, last_signal_at: '2026-10-12' },
  },
  updated_at: '2026-10-20 10:00:00', ...over,
})

/** Five organisations: two with a CRM organisation, and three that are only known from Signals or GTM. */
export const orgItems = (): OrgAccountItem[] => [
  orgItem(),
  orgItem({ id: 2, name: 'Hillcrest Academy', domain: null, lifecycle: 'discovered', owner_user_id: null, owner_name: null, sources: { crm: null, gtm: null, signals: { company_id: 32, open_signals: 1, last_signal_at: null } } }),
  orgItem({ id: 3, name: 'Lakeview School', domain: 'lakeview.example', lifecycle: 'target', sources: { crm: null, gtm: { id: 22, stage: 'New' }, signals: null } }),
  orgItem({ id: 4, name: 'Maple Grove College', lifecycle: 'customer', sources: { crm: { id: 12, account_no: 'ACC-0012' }, gtm: null, signals: null } }),
  orgItem({ id: 5, name: 'Old Town School', lifecycle: 'archived', sources: { crm: null, gtm: null, signals: { company_id: 33, open_signals: 0, last_signal_at: null } } }),
]

/** The three of them that the CRM does not have. */
export const discoveredItems = (): OrgAccountItem[] => orgItems().filter((item) => item.sources.crm === null)

export const listResponse = (rows: OrgAccountItem[] = orgItems(), over: Partial<OrgListResponse> = {}): OrgListResponse => ({
  status: 1, data: rows, meta: { page: 1, per_page: 20, total: rows.length, last_page: 1 }, summary: summary({ total: 5 }), ...over,
})

export const meta = (can: Partial<OrgMeta['can']> = {}): OrgMeta => ({
  lifecycles: ['discovered', 'target', 'engaged', 'customer', 'archived'],
  can: { create_crm_organization: true, edit: true, confirm_links: true, ...can },
})

export const suggestion = (over: Partial<OrgSuggestion> = {}): OrgSuggestion => ({
  key: 'crm_organization:11|g2g_company:32',
  left: { type: 'crm_organization', id: 11, name: 'Riverdale Public School', place: 'Pune, Maharashtra' },
  right: { type: 'g2g_company', id: 32, name: 'Riverdale School Society', place: null },
  basis: 'name_overlap', score: 0.8, place_conflict: false, confirmable: true, ...over,
})

/** The same name in two different places: Surat and Mumbai. */
export const placeConflictSuggestion = (over: Partial<OrgSuggestion> = {}): OrgSuggestion => suggestion({
  key: 'g2g_company:41|gtm_account:42',
  left: { type: 'g2g_company', id: 41, name: 'Omega Vidyalaya', place: 'Mumbai, Maharashtra' },
  right: { type: 'gtm_account', id: 42, name: 'Omega Vidyalaya', place: 'Surat, Gujarat' },
  score: 1, place_conflict: true, ...over,
})

/** Two Signals companies: one organisation holds one record of each source, so they can only be marked as different. */
export const sameSourceSuggestion = (over: Partial<OrgSuggestion> = {}): OrgSuggestion => suggestion({
  key: 'g2g_company:51|g2g_company:52',
  left: { type: 'g2g_company', id: 51, name: 'Chi Academy', place: null },
  right: { type: 'g2g_company', id: 52, name: 'Chi Academy Pvt Ltd', place: null },
  score: 1, confirmable: false, ...over,
})

export const suggestions = (): OrgSuggestion[] => [
  suggestion(),
  suggestion({
    key: 'gtm_account:22|g2g_company:33',
    left: { type: 'gtm_account', id: 22, name: 'Lakeview School', place: null },
    right: { type: 'g2g_company', id: 33, name: 'Lake View Higher School', place: null },
    score: 0.667,
  }),
]

export const signalLine = (over: Partial<OrgSignalLine> = {}): OrgSignalLine => ({
  id: 301, title: 'District invites bids for school software', review_status: 'New',
  date_info: { status: 'event_date_stated', date: '2026-10-12' }, source_url: 'https://news.example/district-bids', business_fit: 'scholar', product_master_name: 'Scholar', ...over,
})

/** The 360 of an organisation that has a GTM account and a Signals company but no CRM organisation (it is not in the CRM yet). */
export const org360 = (over: Partial<Org360> = {}): Org360 => ({
  identity: {
    id: 2, name: 'Hillcrest Academy', domain: 'hillcrest.example', lifecycle: 'target', owner_user_id: 5, owner_name: 'Anil Shah',
    links: { crm: null, gtm: { id: 22, basis: 'exact_name' }, company: { id: 32, basis: 'exact_domain' } },
    created_at: '2026-10-01 09:00:00', updated_at: '2026-10-20 10:00:00',
  },
  crm: null,
  gtm: { id: 22, name: 'Hillcrest Academy', stage: 'Qualified', domain: 'hillcrest.example', deals_count: 1, icp_fit_score: 82, owner_name: 'Anil Shah' },
  company: { id: 32, name: 'Hillcrest Academy', website: 'https://hillcrest.example', industry: 'Education', location: 'Pune', state: 'Maharashtra', type: 'School', first_seen_at: '2026-09-15' },
  why_now: { open_signals: 2, next_event_date: '2026-12-01', open_deals: 1, last_activity_at: '2026-10-18' },
  signals: { total: 3, needing_decision: 2, decided: 1, latest: [signalLine(), signalLine({ id: 302, title: 'Principal posts about a new ERP', review_status: 'Reviewed', date_info: { status: 'undated', date: null }, source_url: null })] },
  contacts: [
    { source: 'gtm', id: 61, name: 'Meera Rao', email: 'meera@hillcrest.example', phone: '+91 98765 43210', role: 'Principal', consent_status: null },
  ],
  deals: [
    { source: 'gtm', id: 71, name: 'Hillcrest pilot', stage: 'Proposal', amount: 150000, currency: 'INR', closing_date: '2026-12-15' },
  ],
  activity: [
    { kind: 'decision', at: '2026-10-18 11:30:00', by_name: 'Anil Shah', text: 'Marked the bid signal as contacted.', source: 'signal_reviews' },
  ],
  totals: { contacts: 1, deals: 1, activity: 1 },
  ...over,
})

/** The 360 of an organisation that is in all three places: the CRM organisation (this page), the GTM account and the Signals company. */
export const org360WithCrm = (over: Partial<Org360> = {}): Org360 => org360({
  identity: {
    id: 1, name: 'Riverdale Public School', domain: 'riverdale.example', lifecycle: 'engaged', owner_user_id: 5, owner_name: 'Anil Shah',
    links: { crm: { id: 11, basis: 'manual' }, gtm: { id: 21, basis: 'existing_link' }, company: { id: 31, basis: 'exact_name' } },
    created_at: '2026-10-01 09:00:00', updated_at: '2026-10-20 10:00:00',
  },
  crm: { id: 11, account_no: 'ACC-0011', name: 'Riverdale Public School', industry: 'Education', phone: '+91 20 5550 1234', email: 'office@riverdale.example', website: 'https://riverdale.example', billing_city: 'Pune', billing_state: 'Maharashtra', assigned_to_name: 'Anil Shah' },
  contacts: [
    { source: 'crm', id: 62, name: 'Sunita Verma', email: 'sunita@riverdale.example', phone: '+91 98200 11111', role: 'Accountant', consent_status: 'opted_in' },
    { source: 'gtm', id: 63, name: 'Dev Patel', email: null, phone: null, role: null, consent_status: null },
  ],
  deals: [
    { source: 'crm', id: 72, name: 'Riverdale ERP rollout', stage: 'Negotiation', amount: 500000, currency: 'INR', closing_date: null },
    { source: 'crm', id: 73, name: 'Riverdale old licence', stage: 'Closed Won', amount: 90000, currency: 'INR', closing_date: '2026-03-01' },
    { source: 'gtm', id: 74, name: 'Riverdale pilot', stage: 'Proposal', amount: null, currency: null, closing_date: null },
  ],
  ...over,
})

/** The 360 of an organisation that exists only in the CRM (nothing else found it). */
export const org360CrmOnly = (): Org360 => org360WithCrm({
  identity: {
    id: 9, name: 'Solo Public School', domain: null, lifecycle: 'engaged', owner_user_id: null, owner_name: null,
    links: { crm: { id: 19, basis: null }, gtm: null, company: null },
    created_at: '2026-10-01 09:00:00', updated_at: '2026-10-20 10:00:00',
  },
  gtm: null,
  company: null,
  why_now: { open_signals: 0, next_event_date: null, open_deals: 0, last_activity_at: null },
  signals: { total: 0, needing_decision: 0, decided: 0, latest: [] },
  contacts: [],
  deals: [],
  totals: { contacts: 0, deals: 0, activity: 0 },
})

/**
 * What GET /api/crm/account360/{id} answers for the sections the identity 360 does not have (campaigns, knowledge sources, relationships, signal inbox).
 * Camel case, the shape CrmKnowledgeGraphController::account360 builds.
 */
export const oldAccount360 = (over: Partial<OldAccount360> = {}): OldAccount360 => ({
  campaigns: [{ campaignId: '5', campaignName: 'Autumn outreach', responseStatus: 'replied', sentAt: '2026-10-01 10:00:00' }],
  knowledgeSources: [{ id: '8', sourceType: 'news', title: 'Annual report', url: 'https://riverdale.example/report', confidence: 0.7, verified: true, collectedAt: '2026-10-02 08:00:00' }],
  relationships: [{ id: '3', fromType: 'organization', fromId: '11', toType: 'organization', toId: '999', relationshipType: 'subsidiary_of', confidence: 0.8, source: 'manual', verified: true }],
  signals: [{ id: '4', title: 'Riverdale opens a campus', classification: 'buying_signal', sourceName: 'The Hindu', sourceUrl: 'https://news.example/riverdale', publishedAt: '2026-10-02 08:00:00' }],
  ...over,
})
