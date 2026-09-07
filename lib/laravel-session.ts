/**
 * Laravel session store
 *
 * `authController::index` (GET /login?type=API) returns a `sessionData` bundle
 * holding the per-user Sanctum token plus the tenant coordinates
 * (sub_institute_id, syear, user_id) that every other Laravel endpoint expects.
 *
 * It is persisted under the `userData` key - the same key the Laravel-side
 * Next.js client uses - so `getLaravelContext` and any existing consumer read
 * one canonical location instead of falling back to hardcoded values.
 */

import { isRole, type Role } from '@/types/role'

export const LARAVEL_SESSION_KEY = 'userData'

/** Shape of `$sessionData` built in App\Http\Controllers\auth\authController. */
export interface LaravelSessionData {
  user_id: number | string
  user_name: string | null
  first_name: string | null
  last_name: string | null
  user_email: string | null
  user_image: string | null
  user_profile_name: string | null
  user_profile_id: number | string | null
  /**
   * `tbluserprofilemaster.role_key` — the stable role identifier. Added to the
   * login payload in HRIT Sprint 1 (F-104). Optional because a session stored
   * before that release will not have it; `mapProfileNameToRole` falls back to
   * an exact display-name match for those.
   */
  role_key?: string | null
  sub_institute_id: number | string
  birthdate: string | null
  employee_no: string | null
  org_name: string | null
  org_id: number | string | null
  org_short_code: string | null
  org_logo: string | null
  org_type: string | null
  year_title: string | null
  syear: number | string | null
  start_date: string | null
  end_date: string | null
  org_user: string | null
  APP_URL?: string | null
  token: string
}

export function readLaravelSession(): LaravelSessionData | null {
  if (typeof window === 'undefined') return null

  const raw =
    window.localStorage.getItem(LARAVEL_SESSION_KEY) ??
    window.sessionStorage.getItem(LARAVEL_SESSION_KEY)

  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<LaravelSessionData> | null
    if (!parsed || typeof parsed !== 'object' || !parsed.token) return null
    return parsed as LaravelSessionData
  } catch {
    return null
  }
}

export function saveLaravelSession(data: LaravelSessionData) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LARAVEL_SESSION_KEY, JSON.stringify(data))
}

export function clearLaravelSession() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(LARAVEL_SESSION_KEY)
  window.sessionStorage.removeItem(LARAVEL_SESSION_KEY)
}

/**
 * Profiles that predate `role_key`, matched EXACTLY on the lowercased display
 * name. Mirrors `App\Support\RoleKey::LEGACY_NAMES` on the backend — the two
 * must agree or the menu and the API will disagree about who someone is.
 *
 * Note what is absent: "Deparment Administrator" is NOT mapped to administrator.
 * It used to pass an admin gate purely because its name contains "admin", which
 * is the collision being removed here.
 */
const LEGACY_PROFILE_NAMES: Record<string, Role> = {
  admin: 'administrator',
  'organization administrator': 'administrator',
  hr: 'hr_manager',
}

/**
 * The caller's role.
 *
 * F-104. This function used to substring-match the profile's *display name*:
 *
 *     if (name.includes('admin'))   return 'admin'
 *     if (name.includes('manager')) return 'dept-head'
 *
 * Three things were wrong with that. It promoted every Reporting Manager to
 * Department Head, because "reporting manager" contains "manager". It collapsed
 * Auditor, Executive and Recruiter to Employee, because they match nothing. And
 * it made renaming a profile to anything containing "admin" a privilege
 * escalation — a tenant admin could grant admin by typing.
 *
 * `role_key` is the stable identifier the backend has authorised on since
 * RequireProfile, and `authController` now sends it. The display name is used
 * only for the profiles that predate it, and only by exact match.
 *
 * Anything unresolved is `employee`, the least-privileged role: a profile this
 * does not recognise must never widen access by accident.
 */
export function mapProfileNameToRole(
  profileName: string | null | undefined,
  roleKey?: string | null,
): Role {
  const key = (roleKey ?? '').trim()
  if (isRole(key)) return key

  const name = (profileName ?? '').trim().toLowerCase()
  return LEGACY_PROFILE_NAMES[name] ?? 'employee'
}

/** The role for a stored session, preferring role_key over the display name. */
export function resolveSessionRole(data: LaravelSessionData): Role {
  return mapProfileNameToRole(data.user_profile_name, data.role_key)
}

/** "Admin System User" style display name, falling back to the login name. */
export function resolveSessionDisplayName(data: LaravelSessionData): string {
  const full = [data.first_name, data.last_name].filter(Boolean).join(' ').trim()
  return full || (data.user_name ?? '') || (data.user_email ?? '')
}
