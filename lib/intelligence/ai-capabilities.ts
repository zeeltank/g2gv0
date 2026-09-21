'use client'

/**
 * Client for the AI & Intelligence console — `/api/ai/capabilities`.
 *
 * Read-only by design. This is the half of the console that reports what an
 * organisation actually has; the screens that change any of it call
 * `ai-configuration`, `ai-templates` or `ai-policies` instead, and keeping the
 * read and the write in separate files keeps the surface that can write small
 * enough to audit.
 */

import { aiRequest } from './client'

export type CapabilityState = 'live' | 'empty' | 'unavailable'

export interface CapabilityMetric {
  key: string
  label: string
  value: number
}

export interface CapabilityTable {
  columns: Array<{ key: string; label: string }>
  rows: Array<Record<string, string | null>>
}

export interface CapabilitySummary {
  key: string
  state: CapabilityState
  count: number
  primary_table?: string
  missing_tables?: string[]
}

export interface CapabilityDetail {
  key: string
  sub_institute_id: string | number
  state: CapabilityState
  metrics: CapabilityMetric[]
  table: CapabilityTable | null
  missing_tables?: string[]
}

export interface CapabilityIndex {
  sub_institute_id: string | number
  capabilities: CapabilitySummary[]
}

export function fetchCapabilities(): Promise<CapabilityIndex> {
  return aiRequest<CapabilityIndex>('/capabilities')
}

export function fetchCapability(slug: string): Promise<CapabilityDetail> {
  return aiRequest<CapabilityDetail>(`/capabilities/${encodeURIComponent(slug)}`)
}
