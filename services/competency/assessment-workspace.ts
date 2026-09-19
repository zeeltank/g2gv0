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
  /** The framework the campaign assesses against; null for ad-hoc campaigns. */
  framework_id?: number | null
  framework_name?: string | null
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

/* ------------------------------------------------------------------ *
 * Campaign detail — Overview / Ratings / Calibration / Audit Trail
 *
 * routes/api.php carries a comment reading "Campaign detail panel:
 * Overview / Edit / Ratings / Calibration / Audit Trail" above these four
 * endpoints. They were built for this screen and never called from it: the
 * four tabs rendered one shared "This section is coming soon" card instead.
 *
 * Every field below is copied from AssessmentCycleController, not guessed.
 * ------------------------------------------------------------------ */

export interface CampaignProgress {
  total: number
  completed: number
  in_progress: number
  not_started: number
  overdue: number
  reviewed: number
  pending_calibration: number
  completion_pct: number
  review_pct: number
}

export interface CampaignScores {
  rated: number
  average: number | null
  min: number | null
  max: number | null
  /** Percentage bands, not the 1-6 proficiency scale — the column holds 0-100. */
  buckets: { range: string; count: number }[]
}

export interface CampaignDetail {
  id: string
  name: string
  type: string | null
  /** False when the campaign has no type recorded, so the UI can say so
   *  instead of inventing one — the controller is explicit about this. */
  type_is_set: boolean
  description: string | null
  status: string
  start_date: string | null
  end_date: string | null
  start_label: string | null
  end_label: string | null
  days_left: number | null
  progress: CampaignProgress
  scores: CampaignScores
  departments: { department: string; total: number; completed: number }[]
}

export interface CampaignRating {
  assessment_id: string
  user_id: string
  name: string
  initials: string
  emp_id: string
  role: string
  framework: string | null
  score: number | null
  score_pct: number | null
  target_pct: number
  meets_target: boolean | null
  status: string
  review_status: string | null
}

export interface CalibrationCandidate {
  assessment_id: string
  user_id: string
  name: string
  initials: string
  emp_id: string
  role: string
  department: string | null
  score: number | null
  completed_on: string | null
}

export interface CampaignAuditEntry {
  id: number
  action: string
  description: string | null
  record: string | null
  by: string
  at: string | null
  date: string | null
  changes: { field?: string; label?: string; old?: unknown; new?: unknown }[]
}

export interface CampaignAuditTrail {
  entries: CampaignAuditEntry[]
  /** Campaign created / last updated — dates the activity log does not carry. */
  stamps: { label: string; date: string }[]
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

  createCampaign: (context: LaravelContext, payload: { name: string; type?: string; framework_id?: number; start_date?: string; end_date?: string }) =>
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

  /* -- campaign detail: one call per tab -------------------------------- *
   *
   * Scoped to a single campaign, unlike getParticipantRatings and
   * getCalibration above which are the ORGANISATION-WIDE queues. The two look
   * alike and are not: opening a campaign and seeing every employee in the
   * company is what the tab-level endpoints exist to avoid.
   */

  getCampaign: (context: LaravelContext, cycleId: string) =>
    apiClient.get<CompetencyApiResponse<CampaignDetail>>(
      `/competency/assessment-cycles/${cycleId}`,
      withLaravelParams(context)
    ),

  getCampaignRatings: (context: LaravelContext, cycleId: string) =>
    apiClient.get<CompetencyApiResponse<CampaignRating[]>>(
      `/competency/assessment-cycles/${cycleId}/ratings`,
      withLaravelParams(context)
    ),

  getCampaignCalibrationQueue: (context: LaravelContext, cycleId: string) =>
    apiClient.get<CompetencyApiResponse<CalibrationCandidate[]>>(
      `/competency/assessment-cycles/${cycleId}/calibration-queue`,
      withLaravelParams(context)
    ),

  getCampaignAuditTrail: (context: LaravelContext, cycleId: string) =>
    apiClient.get<CompetencyApiResponse<CampaignAuditTrail>>(
      `/competency/assessment-cycles/${cycleId}/audit-trail`,
      withLaravelParams(context)
    ),
}
