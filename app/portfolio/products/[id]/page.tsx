'use client'

/**
 * One Sub-product's page - /portfolio/products/[id] (the master id). It is part of the Product Portfolio, which is its own screen with its own sidebar
 * entry (no Signals header), so it renders in the app shell with the Portfolio's breadcrumb. The record's name is not known here until the page has loaded
 * it, so the page reports it back for the last breadcrumb. A Product (level 1) found at this address is sent to its own page by the component.
 */

import { Suspense, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'
import { BreadcrumbItemsProvider, GtgBreadcrumbFromContext } from '@/components/shell/gtg-breadcrumb'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { CRM_INVOICES_ACCESS_LINK, CRM_QUOTES_ACCESS_LINK, resolveBreadcrumb } from '@/lib/gtg-navigation'
import { SubProductPage, type SubProductHrefs } from '@/domain/portfolio/sub-product-page'

const PORTFOLIO_ACCESS_LINK = '/portfolio'

export default function SubProductRoute() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''
  const router = useRouter()
  const { resolveAccessLink, parseRoutePath, modules } = useSidebarNavigation()
  const activeNav = parseRoutePath(PORTFOLIO_ACCESS_LINK) ?? undefined
  const [name, setName] = useState('')

  const quotes = resolveAccessLink(CRM_QUOTES_ACCESS_LINK)
  const invoices = resolveAccessLink(CRM_INVOICES_ACCESS_LINK)
  const hrefs = useMemo<SubProductHrefs>(() => ({
    portfolio: PORTFOLIO_ACCESS_LINK, quotes, salesOrders: '/module/crm/sales/sales-orders', invoices,
  }), [quotes, invoices])

  const breadcrumbItems = [...(activeNav ? resolveBreadcrumb(activeNav, modules) : [{ label: 'Home', href: '/' }, { label: 'Product Portfolio', href: PORTFOLIO_ACCESS_LINK }]), { label: name || '...' }]

  return (
    <ProtectedLayout>
      <GtgPageShell initialActive={activeNav}>
        <BreadcrumbItemsProvider items={breadcrumbItems}>
          <GtgBreadcrumbFromContext />
          <div className="p-4 sm:p-6">
            {/* The page reads ?tab= from the address, which needs a Suspense boundary above it. */}
            <Suspense fallback={null}>
              <SubProductPage id={id} hrefs={hrefs} onBack={() => router.push(PORTFOLIO_ACCESS_LINK)} onNameKnown={setName} />
            </Suspense>
          </div>
        </BreadcrumbItemsProvider>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
