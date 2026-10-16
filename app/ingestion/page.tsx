'use client'

import { PremiumPage } from '@/components/domain/signals/premium-page'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { IngestionEngineView } from '@/components/domain/signals/ingestion-engine-view'

export default function IngestionPage() {
  return (
    <ProtectedLayout>
      <GtgAppShell initialActive={{ moduleId: 'ingestion', menuId: 'ingestion', submenuId: 'ingestion' }}>
        <PremiumPage>
          <IngestionEngineView />
        </PremiumPage>
      </GtgAppShell>
    </ProtectedLayout>
  )
}

