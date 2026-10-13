'use client'

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { IngestionEngineView } from '@/components/domain/signals/ingestion-engine-view'

export default function IngestionPage() {
  return (
    <ProtectedLayout>
      <GtgAppShell initialActive={{ moduleId: 'ingestion', menuId: 'ingestion', submenuId: 'ingestion' }}>
        <IngestionEngineView />
      </GtgAppShell>
    </ProtectedLayout>
  )
}

