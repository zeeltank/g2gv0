'use client'

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { DealsView } from '@/components/domain/gtm/deals-view'

export default function GtmDealsPage() {
  return (
    <ProtectedLayout>
      <GtgAppShell>
        <DealsView />
      </GtgAppShell>
    </ProtectedLayout>
  )
}
