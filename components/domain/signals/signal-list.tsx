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
import { FallbackSignals } from '@/components/domain/signals/fallback-signals'
import { wantsFallback } from '@/lib/signal-fallback'
import { rangeText } from '@/lib/signal-dates'

/** Signals shown per page. */
export const SIGNALS_PER_PAGE = 5

const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError || e instanceof Error ? e.message : fallback)

/**
 * The one list of signals: what one product's successful research runs saved on one day. It only reads stored rows (the product filter is the
 * product stored on each record; the day is the run's own date), so choosing a product or a day never starts research. Re-read when `refreshKey`
 * changes (after a run finishes or a person refreshes).
 */
export function SignalList({
  context, productKey, productLabel, runDate, refreshKey, onTotal, dayInfo,
}: {
  context: LaravelContext
  productKey: string
  productLabel: string
  /** YYYY-MM-DD of a successful run, or null when the product has none yet. */
  runDate: string | null
  refreshKey: number
  onTotal?: (total: number | null) => void
  /** What that day's runs did (from the run history), used to explain an empty day. */
  dayInfo?: { searches: number; sources: number; organisations: number; rejected: number; note: string | null } | null
}) {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [view, setView] = useState<'all' | 'immediate_action' | 'watchlist'>('all')
  const [status, setStatus] = useState('')
  const [data, setData] = useState<OpportunityListResponse | null>(null)
  // The two view counts, taken from the unfiltered listing (a filtered listing would count only itself).
  const [counts, setCounts] = useState<{ immediate: number; watchlist: number } | null>(null)
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
    setPage(1); setData(null); setError(null); setActionError(null); setView('all'); setStatus(''); setCounts(null)
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
      const res = await opportunitiesService.list(context, { product: productKey, runDate, search: debounced || undefined, feedSection: view === 'all' ? undefined : view, reviewStatus: status || undefined, page, perPage: SIGNALS_PER_PAGE, expired: 'include' })
      setData(res)
      if (view === 'all' && !status && !debounced) setCounts({ immediate: res.summary.immediate ?? 0, watchlist: res.summary.watchlist ?? 0 })
      setError(null)
      onTotal?.(res.meta.total)
    } catch (e) {
      setError(errMsg(e, 'Could not load the signals.'))
      onTotal?.(null)
    } finally {
      setLoading(false)
    }
  }, [context, productKey, runDate, debounced, view, status, page, onTotal])

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
      <div className="flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-label="Which signals" className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5 text-sm">
          {([['all', 'All', 'Every signal saved on this date'], ['immediate_action', 'Approach now', 'A school is asking for, hiring for, or tendering for what we sell'], ['watchlist', 'Watching', 'Events that usually lead to a purchase, and schools worth keeping an eye on']] as const).map(([id, label, hint]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={view === id}
              title={hint}
              onClick={() => { setView(id); setPage(1) }}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${view === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {label}
              {counts && id !== 'all' && <span className="ml-1.5 text-xs text-muted-foreground">{id === 'immediate_action' ? counts.immediate : counts.watchlist}</span>}
            </button>
          ))}
        </div>
        <select
          aria-label="Review status"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Any status</option>
          <option value="New">New</option>
          <option value="Reviewed">Reviewed</option>
          <option value="Follow-up">Contacted</option>
          <option value="Dismissed">Not relevant</option>
        </select>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search these signals…" aria-label="Search signals" className="h-9 w-full max-w-xs text-sm" />
      </div>
      {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
      {items.length === 0 ? (
        wantsFallback({ itemCount: items.length, search: debounced, view, status, loaded: !loading }) ? (
          <FallbackSignals
            context={context}
            productKey={productKey}
            productLabel={productLabel}
            chosenDate={runDate}
            refreshKey={refreshKey}
            empty={
              <EmptyState
                title={`No saved ${productLabel} signals yet`}
                description={`Press Generate Signals to run research for ${productLabel}. Its results are kept here by date.`}
                action={dayInfo ? (
                  <div className="max-w-xl space-y-1 text-left text-xs text-muted-foreground">
                    <p>What the {formatRunDate(runDate)} run did: {dayInfo.searches} searches, {dayInfo.sources} pages found, {dayInfo.organisations} organisations looked at, {dayInfo.rejected} failed the checks.</p>
                    {dayInfo.note && <p className="break-words">{dayInfo.note}</p>}
                  </div>
                ) : undefined}
              />
            }
          />
        ) : (
          <EmptyState
            title="No signals match these filters"
            description="Try a different filter or search."
          />
        )
      ) : (
        <div className="space-y-4">
          {items.map((o, i) => <div key={o.id} className="premium-rise" style={{ '--i': Math.min(i, 8) } as React.CSSProperties}><SignalCard o={o} onAct={act} runDateLabel={o.report_date ? formatRunDate(o.report_date) : null} /></div>)}
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground" aria-live="polite">{rangeText(data.meta.page, data.meta.per_page, data.meta.total) ?? ''}</span>
            {data.meta.last_page > 1 && (
              <div className="flex items-center gap-3">
                <Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Previous</Button>
                <span className="text-muted-foreground">Page {page} of {data.meta.last_page}</span>
                <Button size="sm" variant="outline" disabled={page >= data.meta.last_page || loading} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
