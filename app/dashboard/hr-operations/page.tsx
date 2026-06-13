'use client'

import { useAuth } from '@/lib/gtg-auth'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { AccessDeniedPage } from '@/components/auth/access-denied-page'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'

export default function HRDashboard() {
  const { user, isLoading } = useAuth()

  if (isLoading) return null

  if (!user || user.role !== 'hr') {
    return <AccessDeniedPage reason="HR access required to view this dashboard." />
  }

  return (
    <ProtectedLayout>
      <GtgAppShell />
    </ProtectedLayout>
  )
}
