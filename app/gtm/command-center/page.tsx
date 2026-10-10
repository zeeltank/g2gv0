'use client'

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { CommandCenterView } from '@/components/domain/gtm/command-center-view'

export default function GtmCommandCenterPage() {
  return (
    <ProtectedLayout>
      <GtgAppShell>
        <CommandCenterView />
      </GtgAppShell>
    </ProtectedLayout>
  )
}
