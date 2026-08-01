'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/auth/gtg-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { employeeService } from '@/services/hrms'
import type { EmployeeProfileResponse } from '@/services/hrms/employee'

interface UseEmployeeProfileResult {
  profile: EmployeeProfileResponse | null
  loading: boolean
  error: string | null
}

export function useEmployeeProfile(): UseEmployeeProfileResult {
  const { user } = useAuth()
  const [profile, setProfile] = useState<EmployeeProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProfile = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    const context = getLaravelContext(user)

    if (!isLaravelContextReady(context)) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await employeeService.getEmployeeProfile(context, user.orgType, user.profileName)
      setProfile(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employee profile.')
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    queueMicrotask(() => {
      loadProfile()
    })
  }, [loadProfile])

  return { profile, loading, error }
}