/**
 * GTM Customers: health, alerts, renewals (Laravel /api/gtm/customers, /api/gtm/renewals).
 * Tenant identity comes from the token server-side. Reads need Administrator or Executive,
 * writes Administrator - a 403 is surfaced to the screen.
 */

import { apiClient } from '@/services/core'

type Env<T> = { status: number; data: T; message?: string }

export const HEALTH_BANDS = ['at_risk', 'watch', 'unknown', 'healthy'] as const
export type HealthBand = (typeof HEALTH_BANDS)[number]

export const RENEWAL_STATUSES = ['upcoming', 'in_progress', 'renewed', 'churned', 'cancelled'] as const
export type RenewalStatus = (typeof RENEWAL_STATUSES)[number]

export interface HealthComponent {
  /** null = not available (no data) - never zero. */
  score: number | null
  value: number | null
  detail: string
  weight: number
}

export interface CustomerHealthResult {
  score: number | null
  band: HealthBand
  components: Record<string, HealthComponent>
  risks: string[]
  missing: string[]
}

export interface NextRenewal {
  id: number
  date: string
  status: RenewalStatus
  amount: string | null
  currency: string | null
  name: string
}

export interface CustomerRow {
  account_id: number
  name: string
  industry: string | null
  owner_user_id: number | null
  health: CustomerHealthResult
  renewal: NextRenewal | null
  trend: { from: number | null; to: number | null; change: number | null } | null
}

export interface CustomerList {
  items: CustomerRow[]
  summary: { customers: number; healthy: number; watch: number; at_risk: number; unknown: number }
  method: string
  weights: Record<string, number>
}

export interface RenewalAlert {
  renewal_id: number
  name: string
  account_id: number
  account_name: string
  renewal_date: string
  days: number
  status: RenewalStatus
  kind: 'overdue' | 'due_soon_not_started'
  amount: string | null
  currency: string | null
}

export interface CustomerAlerts {
  renewals: RenewalAlert[]
  at_risk: { account_id: number; name: string; score: number | null; risks: string[] }[]
}

export interface Renewal {
  id: number
  account_id: number
  account_name?: string
  deal_id: number | null
  name: string
  amount: string | null
  currency: string | null
  renewal_date: string
  status: RenewalStatus
  owner_user_id: number | null
  closed_at: string | null
  outcome_note: string | null
}

export interface CustomerFacts {
  days_since_activity: number | null
  activities_total: number
  inbound_90d: number
  outbound_90d: number
  contacts: number
  active_contacts: number
  unreachable_contacts: number
  has_decision_maker: boolean
  renewal: NextRenewal | null
}

export interface ExpansionSignal {
  id: number
  title: string
  signal_kind: string | null
  priority: string
  sources: { url: string; title?: string }[]
  event_date: string | null
}

export interface CustomerDetail {
  account_id: number
  name: string
  facts: CustomerFacts
  health: CustomerHealthResult
  history: { date: string; score: number | null; band: HealthBand }[]
  renewals: Renewal[]
  expansion_signals: ExpansionSignal[]
  activities: { id: number; type: string; direction: string | null; subject: string | null; occurred_at: string | null }[]
  last_review: { id: number; result: Record<string, unknown> | null; provider: string | null; model: string | null; created_at: string } | null
}

export interface RenewalBucket { count: number; value_by_currency: Record<string, number>; without_amount: number }

export interface RenewalList {
  items: Renewal[]
  pipeline: Record<'overdue' | 'due_30' | 'due_60' | 'due_90' | 'later' | 'open_total', RenewalBucket>
}

export interface RenewalInput {
  account_id?: number
  name?: string
  renewal_date?: string
  amount?: number | null
  currency?: string | null
  owner_user_id?: number | null
}

export interface DirectoryUser { id: number; name: string; department_id: number | null }

export const customerService = {
  list: () => apiClient.get<Env<CustomerList>>('/gtm/customers'),
  alerts: () => apiClient.get<Env<CustomerAlerts>>('/gtm/customers/alerts'),
  get: (accountId: number) => apiClient.get<Env<CustomerDetail>>(`/gtm/customers/${accountId}`),
  directory: () => apiClient.get<Env<{ users: DirectoryUser[]; departments: { id: number; name: string }[] }>>('/gtm/directory'),
}

export const renewalService = {
  list: (q: { status?: string; account_id?: number; within_days?: 30 | 60 | 90 } = {}) => {
    const params: Record<string, string> = {}
    if (q.status) params.status = q.status
    if (q.account_id) params.account_id = String(q.account_id)
    if (q.within_days) params.within_days = String(q.within_days)
    return apiClient.get<Env<RenewalList>>('/gtm/renewals', params)
  },
  create: (input: RenewalInput) => apiClient.post<Env<{ renewal: Renewal }>>('/gtm/renewals', input),
  update: (id: number, input: RenewalInput) => apiClient.patch<Env<{ renewal: Renewal }>>(`/gtm/renewals/${id}`, input),
  setStatus: (id: number, input: { status: Exclude<RenewalStatus, 'upcoming'>; confirm?: boolean; note?: string; next_renewal_date?: string }) =>
    apiClient.post<Env<{ renewal: Renewal; account_stage_changed_to: string | null; next_renewal_id: number | null }>>(`/gtm/renewals/${id}/status`, input),
  remove: (id: number) => apiClient.delete<Env<null>>(`/gtm/renewals/${id}`),
}
