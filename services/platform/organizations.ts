import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'

/**
 * Creating an organisation — the internal operator's endpoint.
 *
 * ── ONE CALL, NOT TWO ───────────────────────────────────────────────────────
 *
 * This used to be `POST /api/school-setup` followed by `POST /api/user-signup`,
 * both anonymous, with a database lookup in between to find the profile id the
 * second one needed. Nothing correlated them and neither was transactional, so a
 * failure on the second left an organisation nobody could sign into.
 *
 * `POST /api/platform/organizations` does the whole thing in one transaction and
 * returns the profile ids, so this file never has to go looking for anything.
 *
 * ── WHO CAN CALL IT ─────────────────────────────────────────────────────────
 *
 * `platform.owner` — a row in `platform_owners`, not any tenant role. An
 * ordinary administrator receives 404, deliberately: there is no reason to tell
 * them a tenant-creation endpoint exists.
 */

export type PlatformOrganization = {
  id: number
  name: string
  short_code: string | null
  email: string | null
  industry: string | null
  created_at: string | null
  expires_on: string | null
  people: number
  departments: number
}

export type CreateOrganizationInput = {
  name: string
  short_code?: string
  contact_person?: string
  mobile?: string
  email?: string
  industry?: string
  admin_first_name: string
  admin_last_name?: string
  admin_email: string
  admin_mobile?: string
  admin_password: string
}

export type CreateOrganizationResponse = {
  status: boolean
  message: string
  data: {
    tenant_id: number
    name: string
    short_code: string
    admin_user_id: number
    admin_email: string
    profiles: Record<string, number>
    rights_granted: number
  }
}

function params(context: LaravelContext) {
  return {
    ...(context.token ? { type: 'api', token: context.token } : {}),
  }
}

export const platformOrganizationsService = {
  list: (context: LaravelContext) =>
    apiClient.get<{ status: boolean; data: { organizations: PlatformOrganization[] } }>(
      '/platform/organizations',
      params(context),
    ),

  create: (context: LaravelContext, input: CreateOrganizationInput) =>
    apiClient.post<CreateOrganizationResponse>('/platform/organizations', {
      ...params(context),
      ...input,
    }),
}
