'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  CheckCircle2,
  Clock,
  Flame,
  Layers,
  RefreshCw,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { NativeSelect } from '@/components/shared/scaffolds/form-field'
import type { ListQuery } from '@/components/shared/scaffolds/list-query'
import { ListSearch } from '@/components/shared/scaffolds/list-search'
import type { LaravelContext } from '@/lib/laravel-context'
import { formatRunDate } from '@/lib/run-dates'
import { ApiError } from '@/services/core'
import {
  opportunitiesService,
  type Opportunity,
  type OpportunityListResponse,
  type OpportunityQuery,
} from '@/services/signals/opportunities'
import { SignalCard } from '@/components/domain/signals/scholar-signals-view'
import { FallbackSignals } from '@/components/domain/signals/fallback-signals'
import { ExportCsvButton, ScreenNoticeBanner, type ScreenNotice } from '@/components/domain/signals/signal-export-button'
import { wantsFallback } from '@/lib/signal-fallback'
import { rangeText } from '@/lib/signal-dates'
import { createLatestOnly, listErrorMode } from '@/lib/signal-run-view'
import { fitChoices, FRESHNESS_CHOICES, reviewStatusOf, STATUS_CHOICES, summaryTiles, type Choice } from '@/lib/signals/list-model'
import {
  DEFAULT_PER_PAGE, isNarrowedHere, listRequest, OPPORTUNITY_SORT_CHOICES, opportunityListState, PER_PAGE_LABELS,
} from '@/lib/signals/opportunity-query'
import { replaceRow } from '@/lib/signals/opportunity-row'
import { BANNER_TONE } from '@/lib/signals/tones'
import { cn } from '@/lib/utils'

const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError || e instanceof Error ? e.message : fallback)

/** The list's search, filters, order, page and page size, kept in the address by the screen around it (the list only reads them and asks to change them). */
export interface SignalListControls {
  query: ListQuery
  setSearch: (q: string) => void
  setFilter: (name: string, value: string) => void
  setSort: (sort: string) => void
  setPage: (page: number) => void
  /** Clears the search and the facets (not the product). */
  clearFilters: () => void
}

/** What each of the four counts means, under its number. */
const TILE_HINTS = [
  { icon: Layers, hint: 'Matching the search and filters' },
  { icon: Clock, hint: 'Not decided on yet' },
  { icon: CheckCircle2, hint: 'Contacted, reviewed or not relevant' },
  { icon: Flame, hint: 'Leaving out the not relevant ones' },
] as const

/**
 * Unified Signals List and Dashboard:
 * Four counts from the server, three source tabs (All, Generated, Manually Added), search, Status / Freshness / Fit / Sort / Page size, and the signals as
 * cards. It reads stored rows only; choosing filters or pagination never starts research. The search, filters, order, page and page size live in the
 * address (`controls`), so a refresh, the Back button and a pasted link open the same view.
 */
export function SignalList({
  context,
  productKey,
  productLabel,
  productMasterId = null,
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
  controls,
}: {
  context: LaravelContext
  /** A product key, or 'all' for every product. */
  productKey: string
  productLabel: string
  /** Only the signals filed under this Product Master record (the Signal Review's meaning of a number in the address). */
  productMasterId?: number | null
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
  controls: SignalListControls
}) {
  const { query } = controls
  const { q, sort, page } = query
  const status = query.filters.status ?? 'all'
  const freshness = query.filters.freshness ?? 'all'
  const fit = query.filters.fit ?? 'all'
  const per = query.filters.per ?? String(DEFAULT_PER_PAGE)

  const [sourceTab, setSourceTab] = useState<'all' | 'generated' | 'manual'>('all')
  const [data, setData] = useState<OpportunityListResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // What the last export said (saved, cut short, nothing to export, cancelled, failed), until it is put away.
  const [exportNotice, setExportNotice] = useState<ScreenNotice | null>(null)
  const latest = useRef(createLatestOnly())
  const everyProduct = productKey === 'all'

  // Another product or another day: nothing of the previous view stays on screen, and the list goes back to page one. Not on the first render: a link
  // that opens on page three must stay on page three.
  const scope = [productKey, productMasterId ?? '', runDate ?? '', allDates ? 1 : 0, dateFrom ?? '', dateTo ?? '', offerId ?? '', customerModel, runId ?? ''].join('|')
  const lastScope = useRef(scope)
  const { setPage } = controls
  useEffect(() => {
    if (lastScope.current === scope) return
    lastScope.current = scope
    setData(null); setError(null); setSourceTab('all')
    if (page > 1) setPage(1)
  }, [scope, page, setPage])

  // What the list asks the server for: the screen's scope (product, day, sub-product, ICP type, places, source tab) and the address's search, facets, order,
  // page and page size. The CSV export reads every page of this SAME request (the button below), so the file is the list without the paging.
  const request = useMemo((): OpportunityQuery => ({
    product: productKey,
    productMasterId: productMasterId ?? undefined,
    offerId: allSignals ? undefined : (offerId ?? undefined),
    customerModel: allSignals ? undefined : customerModel,
    regions: allSignals ? undefined : regions,
    runDate: allDates || dateFrom ? undefined : (runDate ?? undefined),
    from: dateFrom ?? undefined,
    to: dateTo ?? undefined,
    runId: runId ?? undefined,
    ...listRequest({ q, sort, dir: 'desc', page, filters: { product: '', status, freshness, fit, per } }),
    expired: 'include',
    allSignals: Boolean(allSignals),
    source: sourceTab,
  }), [productKey, productMasterId, allSignals, offerId, customerModel, regions, allDates, dateFrom, runDate, dateTo, runId, q, sort, page, status, freshness, fit, per, sourceTab])

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
      const res = await opportunitiesService.list(context, request)
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
  }, [context, request, allDates, runDate, dateFrom, onTotal])

  useEffect(() => {
    let live = true
    Promise.resolve().then(() => { if (live) void load() })
    return () => { live = false }
  }, [load, refreshKey])

  // A card changed (a decision, a lead): the row is replaced in place and the counts move with it, so what is on screen agrees without a reload.
  const changed = useCallback((next: Opportunity) => setData((current) => (current ? replaceRow(current, next) : current)), [])

  // A link or a refresh can hold a page past the end (signals were decided or removed since): go to the last page, not to an empty list with no pager.
  const rowsOnPage = data?.data.length
  const matching = data?.meta.total ?? 0
  const lastPage = data?.meta.last_page ?? 1
  useEffect(() => {
    if (rowsOnPage === 0 && matching > 0 && page > lastPage) setPage(Math.max(1, lastPage))
  }, [rowsOnPage, matching, lastPage, page, setPage])

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

  const resetPage = () => { if (page > 1) setPage(1) }

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

  // "No signals yet" for an organisation that has none, "No signals match these filters" (with a way out) for a search, a facet, a status or a source
  // tab that matched nothing. The product is the scope of the screen, not a filter of it.
  const emptyKind = opportunityListState({ loaded: data !== null, error: '', rows: items.length, summaryTotal: data?.summary.total ?? 0, query })
  const filtered = emptyKind === 'filtered-empty' || isNarrowedHere(query) || sourceTab !== 'all'
  const reasons = data?.filters?.review_reasons ?? []
  const statusWord = reviewStatusOf(status) ?? ''

  return (
    <div className="space-y-5" aria-busy={loading}>
      {/* The four counts, from the server: what the list would hold with the search and the filters, whatever page it is on. */}
      {data && (
        <div role="group" aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4 md:gap-4">
          {summaryTiles(data.summary).map((tile, index) => {
            const { icon: Icon, hint } = TILE_HINTS[index]
            return (
              <div key={tile.label} className="premium-card rounded-2xl border border-border/70 bg-card p-4 shadow-xs transition-shadow hover:shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tile.label}</span>
                  <div className="rounded-lg bg-muted p-2 text-foreground">
                    <Icon className="size-4" aria-hidden="true" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">{tile.value}</div>
                <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Tabs and Controls Bar */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Source Tabs */}
          <div role="tablist" aria-label="Signal source tabs" className="inline-flex rounded-xl bg-muted/60 p-1 text-xs font-medium">
            <button
              type="button"
              role="tab"
              aria-selected={sourceTab === 'all'}
              onClick={() => { setSourceTab('all'); resetPage() }}
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
              onClick={() => { setSourceTab('generated'); resetPage() }}
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
              onClick={() => { setSourceTab('manual'); resetPage() }}
              className={`rounded-lg px-3 py-1.5 transition-all ${
                sourceTab === 'manual'
                  ? 'bg-card text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Manually Added
            </button>
          </div>

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

        {/* Search and the facets: the Signal Review's own, kept in the address. They wrap, so a narrow screen never scrolls sideways. */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:max-w-sm sm:flex-1">
            <ListSearch value={q} onSearch={controls.setSearch} placeholder="Search by company or summary…" label="Search signals" />
          </div>
          <Facet label="Status" value={status} choices={STATUS_CHOICES} onChange={(v) => controls.setFilter('status', v)} />
          <Facet label="Freshness" value={freshness} choices={FRESHNESS_CHOICES} onChange={(v) => controls.setFilter('freshness', v)} />
          <Facet label="Fit" value={fit} choices={fitChoices(data?.filters?.business_fits, data?.filters?.products, fit)} onChange={(v) => controls.setFilter('fit', v)} />
          <Facet label="Sort" value={sort} choices={OPPORTUNITY_SORT_CHOICES} onChange={controls.setSort} />
          <Facet label="Page size" value={per} choices={PER_PAGE_LABELS} onChange={(v) => controls.setFilter('per', v)} />
          {/* Every page of what the list asks for (the filters above are in it), up to the file's cap; works in every scope. */}
          <ExportCsvButton label="Export CSV" read={(exportPage, size) => opportunitiesService.list(context, { ...request, page: exportPage, perPage: size })} onNotice={setExportNotice} />
        </div>
        {exportNotice && <ScreenNoticeBanner notice={exportNotice} onDismiss={() => setExportNotice(null)} />}
      </div>

      {errorMode === 'beside' && (
        <p role="alert" className={cn('rounded-lg border p-2.5 text-xs', BANNER_TONE.error)}>
          Could not refresh the signals: {error}. The list below is what was loaded before.{' '}
          <button type="button" className="font-medium underline" onClick={() => void load()}>Try again</button>
        </p>
      )}

      {/* Unified Opportunities List */}
      {!data ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        !allDates && runDate && wantsFallback({ itemCount: items.length, search: q, view: 'all', status: statusWord, loaded: !loading, narrowed: fit !== 'all' || freshness !== 'all' }) ? (
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
            title={filtered ? 'No signals match these filters' : (everyProduct ? 'No saved signals yet' : (allDates ? `No saved ${productLabel} signals yet` : 'No signals match these filters'))}
            description={
              filtered
                ? 'Try adjusting your search, status, freshness, fit, source tab or date filters.'
                : (everyProduct ? 'Choose a product and press Generate Signals to run research for it. Its results are kept here.' : (allDates ? `Press Generate Signals to run research for ${productLabel}.` : 'Try a different filter or search.'))
            }
            action={filtered ? <Button type="button" variant="outline" onClick={controls.clearFilters}>Clear filters</Button> : undefined}
          />
        )
      ) : (
        <div className="space-y-4">
          {items.map((o, i) => (
            <div key={o.id} className="premium-rise" style={{ '--i': Math.min(i, 8) } as React.CSSProperties}>
              <SignalCard o={o} reasons={reasons} products={data.filters?.products} onChanged={changed} runDateLabel={o.report_date ? formatRunDate(o.report_date) : null} />
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

/** A labelled native select: it takes the label wiring, and these lists are short. */
function Facet({ label, value, choices, onChange }: { label: string; value: string; choices: readonly Choice[]; onChange: (value: string) => void }) {
  const id = useId()
  return (
    <div className="flex min-w-[9rem] flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</label>
      <NativeSelect id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
      </NativeSelect>
    </div>
  )
}
