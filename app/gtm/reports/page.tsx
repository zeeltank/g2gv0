'use client'

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { ReportsView } from '@/components/domain/gtm/reports-view'

export default function GtmReportsPage() {
  return (
    <ProtectedLayout>
      <GtgAppShell>
        <ReportsView />
      </GtgAppShell>
    </ProtectedLayout>
  )
}
