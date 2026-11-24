import { apiClient } from '@/services/core'
import type { DetectorsData, InsightsData, InsightsParams, IntelligenceApi, IntelligenceEnvelope, OverviewData } from './types'

/** Query values as strings; a missing value is left out entirely so the server applies no filter. */
export function insightsQuery(params: InsightsParams = {}): Record<string, string> | undefined {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    query[key] = String(value)
  }
  return Object.keys(query).length > 0 ? query : undefined
}

/**
 * The Intelligence API (hp_erp `/api/intelligence`). Read-only: nothing here writes. The organisation, the user and the role come from the bearer token the
 * shared client sends, never from a parameter. A refusal arrives as an ApiError (401 session, 403 not available for this account, 429, 503 switched off);
 * see classifyIntelligenceError for what each means on screen.
 */
export const intelligenceService: IntelligenceApi = {
  overview(): Promise<IntelligenceEnvelope<OverviewData>> {
    return apiClient.get('/intelligence/overview')
  },
  insights(params?: InsightsParams): Promise<IntelligenceEnvelope<InsightsData>> {
    return apiClient.get('/intelligence/insights', insightsQuery(params))
  },
  detectors(): Promise<IntelligenceEnvelope<DetectorsData>> {
    return apiClient.get('/intelligence/detectors')
  },
}
