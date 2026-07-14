'use client'

import { useContext } from 'react'
import { AuthContext } from '@/components/auth/gtg-auth'

export interface User {
  id: string
  email: string
  name: string
  role: string
}

export interface Session {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
