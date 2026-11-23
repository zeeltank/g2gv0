'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { parseOldId, PORTFOLIO_ADDRESS, recordTarget, subProductTarget, type RawSearchParams } from '@/lib/portfolio-redirect'
import { ApiError } from '@/services/core'
import { portfolioListService } from '@/services/product-master/portfolio-list-service'

/** What an old address names: a CATALOGUE id (`/products/{id}`, `/services/{id}`) or a master record's id (`/products/lines/{id}`). */
export type RedirectLookup = { kind: 'catalogue'; id: string } | { kind: 'line'; id: string }

type State = { phase: 'working' } | { phase: 'not-found' } | { phase: 'error'; text: string }

/**
 * Sends a visitor from an old Products or Services address to the page of the same record, keeping the query. A catalogue id is looked up through
 * `GET /api/product-master/by-crm/{id}` (a record in the Recycle Bin is found too: its page says so); a Product line id through `GET /api/product-master/{id}`,
 * which says whether it is a Product (`/portfolio/{key}`) or a Sub-product (`/portfolio/products/{id}`). An id that is not a number, one that is not this
 * organisation's, and one that no longer exists all end in the same clear "could not be found" page, never in a blank screen.
 */
export function PortfolioRedirect({ lookup, params }: { lookup: RedirectLookup; params: RawSearchParams }) {
  const router = useRouter()
  const [state, setState] = useState<State>({ phase: 'working' })
  // Held in a ref so a parent that hands over a new object each render does not make the lookup run (and redirect) twice.
  const paramsRef = useRef(params)
  useEffect(() => { paramsRef.current = params })

  const run = useCallback(async () => {
    const id = parseOldId(lookup.id)
    if (id === null) {
      setState({ phase: 'not-found' })
      return
    }
    setState({ phase: 'working' })
    try {
      if (lookup.kind === 'catalogue') {
        const found = await portfolioListService.byCrm(id)
        router.replace(subProductTarget(found.data.id, paramsRef.current))
      } else {
        const found = await portfolioListService.head(id)
        router.replace(recordTarget(found.data, paramsRef.current))
      }
    } catch (cause) {
      if (cause instanceof ApiError && (cause.status === 404 || cause.status === 403)) setState({ phase: 'not-found' })
      else setState({ phase: 'error', text: cause instanceof Error ? cause.message : 'The address could not be opened.' })
    }
  }, [lookup.kind, lookup.id, router])

  useEffect(() => {
    let live = true
    Promise.resolve().then(() => { if (live) void run() })
    return () => { live = false }
  }, [run])

  if (state.phase === 'not-found') {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState
          title="This product could not be found"
          description="It may have been removed for good, or it belongs to another organisation."
          action={<Button asChild variant="outline"><Link href={PORTFOLIO_ADDRESS}>Go to the Product Portfolio</Link></Button>}
        />
      </div>
    )
  }
  if (state.phase === 'error') {
    return <div className="p-4 sm:p-6"><ErrorState title="This product could not be opened" description={state.text} retry={() => void run()} /></div>
  }
  return (
    <div role="status" className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      Opening the Product Portfolio…
    </div>
  )
}

/** The redirect inside the app's own frame (sign-in check, sidebar), so the not-found page looks like every other screen. */
export function PortfolioRedirectPage({ lookup, params }: { lookup: RedirectLookup; params: RawSearchParams }) {
  const { parseRoutePath } = useSidebarNavigation()
  const activeNav = parseRoutePath(PORTFOLIO_ADDRESS) ?? undefined
  return (
    <ProtectedLayout>
      <GtgPageShell initialActive={activeNav}>
        <PortfolioRedirect lookup={lookup} params={params} />
      </GtgPageShell>
    </ProtectedLayout>
  )
}
