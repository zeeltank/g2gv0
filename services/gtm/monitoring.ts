/**
 * GTM monitoring (Laravel /api/gtm/monitoring). Readable by Administrators and Executives.
 * The probes are live checks (the AI one costs a real call), Administrator-only, and only ever
 * sent when a person asks for them.
 */

import { apiClient } from '@/services/core'

type Env<T> = { status: number; data: T; message?: string }

export type CheckStatus = 'ok' | 'warn' | 'fail' | 'unknown'
export type Probe = 'ai' | 'smtp'

export interface MonitoringCheck {
  key: string
  label: string
  status: CheckStatus
  summary: string
  facts: Record<string, unknown>
  fix: string | null
}

export interface MonitoringFailure { source: string; what: string; message: string; at: string }
export interface MonitoringEvent { id: number; type: string; record: string | null; actor_id: number | null; at: string }
export interface MonitoringDependency { name: string; ready: boolean; where: string }

export interface MonitoringReport {
  generated_at: string
  overall: CheckStatus
  checks: MonitoringCheck[]
  counts: Partial<Record<CheckStatus, number>>
  recent_failures: MonitoringFailure[]
  /** null for non-administrators. */
  recent_events: MonitoringEvent[] | null
  dependencies: MonitoringDependency[]
}

export const monitoringService = {
  get: (probe?: Probe) => apiClient.get<Env<MonitoringReport>>('/gtm/monitoring', probe ? { probe } : undefined),
}
