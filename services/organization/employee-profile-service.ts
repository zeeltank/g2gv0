/**
 * Employee Profile Service
 * Handles REST API integrations for Employee View Profile tabs
 */

import { apiClient, webClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { getLaravelContext, withLaravelParams } from '@/lib/laravel-context'

export interface EmployeeProfileFullResponse {
  status_code?: number | string
  status?: number | string
  message?: string
  data?: Record<string, any>
  jobroleSkills?: any[]
  skills?: any[]
  userRatedSkills?: any[]
  jobroleTasks?: any[]
  userLevelOfResponsibility?: Record<string, any>
  user_profiles?: any[]
  employees?: any[]
  documentTypeLists?: any[]
  documentLists?: any[]
  departments?: any[]
  jobroleList?: any[]
}

export async function fetchEmployeeProfile(
  id: string | number,
  context?: LaravelContext
): Promise<EmployeeProfileFullResponse> {
  const ctx = context || getLaravelContext()
  const params = withLaravelParams(ctx)
  return webClient.get<EmployeeProfileFullResponse>(`/user/add_user/${id}/edit`, params)
}

export async function updateEmployeeProfile(
  id: string | number,
  payload: Record<string, any>,
  context?: LaravelContext
): Promise<{ status?: string | number; message?: string }> {
  const ctx = context || getLaravelContext()
  const params = withLaravelParams(ctx)
  return webClient.post(`/user/add_user/${id}`, payload, { params })
}

export async function uploadEmployeeDocument(
  id: string | number,
  formData: FormData,
  context?: LaravelContext
): Promise<{ status?: string | number; message?: string }> {
  const ctx = context || getLaravelContext()
  const params = withLaravelParams(ctx)
  return webClient.post(`/user/user_document/${id}`, formData, { params })
}

export async function fetchCompetencyProfile(
  id: string | number,
  context?: LaravelContext
): Promise<any> {
  const ctx = context || getLaravelContext()
  const params = withLaravelParams(ctx)
  return apiClient.get(`/competency/employee-profiles/${id}`, params)
}

export async function updateSkillRating(
  id: string | number,
  matrixId: number | string,
  level: number,
  context?: LaravelContext
): Promise<any> {
  const ctx = context || getLaravelContext()
  const params = withLaravelParams(ctx)
  return apiClient.put(`/competency/employee-profiles/${id}/skills/${matrixId}`, { proficiency_level: level }, { params })
}
