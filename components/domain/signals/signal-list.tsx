'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Layers,
  Bot,
  UserPlus,
  Clock,
  RefreshCw,
  Search,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import type { LaravelContext } from '@/lib/laravel-context'
import { formatRunDate } from '@/lib/run-dates'
import { ApiError } from '@/services/core'
import {
  opportunitiesService,
  type Opportunity,
  type OpportunityListResponse,
} from '@/services/signals/opportunities'
import { SignalCard } from '@/components/domain/signals/scholar-signals-view'
import { FallbackSignals } from '@/components/domain/signals/fallback-signals'
import { wantsFallback } from '@/lib/signal-fallback'
import { rangeText, todayIn } from '@/lib/signal-dates'
import { createLatestOnly, listErrorMode } from '@/lib/signal-run-view'

/** Signals shown per page. */
export const SIGNALS_PER_PAGE = 5

const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError || e instanceof Error ? e.message : fallback)

/**
 * Unified Signals List and Dashboard:
 * Summary cards, three source tabs (All, Generated, Manually Added), search & sort, and a 9-column opportunities table.
 * It reads stored rows only; choosing filters or pagination never starts research.
 */
export function SignalList({
  context,
  productKey,
  productLabel,
  runDate,
  allDates,
  refreshKey,
  onTotal,
  dayInfo,
  offerId,
  customerModel = 'b2b',
  regions = [],
  runId = null,
  allSignals = false,
  dateFrom,
  dateTo,
  today,
  timezone,
  onAddManual,
}: {
  context: LaravelContext
  productKey: string
  productLabel: string
  /** YYYY-MM-DD of a successful run, or null when viewing all dates or when the product has none yet. */
  runDate: string | null
  allDates?: boolean
  allSignals?: boolean
  refreshKey: number
  onTotal?: (total: number | null) => void
  /** What that day's runs did (from the run history), used to explain an empty day. */
  dayInfo?: { searches: number; sources: number; organisations: number; rejected: number; note: string | null } | null
  offerId?: string | null
  customerModel?: 'b2b' | 'b2c' | 'b2g'
  regions?: { country: string; state?: string; city?: string }[]
  /** The research run whose signals to show. Set right after a run finishes. */
  runId?: number | null
  dateFrom?: string | null
  dateTo?: string | null
  today?: string | null
  timezone?: string | null
  onAddManual?: () => void
}) {
  const [sourceTab, setSourceTab] = useState<'all' | 'generated' | 'manual'>('all')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [sort, setSort] = useState<'default' | 'priority' | 'qualification'>('default')
  const [data, setData] = useState<OpportunityListResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const latest = useRef(createLatestOnly())

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  // Another product or another day: start from page one with nothing of the previous view on screen.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1); setData(null); setError(null); setActionError(null); setStatus(''); setSourceTab('all')
  }, [productKey, runDate, allDates, dateFrom, dateTo, offerId, customerModel, runId])

  const load = useCallback(async () => {
    if (!allDates && !runDate && !dateFrom) {
      latest.current.invalidate()
      setData(null)
      onTotal?.(null)
      return
    }
    const ticket = latest.current.next()
    setLoading(true)
    try {
      const res = await opportunitiesService.list(context, {
        product: productKey,
        offerId: allSignals ? undefined : (offerId ?? undefined),
        customerModel: allSignals ? undefined : customerModel,
        regions: allSignals ? undefined : regions,
        runDate: allDates || dateFrom ? undefined : (runDate ?? undefined),
        from: dateFrom ?? undefined,
        to: dateTo ?? undefined,
        runId: runId ?? undefined,
        search: debounced || undefined,
        reviewStatus: status || undefined,
        sort,
        page,
        perPage: SIGNALS_PER_PAGE,
        expired: 'include',
        allSignals: Boolean(allSignals),
        source: sourceTab,
      })
      if (!latest.current.isLatest(ticket)) return
      setData(res)
      setError(null)
      onTotal?.(res.meta.total)
    } catch (e) {
      if (!latest.current.isLatest(ticket)) return
      setError(errMsg(e, 'Could not load the signals.'))
    } finally {
      if (latest.current.isLatest(ticket)) setLoading(false)
    }
  }, [context, productKey, runDate, allDates, dateFrom, dateTo, debounced, status, sort, page, onTotal, offerId, customerModel, regions, runId, allSignals, sourceTab])

  useEffect(() => {
    let live = true
    Promise.resolve().then(() => { if (live) void load() })
    return () => { live = false }
  }, [load, refreshKey])

  // Calculate summary counts dynamically from actual records matching the active filters
  const summaryStats = useMemo(() => {
    if (!data) return { total: 0, generated: 0, manual: 0, newToday: 0 }
    const items = data.data
    const total = data.meta.total
    const todayStr = today || (timezone ? todayIn(timezone) : null)

    const gen = items.filter((o) => !o.entered_manually && o.research_run_id !== null).length
    const man = items.filter((o) => o.entered_manually || !o.research_run_id).length
    const newTod = items.filter((o) => {
      const d = o.captured_on || o.report_date || o.first_discovered_at?.slice(0, 10)
      return todayStr ? d === todayStr : false
    }).length

    const computedGen = total <= items.length ? gen : Math.max(gen, total - man)
    const computedNewToday = total <= items.length ? newTod : Math.max(newTod, data.summary.new ?? 0)

    return {
      total,
      generated: computedGen,
      manual: man,
      newToday: computedNewToday,
    }
  }, [data, today, timezone])

  const act = async (o: Opportunity, action: 'review' | 'follow-up' | 'dismiss') => {
    setActionError(null)
    try {
      await opportunitiesService.act(context, o.id, action)
      void load()
    } catch (e) {
      setActionError(errMsg(e, 'Could not update the signal.'))
    }
  }

  const items = useMemo(() => {
    if (!data) return []
    if (sourceTab === 'generated') {
      return data.data.filter((o) => !o.entered_manually && o.research_run_id !== null)
    }
    if (sourceTab === 'manual') {
      return data.data.filter((o) => o.entered_manually || !o.research_run_id)
    }
    return data.data
  }, [data, sourceTab])

  if (!allDates && !runDate && !dateFrom) {
    return (
      <EmptyState
        title="No successful research dates yet"
        description={`Press Generate Signals to run research for ${productLabel}. Its results are kept here.`}
      />
    )
  }

  const errorMode = listErrorMode(error, data !== null)
  if (errorMode === 'replace') {
    return <ErrorState title="Could not load the signals" description={error ?? ''} retry={() => void load()} />
  }

  return (
    <div className="space-y-5" aria-busy={loading}>
      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 md:gap-4">
        {/* Total Signals */}
        <div className="premium-card rounded-2xl border border-border/70 bg-card p-4 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Signals</span>
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Layers className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {summaryStats.total}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Matching active filters</p>
        </div>

        {/* Generated */}
        <div className="premium-card rounded-2xl border border-border/70 bg-card p-4 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Generated</span>
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600">
              <Bot className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {summaryStats.generated}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Automated research runs</p>
        </div>

        {/* Manually Added */}
        <div className="premium-card rounded-2xl border border-border/70 bg-card p-4 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Manually Added</span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
              <UserPlus className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {summaryStats.manual}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Direct team submissions</p>
        </div>

        {/* New Today */}
        <div className="premium-card rounded-2xl border border-border/70 bg-card p-4 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New Today</span>
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600">
              <Clock className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {summaryStats.newToday}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Discovered or saved today</p>
        </div>
      </div>

      {/* Tabs and Controls Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Source Tabs */}
        <div role="tablist" aria-label="Signal source tabs" className="inline-flex rounded-xl bg-muted/60 p-1 text-xs font-medium">
          <button
            type="button"
            role="tab"
            aria-selected={sourceTab === 'all'}
            onClick={() => { setSourceTab('all'); setPage(1) }}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              sourceTab === 'all'
                ? 'bg-card text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sourceTab === 'generated'}
            onClick={() => { setSourceTab('generated'); setPage(1) }}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              sourceTab === 'generated'
                ? 'bg-card text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Generated
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sourceTab === 'manual'}
            onClick={() => { setSourceTab('manual'); setPage(1) }}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              sourceTab === 'manual'
                ? 'bg-card text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Manually Added
          </button>
        </div>

        {/* Search, Filter, Sort and Refresh Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-44 max-w-xs flex-1 sm:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by company or summary…"
              aria-label="Search signals"
              className="h-9 pl-8 text-xs"
            />
          </div>

          <select
            aria-label="Review status"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Any status</option>
            <option value="New">New</option>
            <option value="Reviewed">Reviewed</option>
            <option value="Follow-up">Contacted</option>
            <option value="Dismissed">Not relevant</option>
          </select>

          <select
            aria-label="Sort signals"
            value={sort}
            onChange={(e) => { setSort(e.target.value as 'default' | 'priority' | 'qualification'); setPage(1) }}
            className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="default">Sort: Newest first</option>
            <option value="priority">Sort: Priority</option>
            <option value="qualification">Sort: Qualification</option>
          </select>

          <Button
            type="button"
            size="sm"
            variant="outline"
            title="Refresh records"
            aria-label="Refresh records"
            disabled={loading}
            onClick={() => void load()}
            className="h-9 w-9 p-0"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {actionError && <p role="alert" className="text-xs text-destructive">{actionError}</p>}
      {errorMode === 'beside' && (
        <p role="alert" className="text-xs text-destructive">
          Could not refresh the signals: {error}. The list below is what was loaded before.{' '}
          <button type="button" className="font-medium underline" onClick={() => void load()}>Try again</button>
        </p>
      )}

      {/* Unified Opportunities Table */}
      {!data ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        !allDates && runDate && wantsFallback({ itemCount: items.length, search: debounced, view: 'all', status, loaded: !loading }) ? (
          <FallbackSignals
            context={context}
            productKey={productKey}
            productLabel={productLabel}
            chosenDate={runDate}
            refreshKey={refreshKey}
            offerId={offerId}
            customerModel={customerModel}
            regions={regions}
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
            title={debounced || status || sourceTab !== 'all' ? 'No signals match these filters' : (allDates ? `No saved ${productLabel} signals yet` : 'No signals match these filters')}
            description={
              debounced || status || sourceTab !== 'all'
                ? 'Try adjusting your search, status, source tab or date filters.'
                : (allDates ? `Press Generate Signals to run research for ${productLabel}.` : 'Try a different filter or search.')
            }
          />
        )
      ) : (
        <div className="space-y-4">
          {items.map((o, i) => (
            <div key={o.id} className="premium-rise" style={{ '--i': Math.min(i, 8) } as React.CSSProperties}>
              <SignalCard o={o} onAct={act} runDateLabel={o.report_date ? formatRunDate(o.report_date) : null} />
            </div>
          ))}

          {/* Pagination Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {rangeText(data.meta.page, data.meta.per_page, data.meta.total) ?? ''}
            </span>
            {data.meta.last_page > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page} of {data.meta.last_page}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  disabled={page >= data.meta.last_page || loading}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
