'use client'

import { useAuth } from '@/components/auth/gtg-auth'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { AccessDeniedPage } from '@/components/auth/access-denied-page'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import LeaveManagementDashboard from '@/components/hrit/leave-management/leave-dashboard/page'

export default function LeaveManagementPage() {
  const { user, isLoading } = useAuth()

  if (isLoading) return null

  if (!user || !['employee', 'manager', 'hr'].includes(user.role)) {
    return (
      <AccessDeniedPage reason="Access required to view leave management." />
    )
  }

  return (
    <ProtectedLayout>
      <GtgAppShell>
        <LeaveManagementDashboard />
      </GtgAppShell>
    </ProtectedLayout>
  )
}