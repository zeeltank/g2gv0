'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/gtg-auth'
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-4 border-border border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return null
}

