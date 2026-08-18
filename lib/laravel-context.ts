import type { User } from '@/components/auth/gtg-auth'
import { readLaravelSession } from '@/lib/laravel-session'

export type LaravelContext = {
  token: string
  subInstituteId: string
  syear: string
  userId: string
  organizationId: string
  orgType: string
  profileId: string
}

const EMPTY_CONTEXT: LaravelContext = {
  token: '',
  subInstituteId: '',
  syear: '',
  userId: '',
  organizationId: '',
  orgType: '',
  profileId: '',
}

function toParam(value: string | number | null | undefined) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

/**
 * Resolves the tenant coordinates Laravel expects on every request.
 *
 * These come exclusively from the session that GET /login?type=API returned and
 * that `saveLaravelSession` persisted. There are deliberately no defaults: a
 * hardcoded sub_institute_id / token would silently point every browser at the
 * same tenant with one shared credential.
 */
export function getLaravelContext(user?: User | null): LaravelContext {
  const session = readLaravelSession()

  if (!session) {
    return { ...EMPTY_CONTEXT, userId: toParam(user?.id) }
  }

  return {
    token: toParam(session.token),
    subInstituteId: toParam(session.sub_institute_id),
    syear: toParam(session.syear),
    userId: toParam(session.user_id) || toParam(user?.id),
    organizationId: toParam(session.org_id),
    orgType: toParam(session.org_type),
    profileId: toParam(session.user_profile_id),
  }
}

/** Guard for callers that must not fire a request before the user has logged in. */
export function isLaravelContextReady(context: LaravelContext): boolean {
  return Boolean(context.token && context.subInstituteId && context.userId)
}

export function withLaravelParams(context: LaravelContext, extra?: Record<string, string>) {
  return {
    token: context.token,
    sub_institute_id: context.subInstituteId,
    syear: context.syear,
    financial_year: context.syear,
    user_id: context.userId,
    organization_id: context.organizationId,
    org_type: context.orgType,
    profile_id: context.profileId,
    type: 'API',
    ...extra,
  }
}
