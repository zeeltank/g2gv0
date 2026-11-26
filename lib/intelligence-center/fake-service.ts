import type { DetectorsData, Insight, InsightsData, InsightsParams, IntelligenceApi } from '../../services/intelligence/types'
import { detector, insightsData, META, overviewData } from './fixtures'

export interface FakeCalls {
  overview: number
  insights: InsightsParams[]
  detectors: number
}

/**
 * A stand-in for the Intelligence API for component tests. Every call is recorded exactly as the screen made it, and `overrides` replace what a method
 * answers (or throws). Nothing here touches the network.
 */
export function fakeIntelligenceService(overrides: Partial<IntelligenceApi> = {}) {
  const calls: FakeCalls = { overview: 0, insights: [], detectors: 0 }
  const service: IntelligenceApi = {
    overview: async () => {
      calls.overview += 1
      return overrides.overview ? overrides.overview() : { status: 1, data: overviewData() }
    },
    insights: async (params) => {
      calls.insights.push(params ?? {})
      return overrides.insights ? overrides.insights(params) : { status: 1, data: insightsData() }
    },
    detectors: async () => {
      calls.detectors += 1
      const data: DetectorsData = { detectors: [detector()], meta: META }
      return overrides.detectors ? overrides.detectors() : { status: 1, data }
    },
  }
  return { service, calls }
}

/** An `insights` implementation that pages `all` the way the API does (page, per_page, total_pages), for the pagination tests. */
export function pagedInsights(all: readonly Insight[], meta = META): NonNullable<IntelligenceApi['insights']> {
  return async (params) => {
    const perPage = params?.per_page ?? 50
    const page = params?.page ?? 1
    const totalPages = Math.max(1, Math.ceil(all.length / perPage))
    const data: InsightsData = {
      insights: all.slice((page - 1) * perPage, page * perPage),
      pagination: { page, per_page: perPage, total: all.length, total_pages: totalPages },
      meta,
    }
    return { status: 1, data }
  }
}

export type { InsightsData }
