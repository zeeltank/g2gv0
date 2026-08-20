/**
 * Organization Service
 * Laravel API calls for organization, departments, compliance, and discipline.
 */

import { apiClient, webClient, buildApiUrl } from '@/services/core'
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

/**
 * A department as the API now returns it.
 *
 * `code`, `description`, `head_id`, `head_name`, `employee_count` and
 * `sort_order` are new. The screen already displayed all of them - it just had
 * no data behind them, so it invented values: a hardcoded code lookup table, a
 * permanently null HOD, a headcount of 0, and a Status that read "Active" for
 * every row because the API filtered out everything else before responding.
 */
export type LaravelDepartment = {
  id: number
  department: string
  code?: string | null
  description?: string | null
  parent_id?: number | null
  status?: number | null
  sort_order?: number | null
  roles_responsibility?: string | null
  head_user_id?: number | null
  head_id?: number | null
  head_name?: string | null
  employee_count?: number | string | null
  created_at?: string | null
  updated_at?: string | null
}

export type LaravelDepartmentDetail = LaravelDepartment & {
  sub_department_count?: number
  sop_count?: number
  policy_count?: number
  rule_count?: number
}

export type DepartmentsManagementResponse = {
  main_departments: LaravelDepartment[]
  sub_departments: Record<string, LaravelDepartment[]>
  /** Flat, ordered list. Added alongside the split shape the tree needs. */
  departments?: LaravelDepartment[]
}

/** Shared shape of the SOP / Policy / Rule records. */
export type DepartmentContentRecord = {
  id: number
  department_id: number
  title: string
  code?: string | null
  description?: string | null
  category?: string | null
  version?: string | null
  status?: 'Active' | 'Draft' | 'Archived' | string | null
  effective_date?: string | null
  review_date?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type DepartmentSop = DepartmentContentRecord & {
  file_path?: string | null
  file_name?: string | null
  file_size?: number | null
  file_mime?: string | null
}

export type DepartmentRule = DepartmentContentRecord & {
  rule_definition?: string | null
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

  getDepartment: (context: LaravelContext, id: string) =>
    apiClient.get<LaravelStatusResponse<LaravelDepartmentDetail>>(
      `/departments-management/${id}`,
      departmentParams(context),
    ),

  createDepartment: (
    context: LaravelContext,
    data: { department: string; parent_id?: string; code?: string; description?: string },
  ) =>
    ensureLaravelSuccess(apiClient.post<LaravelStatusResponse<{ id: number }>>(
      `/departments-management?${new URLSearchParams(departmentParams(context)).toString()}`,
      {
      sub_institute_id: context.subInstituteId,
      user_id: context.userId,
      department: data.department,
      parent_id: data.parent_id || 0,
      ...(data.code !== undefined ? { code: data.code } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      },
    )),

  /**
   * Only the fields actually present are sent, and the backend only writes the
   * fields it receives - so editing a name cannot blank out a description the
   * form never showed.
   *
   * This used to accept `{ department }` and nothing else, because the endpoint
   * wrote exactly one column and discarded everything else the form collected.
   */
  updateDepartment: (
    context: LaravelContext,
    id: string,
    data: { department?: string; code?: string; description?: string; status?: number; parent_id?: number },
  ) =>
    ensureLaravelSuccess(apiClient.put<LaravelStatusResponse>(
      `/departments-management/${id}?${new URLSearchParams(departmentParams(context)).toString()}`,
      {
      sub_institute_id: context.subInstituteId,
      user_id: context.userId,
      ...data,
      },
    )),

  deleteDepartment: (context: LaravelContext, id: string) =>
    ensureLaravelSuccess(apiClient.delete<LaravelStatusResponse>(
      `/departments-management/${id}?${new URLSearchParams(departmentParams(context)).toString()}`,
    )),

  /** Assign, change, or clear (null) the head of department. */
  setDepartmentHead: (context: LaravelContext, id: string, headUserId: string | null) =>
    ensureLaravelSuccess(apiClient.patch<LaravelStatusResponse>(
      `/departments-management/${id}/head?${new URLSearchParams(departmentParams(context)).toString()}`,
      { head_user_id: headUserId },
    )),

  /** Re-parent a department. `0` moves it to the root. */
  setDepartmentParent: (context: LaravelContext, id: string, parentId: string | number) =>
    ensureLaravelSuccess(apiClient.patch<LaravelStatusResponse>(
      `/departments-management/${id}/parent?${new URLSearchParams(departmentParams(context)).toString()}`,
      { parent_id: Number(parentId) || 0 },
    )),

  /** Move one place up or down among siblings. */
  reorderDepartment: (context: LaravelContext, id: string, direction: 'up' | 'down') =>
    ensureLaravelSuccess(apiClient.post<LaravelStatusResponse<{ moved: boolean }>>(
      `/departments-management/reorder?${new URLSearchParams(departmentParams(context)).toString()}`,
      { department_id: Number(id), direction },
    )),

  /**
   * URL for the CSV export.
   *
   * Returned as a string rather than fetched, because the browser needs to
   * navigate to it for the download to reach the user's disk - fetching it into
   * JS would just put a CSV in memory.
   */
  departmentExportUrl: (context: LaravelContext) =>
    buildApiUrl('/departments-management/export', departmentParams(context)),

  /** Tenant employees, for the head-of-department picker. */
  getDepartmentCandidates: (context: LaravelContext, search = '') =>
    apiClient.get<LaravelStatusResponse<LaravelDepartmentEmployee[]>>(
      '/departments-management/employees',
      { ...departmentParams(context), ...(search ? { search } : {}) },
    ),

  // -- SOPs / Policies / Rules -------------------------------------------
  //
  // These three tabs had no backend at all until now: each rendered a MOCK_*
  // array from the bundle, showed identical records for every department, and
  // discarded edits on tab switch.

  getDepartmentSops: (context: LaravelContext, departmentId: string) =>
    apiClient.get<LaravelStatusResponse<DepartmentSop[]>>(
      '/department-sops',
      { ...departmentParams(context), department_id: departmentId },
    ),

  /**
   * FormData, because an SOP can carry a document.
   *
   * Sent as POST with _method=PUT on update: PHP does not populate $_FILES for
   * PUT request bodies, so a real PUT would arrive with the file missing.
   */
  saveDepartmentSop: (
    context: LaravelContext,
    data: Record<string, string | File | undefined>,
    id?: string,
  ) => {
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => appendDefined(formData, key, value))
    const query = new URLSearchParams(departmentParams(context)).toString()
    return ensureLaravelSuccess(apiClient.postForm<LaravelStatusResponse<DepartmentSop>>(
      id ? `/department-sops/${id}?${query}` : `/department-sops?${query}`,
      formData,
    ))
  },

  deleteDepartmentSop: (context: LaravelContext, id: string) =>
    ensureLaravelSuccess(apiClient.delete<LaravelStatusResponse>(
      `/department-sops/${id}?${new URLSearchParams(departmentParams(context)).toString()}`,
    )),

  /** Real file download. Replaces a handler that fabricated a text blob. */
  departmentSopDownloadUrl: (context: LaravelContext, id: string) =>
    buildApiUrl(`/department-sops/${id}/download`, departmentParams(context)),

  getDepartmentPolicies: (context: LaravelContext, departmentId: string) =>
    apiClient.get<LaravelStatusResponse<DepartmentContentRecord[]>>(
      '/department-policies',
      { ...departmentParams(context), department_id: departmentId },
    ),

  saveDepartmentPolicy: (
    context: LaravelContext,
    data: Record<string, unknown>,
    id?: string,
  ) => {
    const query = new URLSearchParams(departmentParams(context)).toString()
    return ensureLaravelSuccess(id
      ? apiClient.put<LaravelStatusResponse<DepartmentContentRecord>>(`/department-policies/${id}?${query}`, data)
      : apiClient.post<LaravelStatusResponse<DepartmentContentRecord>>(`/department-policies?${query}`, data))
  },

  deleteDepartmentPolicy: (context: LaravelContext, id: string) =>
    ensureLaravelSuccess(apiClient.delete<LaravelStatusResponse>(
      `/department-policies/${id}?${new URLSearchParams(departmentParams(context)).toString()}`,
    )),

  getDepartmentRules: (context: LaravelContext, departmentId: string) =>
    apiClient.get<LaravelStatusResponse<DepartmentRule[]>>(
      '/department-rules',
      { ...departmentParams(context), department_id: departmentId },
    ),

  /** Categories actually in use, seeded with the five the UI used to hardcode. */
  getDepartmentRuleCategories: (context: LaravelContext) =>
    apiClient.get<LaravelStatusResponse<string[]>>('/department-rules/categories', departmentParams(context)),

  saveDepartmentRule: (
    context: LaravelContext,
    data: Record<string, unknown>,
    id?: string,
  ) => {
    const query = new URLSearchParams(departmentParams(context)).toString()
    return ensureLaravelSuccess(id
      ? apiClient.put<LaravelStatusResponse<DepartmentRule>>(`/department-rules/${id}?${query}`, data)
      : apiClient.post<LaravelStatusResponse<DepartmentRule>>(`/department-rules?${query}`, data))
  },

  deleteDepartmentRule: (context: LaravelContext, id: string) =>
    ensureLaravelSuccess(apiClient.delete<LaravelStatusResponse>(
      `/department-rules/${id}?${new URLSearchParams(departmentParams(context)).toString()}`,
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

export { rolePermissionsService } from './role-permissions'
export type { RightsRow, RightsMenu, UserProfile } from './role-permissions'
