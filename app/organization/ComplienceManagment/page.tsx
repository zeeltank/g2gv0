'use client'

import { useAuth } from '@/lib/gtg-auth'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { AccessDeniedPage } from '@/components/auth/access-denied-page'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { ComplianceLibraryManagement } from '@/components/compliance-discipline/compliance-library-management'

export default function ComplianceManagementPage() {
  const { user, isLoading } = useAuth()

  if (isLoading) return null

  if (!user || !['employee', 'manager', 'hr'].includes(user.role)) {
    return (
      <AccessDeniedPage reason="Access required to view compliance management." />
    )
  }

  return (
    <ProtectedLayout>
      <GtgAppShell>
        <ComplianceLibraryManagement />
      </GtgAppShell>
    </ProtectedLayout>
  )
}