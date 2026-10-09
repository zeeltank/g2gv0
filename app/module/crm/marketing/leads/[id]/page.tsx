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
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'
import { BreadcrumbItemsProvider, GtgBreadcrumbFromContext } from '@/components/shell/gtg-breadcrumb'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { CRM_LEADS_ACCESS_LINK } from '@/lib/gtg-navigation'
import { crmService } from '@/services/crm'
import { LeadDetailPage } from '@/domain/crm/lead-detail-page'
import type { CrmPicklistValue, Lead } from '@/types/crm'

const LEADS_ACTIVE_NAV = { moduleId: '199', menuId: '200', submenuId: '201' }

export default function CrmLeadDetailRoute() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''

  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])

  const [lead, setLead] = useState<Lead | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [picklists, setPicklists] = useState<{
    leadStatus: CrmPicklistValue[]; leadSource: CrmPicklistValue[]
    industry: CrmPicklistValue[]; rating: CrmPicklistValue[]
  }>({ leadStatus: [], leadSource: [], industry: [], rating: [] })

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    setIsLoading(true)
    setError('')
    try {
      const response = await crmService.getLead(context, id)
      setLead(response.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load this lead.')
    } finally {
      setIsLoading(false)
    }
  }, [context, id])

  useEffect(() => {
    // Deferred so the load's first setState lands after this render.
    queueMicrotask(() => { void load() })
  }, [load])

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    crmService.getPicklistValues(context, 'leads')
      .then((response) => {
        const leads = response.data.leads ?? {}
        setPicklists({
          leadStatus: leads.lead_status ?? [], leadSource: leads.lead_source ?? [],
          industry: leads.industry ?? [], rating: leads.rating ?? [],
        })
      })
      .catch(() => { /* the detail page still works with empty dropdowns */ })
  }, [context])

  const backToLeads = () => router.push(resolveAccessLink(CRM_LEADS_ACCESS_LINK))

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'CRM' },
    { label: 'Leads', href: CRM_LEADS_ACCESS_LINK },
    { label: lead ? `${lead.firstName ? lead.firstName + ' ' : ''}${lead.lastName}` : '...' },
  ]

  return (
    <ProtectedLayout>
      <GtgPageShell initialActive={LEADS_ACTIVE_NAV}>
        <BreadcrumbItemsProvider items={breadcrumbItems}>
          <GtgBreadcrumbFromContext />

          <div className="p-4 sm:p-6">
            {isLoading && (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Opening lead…
              </div>
            )}

            {!isLoading && error && (
              <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-10 text-center text-sm text-destructive">
                <p>{error}</p>
                <Button variant="outline" size="sm" onClick={backToLeads}>Back to Leads</Button>
              </div>
            )}

            {!isLoading && !error && !lead && (
              <div className="space-y-3 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                <p>This lead could not be found, or you do not have access to it.</p>
                <Button variant="outline" size="sm" onClick={backToLeads}>Back to Leads</Button>
              </div>
            )}

            {!isLoading && !error && lead && (
              <LeadDetailPage lead={lead} onSaved={() => void load()} onBack={backToLeads} picklists={picklists} />
            )}
          </div>
        </BreadcrumbItemsProvider>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
