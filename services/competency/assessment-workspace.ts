import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'
import type { CompetencyApiResponse } from './command-center'

export interface AssessmentCycleMetrics {
  active_campaigns: number
  overall_completion_percent: number
  completed_assessments: number
  total_assessments: number
  pending_manager_ratings: number
  pending_calibration: number
}

export interface AssessmentCycle {
  id: string
  name: string
  type: string
  participants: number
  completion: number
  status: string
  date: string
  start_date?: string | null
}

/** A participant assessment row for the workspace top tabs. */
export interface AssessmentRow {
  assessment_id: string
  name: string
  initials: string
  emp_id: string
  role: string
  campaign: string
  self: boolean
  manager: boolean
  score: number | null
  status: string
  review_status: string | null
  date: string | null
}

export interface AssessmentParticipant {
  id: string
  assessment_id: string
  name: string
  initials: string
  emp_id: string
  role: string
  self: boolean
  manager: boolean
  status: string
  self_date: string | null
  manager_date: string | null
}

export const assessmentWorkspaceService = {
  getMetrics: (context: LaravelContext) =>
    apiClient.get<CompetencyApiResponse<AssessmentCycleMetrics>>(
      '/competency/assessment-cycles/metrics',
      withLaravelParams(context)
    ),

  getCampaigns: (context: LaravelContext) =>
    apiClient.get<CompetencyApiResponse<AssessmentCycle[]>>(
      '/competency/assessment-cycles',
      withLaravelParams(context)
    ),

  getParticipants: (context: LaravelContext, cycleId: string) =>
    apiClient.get<CompetencyApiResponse<AssessmentParticipant[]>>(
      `/competency/assessment-cycles/${cycleId}/participants`,
      withLaravelParams(context)
    ),

  createCampaign: (context: LaravelContext, payload: { name: string; type?: string; start_date?: string; end_date?: string }) =>
    apiClient.post<CompetencyApiResponse<{ id: number }>>(
      '/competency/assessment-cycles',
      {
        ...withLaravelParams(context),
        ...payload,
      }
    ),

  getParticipantRatings: (context: LaravelContext) =>
    apiClient.get<CompetencyApiResponse<AssessmentRow[]>>(
      '/competency/assessment-cycles/participant-ratings',
      withLaravelParams(context)
    ),

  getCalibration: (context: LaravelContext) =>
    apiClient.get<CompetencyApiResponse<AssessmentRow[]>>(
      '/competency/assessment-cycles/calibration',
      withLaravelParams(context)
    ),

  getApprovals: (context: LaravelContext) =>
    apiClient.get<CompetencyApiResponse<AssessmentRow[]>>(
      '/competency/assessment-cycles/approvals',
      withLaravelParams(context)
    ),

  getClosedCampaigns: (context: LaravelContext) =>
    apiClient.get<CompetencyApiResponse<AssessmentCycle[]>>(
      '/competency/assessment-cycles/closed',
      withLaravelParams(context)
    ),

  reviewAssessment: (context: LaravelContext, id: string, action: 'approve' | 'calibrate' | 'reject') =>
    apiClient.put<CompetencyApiResponse<null>>(
      `/competency/assessment-cycles/assessments/${id}/review`,
      { ...withLaravelParams(context), action }
    ),
}
