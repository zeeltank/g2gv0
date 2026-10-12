/**
 * GTM campaigns, segments and the owner directory (Laravel /api/gtm/*).
 * Reads need Administrator or Executive, writes Administrator; tenant comes from the token.
 */

import { apiClient } from '@/services/core'

type Env<T> = { status: number; data: T; message?: string }

export const CAMPAIGN_KINDS = ['abm', 'outbound', 'nurture', 'event'] as const
export const CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'completed', 'archived'] as const
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]

export interface Campaign {
  id: number
  name: string
  kind: string
  goal: string | null
  industry_pack_slug: string | null
  segment_id: number | null
  owner_user_id: number | null
  starts_on: string | null
  ends_on: string | null
  status: CampaignStatus
  created_at: string
  target_accounts?: number
}

export interface IndustryPackRef { slug: string; title: string }
export interface IndustryPack extends IndustryPackRef {
  description: string | null
  version: number | string | null
  definition: unknown
}

export interface CampaignMember {
  id: number
  account_id: number
  contact_id: number
  created_at: string
  account_name: string
  account_stage: string
  contact_name: string | null
  contact_status: string | null
}

export interface CampaignMetrics {
  targets: { accounts: number; contacts: number }
  outreach: {
    messages: number; draft: number; pending_approval: number; approved: number
    sent: number; failed: number; cancelled: number; contacts_reached: number
  }
  engagement: {
    contacts_replied: number; accounts_engaged: number; bounced_contacts: number; unsubscribed_contacts: number
    reply_rate_pct: number | null; account_engagement_pct: number | null
  }
  conversion: {
    accounts_with_new_deal: number; deals_created: number; deals_won: number
    pipeline_value_by_currency: Record<string, number>; won_value_by_currency: Record<string, number>
    account_conversion_pct: number | null; note: string
  }
}

export interface CampaignDetail {
  campaign: Campaign
  members: CampaignMember[]
  metrics: CampaignMetrics
  industry_pack: IndustryPack | null
  transitions: CampaignStatus[]
}

export interface CampaignInput {
  name?: string
  kind?: string
  goal?: string | null
  industry_pack_slug?: string | null
  segment_id?: number | null
  owner_user_id?: number | null
  starts_on?: string | null
  ends_on?: string | null
}

export type SegmentKind = 'account' | 'contact'

/** Whitelisted criteria keys - see SegmentCriteria.php. */
export interface SegmentCriteria {
  stages?: string[]
  sources?: string[]
  industry_contains?: string
  location_contains?: string
  min_icp?: number
  max_icp?: number
  has_contacts?: boolean
  min_signal_priority?: string
  owner_user_id?: number
  not_in_campaign_id?: number
  roles?: string[]
  statuses?: string[]
  has_email?: boolean
  account_stages?: string[]
}

export interface Segment {
  id: number
  name: string
  kind: SegmentKind
  description: string | null
  criteria: SegmentCriteria
  match_count: number
  created_at: string
}

export interface SegmentFilters {
  account: { stages: string[]; sources: string[]; priorities: string[] }
  contact: { roles: string[]; statuses: string[]; account_stages: string[] }
}

export interface SegmentPreview {
  segment: Segment
  total: number
  sample: Record<string, string | number | null>[]
  without_email?: number
  suppressed?: number
}

export interface SegmentInput {
  name?: string
  kind?: SegmentKind
  description?: string | null
  criteria?: SegmentCriteria
}

export interface DirectoryUser { id: number; name: string; department_id: number | null }

export const campaignService = {
  list: (status?: string) =>
    apiClient.get<Env<{ items: Campaign[]; kinds: string[]; packs: IndustryPackRef[] }>>('/gtm/campaigns', status ? { status } : {}),
  get: (id: number) => apiClient.get<Env<CampaignDetail>>(`/gtm/campaigns/${id}`),
  create: (input: CampaignInput) => apiClient.post<Env<{ campaign: Campaign }>>('/gtm/campaigns', input),
  update: (id: number, input: CampaignInput) => apiClient.patch<Env<{ campaign: Campaign }>>(`/gtm/campaigns/${id}`, input),
  setStatus: (id: number, status: CampaignStatus, confirm = false) =>
    apiClient.post<Env<{ campaign: Campaign; outreach_cancelled: number }>>(`/gtm/campaigns/${id}/status`, confirm ? { status, confirm: true } : { status }),
  addMembers: (id: number, input: { segment_id?: number; account_ids?: number[]; contact_ids?: number[] }) =>
    apiClient.post<Env<{ added: number; already_members: number; rejected: string[] }>>(`/gtm/campaigns/${id}/members`, input),
  removeMember: (id: number, memberId: number) => apiClient.delete<Env<null>>(`/gtm/campaigns/${id}/members/${memberId}`),
}

export const segmentService = {
  list: () => apiClient.get<Env<{ items: Segment[]; filters: SegmentFilters }>>('/gtm/segments'),
  create: (input: SegmentInput) => apiClient.post<Env<{ segment: Segment }>>('/gtm/segments', input),
  update: (id: number, input: SegmentInput) => apiClient.patch<Env<{ segment: Segment }>>(`/gtm/segments/${id}`, input),
  remove: (id: number) => apiClient.delete<Env<null>>(`/gtm/segments/${id}`),
  preview: (id: number) => apiClient.get<Env<SegmentPreview>>(`/gtm/segments/${id}/preview`),
}

export const directoryService = {
  get: () => apiClient.get<Env<{ users: DirectoryUser[]; departments: { id: number; name: string }[] }>>('/gtm/directory'),
}
