'use client'

import { lazy, Suspense } from 'react'
import { useAuth } from '@/components/auth/gtg-auth'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { AccessDeniedPage } from '@/components/auth/access-denied-page'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'

const ComplianceLibraryManagement = lazy(() =>
  import('@/domain/hrms/compliance-discipline/compliance-library-management').then((m) => ({
    default: m.ComplianceLibraryManagement,
  })),
)

export default function ComplianceManagementPage() {
  const { user, isLoading } = useAuth()

  if (!user || !['employee', 'manager', 'hr'].includes(user.role)) {
    return (
      <AccessDeniedPage reason="Access required to view compliance management." />
    )
  }

  return (
    <ProtectedLayout>
      <GtgPageShell initialActive={{ moduleId: '1', menuId: '205', submenuId: '206' }}>
        <Suspense fallback={<div className="h-96 rounded-2xl bg-muted/40" />}>
          <ComplianceLibraryManagement />
        </Suspense>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
