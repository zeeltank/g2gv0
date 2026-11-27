'use client'

import { Suspense } from 'react'
import { notFound, useParams } from 'next/navigation'
import { PremiumPage } from '@/components/domain/signals/premium-page'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'
import { GtgBreadcrumbFromContext } from '@/components/shell/gtg-breadcrumb'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { SignalsFrame } from '@/components/domain/signals/signals-frame'
import { OutreachCompanyPage } from '@/components/domain/signals/outreach/outreach-company-page'
import { OUTREACH_PATH } from '@/lib/signals/outreach-model'

/**
 * One company of the Outreach tab (Details and People), under the Signals tabs with Outreach still lit. The address names the company by its number; anything that is not a
 * whole number above zero is a page that does not exist. The open tab (`?tab=`) lives in the address, which needs a Suspense boundary above it.
 */
export default function SignalsOutreachCompanyPage() {
  const params = useParams<{ id: string }>()
  const id = Number(params?.id)
  const { parseRoutePath } = useSidebarNavigation()
  // The sidebar stays on Market Signals, as it does for every other tab.
  const activeNav = parseRoutePath(OUTREACH_PATH) ?? undefined

  if (!Number.isInteger(id) || id < 1) notFound()

  return (
    <ProtectedLayout>
      <GtgPageShell initialActive={activeNav}>
        <GtgBreadcrumbFromContext />
        <PremiumPage>
          <SignalsFrame active="outreach">
            <Suspense fallback={null}>
              <OutreachCompanyPage id={id} />
            </Suspense>
          </SignalsFrame>
        </PremiumPage>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
