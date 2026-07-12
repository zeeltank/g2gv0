/**
 * Competency Service
 * API calls for competency management
 */

import { apiClient } from '@/services/core'

export interface Competency {
  id: string
  name: string
  description: string
  category: string
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
}

export interface CompetencyFramework {
  id: string
  name: string
  description: string
  competencies: Competency[]
  createdAt: string
  updatedAt: string
}

export interface CompetencyAssessment {
  id: string
  userId: string
  competencyId: string
  rating: number
  assessedBy: string
  assessedAt: string
  notes?: string
}

export interface Certification {
  id: string
  name: string
  competencyId?: string
  issuedAt: string
  expiresAt?: string
  userId: string
}

export const competencyService = {
  // Competency Frameworks
  getFrameworks: () => apiClient.get<CompetencyFramework[]>('/competency-frameworks'),
  getFramework: (id: string) => apiClient.get<CompetencyFramework>(`/competency-frameworks/${id}`),
  createFramework: (data: Partial<CompetencyFramework>) => 
    apiClient.post<CompetencyFramework>('/competency-frameworks', data),
  updateFramework: (id: string, data: Partial<CompetencyFramework>) => 
    apiClient.patch<CompetencyFramework>(`/competency-frameworks/${id}`, data),

  // Competencies
  getCompetencies: (frameworkId?: string) => 
    apiClient.get<Competency[]>('/competencies', frameworkId ? { frameworkId } : undefined),
  getCompetency: (id: string) => apiClient.get<Competency>(`/competencies/${id}`),

  // Assessments
  getAssessments: (userId?: string) => 
    apiClient.get<CompetencyAssessment[]>('/competency-assessments', userId ? { userId } : undefined),
  createAssessment: (data: Partial<CompetencyAssessment>) => 
    apiClient.post<CompetencyAssessment>('/competency-assessments', data),
  updateAssessment: (id: string, data: Partial<CompetencyAssessment>) => 
    apiClient.patch<CompetencyAssessment>(`/competency-assessments/${id}`, data),

  // Certifications
  getCertifications: (userId?: string) => 
    apiClient.get<Certification[]>('/competency-certifications', userId ? { userId } : undefined),
  issueCertification: (data: Partial<Certification>) => 
    apiClient.post<Certification>('/competency-certifications', data),
}
