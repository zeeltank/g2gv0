import type { PmOption } from '../../services/product-master/types'

/** One CRM campaign, shaped like the existing presenter's answer (camelCase), with none of slice 9's fields: what an older server sends. */
export function campaign(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '7', campaignNo: 'CAM-ABC12345', name: 'Diwali outreach', campaignType: 'Email', campaignStatus: 'Active', expectedRevenue: 500000, budgetCost: 20000,
    actualCost: null, expectedResponse: null, numSent: 12, sponsor: null, targetAudience: null, targetSize: 40, expectedResponseCount: null, expectedSalesCount: null,
    actualResponseCount: null, actualSalesCount: null, expectedRoi: null, actualRoi: null, closingDate: '2026-12-01', productId: null, description: null,
    assignedTo: '2', createdBy: '2', createdAt: '2026-11-01 10:00:00', updatedAt: null, ...over,
  }
}

export const PRODUCT = { id: 9, key: 'scholarclone-erp', name: 'School ERP' }

/** The funnel as the S9a contract sends it: snake_case `opted_out`, every count an integer. */
export const FUNNEL = { targets: 40, sent: 30, opened: 12, replied: 6, meetings: 3, converted: 1, opted_out: 2 }

/** A campaign DETAIL as the S9a contract says the server sends it: the list's `product`, plus `funnel`, `gtm_campaign` and `leads`. */
export function contractDetail(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...campaign(), product: PRODUCT, funnel: FUNNEL, gtm_campaign: { id: 5, name: 'Diwali GTM', status: 'active' }, leads: { count: 4 }, ...over,
  }
}

/** A GTM campaign's detail answer (`GET /api/gtm/campaigns/{id}`) from an older server: no `product`, no `crm_campaign`. */
export function gtmDetail(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    campaign: {
      id: 5, name: 'Diwali GTM', kind: 'outbound', goal: 'Reach schools before Diwali', industry_pack_slug: null, segment_id: null, owner_user_id: 2, starts_on: '2026-11-01',
      ends_on: '2026-12-01', status: 'active', created_at: '2026-11-01 10:00:00',
    },
    members: [],
    metrics: {
      targets: { accounts: 0, contacts: 0 },
      outreach: { messages: 0, draft: 0, pending_approval: 0, approved: 0, sent: 0, failed: 0, cancelled: 0, contacts_reached: 0 },
      engagement: { contacts_replied: 0, accounts_engaged: 0, bounced_contacts: 0, unsubscribed_contacts: 0, reply_rate_pct: null, account_engagement_pct: null },
      conversion: { accounts_with_new_deal: 0, deals_created: 0, deals_won: 0, pipeline_value_by_currency: {}, won_value_by_currency: {}, account_conversion_pct: null, note: 'Counted from deals.' },
    },
    industry_pack: null,
    transitions: ['paused'],
    ...over,
  }
}

export const options: PmOption[] = [
  { id: 4, key: 'scholarclone', name: 'ScholarClone', kind: 'product', parentId: null, label: 'ScholarClone' },
  { id: 9, key: 'scholarclone-erp', name: 'School ERP', kind: 'sub_product', parentId: 4, label: 'ScholarClone › School ERP' },
  { id: 12, key: 'g2g', name: 'G2G', kind: 'product', parentId: null, label: 'G2G' },
]

export function listAnswer(items: unknown[], total?: number) {
  return { status: 1, message: 'Campaigns.', data: { items, pagination: { current_page: 1, last_page: Math.max(1, Math.ceil((total ?? items.length) / 20)), per_page: 20, total: total ?? items.length } } }
}
