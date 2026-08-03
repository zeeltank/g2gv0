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

export interface EmployeeProfileResponse {
  id: number
  name: string
  email: string
  jobrole: string
  department: string
  skills: EmployeeSkill[]
  [key: string]: unknown
}

export const employeeService = {
  getEmployeeProfile: (context: LaravelContext, orgType?: string, userProfileName?: string) =>
    webClient.get<EmployeeProfileResponse>('/user/add_user', withLaravelParams(context, {
      org_type: orgType ?? context.orgType,
      ...(userProfileName ? { user_profile_name: userProfileName } : {}),
    })),
}