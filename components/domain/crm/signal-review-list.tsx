'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { NativeSelect } from '@/components/shared/scaffolds/form-field'
import { ListSearch } from '@/components/shared/scaffolds/list-search'
import { useListQuery } from '@/components/shared/scaffolds/use-list-query'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import {
  applyStatusChange, clearFiltersPatch, fitChoices, fitSummary, FRESHNESS_CHOICES, listScreenState, productChoices, queryToParams, rangeText,
  SIGNAL_LIST_QUERY, SORT_CHOICES, STATUS_CHOICES, summaryTiles, type Choice,
} from '@/lib/signal-review/list-model'
import { cn } from '@/lib/utils'
import type { PmOption } from '@/services/product-master/types'
import { signalReviewService, type SignalReviewApi } from '@/services/signal-review/signal-review-service'
import type { SignalListResponse, SignalRow } from '@/services/signal-review/signal-types'
import { SignalReviewDrawer, type SignalReviewDrawerParts } from './signal-review-drawer'
import { SignalDateBadge, SignalProductChip, SignalStatusChip } from './signal-review-parts'

function describeError(cause: unknown): string {
  return cause instanceof Error && cause.message ? cause.message : 'The signals could not be loaded.'
}

/**
 * The Signal Review list: a search, the Product / Status / Freshness / Fit / Sort choices (all kept in the address, so a link opens the same view), the
 * counts the server returns, and the signals themselves. A signal with no date is shown with a "Date unknown" badge and is never filtered out unless the
 * person asks. Opening a signal shows the drawer; a decision updates the row and the counts in place.
 */
export function SignalReviewList({ service = signalReviewService, signalsHref = '/signals', parts }: {
  service?: SignalReviewApi
  /** Where the original Signals screen is, for the "no signals yet" state (that screen starts research runs). */
  signalsHref?: string
  parts?: SignalReviewDrawerParts
}) {
  const context = useMemo(() => getLaravelContext(), [])
  const { query, setSearch, setFilter, setQuery, setPage } = useListQuery(SIGNAL_LIST_QUERY)

  const [data, setData] = useState<SignalListResponse | null>(null)
  const [refreshing, setRefreshing] = useState(true)
  const [error, setError] = useState('')
  const [productOptions, setProductOptions] = useState<PmOption[]>([])
  const [selected, setSelected] = useState<SignalRow | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const params = useMemo(() => queryToParams(query), [query])

  // Only the newest request may change what is shown: a slow answer to an earlier search must not overwrite the answer to a later one.
  const latest = useRef(0)
  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      setRefreshing(false)
      return
    }
    const mine = ++latest.current
    setRefreshing(true)
    setError('')
    try {
      const response = await service.list(params)
      if (mine !== latest.current) return
      setData(response)
    } catch (cause) {
      if (mine !== latest.current) return
      setError(describeError(cause))
    } finally {
      if (mine === latest.current) setRefreshing(false)
    }
  }, [context, service, params])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  // The product choices come from the Product Master. If they cannot be read the list still works: the Product box offers "All products" only.
  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    let cancelled = false
    service.productOptions()
      .then((response) => { if (!cancelled) setProductOptions(response.data) })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [context, service])

  const open = useCallback((row: SignalRow) => {
    setSelected(row)
    setDrawerOpen(true)
  }, [])

  const onChanged = useCallback((next: SignalRow) => {
    setSelected(next)
    setData((current) => {
      if (!current) return current
      const before = current.data.find((row) => row.id === next.id)
      return {
        ...current,
        data: current.data.map((row) => (row.id === next.id ? { ...row, ...next } : row)),
        summary: before && before.review_status !== next.review_status ? applyStatusChange(current.summary, before, before.review_status, next.review_status) : current.summary,
      }
    })
  }, [])

  const rows = data?.data ?? []
  const state = listScreenState({ loaded: data !== null, error, rows: rows.length, summaryTotal: data?.summary.total ?? 0, query })
  const filters = data?.filters
  const reasons = filters?.review_reasons ?? []

  const clear = () => setQuery(clearFiltersPatch())

  return (
    <div className="space-y-4">
      {data && (
        <div role="group" aria-label="Summary" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {summaryTiles(data.summary).map((tile) => (
            <div key={tile.label} className="rounded-lg border border-border bg-card px-3 py-2">
              <p className="text-xl font-semibold leading-tight text-foreground">{tile.value}</p>
              <p className="text-xs text-muted-foreground">{tile.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-sm sm:flex-1">
          <ListSearch value={query.q} onSearch={setSearch} placeholder="Search organisation or title" label="Search signals" />
        </div>
        <Facet label="Product" value={query.filters.product} choices={productChoices(productOptions, query.filters.product)} onChange={(v) => setFilter('product', v)} />
        <Facet label="Status" value={query.filters.status} choices={STATUS_CHOICES} onChange={(v) => setFilter('status', v)} />
        <Facet label="Freshness" value={query.filters.freshness} choices={FRESHNESS_CHOICES} onChange={(v) => setFilter('freshness', v)} />
        <Facet label="Fit" value={query.filters.fit} choices={fitChoices(filters?.business_fits, filters?.products, query.filters.fit)} onChange={(v) => setFilter('fit', v)} />
        <Facet label="Sort" value={query.sort} choices={SORT_CHOICES} onChange={(v) => setQuery({ sort: v })} />
      </div>

      {state === 'loading' && (
        <div role="status" className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading signals…
        </div>
      )}

      {state === 'error' && <ErrorState title="Signals could not be loaded" description={error} retry={() => void load()} />}

      {state === 'empty' && (
        <EmptyState
          title="No signals yet"
          description="Signals appear here once a research run has found them. Runs are started from the Signals screen."
          action={<Button asChild variant="outline"><Link href={signalsHref}>Open Signals to start a run</Link></Button>}
        />
      )}

      {state === 'filtered-empty' && (
        <EmptyState
          title="No signals match these filters"
          description="Try a different search, or widen the filters."
          action={<Button variant="outline" onClick={clear}>Clear filters</Button>}
        />
      )}

      {state === 'ready' && data && (
        <div className={cn('space-y-3 transition-opacity', refreshing && 'opacity-60')} aria-busy={refreshing}>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <caption className="sr-only">Signals</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Signal</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Fit</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <SignalRowView key={row.id} row={row} active={drawerOpen && selected?.id === row.id} products={filters?.products} onOpen={open} />
                ))}
              </TableBody>
            </Table>
          </div>

          <Pager meta={data.meta} rows={rows.length} onPage={setPage} />
        </div>
      )}

      {selected && (
        <SignalReviewDrawer
          signal={selected}
          open={drawerOpen}
          service={service}
          reasons={reasons}
          products={filters?.products}
          onChanged={onChanged}
          onClose={() => setDrawerOpen(false)}
          parts={parts}
        />
      )}
    </div>
  )
}

/** A labelled native select: it takes the label wiring, needs nothing special beside a drawer, and the lists here are short. */
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

function SignalRowView({ row, active, products, onOpen }: {
  row: SignalRow
  active: boolean
  products: SignalListResponse['filters']['products']
  onOpen: (row: SignalRow) => void
}) {
  const fit = fitSummary(row, products)
  return (
    // The whole row opens the signal for a mouse; the title is the real button, so the keyboard and a screen reader have one control to reach.
    <TableRow onClick={() => onOpen(row)} className={cn('cursor-pointer', active && 'bg-primary/5')}>
      <TableCell className="max-w-md">
        <button
          type="button"
          aria-haspopup="dialog"
          className="block text-left font-semibold text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {row.title}
        </button>
        <span className="block text-xs text-muted-foreground">{row.company_name}</span>
      </TableCell>
      <TableCell><SignalProductChip name={row.product_master_name} /></TableCell>
      <TableCell><SignalDateBadge info={row.date_info} /></TableCell>
      <TableCell className="text-sm">{fit ?? <span className="text-muted-foreground">—</span>}</TableCell>
      <TableCell><SignalStatusChip status={row.review_status} /></TableCell>
    </TableRow>
  )
}

function Pager({ meta, rows, onPage }: { meta: SignalListResponse['meta']; rows: number; onPage: (page: number) => void }) {
  const range = rangeText(meta, rows)
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>{range}</span>
      {meta.last_page > 1 && (
        <nav aria-label="Pages" className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Previous</Button>
          <span>Page {meta.page} of {meta.last_page}</span>
          <Button size="sm" variant="outline" disabled={meta.page >= meta.last_page} onClick={() => onPage(meta.page + 1)}>Next</Button>
        </nav>
      )}
    </div>
  )
}
