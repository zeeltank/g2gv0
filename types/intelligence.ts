import type { HrDashboardEnvelope } from '@/types/hr-dashboard'

/**
 * GET /api/intelligence/overview - the Intelligence page and the Home panel.
 *
 * Every field is produced by the backend from the organisation's own records; the client computes nothing and
 * invents nothing. `class` says how a finding was derived:
 *   measured   - a direct count
 *   calculated - a deterministic rule over rows (the same rule the owning screen uses)
 * There is deliberately no AI-written class: nothing here is.
 */
export type InsightSeverity = 'high' | 'medium' | 'low' | 'info'
export type InsightClass = 'measured' | 'calculated'

export interface IntelligenceMetric {
  label: string
  value: string
}

/** One supporting row. Its shape depends on the insight (a gap row differs from a certificate row). */
export type EvidenceRecord = Record<string, string | number | boolean | null>

export interface IntelligenceInsight {
  key: string
  area: string
  class: InsightClass
  severity: InsightSeverity
  title: string
  /** What was detected. */
  detected: string
  why_it_matters: string
  evidence: {
    metrics: IntelligenceMetric[]
    records: EvidenceRecord[]
    by_department?: EvidenceRecord[]
    /** How the rows are ordered, stated so nobody has to guess why one outranks another. */
    ranking?: string
  }
  recommended_action: string
  expected_impact: string
  link_key: string | null
  /** Path to the existing screen, or null if this organisation has no such screen. */
  link: string | null
  link_reason: string | null
}

export type ReadinessState = 'ok' | 'attention' | 'not_measurable' | 'unavailable'

export interface ReadinessMeasure {
  key: string
  label: string
  explanation: string
  class: InsightClass
  complete: number | null
  total: number | null
  percent: number | null
  state: ReadinessState
  link_key: string | null
  link: string | null
}

export interface IntelligenceSummary {
  insight_count: number
  high: number
  medium: number
  low: number
  measures_needing_attention: number
  measures_unavailable: number
  sources_unavailable: number
}

export interface IntelligenceOverview {
  generated_at: string
  summary: IntelligenceSummary
  insights: IntelligenceInsight[]
  readiness: ReadinessMeasure[]
  /** Sources that failed. Their absence from `insights` must never be read as "all clear". */
  unavailable_sources: string[]
  limits: string[]
}

export type IntelligenceEnvelope = HrDashboardEnvelope<IntelligenceOverview>
