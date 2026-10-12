'use client'

/**
 * An FAQ's full-page detail view - /module/crm/support/faq/[id]. Same
 * `parseRoutePath`-resolved `initialActive` reasoning as the Asset/Ticket
 * detail routes - "Support" is a fresh menu insert, its id isn't guaranteed
 * to match between connections, so nothing here hardcodes it.
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
import { crmService } from '@/services/crm'
import { FaqDetailPage } from '@/domain/crm/faq-detail-page'
import type { CrmFaq, CrmPicklistValue } from '@/types/crm'

const CRM_FAQ_ACCESS_LINK = '/module/crm/support/faq'

export default function CrmFaqDetailRoute() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''

  const router = useRouter()
  const { resolveAccessLink, parseRoutePath } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])
  const activeNav = parseRoutePath(CRM_FAQ_ACCESS_LINK) ?? { moduleId: '199', menuId: '', submenuId: '' }

  const [faq, setFaq] = useState<CrmFaq | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [categories, setCategories] = useState<CrmPicklistValue[]>([])
  const [statuses, setStatuses] = useState<CrmPicklistValue[]>([])

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    setIsLoading(true)
    setError('')
    try {
      const response = await crmService.getFaq(context, id)
      setFaq(response.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load this FAQ.')
    } finally {
      setIsLoading(false)
    }
  }, [context, id])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    crmService.getPicklistValues(context, 'faqs')
      .then((response) => {
        setCategories(response.data.faqs?.category ?? [])
        setStatuses(response.data.faqs?.status ?? [])
      })
      .catch(() => { /* the page still works with empty dropdowns */ })
  }, [context])

  const backToFaqs = () => router.push(resolveAccessLink(CRM_FAQ_ACCESS_LINK))

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'CRM' },
    { label: 'FAQ', href: CRM_FAQ_ACCESS_LINK },
    { label: faq ? faq.question : '...' },
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
                Opening FAQ…
              </div>
            )}

            {!isLoading && error && (
              <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-10 text-center text-sm text-destructive">
                <p>{error}</p>
                <Button variant="outline" size="sm" onClick={backToFaqs}>Back to FAQ</Button>
              </div>
            )}

            {!isLoading && !error && !faq && (
              <div className="space-y-3 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                <p>This FAQ could not be found, or you do not have access to it.</p>
                <Button variant="outline" size="sm" onClick={backToFaqs}>Back to FAQ</Button>
              </div>
            )}

            {!isLoading && !error && faq && (
              <FaqDetailPage faq={faq} onSaved={() => void load()} onBack={backToFaqs} categories={categories} statuses={statuses} />
            )}
          </div>
        </BreadcrumbItemsProvider>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
