'use client'

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { PlaybooksView } from '@/components/domain/gtm/playbooks-view'

export default function GtmPlaybooksPage() {
  return (
    <ProtectedLayout>
      <GtgAppShell>
        <PlaybooksView />
      </GtgAppShell>
    </ProtectedLayout>
  )
}
