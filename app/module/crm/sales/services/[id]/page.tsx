'use client'

/** A Service's full-page detail view - /module/crm/sales/services/[id]. Same dynamic-ActiveNav reasoning as the Products detail route. */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'
import { BreadcrumbItemsProvider, GtgBreadcrumbFromContext } from '@/components/shell/gtg-breadcrumb'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { CRM_SERVICES_ACCESS_LINK } from '@/lib/gtg-navigation'
import { crmService } from '@/services/crm'
import { ProductDetailPage } from '@/domain/crm/product-detail-page'
import type { CrmPicklistValue, CrmProduct, CrmTaxRate } from '@/types/crm'

export default function CrmServiceDetailRoute() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''

  const router = useRouter()
  const { resolveAccessLink, parseRoutePath } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])
  const activeNav = parseRoutePath(CRM_SERVICES_ACCESS_LINK) ?? { moduleId: '199', menuId: '', submenuId: '' }

  const [service, setService] = useState<CrmProduct | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [categories, setCategories] = useState<CrmPicklistValue[]>([])
  const [taxRates, setTaxRates] = useState<CrmTaxRate[]>([])

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    setIsLoading(true)
    setError('')
    try {
      const response = await crmService.getProduct(context, id)
      setService(response.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load this service.')
    } finally {
      setIsLoading(false)
    }
  }, [context, id])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    crmService.getPicklistValues(context, 'products')
      .then((response) => setCategories(response.data.products?.category ?? []))
      .catch(() => { /* the form still works with an empty dropdown */ })
    crmService.getTaxRates(context)
      .then((response) => setTaxRates(response.data))
      .catch(() => { /* the form still works with no tax-rate options */ })
  }, [context])

  const backToServices = () => router.push(resolveAccessLink(CRM_SERVICES_ACCESS_LINK))

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'CRM' },
    { label: 'Services', href: CRM_SERVICES_ACCESS_LINK },
    { label: service ? service.name : '...' },
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
                Opening service…
              </div>
            )}

            {!isLoading && error && (
              <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-10 text-center text-sm text-destructive">
                <p>{error}</p>
                <Button variant="outline" size="sm" onClick={backToServices}>Back to Services</Button>
              </div>
            )}

            {!isLoading && !error && !service && (
              <div className="space-y-3 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                <p>This service could not be found, or you do not have access to it.</p>
                <Button variant="outline" size="sm" onClick={backToServices}>Back to Services</Button>
              </div>
            )}

            {!isLoading && !error && service && (
              <ProductDetailPage product={service} onSaved={() => void load()} onBack={backToServices} categories={categories} taxRates={taxRates} />
            )}
          </div>
        </BreadcrumbItemsProvider>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
