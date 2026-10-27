'use client'

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { MainDashboard } from '@/components/domain/main-dashboard'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'

export default function DashboardHome() {
  return (
    <ProtectedLayout>
      <GtgAppShell>
        <MainDashboard />
      </GtgAppShell>
    </ProtectedLayout>
  )
}
