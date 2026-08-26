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

/**
 * Result of a bulk employee move.
 *
 * Always HTTP 200 with a verdict per employee - a refusal on one row (wrong
 * tenant, already in the department) never aborts the others, so the caller can
 * report exactly what moved and what did not.
 */
/**
 * A job role in the tenant's catalogue.
 *
 * s_user_jobrole is a per-department catalogue of role definitions, not a
 * user-to-role mapping - it has no user_id. An employee points AT one of these
 * through tbluser.allocated_standards (or jobtitle_id).
 */
export type DepartmentJobRole = {
  id: number
  jobrole: string
  description?: string | null
  jobrole_category?: string | null
  department_id?: number | null
  department_name?: string | null
}

/**
 * What a job role merge would do, before it does it.
 *
 * `level_raises` and `ambiguous` are the two the caller MUST show. The first
 * says the merged role will demand MORE than the target does today; the second
 * says some rows will be left behind because the retired role's name is used in
 * more than one department and cannot be attributed. Both change what the user
 * is agreeing to.
 */
export type JobRoleMergeImpact = {
  total: number
  breakdown: Array<{ label: string; count: number }>
  level_raises: Array<{ kind: 'competency' | 'skill'; name: string; from: string | number | null; to: string | number | null }>
  duplicates: { tasks: number; skills: number }
  ambiguous: Array<{ table: string; count: number }>
  jobrole?: string
  department?: string
  target?: string | null
}

export type JobRoleMergeResponse = LaravelStatusResponse & {
  data?: {
    moved?: Record<string, number>
    employees?: number
    competencies_raised?: number
    skills_raised?: number
    tasks_folded?: number
    skills_folded?: number
    new_role_id?: number
  }
}

/**
 * What is attached to a department.
 *
 * `blocking` marks the LMS rows: they carry a real foreign key, so they are
 * why a delete is refused and why merge is offered instead.
 */
export type DepartmentImpact = {
  total: number
  sub_departments: number
  lms_blocking: number
  department?: string
  breakdown: Array<{ label: string; count: number; blocking: boolean }>
}

export type DepartmentMergeResponse = LaravelStatusResponse & {
  data?: {
    moved?: Record<string, number>
    employees?: number
    job_roles_folded?: number
    children?: number
  }
}

export type BulkEmployeeResponse = LaravelStatusResponse & {
  applied?: number
  refused?: number
  rows?: Array<{ index: number; user_id: number; ok: boolean; reason: string | null }>
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
  /**
   * The employee's current department name, resolved by the API's LEFT JOIN.
   *
   * It was already being returned and already being read by the HOD picker,
   * but was missing from this type - so the picker's subtitle silently fell
   * through to "No department" for everyone.
   */
  department_name?: string | null
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

  /**
   * What is attached to a department, before anything is done to it.
   *
   * `mode` genuinely changes the answer: delete cascades to the subtree, merge
   * moves only this department (its children are re-parented and keep their
   * own data). A GET, so it is NOT wrapped in ensureLaravelSuccess - the
   * caller distinguishes "failed to load" from "zero", which matters when the
   * number is about to justify a destructive action.
   */
  getDepartmentImpact: (context: LaravelContext, id: string, mode: 'delete' | 'merge') =>
    apiClient.get<{ status?: number; data?: DepartmentImpact }>(
      `/departments-management/${id}/impact`,
      { ...departmentParams(context), mode },
    ),

  /** Move everything into another department, then retire this one. */
  mergeDepartment: (context: LaravelContext, id: string, targetDepartmentId: string) =>
    ensureLaravelSuccess(apiClient.post<DepartmentMergeResponse>(
      `/departments-management/${id}/merge?${new URLSearchParams(departmentParams(context)).toString()}`,
      { target_department_id: Number(targetDepartmentId) },
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

  /**
   * Tenant employees.
   *
   * No filter = the head-of-department picker. `department_id` = that
   * department's current staff, for transfers. `unassigned` = employees with
   * no department at all, which nothing in the app could list before: the
   * generic /table_data reader builds `where(column, value)` and so cannot
   * express "department_id IS NULL".
   */
  getDepartmentCandidates: (
    context: LaravelContext,
    options: { search?: string; departmentId?: string; unassigned?: boolean } = {},
  ) =>
    apiClient.get<LaravelStatusResponse<LaravelDepartmentEmployee[]>>(
      '/departments-management/employees',
      {
        ...departmentParams(context),
        ...(options.search ? { search: options.search } : {}),
        ...(options.departmentId ? { department_id: options.departmentId } : {}),
        ...(options.unassigned ? { unassigned: '1' } : {}),
      },
    ),

  /**
   * Job roles belonging to a department.
   *
   * `/jobroles-by-department` is the only tenant-scoped job role list in the
   * app. The two department-named alternatives (`/department/{id}/jobroles`
   * and `/department-jobroles`) both query `s_jobrole` by `track` - a different
   * table, keyed on something that is not a department - and neither is
   * tenant-scoped.
   */
  /**
   * What a merge would move, and what it would decide.
   *
   * Deliberately NOT wrapped in ensureLaravelSuccess, for the same reason
   * getDepartmentImpact is not: the dialog has to be able to tell "the preview
   * failed to load" from "there is nothing attached". Rendering a failed fetch
   * as a confident zero is how someone confirms a merge they would have
   * refused.
   *
   * Takes a target, unlike the department version - for job roles the
   * collisions decide which proficiency level the surviving role requires, so
   * a preview without a target hides the actual decision.
   */
  getJobRoleMergeImpact: (context: LaravelContext, jobRoleId: string, targetJobRoleId: string) =>
    apiClient.get<{ status?: number; message?: string; data?: JobRoleMergeImpact }>(
      `/competency/library/jobroles/${jobRoleId}/merge-impact`,
      { ...departmentParams(context), target_id: targetJobRoleId },
    ),

  /**
   * Merge a job role into another, or into a new one.
   *
   * Pass `targetJobRoleId` to fold it into a role that already exists, or
   * `newJobRoleName` plus the full `sourceJobRoleIds` list to create the
   * survivor as part of the same transaction.
   */
  mergeJobRole: (
    context: LaravelContext,
    jobRoleId: string,
    payload: { targetJobRoleId?: string; newJobRoleName?: string; sourceJobRoleIds?: string[] },
  ) =>
    ensureLaravelSuccess(apiClient.post<JobRoleMergeResponse>(
      `/competency/library/jobroles/${jobRoleId}/merge?${new URLSearchParams(departmentParams(context)).toString()}`,
      {
        ...(payload.targetJobRoleId ? { target_jobrole_id: Number(payload.targetJobRoleId) } : {}),
        ...(payload.newJobRoleName ? { new_jobrole_name: payload.newJobRoleName } : {}),
        ...(payload.sourceJobRoleIds ? { source_jobrole_ids: payload.sourceJobRoleIds.map(Number) } : {}),
      },
    )),

  getDepartmentJobRoles: (context: LaravelContext, departmentId: string) =>
    apiClient.get<{ status?: number; department_id?: number; department_name?: string; data?: DepartmentJobRole[] }>(
      '/jobroles-by-department',
      { ...departmentParams(context), department_id: departmentId },
    ),

  /** Per-employee verdicts; one refusal never aborts the batch. */
  assignDepartmentEmployees: (
    context: LaravelContext,
    departmentId: string,
    userIds: Array<string | number>,
    extra: { effective_date?: string; remarks?: string; jobrole_id?: string | number } = {},
  ) =>
    ensureLaravelSuccess(apiClient.post<BulkEmployeeResponse>(
      `/departments-management/${departmentId}/employees?${new URLSearchParams(departmentParams(context)).toString()}`,
      { user_ids: userIds.map(Number), ...extra },
    )),

  unassignDepartmentEmployees: (
    context: LaravelContext,
    departmentId: string,
    userIds: Array<string | number>,
  ) =>
    ensureLaravelSuccess(apiClient.post<BulkEmployeeResponse>(
      `/departments-management/${departmentId}/employees?${new URLSearchParams({
        ...departmentParams(context),
        _method: 'DELETE',
      }).toString()}`,
      { user_ids: userIds.map(Number) },
    )),

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

export { employeeDirectoryService, WORKING_DAYS } from './employee-directory'
export type {
  DirectoryEmployee,
  DirectoryEmployeeDetail,
  ReferenceData,
  ScheduleEntry,
  WorkingDay,
  ListMeta,
  EmployeeFilters,
  CreateEmployeeResult,
} from './employee-directory'
