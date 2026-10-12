'use client'

/**
 * A Ticket's full-page detail view - /module/crm/support/tickets/[id]. Same
 * `parseRoutePath`-resolved `initialActive` reasoning as the Asset/Vendor
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
import { TicketDetailPage } from '@/domain/crm/ticket-detail-page'
import type { CrmPicklistValue, CrmTicket } from '@/types/crm'

const CRM_TICKETS_ACCESS_LINK = '/module/crm/support/tickets'

export default function CrmTicketDetailRoute() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''

  const router = useRouter()
  const { resolveAccessLink, parseRoutePath } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])
  const activeNav = parseRoutePath(CRM_TICKETS_ACCESS_LINK) ?? { moduleId: '199', menuId: '', submenuId: '' }

  const [ticket, setTicket] = useState<CrmTicket | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [ticketStatuses, setTicketStatuses] = useState<CrmPicklistValue[]>([])
  const [ticketPriorities, setTicketPriorities] = useState<CrmPicklistValue[]>([])

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    setIsLoading(true)
    setError('')
    try {
      const response = await crmService.getTicket(context, id)
      setTicket(response.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load this ticket.')
    } finally {
      setIsLoading(false)
    }
  }, [context, id])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    crmService.getPicklistValues(context, 'tickets')
      .then((response) => {
        setTicketStatuses(response.data.tickets?.status ?? [])
        setTicketPriorities(response.data.tickets?.priority ?? [])
      })
      .catch(() => { /* the page still works with empty dropdowns */ })
  }, [context])

  const backToTickets = () => router.push(resolveAccessLink(CRM_TICKETS_ACCESS_LINK))

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'CRM' },
    { label: 'Tickets', href: CRM_TICKETS_ACCESS_LINK },
    { label: ticket ? ticket.title : '...' },
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
                Opening ticket…
              </div>
            )}

            {!isLoading && error && (
              <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-10 text-center text-sm text-destructive">
                <p>{error}</p>
                <Button variant="outline" size="sm" onClick={backToTickets}>Back to Tickets</Button>
              </div>
            )}

            {!isLoading && !error && !ticket && (
              <div className="space-y-3 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                <p>This ticket could not be found, or you do not have access to it.</p>
                <Button variant="outline" size="sm" onClick={backToTickets}>Back to Tickets</Button>
              </div>
            )}

            {!isLoading && !error && ticket && (
              <TicketDetailPage
                ticket={ticket}
                onSaved={() => void load()}
                onBack={backToTickets}
                ticketStatuses={ticketStatuses}
                ticketPriorities={ticketPriorities}
              />
            )}
          </div>
        </BreadcrumbItemsProvider>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
