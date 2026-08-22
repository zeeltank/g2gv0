import { apiClient } from '@/services/core'
import { getLaravelContext, type LaravelContext } from '@/lib/laravel-context'

/**
 * Rate a KASBA library item for one employee.
 *
 * WHY NOT THE EXISTING RATING CALL. `updateSkillRating` in
 * employee-profile-service PUTs `{proficiency_level}` to
 * /competency/employee-profiles/{id}/skills/{matrixId}, and it has never
 * worked: the validator there requires `skill_level`, so every call 422s, and
 * the id it sends is a KABA catalogue id where the route wants an
 * s_skill_matrix row id scoped to that user - so it would 404 even once the
 * field name were fixed. Neither the drawer nor its handler awaited or caught
 * the promise, so the dot lit up and stayed lit on a rating that was never
 * stored.
 *
 * This calls the endpoint built for the job. It is keyed on
 * (kasba_type, item_id) - the pair the UI actually holds, because
 * /get-kaba returns library rows - and it upserts, so it works for the ~97%
 * of employees who have no rating row yet.
 */

export type KasbaType = 'skill' | 'knowledge' | 'ability' | 'attitude' | 'behaviour'

export type KasbaRatingResult = {
  kasba_type: KasbaType
  item_id: number
  user_id: number
  title: string
  competencies_hit: number
  /** False when the item is in no competency: the rating is saved, but scores it. */
  rolls_up: boolean
  notice: string | null
}

export async function rateKasbaItem(
  input: {
    userId: number | string
    kasbaType: KasbaType
    itemId: number | string
    rating: number
    note?: string
  },
  context?: LaravelContext,
): Promise<KasbaRatingResult> {
  const ctx = context || getLaravelContext()

  const response = await apiClient.post<{
    status: number
    message: string
    data: KasbaRatingResult
  }>('/competency/kasba-rating/by-item', {
    user_id: Number(input.userId),
    kasba_type: input.kasbaType,
    item_id: Number(input.itemId),
    rating: input.rating,
    ...(input.note ? { note: input.note } : {}),
  }, {
    params: {
      sub_institute_id: ctx.subInstituteId,
      ...(ctx.token ? { type: 'api', token: ctx.token } : {}),
    },
  })

  if (String(response?.status) === '0') {
    throw new Error(response?.message || 'The rating was refused.')
  }

  return response.data
}

/**
 * Persist the Jobrole Skill tab's confirmed knowledge/ability/attitude/
 * behaviour statements for one skill.
 *
 * Upserts on (user_id, skill_id), so it works for the ~97% of employees who
 * have no s_skill_matrix row yet and the client never has to know a matrix id.
 */
export async function saveSkillConfirmations(
  userId: number | string,
  skillId: number | string,
  confirmed: {
    knowledge?: number[]
    ability?: number[]
    attitude?: number[]
    behaviour?: number[]
  },
  context?: LaravelContext,
): Promise<{ matrix_id: number; skill_id: number; title: string }> {
  const ctx = context || getLaravelContext()

  const response = await apiClient.put<{
    status: number
    message: string
    data: { matrix_id: number; skill_id: number; title: string }
  }>(`/competency/employee-profiles/${userId}/skills/by-skill/${skillId}`, confirmed, {
    params: {
      sub_institute_id: ctx.subInstituteId,
      ...(ctx.token ? { type: 'api', token: ctx.token } : {}),
    },
  })

  if (String(response?.status) === '0') {
    throw new Error(response?.message || 'The assessment was refused.')
  }

  return response.data
}
