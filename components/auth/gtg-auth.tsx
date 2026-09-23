'use client'

import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { type Role } from '@/types/role'
import { requestSidebarFirstOpenExpansion } from '@/lib/sidebar-first-open'
import {
  clearLaravelSession,
  mapProfileNameToRole,
  readLaravelSession,
  resolveSessionDisplayName,
  saveLaravelSession,
  type LaravelSessionData,
} from '@/lib/laravel-session'
import { clearBrowserStateOnSignOut } from '@/lib/browser-storage'
import { accountService } from '@/services/account'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import {
  authService,
  isLoginSuccess,
  resolveLoginMessage,
  LOGIN_FAILED_MESSAGE,
} from '@/services/auth'
import { ApiError } from '@/services/core'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  /** Laravel `user_profile_name` - the raw profile `role` was derived from. */
  profileName?: string
  profileId?: string
  employeeNo?: string
  subInstituteId?: string
  syear?: string
  orgName?: string
  orgId?: string
  orgShortCode?: string
  orgType?: string
  initials?: string
  image?: string
}

export interface Session {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

/**
 * THE PASSWORD WAS RIGHT AND A CODE IS STILL NEEDED.
 *
 * Its own class rather than a message, because the sign-in screen has to tell this
 * apart from a rejection to know whether to show a second field or a red line — and
 * a string comparison against the server's wording is a check that breaks the next
 * time somebody rephrases it.
 *
 * `message` carries the server's sentence, so the same object both signals the state
 * and says what went wrong within it: "enter the code" the first time, "that code is
 * not right" after a bad attempt, "too many attempts" once throttled.
 */
export class TwoFactorRequiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TwoFactorRequiredError'
  }
}

/** A code from the app, or one of the printed recovery codes. */
export type SecondFactor = { code?: string; recoveryCode?: string }

interface AuthContextType extends Session {
  /**
   * Throws `TwoFactorRequiredError` when the account is enrolled and no code was
   * given. Call again with the same email and password plus a `SecondFactor`.
   *
   * The password is deliberately re-sent rather than the server holding a
   * half-authenticated state between the two calls: there is nothing to expire,
   * nothing to clean up, and no window in which a pending sign-in exists that
   * somebody else could finish.
   */
  login: (
    email: string,
    password: string,
    second?: SecondFactor,
    remember?: boolean,
  ) => Promise<void>
  logout: () => void
  switchRole: (role: Role) => void
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

const SESSION_COOKIE = 'gtg-session'

function normalizeSession(value: unknown): Session | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<Session>
  if (!candidate.user || !candidate.isAuthenticated) {
    return { user: null, isAuthenticated: false, isLoading: false }
  }

  return {
    user: candidate.user,
    isAuthenticated: true,
    isLoading: false,
  }
}

function getInitialSession(): Session {
  // IMPORTANT: Do NOT read localStorage here. This initializer runs during
  // the first render on BOTH the server and the client. Reading localStorage
  // on the client would make the client's first render differ from the
  // server's (which has no localStorage), producing a hydration mismatch that
  // forces React to discard the hydrated tree on every full page refresh.
  // The real session is restored in a useEffect after mount (see below).
  return { user: null, isAuthenticated: false, isLoading: true }
}

function getStoredSession(): Session {
  const signedOut: Session = { user: null, isAuthenticated: false, isLoading: false }

  // Both stores: an un-remembered sign-in deliberately writes to the
  // tab-scoped one (see storeSession below). localStorage first, since that's
  // where a remembered session lives.
  const stored =
    localStorage.getItem(SESSION_COOKIE) ?? sessionStorage.getItem(SESSION_COOKIE)
  if (!stored) {
    return signedOut
  }

  // A restored user without its Laravel token cannot talk to the ERP, so treat
  // that half-state as signed out rather than rendering a shell that 401s. The
  // routing cookie has to go too, or middleware.ts would bounce /login -> /dashboard.
  if (!readLaravelSession()) {
    localStorage.removeItem(SESSION_COOKIE)
    sessionStorage.removeItem(SESSION_COOKIE)
    clearSessionCookie()
    return signedOut
  }

  try {
    return normalizeSession(JSON.parse(stored)) ?? signedOut
  } catch {
    return signedOut
  }
}

function toOptionalString(value: string | number | null | undefined) {
  if (value === null || value === undefined) return undefined
  const text = String(value).trim()
  return text || undefined
}

/** Projects Laravel's `sessionData` onto the User the design system renders. */
function toUser(data: LaravelSessionData): User {
  return {
    id: String(data.user_id),
    email: data.user_email ?? '',
    name: resolveSessionDisplayName(data),
    // role_key first, display name only for the legacy profiles. See F-104.
    role: mapProfileNameToRole(data.user_profile_name, data.role_key),
    profileName: toOptionalString(data.user_profile_name),
    profileId: toOptionalString(data.user_profile_id),
    employeeNo: toOptionalString(data.employee_no),
    subInstituteId: toOptionalString(data.sub_institute_id),
    syear: toOptionalString(data.syear),
    orgName: toOptionalString(data.org_name),
    orgId: toOptionalString(data.org_id),
    orgShortCode: toOptionalString(data.org_short_code),
    orgType: toOptionalString(data.org_type),
    initials: toOptionalString(data.org_user),
    image: toOptionalString(data.user_image),
  }
}

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * "KEEP ME SIGNED IN" — A CHECKBOX THAT DID NOTHING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The login page has had a working `rememberMe` checkbox for as long as it
 * has existed. Nothing read it. It was not sent to the API, it was not
 * stored, and the cookie below was hardcoded to seven days whether it was
 * ticked or not — so unticking it changed nothing on a shared HR machine.
 *
 * Three places hold the session, and all three have to agree or the control
 * is still a decoration:
 *
 *   1. the `gtg-session` COOKIE — the only one `proxy.ts` can see, so it is
 *      what actually gates /dashboard on the next page load
 *   2. the `gtg-session` MIRROR — what `getStoredSession()` rehydrates from
 *   3. the `userData` TOKEN — without it `getStoredSession()` returns signed
 *      out regardless, so it is the real backstop (see laravel-session.ts)
 *
 * Ticked: ~30 days, all three in persistent storage. Unticked: a session
 * cookie with no `max-age`, and both browser stores scoped to the tab — so
 * closing the browser genuinely signs you out, which is what the words on the
 * checkbox have always promised.
 */
const REMEMBER_KEY = 'gtg-remember'
const REMEMBERED_DAYS = 30

/** The choice made at sign-in, so a later write does not silently undo it. */
function readRememberChoice(): boolean {
  try {
    return window.localStorage.getItem(REMEMBER_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Write the session cookie `proxy.ts` routes on.
 *
 * `remember` is omitted by callers UPDATING an existing session rather than
 * creating one — `switchRole` — which then inherit the choice already made.
 * Without that, switching role mid-session would silently promote a
 * deliberately temporary sign-in to a thirty-day one.
 */
function setSessionCookie(session: Session, remember?: boolean) {
  const keep = remember ?? readRememberChoice()

  if (remember !== undefined) {
    try {
      window.localStorage.setItem(REMEMBER_KEY, keep ? '1' : '0')
    } catch {
      // Storage blocked. The cookie below still carries the decision for this
      // browsing session, which is the conservative half of the two.
    }
  }

  // No `max-age` at all makes it a session cookie: the browser drops it on exit.
  const lifetime = keep ? `; max-age=${60 * 60 * 24 * REMEMBERED_DAYS}` : ''

  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(
    JSON.stringify(session)
  )}; path=/${lifetime}; samesite=lax`
}

function clearSessionCookie() {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`
}

/** The session mirror, in the store matching the "keep me signed in" choice. */
function storeSession(session: Session, remember?: boolean) {
  const keep = remember ?? readRememberChoice()
  const store = keep ? window.localStorage : window.sessionStorage
  const other = keep ? window.sessionStorage : window.localStorage

  store.setItem(SESSION_COOKIE, JSON.stringify(session))
  other.removeItem(SESSION_COOKIE)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(getInitialSession)

  // Restore the persisted session AFTER mount. This keeps the initial render
  // identical on the server and the client (both start "loading"), which
  // avoids a hydration mismatch and the blank-page-after-refresh problem.
  useEffect(() => {
    queueMicrotask(() => {
      setSession(getStoredSession())
    })
  }, [])

  const login = async (
    email: string,
    password: string,
    second?: SecondFactor,
    remember = false,
  ) => {
    // Mirrors authController::index - both fields are `required|string` there.
    if (!email.trim()) {
      throw new Error('The email field is required.')
    }
    if (!password) {
      throw new Error('The password field is required.')
    }

    let response
    try {
      response = await authService.login({
        email: email.trim(),
        password,
        twoFactorCode: second?.code,
        recoveryCode: second?.recoveryCode,
      })
    } catch (error) {
      // 422 - Laravel returned the first validation error in `message`.
      if (error instanceof ApiError) {
        /*
         * A CHALLENGE IS NOT A FAILURE, AND MUST NOT ARRIVE AS ONE.
         *
         * Flattening this into `new Error(message)` — which is what every other
         * branch here does — would put "Enter the code from your authenticator
         * app" on screen as a red login error, with no field to type it into. The
         * person's password was correct; the sign-in is halfway through, not
         * rejected.
         */
        if (error.twoFactorRequired) {
          throw new TwoFactorRequiredError(
            error.message || 'Enter the code from your authenticator app.',
          )
        }

        throw new Error(error.message || LOGIN_FAILED_MESSAGE)
      }
      // fetch() rejects with a TypeError when the ERP is unreachable.
      if (error instanceof TypeError) {
        throw new Error('Unable to reach the server. Please check your connection and try again.')
      }
      throw error
    }

    // Rejected credentials and "Academic Term Date Expired" both arrive as
    // HTTP 200 with status 0, so the message has to be read off the body.
    if (!isLoginSuccess(response.status) || !response.sessionData?.token) {
      throw new Error(resolveLoginMessage(response.message))
    }

    saveLaravelSession(response.sessionData, remember)
    const user = toUser(response.sessionData)

    const newSession: Session = { user, isAuthenticated: true, isLoading: false }
    setSession(newSession)
    // `remember` is passed explicitly here and nowhere else: this is the one
    // moment somebody actually makes the choice.
    storeSession(newSession, remember)
    requestSidebarFirstOpenExpansion()
    setSessionCookie(newSession, remember)
  }

  /**
   * Sign out, and leave nothing of this person behind.
   *
   * ═══════════════════════════════════════════════════════════════════════
   * THIS USED TO CLEAR FOUR KEYS OUT OF FOURTEEN
   * ═══════════════════════════════════════════════════════════════════════
   *
   * The nine it missed were each inherited by whoever signed in next on the same
   * browser: the theme, the last page visited, saved report filters, hidden
   * columns, unsaved agent drafts. On a shared machine that is a stream of one
   * person's choices - and in two cases their unfinished work - leaking to the
   * next person to sit down.
   *
   * `clearBrowserStateOnSignOut()` owns that list now, so a key added anywhere in
   * the product is cleared here without this function being edited again.
   *
   * ── `clearLaravelSession()` STILL RUNS, AND ITS ORDER MATTERS ────────────
   *
   * It is what announces the session change, and that is how `PreferencesProvider`
   * learns to drop the cached `/account/me` payload. It runs before the registry
   * sweep so the announcement happens while the rest is still being torn down.
   */
  const logout = () => {
    /*
     * TELL THE SERVER FIRST, AND DO NOT WAIT FOR IT.
     *
     * Until now this was the whole of signing out: clear the browser. There was no
     * logout endpoint anywhere in the backend, so the Sanctum token stayed valid for
     * its full 30-day window - a token recovered from a shared machine was still a
     * working credential for a person who believed they had signed out.
     *
     * Fired before the local teardown, because `params()` needs the token that is
     * about to be removed. NOT awaited, and the failure is swallowed: somebody
     * clicking Sign out must end up signed out even with no network. A request that
     * fails leaves a token alive for up to 30 idle days, which is bad; refusing to
     * sign somebody out of the browser in front of them is worse.
     */
    try {
      const context = getLaravelContext(null)

      if (isLaravelContextReady(context)) {
        void accountService.logout(context).catch(() => {
          // Already leaving. Nothing here can help, and an error on the way out
          // would be shown to somebody who is no longer looking.
        })
      }
    } catch {
      // Reading the session can throw where storage is blocked. Sign out anyway.
    }

    setSession({ user: null, isAuthenticated: false, isLoading: false })
    clearSessionCookie()

    // Announces the session change; PreferencesProvider is subscribed to it.
    clearLaravelSession()

    // The whole registry - including `gtg-session` and the sidebar flag this
    // function used to remove by hand, and the nine it used to forget.
    clearBrowserStateOnSignOut()
  }

  const switchRole = (role: Role) => {
    if (session.user) {
      const updated = { ...session, user: { ...session.user, role } }
      setSession(updated)
      // No `remember` argument — inherit the choice made at sign-in.
      storeSession(updated)
      setSessionCookie(updated)
    }
  }

  return (
    <AuthContext.Provider value={{ ...session, login, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
