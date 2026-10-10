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
  /** null = deals are not installed in this environment, which is different from zero deals. */
  deals: {
    open_count: number
    open_value_by_currency: Record<string, number>
    open_without_amount: number
    flagged_count: number
    no_next_step_count: number
    won_30d: { count: number; value_by_currency: Record<string, number> }
    lost_30d: { count: number }
    customers: number
  } | null
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
  icp_fit_basis: IcpBasis | null
  icp_scored_at: string | null
  source: 'manual' | 'research' | 'import'
  notes: string | null
  created_at: string
  // list-only aggregates
  contacts_count?: number
  signals_count?: number
  last_activity_at?: string | null
}

export interface IcpBasis {
  dimensions: { name: string; score: number | null; reason: string }[]
  summary: string
  missing: string[]
  confidence: 'low' | 'medium' | 'high'
  adjustments: string[]
  provider: string
  model: string
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

  scoreIcp: (id: number) =>
    apiClient.post<Env<{ account: GtmAccount; score: number | null; basis: IcpBasis }>>(`/gtm/accounts/${id}/score-icp`, {}),

  deleteAccount: (id: number) => apiClient.delete<Env<null>>(`/gtm/accounts/${id}`),

  addContact: (accountId: number, input: Partial<GtmContact> & { full_name: string }) =>
    apiClient.post<Env<{ contact: GtmContact }>>(`/gtm/accounts/${accountId}/contacts`, input),

  deleteContact: (id: number) => apiClient.delete<Env<null>>(`/gtm/contacts/${id}`),

  logActivity: (accountId: number, input: { type: string; subject: string; body?: string; contact_id?: number }) =>
    apiClient.post<Env<{ activity: GtmActivity }>>(`/gtm/accounts/${accountId}/activities`, input),
}

export const PLAYBOOK_KINDS = ['role_playbook', 'methodology', 'industry_pack', 'template', 'workflow'] as const
export const PLAYBOOK_ROLES = ['sdr', 'ae', 'marketing', 'revops', 'csm', 'all'] as const

export interface GtmPlaybook {
  id: number
  kind: (typeof PLAYBOOK_KINDS)[number]
  role: (typeof PLAYBOOK_ROLES)[number]
  stage: string | null
  slug: string
  title: string
  description: string | null
  body: string | null
  inputs: string[] | null
  output_schema: Record<string, unknown> | null
  definition: Record<string, unknown> | null
  status: 'active' | 'draft' | 'archived'
  version: number
  source: 'platform' | 'organisation'
  editable: boolean
  overrides_default: boolean
}

export interface PlaybookVersion { version: number; title: string; change_note: string | null; created_at: string }

export interface PlaybookInput {
  kind: GtmPlaybook['kind']
  role: GtmPlaybook['role']
  stage?: string | null
  slug: string
  title: string
  description?: string | null
  body: string
  definition?: Record<string, unknown> | null
}

export const playbookService = {
  list: (q: { kind?: string; role?: string; status?: string } = {}) => {
    const params: Record<string, string> = {}
    if (q.kind) params.kind = q.kind
    if (q.role) params.role = q.role
    if (q.status) params.status = q.status
    return apiClient.get<Env<{ items: GtmPlaybook[] }>>('/gtm/playbooks', params)
  },
  get: (id: number) => apiClient.get<Env<{ playbook: GtmPlaybook; versions: PlaybookVersion[] }>>(`/gtm/playbooks/${id}`),
  create: (input: PlaybookInput) => apiClient.post<Env<{ playbook: GtmPlaybook }>>('/gtm/playbooks', input),
  customise: (id: number) => apiClient.post<Env<{ playbook: GtmPlaybook; created: boolean }>>(`/gtm/playbooks/${id}/customise`, {}),
  update: (id: number, input: Partial<Omit<PlaybookInput, 'slug' | 'kind'>> & { status?: GtmPlaybook['status']; change_note?: string }) =>
    apiClient.patch<Env<{ playbook: GtmPlaybook }>>(`/gtm/playbooks/${id}`, input),
  restore: (id: number, version: number) => apiClient.post<Env<{ playbook: GtmPlaybook }>>(`/gtm/playbooks/${id}/versions/${version}/restore`, {}),
  archive: (id: number) => apiClient.delete<Env<null>>(`/gtm/playbooks/${id}`),
}

export interface GtmAgentInfo {
  slug: string
  name: string
  description: string
  inputs: Record<string, { type: string; required: boolean; label: string; options?: string[] }>
  reads: string[]
  runnable: boolean
  unavailable_reason: string | null
  writes: string
  last_run: { id: number; status: string; error_message: string | null; started_at: string } | null
}

export interface GtmAgentRunRow { id: number; slug: string; name: string; status: string; error_message: string | null; duration_ms: number | null; tokens_used: number | null; started_at: string }

export interface GtmAgentOutput {
  run_id: number
  result: Record<string, unknown>
  analysis_id: number
  provider: string
  model: string
  playbook: { slug: string; version: number; source: string }
  integrity: { references_dropped: number; note: string | null }
}

/** An agent failure keeps the server's code so the screen can say what actually happened. */
export const agentService = {
  list: () => apiClient.get<Env<{ agents: GtmAgentInfo[]; ai_configured: boolean }>>('/gtm/agents'),
  run: (slug: string, input: Record<string, unknown>) => apiClient.post<Env<GtmAgentOutput>>(`/gtm/agents/${slug}/run`, { input }),
  runs: (agent?: string) => apiClient.get<Env<{ runs: GtmAgentRunRow[] }>>('/gtm/agents/runs', agent ? { agent } : {}),
  runDetail: (id: number) => apiClient.get<Env<{ run: GtmAgentRunRow & { input: unknown; output: GtmAgentOutput | null } }>>(`/gtm/agents/runs/${id}`),
}

export const DEAL_STAGES = ['discovery', 'qualification', 'proposal', 'negotiation', 'won', 'lost'] as const
export const OPEN_DEAL_STAGES = ['discovery', 'qualification', 'proposal', 'negotiation'] as const
export type DealStage = (typeof DEAL_STAGES)[number]

export interface DealHealth {
  flags: string[]
  days_since_activity: number | null
  days_in_stage: number | null
  last_activity_at: string | null
}

export interface GtmDeal {
  id: number
  account_id: number
  account_name?: string
  name: string
  stage: DealStage
  amount: string | null
  currency: string | null
  expected_close_date: string | null
  owner_user_id: number | null
  next_step: string | null
  next_step_due: string | null
  methodology_slug: string | null
  stage_changed_at: string | null
  closed_at: string | null
  close_reason: string | null
  health?: DealHealth | null
}

export interface MethodologyScore {
  total: number | null
  coverage: { scored: number; of: number }
  dimensions: { key: string; label: string; weight: number; score: number | null; evidence: string; next_action: string }[]
  methodology: { slug: string; title: string; version: number; source: string }
  missing: string[]
}

export interface DealDetail {
  deal: GtmDeal
  account: { id: number; name: string; stage: string; industry: string | null } | null
  contacts: GtmContact[]
  activities: GtmActivity[]
  history: { from_stage: string | null; to_stage: string; note: string | null; changed_at: string }[]
  health: DealHealth | null
  flag_labels: Record<string, string>
  analyses: {
    methodology_score: { id: number; result: MethodologyScore; model: string | null; created_at: string } | null
    discovery_analysis: { id: number; result: Record<string, unknown>; model: string | null; created_at: string } | null
    deal_coach: { id: number; result: Record<string, unknown>; model: string | null; created_at: string } | null
  }
}

export interface PipelineSummary {
  stages: { stage: DealStage; count: number; value_by_currency: Record<string, number>; without_amount: number; flagged: number }[]
  open_total: number
  open_value_by_currency: Record<string, number>
  closed_last_days: number
  won: { count: number; value_by_currency: Record<string, number> }
  lost: { count: number; value_by_currency: Record<string, number> }
}

export interface DealInput {
  account_id?: number
  name?: string
  amount?: number | null
  currency?: string | null
  expected_close_date?: string | null
  next_step?: string | null
  next_step_due?: string | null
  methodology_slug?: string | null
}

export const dealService = {
  list: (q: { status?: string; stage?: string; q?: string; page?: number } = {}) => {
    const params: Record<string, string> = { page: String(q.page ?? 1), per_page: '100' }
    if (q.status) params.status = q.status
    if (q.stage) params.stage = q.stage
    if (q.q) params.q = q.q
    return apiClient.get<Env<{ items: GtmDeal[]; total: number }>>('/gtm/deals', params)
  },
  pipeline: () => apiClient.get<Env<PipelineSummary>>('/gtm/deals/pipeline'),
  get: (id: number) => apiClient.get<Env<DealDetail>>(`/gtm/deals/${id}`),
  create: (input: DealInput) => apiClient.post<Env<{ deal: GtmDeal }>>('/gtm/deals', input),
  update: (id: number, input: DealInput) => apiClient.patch<Env<{ deal: GtmDeal }>>(`/gtm/deals/${id}`, input),
  setStage: (id: number, input: { stage: DealStage; confirm?: boolean; close_reason?: string; note?: string }) =>
    apiClient.post<Env<{ deal: GtmDeal; account_stage_changed: boolean }>>(`/gtm/deals/${id}/stage`, input),
  remove: (id: number) => apiClient.delete<Env<null>>(`/gtm/deals/${id}`),
  logActivity: (id: number, input: { type: string; subject: string; body?: string }) =>
    apiClient.post<Env<{ activity: GtmActivity }>>(`/gtm/deals/${id}/activities`, input),
  score: (id: number, methodology_slug?: string) =>
    apiClient.post<Env<MethodologyScore & { analysis_id: number; provider: string; model: string }>>(`/gtm/deals/${id}/score`, methodology_slug ? { methodology_slug } : {}),
  discovery: (id: number, notes: string) =>
    apiClient.post<Env<{ result: Record<string, unknown>; analysis_id: number; provider: string; model: string; integrity: { quotes_dropped: number; note: string | null } }>>(`/gtm/deals/${id}/discovery`, { notes }),
}

export const OUTREACH_STATUSES = ['draft', 'pending_approval', 'approved', 'rejected', 'sending', 'sent', 'failed', 'cancelled'] as const
export type OutreachStatus = (typeof OUTREACH_STATUSES)[number]

export interface OutreachMessage {
  id: number
  account_id: number
  contact_id: number
  account_name?: string
  contact_name?: string
  contact_email?: string | null
  contact_status?: string
  sequence_key: string | null
  step: number
  due_at: string | null
  subject: string
  body: string
  status: OutreachStatus
  decision_note: string | null
  sent_at: string | null
  error: string | null
  created_at: string
}

export interface OutreachReadiness {
  mailer: string
  host: string | null
  from: string
  platform_gate_allows: boolean
  gtm_sending_enabled: boolean
  unsubscribe_link_ok: boolean
  daily_cap: number
  sent_today: number
  can_send: boolean
  blockers: string[]
  smtp: { ok: boolean; error: string | null } | null
}

export const outreachService = {
  list: (status?: string) => apiClient.get<Env<{ items: OutreachMessage[]; counts: Record<string, number> }>>('/gtm/outreach', status ? { status } : {}),
  readiness: (check = false) => apiClient.get<Env<OutreachReadiness>>('/gtm/outreach/readiness', check ? { check: '1' } : {}),
  create: (input: { contact_id: number; subject: string; body: string }) => apiClient.post<Env<{ message: OutreachMessage }>>('/gtm/outreach', input),
  fromAnalysis: (analysis_id: number) => apiClient.post<Env<{ messages: OutreachMessage[] }>>('/gtm/outreach/from-analysis', { analysis_id }),
  update: (id: number, input: { subject?: string; body?: string }) => apiClient.patch<Env<{ message: OutreachMessage }>>(`/gtm/outreach/${id}`, input),
  submit: (id: number) => apiClient.post<Env<{ message: OutreachMessage }>>(`/gtm/outreach/${id}/submit`, {}),
  approve: (id: number, note?: string) => apiClient.post<Env<{ message: OutreachMessage }>>(`/gtm/outreach/${id}/approve`, { confirm: true, note }),
  reject: (id: number, note: string) => apiClient.post<Env<{ message: OutreachMessage }>>(`/gtm/outreach/${id}/reject`, { note }),
  cancel: (id: number) => apiClient.post<Env<{ message: OutreachMessage }>>(`/gtm/outreach/${id}/cancel`, {}),
  send: (id: number) => apiClient.post<Env<{ message: OutreachMessage }>>(`/gtm/outreach/${id}/send`, {}),
}

export interface ImportPreview {
  headers: string[]
  sample: string[][]
  row_count: number
  suggested_mapping: Record<string, number | null>
  fields: string[]
}

export interface ImportResult {
  summary: { rows: number; valid: number; duplicate: number; invalid: number; imported: number; accounts_created: number }
  rows: { line: number; status: 'ok' | 'duplicate' | 'invalid'; errors: string[]; warnings: string[]; name: string; email: string | null; account: string | null; creates_account: boolean }[]
  accounts_to_create: string[]
  committed: boolean
}

export const importService = {
  preview: (csv: string) => apiClient.post<Env<ImportPreview>>('/gtm/contacts/import/preview', { csv }),
  run: (input: { csv: string; mapping: Record<string, number | null>; default_account_id?: number | null; create_missing_accounts?: boolean; dry_run: boolean }) =>
    apiClient.post<Env<ImportResult>>('/gtm/contacts/import', input),
}
