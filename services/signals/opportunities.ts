/**
 * Company-opportunity research + manual ingestion endpoints (Laravel /api/signals/*).
 * Tenant identity is decided server-side from the token.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'

export type ReviewStatus = 'New' | 'Reviewed' | 'Follow-up' | 'Dismissed'
export type Level = 'High' | 'Medium' | 'Low'
export type Qualification = 'New Opportunity' | 'Needs Verification' | 'Relevant Requirement Found' | 'Monitoring'
export type RunStatus = 'running' | 'success' | 'partial' | 'failed' | 'skipped'

export interface ProductProfile {
  product_name: string | null
  description: string | null
  problems_solved: string | null
  features: string | null
  target_industries: string[] | null
  target_company_types: string[] | null
  target_company_size: string | null
  target_markets: string[] | null
  ideal_customer_profile: string | null
  keywords: string[] | null
  excluded: string[] | null
  competitors: string[] | null
  research_enabled: boolean
  research_frequency: 'daily' | 'weekdays' | 'weekly'
  schedule_time: string | null
  recency_days: number
}

export interface ProfileResponse {
  status: number
  data: {
    profile: ProductProfile | null
    completeness: { complete: boolean; missing: string[] }
    defaults: { schedule_time: string; timezone: string; recency_days: number }
  }
}

export interface OpportunitySource {
  url: string
  title: string
  published_at: string | null
  excerpt?: string
  retrieved_at?: string
  page_fetched?: boolean
}

export interface Opportunity {
  id: number
  company_id: number
  company_name: string
  website: string | null
  industry: string | null
  location: string | null
  title: string
  category: string
  category_label: string
  signal_kind: string | null
  signal_kind_label: string | null
  observed_event: string
  why_indicates_need: string
  product_fit: string
  product_name: string | null
  recommended_action: string
  priority: Level
  qualification: Qualification
  confidence: Level
  review_status: ReviewStatus
  primary_source: OpportunitySource | null
  source_count: number
  source_published_at: string | null
  event_date: string | null
  report_date: string | null
  first_discovered_at: string
  last_verified_at: string
  research_run_id: number | null
  confirmed_facts?: string[]
  unverified_claims?: string[]
  urgency?: string | null
  feed_section?: 'immediate_action' | 'watchlist' | 'market_intelligence' | 'competitor_intelligence' | 'top_actions' | string | null
  relevant_offer_id?: string | null
  relevant_offer_name?: string | null
  ingestion_source_id?: number | null
  review_notes?: string | null
  sources?: OpportunitySource[]
  reviewed_at?: string | null
}

export interface OpportunityListResponse {
  status: number
  data: Opportunity[]
  meta: { page: number; per_page: number; total: number; last_page: number }
  summary: {
    total: number
    new: number
    high_priority: number
    follow_up: number
    immediate?: number
    watchlist?: number
    market_intelligence?: number
    competitor_intelligence?: number
  }
  filters: { categories: { value: string; label: string }[]; kinds: { value: string; label: string }[]; report_dates: string[] }
}

export type ResearchStage = 'preparing' | 'searching' | 'collecting' | 'analyzing' | 'saving' | 'completed' | 'failed'

export interface ResearchRun {
  id: number
  report_date: string | null
  trigger: 'scheduled' | 'manual'
  status: RunStatus
  stage?: ResearchStage | string | null
  stage_message?: string | null
  started_at: string | null
  completed_at: string | null
  duration_ms: number | null
  queries_run: number
  queries_failed: number
  sources_found: number
  companies_researched: number
  opportunities_qualified: number
  opportunities_new: number
  opportunities_rejected: number
  search_provider: string | null
  ai_provider?: string | null
  ai_model?: string | null
  error_code: string | null
  error_message: string | null
}

export interface ResearchStatusResponse {
  status: number
  data: {
    requirements: {
      profile_complete: boolean
      profile_missing: string[]
      search_configured: boolean
      search_driver: string | null
      ai_configured: boolean
      research_enabled: boolean
    }
    running: boolean
    latest_run: ResearchRun | null
    last_successful_run: ResearchRun | null
    next_scheduled_at: string | null
    timezone: string
  }
}

export interface OpportunityQuery {
  search?: string
  category?: string
  kind?: string
  priority?: string
  qualification?: string
  reviewStatus?: string
  feedSection?: string
  reportDate?: string
  page?: number
}

export interface ProviderCheck {
  ok: boolean
  category: string
  message: string
  provider?: string | null
  model?: string | null
  driver?: string | null
  results?: number
  latency_ms: number
  tested_at: string
  last_success_at: string | null
}

export interface ProvidersResponse {
  status: number
  data: {
    ai: {
      provider: string | null
      provider_label: string | null
      model: string | null
      credential_source: string | null
      key_masked: string | null
      configured: boolean
      last_test: ProviderCheck | null
    }
    search: {
      driver: string
      env_keys: string
      key_masked: string | null
      configured: boolean
      last_test: ProviderCheck | null
    }
    schedule: { enabled: boolean; frequency: string; time: string; timezone: string; next_run_at: string | null }
    runtime: {
      scheduler_last_tick_at: string | null
      scheduler_running: boolean
      queue_connection: string
      queue_name: string
      queue_jobs_waiting_over_2_min: number
      queue_worker_suspected_down: boolean
    }
  }
}

export interface ResearchSourceInfo {
  url: string
  title: string
  domain: string | null
  snippet: string | null
  published_at: string | null
  retrieved_at: string | null
  page_fetched: boolean
  cited: boolean
}

export interface IngestionRun {
  id: number
  status: 'running' | 'success' | 'partial' | 'failed'
  started_at: string | null
  completed_at: string | null
  duration_ms: number | null
  findings_count: number
  findings_rejected: number
  error_code: string | null
  error_message: string | null
}

export type ProcessingStatus = 'uploaded' | 'generating' | 'completed' | 'completed_with_warnings' | 'failed'

export interface IngestionSourceInfo {
  id: number
  type: 'file' | 'url'
  name: string
  url: string | null
  page_title: string | null
  mime: string | null
  size_bytes: number | null
  status: 'ready' | 'failed'
  error_message: string | null
  char_count: number
  truncated: boolean
  extracted_summary?: string | null
  identified_entities?: { name: string; type: string; context: string }[]
  discovered_news?: { title: string; url: string; snippet: string; published_at: string | null; source: string }[]
  retrieved_at: string | null
  created_at: string | null
  last_analyzed_at: string | null
  /** Derived server-side from real state: what the UI shows for this source. */
  processing_status: ProcessingStatus
  processing_label: string
  processing_message: string | null
  can_retry: boolean
  findings_count: number
  latest_analysis: IngestionRun | null
}

export interface IngestionFindingInfo {
  id: number
  analysis_id: number
  kind: string
  title: string
  detail: string
  business_impact: string | null
  suggested_action: string | null
  priority: Level | null
  confidence: Level | null
  evidence: { ref: string; quote: string }[]
  review_status: ReviewStatus
}

/** A generated signal in the cross-source list, with its provenance. */
export interface IngestionSignal extends IngestionFindingInfo {
  source_id: number
  source_name: string
  source_type: 'file' | 'url'
  source_url: string | null
  created_at: string
}

export interface IngestionSignalListResponse {
  status: number
  data: IngestionSignal[]
  meta: { page: number; per_page: number; total: number; last_page: number }
  kind_counts: Record<string, number>
}

export interface IngestResponse {
  status: number
  message: string
  data: IngestionSourceInfo
  analysis_started?: boolean
  analysis_code?: string | null
}

export interface IngestionSourceDetail extends IngestionSourceInfo {
  preview: { ref: string; text: string }[]
  analyses: IngestionRun[]
  findings: IngestionFindingInfo[]
  linked_opportunities?: Opportunity[]
}

function base(context: LaravelContext): Record<string, string> {
  return {
    sub_institute_id: context.subInstituteId,
    ...(context.token ? { type: 'api', token: context.token } : {}),
  }
}

const qs = (context: LaravelContext) => new URLSearchParams(base(context)).toString()

export const opportunitiesService = {
  getProfile: (c: LaravelContext) => apiClient.get<ProfileResponse>('/signals/product-profile', base(c)),

  saveProfile: (c: LaravelContext, profile: Partial<ProductProfile>) =>
    apiClient.put<ProfileResponse>(`/signals/product-profile?${qs(c)}`, profile),

  getStatus: (c: LaravelContext) => apiClient.get<ResearchStatusResponse>('/signals/research/status', base(c)),

  getRuns: (c: LaravelContext) => apiClient.get<{ status: number; data: ResearchRun[] }>('/signals/research/runs', base(c)),

  getProviders: (c: LaravelContext) => apiClient.get<ProvidersResponse>('/signals/providers', base(c)),

  testProvider: (c: LaravelContext, which: 'ai' | 'search') =>
    apiClient.post<{ status: number; data: ProviderCheck }>(`/signals/providers/${which}/test?${qs(c)}`, {}),

  getRun: (c: LaravelContext, runId: number) =>
    apiClient.get<{ status: number; data: ResearchRun }>(`/signals/research/runs/${runId}`, base(c)),

  getRunSources: (c: LaravelContext, runId: number) =>
    apiClient.get<{ status: number; data: ResearchSourceInfo[] }>(`/signals/research/runs/${runId}/sources`, base(c)),

  runResearch: (c: LaravelContext, customParams?: { topic?: string; company?: string; industry?: string; geography?: string; signal_type?: string; recency_days?: number }) =>
    apiClient.post<{ status: number; message: string; data?: { run_id: number; run: ResearchRun } }>(`/signals/research/run?${qs(c)}`, customParams ?? {}),

  list: (c: LaravelContext, q: OpportunityQuery = {}) => {
    const params: Record<string, string> = { ...base(c), page: String(q.page ?? 1), per_page: '10' }
    if (q.search) params.search = q.search
    if (q.category) params.category = q.category
    if (q.kind) params.kind = q.kind
    if (q.priority) params.priority = q.priority
    if (q.qualification) params.qualification = q.qualification
    if (q.reviewStatus) params.review_status = q.reviewStatus
    if (q.feedSection) params.feed_section = q.feedSection
    if (q.reportDate) params.report_date = q.reportDate
    return apiClient.get<OpportunityListResponse>('/signals/opportunities', params)
  },

  get: (c: LaravelContext, id: number) => apiClient.get<{ status: number; data: Opportunity }>(`/signals/opportunities/${id}`, base(c)),

  act: (c: LaravelContext, id: number, action: 'review' | 'dismiss' | 'follow-up', notes?: string) =>
    apiClient.patch<{ status: number; data: Opportunity }>(`/signals/opportunities/${id}/${action}?${qs(c)}`, notes ? { notes } : {}),

  // ── ingestion ──
  listSources: (c: LaravelContext) => apiClient.get<{ status: number; data: IngestionSourceInfo[] }>('/signals/ingestion/sources', base(c)),

  getSource: (c: LaravelContext, id: number) =>
    apiClient.get<{ status: number; data: IngestionSourceDetail }>(`/signals/ingestion/sources/${id}`, base(c)),

  upload: (c: LaravelContext, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient.postForm<IngestResponse>(`/signals/ingestion/upload?${qs(c)}`, form)
  },

  addUrl: (c: LaravelContext, url: string) =>
    apiClient.post<IngestResponse>(`/signals/ingestion/url?${qs(c)}`, { url }),

  listSignals: (c: LaravelContext, q: { sourceId?: number; kind?: string; search?: string; page?: number } = {}) => {
    const params: Record<string, string> = { ...base(c), page: String(q.page ?? 1), per_page: '12' }
    if (q.sourceId) params.source_id = String(q.sourceId)
    if (q.kind) params.kind = q.kind
    if (q.search) params.search = q.search
    return apiClient.get<IngestionSignalListResponse>('/signals/ingestion/findings', params)
  },

  /** Retry: analysis normally starts automatically; this re-runs a failed or never-started one. */
  analyze: (c: LaravelContext, id: number) =>
    apiClient.post<{ status: number; message: string }>(`/signals/ingestion/sources/${id}/analyze?${qs(c)}`, {}),

  deleteSource: (c: LaravelContext, id: number) =>
    apiClient.delete<{ status: number; message: string }>(`/signals/ingestion/sources/${id}`, base(c)),

  actOnFinding: (c: LaravelContext, id: number, action: 'review' | 'dismiss') =>
    apiClient.patch<{ status: number; data: { id: number; review_status: ReviewStatus } }>(`/signals/ingestion/findings/${id}/${action}?${qs(c)}`, {}),
}
