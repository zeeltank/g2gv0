import { apiClient } from '@/services/core'
import { getLaravelContext, withLaravelParams } from '@/lib/laravel-context'

export interface MobilityJob {
  id: number
  job_id: string
  title: string
  department_id: number | null
  department: string | null
  location: string
  grade: string
  job_type: string
  posted_on: string
  deadline: string | null
  hiring_manager_id: number | null
  hiring_manager_name: string | null
  current_incumbent: string | null
  vacancies: number
  relocation_required: string
  description: string | null
  status: 'Open' | 'In Review' | 'Closed'
  applications_count?: number
}

export interface MobilityApplication {
  id: number
  job_posting_id: number
  user_id: number
  applied_on: string
  status: 'Applied' | 'Screening' | 'Interviewing' | 'Offered' | 'Rejected' | 'Closed'
  remarks: string | null
  job?: MobilityJob
  applicant?: {
    id: number
    name: string
    employee_no: string | null
    email: string | null
    initials: string
    department: string | null
    designation: string | null
    image: string | null
  } | null
}

export interface MobilityTransfer {
  id: number
  user_id: number
  from_department_id: number | null
  from_department: string | null
  to_department_id: number
  to_department: string | null
  from_jobrole: string | null
  to_jobrole: string
  effective_date: string
  status: 'Pending' | 'Approved' | 'Completed' | 'Cancelled'
  remarks: string | null
  employee?: {
    id: number
    name: string
    employee_no: string | null
    initials: string
    department: string | null
    designation: string | null
    image: string | null
  } | null
}

export interface MobilityPromotion {
  id: number
  user_id: number
  current_grade: string | null
  proposed_grade: string
  current_designation: string | null
  proposed_designation: string
  effective_date: string
  status: 'Pending' | 'Approved' | 'Completed' | 'Cancelled'
  remarks: string | null
  employee?: {
    id: number
    name: string
    employee_no: string | null
    initials: string
    department: string | null
    designation: string | null
    image: string | null
  } | null
}

export interface MobilitySuccessionPlan {
  id: number
  critical_jobrole_id: number
  critical_jobrole_name: string
  successor_user_id: number
  readiness: 'Ready Now' | 'Ready in 1-2 Years' | 'Ready in 2+ Years'
  emergency_successor: boolean
  status: 'Active' | 'Inactive'
  successor?: {
    id: number
    name: string
    employee_no: string | null
    initials: string
    department: string | null
    designation: string | null
    image: string | null
  } | null
}

export interface MobilityTalentPool {
  id: number
  name: string
  description: string | null
  status: 'Active' | 'Inactive'
  members_count?: number
}

export interface TalentPoolMember {
  id: number
  pool_id: number
  user_id: number
  added_on: string
  user_details?: {
    id: number
    name: string
    employee_no: string | null
    initials: string
    department: string | null
    designation: string | null
    image: string | null
  } | null
}

export interface MobilityOverviewData {
  kpis: {
    open_jobs: number
    applications: number
    in_review: number
    transfers_in_progress: number
    promotions_in_progress: number
    critical_roles: number
  }
  charts: {
    movement_summary: {
      transfers: number
      promotions: number
      lateral_moves: number
    }
    succession_coverage: {
      ready_now: number
      ready_1_2_years: number
      ready_2_plus_years: number
      no_successor: number
    }
    top_departments: {
      department: string
      count: number
    }[]
  }
}

function contextParams(extra?: Record<string, string>) {
  const context = getLaravelContext()
  if (!context.token || !context.subInstituteId) {
    throw new Error('Your Laravel session is unavailable. Please sign in again.')
  }
  return withLaravelParams(context, extra)
}

export type MobilityOption = { value: string; label: string }

export type MobilityFilterOptions = {
  departments: MobilityOption[]
  employees: MobilityOption[]
  jobroles: MobilityOption[]
  locations: MobilityOption[]
  grades: MobilityOption[]
  job_types: MobilityOption[]
}

export const mobilityService = {
  getOverview() {
    return apiClient.get<{ status: number; data: MobilityOverviewData }>('/mobility/overview', contextParams())
  },
  /**
   * Filter options, all DERIVED FROM THIS TENANT'S DATA.
   *
   * locations / grades / job_types were not served at all and the client kept
   * its own fixed lists (five Indian cities, a grade ladder), none of which
   * matched what the tenant actually stores - so every option returned nothing.
   * An option now exists exactly when a row matches it, which also means the
   * lists are legitimately EMPTY when there are no internal openings yet.
   */
  getFilters() {
    return apiClient.get<{ status: number; data: MobilityFilterOptions }>('/mobility/filters', contextParams())
  },


  getJobs(filters?: Record<string, string>) {
    return apiClient.get<{ status: number; data: MobilityJob[]; total: number }>('/mobility/jobs', contextParams(filters))
  },
  createJob(data: Partial<MobilityJob>) {
    return apiClient.post<{ status: number; data: MobilityJob }>('/mobility/jobs', { ...contextParams(), ...data })
  },
  updateJob(id: number, data: Partial<MobilityJob>) {
    return apiClient.put<{ status: number; data: MobilityJob }>(`/mobility/jobs/${id}`, { ...contextParams(), ...data })
  },
  deleteJob(id: number) {
    return apiClient.delete<{ status: number }>(`/mobility/jobs/${id}`, contextParams())
  },

  getApplications(filters?: Record<string, string>) {
    return apiClient.get<{ status: number; data: MobilityApplication[]; total: number }>('/mobility/applications', contextParams(filters))
  },
  createApplication(data: { job_posting_id: number; user_id?: number; remarks?: string }) {
    return apiClient.post<{ status: number; data: MobilityApplication }>('/mobility/applications', { ...contextParams(), ...data })
  },
  updateApplication(id: number, data: { status: string; remarks?: string }) {
    return apiClient.put<{ status: number; data: MobilityApplication }>(`/mobility/applications/${id}`, { ...contextParams(), ...data })
  },

  getTransfers(filters?: Record<string, string>) {
    return apiClient.get<{ status: number; data: MobilityTransfer[]; total: number }>('/mobility/transfers', contextParams(filters))
  },
  createTransfer(data: Partial<MobilityTransfer>) {
    return apiClient.post<{ status: number; data: MobilityTransfer }>('/mobility/transfers', { ...contextParams(), ...data })
  },
  updateTransfer(id: number, data: { status: string; remarks?: string }) {
    return apiClient.put<{ status: number; data: MobilityTransfer }>(`/mobility/transfers/${id}`, { ...contextParams(), ...data })
  },

  getPromotions(filters?: Record<string, string>) {
    return apiClient.get<{ status: number; data: MobilityPromotion[]; total: number }>('/mobility/promotions', contextParams(filters))
  },
  createPromotion(data: Partial<MobilityPromotion>) {
    return apiClient.post<{ status: number; data: MobilityPromotion }>('/mobility/promotions', { ...contextParams(), ...data })
  },
  updatePromotion(id: number, data: { status: string; remarks?: string }) {
    return apiClient.put<{ status: number; data: MobilityPromotion }>(`/mobility/promotions/${id}`, { ...contextParams(), ...data })
  },

  getSuccessions(filters?: Record<string, string>) {
    return apiClient.get<{ status: number; data: MobilitySuccessionPlan[]; total: number }>('/mobility/successions', contextParams(filters))
  },
  createSuccession(data: Partial<MobilitySuccessionPlan>) {
    return apiClient.post<{ status: number; data: MobilitySuccessionPlan }>('/mobility/successions', { ...contextParams(), ...data })
  },
  updateSuccession(id: number, data: Partial<MobilitySuccessionPlan>) {
    return apiClient.put<{ status: number; data: MobilitySuccessionPlan }>(`/mobility/successions/${id}`, { ...contextParams(), ...data })
  },
  deleteSuccession(id: number) {
    return apiClient.delete<{ status: number }>(`/mobility/successions/${id}`, contextParams())
  },

  getPools(filters?: Record<string, string>) {
    return apiClient.get<{ status: number; data: MobilityTalentPool[]; total: number }>('/mobility/pools', contextParams(filters))
  },
  createPool(data: Partial<MobilityTalentPool>) {
    return apiClient.post<{ status: number; data: MobilityTalentPool }>('/mobility/pools', { ...contextParams(), ...data })
  },
  getPoolMembers(poolId: number) {
    return apiClient.get<{ status: number; data: TalentPoolMember[] }>(`/mobility/pools/${poolId}/members`, contextParams())
  },
  addPoolMember(poolId: number, userId: number) {
    return apiClient.post<{ status: number; data: TalentPoolMember }>(`/mobility/pools/${poolId}/members`, { ...contextParams(), user_id: userId })
  },
  removePoolMember(poolId: number, userId: number) {
    return apiClient.delete<{ status: number }>(`/mobility/pools/${poolId}/members/${userId}`, contextParams())
  },
}

