'use client'

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { WorkflowsView } from '@/components/domain/gtm/workflows-view'

export default function GtmWorkflowsPage() {
  return (
    <ProtectedLayout>
      <GtgAppShell>
        <WorkflowsView />
      </GtgAppShell>
    </ProtectedLayout>
  )
}
