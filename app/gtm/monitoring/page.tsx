'use client'

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { MonitoringView } from '@/components/domain/gtm/monitoring-view'

export default function GtmMonitoringPage() {
  return (
    <ProtectedLayout>
      <GtgAppShell>
        <MonitoringView />
      </GtgAppShell>
    </ProtectedLayout>
  )
}
