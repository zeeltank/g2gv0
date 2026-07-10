'use client'

import { useAuth } from '@/components/auth/gtg-auth'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { AccessDeniedPage } from '@/components/auth/access-denied-page'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { AttendanceReportsPage } from '@/components/hrit/attendance-management/attendance-reports/page'


export default function AttendanceTrackingPage() {
  const { user, isLoading } = useAuth()

  if (isLoading) return null

  if (!user || !['employee', 'manager', 'hr'].includes(user.role)) {
    return (
      <AccessDeniedPage reason="Access required to view attendance tracking." />
    )
  }

  return (
    <ProtectedLayout>
      <GtgAppShell>
        <AttendanceReportsPage/>
      </GtgAppShell>
    </ProtectedLayout>
  )
}