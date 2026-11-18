'use client'

/** An Invoice's full-page detail view - /module/crm/sales/invoices/[id]. Same dynamic-ActiveNav reasoning as the Quotes/Opportunities detail routes. */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'
import { BreadcrumbItemsProvider, GtgBreadcrumbFromContext } from '@/components/shell/gtg-breadcrumb'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { CRM_INVOICES_ACCESS_LINK, resolveBreadcrumb } from '@/lib/gtg-navigation'
import { crmService } from '@/services/crm'
import { InvoiceDetailPage } from '@/domain/crm/invoice-detail-page'
import type { CrmInvoice, CrmPicklistValue } from '@/types/crm'

export default function CrmInvoiceDetailRoute() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''

  const router = useRouter()
  const { resolveAccessLink, parseRoutePath, modules } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])
  const activeNav = parseRoutePath(CRM_INVOICES_ACCESS_LINK) ?? { moduleId: '199', menuId: '', submenuId: '' }

  const [invoice, setInvoice] = useState<CrmInvoice | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [invoiceStages, setInvoiceStages] = useState<CrmPicklistValue[]>([])

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    setIsLoading(true)
    setError('')
    try {
      const response = await crmService.getInvoice(context, id)
      setInvoice(response.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load this invoice.')
    } finally {
      setIsLoading(false)
    }
  }, [context, id])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    crmService.getPicklistValues(context, 'invoices')
      .then((response) => setInvoiceStages(response.data.invoices?.invoice_stage ?? []))
      .catch(() => { /* the form still works with empty dropdowns */ })
  }, [context])

  const backToInvoices = () => router.push(resolveAccessLink(CRM_INVOICES_ACCESS_LINK))

  const breadcrumbItems = [
    ...resolveBreadcrumb(activeNav, modules),
    { label: invoice ? invoice.subject : '...' },
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
                Opening invoice…
              </div>
            )}

            {!isLoading && error && (
              <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-10 text-center text-sm text-destructive">
                <p>{error}</p>
                <Button variant="outline" size="sm" onClick={backToInvoices}>Back to Invoices</Button>
              </div>
            )}

            {!isLoading && !error && !invoice && (
              <div className="space-y-3 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                <p>This invoice could not be found, or you do not have access to it.</p>
                <Button variant="outline" size="sm" onClick={backToInvoices}>Back to Invoices</Button>
              </div>
            )}

            {!isLoading && !error && invoice && (
              <InvoiceDetailPage invoice={invoice} onSaved={() => void load()} onBack={backToInvoices} invoiceStages={invoiceStages} />
            )}
          </div>
        </BreadcrumbItemsProvider>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
