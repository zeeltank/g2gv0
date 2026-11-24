'use client'

import { lazy, Suspense } from 'react'
import { useAuth } from '@/components/auth/gtg-auth'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { AccessDeniedPage } from '@/components/auth/access-denied-page'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'
import { ContextualInsights } from '@/components/domain/intelligence'

const LazyAttendanceDashboard = lazy(() =>
  import('@/domain/hrms/hrit/attendance-management/attendance-tracking/page').then((module) => ({ default: module.AttendanceDashboard })),
)

export default function AttendanceTrackingPage() {
  const { user, isLoading } = useAuth()

  if (!user || !['employee', 'manager', 'hr'].includes(user.role)) {
    return (
      <AccessDeniedPage reason="Access required to view attendance tracking." />
    )
  }

  return (
    <ProtectedLayout>
      <GtgPageShell initialActive={{ moduleId: '5', menuId: '93', submenuId: '100' }}>
        <div className="px-6 pt-6">
          <ContextualInsights surface="attendance" className="mb-0" />
        </div>
        <Suspense fallback={<div className="h-96 rounded-2xl bg-muted/40" />}>
          <LazyAttendanceDashboard />
        </Suspense>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
