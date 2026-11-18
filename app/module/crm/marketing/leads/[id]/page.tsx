'use client'

/**
 * A Lead's full-page detail view - /module/crm/marketing/leads/[id].
 *
 * Modeled verbatim on `app/organization/departments/[id]/page.tsx`: a real,
 * bookmarkable, refreshable URL sitting inside `GtgPageShell` with an
 * explicit breadcrumb, rather than the content-map's `GtgAppShell` - this
 * route is outside the content-map tree (there is no
 * `/module/crm/marketing/leads/[id]` entry in it). Unlike that precedent,
 * this one CAN pass a real `ActiveNav` (CRM's own menu/submenu ids are known
 * and stable), so the sidebar correctly stays highlighted on "Leads" while
 * viewing a lead's detail page.
 *
 * Loading the lead (and keeping the page mounted across a reload) lives in
 * `LeadDetailScreen`; this file is the shell and the breadcrumb.
 */

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'
import { BreadcrumbItemsProvider, GtgBreadcrumbFromContext } from '@/components/shell/gtg-breadcrumb'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { CRM_LEADS_ACCESS_LINK, resolveBreadcrumb } from '@/lib/gtg-navigation'
import { LeadDetailScreen } from '@/domain/crm/lead-detail-screen'
import type { Lead } from '@/types/crm'

const LEADS_ACTIVE_NAV = { moduleId: '199', menuId: '200', submenuId: '201' }

export default function CrmLeadDetailRoute() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''

  const router = useRouter()
  const { resolveAccessLink, modules } = useSidebarNavigation()
  const [lead, setLead] = useState<Lead | null>(null)

  const backToLeads = () => router.push(resolveAccessLink(CRM_LEADS_ACCESS_LINK))

  const breadcrumbItems = [
    ...resolveBreadcrumb(LEADS_ACTIVE_NAV, modules),
    { label: lead ? `${lead.firstName ? lead.firstName + ' ' : ''}${lead.lastName}` : '...' },
  ]

  return (
    <ProtectedLayout>
      <GtgPageShell initialActive={LEADS_ACTIVE_NAV}>
        <BreadcrumbItemsProvider items={breadcrumbItems}>
          <GtgBreadcrumbFromContext />

          <div className="p-4 sm:p-6">
            <LeadDetailScreen id={id} onBack={backToLeads} onLead={setLead} />
          </div>
        </BreadcrumbItemsProvider>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
