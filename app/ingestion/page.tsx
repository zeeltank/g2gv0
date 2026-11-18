'use client'

import { PremiumPage } from '@/components/domain/signals/premium-page'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { IngestionEngineView } from '@/components/domain/signals/ingestion-engine-view'
import { SignalsFrame } from '@/components/domain/signals/signals-frame'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'

export default function IngestionPage() {
  const { parseRoutePath } = useSidebarNavigation()
  const activeNav = parseRoutePath('/ingestion') ?? undefined

  return (
    <ProtectedLayout>
      <GtgAppShell initialActive={activeNav}>
        <PremiumPage>
          <SignalsFrame active="ingestion">
            <IngestionEngineView />
          </SignalsFrame>
        </PremiumPage>
      </GtgAppShell>
    </ProtectedLayout>
  )
}
