'use client'

import { lazy, Suspense } from 'react'
import { useAuth } from '@/components/auth/gtg-auth'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { AccessDeniedPage } from '@/components/auth/access-denied-page'

const LazyGtgAppShell = lazy(() =>
  import('@/components/shell/gtg-app-shell').then((module) => ({ default: module.GtgAppShell })),
)

export default function HRDashboard() {
  const { user, isLoading } = useAuth()

  if (!user || user.role !== 'hr') {
    return <AccessDeniedPage reason="HR access required to view this dashboard." />
  }

  return (
    <ProtectedLayout>
      <Suspense fallback={<div className="h-96 rounded-2xl bg-muted/40" />}>
        <LazyGtgAppShell />
      </Suspense>
    </ProtectedLayout>
  )
}
