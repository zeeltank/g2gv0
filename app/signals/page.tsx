'use client'

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { SignalsPageContent } from '@/components/domain/signals/signals-page-content'

export default function SignalsPage() {
  return (
    <ProtectedLayout>
      <GtgAppShell initialActive={{ moduleId: 'signals', menuId: 'signals', submenuId: 'signals' }}>
        <SignalsPageContent />
      </GtgAppShell>
    </ProtectedLayout>
  )
}
