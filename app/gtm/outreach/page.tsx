'use client'

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { OutreachView } from '@/components/domain/gtm/outreach-view'

export default function GtmOutreachPage() {
  return (
    <ProtectedLayout>
      <GtgAppShell>
        <OutreachView />
      </GtgAppShell>
    </ProtectedLayout>
  )
}
