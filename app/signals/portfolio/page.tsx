'use client'

import { Suspense } from 'react'
import { PremiumPage } from '@/components/domain/signals/premium-page'
import { useAuth } from '@/components/auth/gtg-auth'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'
import { GtgBreadcrumbFromContext } from '@/components/shell/gtg-breadcrumb'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { PortfolioList } from '@/components/domain/portfolio/portfolio-list'
import { SignalsFrame } from '@/components/domain/signals/signals-frame'

const SIGNALS_PORTFOLIO_ROUTE = '/signals/portfolio'

/**
 * The Product Portfolio tab of Market Signals (owner, 23 Nov 2026): the same list as the Product Portfolio sidebar entry (`/portfolio`), drawn under the four Signals tabs
 * so a person working in Market Signals can switch between Company Opportunities, Ingestion Engine, Product Portfolio and Partner Network without leaving the module.
 * The Product Portfolio MODULE (`/portfolio` and the pages under it) shows no Signals tabs; this route is only the tab's.
 */
export default function SignalsPortfolioPage() {
  const { user } = useAuth()
  const canManage = user?.role === 'administrator' || user?.role === 'hr_manager' || user?.role === 'executive'
  const { parseRoutePath } = useSidebarNavigation()
  // The sidebar stays on Market Signals, as it does for every other tab.
  const activeNav = parseRoutePath(SIGNALS_PORTFOLIO_ROUTE) ?? undefined

  return (
    <ProtectedLayout>
      <GtgPageShell initialActive={activeNav}>
        <GtgBreadcrumbFromContext />
        <PremiumPage>
          <SignalsFrame active="portfolio">
            {/* The list keeps its search, filters and page in the address, which needs a Suspense boundary above it. */}
            <Suspense fallback={null}>
              <PortfolioList canManage={canManage} embedded />
            </Suspense>
          </SignalsFrame>
        </PremiumPage>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
