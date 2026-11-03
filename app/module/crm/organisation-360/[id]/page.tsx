'use client'

/**
 * One organisation's 360 page - /module/crm/organisation-360/[id].
 *
 * Same reasoning as the other CRM detail routes: the menu ids are not the same on every connection, so the active menu is resolved from the caller's
 * own rights-filtered menu tree by access_link, never hardcoded. The organisation's name is not known here until the page has loaded it, so the page
 * reports it back for the last breadcrumb.
 */

import { Suspense, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'
import { BreadcrumbItemsProvider, GtgBreadcrumbFromContext } from '@/components/shell/gtg-breadcrumb'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { resolveBreadcrumb } from '@/lib/gtg-navigation'
import { ORG_360_ACCESS_LINK } from '@/lib/org-accounts/links'
import { OrgAccountDetailView } from '@/domain/crm/org-account-detail-view'

export default function CrmOrganisation360DetailRoute() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''

  const router = useRouter()
  const { resolveAccessLink, parseRoutePath, modules } = useSidebarNavigation()
  const activeNav = parseRoutePath(ORG_360_ACCESS_LINK) ?? { moduleId: '199', menuId: '', submenuId: '' }
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
              <OrgAccountDetailView
                id={id}
                onBack={() => router.push(resolveAccessLink(ORG_360_ACCESS_LINK))}
                onNameKnown={setName}
              />
            </Suspense>
          </div>
        </BreadcrumbItemsProvider>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
