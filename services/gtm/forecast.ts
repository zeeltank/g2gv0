/**
 * GTM forecast endpoints (Laravel /api/gtm/forecast*).
 * Reads: Administrator + Executive. Settings writes: Administrator only.
 * Money in responses is in major units (the server divides its integer minor-unit sums by 100) and
 * is always keyed or grouped by currency - never summed across currencies.
 */

import { apiClient } from '@/services/core'

type Env<T> = { status: number; data: T; message?: string }

export const FORECAST_OPEN_STAGES = ['discovery', 'qualification', 'proposal', 'negotiation'] as const
export type ForecastStage = (typeof FORECAST_OPEN_STAGES)[number]
export const FORECAST_CATEGORIES = ['pipeline', 'best_case', 'commit', 'omitted'] as const
export type ForecastCategory = (typeof FORECAST_CATEGORIES)[number]

export interface StageSetting {
  probability: number | null
  category: ForecastCategory
  configured: boolean
}

export interface ForecastRow {
  period?: string
  currency: string
  deal_count: number
  pipeline: number
  best_case: number
  commit: number
  /** null = no stage probabilities configured. */
  weighted: number | null
}

export interface ForecastData {
  basis: string
  filters: { from: string; to: string; owner_user_id?: number; stage?: string; department_id?: number; currency?: string }
  probabilities_configured: boolean
  settings: Record<string, StageSetting>
  forecast: {
    periods: (ForecastRow & { period: string })[]
    totals_by_currency: ForecastRow[]
    excluded: { no_close_date: number; no_amount: number; omitted: number; outside_window: number; no_probability: number }
    overdue: { count: number; value_by_currency: Record<string, number> }
    weighted_available: boolean
    categories_in_use: boolean
  }
  actuals: {
    won: { count: number; value_by_currency: Record<string, number> }
    lost: { count: number; value_by_currency: Record<string, number> }
  }
  accuracy: {
    available: boolean
    reason: string | null
    periods: {
      period: string
      currency: string
      snapshot_date: string
      forecast_commit: number
      forecast_weighted: number | null
      actual_won: number
      commit_attainment_pct: number | null
    }[]
  }
}

export interface ForecastSettingsData {
  stages: Record<string, StageSetting>
  configured: boolean
  categories: ForecastCategory[]
  suggestions: Record<string, { available: boolean; win_rate: number | null; sample: number; minimum: number }>
  note: string
}

export interface ForecastQuery {
  from?: string
  to?: string
  stage?: string
  currency?: string
}

export type ForecastSettingsInput = Record<string, { probability: number | null; category: ForecastCategory }>

export const forecastService = {
  get: (q: ForecastQuery = {}) => {
    const params: Record<string, string> = {}
    for (const [k, v] of Object.entries(q)) if (v) params[k] = v
    return apiClient.get<Env<ForecastData>>('/gtm/forecast', params)
  },
  settings: () => apiClient.get<Env<ForecastSettingsData>>('/gtm/forecast/settings'),
  saveSettings: (stages: ForecastSettingsInput) =>
    apiClient.put<Env<ForecastSettingsData>>('/gtm/forecast/settings', { stages }),
}
