'use client'

/**
 * A Campaign's full-page detail view - /module/crm/marketing/campaigns/[id].
 * Same pattern as the Organizations detail route (see that file's own docblock).
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
import { CRM_CAMPAIGNS_ACCESS_LINK } from '@/lib/gtg-navigation'
import { crmService } from '@/services/crm'
import { CampaignDetailPage } from '@/domain/crm/campaign-detail-page'
import type { Campaign, CrmPicklistValue } from '@/types/crm'

const CAMPAIGNS_ACTIVE_NAV = { moduleId: '199', menuId: '200', submenuId: '' }

export default function CrmCampaignDetailRoute() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''

  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [picklists, setPicklists] = useState<{ campaignType: CrmPicklistValue[]; campaignStatus: CrmPicklistValue[]; expectedResponse: CrmPicklistValue[] }>({ campaignType: [], campaignStatus: [], expectedResponse: [] })

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    setIsLoading(true)
    setError('')
    try {
      const response = await crmService.getCampaign(context, id)
      setCampaign(response.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load this campaign.')
    } finally {
      setIsLoading(false)
    }
  }, [context, id])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    crmService.getPicklistValues(context, 'campaigns')
      .then((response) => {
        const c = response.data.campaigns ?? {}
        setPicklists({ campaignType: c.campaign_type ?? [], campaignStatus: c.campaign_status ?? [], expectedResponse: c.expected_response ?? [] })
      })
      .catch(() => { /* the form still works with empty dropdowns */ })
  }, [context])

  const backToCampaigns = () => router.push(resolveAccessLink(CRM_CAMPAIGNS_ACCESS_LINK))

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'CRM' },
    { label: 'Campaigns', href: CRM_CAMPAIGNS_ACCESS_LINK },
    { label: campaign ? campaign.name : '...' },
  ]

  return (
    <ProtectedLayout>
      <GtgPageShell initialActive={CAMPAIGNS_ACTIVE_NAV}>
        <BreadcrumbItemsProvider items={breadcrumbItems}>
          <GtgBreadcrumbFromContext />

          <div className="p-4 sm:p-6">
            {isLoading && (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Opening campaign…
              </div>
            )}

            {!isLoading && error && (
              <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-10 text-center text-sm text-destructive">
                <p>{error}</p>
                <Button variant="outline" size="sm" onClick={backToCampaigns}>Back to Campaigns</Button>
              </div>
            )}

            {!isLoading && !error && !campaign && (
              <div className="space-y-3 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                <p>This campaign could not be found, or you do not have access to it.</p>
                <Button variant="outline" size="sm" onClick={backToCampaigns}>Back to Campaigns</Button>
              </div>
            )}

            {!isLoading && !error && campaign && (
              <CampaignDetailPage campaign={campaign} onSaved={() => void load()} onBack={backToCampaigns} picklists={picklists} />
            )}
          </div>
        </BreadcrumbItemsProvider>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
