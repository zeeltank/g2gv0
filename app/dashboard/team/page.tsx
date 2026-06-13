'use client'

import { useAuth } from '@/lib/gtg-auth'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { AccessDeniedPage } from '@/components/auth/access-denied-page'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'

export default function TeamDashboard() {
  const { user, isLoading } = useAuth()

  if (isLoading) return null

  if (!user || user.role !== 'dept-head') {
    return (
      <AccessDeniedPage reason="Department Head access required to view this dashboard." />
    )
  }

  return (
    <ProtectedLayout>
      <GtgAppShell />
    </ProtectedLayout>
  )
}
