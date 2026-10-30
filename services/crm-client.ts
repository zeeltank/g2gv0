import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'

export interface CrmApiRequestOptions {
  path: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  context?: LaravelContext
}

export async function crmApiRequest<T = any>({
  path,
  method = 'GET',
  body,
  context,
}: CrmApiRequestOptions): Promise<{ data?: T; status?: number; message?: string }> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  const params: Record<string, string> = {}
  if (context?.token) params.token = context.token
  if (context?.subInstituteId) params.sub_institute_id = context.subInstituteId

  if (method === 'GET') {
    return apiClient.get<T>(cleanPath, params) as Promise<{ data?: T; status?: number; message?: string }>
  }
  if (method === 'POST') {
    const payload = body && typeof body === 'object' ? { ...(body as object), ...params } : body
    return apiClient.post<T>(cleanPath, payload, { params }) as Promise<{ data?: T; status?: number; message?: string }>
  }
  if (method === 'PUT') {
    const payload = body && typeof body === 'object' ? { ...(body as object), ...params } : body
    return apiClient.put<T>(cleanPath, payload, { params }) as Promise<{ data?: T; status?: number; message?: string }>
  }
  if (method === 'DELETE') {
    return apiClient.delete<T>(cleanPath, params) as Promise<{ data?: T; status?: number; message?: string }>
  }
  return apiClient.get<T>(cleanPath, params) as Promise<{ data?: T; status?: number; message?: string }>
}

