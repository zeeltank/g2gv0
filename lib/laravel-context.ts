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

let lastContext: LaravelContext | null = null

/** The same object is returned while nothing in it has changed, so hooks that depend on it do not re-run on every render. */
function stable(next: LaravelContext): LaravelContext {
  if (lastContext && (Object.keys(next) as (keyof LaravelContext)[]).every((k) => lastContext![k] === next[k])) return lastContext
  lastContext = next
  return next
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
    return stable({ ...EMPTY_CONTEXT, userId: toParam(user?.id) })
  }

  return stable({
    token: toParam(session.token),
    subInstituteId: toParam(session.sub_institute_id),
    syear: toParam(session.syear),
    userId: toParam(session.user_id) || toParam(user?.id),
    organizationId: toParam(session.org_id),
    orgType: toParam(session.org_type),
    profileId: toParam(session.user_profile_id),
  })
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
