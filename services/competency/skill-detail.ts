/**
 * Detail payloads for the library popup.
 *
 * Two shapes, because the two kinds of row are wired up differently:
 *
 *   Skills — `GET /skill_library/{id}/edit` already assembles proficiency
 *   levels, knowledge / ability / application grouped by level, mapped job
 *   roles, attitude and behaviour in one round trip. Its name is a leftover
 *   from the Blade form it was written for; the payload is a read model.
 *
 *   Knowledge / ability / attitude / behaviour — `…/kasa/{type}/{id}/usage`
 *   answers where the item is actually used. The previous app's popup had
 *   panels for exactly this and never fetched any of it, so they rendered
 *   empty; the join it needed (s_skill_knowledge_ability) was there all along.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

/** One classified item: a knowledge topic, an ability, an application. */
export interface ClassificationItem {
  id: number
  skill_id: number
  proficiency_level: string | null
  proficiency_description: string | null
  classification: string
  classification_category: string | null
  classification_sub_category: string | null
  classification_item: string | null
}

/** Items bucketed under one proficiency level. */
export interface ProficiencyGroup {
  proficiency_level: number | string
  items: ClassificationItem[]
}

export interface MappedJobRole {
  id: number
  sector: string | null
  track: string | null
  jobrole: string
  skill?: string | null
  jobrole_category?: string | null
  description?: string | null
  proficiency_level: string | null
  proficiency_description: string | null
}

/** A declared proficiency level of a skill. */
export interface ProficiencyLevelRow {
  id: number
  proficiency_level: string | null
  description?: string | null
  proficiency_type?: string | null
  type_description?: string | null
  proficiency_description?: string | null
  classification?: string | null
  classification_item?: string | null
}

/** The row itself; columns vary per table, so the index signature stays. */
export interface DetailRow {
  id: number
  title?: string
  [key: string]: unknown
}

export interface SkillDetailResponse {
  editData: DetailRow | null
  skillName?: string
  userJobroleData: MappedJobRole[]
  userproficiency_levelData: ProficiencyLevelRow[]
  userAttitudeData: ClassificationItem[]
  userBehaviourData: ClassificationItem[]
  userKnowledgeData: ClassificationItem[]
  userabilityData: ClassificationItem[]
  userApplicationData: ClassificationItem[]
  /** Grouped by proficiency level, which is how the popup tabs them. */
  userViewKnowledge: ProficiencyGroup[]
  userViewAbility: ProficiencyGroup[]
  userViewApplication: ProficiencyGroup[]
}

/** One skill that references a KASA item, and at what level. */
export interface KasaUsageSkill {
  id: number
  skill_id: number
  proficiency_level: string | null
  classification_category: string | null
  classification_sub_category: string | null
  skill_title: string
  skill_category: string | null
  skill_sub_category: string | null
  skill_department: string | null
}

export interface KasaUsage {
  item: DetailRow
  skills: KasaUsageSkill[]
  jobroles: MappedJobRole[]
  levels: string[]
  skill_count: number
}

interface Envelope<T> {
  status: number
  message: string
  data: T
}

export const skillDetailService = {
  /**
   * `formType` selects the table: 'user' reads the tenant's own competencies
   * on s_users_skills, which is what every library screen shows.
   */
  get: (context: LaravelContext, skillId: number, formType: 'user' | 'admin' = 'user') =>
    apiClient.get<SkillDetailResponse>(`/skill_library/${skillId}/edit`, {
      type: 'API',
      token: context.token,
      sub_institute_id: context.subInstituteId,
      org_type: context.orgType,
      user_id: context.userId,
      formType,
    }),

  /** Where a knowledge / ability / attitude / behaviour item is used. */
  kasaUsage: (context: LaravelContext, type: string, id: number) =>
    apiClient.get<Envelope<KasaUsage>>(
      `/competency/library/kasa/${type}/${id}/usage`,
      withLaravelParams(context),
    ),
}
