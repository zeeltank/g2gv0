/**
 * Employee Service
 * API calls for fetching employee profile data
 */

import { webClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

export interface EmployeeSkill {
  jobrole_skill_id: number
  jobrole: string
  skill: string
  skill_id: number
  title?: string
  category?: string
  sub_category?: string
  description?: string
  proficiency_level?: string
  knowledge?: string[]
  ability?: string[]
  behaviour?: string[]
  attitude?: string[]
}

/**
 * The signed-in employee's own record.
 *
 * The extra fields below were always in the response - /user/add_user returns
 * the tbluser row - but nothing was declared, so the profile screen fell back
 * to a fixture for everything except name and email. They are named here so
 * the screen can show the person their own details.
 *
 * All optional: tbluser has 99 columns and most are nullable, so a field
 * being absent is ordinary and must render as absent rather than as somebody
 * else's value.
 */
export interface EmployeeProfileResponse {
  id: number
  name: string
  email: string
  jobrole: string
  department: string
  skills: EmployeeSkill[]

  first_name?: string | null
  last_name?: string | null
  mobile?: string | null
  gender?: string | null
  birthdate?: string | null
  joined_date?: string | null
  employee_id?: string | null
  employee_no?: string | null

  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null

  bank_name?: string | null
  branch_name?: string | null
  account_no?: string | null
  ifsc_code?: string | null

  [key: string]: unknown
}

export const employeeService = {
  getEmployeeProfile: (context: LaravelContext, orgType?: string, userProfileName?: string) =>
    webClient.get<EmployeeProfileResponse>('/user/add_user', withLaravelParams(context, {
      org_type: orgType ?? context.orgType,
      ...(userProfileName ? { user_profile_name: userProfileName } : {}),
    })),
}