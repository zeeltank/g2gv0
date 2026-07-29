import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'
import type { CompetencyApiResponse } from './command-center'

export interface EmployeeCompetencyItem {
  skill_id: number
  matrix_id: number
  name: string
  description: string
  required: number
  current: number
  interest_level: number
  knowledge: number
  ability: number
  gap: number
  date: string
  assessor: string
}

export interface EmployeeCompetencyCategory {
  category: string
  items: EmployeeCompetencyItem[]
}

export interface EmployeeProfileData {
  employee: {
    id: string
    name: string
    initials: string
    emp_id: string
    role: string
    department: string
    location: string
    joined: string
    reports_to: string
    experience: string
    type: string
  }
  metrics: {
    latest_assessment: string
    latest_cycle: string
    overall_score: number
  }
  competencies: EmployeeCompetencyCategory[]
}

export interface AvailableSkill {
  id: number
  title: string
  category: string | null
  description: string | null
}

export interface EmployeeCertification {
  id: number
  name: string
  issuing_body: string | null
  credential_id: string | null
  status: string
  issued_date: string | null
  expiry_date: string | null
}

export interface EmployeeDevelopmentPlan {
  id: number
  title: string
  status: string
  progress: number
  start_date: string | null
  due_date: string | null
}

export interface EmployeeEvidence {
  id: number
  title: string
  evidence_type: string
  description: string | null
  link: string | null
  status: string
  competency_id: number | null
  competency_name: string | null
  date: string | null
}

export interface CareerRole {
  jobrole: string
  department: string | null
  description: string | null
  required_skills: number
}

export interface CareerPathData {
  current: { jobrole: string; department: string | null; description: string | null; job_level: string | null } | null
  next_roles: CareerRole[]
  path_source: string
}

export interface SkillHistoryData {
  skill: {
    name: string
    category: string | null
    description: string | null
    current_level: number
    interest_level: number
    knowledge: number
    ability: number
    assessor: string
    created_at: string
    updated_at: string
  }
  timeline: Array<{
    action: string
    level: number
    date: string
    by: string
  }>
}

export const employeeProfileService = {
  getEmployeeProfile: (context: LaravelContext, userId: string) =>
    apiClient.get<CompetencyApiResponse<EmployeeProfileData>>(
      `/competency/employee-profiles/${userId}`,
      withLaravelParams(context)
    ),

  getAvailableSkills: (context: LaravelContext, userId: string) =>
    apiClient.get<CompetencyApiResponse<AvailableSkill[]>>(
      `/competency/employee-profiles/${userId}/available-skills`,
      withLaravelParams(context)
    ),

  addSkill: (context: LaravelContext, userId: string, payload: { skill_id: number; skill_level: number }) =>
    apiClient.post<CompetencyApiResponse<{ id: number }>>(
      `/competency/employee-profiles/${userId}/skills`,
      { ...withLaravelParams(context), ...payload }
    ),

  updateSkill: (context: LaravelContext, userId: string, matrixId: number, payload: { skill_level: number }) =>
    apiClient.put<CompetencyApiResponse<null>>(
      `/competency/employee-profiles/${userId}/skills/${matrixId}`,
      { ...withLaravelParams(context), ...payload }
    ),

  getSkillHistory: (context: LaravelContext, userId: string, skillId: number) =>
    apiClient.get<CompetencyApiResponse<SkillHistoryData>>(
      `/competency/employee-profiles/${userId}/skills/${skillId}/history`,
      withLaravelParams(context)
    ),

  /* -- Employee-scoped lists (Certifications / Development Plans tabs) -- */
  getCertifications: (context: LaravelContext, userId: string) =>
    apiClient.get<CompetencyApiResponse<EmployeeCertification[]>>(
      `/competency/employee-profiles/${userId}/certifications`,
      withLaravelParams(context)
    ),

  getDevelopmentPlans: (context: LaravelContext, userId: string) =>
    apiClient.get<CompetencyApiResponse<EmployeeDevelopmentPlan[]>>(
      `/competency/employee-profiles/${userId}/development-plans`,
      withLaravelParams(context)
    ),

  getEvidence: (context: LaravelContext, userId: string) =>
    apiClient.get<CompetencyApiResponse<EmployeeEvidence[]>>(
      `/competency/employee-profiles/${userId}/evidence`,
      withLaravelParams(context)
    ),

  addEvidence: (context: LaravelContext, userId: string, payload: { title: string; evidence_type?: string; description?: string; link?: string; competency_id?: number; status?: string }) =>
    apiClient.post<CompetencyApiResponse<{ id: number }>>(
      `/competency/employee-profiles/${userId}/evidence`,
      { ...withLaravelParams(context), ...payload }
    ),

  deleteEvidence: (context: LaravelContext, userId: string, evidenceId: number) =>
    apiClient.delete<CompetencyApiResponse<null>>(
      `/competency/employee-profiles/${userId}/evidence/${evidenceId}`,
      withLaravelParams(context)
    ),

  getCareerPath: (context: LaravelContext, userId: string) =>
    apiClient.get<CompetencyApiResponse<CareerPathData>>(
      `/competency/employee-profiles/${userId}/career-path`,
      withLaravelParams(context)
    ),

  /* -- Private notes -- */
  getNotes: (context: LaravelContext, userId: string) =>
    apiClient.get<CompetencyApiResponse<{ note: string; updated_at: string | null }>>(
      `/competency/employee-profiles/${userId}/notes`,
      withLaravelParams(context)
    ),

  saveNotes: (context: LaravelContext, userId: string, note: string) =>
    apiClient.put<CompetencyApiResponse<null>>(
      `/competency/employee-profiles/${userId}/notes`,
      { ...withLaravelParams(context), note }
    ),

  /* -- Quick actions: reuse the existing competency-domain create endpoints,
        scoped to this employee via user_id. -- */
  requestReassessment: (
    context: LaravelContext,
    payload: { title: string; user_id: string; jobrole?: string; due_date?: string },
  ) =>
    apiClient.post<CompetencyApiResponse<{ id: number }>>('/competency/assessments', {
      ...withLaravelParams(context),
      status: 'open',
      ...payload,
    }),

  assignDevelopmentPlan: (
    context: LaravelContext,
    payload: { title: string; user_id: string; jobrole?: string; competency_id?: number; due_date?: string },
  ) =>
    apiClient.post<CompetencyApiResponse<{ id: number }>>('/competency/development-plans', {
      ...withLaravelParams(context),
      status: 'active',
      ...payload,
    }),

  addCertification: (
    context: LaravelContext,
    payload: { name: string; user_id: string; jobrole?: string; issuing_body?: string; issued_date?: string; expiry_date?: string },
  ) =>
    apiClient.post<CompetencyApiResponse<{ id: number }>>('/competency/certifications', {
      ...withLaravelParams(context),
      status: 'valid',
      ...payload,
    }),
}
