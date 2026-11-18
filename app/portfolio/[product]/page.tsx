'use client'

import { useParams } from 'next/navigation'
import { PremiumPage } from '@/components/domain/signals/premium-page'
import { useAuth } from '@/components/auth/gtg-auth'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'
import { GtgBreadcrumbFromContext } from '@/components/shell/gtg-breadcrumb'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext } from '@/lib/laravel-context'
import { ProductDetailView } from '@/components/domain/portfolio/product-detail-view'

const PORTFOLIO_ACCESS_LINK = '/portfolio'

/** One product's own page: its details, its ICP and its offers. Reached from Company Opportunities and from the Product Portfolio. */
export default function ProductDetailPage() {
  const { user } = useAuth()
  const params = useParams<{ product: string }>()
  const context = getLaravelContext(user)
  const { parseRoutePath } = useSidebarNavigation()
  const activeNav = parseRoutePath(PORTFOLIO_ACCESS_LINK) ?? undefined

  const rawParam = params?.product ? String(params.product) : ''
  const productKey = rawParam ? decodeURIComponent(rawParam) : ''

  return (
    <ProtectedLayout>
      <GtgPageShell initialActive={activeNav}>
        <GtgBreadcrumbFromContext />
        <PremiumPage>
          <ProductDetailView context={context} productKey={productKey} />
        </PremiumPage>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
