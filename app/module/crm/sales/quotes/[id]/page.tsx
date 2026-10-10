'use client'

/** A Quote's full-page detail view - /module/crm/sales/quotes/[id]. Same dynamic-ActiveNav reasoning as the Opportunities/Products detail routes. */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'
import { BreadcrumbItemsProvider, GtgBreadcrumbFromContext } from '@/components/shell/gtg-breadcrumb'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { CRM_QUOTES_ACCESS_LINK } from '@/lib/gtg-navigation'
import { crmService } from '@/services/crm'
import { QuoteDetailPage } from '@/domain/crm/quote-detail-page'
import type { CrmPicklistValue, CrmQuote } from '@/types/crm'

export default function CrmQuoteDetailRoute() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''

  const router = useRouter()
  const { resolveAccessLink, parseRoutePath } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])
  const activeNav = parseRoutePath(CRM_QUOTES_ACCESS_LINK) ?? { moduleId: '199', menuId: '', submenuId: '' }

  const [quote, setQuote] = useState<CrmQuote | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [quoteStages, setQuoteStages] = useState<CrmPicklistValue[]>([])

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    setIsLoading(true)
    setError('')
    try {
      const response = await crmService.getQuote(context, id)
      setQuote(response.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load this quote.')
    } finally {
      setIsLoading(false)
    }
  }, [context, id])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    crmService.getPicklistValues(context, 'quotes')
      .then((response) => setQuoteStages(response.data.quotes?.quote_stage ?? []))
      .catch(() => { /* the form still works with empty dropdowns */ })
  }, [context])

  const backToQuotes = () => router.push(resolveAccessLink(CRM_QUOTES_ACCESS_LINK))

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'CRM' },
    { label: 'Quotes', href: CRM_QUOTES_ACCESS_LINK },
    { label: quote ? quote.subject : '...' },
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
                Opening quote…
              </div>
            )}

            {!isLoading && error && (
              <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-10 text-center text-sm text-destructive">
                <p>{error}</p>
                <Button variant="outline" size="sm" onClick={backToQuotes}>Back to Quotes</Button>
              </div>
            )}

            {!isLoading && !error && !quote && (
              <div className="space-y-3 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                <p>This quote could not be found, or you do not have access to it.</p>
                <Button variant="outline" size="sm" onClick={backToQuotes}>Back to Quotes</Button>
              </div>
            )}

            {!isLoading && !error && quote && (
              <QuoteDetailPage quote={quote} onSaved={() => void load()} onBack={backToQuotes} quoteStages={quoteStages} />
            )}
          </div>
        </BreadcrumbItemsProvider>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
