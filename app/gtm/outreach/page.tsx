'use client'

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { OutreachView } from '@/components/domain/gtm/outreach-view'
import { PremiumPage } from '@/components/domain/signals/premium-page'
import { SignalsFrame } from '@/components/domain/signals/signals-frame'

export default function GtmOutreachPage() {
  return (
    <ProtectedLayout>
      <GtgAppShell>
        {/* Outreach is the fourth tab of the Signals header, so it is drawn under the same header and tabs as the other three. */}
        <PremiumPage>
          <SignalsFrame active="outreach">
            <OutreachView />
          </SignalsFrame>
        </PremiumPage>
      </GtgAppShell>
    </ProtectedLayout>
  )
}
