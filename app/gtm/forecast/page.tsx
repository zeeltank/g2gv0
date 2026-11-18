'use client'

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { ForecastView } from '@/components/domain/gtm/forecast-view'

export default function GtmForecastPage() {
  return (
    <ProtectedLayout>
      <GtgAppShell>
        <ForecastView />
      </GtgAppShell>
    </ProtectedLayout>
  )
}
