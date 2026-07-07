'use client'

import { useAuth } from '@/components/auth/gtg-auth'
import { AccessDeniedPage } from '@/components/auth/access-denied-page'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { DisciplinaryManagement } from '@/components/compliance-discipline/disciplinary-management'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'

export default function DisciplinaryManagementPage() {
  const { user, isLoading } = useAuth()

  if (isLoading) return null

  if (!user || !['employee', 'manager', 'hr'].includes(user.role)) {
    return (
      <AccessDeniedPage reason="Access required to view disciplinary management." />
    )
  }

  return (
    <ProtectedLayout>
      <GtgAppShell>
        <DisciplinaryManagement />
      </GtgAppShell>
    </ProtectedLayout>
  )
}
