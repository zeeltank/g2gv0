'use client'

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { ProspectingView } from '@/components/domain/gtm/prospecting-view'

export default function GtmProspectingPage() {
  return (
    <ProtectedLayout>
      <GtgAppShell>
        <ProspectingView />
      </GtgAppShell>
    </ProtectedLayout>
  )
}
