/**
 * LMS Service
 * API calls for learning management system
 */

import { apiClient } from '@/services/core'

export interface Course {
  id: string
  title: string
  description: string
  thumbnail?: string
  duration: number // minutes
  status: 'draft' | 'published' | 'archived'
  category: string
  enrolledCount: number
}

export interface Assignment {
  id: string
  courseId: string
  userId: string
  status: 'not_started' | 'in_progress' | 'completed'
  progress: number
  dueDate?: string
  completedAt?: string
}

export interface Certification {
  id: string
  name: string
  issuedAt: string
  expiresAt?: string
  userId: string
  courseId?: string
}

export const lmsService = {
  // Courses
  getCourses: (params?: { category?: string; status?: string }) => 
    apiClient.get<Course[]>('/courses', params as Record<string, string>),
  getCourse: (id: string) => apiClient.get<Course>(`/courses/${id}`),
  createCourse: (data: Partial<Course>) => apiClient.post<Course>('/courses', data),
  updateCourse: (id: string, data: Partial<Course>) => 
    apiClient.patch<Course>(`/courses/${id}`, data),

  // Assignments
  getAssignments: (userId?: string) => 
    apiClient.get<Assignment[]>('/assignments', userId ? { userId } : undefined),
  getAssignment: (id: string) => apiClient.get<Assignment>(`/assignments/${id}`),
  updateProgress: (id: string, progress: number) => 
    apiClient.patch<Assignment>(`/assignments/${id}`, { progress }),

  // Certifications
  getCertifications: (userId?: string) => 
    apiClient.get<Certification[]>('/certifications', userId ? { userId } : undefined),
}
