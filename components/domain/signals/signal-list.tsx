'use client'

import { useCallback, useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import type { LaravelContext } from '@/lib/laravel-context'
import { formatRunDate } from '@/lib/run-dates'
import { ApiError } from '@/services/core'
import { opportunitiesService, type Opportunity, type OpportunityListResponse } from '@/services/signals/opportunities'
import { SignalCard } from '@/components/domain/signals/scholar-signals-view'

const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError || e instanceof Error ? e.message : fallback)

/**
 * The one list of signals: what one product's successful research runs saved on one day. It only reads stored rows (the product filter is the
 * product stored on each record; the day is the run's own date), so choosing a product or a day never starts research. Re-read when `refreshKey`
 * changes (after a run finishes or a person refreshes).
 */
export function SignalList({
  context, productKey, productLabel, runDate, refreshKey, onTotal,
}: {
  context: LaravelContext
  productKey: string
  productLabel: string
  /** YYYY-MM-DD of a successful run, or null when the product has none yet. */
  runDate: string | null
  refreshKey: number
  onTotal?: (total: number | null) => void
}) {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<OpportunityListResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  // Another product or another day: start from page one with nothing of the previous view on screen.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1); setData(null); setError(null); setActionError(null)
  }, [productKey, runDate])

  const load = useCallback(async () => {
    if (!runDate) {
      setData(null)
      onTotal?.(null)
      return
    }
    setLoading(true)
    try {
      // Signals that have passed their closing date are part of that day's results, so they are included.
      const res = await opportunitiesService.list(context, { product: productKey, runDate, search: debounced || undefined, page, expired: 'include' })
      setData(res)
      setError(null)
      onTotal?.(res.meta.total)
    } catch (e) {
      setError(errMsg(e, 'Could not load the signals.'))
      onTotal?.(null)
    } finally {
      setLoading(false)
    }
  }, [context, productKey, runDate, debounced, page, onTotal])

  useEffect(() => {
    let live = true
    Promise.resolve().then(() => { if (live) void load() })
    return () => { live = false }
  }, [load, refreshKey])

  const act = async (o: Opportunity, action: 'review' | 'follow-up' | 'dismiss') => {
    setActionError(null)
    try {
      await opportunitiesService.act(context, o.id, action)
      void load()
    } catch (e) {
      setActionError(errMsg(e, 'Could not update the signal.'))
    }
  }

  if (!runDate) {
    return <EmptyState title="No successful research dates yet" description={`Press Generate Signals to run research for ${productLabel}. Its results are kept here by date.`} />
  }
  if (error) return <ErrorState title="Could not load the signals" description={error} retry={() => void load()} />
  if (!data) return <div className="space-y-3" aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}</div>

  const items = data.data

  return (
    <div className="space-y-4" aria-busy={loading}>
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search these signals…" aria-label="Search signals" className="h-9 w-full max-w-sm text-sm" />
      {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
      {items.length === 0 ? (
        <EmptyState
          title={debounced ? 'No signals match this search' : 'No qualified signals on this date'}
          description={debounced ? 'Try a different search.' : `The ${formatRunDate(runDate)} research finished, but no ${productLabel} opportunity had enough evidence to qualify. Nothing was made up to fill the list.`}
        />
      ) : (
        <div className="space-y-4">
          {items.map((o) => <SignalCard key={o.id} o={o} onAct={act} runDateLabel={o.report_date ? formatRunDate(o.report_date) : null} />)}
          {data.meta.last_page > 1 && (
            <div className="flex items-center justify-center gap-3 text-sm">
              <Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Previous</Button>
              <span className="text-muted-foreground">Page {page} of {data.meta.last_page}</span>
              <Button size="sm" variant="outline" disabled={page >= data.meta.last_page || loading} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
