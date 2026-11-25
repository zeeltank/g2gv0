'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { SectionCard } from '@/components/shared/business/shared'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import type { LaravelContext } from '@/lib/laravel-context'
import { contactsService } from '@/services/crm/contacts'
import type { ContactDealRow, ContactDeals } from '@/types/crm'
import { dealAmount, dealLabel, dealSubline } from './person-model'

type DealKey = keyof ContactDeals

/** The five groups of the Deals tab, in the order of the mock-up, and the menu row each record type's page lives under. */
const GROUPS: ReadonlyArray<{ key: DealKey; title: string; none: string; accessLink: string }> = [
  { key: 'opportunities', title: 'Opportunities', none: 'No opportunities yet.', accessLink: '/module/crm/sales/opportunities' },
  { key: 'quotes', title: 'Quotes', none: 'No quotes yet.', accessLink: '/module/crm/sales/quotes' },
  { key: 'salesOrders', title: 'Sales orders', none: 'No sales orders yet.', accessLink: '/module/crm/sales/sales-orders' },
  { key: 'invoices', title: 'Invoices', none: 'No invoices yet.', accessLink: '/module/crm/sales/invoices' },
  { key: 'tickets', title: 'Tickets', none: 'No tickets yet.', accessLink: '/module/crm/support/tickets' },
]

const UNRESOLVED = '/dashboard'

/**
 * What this person is on: the opportunities they are tagged on and the quotes, sales orders, invoices and tickets addressed to them, from
 * `GET /crm/contacts/{id}/deals` (one answer, one query per table on the server). A row opens that record's own page when the person's menu has the screen.
 */
export function PersonDeals({ context, personId }: { context: LaravelContext; personId: string }) {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; deals: ContactDeals }>({ kind: 'loading' })

  const load = useCallback(async () => {
    setState({ kind: 'loading' })
    try {
      const response = await contactsService.deals(context, personId)
      const data = response.data
      setState({
        kind: 'ready',
        deals: {
          opportunities: data?.opportunities ?? [], quotes: data?.quotes ?? [], salesOrders: data?.salesOrders ?? [],
          invoices: data?.invoices ?? [], tickets: data?.tickets ?? [],
        },
      })
    } catch (reason) {
      setState({ kind: 'error', message: reason instanceof Error ? reason.message : 'The deals could not be loaded.' })
    }
  }, [context, personId])

  useEffect(() => { queueMicrotask(() => { void load() }) }, [load])

  if (state.kind === 'loading') {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading deals…
      </div>
    )
  }
  if (state.kind === 'error') {
    return (
      <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
        <p>{state.message}</p>
        <Button size="sm" variant="outline" onClick={() => void load()}>Try again</Button>
      </div>
    )
  }

  const everything = GROUPS.reduce((sum, group) => sum + state.deals[group.key].length, 0)
  if (everything === 0) {
    return <EmptyState title="No deals yet" description="Opportunities, quotes, orders, invoices and tickets for this person will show up here." />
  }

  return (
    <div className="space-y-4">
      {GROUPS.map((group) => {
        const rows = state.deals[group.key]
        const base = resolveAccessLink(group.accessLink)
        return (
          <SectionCard key={group.key} title={`${group.title} (${rows.length})`}>
            {rows.length === 0 ? <p className="text-sm text-muted-foreground">{group.none}</p> : (
              <ul className="divide-y divide-border rounded-lg border border-border" data-deals={group.key}>
                {rows.map((row: ContactDealRow) => {
                  const amount = dealAmount(row)
                  const body = (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{dealLabel(row)}</span>
                        <span className="block truncate text-xs text-muted-foreground">{dealSubline(row)}</span>
                      </span>
                      {amount && <span className="shrink-0 text-sm font-semibold text-foreground">{amount}</span>}
                    </>
                  )
                  return (
                    <li key={String(row.id)}>
                      {base === UNRESOLVED ? (
                        <div className="flex w-full items-center gap-3 p-3">{body}</div>
                      ) : (
                        <button type="button" className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/50" onClick={() => router.push(`${base}/${row.id}`)}>{body}</button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </SectionCard>
        )
      })}
    </div>
  )
}
