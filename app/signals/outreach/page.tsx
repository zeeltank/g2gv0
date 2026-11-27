'use client'

import { Suspense } from 'react'
import { PremiumPage } from '@/components/domain/signals/premium-page'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'
import { GtgBreadcrumbFromContext } from '@/components/shell/gtg-breadcrumb'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { SignalsFrame } from '@/components/domain/signals/signals-frame'
import { OutreachPage } from '@/components/domain/signals/outreach/outreach-page'
import { MessagesPanel } from '@/components/domain/signals/outreach/messages-panel'
import { OUTREACH_PATH } from '@/lib/signals/outreach-model'

/**
 * The Outreach tab of Market Signals (owner, 27 Nov 2026), after Product Portfolio: the companies that signals found (or a person added by hand), the people at them, and the
 * messages written to them. The list keeps its view, search and page in the address, which needs a Suspense boundary above it. The Messages view is the old GTM Outreach screen,
 * handed to the page as a node so the page itself never touches a sending control. The old addresses (/gtm/outreach, the Outreach Approvals and the two SMS Notifier pages) are
 * redirect pages that land here.
 */
export default function SignalsOutreachPage() {
  const { parseRoutePath } = useSidebarNavigation()
  // The sidebar stays on Market Signals, as it does for every other tab.
  const activeNav = parseRoutePath(OUTREACH_PATH) ?? undefined

  return (
    <ProtectedLayout>
      <GtgPageShell initialActive={activeNav}>
        <GtgBreadcrumbFromContext />
        <PremiumPage>
          <SignalsFrame active="outreach">
            <Suspense fallback={null}>
              <OutreachPage messages={<MessagesPanel />} />
            </Suspense>
          </SignalsFrame>
        </PremiumPage>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
