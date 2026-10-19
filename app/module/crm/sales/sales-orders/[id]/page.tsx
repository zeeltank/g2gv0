'use client'

/** A Sales Order's full-page detail view - /module/crm/sales/sales-orders/[id]. Same dynamic-ActiveNav reasoning as the Quotes/Opportunities detail routes. */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'
import { BreadcrumbItemsProvider, GtgBreadcrumbFromContext } from '@/components/shell/gtg-breadcrumb'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { resolveBreadcrumb } from '@/lib/gtg-navigation'
import { crmService } from '@/services/crm'
import { SalesOrderDetailPage } from '@/domain/crm/sales-order-detail-page'
import type { CrmPicklistValue, CrmSalesOrder } from '@/types/crm'

const CRM_SALES_ORDERS_ACCESS_LINK = '/module/crm/sales/sales-orders'

export default function CrmSalesOrderDetailRoute() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''

  const router = useRouter()
  const { resolveAccessLink, parseRoutePath, modules } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])
  const activeNav = parseRoutePath(CRM_SALES_ORDERS_ACCESS_LINK) ?? { moduleId: '199', menuId: '', submenuId: '' }

  const [salesOrder, setSalesOrder] = useState<CrmSalesOrder | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [soStages, setSoStages] = useState<CrmPicklistValue[]>([])

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    setIsLoading(true)
    setError('')
    try {
      const response = await crmService.getSalesOrder(context, id)
      setSalesOrder(response.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load this sales order.')
    } finally {
      setIsLoading(false)
    }
  }, [context, id])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    crmService.getPicklistValues(context, 'sales_orders')
      .then((response) => setSoStages(response.data.sales_orders?.so_stage ?? []))
      .catch(() => { /* the form still works with empty dropdowns */ })
  }, [context])

  const backToSalesOrders = () => router.push(resolveAccessLink(CRM_SALES_ORDERS_ACCESS_LINK))

  const breadcrumbItems = [
    ...resolveBreadcrumb(activeNav, modules),
    { label: salesOrder ? salesOrder.subject : '...' },
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
                Opening sales order…
              </div>
            )}

            {!isLoading && error && (
              <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-10 text-center text-sm text-destructive">
                <p>{error}</p>
                <Button variant="outline" size="sm" onClick={backToSalesOrders}>Back to Sales Orders</Button>
              </div>
            )}

            {!isLoading && !error && !salesOrder && (
              <div className="space-y-3 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                <p>This sales order could not be found, or you do not have access to it.</p>
                <Button variant="outline" size="sm" onClick={backToSalesOrders}>Back to Sales Orders</Button>
              </div>
            )}

            {!isLoading && !error && salesOrder && (
              <SalesOrderDetailPage salesOrder={salesOrder} onSaved={() => void load()} onBack={backToSalesOrders} soStages={soStages} />
            )}
          </div>
        </BreadcrumbItemsProvider>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
