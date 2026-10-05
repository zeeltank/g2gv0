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
  /**
   * The legal form: Private Limited, LLP, Partnership and so on.
   *
   * A real column since 2026_09_24. Before that the screen declared it as the
   * constant 'Private Limited' and rendered that for all twelve organisations,
   * while the edit dropdown's value was silently discarded on save.
   */
  organization_type?: string | null
  /** UDYAM-XX-00-0000000. Nothing in either repository held this before. */
  udyam_registration_no?: string | null
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

/**
 * An organisation's own identity, from `school_setup` - the table that has a row
 * for every tenant.
 *
 * Three tables describe an organisation and they disagree about how many exist:
 * `school_setup` 12 rows on live, `org_details` 4, `institute_detail` 5. So the
 * logo and name cannot be read from `org_details` - for eight of twelve tenants it
 * is absent, which is why the organisation screen showed a monogram where a logo
 * had been uploaded.
 *
 * `logo_url` is built by the server, so the screen never has to know which bucket
 * or folder the file lives in.
 */
export type OrganizationIdentity = {
  name: string | null
  short_code: string | null
  logo: string | null
  logo_url: string | null
  contact_person: string | null
  mobile: string | null
  email: string | null
  institute_type: string | null
  /**
   * The public careers address: /careers/{slug}.
   *
   * NULL for a tenant with no `institute_detail` row, which is most of them -
   * that table has 5 rows against `school_setup`'s 12. A null slug means the
   * organisation has no careers page at all, so anything that would build a
   * URL from it must treat the feature as unavailable rather than produce a
   * link that 404s.
   */
  careers_slug: string | null
  /**
   * Active employees, COUNTED by the server on every load.
   *
   * Not `org_details.employee_count`, which is a free-text band somebody typed
   * once: it was wrong for every organisation that had one (Scholar Clone holds
   * 12 people and said "1-10"), NULL for the other seven, and the screen wrote
   * the literal string "null" into it on every save - so the field could never
   * recover once saved even a single time.
   *
   * Same definition the dashboards use (active, not soft-deleted), so the two
   * cannot disagree.
   */
  employee_count?: number | null
}

export type OrganizationProfileResponse = {
  /*
   * Kept as an array of one, which is the shape the web route returned and the
   * shape the screen already destructures. The API answers with a single object;
   * the service wraps it rather than making every consumer change at once.
   */
  org_data?: LaravelOrgDetail[]
  /** Absent only if the server predates this field. */
  identity?: OrganizationIdentity
  /**
   * The legal forms an organisation may be, from the server.
   *
   * Served with the profile rather than from a lookup table: these are a closed,
   * country-level set that changes with company law, not tenant data. The screen
   * used to hardcode four of them and discard whichever was chosen.
   */
  organisation_types?: string[]
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
  /**
   * How many people hold this role, served with the list.
   *
   * The drawer has always rendered a badge for this and never had the number, so
   * the badge never appeared. It is also what tells somebody whether a role is
   * safe to delete before they try.
   */
  employee_count?: number
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
  /**
   * The organisation's profile, from the API.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * THIS USED TO CALL A ROUTE THIS APP CANNOT AUTHENTICATE AGAINST
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * It was `webClient.get('/settings/organization_data')` - a Laravel WEB route
   * behind `['auth','session','menu']`, which needs the ERP's browser session
   * cookie. The Next.js app authenticates with a Sanctum token and has no such
   * session, so this call depended on a cookie that may or may not be there.
   *
   * `GET /api/organization/profile` is the token-authenticated replacement. It has
   * existed and been role-gated since the organisation audit, and until now
   * nothing called it.
   *
   * ── THE RESPONSE IS RESHAPED HERE, NOT IN THE SCREEN ────────────────────────
   *
   * The API answers `{ data: { profile, sister_companies, identity } }`; the screen
   * reads `org_data[0]`. Mapping in the service keeps the switch to one file
   * instead of rewriting every consumer, and `sister_companies` is folded onto the
   * profile under the name the screen already looks for.
   */
  getOrganizationProfile: async (context: LaravelContext): Promise<OrganizationProfileResponse> => {
    const response = await apiClient.get<{
      status: boolean
      data: {
        profile: LaravelOrgDetail | null
        sister_companies?: LaravelSisterOrg[]
        identity?: OrganizationIdentity
        organisation_types?: string[]
      }
    }>('/organization/profile', withLaravelParams(context))

    const profile = response.data?.profile ?? null

    return {
      // An empty array when there is no statutory record yet - which is the case
      // for eight of twelve live organisations. `org_data?.[0]` is then undefined,
      // exactly as it was when the web route returned nothing.
      org_data: profile
        ? [{ ...profile, sisters_org: response.data?.sister_companies ?? [] }]
        : [],
      identity: response.data?.identity,
      organisation_types: response.data?.organisation_types,
    }
  },

  /**
   * Save the organisation's profile, through the API.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * THE READ WAS MIGRATED AND THE WRITE WAS LEFT BEHIND
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * This posted to `/settings/organization_data` - the legacy WEB route - while
   * the read had already moved to the API. Two controllers, two behaviours, on
   * one screen:
   *
   *   - The legacy `store()` writes EVERY column unconditionally from the request,
   *     so any field the payload omits is written NULL. The screen worked around
   *     that by resending the entire record on every save, which is why a single
   *     edit posts thirty fields.
   *   - Its 422 branch calls `->first()->first()` on a string, so ANY validation
   *     failure is a 500 rather than a message. Nobody could ever be told that a
   *     website URL was malformed; they got a server error.
   *   - It is gated `hrit.role:admin`, so HR can read this screen and their save
   *     takes a stricter path than the one designed for it.
   *
   * `OrganizationProfileController::save()` has existed the whole time -
   * transactional, validated per field, sister companies handled inside the
   * transaction - and nothing called it.
   *
   * Still multipart, because the logo is a file and a file cannot go in a JSON
   * body. Same endpoint as the read, so the two cannot drift again.
   */
  /**
   * The industries an organisation can be classified as.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * THIS ENDPOINT HAS EXISTED THE WHOLE TIME WITH NO CALLER
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * `s_industries` is a 43-row global taxonomy - industry, department,
   * sub-department - and `GET /industries` has served it, token-authenticated,
   * since before this screen was written. A search of the frontend for it finds
   * one hit, in a static catalogue file, and no call site.
   *
   * So the organisation profile hardcoded three options and injected the stored
   * value as a fourth to stop a save wiping it. An organisation whose real
   * industry is "Information Technology" saw a dropdown reading
   * [Information Technology, Manufacturing, Healthcare, Finance].
   *
   * The precedent for fixing it is already in this repository: the Build-with-AI
   * course form had the same problem and now calls `/lms/ai/scope-options`.
   */
  getIndustries: (context: LaravelContext) =>
    apiClient.get<{ data?: { industries?: string | null }[] }>(
      '/industries',
      departmentParams(context),
    ),

  saveOrganizationProfile: (context: LaravelContext, data: Record<string, string | File | undefined>) => {
    const formData = new FormData()
    Object.entries(withLaravelParams(context)).forEach(([key, value]) => {
      appendDefined(formData, key, value)
    })
    Object.entries(data).forEach(([key, value]) => appendDefined(formData, key, value))

    return apiClient.postForm<{ status: boolean; message?: string }>(
      '/organization/profile',
      formData,
    )
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
  /**
   * Create a job role INSIDE a department.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * WHY THIS SENDS department_id AND THE LIBRARY FORM DOES NOT
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Capability Library sends the department by NAME, and the server resolves it
   * to an id at write time - leaving `department_id` NULL when the name matches
   * nothing or matches more than one thing. Live has 557 ambiguous
   * (tenant, name) department groups covering 1,120 rows.
   *
   * A role that lands with a NULL `department_id` then never appears in this
   * drawer at all, because the drawer lists by `department_id`. It is created,
   * it exists, and it is invisible exactly where somebody went looking for it.
   *
   * Creating from the drawer cannot hit that: the id is the thing we already have.
   */
  createDepartmentJobRole: (
    context: LaravelContext,
    departmentId: string,
    payload: { jobrole: string; description?: string; jobrole_category?: string },
  ) =>
    apiClient.post<{ status: number; message?: string; data?: DepartmentJobRole }>(
      '/competency/library/jobroles',
      { ...departmentParams(context), department_id: departmentId, ...payload },
    ),

  /**
   * What deleting a job role would cost — asked before the dialog opens.
   *
   * The delete refuses on its own when somebody holds the role; this is what lets
   * the dialog say so beforehand rather than after the click.
   */
  getJobRoleDeleteImpact: (context: LaravelContext, jobRoleId: number) =>
    apiClient.get<{
      status: number
      data?: { id: number; holders: number; holder_names: string[]; can_delete: boolean }
    }>(`/competency/library/jobroles/${jobRoleId}/impact`, departmentParams(context)),

  /**
   * Delete a job role. Soft, and refused with 409 when people hold it.
   *
   * The 409 is not an error to swallow — its body names the holders, and that is
   * the only actionable thing in the whole interaction.
   */
  deleteJobRole: (context: LaravelContext, jobRoleId: number) =>
    apiClient.delete<{ status: number; message?: string }>(
      `/competency/library/jobroles/${jobRoleId}`,
      departmentParams(context),
    ),

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
