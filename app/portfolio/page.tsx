'use client'

import { PremiumPage } from '@/components/domain/signals/premium-page'
import { useAuth } from '@/components/auth/gtg-auth'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'
import { GtgBreadcrumbFromContext } from '@/components/shell/gtg-breadcrumb'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext } from '@/lib/laravel-context'
import { PortfolioView } from '@/components/domain/portfolio/portfolio-view'

const PORTFOLIO_ACCESS_LINK = '/portfolio'

export default function ProductPortfolioPage() {
  const { user } = useAuth()
  const context = getLaravelContext(user)
  const canManage = user?.role === 'administrator' || user?.role === 'hr_manager' || user?.role === 'executive'
  const { parseRoutePath } = useSidebarNavigation()
  const activeNav = parseRoutePath(PORTFOLIO_ACCESS_LINK) ?? undefined

  return (
    <ProtectedLayout>
      <GtgPageShell initialActive={activeNav}>
        <GtgBreadcrumbFromContext />
        <PremiumPage>
          <PortfolioView context={context} canManage={canManage} />
        </PremiumPage>
      </GtgPageShell>
    </ProtectedLayout>
  )
}

