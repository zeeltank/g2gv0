'use client'

import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { type Role } from '@/types/role'

export interface User {
  id: string
  email: string
  name: string
  role: Role
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
  const stored = localStorage.getItem(SESSION_COOKIE)
  if (!stored) {
    return { user: null, isAuthenticated: false, isLoading: false }
  }

  try {
    return normalizeSession(JSON.parse(stored)) ?? { user: null, isAuthenticated: false, isLoading: false }
  } catch {
    return { user: null, isAuthenticated: false, isLoading: false }
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
    // Simulate auth delay
    await new Promise((resolve) => setTimeout(resolve, 800))

    // Mock user lookup by email
    const mockUsers: Record<string, User> = {
      'admin@gtg.local': {
        id: 'u-001',
        email: 'admin@gtg.local',
        name: 'Sarah Chen',
        role: 'admin',
      },
      'hr@gtg.local': {
        id: 'u-002',
        email: 'hr@gtg.local',
        name: 'Marcus Johnson',
        role: 'hr',
      },
      'depthead@gtg.local': {
        id: 'u-003',
        email: 'depthead@gtg.local',
        name: 'Priya Patel',
        role: 'dept-head',
      },
      'employee@gtg.local': {
        id: 'u-004',
        email: 'employee@gtg.local',
        name: 'Alex Rivera',
        role: 'employee',
      },
    }

    const user = mockUsers[email.toLowerCase()]
    if (!user) {
      throw new Error('Invalid email or password')
    }

    // Mock password validation (any password works for demo)
    if (!password) {
      throw new Error('Password is required')
    }

    const newSession: Session = { user, isAuthenticated: true, isLoading: false }
    setSession(newSession)
    localStorage.setItem(SESSION_COOKIE, JSON.stringify(newSession))
    setSessionCookie(newSession)
  }

  const logout = () => {
    setSession({ user: null, isAuthenticated: false, isLoading: false })
    localStorage.removeItem(SESSION_COOKIE)
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
