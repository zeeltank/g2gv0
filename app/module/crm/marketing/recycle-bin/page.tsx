'use client'

/**
 * The CRM Recycle Bin - /module/crm/marketing/recycle-bin.
 *
 * Outside the content-map tree, same as the 4 detail routes: there is no
 * menu row for this path (see CRM_RECYCLE_BIN_PATH), so it is a real,
 * bookmarkable GtgPageShell route rather than a GtgAppShell/content-map
 * entry. "Leads" is used as the closest stable ActiveNav anchor - CRM has
 * no menu id of its own to highlight for a page that spans all 4 modules.
 */

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'
import { BreadcrumbItemsProvider, GtgBreadcrumbFromContext } from '@/components/shell/gtg-breadcrumb'
import { RecycleBinView } from '@/domain/crm/recycle-bin-view'

const RECYCLE_BIN_ACTIVE_NAV = { moduleId: '199', menuId: '200', submenuId: '201' }

const breadcrumbItems = [
  { label: 'Home', href: '/' },
  { label: 'CRM' },
  { label: 'Recycle Bin' },
]

export default function CrmRecycleBinRoute() {
  return (
    <ProtectedLayout>
      <GtgPageShell initialActive={RECYCLE_BIN_ACTIVE_NAV}>
        <BreadcrumbItemsProvider items={breadcrumbItems}>
          <GtgBreadcrumbFromContext />
          <RecycleBinView />
        </BreadcrumbItemsProvider>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
