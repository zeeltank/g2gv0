import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'

/**
 * The Employee Directory's API client.
 *
 * Talks to /api/employees-management (HRMS\EmployeeDirectoryController), the
 * sibling of /api/departments-management. Deliberately NOT the legacy
 * /user/add_user web route the screen used to call directly with a raw fetch:
 * that one is session-shaped, returned all 99 tbluser columns per employee
 * (including the cleartext plain_password), and had no create path an API
 * caller could reach.
 *
 * apiClient, not webClient - these are routes/api.php routes, and apiClient
 * attaches the bearer token from the stored session on every request, so the
 * token never goes in a query string.
 */

/** One row of the directory list. */
export type DirectoryEmployee = {
  id: number
  first_name: string | null
  middle_name: string | null
  last_name: string | null
  full_name: string | null
  email: string | null
  mobile: string | null
  image: string | null
  employee_no: string | null
  employee_id: string | null
  department_id: number | null
  allocated_standards: string | null
  jobtitle_id: number | null
  user_profile_id: number | null
  status: number
  joined_date: string | null
  city: string | null
  state: string | null
  supervisor_opt: number | null
  profile_name: string | null
  department_name: string | null
  jobrole: string | null
  jobrole_id: number | null
}

/** The single-employee shape adds the fields the drawer edits. */
export type DirectoryEmployeeDetail = DirectoryEmployee & {
  name_suffix: string | null
  gender: string | null
  birthdate: string | null
  subject_ids: number | null
  address: string | null
  address_2: string | null
  pincode: string | null
  reporting_method: string | null
  bank_name: string | null
  branch_name: string | null
  qualification: string | null
} & Record<WorkingDay, number>
  & Partial<Record<`${WorkingDay}_in_date` | `${WorkingDay}_out_date`, string | null>>

export type WorkingDay =
  | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export const WORKING_DAYS: WorkingDay[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
]

/** One row of the per-day attendance grid, as the API takes it. */
export type ScheduleEntry = {
  day: WorkingDay
  working: boolean
  /** "HH:mm". Null when the day is not worked. */
  in_time: string | null
  out_time: string | null
}

export type ReferenceData = {
  departments: { id: number; name: string; parent_id: number | null }[]
  job_roles: { id: number; name: string; department_id: number | null; category: string | null }[]
  user_profiles: { id: number; name: string }[]
  levels_of_responsibility: { id: number; level: number; guiding_phrase: string | null }[]
  managers: { id: number; first_name: string | null; last_name: string | null; employee_no: string | null }[]
  next_employee_no: string
  default_schedule: ScheduleEntry[]
}

/**
 * The list's own answer to "why is this empty?".
 *
 * `empty_is_expected` distinguishes "this organisation has no employees" from
 * "no employee matches these filters" - two different things that the old
 * screen rendered identically, when it rendered them at all.
 */
export type ListMeta = {
  total: number
  empty_is_expected: boolean
  empty_reason: string | null
}

export type EmployeeListResponse = {
  status: number
  message: string
  data: DirectoryEmployee[]
  meta: ListMeta
}

export type CreateEmployeeResult = {
  id: number
  email: string
  invite_sent: boolean
  invite_error: string | null
}

export type EmployeeFilters = {
  q?: string
  departmentId?: string
  jobroleId?: string
  /** '0' | '1' | '' - kept as a string so '0' survives the truthiness check. */
  status?: string
}

type StatusResponse = { status?: number | string; status_code?: number | string; message?: string }

/**
 * Mutations throw on a Laravel-level failure; GETs deliberately do not.
 *
 * Same split as the department service: a read that comes back empty is a
 * legitimate answer the caller has to be able to render, while a write that
 * did not happen must not look like one that did.
 */
async function ensureSuccess<T extends StatusResponse>(request: Promise<T>): Promise<T> {
  const response = await request
  const status = response.status ?? response.status_code
  if (String(status) === '0') {
    throw new Error(response.message || 'The request was refused.')
  }
  return response
}

/**
 * Only the filters that are actually set.
 *
 * Every value stays a string on purpose: the backend tests `filled('status')`,
 * and a numeric 0 would be dropped here by the truthiness check while the
 * string '0' survives - which is the difference between "show inactive
 * employees" and "show everyone".
 */
function listParams(context: LaravelContext, filters: EmployeeFilters = {}) {
  return {
    sub_institute_id: context.subInstituteId,
    ...(context.token ? { type: 'api', token: context.token } : {}),
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.departmentId ? { department_id: filters.departmentId } : {}),
    ...(filters.jobroleId ? { jobrole_id: filters.jobroleId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  }
}

function baseParams(context: LaravelContext) {
  return {
    sub_institute_id: context.subInstituteId,
    ...(context.token ? { type: 'api', token: context.token } : {}),
  }
}

/** apiClient.patch takes no options, so its params ride on the URL. */
function query(context: LaravelContext) {
  return new URLSearchParams(baseParams(context)).toString()
}

export const employeeDirectoryService = {
  list: (context: LaravelContext, filters?: EmployeeFilters) =>
    apiClient.get<EmployeeListResponse>('/employees-management', listParams(context, filters)),

  referenceData: (context: LaravelContext) =>
    apiClient.get<{ status: number; data: ReferenceData }>(
      '/employees-management/reference-data',
      baseParams(context),
    ),

  get: (context: LaravelContext, id: number | string) =>
    apiClient.get<{ status: number; data: DirectoryEmployeeDetail }>(
      `/employees-management/${id}`,
      baseParams(context),
    ),

  create: (context: LaravelContext, payload: Record<string, unknown>) =>
    ensureSuccess(
      apiClient.post<StatusResponse & { data: CreateEmployeeResult }>(
        '/employees-management',
        payload,
        { params: baseParams(context) },
      ),
    ),

  update: (context: LaravelContext, id: number | string, payload: Record<string, unknown>) =>
    ensureSuccess(
      apiClient.put<StatusResponse & { data: DirectoryEmployeeDetail }>(
        `/employees-management/${id}`,
        payload,
        { params: baseParams(context) },
      ),
    ),

  setStatus: (context: LaravelContext, id: number | string, status: 0 | 1, reason?: string) =>
    ensureSuccess(
      apiClient.patch<StatusResponse>(
        `/employees-management/${id}/status?${query(context)}`,
        { status, reason },
      ),
    ),

  invite: (context: LaravelContext, id: number | string) =>
    ensureSuccess(
      apiClient.post<StatusResponse>(
        `/employees-management/${id}/invite`,
        {},
        { params: baseParams(context) },
      ),
    ),
}
