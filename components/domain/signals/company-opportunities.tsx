'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { useListQuery } from '@/components/shared/scaffolds/use-list-query'
import type { LaravelContext } from '@/lib/laravel-context'
import { choiceOf, splitChoice } from '@/lib/product-selection'
import { productChoices } from '@/lib/signals/list-model'
import { asksTheList, clearOpportunityFiltersPatch, OPPORTUNITIES_QUERY, resolveProductScope } from '@/lib/signals/opportunity-query'
import { signalReviewService } from '@/services/signal-review/signal-review-service'
import type { PmOption } from '@/services/product-master/types'
import { formatRunDate } from '@/lib/run-dates'
import { isPickableDay, recentDays, relativeLabel, shiftDay, todayIn } from '@/lib/signal-dates'
import { Notice } from '@/components/domain/organization/department-management/signals-ui'
import { ExpandableRunNotice } from '@/components/domain/signals/expandable-run-notice'
import { AdvancedTools } from '@/components/domain/signals/advanced-tools'
import { RegionSelector } from '@/components/domain/signals/region-selector'
import { commitPending, emptyDraft, type RegionDraft, type RegionSelection } from '@/lib/region-scope'
import { DEFAULT_REGIONS, loadSavedRegions, persistSavedRegions } from '@/lib/location-repository'
import { readRemembered, rememberProduct, useProducts } from '@/components/domain/signals/product-selector'
import { ResearchProgress } from '@/components/domain/signals/research-progress'
import { RunHealthButton } from '@/components/domain/signals/run-health-button'
import { SignalList, type SignalListControls } from '@/components/domain/signals/signal-list'
import { useGenerateSignals } from '@/components/domain/signals/use-generate-signals'
import { regionSignature, showsRunProgress } from '@/lib/signal-run-view'
import { viewAfterManualSave } from '@/lib/manual-opportunity'
import { ManualOpportunityDialog } from '@/components/domain/signals/manual-opportunity-dialog'
import { opportunitiesService, type ManualOpportunityResponse, type ResearchRun, type RunDatesResponse } from '@/services/signals/opportunities'

type RunDate = RunDatesResponse['data']['dates'][number]

/** Said beside Generate Signals when a run can start: pressing it spends search and AI quota. */
const RUN_COST_NOTE = 'A run uses search and AI quota, so start one only when you need new signals.'
/** Said beside Generate Signals while the ICP Type is "All ICP types": a run is for one type. */
const NEEDS_ONE_ICP_TYPE = 'Choose one ICP type to generate signals.'

/**
 * The Market Signals tab (this component was called Company Opportunities until 26 Nov 2026): pick a product, press Generate Signals (its progress shows right below), then read what that product's research saved
 * for a day: today and the two days before it by default, any older day from the calendar. Choosing a product or a day only reads stored rows;
 * research starts only from the Generate Signals button. Product details and the ICP are edited in Product Portfolio.
 *
 * It is also where a signal is reviewed (the Signal Review screen's abilities): All products, the search and the page are kept in the address under the
 * Review's own names (`q`, `page`, `product`, and `status`, `freshness`, `fit`, `sort` when a link carries them), so a link made for the Review opens
 * the same view here. A link that only searches or filters (`?status=all&q=…`) opens on All products, because the signal it points at may
 * belong to any product. All products has no run to start: Generate Signals and the sub-product belong to one product.
 *
 * The four selectors at the top are the list's filters as well as the inputs of Generate Signals ("the same selectors do both"): the Sub-Product, the ICP
 * Type and the Region each narrow the list only when they are set (a chosen place also matches the places inside it; "All ICP types" and no place filter
 * nothing), in every scope. Generate Signals needs one product and one ICP type. The list has no Status, Freshness, Fit, Sort or Page size boxes: a link
 * made for the Signal Review can still carry status, freshness, fit and sort in the address, but nothing on this screen sets them.
 *
 * Also from the Signal Review (P1-A2): "Run health & cost" (the organisation's runs, in every scope), "Export CSV" beside the search (see SignalList), and
 * the checks of its Generate dialog on the Generate Signals button: the line beside it (what a run costs, or why it is off), the products that would not load
 * with a Retry, and every refusal of a start said in plain words (see useGenerateSignals).
 */
export function CompanyOpportunities({ context }: { context: LaravelContext }) {
  const { products, loading, error: productsError, reload: reloadProducts } = useProducts(context)
  const list = useListQuery(OPPORTUNITIES_QUERY)
  const { query } = list
  const searchParams = useSearchParams()
  const remembered = useMemo(() => readRemembered(context), [context])
  // What the screen is about: one product (a run covers it and its configured product line), every product, or one Product Master record.
  const scope = resolveProductScope({ product: query.filters.product ?? '', asksTheList: asksTheList(searchParams), remembered, products })
  const choice = scope?.kind === 'product' ? scope.choice : null
  const { productKey: product, offerId } = splitChoice(choice)
  const selected = products?.find((p) => p.key === product) ?? null
  const runLabel = selected?.label ?? ''
  const everyProduct = scope?.kind === 'all' || scope?.kind === 'master'
  const masterId = scope?.kind === 'master' ? scope.id : null
  // A number in `product` names a Product Master record; its name comes from the same options the Signal Review's Product filter used.
  const [masterOptions, setMasterOptions] = useState<PmOption[]>([])
  useEffect(() => {
    if (masterId === null) return
    let live = true
    signalReviewService.productOptions().then((res) => { if (live) setMasterOptions(res.data) }).catch(() => undefined)
    return () => { live = false }
  }, [masterId])
  const masterLabel = masterId === null ? '' : (productChoices(masterOptions, String(masterId)).find((c) => c.value === String(masterId))?.label ?? `Product #${masterId}`)
  const listKey = selected?.key ?? 'all'
  const listLabel = selected?.label ?? (masterId !== null ? masterLabel : 'All products')

  // A link that only searches opened on All products: the address says so from now on, so clearing the search does not move the screen to another product.
  const { setQuery, setFilter } = list
  const productInAddress = query.filters.product ?? ''
  const pageInAddress = query.page
  useEffect(() => {
    if (scope?.kind === 'all' && productInAddress === '') setQuery({ filters: { product: 'all' }, page: pageInAddress })
  }, [scope?.kind, productInAddress, pageInAddress, setQuery])

  // Choosing a product writes it to the address (so the view can be shared and survives a refresh); a product, not "all", is also remembered here.
  const select = (next: string) => {
    if (next !== 'all' && !/^[1-9]\d*$/.test(next)) rememberProduct(context, next)
    setFilter('product', next)
  }
  const controls: SignalListControls = {
    query,
    setSearch: list.setSearch,
    setPage: list.setPage,
    clearFilters: () => setQuery(clearOpportunityFiltersPatch()),
  }
  // 'all' = every ICP type: the list is not filtered by it, and Generate Signals (which needs one type) is off.
  const [icpType, setIcpType] = useState<'all' | 'b2b' | 'b2c' | 'b2g'>('b2b')
  const [regions, setRegions] = useState<RegionSelection[]>(DEFAULT_REGIONS)
  const [draft, setDraft] = useState<RegionDraft>(emptyDraft())
  const [regionProblems, setRegionProblems] = useState<string[]>([])

  useEffect(() => {
    const loaded = loadSavedRegions()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRegions(loaded)
  }, [])
  // When the server creates or changes the sub-product's ICP Region, the products (and their ICP readiness) are read again.
  const run = useGenerateSignals(context, selected ? selected.key : null, products, offerId, regions, reloadProducts)
  const setCustomerModel = run.setCustomerModel
  useEffect(() => {
    if (icpType !== 'all') setCustomerModel(icpType)
  }, [icpType, setCustomerModel])

  const [dates, setDates] = useState<RunDate[] | null>(null)
  const [timezone, setTimezone] = useState<string | null>(null)
  const [datesError, setDatesError] = useState<string | null>(null)
  // null = the default: today.
  const [picked, setPicked] = useState<string | null>(null)
  const [allSignals, setAllSignals] = useState(true)
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'yesterday' | '7days' | '30days'>('all')
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  // The places THIS request is limited to ([] = All Regions). It belongs to the selected product's screen only: another product starts on All Regions.
  const seenCompleted = useRef(0)

  // The run whose results are on screen right after it finishes: that run's own signals, not every run of the same day. A person choosing a day
  // (or another product, sub-product, ICP type or place) goes back to reading by day.
  const [viewRunId, setViewRunId] = useState<number | null>(null)
  useEffect(() => {
    const r = run.activeRun
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setViewRunId(run.completedCount > 0 && r && (r.status === 'success' || r.status === 'partial') ? r.id : null)
  }, [run.completedCount]) // eslint-disable-line react-hooks/exhaustive-deps

  // Adding an opportunity by hand: the form, and what was just saved (so the person is told which day it is listed under).
  const [manualOpen, setManualOpen] = useState(false)
  const [manualNotice, setManualNotice] = useState<string | null>(null)

  const key = selected?.key ?? null
  // A date, "All signals" and a run chosen under one sub-product or ICP type do not carry over to another when in filtered scope mode.
  const regionsSig = regionSignature(regions)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDatePreset('all'); setDateRange(null); setPicked(null); setAllSignals(false); setTotal(null); setManualNotice(null)
  }, [offerId, icpType])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setViewRunId(null)
  }, [key, offerId, icpType, regionsSig])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDates(null); setDatesError(null); setPicked(null); setTotal(null); setRegions([]); setDraft(emptyDraft()); setRegionProblems([]); setDatePreset('all'); setDateRange(null)
    setRegions(loadSavedRegions())
    seenCompleted.current = run.completedCount
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!key) return
    let live = true
    const finished = run.completedCount !== seenCompleted.current
    seenCompleted.current = run.completedCount
    // With "All ICP types" the days are the product's days across every scope (the same `all_signals` the server's date list has always had).
    opportunitiesService.getRunDates(context, key, icpType === 'all' ? 'b2b' : icpType, offerId, regions, icpType === 'all')
      .then((res) => {
        if (!live) return
        setDates(res.data.dates)
        setTimezone(res.data.timezone)
        setDatesError(null)
        if (finished) { setPicked(null); setDatePreset('all'); setDateRange(null); setTotal(null) }   // a run that just finished saved today's results
      })
      .catch((e) => { if (live) setDatesError(e instanceof Error ? e.message : 'Could not load the research dates.') })
    return () => { live = false }
  }, [context, key, offerId, icpType, regions, run.refreshKey, run.completedCount])

  const currentModelStatus = icpType === 'all' ? undefined : offerId
    ? selected?.offers.find((offer) => offer.offer_id === offerId)?.icp_models?.[icpType]
    : selected?.icp_models?.[icpType]
  // The line beside Generate: what a run costs, before Start. (origin/main, 82b4922: Generate is no longer held back by a client-side readiness check, because
  // the server now creates or completes the sub-product's ICP region itself, so the old "this profile is not ready" line is gone with the check.)
  const generateHint = selected ? (icpType === 'all' ? NEEDS_ONE_ICP_TYPE : RUN_COST_NOTE) : (everyProduct ? 'Choose one product to generate signals for it.' : '')
  const today = timezone ? todayIn(timezone) : null
  const availableDates = dates ?? []
  const datesWithSignals = availableDates.filter((d) => d.qualified > 0)
  const recent5 = (datesWithSignals.length > 0 ? datesWithSignals : availableDates).slice(0, 5)
  const activeDate = picked ?? (recent5[0]?.date ?? today)
  const dayRun = dates?.find((d) => d.date === activeDate) ?? null
  const latest = run.status?.latest_run ?? null
  const shownRun = run.activeRun ?? (latest && (latest.status === 'running' || latest.status === 'failed' || latest.status === 'skipped') ? latest : null)

  const generate = () => {
    if (icpType === 'all') return
    const c = commitPending(regions, draft)
    if (c.problems.length > 0) { setRegionProblems(c.problems); return }
    setRegionProblems([])
    setRegions(c.list)
    setDraft(emptyDraft())
    void run.generate(c.list, icpType)
  }
  const pick = (d: string) => { setPicked(d); setDatePreset(d === today ? 'today' : 'all'); setDateRange(null); setTotal(null); setViewRunId(null) }
  // Saved: close the form, then show the day it was saved on (the server's day, not the post's) and re-read the list and the days without a reload.
  const manualSaved = (res: ManualOpportunityResponse) => {
    const next = viewAfterManualSave({ picked, allSignals }, res.data.captured_on)
    setManualOpen(false)
    setViewRunId(null)
    setPicked(next.picked)
    setAllSignals(true)
    setDatePreset('all')
    setDateRange(null)
    setTotal(null)
    setManualNotice(`${res.message} ${next.allSignals ? 'It is in All Signals' : `It is listed under ${formatRunDate(res.data.captured_on)}`}.`)
    run.refresh()
  }

  return (
    <div className="space-y-5">
      <section aria-label="Product and actions" className="premium-card rounded-2xl border border-border/60 bg-card p-5 shadow-sm @xl:p-6">
        {/* The products did not load: the box below stays off until they do, so the screen says why and offers Retry (the Signal Review's dialog did too). */}
        {productsError && !products && (
          <div className="mb-4">
            <Notice tone="error" action={<Button type="button" size="sm" variant="outline" onClick={reloadProducts}>Retry</Button>}>
              <span className="font-medium">The products could not be loaded.</span> {productsError}
            </Notice>
          </div>
        )}
        {/* Choose a master product, acquisition profile, and region. */}
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4 md:gap-4">
          {/* Dropdown 1: Main Product */}
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="main-product-select" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Main Product
            </label>
            <select
              id="main-product-select"
              aria-label="Main Product"
              value={scope?.kind === 'all' ? 'all' : masterId !== null ? String(masterId) : (selected?.key ?? '')}
              onChange={(e) => {
                const nextKey = e.target.value
                if (!nextKey) return
                setIcpType('b2b')
                select(nextKey)
              }}
              disabled={run.running || loading || !products}
              className="h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm font-medium text-foreground shadow-xs transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">All products</option>
              {products?.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
              {masterId !== null && <option value={String(masterId)}>{masterLabel}</option>}
            </select>
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="sub-product-select" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Sub-Product
            </label>
            <select
              id="sub-product-select"
              aria-label="Sub-Product"
              value={offerId ?? ''}
              onChange={(e) => selected && select(choiceOf(selected.key, e.target.value || null))}
              disabled={run.running || !selected}
              className="h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm font-medium text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">{selected ? 'Whole product' : '—'}</option>
              {selected?.offers.map((offer) => (
                <option key={offer.offer_id} value={offer.offer_id}>
                  {offer.name}
                </option>
              ))}
            </select>
          </div>

          {/* Dropdown 2: ICP Type */}
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="icp-type-select" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              ICP Type
            </label>
            <select
              id="icp-type-select"
              aria-label="ICP Type"
              value={icpType}
              onChange={(e) => setIcpType(e.target.value as 'all' | 'b2b' | 'b2c' | 'b2g')}
              disabled={run.running}
              className="h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm font-medium text-foreground shadow-xs transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">All ICP types</option>
              {[
                { key: 'b2b' as const, label: 'B2B Customer Acquisition' },
                { key: 'b2c' as const, label: 'B2B Partner Acquisition' },
                { key: 'b2g' as const, label: 'B2G — Government' },
              ].map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {/* Dropdown 3: Region */}
          <RegionSelector value={regions} onChange={(next) => { setRegions(next); setRegionProblems([]); persistSavedRegions(next) }} draft={draft} onDraft={(d) => { setDraft(d); setRegionProblems([]) }} suggestions={selected?.icp?.regions ?? []} disabled={run.running} context={context} />

        </div>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-border/60 pt-4">
          {/* In words, beside the buttons: what a run costs. (Generate is no longer held back by a readiness check: the server completes the ICP region itself.) */}
          <p aria-live="polite" className="min-w-0 flex-1 basis-56 text-xs text-muted-foreground">{generateHint}</p>
          {/* Run health and cost belong to the organisation's runs, not to the product on screen: the button is here in every scope. */}
          <RunHealthButton className="h-11 w-full rounded-xl sm:w-auto" />
          <Button
            type="button"
            size="lg"
            className="h-11 w-full rounded-xl shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:w-auto sm:min-w-48"
            onClick={generate}
            disabled={!selected || run.running || icpType === 'all'}
            title={everyProduct ? 'Choose one product to generate signals for it.' : (icpType === 'all' ? NEEDS_ONE_ICP_TYPE : undefined)}
          >
            {run.running ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
            {run.running ? 'Finding Signals…' : 'Generate Signals'}
          </Button>
        </div>

        {regionProblems.length > 0 && <ul role="alert" className="mt-3 list-disc space-y-0.5 pl-5 text-xs text-destructive">{regionProblems.map((p) => <li key={p}>{p}</li>)}</ul>}

        {/* The run's real progress appears directly below the selectors after generation starts. */}
        {showsRunProgress(run.running, run.activeRun) && <ResearchProgress run={shownRun} onRetry={generate} retryDisabled={run.running} />}
        {run.notice && (
          <div className="mt-3">
            <ExpandableRunNotice
              notice={run.notice}
              run={run.activeRun ?? (run.notice.runId ? ({ id: run.notice.runId } as ResearchRun) : null) ?? run.status?.latest_run ?? null}
              context={context}
            />
          </div>
        )}
      </section>

      {(selected || everyProduct) && (
        <section aria-label={`${listLabel} signals`} className="space-y-4">
          {selected && (
          <div className="flex flex-wrap items-center gap-2.5">
            {/* 1. Today Filter */}
            <Button
              type="button"
              size="sm"
              variant={datePreset === 'today' || (picked === today && !!today) ? 'default' : 'outline'}
              onClick={() => {
                if (today) {
                  if (datePreset === 'today' || picked === today) {
                    setDatePreset('all')
                    setPicked(null)
                    setDateRange(null)
                    setTotal(null)
                  } else {
                    setDatePreset('today')
                    setPicked(today)
                    setDateRange({ from: today, to: today })
                    setTotal(null)
                  }
                  setViewRunId(null)
                }
              }}
              className="h-9 rounded-lg text-xs font-medium shadow-xs"
              title={datePreset === 'today' ? 'Showing Today: click to view All Signals' : 'Filter by Today (default shows All Signals)'}
            >
              Today
            </Button>

            {/* 2. Date Dropdown */}
            <select
              aria-label="Recent signal dates"
              value={datePreset === 'all' && !dateRange && !picked ? '' : (dateRange && dateRange.from !== dateRange.to ? '' : (activeDate ?? ''))}
              disabled={dates === null && !datesError}
              onChange={(e) => {
                if (!e.target.value) {
                  setDatePreset('all')
                  setPicked(null)
                  setDateRange(null)
                  setTotal(null)
                  setViewRunId(null)
                } else {
                  pick(e.target.value)
                }
              }}
              className="h-9 rounded-lg border border-input bg-background px-3 text-xs text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {dates === null && !datesError ? (
                <option value="" disabled>Loading dates…</option>
              ) : (
                <>
                  <option value="">Recent dates</option>
                  {recent5.map((d) => (
                    <option key={d.date} value={d.date}>
                      {formatRunDate(d.date)} ({d.qualified} {d.qualified === 1 ? 'signal' : 'signals'})
                    </option>
                  ))}
                  {activeDate && !recent5.some((d) => d.date === activeDate) && (
                    <option value={activeDate}>{formatRunDate(activeDate)}</option>
                  )}
                </>
              )}
            </select>

            {/* 3. Calendar Date Picker */}
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="sr-only">Pick date</span>
              <input
                type="date"
                aria-label="Calendar date picker"
                max={today ?? undefined}
                value={datePreset === 'all' && !dateRange && !picked ? '' : (dateRange && dateRange.from !== dateRange.to ? '' : (activeDate ?? ''))}
                onChange={(e) => {
                  const val = e.target.value
                  if (val && (!today || isPickableDay(val, today))) {
                    pick(e.target.value)
                  } else if (!val) {
                    setDatePreset('all')
                    setPicked(null)
                    setDateRange(null)
                    setTotal(null)
                    setViewRunId(null)
                  }
                }}
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>

            <Button type="button" size="sm" variant="outline" onClick={() => { setManualNotice(null); setManualOpen(true) }} className="ml-auto h-9 text-xs font-medium">
              <Plus className="mr-1.5 size-4" />
              Add Opportunity Manually
            </Button>
          </div>
          )}

          {manualNotice && <Notice tone="info"><span>{manualNotice}</span></Notice>}

          {selected && dates === null && !datesError ? (
            <Skeleton className="h-40 w-full rounded-2xl" aria-label="Loading" />
          ) : (
            <SignalList
              key={everyProduct ? `${listKey}-${masterId ?? 'every'}` : `${listKey}-${allSignals ? 'all-signals' : 'scoped'}-${datePreset}-${dateRange ? `${dateRange.from}-${dateRange.to}` : (activeDate ?? 'default')}`}
              context={context}
              productKey={listKey}
              productMasterId={masterId}
              offerId={offerId}
              customerModel={icpType === 'all' ? null : icpType}
              regions={regions}
              productLabel={listLabel}
              runDate={everyProduct || (datePreset === 'all' && !dateRange && !picked) ? null : (dateRange ? null : activeDate)}
              dateFrom={everyProduct ? undefined : dateRange?.from}
              dateTo={everyProduct ? undefined : dateRange?.to}
              allDates={everyProduct || (datePreset === 'all' && !dateRange && !picked)}
              runId={picked === null ? viewRunId : null}
              refreshKey={run.refreshKey}
              onTotal={setTotal}
              dayInfo={dayRun}
              controls={controls}
            />
          )}
        </section>
      )}

      {selected && (
        <ManualOpportunityDialog
          context={context}
          open={manualOpen}
          onClose={() => setManualOpen(false)}
          onSaved={manualSaved}
          productKey={selected.key}
          productLabel={selected.label}
          offerId={offerId}
          offerLabel={offerId ? (selected.offers.find((o) => o.offer_id === offerId)?.name ?? offerId) : null}
          customerModel={icpType === 'all' ? 'b2b' : icpType}
          today={today}
        />
      )}

      {selected && (
        <AdvancedTools
          context={context}
          productKey={selected.key}
          productLabel={selected.label}
          status={run.status}
          onRefresh={run.refresh}
          onChanged={() => void run.reloadStatus()}
        />
      )}
    </div>
  )
}
