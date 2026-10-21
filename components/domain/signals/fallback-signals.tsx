'use client'

import { useCallback, useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { LaravelContext } from '@/lib/laravel-context'
import { fallbackHeading, isOtherDay } from '@/lib/signal-fallback'
import { formatRunDate } from '@/lib/run-dates'
import { ApiError } from '@/services/core'
import { opportunitiesService, type Opportunity, type OpportunityListResponse } from '@/services/signals/opportunities'
import { SignalCard } from '@/components/domain/signals/scholar-signals-view'

/**
 * The latest genuine saved signals of the product, shown under the chosen date when that date saved none. It only reads stored rows; it does not
 * count towards the chosen date's total and never starts research. Each card keeps the research date it was found in.
 */
export function FallbackSignals({
  context, productKey, productLabel, chosenDate, refreshKey, empty,
}: {
  context: LaravelContext
  productKey: string
  productLabel: string
  chosenDate: string
  refreshKey: number
  /** What to show when the product has no saved signals at all: a setup / diagnostic state (never a fake card). */
  empty: React.ReactNode
}) {
  const [data, setData] = useState<OpportunityListResponse | null>(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await opportunitiesService.list(context, { product: productKey, latestSaved: true, page, expired: 'include' }))
      setError(null)
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Could not load the earlier signals.')
    } finally {
      setLoading(false)
    }
  }, [context, productKey, page])

  useEffect(() => {
    let live = true
    Promise.resolve().then(() => { if (live) void load() })
    return () => { live = false }
  }, [load, refreshKey])

  const act = async (o: Opportunity, action: 'review' | 'follow-up' | 'dismiss') => {
    try {
      await opportunitiesService.act(context, o.id, action)
      void load()
    } catch { /* the card keeps its state; the next load shows the truth */ }
  }

  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>
  if (!data) return <div className="space-y-3" aria-busy="true"><Skeleton className="h-40 w-full rounded-2xl" /></div>

  const original = data.meta.resolved_run_date
  if (!isOtherDay(original, chosenDate) || data.data.length === 0) return <>{empty}</>

  return (
    <section aria-label={`Previously generated ${productLabel} signals`} className="space-y-4" data-testid="fallback-signals">
      <div role="status" className="flex items-start gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-sm">
        <History className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <p className="min-w-0 break-words">
          <span className="font-medium">{fallbackHeading(formatRunDate(original))}</span>{' '}
          <span className="text-muted-foreground">These are not new for {formatRunDate(chosenDate)}; each card shows the research run it came from.</span>
        </p>
      </div>
      <div className="space-y-4">
        {data.data.map((o) => <SignalCard key={o.id} o={o} onAct={act} runDateLabel={o.report_date ? formatRunDate(o.report_date) : null} />)}
      </div>
      {data.meta.last_page > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-muted-foreground">Page {page} of {data.meta.last_page}</span>
          <Button size="sm" variant="outline" disabled={page >= data.meta.last_page || loading} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </section>
  )
}
