'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, MoreHorizontal, RefreshCw, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import type { LaravelContext } from '@/lib/laravel-context'
import { resolveTab, normalizeProductKey, configureHref, type ProductTab } from '@/lib/product-selection'
import { portfolioService } from '@/services/portfolio/portfolio-service'
import type { TaxonomyData } from '@/services/portfolio/types'
import { PremiumHeader } from '@/components/domain/signals/premium-page'
import { useProducts } from '@/components/domain/signals/product-selector'
import { SubProductIcpBadge } from './icp-status-badge'
import { ProductFormDialog } from './product-form-dialog'
import { ProductOffersList, ProductProfilePanel } from './product-profile-panel'
import { ProductSetupSteps } from './product-setup-steps'

const TABS: { key: ProductTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'offers', label: 'Offers' },
]

/**
 * One product on its own page. The product is named by the address, so what is shown (details, offers, the ICPs of its sub-products) is that
 * product's stored data only. A product has no ICP of its own: each sub-product's Individual ICP is set on that sub-product.
 */
export function ProductDetailView({ context, productKey }: { context: LaravelContext; productKey: string }) {
  const { products, loading, error, reload } = useProducts(context)
  const { user } = useAuth()
  const isAdmin = user?.role === 'administrator'
  const [tab, setTab] = useState<ProductTab>('overview')
  const [taxonomy, setTaxonomy] = useState<TaxonomyData | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const show = useCallback((next: ProductTab) => {
    setTab(next)
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', next)
      window.history.replaceState(null, '', url.toString())
    } catch { /* the address just is not updated */ }
  }, [])

  useEffect(() => {
    const initial = resolveTab(new URLSearchParams(window.location.search).get('tab'))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab(initial)
  }, [productKey])

  useEffect(() => {
    let live = true
    portfolioService.getTaxonomy(context).then((res) => { if (live) setTaxonomy(res.data) }).catch(() => { /* the form still opens; its lists are empty */ })
    return () => { live = false }
  }, [context])

  const canonicalKey = normalizeProductKey(productKey, products ?? undefined)
  const product = products?.find((p) => p.key === canonicalKey) ?? null

  useEffect(() => {
    if (product && canonicalKey && canonicalKey !== productKey && typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href)
        url.pathname = configureHref(canonicalKey)
        window.history.replaceState(null, '', url.toString())
      } catch {}
    }
  }, [product, canonicalKey, productKey])

  const back = (
    <Link
      href="/portfolio"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
    >
      <ArrowLeft className="size-4" /> All products
    </Link>
  )

  if (loading || !products) {
    return <div className="mx-auto max-w-6xl space-y-4 p-4 @xl:p-6"><Skeleton className="h-20 w-full rounded-2xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>
  }
  if (error) {
    return <div className="mx-auto max-w-6xl space-y-3 p-4 @xl:p-6">{back}<p role="alert" className="text-sm text-destructive">{error ?? 'Products unavailable.'}</p></div>
  }
  if (!product) {
    return (
      <div className="mx-auto max-w-6xl space-y-3 p-4 @xl:p-6">
        {back}
        <EmptyState title="Product not found" description={`There is no product "${productKey || 'specified'}" in this organisation.`} action={<Button asChild size="sm"><Link href="/portfolio">Go to Product Portfolio</Link></Button>} />
      </div>
    )
  }

  const forProduct = encodeURIComponent(product.key)

  return (
    <div className="@container mx-auto max-w-6xl space-y-5 p-4 @xl:p-6">
      {back}
      <PremiumHeader
        title={product.label}
        badge={<SubProductIcpBadge product={product} />}
        description={`${product.offers.length} offer${product.offers.length === 1 ? '' : 's'} · ${product.opportunities_count} opportunit${product.opportunities_count === 1 ? 'y' : 'ies'}${product.portfolio_name ? ` · Portfolio group: ${product.portfolio_name}` : ''}`}
        actions={
          <>
            <Button asChild size="sm" variant={product.ready ? 'default' : 'outline'}>
              <Link href={`/signals?product=${forProduct}`}><Sparkles className="mr-1.5 size-4" /> {product.ready ? 'Review opportunities' : 'Go to Company Opportunities'}</Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="outline" aria-label="More actions"><MoreHorizontal className="size-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => reload()}><RefreshCw className="mr-2 size-4" /> Refresh</DropdownMenuItem>
                {isAdmin && <DropdownMenuItem onSelect={() => setCreateOpen(true)}>Add a product to the portfolio</DropdownMenuItem>}
                <DropdownMenuItem asChild><Link href="/portfolio">Browse the full portfolio</Link></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div role="tablist" aria-label="Product sections" className="flex flex-wrap gap-1 border-b border-border/60">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`panel-${t.key}`}
            onClick={() => show(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tab === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t.label}
            {t.key === 'offers' && <Badge variant="muted" className="ml-1.5 px-1.5 py-0 text-[10px]">{product.offers.length}</Badge>}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="panel-overview" aria-labelledby="tab-overview" hidden={tab !== 'overview'} className="space-y-4">
        {product.generation_note && <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">{product.generation_note}</p>}
        <ProductSetupSteps product={product} />
        <ProductProfilePanel product={product} />
        <p className="text-xs text-muted-foreground">
          Each sub-product has its own ICP. <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => show('offers')}>Open the sub-products</Button> to see which have one and to set the others up.
        </p>
      </div>

      <div role="tabpanel" id="panel-offers" aria-labelledby="tab-offers" hidden={tab !== 'offers'} className="space-y-3">
        <ProductOffersList context={context} product={product} />
        <p className="text-xs text-muted-foreground">Offers are added, edited and removed in the <Link href="/portfolio" className="underline underline-offset-2">Product Portfolio</Link>.</p>
      </div>

      <ProductFormDialog
        context={context}
        taxonomy={taxonomy}
        product={null}
        products={products}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => { setCreateOpen(false); reload() }}
      />
    </div>
  )
}
