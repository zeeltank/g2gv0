'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import type { LaravelContext } from '@/lib/laravel-context'
import { choiceOf, splitChoice } from '@/lib/product-selection'
import { formatRunDate } from '@/lib/run-dates'
import { isPickableDay, recentDays, relativeLabel, shiftDay, todayIn } from '@/lib/signal-dates'
import { Notice } from '@/components/domain/organization/department-management/signals-ui'
import { AdvancedTools } from '@/components/domain/signals/advanced-tools'
import { RegionSelector } from '@/components/domain/signals/region-selector'
import { commitPending, emptyDraft, type RegionDraft, type RegionSelection } from '@/lib/region-scope'
import { useProducts, useSelectedProduct } from '@/components/domain/signals/product-selector'
import { ResearchProgress } from '@/components/domain/signals/research-progress'
import { SignalList } from '@/components/domain/signals/signal-list'
import { useGenerateSignals } from '@/components/domain/signals/use-generate-signals'
import { regionSignature, showsRunProgress } from '@/lib/signal-run-view'
import { viewAfterManualSave } from '@/lib/manual-opportunity'
import { ManualOpportunityDialog } from '@/components/domain/signals/manual-opportunity-dialog'
import { opportunitiesService, type ManualOpportunityResponse, type RunDatesResponse } from '@/services/signals/opportunities'

type RunDate = RunDatesResponse['data']['dates'][number]

/**
 * Company Opportunities: pick a product, press Generate Signals (its progress shows right below), then read what that product's research saved
 * for a day: today and the two days before it by default, any older day from the calendar. One explicit product is always selected. Choosing a
 * product or a day only reads stored rows; research starts only from the Generate Signals button. Product details and the ICP are edited in
 * Product Portfolio.
 */
export function CompanyOpportunities({ context }: { context: LaravelContext }) {
  const { products, loading } = useProducts(context)
  // A run covers the selected master product and its configured product line.
  const [choice, setChoice] = useSelectedProduct(context, products, { allowAll: false, allowSub: true })
  const { productKey: product, offerId } = splitChoice(choice)
  const selected = products?.find((p) => p.key === product) ?? null
  const runLabel = selected?.label ?? ''
  const [icpType, setIcpType] = useState<'b2b' | 'b2c' | 'b2g'>('b2b')
  const [regions, setRegions] = useState<RegionSelection[]>([])
  const [draft, setDraft] = useState<RegionDraft>(emptyDraft())
  const [regionProblems, setRegionProblems] = useState<string[]>([])
  const run = useGenerateSignals(context, selected ? selected.key : null, products, offerId, regions)
  const setCustomerModel = run.setCustomerModel
  useEffect(() => {
    setCustomerModel(icpType)
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
    setDatePreset('all'); setDateRange(null)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPicked(null); setAllSignals(false); setTotal(null); setManualNotice(null)
  }, [offerId, icpType])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setViewRunId(null)
  }, [key, offerId, icpType, regionsSig])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDates(null); setDatesError(null); setPicked(null); setTotal(null); setRegions([]); setDraft(emptyDraft()); setRegionProblems([]); setDatePreset('all'); setDateRange(null)
    seenCompleted.current = run.completedCount
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!key) return
    let live = true
    const finished = run.completedCount !== seenCompleted.current
    seenCompleted.current = run.completedCount
    opportunitiesService.getRunDates(context, key, icpType, offerId, regions)
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

  const currentModelStatus = offerId
    ? selected?.offers.find((offer) => offer.offer_id === offerId)?.icp_models?.[icpType]
    : selected?.icp_models?.[icpType]

  const isModelReady = currentModelStatus
    ? currentModelStatus.ready
    : (icpType === 'b2b' ? Boolean(selected?.ready) : false)

  const ready = offerId
    ? (currentModelStatus ? currentModelStatus.ready : icpType === 'b2b' && selected?.offers.find((offer) => offer.offer_id === offerId)?.icp_ready === true)
    : isModelReady
  const today = timezone ? todayIn(timezone) : null
  const availableDates = dates ?? []
  const datesWithSignals = availableDates.filter((d) => d.qualified > 0)
  const recent5 = (datesWithSignals.length > 0 ? datesWithSignals : availableDates).slice(0, 5)
  const activeDate = picked ?? (recent5[0]?.date ?? today)
  const dayRun = dates?.find((d) => d.date === activeDate) ?? null
  const latest = run.status?.latest_run ?? null
  const shownRun = run.activeRun ?? (latest && (latest.status === 'running' || latest.status === 'failed' || latest.status === 'skipped') ? latest : null)

  const generate = () => {
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
              value={selected?.key ?? ''}
              onChange={(e) => {
                const nextKey = e.target.value
                if (!nextKey) return
                setIcpType('b2b')
                setChoice(nextKey)
              }}
              disabled={run.running || loading || !products}
              className="h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm font-medium text-foreground shadow-xs transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {products?.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="sub-product-select" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sub-Product</label>
            <select id="sub-product-select" aria-label="Sub-Product" value={offerId ?? ''} onChange={(e) => selected && setChoice(choiceOf(selected.key, e.target.value || null))} disabled={run.running || !selected} className="h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm font-medium text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">Whole product</option>
              {selected?.offers.map((offer) => <option key={offer.offer_id} value={offer.offer_id}>{offer.name}</option>)}
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
              onChange={(e) => setIcpType(e.target.value as 'b2b' | 'b2c' | 'b2g')}
              disabled={run.running || !selected}
              className="h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm font-medium text-foreground shadow-xs transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {[
                { key: 'b2b' as const, label: 'B2B Customer Acquisition' },
                { key: 'b2c' as const, label: 'B2B Partner Acquisition' },
                { key: 'b2g' as const, label: 'B2G — Government' },
              ].map((item) => {
                return (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                )
              })}
            </select>
          </div>

          {/* Dropdown 3: Region */}
          <RegionSelector value={regions} onChange={(next) => { setRegions(next); setRegionProblems([]) }} draft={draft} onDraft={(d) => { setDraft(d); setRegionProblems([]) }} suggestions={selected?.icp?.regions ?? []} disabled={run.running || !selected} />

        </div>

        <div className="mt-4 flex items-center justify-end border-t border-border/60 pt-4">
          <span className="sr-only" aria-live="polite">
            {!ready && selected ? `This profile is not ready for discovery. ${currentModelStatus?.missing?.[0] ?? 'Complete it in Product Portfolio.'}` : ''}
          </span>
          <Button
            type="button"
            size="lg"
            className="h-11 w-full rounded-xl shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:w-auto sm:min-w-48"
            onClick={generate}
            disabled={!selected || run.running || !ready}
            title={!ready && selected ? (currentModelStatus?.missing?.[0] ?? 'Complete it in Product Portfolio.') : undefined}
          >
            {run.running ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
            {run.running ? 'Finding Signals…' : 'Generate Signals'}
          </Button>
        </div>

        {regionProblems.length > 0 && <ul role="alert" className="mt-3 list-disc space-y-0.5 pl-5 text-xs text-destructive">{regionProblems.map((p) => <li key={p}>{p}</li>)}</ul>}

        {/* The run's real progress appears directly below the selectors after generation starts. */}
        {showsRunProgress(run.running, run.activeRun) && <ResearchProgress run={shownRun} onRetry={generate} retryDisabled={run.running || !ready} />}
        {run.notice && (
          <div className="mt-3">
            <Notice tone={run.notice.tone === 'success' ? 'info' : run.notice.tone}>
              <span>{run.notice.text}</span>
              {run.notice.missing && run.notice.missing.length > 0 && <ul className="mt-1 list-disc pl-5">{run.notice.missing.map((m) => <li key={m}>{m}</li>)}</ul>}
              {run.notice.nextStep && <span className="mt-1 block">{run.notice.nextStep}</span>}
            </Notice>
          </div>
        )}
      </section>

      {selected && (
        <section aria-label={`${selected.label} signals`} className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Date Presets Group */}
            <div className="inline-flex rounded-xl bg-muted/60 p-1 text-xs font-medium">
              {[
                { id: 'all' as const, label: 'All Dates' },
                { id: 'today' as const, label: 'Today' },
                { id: 'yesterday' as const, label: 'Yesterday' },
                { id: '7days' as const, label: 'Last 7 Days' },
                { id: '30days' as const, label: 'Last 30 Days' },
              ].map((p) => {
                const isActive = datePreset === p.id && (p.id !== 'all' || (!picked && !dateRange))
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      if (p.id === 'all') {
                        setDatePreset('all')
                        setPicked(null)
                        setDateRange(null)
                        setTotal(null)
                      } else if (p.id === 'today') {
                        if (today) {
                          setDatePreset('today')
                          setPicked(today)
                          setDateRange({ from: today, to: today })
                          setTotal(null)
                        }
                      } else if (p.id === 'yesterday') {
                        if (today) {
                          const y = shiftDay(today, 1)
                          setDatePreset('yesterday')
                          setPicked(y)
                          setDateRange({ from: y, to: y })
                          setTotal(null)
                        }
                      } else if (p.id === '7days') {
                        if (today) {
                          setDatePreset('7days')
                          setPicked(null)
                          setDateRange({ from: shiftDay(today, 6), to: today })
                          setTotal(null)
                        }
                      } else if (p.id === '30days') {
                        if (today) {
                          setDatePreset('30days')
                          setPicked(null)
                          setDateRange({ from: shiftDay(today, 29), to: today })
                          setTotal(null)
                        }
                      }
                    }}
                    className={`rounded-lg px-2.5 py-1.5 transition-all ${
                      isActive
                        ? 'bg-card text-foreground font-semibold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>

            {/* A. Recent 5 Days Dropdown */}
            <select
              aria-label="Recent signal dates"
              value={datePreset === 'all' && !dateRange && !picked ? '' : (dateRange && dateRange.from !== dateRange.to ? '' : (activeDate ?? ''))}
              disabled={dates === null && !datesError}
              onChange={(e) => {
                if (e.target.value) pick(e.target.value)
              }}
              className="h-9 rounded-lg border border-input bg-background px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {dates === null && !datesError ? (
                <option value="" disabled>Loading dates…</option>
              ) : (
                <>
                  {datePreset === 'all' && !dateRange && !picked && <option value="" disabled>Recent dates</option>}
                  {dateRange && dateRange.from !== dateRange.to && <option value="" disabled>Date range active</option>}
                  {activeDate && (!dateRange || dateRange.from === dateRange.to) && !recent5.some((d) => d.date === activeDate) && (
                    <option value={activeDate}>{formatRunDate(activeDate)} (Other date)</option>
                  )}
                  {recent5.length === 0 ? (
                    <option value="" disabled>No recent runs</option>
                  ) : (
                    recent5.map((d) => (
                      <option key={d.date} value={d.date}>
                        {formatRunDate(d.date)} ({d.qualified} {d.qualified === 1 ? 'signal' : 'signals'})
                      </option>
                    ))
                  )}
                </>
              )}
            </select>

            {/* B. Calendar Date Picker */}
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="sr-only">Pick date</span>
              <input
                type="date"
                aria-label="Calendar date picker"
                max={today ?? undefined}
                value={datePreset === 'all' && !dateRange && !picked ? '' : (dateRange && dateRange.from !== dateRange.to ? '' : (activeDate ?? ''))}
                onChange={(e) => {
                  const val = e.target.value
                  if (val && (!today || isPickableDay(val, today))) pick(val)
                }}
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>

            {/* C. Scope Mode Toggle */}
            <Button
              type="button"
              size="sm"
              variant={allSignals ? 'default' : 'outline'}
              onClick={() => {
                setAllSignals((prev) => !prev)
                setTotal(null)
              }}
              className="h-9 text-xs font-medium"
              aria-pressed={allSignals}
              title={allSignals ? 'All Signals: aggregates across all sub-products and customer models' : 'Filtered Scope: narrows to current sub-product, customer model and region'}
            >
              {allSignals ? 'All Signals' : 'Filtered Scope'}
            </Button>

            <Button type="button" size="sm" variant="outline" onClick={() => { setManualNotice(null); setManualOpen(true) }} className="ml-auto h-9 text-xs font-medium">
              <Plus className="mr-1.5 size-4" />
              Add Opportunity Manually
            </Button>
          </div>

          {manualNotice && <Notice tone="info"><span>{manualNotice}</span></Notice>}

          {dates === null && !datesError ? (
            <Skeleton className="h-40 w-full rounded-2xl" aria-label="Loading" />
          ) : (
            <SignalList
              key={`${selected.key}-${allSignals ? 'all-signals' : 'scoped'}-${datePreset}-${dateRange ? `${dateRange.from}-${dateRange.to}` : (activeDate ?? 'default')}`}
              context={context}
              productKey={selected.key}
              offerId={offerId}
              customerModel={icpType}
              regions={regions}
              productLabel={selected.label}
              runDate={datePreset === 'all' && !dateRange && !picked ? null : (dateRange ? null : activeDate)}
              dateFrom={dateRange?.from}
              dateTo={dateRange?.to}
              allDates={datePreset === 'all' && !dateRange && !picked}
              allSignals={allSignals}
              runId={picked === null ? viewRunId : null}
              refreshKey={run.refreshKey}
              onTotal={setTotal}
              dayInfo={dayRun}
              today={today}
              timezone={timezone}
              onAddManual={() => { setManualNotice(null); setManualOpen(true) }}
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
          customerModel={icpType}
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
