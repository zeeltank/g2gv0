/**
 * Competency Command Center service.
 *
 * Backed by the Laravel /api/competency/* endpoints added alongside the
 * existing read-only competency analytics:
 *   GET  /competency/command-center          - full dashboard payload
 *   GET  /competency/command-center/filters  - the five filter dropdowns
 *   POST /competency/{competencies|frameworks|assessments|certifications|development-plans}
 *
 * Every call carries the standard Laravel context (token, sub_institute_id,
 * user_id, syear) via withLaravelParams, exactly like services/hrms/leave.ts.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

/** Every /api/competency/* endpoint replies with this envelope. */
export interface CompetencyApiResponse<T> {
  status: number
  message: string
  data: T
}

/* ------------------------------------------------------------------ *
 * Dashboard payload
 * ------------------------------------------------------------------ */

export interface CommandCenterSummaryTile {
  key: string
  label: string
  value: number
  desc: string
  total?: number
}

export interface CommandCenterProgressRing {
  key: string
  title: string
  percent: number
  current: number
  total: number
  sub: string
}

export interface CommandCenterWorkQueue {
  key: string
  label: string
  count: number
}

export interface CommandCenterActivity {
  id: number
  user: string
  action: string
  time: string
  timestamp: string | null
}

export interface CommandCenterCycle {
  id: number
  name: string
  status: string
  start_date: string | null
  end_date: string | null
  range_label: string | null
}

export interface CommandCenterCalendar {
  cycle: CommandCenterCycle | null
  upcoming_count: number
}

export interface CommandCenterData {
  summary: CommandCenterSummaryTile[]
  progress: CommandCenterProgressRing[]
  work_queues: CommandCenterWorkQueue[]
  recent_activity: CommandCenterActivity[]
  assessment_calendar: CommandCenterCalendar
}

/* ------------------------------------------------------------------ *
 * Filters
 * ------------------------------------------------------------------ */

export interface CompetencyFilterOption {
  value: string
  label: string
}

export interface CompetencyFilterOptions {
  departments: CompetencyFilterOption[]
  jobroles: CompetencyFilterOption[]
  locations: CompetencyFilterOption[]
  business_units: CompetencyFilterOption[]
  job_families: CompetencyFilterOption[]
}

export interface CompetencyFilters {
  department_id?: string
  jobrole?: string
  location?: string
  business_unit?: string
  job_family?: string
}

/* ------------------------------------------------------------------ *
 * Create payloads (quick actions)
 * ------------------------------------------------------------------ */

export type QuickCreateKind =
  | 'competency'
  | 'framework'
  | 'assessment'
  | 'certification'
  | 'development-plan'

export interface CreateResult {
  id: number
}

/** Drops 'all' / '0' / empty so Laravel's filled() checks skip the param. */
function competencyFilter(value?: string | null) {
  if (value === undefined || value === null) return undefined
  const normalized = String(value).trim()
  return normalized === '' || normalized === '0' || normalized === 'all' ? undefined : normalized
}

function optionalParam(key: string, value?: string | null) {
  const normalized = competencyFilter(value)
  return normalized ? { [key]: normalized } : {}
}

function filterParams(filters?: CompetencyFilters) {
  if (!filters) return {}
  return {
    ...optionalParam('department_id', filters.department_id),
    ...optionalParam('jobrole', filters.jobrole),
    ...optionalParam('location', filters.location),
    ...optionalParam('business_unit', filters.business_unit),
    ...optionalParam('job_family', filters.job_family),
  }
}

const CREATE_ENDPOINTS: Record<QuickCreateKind, string> = {
  competency: '/competency/competencies',
  framework: '/competency/frameworks',
  assessment: '/competency/assessments',
  certification: '/competency/certifications',
  'development-plan': '/competency/development-plans',
}

export const competencyCommandCenterService = {
  getCommandCenter: (context: LaravelContext, filters?: CompetencyFilters) =>
    apiClient.get<CompetencyApiResponse<CommandCenterData>>(
      '/competency/command-center',
      withLaravelParams(context, filterParams(filters)),
    ),

  getFilters: (context: LaravelContext) =>
    apiClient.get<CompetencyApiResponse<CompetencyFilterOptions>>(
      '/competency/command-center/filters',
      withLaravelParams(context),
    ),

  create: (context: LaravelContext, kind: QuickCreateKind, payload: Record<string, unknown>) =>
    apiClient.post<CompetencyApiResponse<CreateResult>>(CREATE_ENDPOINTS[kind], {
      ...withLaravelParams(context),
      ...payload,
    }),
}
