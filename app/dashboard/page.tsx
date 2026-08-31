'use client'

import { lazy, Suspense } from 'react'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { MainDashboard } from '@/components/domain/main-dashboard'

const LazyGtgAppShell = lazy(() =>
  import('@/components/shell/gtg-app-shell').then((module) => ({ default: module.GtgAppShell })),
)

export default function DashboardHome() {
  return (
    <ProtectedLayout>
      <Suspense fallback={<div className="h-96 rounded-2xl bg-muted/40" />}>
        <LazyGtgAppShell>
          <MainDashboard />
        </LazyGtgAppShell>
      </Suspense>
    </ProtectedLayout>
  )
}
