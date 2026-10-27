'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import type { LaravelContext } from '@/lib/laravel-context'
import { icpHref } from '@/lib/product-selection'
import { formatRunDate } from '@/lib/run-dates'
import { isPickableDay, recentDays, relativeLabel, todayIn } from '@/lib/signal-dates'
import { Notice } from '@/components/domain/organization/department-management/signals-ui'
import { AdvancedTools } from '@/components/domain/signals/advanced-tools'
import { RegionSelector } from '@/components/domain/signals/region-selector'
import { regionLabel, type RegionSelection } from '@/lib/region-scope'
import { ProductDropdown, useProducts, useSelectedProduct } from '@/components/domain/signals/product-selector'
import { ResearchContextNotice } from '@/components/domain/signals/research-context-notice'
import { ResearchProgress } from '@/components/domain/signals/research-progress'
import { SignalList } from '@/components/domain/signals/signal-list'
import { useGenerateSignals } from '@/components/domain/signals/use-generate-signals'
import { opportunitiesService, type RunDatesResponse } from '@/services/signals/opportunities'

type RunDate = RunDatesResponse['data']['dates'][number]

/**
 * Company Opportunities: pick a product, press Generate Signals (its progress shows right below), then read what that product's research saved
 * for a day: today and the two days before it by default, any older day from the calendar. One explicit product is always selected. Choosing a
 * product or a day only reads stored rows; research starts only from the Generate Signals button. Product details and the ICP are edited in
 * Product Portfolio.
 */
export function CompanyOpportunities({ context }: { context: LaravelContext }) {
  const { products, loading, error } = useProducts(context)
  const [product, setProduct] = useSelectedProduct(context, products, { allowAll: false })
  const selected = products?.find((p) => p.key === product) ?? null
  const run = useGenerateSignals(context, selected ? selected.key : null, products)

  const [dates, setDates] = useState<RunDate[] | null>(null)
  const [timezone, setTimezone] = useState<string | null>(null)
  const [datesError, setDatesError] = useState<string | null>(null)
  // null = the default: today.
  const [picked, setPicked] = useState<string | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  // The places THIS request is limited to ([] = All Regions). It belongs to the selected product's screen only: another product starts on All Regions.
  const [regions, setRegions] = useState<RegionSelection[]>([])
  const seenCompleted = useRef(0)

  const key = selected?.key ?? null
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDates(null); setDatesError(null); setPicked(null); setTotal(null); setRegions([])
    seenCompleted.current = run.completedCount
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!key) return
    let live = true
    const finished = run.completedCount !== seenCompleted.current
    seenCompleted.current = run.completedCount
    opportunitiesService.getRunDates(context, key)
      .then((res) => {
        if (!live) return
        setDates(res.data.dates)
        setTimezone(res.data.timezone)
        setDatesError(null)
        if (finished) setPicked(null)   // a run that just finished saved today's results
      })
      .catch((e) => { if (live) setDatesError(e instanceof Error ? e.message : 'Could not load the research dates.') })
    return () => { live = false }
  }, [context, key, run.refreshKey, run.completedCount])

  const ready = Boolean(selected?.ready)
  const today = timezone ? todayIn(timezone) : null
  const recent = today ? recentDays(today) : []
  const day = picked ?? today
  const dayRun = dates?.find((d) => d.date === day) ?? null
  const latest = run.status?.latest_run ?? null
  const shownRun = run.activeRun ?? (latest && (latest.status === 'running' || latest.status === 'failed' || latest.status === 'skipped') ? latest : null)
  const pick = (d: string) => { setPicked(d === today ? null : d); setTotal(null) }

  return (
    <div className="space-y-5">
      <section aria-label="Product and actions" className="premium-card rounded-2xl border border-border/60 bg-card p-4 shadow-sm @xl:p-5">
        <div className="flex flex-wrap items-end gap-3">
          <ProductDropdown products={products} loading={loading} error={error} value={product} onChange={setProduct} />
          <RegionSelector value={regions} onChange={setRegions} suggestions={selected?.icp?.regions ?? []} disabled={run.running || !selected} />
          <div className="w-full sm:w-auto sm:ml-auto flex flex-col items-stretch sm:items-end gap-1">
            <Button
              type="button"
              size="lg"
              className="h-10 w-full sm:w-auto min-w-48"
              onClick={() => void run.generate(regions)}
              disabled={!selected || run.running}
              aria-describedby="generate-hint"
            >
              {run.running ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
              {run.running ? 'Generating…' : 'Generate Signals'}
            </Button>
            <span id="generate-hint" className="text-xs text-muted-foreground">
              {run.running ? 'Research is running. This can take a few minutes.' : selected ? `Runs research for ${selected.label} only${regions.length > 0 ? `, in ${regionLabel(regions)}` : ''}.` : 'Choose a product.'}
            </span>
          </div>
        </div>

        {selected && !ready && (
          <div role="status" className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
            <p className="font-medium">{selected.label} is not ready for signals.</p>
            {selected.missing.length > 0 && <ul className="mt-1 list-disc pl-5">{selected.missing.map((m) => <li key={m}>{m}</li>)}</ul>}
            <p className="mt-1">
              {selected.next_step ?? 'Its Ideal Customer Profile needs attention.'}{' '}
              <Link href={icpHref(selected.key)} className="font-medium underline underline-offset-2">Open it in Product Portfolio</Link>
            </p>
          </div>
        )}

        {selected && <ResearchContextNotice context={context} productKey={selected.key} refreshKey={run.refreshKey} />}

        {/* The run's real progress, right under the product it belongs to. */}
        <ResearchProgress run={shownRun} onRetry={() => void run.generate(regions)} retryDisabled={run.running || !selected?.ready} />
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
            {today ? (
              <>
                <div role="radiogroup" aria-label="Signal date" className="inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1 text-sm">
                  {recent.map((d) => {
                    const info = dates?.find((x) => x.date === d)
                    return (
                      <button
                        key={d}
                        type="button"
                        role="radio"
                        aria-checked={day === d}
                        onClick={() => pick(d)}
                        className={`rounded-md px-3 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${day === d ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        {relativeLabel(d, today) ?? formatRunDate(d)}
                        <span className="ml-1.5 text-xs text-muted-foreground">{info ? `${info.runs} run${info.runs === 1 ? '' : 's'}` : 'no run'}</span>
                      </button>
                    )
                  })}
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Older date
                  <input
                    type="date"
                    max={today}
                    value={day && !recent.includes(day) ? day : ''}
                    onChange={(e) => { if (isPickableDay(e.target.value, today)) pick(e.target.value) }}
                    className="h-9 rounded-lg border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
                {day && !recent.includes(day) && (
                  <Button size="sm" variant="ghost" onClick={() => { setPicked(null); setTotal(null) }}>Back to the last 3 days</Button>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground" role="status">{datesError ?? 'Loading dates…'}</p>
            )}
            {day && dayRun && !shownRun && (
              <p className="text-xs text-muted-foreground" aria-live="polite">
                Showing {formatRunDate(day)} · {dayRun.status === 'partial' ? 'finished with limits' : 'completed'}
                {total !== null ? ` · ${total} ${total === 1 ? 'signal' : 'signals'}` : ''}
              </p>
            )}
          </div>

          {dates === null && !datesError ? (
            <Skeleton className="h-40 w-full rounded-2xl" aria-label="Loading" />
          ) : day && dayRun ? (
            <SignalList
              key={`${selected.key}-${day}`}
              context={context}
              productKey={selected.key}
              productLabel={selected.label}
              runDate={day}
              refreshKey={run.refreshKey}
              onTotal={setTotal}
              dayInfo={dayRun}
            />
          ) : (
            <EmptyState
              title={day ? `No research ran on ${formatRunDate(day)}` : 'No research dates yet'}
              description={`${selected.label} has no successful research run on this date, so there are no signals to show. Pick another date, or press Generate Signals.`}
            />
          )}
        </section>
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
