'use client'

/**
 * An Organization's full-page detail view - /module/crm/marketing/organizations/[id].
 * Same pattern as the Leads detail route (see that file's own docblock).
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
import { CRM_ORGANIZATIONS_ACCESS_LINK } from '@/lib/gtg-navigation'
import { crmService } from '@/services/crm'
import { OrganizationDetailPage } from '@/domain/crm/organization-detail-page'
import type { CrmPicklistValue, Organization } from '@/types/crm'

const ORGANIZATIONS_ACTIVE_NAV = { moduleId: '199', menuId: '200', submenuId: '' }

export default function CrmOrganizationDetailRoute() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''

  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])

  const [organization, setOrganization] = useState<Organization | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [picklists, setPicklists] = useState<{ accountType: CrmPicklistValue[]; industry: CrmPicklistValue[]; rating: CrmPicklistValue[] }>({ accountType: [], industry: [], rating: [] })

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    setIsLoading(true)
    setError('')
    try {
      const response = await crmService.getOrganization(context, id)
      setOrganization(response.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load this organization.')
    } finally {
      setIsLoading(false)
    }
  }, [context, id])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    crmService.getPicklistValues(context, 'organizations')
      .then((response) => {
        const org = response.data.organizations ?? {}
        setPicklists({ accountType: org.account_type ?? [], industry: org.industry ?? [], rating: org.rating ?? [] })
      })
      .catch(() => { /* the form still works with empty dropdowns */ })
  }, [context])

  const backToOrganizations = () => router.push(resolveAccessLink(CRM_ORGANIZATIONS_ACCESS_LINK))

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'CRM' },
    { label: 'Organizations', href: CRM_ORGANIZATIONS_ACCESS_LINK },
    { label: organization ? organization.name : '...' },
  ]

  return (
    <ProtectedLayout>
      <GtgPageShell initialActive={ORGANIZATIONS_ACTIVE_NAV}>
        <BreadcrumbItemsProvider items={breadcrumbItems}>
          <GtgBreadcrumbFromContext />

          <div className="p-4 sm:p-6">
            {isLoading && (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Opening organization…
              </div>
            )}

            {!isLoading && error && (
              <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-10 text-center text-sm text-destructive">
                <p>{error}</p>
                <Button variant="outline" size="sm" onClick={backToOrganizations}>Back to Organizations</Button>
              </div>
            )}

            {!isLoading && !error && !organization && (
              <div className="space-y-3 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                <p>This organization could not be found, or you do not have access to it.</p>
                <Button variant="outline" size="sm" onClick={backToOrganizations}>Back to Organizations</Button>
              </div>
            )}

            {!isLoading && !error && organization && (
              <OrganizationDetailPage organization={organization} onSaved={() => void load()} onBack={backToOrganizations} picklists={picklists} />
            )}
          </div>
        </BreadcrumbItemsProvider>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
