'use client'

import { Suspense } from 'react'
import { PremiumPage } from '@/components/domain/signals/premium-page'
import { useAuth } from '@/components/auth/gtg-auth'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'
import { GtgBreadcrumbFromContext } from '@/components/shell/gtg-breadcrumb'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { PortfolioList } from '@/components/domain/portfolio/portfolio-list'

const PORTFOLIO_ACCESS_LINK = '/portfolio'

/**
 * The Product Portfolio (owner decision of 13 Nov 2026, slice 15): the ONE screen where a person finds, filters and opens any product. It is a product page with
 * its own sidebar entry, NOT a Signals page, so it is drawn outside `SignalsFrame` and shows no Company Opportunities / Ingestion Engine / Partner Network
 * buttons. The Signals pages keep their own header, and Market Signals keeps a plain link to this page.
 */
export default function ProductPortfolioPage() {
  const { user } = useAuth()
  const canManage = user?.role === 'administrator' || user?.role === 'hr_manager' || user?.role === 'executive'
  const { parseRoutePath } = useSidebarNavigation()
  const activeNav = parseRoutePath(PORTFOLIO_ACCESS_LINK) ?? undefined

  return (
    <ProtectedLayout>
      <GtgPageShell initialActive={activeNav}>
        <GtgBreadcrumbFromContext />
        <PremiumPage>
          {/* The list keeps its search, filters and page in the address, which needs a Suspense boundary above it. */}
          <Suspense fallback={null}>
            <PortfolioList canManage={canManage} />
          </Suspense>
        </PremiumPage>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
