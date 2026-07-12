'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/gtg-auth'
import { getDashboardRoute } from '@/lib/gtg-dashboard-routing'
import { useEffect } from 'react'

export default function Page() {
  const router = useRouter()
  const { user, isLoading, isAuthenticated } = useAuth()

  useEffect(() => {
    if (isLoading) return

    if (!isAuthenticated) {
      router.push('/login')
      return
    }

    if (user) {
      router.push(getDashboardRoute(user.role))
    }
  }, [isLoading, isAuthenticated, user, router])

  if (isLoading) {
    return null
  }

  return null
}

