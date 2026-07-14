'use client'

import { lazy, Suspense } from 'react'
import { useAuth } from '@/components/auth/gtg-auth'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { AccessDeniedPage } from '@/components/auth/access-denied-page'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'

const LeaveManagementDashboard = lazy(() =>
  import('@/domain/hrms/hrit/leave-management/leave-dashboard/page').then((m) => ({
    default: m.default,
  })),
)

export default function LeaveManagementPage() {
  const { user, isLoading } = useAuth()

  if (!user || !['employee', 'manager', 'hr'].includes(user.role)) {
    return (
      <AccessDeniedPage reason="Access required to view leave management." />
    )
  }

  return (
    <ProtectedLayout>
      <GtgPageShell initialActive={{ moduleId: 'm5', menuId: 'leave-management', submenuId: 'leave-dashboard' }}>
        <Suspense fallback={<div className="h-96 rounded-2xl bg-muted/40" />}>
          <LeaveManagementDashboard />
        </Suspense>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
