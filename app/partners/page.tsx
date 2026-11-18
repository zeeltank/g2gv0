'use client'

import { PremiumPage } from '@/components/domain/signals/premium-page'
import { useAuth } from '@/components/auth/gtg-auth'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'
import { GtgBreadcrumbFromContext } from '@/components/shell/gtg-breadcrumb'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext } from '@/lib/laravel-context'
import { PartnersView } from '@/components/domain/portfolio/partners-view'
import { SignalsFrame } from '@/components/domain/signals/signals-frame'

const PARTNERS_ACCESS_LINK = '/partners'

export default function PartnerNetworkPage() {
  const { user } = useAuth()
  const context = getLaravelContext(user)
  const canManage = user?.role === 'administrator' || user?.role === 'hr_manager' || user?.role === 'executive'
  const { parseRoutePath } = useSidebarNavigation()
  const activeNav = parseRoutePath(PARTNERS_ACCESS_LINK) ?? undefined

  return (
    <ProtectedLayout>
      <GtgPageShell initialActive={activeNav}>
        <GtgBreadcrumbFromContext />
        <PremiumPage>
          <SignalsFrame active="partners">
            <PartnersView context={context} canManage={canManage} />
          </SignalsFrame>
        </PremiumPage>
      </GtgPageShell>
    </ProtectedLayout>
  )
}

