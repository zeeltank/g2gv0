/**
 * The Intelligence API contract (hp_erp `/api/intelligence`), as the frontend reads it.
 *
 * The organisation, the person and the role are NEVER sent: they come from the bearer token the shared client attaches, and the server decides what this
 * person may see. Every field below is what the server answers; nothing is computed here that the server did not say.
 */

export type InsightSeverity = 'info' | 'attention' | 'high' | 'critical'
export type InsightConfidence = 'measured' | 'rule_based' | 'ai_estimate'
export type InsightAudience = 'self' | 'team' | 'department' | 'organization'
export type InsightDomain = 'hr' | 'commercial' | 'platform' | 'cross'
/** The server's vocabulary. A value outside it is never trusted: see normalizeState in lib/intelligence-center/model.ts. */
export type DetectorState = 'ok' | 'insufficient_data' | 'not_applicable' | 'data_unavailable' | 'access_restricted' | 'error'

export type InsightSurface =
  | 'hr_dashboard'
  | 'me_dashboard'
  | 'attendance'
  | 'leave'
  | 'certifications'
  | 'recruitment'
  | 'onboarding'
  | 'signals'
  | 'signal_review'
  | 'gtm_command_center'
  | 'gtm_deals'
  | 'gtm_forecast'
  | 'gtm_customers'
  | 'crm_opportunities'
  | 'crm_invoices'
  | 'organisation'
  | 'tasks'
  | 'learning'
  | 'capability'
  | 'platform_scheduler'
  | 'platform_integrations'
  | 'platform_event_bus'
  | 'ai_usage_cost'
  | 'ai_policies'
  | 'agentic_run_log'

export interface InsightCoverage {
  /** null when the server withholds the count to protect a small group. */
  observed: number | null
  /** null when the server cannot know how many there should be. */
  expected: number | null
  percent: number | null
  /** One plain sentence: what the figure counts. */
  basis: string
  sufficient: boolean
  /** Why the data is not enough, in words; null when it is enough. */
  reason: string | null
}

export type InsightEvidence =
  | { kind: 'metric'; label: string; value: number | string | null; unit?: string; source?: string }
  | { kind: 'window'; label: string; from: string; to: string }
  | { kind: 'entity'; label: string; entity_type: string; entity_id: number }

export interface Insight {
  key: string
  detector: string
  domain: InsightDomain
  category: string
  severity: InsightSeverity
  title: string
  what_happened: string
  why_it_matters: string
  evidence: InsightEvidence[]
  coverage: InsightCoverage
  /** ISO-8601 UTC. */
  as_of: string
  suggested_action: string | null
  /** An in-app path. Always pass it through safeDeepLink() before rendering a link. */
  deep_link: string | null
  confidence: InsightConfidence
  audience: InsightAudience
  surfaces: string[]
  status: 'open'
  provisional: boolean
}

export interface InsightsMeta {
  generated_at?: string
  scope?: string
  provisional?: boolean
  thresholds_note?: string
  /** How many insights were withheld by the small-group rule. The server never says which. */
  suppressed_count?: number | null
  /** A fixed generic sentence the server sends instead of `suppressed_count` to viewers the small-group rule applies to. */
  suppression_note?: string | null
  detectors_run?: number
  /** The state of each detector behind the answer: either a list of states or a map detector id -> state. Absent on older servers. */
  states?: DetectorState[] | Record<string, DetectorState | number>
}

export interface OverviewSummary {
  total: number
  by_severity: Record<InsightSeverity, number>
  by_domain: Partial<Record<InsightDomain, number>>
}

export interface OverviewData {
  summary: OverviewSummary
  top: Insight[]
  meta: InsightsMeta
}

export interface InsightsPagination {
  page: number
  per_page: number
  total: number
  total_pages: number
}

export interface InsightsData {
  insights: Insight[]
  pagination?: InsightsPagination
  meta: InsightsMeta
}

export interface DetectorSummary {
  detector: string
  domain: InsightDomain
  title: string
  state: DetectorState
  insight_count: number
  coverage: InsightCoverage | null
  as_of: string
  reason: string | null
}

export interface DetectorsData {
  detectors: DetectorSummary[]
  meta: InsightsMeta
}

export interface IntelligenceEnvelope<T> {
  status: number
  data: T
}

export interface InsightsParams {
  domain?: InsightDomain
  /** The lowest severity to include. */
  severity?: InsightSeverity
  category?: string
  surface?: InsightSurface
  detector?: string
  page?: number
  per_page?: number
}

/** The service, as an interface so a screen takes it as a prop and a test replaces it with a fake. */
export interface IntelligenceApi {
  overview(): Promise<IntelligenceEnvelope<OverviewData>>
  insights(params?: InsightsParams): Promise<IntelligenceEnvelope<InsightsData>>
  detectors(): Promise<IntelligenceEnvelope<DetectorsData>>
}
