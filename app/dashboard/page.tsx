'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/gtg-auth'
import { getDashboardRoute } from '@/lib/gtg-dashboard-routing'
import { useEffect } from 'react'

export default function DashboardRedirect() {
  const router = useRouter()
  const { user, isLoading, isAuthenticated } = useAuth()

  useEffect(() => {
    if (isLoading) return

    if (!isAuthenticated || !user) {
      router.push('/login')
      return
    }

    const dashboardRoute = getDashboardRoute(user.role)
    router.push(dashboardRoute)
  }, [isLoading, isAuthenticated, user, router])

  if (isLoading) {
    return null
  }

  return null
}
