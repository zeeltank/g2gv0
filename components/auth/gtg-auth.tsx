'use client'

import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { type Role } from '@/types/role'
import { clearSidebarFirstOpenExpansion, requestSidebarFirstOpenExpansion } from '@/lib/sidebar-first-open'
import {
  clearLaravelSession,
  mapProfileNameToRole,
  readLaravelSession,
  resolveSessionDisplayName,
  saveLaravelSession,
  type LaravelSessionData,
} from '@/lib/laravel-session'
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

interface AuthContextType extends Session {
  login: (email: string, password: string) => Promise<void>
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

  const stored = localStorage.getItem(SESSION_COOKIE)
  if (!stored) {
    return signedOut
  }

  // A restored user without its Laravel token cannot talk to the ERP, so treat
  // that half-state as signed out rather than rendering a shell that 401s. The
  // routing cookie has to go too, or proxy.ts would bounce /login -> /dashboard.
  if (!readLaravelSession()) {
    localStorage.removeItem(SESSION_COOKIE)
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
    role: mapProfileNameToRole(data.user_profile_name),
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

function setSessionCookie(session: Session) {
  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(
    JSON.stringify(session)
  )}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`
}

function clearSessionCookie() {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`
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

  const login = async (email: string, password: string) => {
    // Mirrors authController::index - both fields are `required|string` there.
    if (!email.trim()) {
      throw new Error('The email field is required.')
    }
    if (!password) {
      throw new Error('The password field is required.')
    }

    let response
    try {
      response = await authService.login({ email: email.trim(), password })
    } catch (error) {
      // 422 - Laravel returned the first validation error in `message`.
      if (error instanceof ApiError) {
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

    saveLaravelSession(response.sessionData)
    const user = toUser(response.sessionData)

    const newSession: Session = { user, isAuthenticated: true, isLoading: false }
    setSession(newSession)
    localStorage.setItem(SESSION_COOKIE, JSON.stringify(newSession))
    requestSidebarFirstOpenExpansion()
    setSessionCookie(newSession)
  }

  const logout = () => {
    setSession({ user: null, isAuthenticated: false, isLoading: false })
    localStorage.removeItem(SESSION_COOKIE)
    // Drop the Laravel token/tenant bundle too - otherwise the next visitor on
    // this browser would keep issuing API calls as the previous user.
    clearLaravelSession()
    clearSidebarFirstOpenExpansion()
    clearSessionCookie()
  }

  const switchRole = (role: Role) => {
    if (session.user) {
      const updated = { ...session, user: { ...session.user, role } }
      setSession(updated)
      localStorage.setItem(SESSION_COOKIE, JSON.stringify(updated))
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
