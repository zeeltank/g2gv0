/**
 * Organization Service
 * Laravel API calls for organization, departments, compliance, and discipline.
 */

import { apiClient, webClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

export type LaravelStatusResponse<T = unknown> = {
  status?: number | string
  status_code?: number | string
  message?: string
  data?: T
}

export type LaravelOrgDetail = {
  id: number
  legal_name?: string | null
  cin?: string | null
  gstin?: string | null
  pan?: string | null
  registered_address?: string | null
  industry?: string | null
  employee_count?: string | null
  work_week?: string | null
  logo?: string | null
  mobile_no?: string | null
  country_code?: string | null
  email?: string | null
  website?: string | null
  sisters_org?: LaravelSisterOrg[]
  sistersOrg?: LaravelSisterOrg[]
}

export type LaravelSisterOrg = Omit<LaravelOrgDetail, 'sisters_org' | 'sistersOrg'>

export type OrganizationProfileResponse = {
  org_data?: LaravelOrgDetail[]
}

export type LaravelDepartment = {
  id: number
  department: string
  parent_id?: number | null
  status?: number | null
  created_at?: string | null
  updated_at?: string | null
}

export type DepartmentsManagementResponse = {
  main_departments: LaravelDepartment[]
  sub_departments: Record<string, LaravelDepartment[]>
}

export type LaravelComplianceRecord = {
  id: number
  name?: string | null
  description?: string | null
  standard_name?: string | null
  assigned_to?: number | string | null
  assigned_user?: string | null
  duedate?: string | null
  attachment?: string | null
  frequency?: string | null
  custom_frequency_details?: string | null
}

export type ComplianceIndexResponse = {
  complainceData?: LaravelComplianceRecord[]
  userDetails?: LaravelEmployee[]
}

export type LaravelEmployee = {
  id: number | string
  name?: string | null
  employee_name?: string | null
  full_name?: string | null
  first_name?: string | null
  middle_name?: string | null
  last_name?: string | null
  department_id?: number | string | null
}

export type LaravelDepartmentEmployee = LaravelEmployee & {
  employee_no?: string | null
  email?: string | null
  mobile?: string | null
}

export type LaravelDisciplinaryRecord = {
  id: number
  department_id?: number | string | null
  department_name?: string | null
  employee_id?: number | string | null
  employee_name?: string | null
  incident_datetime?: string | null
  location?: string | null
  misconduct_type?: string | null
  description?: string | null
  witness_id?: number | string | null
  witness_name?: string | null
  action_taken?: string | null
  remarks?: string | null
  reported_by?: number | string | null
  reported_by_name?: string | null
  date_of_report?: string | null
}

function appendDefined(formData: FormData, key: string, value: string | Blob | undefined | null) {
  if (value !== undefined && value !== null && value !== '') {
    formData.append(key, value)
  }
}

function departmentParams(context: LaravelContext) {
  return {
    sub_institute_id: context.subInstituteId,
    ...(context.token ? { type: 'api', token: context.token } : {}),
  }
}

async function ensureLaravelSuccess<T extends LaravelStatusResponse>(request: Promise<T>) {
  const response = await request
  const status = response.status ?? response.status_code
  if (String(status) === '0') {
    throw new Error(response.message || 'Laravel API request failed')
  }
  return response
}

export const organizationService = {
  getOrganizationProfile: (context: LaravelContext) =>
    webClient.get<OrganizationProfileResponse>('/settings/organization_data', withLaravelParams(context)),

  saveOrganizationProfile: (context: LaravelContext, data: Record<string, string | File | undefined>) => {
    const formData = new FormData()
    Object.entries(withLaravelParams(context, { formType: 'organization_details' })).forEach(([key, value]) => {
      appendDefined(formData, key, value)
    })
    Object.entries(data).forEach(([key, value]) => appendDefined(formData, key, value))
    return ensureLaravelSuccess(webClient.postForm<LaravelStatusResponse>('/settings/organization_data', formData))
  },

  getDepartmentsManagement: (context: LaravelContext) =>
    apiClient.get<DepartmentsManagementResponse>('/departments-management', departmentParams(context)),

  /**
   * The token is not optional here. tbluser stores credentials, so /table_data
   * refuses to serve it to an anonymous caller whatever tenant is named - this
   * call used to be the one place in this service that omitted it, and it came
   * back 401 while every neighbouring call worked.
   *
   * sub_institute_id stays in the request for older backends, but the server
   * now derives the tenant from the token and ignores this value, so the two
   * can never disagree.
   */
  getEmployeesByDepartment: (context: LaravelContext, departmentId: string) => {
    const params = new URLSearchParams({
      table: 'tbluser',
      token: context.token,
      'filters[sub_institute_id]': context.subInstituteId,
      'filters[department_id]': departmentId,
      'filters[status]': '1',
      sort_order: 'first_name',
    })
    return webClient.get<LaravelDepartmentEmployee[]>(`/table_data?${params.toString()}`)
  },

  createDepartment: (context: LaravelContext, data: { department: string; parent_id?: string }) =>
    ensureLaravelSuccess(apiClient.post<LaravelStatusResponse<{ id: number }>>(
      `/departments-management?${new URLSearchParams(departmentParams(context)).toString()}`,
      {
      sub_institute_id: context.subInstituteId,
      user_id: context.userId,
      department: data.department,
      parent_id: data.parent_id || 0,
      },
    )),

  updateDepartment: (context: LaravelContext, id: string, data: { department: string }) =>
    ensureLaravelSuccess(apiClient.put<LaravelStatusResponse>(
      `/departments-management/${id}?${new URLSearchParams(departmentParams(context)).toString()}`,
      {
      sub_institute_id: context.subInstituteId,
      user_id: context.userId,
      department: data.department,
      },
    )),

  deleteDepartment: (context: LaravelContext, id: string) =>
    ensureLaravelSuccess(apiClient.delete<LaravelStatusResponse>(
      `/departments-management/${id}?${new URLSearchParams(departmentParams(context)).toString()}`,
    )),

  getComplianceRecords: (context: LaravelContext) =>
    webClient.get<ComplianceIndexResponse>('/settings/institute_detail', withLaravelParams(context, {
      formName: 'complaince_library',
    })),

  saveComplianceRecord: (context: LaravelContext, data: Record<string, string | File | undefined>) => {
    const formData = new FormData()
    Object.entries(withLaravelParams(context, { formName: 'complaince_library' })).forEach(([key, value]) => {
      appendDefined(formData, key, value)
    })
    Object.entries(data).forEach(([key, value]) => appendDefined(formData, key, value))
    return ensureLaravelSuccess(webClient.postForm<LaravelStatusResponse>('/settings/institute_detail', formData))
  },

  updateComplianceRecord: (context: LaravelContext, id: string, data: Record<string, string | File | undefined>) => {
    const formData = new FormData()
    Object.entries(withLaravelParams(context, { formName: 'complaince_library' })).forEach(([key, value]) => {
      appendDefined(formData, key, value)
    })
    Object.entries(data).forEach(([key, value]) => appendDefined(formData, key, value))
    return ensureLaravelSuccess(webClient.putForm<LaravelStatusResponse>(`/settings/institute_detail/${id}`, formData))
  },

  deleteComplianceRecord: (context: LaravelContext, id: string) =>
    ensureLaravelSuccess(webClient.delete<LaravelStatusResponse>(
      `/settings/institute_detail/${id}?${new URLSearchParams(withLaravelParams(context, { formName: 'complaince_library' })).toString()}`,
    )),

  getDisciplinaryRecords: (context: LaravelContext) =>
    webClient.get<LaravelStatusResponse<LaravelDisciplinaryRecord[]>>('/settings/discliplinary_management', withLaravelParams(context)),

  createDisciplinaryRecord: (context: LaravelContext, data: Record<string, string>) =>
    ensureLaravelSuccess(webClient.post<LaravelStatusResponse>('/settings/discliplinary_management', {
      ...withLaravelParams(context),
      ...data,
    })),

  updateDisciplinaryRecord: (context: LaravelContext, id: string, data: Record<string, string>) =>
    ensureLaravelSuccess(webClient.put<LaravelStatusResponse>(`/settings/discliplinary_management/${id}`, {
      ...withLaravelParams(context),
      ...data,
    })),

  deleteDisciplinaryRecord: (context: LaravelContext, id: string, reportedBy: string) =>
    ensureLaravelSuccess(webClient.delete<LaravelStatusResponse>(
      `/settings/discliplinary_management/${id}?${new URLSearchParams({
        ...withLaravelParams(context),
        reported_by: reportedBy,
      }).toString()}`,
    )),
}

export * from './employee-profile-service'

