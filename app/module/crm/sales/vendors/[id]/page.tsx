'use client'

/**
 * A Vendor's full-page detail view - /module/crm/sales/vendors/[id]. Same
 * `parseRoutePath`-resolved `initialActive` reasoning as the Price Book
 * detail route - "Sales" is a fresh menu insert, its id isn't guaranteed to
 * match between connections, so nothing here hardcodes it.
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
import { CRM_VENDORS_ACCESS_LINK, resolveBreadcrumb } from '@/lib/gtg-navigation'
import { crmService } from '@/services/crm'
import { VendorDetailPage } from '@/domain/crm/vendor-detail-page'
import type { CrmVendor } from '@/types/crm'

export default function CrmVendorDetailRoute() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''

  const router = useRouter()
  const { resolveAccessLink, parseRoutePath, modules } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])
  const activeNav = parseRoutePath(CRM_VENDORS_ACCESS_LINK) ?? { moduleId: '199', menuId: '', submenuId: '' }

  const [vendor, setVendor] = useState<CrmVendor | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    setIsLoading(true)
    setError('')
    try {
      const response = await crmService.getVendor(context, id)
      setVendor(response.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load this vendor.')
    } finally {
      setIsLoading(false)
    }
  }, [context, id])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  const backToVendors = () => router.push(resolveAccessLink(CRM_VENDORS_ACCESS_LINK))

  const breadcrumbItems = [
    ...resolveBreadcrumb(activeNav, modules),
    { label: vendor ? vendor.name : '...' },
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
                Opening vendor…
              </div>
            )}

            {!isLoading && error && (
              <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-10 text-center text-sm text-destructive">
                <p>{error}</p>
                <Button variant="outline" size="sm" onClick={backToVendors}>Back to Vendors</Button>
              </div>
            )}

            {!isLoading && !error && !vendor && (
              <div className="space-y-3 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                <p>This vendor could not be found, or you do not have access to it.</p>
                <Button variant="outline" size="sm" onClick={backToVendors}>Back to Vendors</Button>
              </div>
            )}

            {!isLoading && !error && vendor && (
              <VendorDetailPage vendor={vendor} onSaved={() => void load()} onBack={backToVendors} />
            )}
          </div>
        </BreadcrumbItemsProvider>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
