'use client'

import { lazy, Suspense } from 'react'
import { useAuth } from '@/components/auth/gtg-auth'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { AccessDeniedPage } from '@/components/auth/access-denied-page'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'

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
      <GtgPageShell initialActive={{ moduleId: 'hrit-solutions', menuId: 'attendance-management', submenuId: 'attendance-tracking' }}>
        <Suspense fallback={<div className="h-96 rounded-2xl bg-muted/40" />}>
          <LazyAttendanceDashboard />
        </Suspense>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
