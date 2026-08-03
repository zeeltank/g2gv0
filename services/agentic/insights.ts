/**
 * Agentic AI — analytics and the reflection system.
 *
 *   GET  /agentic/analytics/dashboard              KPI tiles, sparkline series, recent runs
 *   GET  /agentic/analytics/overview               daily series, per-agent, tool usage
 *   GET  /agentic/reflection                       insights + failure patterns + optimizations
 *   POST /agentic/reflection/analyse               run a fresh analysis
 *   PUT  /agentic/reflection/optimizations/{id}    apply / dismiss / reopen
 *
 * Every figure is computed from recorded runs. The three screens these back
 * previously rendered a fixture file, so their charts moved whether or not any
 * agent had run.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

import { toStringParams, type AgenticApiResponse } from './agents'

/** One day of the run series. Days with no runs are present with zeroes. */
export interface DailyPoint {
  date: string
  total_runs: number
  successes: number
  failures: number
  success_rate: number
  tokens: number
  cost: number
  avg_duration_ms: number
}

export interface DashboardData {
  window_days: number
  agents: {
    total: number
    deployed: number
    draft: number
    paused: number
    archived: number
  }
  runs: {
    total: number
    successes: number
    failures: number
    active: number
    /** null when nothing has run — not 0%, which would read as total failure. */
    success_rate: number | null
    total_tokens: number
    total_cost: number
    avg_duration_ms: number
  }
  today: {
    runs: number
    cost: number
    /** null when there is no prior day to compare against. */
    cost_change_pct: number | null
  }
  series: DailyPoint[]
  recent_runs: {
    id: number
    agent_name: string
    status: string
    duration_ms: number | null
    tokens_used: number | null
    created_at: string | null
  }[]
}

export interface AgentPerformanceRow {
  agent_id: number
  agent_name: string
  total_runs: number
  successes: number
  failures: number
  success_rate: number | null
  tokens: number
  cost: number
  avg_duration_ms: number
}

export interface AnalyticsOverview {
  window_days: number
  series: DailyPoint[]
  per_agent: AgentPerformanceRow[]
  status_breakdown: { status: string; total: number }[]
  tool_usage: { tool: string; total: number }[]
}

/* ------------------------------------------------------------------ *
 * Reflection
 * ------------------------------------------------------------------ */

export interface ReflectionInsight {
  metric: string
  value: string
  trend: 'up' | 'down' | 'stable'
  insight: string
}

/** Derived from run errors at read time, so it never goes stale. */
export interface FailurePattern {
  key: string
  pattern: string
  impact: 'high' | 'medium' | 'low'
  recommendation: string
  frequency: number
  affected_agents: string[]
  examples: string[]
}

export type OptimizationStatus = 'open' | 'applied' | 'dismissed'

export interface Optimization {
  id: number
  title: string
  description: string | null
  category: 'performance' | 'cost' | 'reliability' | 'accuracy'
  priority: 'high' | 'medium' | 'low'
  estimated_impact: string | null
  implementation_complexity: string
  affected_agents: string[]
  status: OptimizationStatus
  applied_at: string | null
  created_at: string | null
}

export interface ReflectionData {
  window_days: number
  insights: ReflectionInsight[]
  failure_patterns: FailurePattern[]
  optimizations: Optimization[]
  last_analysis: {
    id: number
    runs_analysed: number
    failures_found: number
    patterns_found: number
    optimizations_created: number
    created_at: string | null
  } | null
}

export interface AnalyseResult {
  id: number
  runs_analysed: number
  failures_found: number
  patterns_found: number
  optimizations_created: number
}

export const analyticsService = {
  dashboard: (context: LaravelContext, days?: number) =>
    apiClient.get<AgenticApiResponse<DashboardData>>(
      '/agentic/analytics/dashboard',
      withLaravelParams(context, toStringParams({ days })),
    ),

  overview: (context: LaravelContext, params?: { days?: number; agent_id?: number }) =>
    apiClient.get<AgenticApiResponse<AnalyticsOverview>>(
      '/agentic/analytics/overview',
      withLaravelParams(context, toStringParams({ ...params })),
    ),
}

export const reflectionService = {
  get: (context: LaravelContext, params?: { days?: number; status?: string }) =>
    apiClient.get<AgenticApiResponse<ReflectionData>>(
      '/agentic/reflection',
      withLaravelParams(context, toStringParams({ ...params })),
    ),

  /** The "Run New Analysis" button: turns detected patterns into suggestions. */
  analyse: (context: LaravelContext, days?: number) =>
    apiClient.post<AgenticApiResponse<AnalyseResult>>('/agentic/reflection/analyse', {
      ...withLaravelParams(context),
      ...(days ? { days } : {}),
    }),

  setOptimizationStatus: (context: LaravelContext, id: number, status: OptimizationStatus) =>
    apiClient.put<AgenticApiResponse<{ id: number; status: OptimizationStatus }>>(
      `/agentic/reflection/optimizations/${id}`,
      { ...withLaravelParams(context), status },
    ),
}
