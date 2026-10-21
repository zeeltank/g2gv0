'use client'

/**
 * An Email Template's full-page detail view -
 * /module/crm/support/email-templates/[id]. Same `parseRoutePath`-resolved
 * `initialActive` reasoning as the Price Book/FAQ detail routes - this is a
 * fresh route with no guaranteed menu-row id yet, so nothing here hardcodes
 * one; `EMAIL_TEMPLATES_ACCESS_LINK` is this route's own local constant (not
 * imported from lib/gtg-navigation.ts), same precedent FAQ's own
 * [id]/page.tsx already set for CRM_FAQ_ACCESS_LINK.
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
import { EmailTemplateDetailPage } from '@/domain/crm/email-template-detail-page'
import type { CrmEmailTemplate } from '@/types/crm'

const EMAIL_TEMPLATES_ACCESS_LINK = '/module/crm/support/email-templates'

export default function CrmEmailTemplateDetailRoute() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''

  const router = useRouter()
  const { parseRoutePath } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])
  const activeNav = parseRoutePath(EMAIL_TEMPLATES_ACCESS_LINK) ?? { moduleId: '199', menuId: '', submenuId: '' }

  const [template, setTemplate] = useState<CrmEmailTemplate | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    setIsLoading(true)
    setError('')
    try {
      const response = await crmService.getEmailTemplate(context, id)
      setTemplate(response.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load this email template.')
    } finally {
      setIsLoading(false)
    }
  }, [context, id])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  const backToTemplates = () => router.push(EMAIL_TEMPLATES_ACCESS_LINK)

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'CRM' },
    { label: 'Email Templates', href: EMAIL_TEMPLATES_ACCESS_LINK },
    { label: template ? template.name : '...' },
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
                Opening email template…
              </div>
            )}

            {!isLoading && error && (
              <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-10 text-center text-sm text-destructive">
                <p>{error}</p>
                <Button variant="outline" size="sm" onClick={backToTemplates}>Back to Email Templates</Button>
              </div>
            )}

            {!isLoading && !error && !template && (
              <div className="space-y-3 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                <p>This email template could not be found, or you do not have access to it.</p>
                <Button variant="outline" size="sm" onClick={backToTemplates}>Back to Email Templates</Button>
              </div>
            )}

            {!isLoading && !error && template && (
              <EmailTemplateDetailPage template={template} onSaved={() => void load()} onBack={backToTemplates} />
            )}
          </div>
        </BreadcrumbItemsProvider>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
