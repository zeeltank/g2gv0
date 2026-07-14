'use client'

import { lazy, Suspense } from 'react'
import { useAuth } from '@/components/auth/gtg-auth'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { AccessDeniedPage } from '@/components/auth/access-denied-page'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'

const LazyAttendanceReportsPage = lazy(() =>
  import('@/domain/hrms/hrit/attendance-management/attendance-reports/page').then((module) => ({ default: module.AttendanceReportsPage })),
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
      <GtgPageShell initialActive={{ moduleId: 'm5', menuId: 'attendance-management', submenuId: 'attendance-reports' }}>
        <Suspense fallback={<div className="h-96 rounded-2xl bg-muted/40" />}>
          <LazyAttendanceReportsPage />
        </Suspense>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
