/**
 * What the backend's twelve-stage lifecycle returns beside the answer - the trace, the evidence
 * it read, what it suggests next, and any action or report it produced.
 *
 * Types only. The shapes mirror `App\Domain\AI\Lifecycle\LifecycleAskService`.
 */

import type { ChatReport, ReportSuggestion, TemplateSuggestion } from './ai-chat-artifacts'

export type StageStatus = 'ran' | 'skipped' | 'blocked' | 'failed' | 'pending' | 'not_reached'

export interface LifecycleStageRow {
  key: string
  label: string
  status: StageStatus
  summary: string
  duration_ms: number
}

export interface EvidenceItem {
  id: string
  label: string
  source: string
  module: string
  total: number
  truncated: boolean
  personal: boolean
  columns: string[]
  as_of: string
}

export interface Recommendation {
  kind: 'follow_up' | 'report' | 'action'
  title: string
  prompt: string
}

export interface ProposedAction {
  key: string
  label: string
  description: string
  requires_approval: boolean
}

/** Everything a rendered assistant message needs beyond its text. */
export interface LifecyclePayload {
  conversationId: number
  intent: string
  trace: LifecycleStageRow[]
  evidence: EvidenceItem[]
  recommendations: Recommendation[]
  report: ChatReport | null
  reportSuggestions: ReportSuggestion[]
  templateSuggestions: TemplateSuggestion[]
}
