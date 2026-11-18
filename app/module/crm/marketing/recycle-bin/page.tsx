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
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { resolveBreadcrumb } from '@/lib/gtg-navigation'
import { RecycleBinView } from '@/domain/crm/recycle-bin-view'

// "Leads" is used as the closest stable sidebar-highlight anchor (see the
// docblock above) - but that same submenu would read as a wrong, confusing
// breadcrumb segment ("Sales & Marketing > Marketing > Leads > Recycle Bin"),
// so the breadcrumb resolves only as far as the module itself instead.
const RECYCLE_BIN_ACTIVE_NAV = { moduleId: '199', menuId: '200', submenuId: '201' }
const RECYCLE_BIN_BREADCRUMB_NAV = { moduleId: '199', menuId: '', submenuId: '' }

export default function CrmRecycleBinRoute() {
  const { modules } = useSidebarNavigation()
  const breadcrumbItems = [
    ...resolveBreadcrumb(RECYCLE_BIN_BREADCRUMB_NAV, modules),
    { label: 'Recycle Bin' },
  ]

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
