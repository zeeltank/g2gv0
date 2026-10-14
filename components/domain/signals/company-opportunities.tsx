'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Loader2, Settings2, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { LaravelContext } from '@/lib/laravel-context'
import { configureHref } from '@/lib/product-selection'
import { OpportunitiesView } from '@/components/domain/organization/department-management/opportunities-view'
import { Notice } from '@/components/domain/organization/department-management/signals-ui'
import { AdvancedTools } from '@/components/domain/signals/advanced-tools'
import { ScholarSignalsView } from '@/components/domain/signals/scholar-signals-view'
import { ProductDropdown, useProducts, useSelectedProduct } from '@/components/domain/signals/product-selector'
import { useGenerateSignals } from '@/components/domain/signals/use-generate-signals'

type Layout = 'cards' | 'detail'
const LAYOUT_KEY = 'g2g_company_opportunities_layout'

/**
 * Company Opportunities: pick a product, optionally open its details and ICP, press Generate Signals, read that product's stored
 * opportunities. One explicit product is always selected ("All products" is not offered); the list, the readiness, the configuration link
 * and the run all follow it together. Records come from the backend list filtered by the stored product, never from a run response.
 */
export function CompanyOpportunities({ context }: { context: LaravelContext }) {
  const { products, loading, error } = useProducts(context)
  const [product, setProduct] = useSelectedProduct(context, products, { allowAll: false })
  const selected = products?.find((p) => p.key === product) ?? null
  const run = useGenerateSignals(context, selected ? selected.key : null, products)
  const [layout, setLayout] = useState<Layout>('cards')

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LAYOUT_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === 'cards' || saved === 'detail') setLayout(saved)
    } catch { /* not remembered */ }
  }, [])

  const pickLayout = (next: Layout) => {
    setLayout(next)
    try { window.localStorage.setItem(LAYOUT_KEY, next) } catch { /* not remembered */ }
  }

  const ready = Boolean(selected?.ready)
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

      {product === 'scholarclone' && (
        <div className="flex justify-end">
          <div role="radiogroup" aria-label="ScholarClone layout" className="inline-flex gap-0.5 rounded-lg bg-muted/60 p-0.5 text-xs">
            {([['cards', 'Sales cards'], ['detail', 'Full detail']] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={layout === id}
                onClick={() => pickLayout(id)}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${layout === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <section aria-label={`${selected.label} opportunities`} aria-live="polite">
          {selected.key === 'scholarclone' && layout === 'cards'
            ? <ScholarSignalsView key={selected.key} embedded refreshKey={run.refreshKey} />
            : <div className="-mx-4 @xl:-mx-6"><OpportunitiesView key={selected.key} context={context} product={selected.key} embedded refreshKey={run.refreshKey} /></div>}
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
