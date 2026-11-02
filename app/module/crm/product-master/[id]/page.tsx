'use client'

/**
 * One Product Master record's page - /module/crm/product-master/[id].
 *
 * Same reasoning as the other CRM detail routes: the menu ids are not the same on every connection, so the active menu is resolved from the caller's
 * own rights-filtered menu tree by access_link, never hardcoded. The record's name is not known here until the page has loaded it, so the page reports
 * it back for the last breadcrumb.
 */

import { Suspense, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'
import { BreadcrumbItemsProvider, GtgBreadcrumbFromContext } from '@/components/shell/gtg-breadcrumb'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { CRM_PRODUCT_MASTER_ACCESS_LINK, resolveBreadcrumb } from '@/lib/gtg-navigation'
import { ProductMasterDetailPage } from '@/domain/crm/product-master-detail-page'

export default function CrmProductMasterDetailRoute() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''

  const router = useRouter()
  const { resolveAccessLink, parseRoutePath, modules } = useSidebarNavigation()
  const activeNav = parseRoutePath(CRM_PRODUCT_MASTER_ACCESS_LINK) ?? { moduleId: '199', menuId: '', submenuId: '' }
  const [name, setName] = useState('')

  const breadcrumbItems = [...resolveBreadcrumb(activeNav, modules), { label: name || '...' }]

  return (
    <ProtectedLayout>
      <GtgPageShell initialActive={activeNav}>
        <BreadcrumbItemsProvider items={breadcrumbItems}>
          <GtgBreadcrumbFromContext />

          <div className="p-4 sm:p-6">
            {/* The page reads ?tab= from the URL, which needs a Suspense boundary above it. */}
            <Suspense fallback={null}>
              <ProductMasterDetailPage
                id={id}
                onBack={() => router.push(resolveAccessLink(CRM_PRODUCT_MASTER_ACCESS_LINK))}
                onNameKnown={setName}
              />
            </Suspense>
          </div>
        </BreadcrumbItemsProvider>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
