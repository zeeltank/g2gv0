/**
 * GTM & Revenue endpoints (Laravel /api/gtm/*).
 *
 * Tenant identity is decided server-side from the token; the Bearer header is added by
 * apiClient, so nothing here sends a tenant or user id. Reads need Administrator or
 * Executive, writes Administrator - a 403 is surfaced to the screen, not swallowed.
 */

import { apiClient } from '@/services/core'

export const ACCOUNT_STAGES = ['target', 'engaged', 'opportunity', 'customer', 'churned', 'disqualified'] as const
export type AccountStage = (typeof ACCOUNT_STAGES)[number]

export const CONTACT_ROLES = ['champion', 'economic_buyer', 'decision_maker', 'influencer', 'user', 'blocker'] as const
export const ACTIVITY_TYPES = ['note', 'call', 'meeting', 'email', 'linkedin', 'task'] as const

export interface GtmOverview {
  measured: {
    accounts_total: number
    accounts_by_stage: Record<string, number>
    contacts_total: number
    accounts_without_contacts: number
    signals_by_priority: Record<string, number>
    signals_unreviewed: number
    companies_not_yet_accounts: number
    activities_30d_by_type: Record<string, number>
    activities_30d_total: number
  }
  estimates: { icp_fit_avg: number | null; icp_fit_scored_accounts: number }
  readiness: {
    web_search: { configured: boolean; driver: string | null }
    ai: { configured: boolean }
  }
}

export interface GtmAccount {
  id: number
  company_id: number | null
  name: string
  domain: string | null
  website: string | null
  industry: string | null
  employee_range: string | null
  location: string | null
  stage: AccountStage
  owner_user_id: number | null
  icp_fit_score: number | null
  icp_fit_basis: unknown
  source: 'manual' | 'research' | 'import'
  notes: string | null
  created_at: string
  // list-only aggregates
  contacts_count?: number
  signals_count?: number
  last_activity_at?: string | null
}

export interface GtmContact {
  id: number
  account_id: number
  full_name: string
  title: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  role_in_deal: (typeof CONTACT_ROLES)[number] | null
  status: 'active' | 'bounced' | 'unsubscribed' | 'do_not_contact'
}

export interface GtmActivity {
  id: number
  type: string
  direction: string | null
  subject: string | null
  body: string | null
  occurred_at: string | null
  user_id: number | null
}

export interface GtmSignal {
  id: number
  title: string
  signal_kind: string | null
  observed_event: string | null
  why_indicates_need: string | null
  recommended_action: string | null
  priority: string
  confidence: string | null
  review_status: string
  sources: { url: string; title?: string; published_at?: string | null }[]
  event_date: string | null
}

export interface GtmCandidate {
  id: number
  name: string
  website: string | null
  industry: string | null
  location: string | null
  signals_count: number
  top_signal: { title: string; priority: string; kind: string | null; source_url: string | null } | null
}

export interface AccountDetail {
  account: GtmAccount
  contacts: GtmContact[]
  signals: GtmSignal[]
  activities: GtmActivity[]
  analyses: { id: number; kind: string; status: string; is_estimate: boolean; provider: string | null; model: string | null; created_at: string }[]
}

type Env<T> = { status: number; data: T; message?: string }

export interface AccountInput {
  name: string
  domain?: string | null
  website?: string | null
  industry?: string | null
  employee_range?: string | null
  location?: string | null
  stage?: AccountStage
  notes?: string | null
}

export const gtmService = {
  overview: () => apiClient.get<Env<GtmOverview>>('/gtm/overview'),

  listAccounts: (q: { q?: string; stage?: string; page?: number; sort?: string } = {}) => {
    const params: Record<string, string> = { page: String(q.page ?? 1) }
    if (q.q) params.q = q.q
    if (q.stage) params.stage = q.stage
    if (q.sort) params.sort = q.sort
    return apiClient.get<Env<{ items: GtmAccount[]; total: number; page: number; per_page: number }>>('/gtm/accounts', params)
  },

  candidates: () => apiClient.get<Env<{ items: GtmCandidate[] }>>('/gtm/accounts/candidates'),

  getAccount: (id: number) => apiClient.get<Env<AccountDetail>>(`/gtm/accounts/${id}`),

  createAccount: (input: AccountInput) => apiClient.post<Env<{ account: GtmAccount }>>('/gtm/accounts', input),

  promoteCompany: (companyId: number) =>
    apiClient.post<Env<{ account: GtmAccount; created: boolean }>>(`/gtm/accounts/from-company/${companyId}`, {}),

  updateAccount: (id: number, input: Partial<AccountInput>) =>
    apiClient.patch<Env<{ account: GtmAccount }>>(`/gtm/accounts/${id}`, input),

  deleteAccount: (id: number) => apiClient.delete<Env<null>>(`/gtm/accounts/${id}`),

  addContact: (accountId: number, input: Partial<GtmContact> & { full_name: string }) =>
    apiClient.post<Env<{ contact: GtmContact }>>(`/gtm/accounts/${accountId}/contacts`, input),

  deleteContact: (id: number) => apiClient.delete<Env<null>>(`/gtm/contacts/${id}`),

  logActivity: (accountId: number, input: { type: string; subject: string; body?: string; contact_id?: number }) =>
    apiClient.post<Env<{ activity: GtmActivity }>>(`/gtm/accounts/${accountId}/activities`, input),
}
