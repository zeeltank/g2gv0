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

import type { Role } from '@/types/role'

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
 * Laravel authorises through `tbluserprofilemaster.name` while this frontend's
 * permission matrix (types/role.ts) is keyed by Role. Seeded profiles are
 * Admin / HR / Employee; the extra aliases cover the profile names other
 * controllers compare against. Anything unrecognised gets the least-privileged
 * role so a new profile can never widen access by accident.
 */
export function mapProfileNameToRole(profileName: string | null | undefined): Role {
  const name = (profileName ?? '').trim().toLowerCase()

  if (!name) return 'employee'
  if (name.includes('admin')) return 'admin'
  if (name === 'hr' || name.includes('human resource') || name.includes('hr ')) return 'hr'
  if (
    name.includes('department head') ||
    name.includes('dept head') ||
    name.includes('hod') ||
    name.includes('manager') ||
    name.includes('supervisor')
  ) {
    return 'dept-head'
  }

  return 'employee'
}

/** "Admin System User" style display name, falling back to the login name. */
export function resolveSessionDisplayName(data: LaravelSessionData): string {
  const full = [data.first_name, data.last_name].filter(Boolean).join(' ').trim()
  return full || (data.user_name ?? '') || (data.user_email ?? '')
}
