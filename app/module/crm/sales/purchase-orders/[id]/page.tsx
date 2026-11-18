'use client'

/** A Purchase Order's full-page detail view - /module/crm/sales/purchase-orders/[id]. Same dynamic-ActiveNav reasoning as the Quotes/Opportunities detail routes. */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'
import { BreadcrumbItemsProvider, GtgBreadcrumbFromContext } from '@/components/shell/gtg-breadcrumb'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { CRM_PURCHASE_ORDERS_ACCESS_LINK, resolveBreadcrumb } from '@/lib/gtg-navigation'
import { crmService } from '@/services/crm'
import { PurchaseOrderDetailPage } from '@/domain/crm/purchase-order-detail-page'
import type { CrmPicklistValue, CrmPurchaseOrder } from '@/types/crm'

export default function CrmPurchaseOrderDetailRoute() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''

  const router = useRouter()
  const { resolveAccessLink, parseRoutePath, modules } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])
  const activeNav = parseRoutePath(CRM_PURCHASE_ORDERS_ACCESS_LINK) ?? { moduleId: '199', menuId: '', submenuId: '' }

  const [purchaseOrder, setPurchaseOrder] = useState<CrmPurchaseOrder | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [poStages, setPoStages] = useState<CrmPicklistValue[]>([])

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    setIsLoading(true)
    setError('')
    try {
      const response = await crmService.getPurchaseOrder(context, id)
      setPurchaseOrder(response.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load this purchase order.')
    } finally {
      setIsLoading(false)
    }
  }, [context, id])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    crmService.getPicklistValues(context, 'purchase_orders')
      .then((response) => setPoStages(response.data.purchase_orders?.po_stage ?? []))
      .catch(() => { /* the form still works with empty dropdowns */ })
  }, [context])

  const backToPurchaseOrders = () => router.push(resolveAccessLink(CRM_PURCHASE_ORDERS_ACCESS_LINK))

  const breadcrumbItems = [
    ...resolveBreadcrumb(activeNav, modules),
    { label: purchaseOrder ? purchaseOrder.subject : '...' },
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
                Opening purchase order…
              </div>
            )}

            {!isLoading && error && (
              <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-10 text-center text-sm text-destructive">
                <p>{error}</p>
                <Button variant="outline" size="sm" onClick={backToPurchaseOrders}>Back to Purchase Orders</Button>
              </div>
            )}

            {!isLoading && !error && !purchaseOrder && (
              <div className="space-y-3 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                <p>This purchase order could not be found, or you do not have access to it.</p>
                <Button variant="outline" size="sm" onClick={backToPurchaseOrders}>Back to Purchase Orders</Button>
              </div>
            )}

            {!isLoading && !error && purchaseOrder && (
              <PurchaseOrderDetailPage purchaseOrder={purchaseOrder} onSaved={() => void load()} onBack={backToPurchaseOrders} poStages={poStages} />
            )}
          </div>
        </BreadcrumbItemsProvider>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
