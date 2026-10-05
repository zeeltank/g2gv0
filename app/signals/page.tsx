'use client'

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { SignalsFeedView } from '@/components/domain/signals/signals-feed-view'

export default function SignalsPage() {
  return (
    <ProtectedLayout>
      <GtgAppShell initialActive={{ moduleId: 'signals', menuId: 'signals', submenuId: 'signals' }}>
        <SignalsFeedView />
      </GtgAppShell>
    </ProtectedLayout>
  )
}

