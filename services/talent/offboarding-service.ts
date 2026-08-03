import { apiClient as api } from '@/services/core'
import { getLaravelContext, withLaravelParams } from '@/lib/laravel-context'
import type { 
  OffboardingCasesResponse, 
  OffboardingCaseDetails, 
  OffboardingClearance, 
  ExitInterview 
} from '@/types/talent-offboarding'


const BASE_PATH = '/talent/offboarding'

export const offboardingService = {
  getCases: async (params?: Record<string, string | number>) => {
    return api.get<OffboardingCasesResponse>(`${BASE_PATH}/cases`, withLaravelParams(getLaravelContext(), params))
  },
  
  getCase: async (id: number) => {
    return api.get<{ data: OffboardingCaseDetails }>(`${BASE_PATH}/cases/${id}`, withLaravelParams(getLaravelContext()))
  },
  
  createCase: async (data: any) => {
    return api.post<{ data: OffboardingCaseDetails }>(`${BASE_PATH}/cases`, withLaravelParams(getLaravelContext(), data))
  },

  updateCase: async (id: number, data: any) => {
    return api.put<{ data: OffboardingCaseDetails }>(`${BASE_PATH}/cases/${id}`, withLaravelParams(getLaravelContext(), data))
  },

  advanceCase: async (id: number, data: { status: string }) => {
    return api.post<{ data: OffboardingCaseDetails }>(`${BASE_PATH}/cases/${id}/advance`, withLaravelParams(getLaravelContext(), data))
  },

  deleteCase: async (id: number) => {
    return api.delete<{ message: string }>(`${BASE_PATH}/cases/${id}`, withLaravelParams(getLaravelContext()))
  },

  // Clearances
  getClearances: async (params?: Record<string, string | number>) => {
    return api.get<{ data: OffboardingClearance[] }>(`${BASE_PATH}/clearances`, withLaravelParams(getLaravelContext(), params))
  },

  createClearance: async (data: any) => {
    return api.post<{ data: OffboardingClearance }>(`${BASE_PATH}/clearances`, withLaravelParams(getLaravelContext(), data))
  },

  updateClearance: async (id: number, data: any) => {
    return api.put<{ data: OffboardingClearance }>(`${BASE_PATH}/clearances/${id}`, withLaravelParams(getLaravelContext(), data))
  },

  clearClearance: async (id: number, data?: { remarks?: string }) => {
    return api.post<{ data: OffboardingClearance }>(`${BASE_PATH}/clearances/${id}/clear`, withLaravelParams(getLaravelContext(), data || {}))
  },

  deleteClearance: async (id: number) => {
    return api.delete<{ message: string }>(`${BASE_PATH}/clearances/${id}`, withLaravelParams(getLaravelContext()))
  },

  // Exit Interviews
  getInterviews: async (params?: Record<string, string | number>) => {
    return api.get<{ data: ExitInterview[] }>(`${BASE_PATH}/exit-interviews`, withLaravelParams(getLaravelContext(), params))
  },

  createInterview: async (data: any) => {
    return api.post<{ data: ExitInterview }>(`${BASE_PATH}/exit-interviews`, withLaravelParams(getLaravelContext(), data))
  },

  updateInterview: async (id: number, data: any) => {
    return api.put<{ data: ExitInterview }>(`${BASE_PATH}/exit-interviews/${id}`, withLaravelParams(getLaravelContext(), data))
  },

  deleteInterview: async (id: number) => {
    return api.delete<{ message: string }>(`${BASE_PATH}/exit-interviews/${id}`, withLaravelParams(getLaravelContext()))
  }
}
