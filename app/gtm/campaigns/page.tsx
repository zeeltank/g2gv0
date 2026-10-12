'use client'

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { CampaignsView } from '@/components/domain/gtm/campaigns-view'

export default function GtmCampaignsPage() {
  return (
    <ProtectedLayout>
      <GtgAppShell>
        <CampaignsView />
      </GtgAppShell>
    </ProtectedLayout>
  )
}
