'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Loader2, Settings2, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { LaravelContext } from '@/lib/laravel-context'
import { configureHref } from '@/lib/product-selection'
import { chooseRunDate, formatRunDate } from '@/lib/run-dates'
import { Notice } from '@/components/domain/organization/department-management/signals-ui'
import { AdvancedTools } from '@/components/domain/signals/advanced-tools'
import { ProductDropdown, useProducts, useSelectedProduct } from '@/components/domain/signals/product-selector'
import { SignalList } from '@/components/domain/signals/signal-list'
import { useGenerateSignals } from '@/components/domain/signals/use-generate-signals'
import { opportunitiesService, type RunDatesResponse } from '@/services/signals/opportunities'

type RunDate = RunDatesResponse['data']['dates'][number]

/**
 * Company Opportunities: pick a product, optionally open its details and ICP, press Generate Signals, then read what that product's successful
 * research runs saved, one day at a time. One explicit product is always selected ("All products" is not offered). Choosing a product or a day
 * only reads stored rows; research starts only from the Generate Signals button.
 */
export function CompanyOpportunities({ context }: { context: LaravelContext }) {
  const { products, loading, error } = useProducts(context)
  const [product, setProduct] = useSelectedProduct(context, products, { allowAll: false })
  const selected = products?.find((p) => p.key === product) ?? null
  const run = useGenerateSignals(context, selected ? selected.key : null, products)

  const [dates, setDates] = useState<RunDate[] | null>(null)
  const [datesError, setDatesError] = useState<string | null>(null)
  const [runDate, setRunDate] = useState<string | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const seenCompleted = useRef(0)

  // The product's successful-run dates, read from the stored runs. Another product starts clean; a finished run jumps to its (newest) day.
  const key = selected?.key ?? null
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDates(null); setDatesError(null); setRunDate(null); setTotal(null)
    seenCompleted.current = run.completedCount
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!key) return
    let live = true
    const jump = run.completedCount !== seenCompleted.current
    seenCompleted.current = run.completedCount
    opportunitiesService.getRunDates(context, key)
      .then((res) => {
        if (!live) return
        setDates(res.data.dates)
        setDatesError(null)
        setRunDate((current) => chooseRunDate(res.data.dates, current, jump))
      })
      .catch((e) => { if (live) setDatesError(e instanceof Error ? e.message : 'Could not load the research dates.') })
    return () => { live = false }
  }, [context, key, run.refreshKey, run.completedCount])

  const ready = Boolean(selected?.ready)
  const day = dates?.find((d) => d.date === runDate) ?? null
  const stage = run.activeRun?.stage_message

  return (
    <div className="@container mx-auto max-w-6xl space-y-5 p-4 @xl:p-6">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Company Opportunities</h1>
          {selected && <Badge variant="navy" className="text-xs">{selected.label}</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">Discover evidence-backed sales opportunities for your selected product.</p>
      </header>

      <section aria-label="Product and actions" className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm @xl:p-5">
        <div className="flex flex-wrap items-end gap-3">
          <ProductDropdown products={products} loading={loading} error={error} value={product} onChange={setProduct} />

          {selected && (
            <Button asChild variant="outline" className="h-10">
              <Link href={configureHref(selected.key)}><Settings2 className="mr-2 size-4" /> Product Details &amp; ICP</Link>
            </Button>
          )}

          <div className="ml-auto flex flex-col items-end gap-1">
            <Button
              type="button"
              size="lg"
              className="h-10 min-w-48"
              onClick={() => void run.generate()}
              disabled={!selected || run.running}
              aria-describedby="generate-hint"
            >
              {run.running ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
              {run.running ? 'Generating…' : 'Generate Signals'}
            </Button>
            <span id="generate-hint" className="text-xs text-muted-foreground">
              {run.running ? 'Research is running. This can take a few minutes.' : selected ? `Runs research for ${selected.label} only.` : 'Choose a product.'}
            </span>
          </div>
        </div>

        {selected && !ready && (
          <div role="status" className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
            <p className="font-medium">ICP setup required for {selected.label}.</p>
            {selected.missing.length > 0 && <ul className="mt-1 list-disc pl-5">{selected.missing.map((m) => <li key={m}>{m}</li>)}</ul>}
            <p className="mt-1">
              {selected.next_step ?? 'Configure its Ideal Customer Profile first.'}{' '}
              <Link href={configureHref(selected.key)} className="font-medium underline underline-offset-2">Configure ICP</Link>
            </p>
          </div>
        )}
      </section>

      {run.running && (
        <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
          <span className="min-w-0 break-words"><span className="font-medium">Generating signals for {selected?.label}.</span> {stage ?? 'Preparing the searches…'}</span>
        </div>
      )}

      {run.notice && (
        <Notice tone={run.notice.tone === 'success' ? 'info' : run.notice.tone}>
          <span>{run.notice.text}</span>
          {run.notice.missing && run.notice.missing.length > 0 && <ul className="mt-1 list-disc pl-5">{run.notice.missing.map((m) => <li key={m}>{m}</li>)}</ul>}
          {run.notice.nextStep && <span className="mt-1 block">{run.notice.nextStep}</span>}
        </Notice>
      )}

      {selected && (
        <section aria-label={`${selected.label} signals`} className="space-y-4">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
            {dates && dates.length > 0 ? (
              <div className="flex flex-col gap-1">
                <label htmlFor="run-date" className="text-xs font-medium text-muted-foreground">Research date</label>
                <select
                  id="run-date"
                  value={runDate ?? ''}
                  onChange={(e) => setRunDate(e.target.value)}
                  className="h-10 min-w-48 rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {dates.map((d) => <option key={d.date} value={d.date}>{formatRunDate(d.date)}</option>)}
                </select>
              </div>
            ) : (
              (datesError || dates === null) && <p className="text-sm text-muted-foreground" role="status">{datesError ?? 'Loading research dates…'}</p>
            )}
            {day && (
              <p className="pb-2 text-xs text-muted-foreground" aria-live="polite">
                {day.status === 'partial' ? 'Finished with limits' : 'Completed'}
                {day.runs > 1 ? ` · ${day.runs} runs` : ''}
                {total !== null ? ` · ${total} ${total === 1 ? 'signal' : 'signals'}` : ''}
              </p>
            )}
          </div>

          {dates === null && !datesError ? (
            <Skeleton className="h-40 w-full rounded-2xl" aria-label="Loading" />
          ) : (
            <SignalList
              key={selected.key}
              context={context}
              productKey={selected.key}
              productLabel={selected.label}
              runDate={runDate}
              refreshKey={run.refreshKey}
              onTotal={setTotal}
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
