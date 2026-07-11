'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
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

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const SESSION_COOKIE = 'gtg-session'

function setSessionCookie(session: Session) {
  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(
    JSON.stringify(session)
  )}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`
}

function clearSessionCookie() {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(() => {
    // Initialize from localStorage synchronously (avoids useEffect setState)
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('gtg-session')
      if (stored) {
        try {
          return JSON.parse(stored)
        } catch {
          return { user: null, isAuthenticated: false, isLoading: false }
        }
      }
    }
    return { user: null, isAuthenticated: false, isLoading: true }
  })

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
    localStorage.setItem('gtg-session', JSON.stringify(newSession))
    setSessionCookie(newSession)
  }

  const logout = () => {
    setSession({ user: null, isAuthenticated: false, isLoading: false })
    localStorage.removeItem('gtg-session')
    clearSessionCookie()
  }

  const switchRole = (role: Role) => {
    if (session.user) {
      const updated = { ...session, user: { ...session.user, role } }
      setSession(updated)
      localStorage.setItem('gtg-session', JSON.stringify(updated))
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
