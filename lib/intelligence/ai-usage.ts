'use client'

/**
 * Client for Usage & Cost — `/api/ai/usage`.
 *
 * Metering itself has no endpoint: it happens inside `AiModelClient` on the server,
 * which is the only place this layer calls a model, so nothing can spend without
 * being counted. These are the reads over what it recorded, plus the one write that
 * sets a quota.
 */

import { aiRequest } from './client'

export interface UsageTotals {
  calls: number
  input_tokens: number
  output_tokens: number
  total_tokens: number
  failed: number
  /** Calls a quota refused before they reached a provider. They cost nothing. */
  refused: number
  avg_latency_ms: number | null
  estimated_cost_usd: number | null
  /**
   * How many calls the cost figure actually covers.
   *
   * A rate is applied when a call is recorded, so calls made before anybody filled
   * in a rate have no cost — forever, and correctly. `cost_complete` is false when
   * the total therefore describes only some of the calls.
   */
  calls_priced: number
  cost_known: boolean
  cost_complete: boolean
}

export interface UsageByModule {
  ai_module: string
  module_label: string
  calls: number
  tokens: number
  estimated_cost_usd: number | null
}

export interface UsageByModel {
  provider: string
  model: string | null
  calls: number
  tokens: number
  estimated_cost_usd: number | null
}

export interface UsageByDay {
  day: string
  calls: number
  tokens: number
  estimated_cost_usd: number | null
}

export interface UsageQuota {
  id: number
  /** Null means the quota covers the whole organisation. */
  ai_module: string | null
  module_label: string
  period: 'day' | 'month' | string
  token_limit: number
  tokens_used: number
  percent_used: number
  warn_at_percent: number
  /** Approaching the limit. */
  warning: boolean
  /** Already refusing calls. */
  exceeded: boolean
  status: number
}

export interface UsageSummary {
  sub_institute_id: string | number
  window: string
  since: string
  totals: UsageTotals
  by_module: UsageByModule[]
  by_model: UsageByModel[]
  by_day: UsageByDay[]
  quotas: UsageQuota[]
  /**
   * Counts from ledgers this layer does not write, named rather than merged —
   * merging two meters with different provenance makes neither checkable.
   */
  other_ledgers: Record<string, number | null>
}

export interface UsageEvent {
  id: number
  ai_module: string
  module_label: string
  provider: string
  model: string | null
  /** Which precedence step resolved the credential: `module`, `pool`, `env`… */
  source: string | null
  input_tokens: number
  output_tokens: number
  latency_ms: number | null
  estimated_cost_usd: number | null
  outcome: 'success' | 'failed' | 'refused' | string
  finish_reason: string | null
  error: string | null
  related_type: string | null
  related_id: number | null
  created_at: string | null
}

export interface UsageOptions {
  modules: Array<{ key: string; label: string; wired: boolean }>
  periods: string[]
  windows: string[]
}

export function fetchUsageOptions(): Promise<UsageOptions> {
  return aiRequest<UsageOptions>('/usage/options')
}

export function fetchUsageSummary(window?: string): Promise<UsageSummary> {
  const query = window ? `?window=${encodeURIComponent(window)}` : ''

  return aiRequest<UsageSummary>(`/usage${query}`)
}

export function fetchUsageEvents(): Promise<{
  sub_institute_id: string | number
  events: UsageEvent[]
}> {
  return aiRequest('/usage/events')
}

/** A `token_limit` of 0 removes the quota rather than setting a ceiling of nothing. */
export function saveUsageQuota(payload: {
  ai_module?: string | null
  period: 'day' | 'month'
  token_limit: number
  warn_at_percent?: number
}): Promise<{ quotas: UsageQuota[] }> {
  return aiRequest('/usage/quota', 'POST', payload)
}
