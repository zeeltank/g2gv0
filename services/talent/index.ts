/**
 * Talent Service
 * API calls for talent management - recruitment, onboarding, performance
 */

import { apiClient } from '@/services/core'
export { isOpenJobPosting, recruitmentService } from './recruitment'
// Performance & Rewards Center. NB: the PerformanceReview interface and the
// getReviews / createReview / submitReview calls further down this file target
// `/performance-reviews`, which does NOT exist in Laravel. The live module is
// `/api/performance/*` and lives entirely in ./performance.
export { performanceService } from './performance'
// Onboarding & Employee Lifecycle Center. NB: the OnboardingTask interface and
// the getOnboardingTasks / createOnboardingTask / updateOnboardingTask calls
// further down this file target `/onboarding-tasks`, which does NOT exist in
// Laravel. The live module is `/api/onboarding/*` and lives entirely in
// ./onboarding. Left in place rather than deleted so no existing import breaks.
export { onboardingService } from './onboarding'
export { mobilityService } from './mobility'
export { offboardingService } from './offboarding'


export interface Candidate {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  position: string
  status: 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected'
  appliedAt: string
}

export interface OnboardingTask {
  id: string
  title: string
  description?: string
  employeeId: string
  status: 'pending' | 'in_progress' | 'completed'
  dueDate?: string
  completedAt?: string
}

export interface PerformanceReview {
  id: string
  employeeId: string
  reviewerId: string
  period: string
  rating: number
  comments?: string
  status: 'draft' | 'submitted' | 'acknowledged'
  createdAt: string
}

export interface MobilityRequest {
  id: string
  employeeId: string
  fromDepartment: string
  toDepartment: string
  type: 'transfer' | 'promotion' | 'demotion'
  status: 'pending' | 'approved' | 'rejected'
  requestedAt: string
}

export const talentService = {
  // Recruitment
  getCandidates: (params?: { status?: string }) => 
    apiClient.get<Candidate[]>('/candidates', params as Record<string, string>),
  getCandidate: (id: string) => apiClient.get<Candidate>(`/candidates/${id}`),
  createCandidate: (data: Partial<Candidate>) => apiClient.post<Candidate>('/candidates', data),
  updateCandidateStatus: (id: string, status: string) => 
    apiClient.patch<Candidate>(`/candidates/${id}`, { status }),

  // Onboarding
  getOnboardingTasks: (employeeId?: string) => 
    apiClient.get<OnboardingTask[]>('/onboarding-tasks', employeeId ? { employeeId } : undefined),
  createOnboardingTask: (data: Partial<OnboardingTask>) => 
    apiClient.post<OnboardingTask>('/onboarding-tasks', data),
  updateOnboardingTask: (id: string, data: Partial<OnboardingTask>) => 
    apiClient.patch<OnboardingTask>(`/onboarding-tasks/${id}`, data),

  // Performance
  getPerformanceReviews: (employeeId?: string) => 
    apiClient.get<PerformanceReview[]>('/performance-reviews', employeeId ? { employeeId } : undefined),
  createPerformanceReview: (data: Partial<PerformanceReview>) => 
    apiClient.post<PerformanceReview>('/performance-reviews', data),
  submitPerformanceReview: (id: string) => 
    apiClient.post<PerformanceReview>(`/performance-reviews/${id}/submit`, {}),

  // Mobility
  getMobilityRequests: (params?: { status?: string }) => 
    apiClient.get<MobilityRequest[]>('/mobility-requests', params as Record<string, string>),
  createMobilityRequest: (data: Partial<MobilityRequest>) => 
    apiClient.post<MobilityRequest>('/mobility-requests', data),
  approveMobilityRequest: (id: string) => 
    apiClient.post<MobilityRequest>(`/mobility-requests/${id}/approve`, {}),
  rejectMobilityRequest: (id: string, reason: string) => 
    apiClient.post<MobilityRequest>(`/mobility-requests/${id}/reject`, { reason }),
}
