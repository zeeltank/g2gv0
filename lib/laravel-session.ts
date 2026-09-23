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

/**
 * Persist the session.
 *
 * `remember` picks WHICH store, and that choice is the whole of "Keep me
 * signed in" — the login checkbox has existed for as long as the screen has,
 * wired to a state variable that was never read. `localStorage` outlives the
 * browser; `sessionStorage` dies with the tab. `readLaravelSession()` already
 * reads both and `clearLaravelSession()` already clears both, so nothing else
 * has to know which one was used.
 *
 * The unused store is cleared either way. Signing in without the box ticked on
 * a machine where it was ticked last time must not leave the old token sitting
 * in localStorage, silently re-authenticating the next person to open the
 * browser.
 */
export function saveLaravelSession(data: LaravelSessionData, remember = true) {
  if (typeof window === 'undefined') return

  const store = remember ? window.localStorage : window.sessionStorage
  const other = remember ? window.sessionStorage : window.localStorage

  store.setItem(LARAVEL_SESSION_KEY, JSON.stringify(data))
  other.removeItem(LARAVEL_SESSION_KEY)
  announceSessionChange()
}

export function clearLaravelSession() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(LARAVEL_SESSION_KEY)
  window.sessionStorage.removeItem(LARAVEL_SESSION_KEY)
  announceSessionChange()
}

/* ══════════════════════════════════════════════════════════════════════════
   WHO IS SIGNED IN, AND TELLING THE APP WHEN THAT CHANGES
   ══════════════════════════════════════════════════════════════════════════

   This exists because of a real bug on live: somebody edited their profile,
   signed out, signed in as a colleague, and saw their OWN details on the
   colleague's profile screen.

   Nothing on the server was wrong — the correct row was written, and
   `/account/me` returns the right answer for each token. The leak was entirely
   in the browser: `PreferencesProvider` fetched `/account/me` once per PAGE LOAD
   and kept it in React state, while sign-out and sign-in are both `router.push`,
   which never reloads. So one person's payload outlived their session.

   The provider sits ABOVE `AuthProvider` in `app/layout.tsx`, so it cannot watch
   the auth context. It has to learn about a user change from the place the change
   actually happens — here, where the session is written and cleared.

   ── WHY AN EVENT AND NOT THE `storage` EVENT ALONE ────────────────────────

   `storage` fires only in OTHER tabs, never in the tab that did the writing, so
   on its own it would miss every sign-in and sign-out. Both are subscribed to
   below: the custom event covers this tab, `storage` covers the others — so
   signing out in one tab also drops the cached account in the rest. */

const SESSION_CHANGED_EVENT = 'gtg:laravel-session-changed'

function announceSessionChange() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT))
}

/**
 * A stable string naming WHO is signed in, for use as a cache key. Null when
 * nobody is.
 *
 * The token is part of it deliberately, not just the user id: signing in again
 * mints a new token even for the same person, so a fresh sign-in also invalidates
 * anything cached against the old one. Keying on the user id alone would let a
 * stale payload survive a sign-out-and-back-in as yourself.
 */
export function laravelSessionIdentity(): string | null {
  const session = readLaravelSession()

  if (!session) return null

  return `${session.user_id}:${session.token}`
}

/**
 * Run `listener` whenever the signed-in user changes. Returns an unsubscribe.
 *
 * Safe to call during SSR — it returns a no-op rather than throwing, so a caller
 * does not need to guard.
 */
export function subscribeToLaravelSession(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  window.addEventListener(SESSION_CHANGED_EVENT, listener)
  window.addEventListener('storage', listener)

  return () => {
    window.removeEventListener(SESSION_CHANGED_EVENT, listener)
    window.removeEventListener('storage', listener)
  }
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
