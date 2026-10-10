'use client'

/** An Opportunity's full-page detail view - /module/crm/sales/opportunities/[id]. Same dynamic-ActiveNav reasoning as the Products detail route. */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'
import { BreadcrumbItemsProvider, GtgBreadcrumbFromContext } from '@/components/shell/gtg-breadcrumb'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { CRM_OPPORTUNITIES_ACCESS_LINK } from '@/lib/gtg-navigation'
import { crmService } from '@/services/crm'
import { OpportunityDetailPage } from '@/domain/crm/opportunity-detail-page'
import type { CrmOpportunity, CrmPicklistValue } from '@/types/crm'

export default function CrmOpportunityDetailRoute() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''

  const router = useRouter()
  const { resolveAccessLink, parseRoutePath } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])
  const activeNav = parseRoutePath(CRM_OPPORTUNITIES_ACCESS_LINK) ?? { moduleId: '199', menuId: '', submenuId: '' }

  const [opportunity, setOpportunity] = useState<CrmOpportunity | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [picklists, setPicklists] = useState<{ salesStage: CrmPicklistValue[]; leadSource: CrmPicklistValue[]; potentialType: CrmPicklistValue[]; forecastCategory: CrmPicklistValue[] }>({ salesStage: [], leadSource: [], potentialType: [], forecastCategory: [] })

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    setIsLoading(true)
    setError('')
    try {
      const response = await crmService.getOpportunity(context, id)
      setOpportunity(response.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load this opportunity.')
    } finally {
      setIsLoading(false)
    }
  }, [context, id])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    crmService.getPicklistValues(context, 'opportunities')
      .then((response) => {
        const opp = response.data.opportunities ?? {}
        setPicklists({
          salesStage: opp.sales_stage ?? [], leadSource: opp.lead_source ?? [],
          potentialType: opp.potential_type ?? [], forecastCategory: opp.forecast_category ?? [],
        })
      })
      .catch(() => { /* the form still works with empty dropdowns */ })
  }, [context])

  const backToOpportunities = () => router.push(resolveAccessLink(CRM_OPPORTUNITIES_ACCESS_LINK))

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'CRM' },
    { label: 'Opportunities', href: CRM_OPPORTUNITIES_ACCESS_LINK },
    { label: opportunity ? opportunity.name : '...' },
  ]

  return (
    <ProtectedLayout>
      <GtgPageShell initialActive={activeNav}>
        <BreadcrumbItemsProvider items={breadcrumbItems}>
          <GtgBreadcrumbFromContext />

          <div className="p-4 sm:p-6">
            {isLoading && (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Opening opportunity…
              </div>
            )}

            {!isLoading && error && (
              <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-10 text-center text-sm text-destructive">
                <p>{error}</p>
                <Button variant="outline" size="sm" onClick={backToOpportunities}>Back to Opportunities</Button>
              </div>
            )}

            {!isLoading && !error && !opportunity && (
              <div className="space-y-3 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                <p>This opportunity could not be found, or you do not have access to it.</p>
                <Button variant="outline" size="sm" onClick={backToOpportunities}>Back to Opportunities</Button>
              </div>
            )}

            {!isLoading && !error && opportunity && (
              <OpportunityDetailPage opportunity={opportunity} onSaved={() => void load()} onBack={backToOpportunities} picklists={picklists} />
            )}
          </div>
        </BreadcrumbItemsProvider>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
