/**
 * Hiring team + resume screening.
 *
 * Two small surfaces that share a service because they share a story: who does
 * the hiring, and what they concluded about a CV.
 *
 *   GET|POST       /talent/hiring-team          admin, hr, recruiter read; admin/hr write
 *   PUT|DELETE     /talent/hiring-team/{id}
 *   GET|POST       /talent/resume-screenings    admin, hr, recruiter
 *   PUT|DELETE     /talent/resume-screenings/{id}
 *
 * Both tables held zero rows and had no code path at all until this change -
 * audit F-59 had them down for deletion. They are kept, tenant-scoped, and now
 * mean something.
 *
 * `resume_screenings` is NOT `talent-screening-results`. That one is the AI
 * verdict on a CANDIDATE (competency match, cultural fit, DeepSeek analysis);
 * this one is a person's review of one APPLICATION - their score, the keywords
 * they found, their comments, and their name against a date. The Screening tab
 * shows both, which is the point.
 */
import { apiClient } from '@/services/core'
import { getLaravelContext, withLaravelParams } from '@/lib/laravel-context'

function contextParams(extra?: Record<string, string>) {
  const context = getLaravelContext()
  if (!context.token || !context.subInstituteId) {
    throw new Error('Your Laravel session is unavailable. Please sign in again.')
  }
  return withLaravelParams(context, extra)
}

/* ------------------------------------------------------------------ *
 * Vocabulary — mirrors HiringTeamController::ROLES exactly
 * ------------------------------------------------------------------ */

export const HIRING_TEAM_ROLES = ['HR Manager', 'Recruiter', 'Interviewer'] as const
export type HiringTeamRole = (typeof HIRING_TEAM_ROLES)[number]

export interface HiringTeamMember {
  id: number
  user_id: number
  name: string
  initials: string
  employee_no: string | null
  email: string | null
  department_id: number | null
  department: string | null
  role: HiringTeamRole
  active: boolean
  added_on: string | null
}

export interface HiringTeamSummary {
  total: number
  active: number
  by_role: Record<HiringTeamRole, number>
}

/** An employee who can be added — the endpoint excludes anyone already on the team. */
export interface AssignableEmployee {
  id: number
  name: string
  employee_no: string | null
  department_id: number | null
  department: string | null
}

export interface HiringTeamDepartment {
  id: number
  name: string
}

export interface HiringTeamResponse {
  members: HiringTeamMember[]
  summary: HiringTeamSummary
  roles: HiringTeamRole[]
  /** Capped at 500 by the endpoint — this feeds a picker, not a report. */
  assignable: AssignableEmployee[]
  departments: HiringTeamDepartment[]
}

export interface HiringTeamPayload {
  user_id: number
  role: HiringTeamRole
  department_id?: number | null
  active?: boolean
}

export interface ResumeScreening {
  id: number
  application_id: number
  candidate_name: string | null
  ai_score: number | null
  keywords_matched: string[]
  comments: string | null
  reviewed_by: number | null
  reviewer_name: string | null
  reviewed_at: string | null
  reviewed_on: string | null
}

export interface ResumeScreeningPayload {
  application_id: number
  ai_score: number
  keywords_matched?: string
  comments?: string
}

/** The Laravel envelope these endpoints return. */
interface Envelope<T> {
  status: number
  message?: string
  data: T
}

/* ------------------------------------------------------------------ *
 * Hiring team
 * ------------------------------------------------------------------ */

export interface HiringTeamFilters {
  role?: string
  search?: string
  active?: string
}

export const hiringTeamService = {
  async list(filters: HiringTeamFilters = {}): Promise<HiringTeamResponse> {
    const extra: Record<string, string> = {}
    if (filters.role && filters.role !== 'all') extra.role = filters.role
    if (filters.search) extra.search = filters.search
    if (filters.active && filters.active !== 'all') extra.active = filters.active

    const res = await apiClient.get<Envelope<HiringTeamResponse>>('/talent/hiring-team', contextParams(extra))
    return res.data
  },

  // Context goes in the body on writes, matching every other talent service
  // here. The controller still takes the tenant and the actor from the token -
  // `user_id` riding along in the payload is ignored, deliberately.
  async add(payload: HiringTeamPayload): Promise<HiringTeamMember> {
    const res = await apiClient.post<Envelope<HiringTeamMember>>('/talent/hiring-team', {
      ...payload, ...contextParams(),
    })
    return res.data
  },

  async update(id: number, payload: Partial<HiringTeamPayload>): Promise<HiringTeamMember> {
    const res = await apiClient.put<Envelope<HiringTeamMember>>(`/talent/hiring-team/${id}`, {
      ...payload, ...contextParams(),
    })
    return res.data
  },

  async remove(id: number): Promise<void> {
    await apiClient.delete<Envelope<null>>(`/talent/hiring-team/${id}`, contextParams())
  },
}

/* ------------------------------------------------------------------ *
 * Resume screening
 * ------------------------------------------------------------------ */

export interface ResumeScreeningResponse {
  screenings: ResumeScreening[]
  latest: ResumeScreening | null
}

export const resumeScreeningService = {
  async forApplication(applicationId: number): Promise<ResumeScreeningResponse> {
    const res = await apiClient.get<Envelope<ResumeScreeningResponse>>(
      '/talent/resume-screenings',
      contextParams({ application_id: String(applicationId) }),
    )
    return res.data
  },

  // `reviewed_by` is never sent: the controller stamps it from the token, so a
  // sign-off cannot be recorded under somebody else's name.
  async record(payload: ResumeScreeningPayload): Promise<ResumeScreening> {
    const res = await apiClient.post<Envelope<ResumeScreening>>('/talent/resume-screenings', {
      ...payload, ...contextParams(),
    })
    return res.data
  },
}
