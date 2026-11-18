'use client'

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { AgentsView } from '@/components/domain/gtm/agents-view'

export default function GtmAgentsPage() {
  return (
    <ProtectedLayout>
      <GtgAppShell>
        <AgentsView />
      </GtgAppShell>
    </ProtectedLayout>
  )
}
