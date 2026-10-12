'use client'

/**
 * Cross-link to the already-shipped Contact detail screen (built under
 * Marketing) - same ContactDetailPage component, a second access_link/menu
 * entry under Support so back-navigation and sidebar active-state are
 * correct when reached from here, no new business logic. "Support" is a
 * fresh menu insert whose id isn't guaranteed to match between connections,
 * so `initialActive` is resolved dynamically via `parseRoutePath`.
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
import { ContactDetailPage } from '@/domain/crm/contact-detail-page'
import type { Contact, CrmPicklistValue } from '@/types/crm'

const CRM_SUPPORT_CONTACTS_ACCESS_LINK = '/module/crm/support/contacts'

export default function CrmSupportContactDetailRoute() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''

  const router = useRouter()
  const { resolveAccessLink, parseRoutePath } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])
  const activeNav = parseRoutePath(CRM_SUPPORT_CONTACTS_ACCESS_LINK) ?? { moduleId: '199', menuId: '', submenuId: '' }

  const [contact, setContact] = useState<Contact | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [picklists, setPicklists] = useState<{ salutation: CrmPicklistValue[]; leadSource: CrmPicklistValue[] }>({ salutation: [], leadSource: [] })

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    setIsLoading(true)
    setError('')
    try {
      const response = await crmService.getContact(context, id)
      setContact(response.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load this contact.')
    } finally {
      setIsLoading(false)
    }
  }, [context, id])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    crmService.getPicklistValues(context, 'contacts')
      .then((response) => {
        const c = response.data.contacts ?? {}
        setPicklists({ salutation: c.salutation ?? [], leadSource: c.lead_source ?? [] })
      })
      .catch(() => { /* the form still works with empty dropdowns */ })
  }, [context])

  const backToContacts = () => router.push(resolveAccessLink(CRM_SUPPORT_CONTACTS_ACCESS_LINK))

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'CRM' },
    { label: 'Contacts', href: CRM_SUPPORT_CONTACTS_ACCESS_LINK },
    { label: contact ? `${contact.firstName ?? ''} ${contact.lastName}`.trim() : '...' },
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
                Opening contact…
              </div>
            )}

            {!isLoading && error && (
              <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-10 text-center text-sm text-destructive">
                <p>{error}</p>
                <Button variant="outline" size="sm" onClick={backToContacts}>Back to Contacts</Button>
              </div>
            )}

            {!isLoading && !error && !contact && (
              <div className="space-y-3 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                <p>This contact could not be found, or you do not have access to it.</p>
                <Button variant="outline" size="sm" onClick={backToContacts}>Back to Contacts</Button>
              </div>
            )}

            {!isLoading && !error && contact && (
              <ContactDetailPage contact={contact} onSaved={() => void load()} onBack={backToContacts} picklists={picklists} />
            )}
          </div>
        </BreadcrumbItemsProvider>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
