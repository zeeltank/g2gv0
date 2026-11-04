'use client'

/**
 * One product line's page, or the page of a sub-product that is not in the CRM catalogue - /module/crm/sales/products/lines/[id].
 *
 * It is part of the Products screen (no menu row of its own), so it uses the Products row for the sidebar highlight and the breadcrumb. As with the
 * other CRM detail routes the menu ids differ between connections, so the active menu is resolved from the caller's own rights-filtered menu tree by
 * access_link, never hardcoded. The record's name is not known here until the page has loaded it, so the page reports it back for the last breadcrumb.
 */

import { Suspense, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'
import { BreadcrumbItemsProvider, GtgBreadcrumbFromContext } from '@/components/shell/gtg-breadcrumb'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { CRM_PRICE_BOOKS_ACCESS_LINK, CRM_PRODUCTS_ACCESS_LINK, CRM_SERVICES_ACCESS_LINK, resolveBreadcrumb } from '@/lib/gtg-navigation'
import { linesScopeHref } from '@/domain/crm/product-lines-model'
import { ProductLineRecordPage } from '@/domain/crm/product-line-record-page'

export default function CrmProductLineRecordRoute() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''

  const router = useRouter()
  const { resolveAccessLink, parseRoutePath, modules } = useSidebarNavigation()
  const activeNav = parseRoutePath(CRM_PRODUCTS_ACCESS_LINK) ?? { moduleId: '199', menuId: '', submenuId: '' }
  const [name, setName] = useState('')

  const productsHref = resolveAccessLink(CRM_PRODUCTS_ACCESS_LINK)
  const hrefs = useMemo(() => ({
    products: productsHref,
    services: resolveAccessLink(CRM_SERVICES_ACCESS_LINK),
    priceBooks: resolveAccessLink(CRM_PRICE_BOOKS_ACCESS_LINK),
  }), [productsHref, resolveAccessLink])

  const breadcrumbItems = [...resolveBreadcrumb(activeNav, modules), { label: name || '...' }]

  return (
    <ProtectedLayout>
      <GtgPageShell initialActive={activeNav}>
        <BreadcrumbItemsProvider items={breadcrumbItems}>
          <GtgBreadcrumbFromContext />

          <div className="p-4 sm:p-6">
            {/* The page reads ?tab= from the URL, which needs a Suspense boundary above it. */}
            <Suspense fallback={null}>
              <ProductLineRecordPage
                id={id}
                hrefs={hrefs}
                onBack={() => router.push(linesScopeHref(productsHref))}
                onNameKnown={setName}
              />
            </Suspense>
          </div>
        </BreadcrumbItemsProvider>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
