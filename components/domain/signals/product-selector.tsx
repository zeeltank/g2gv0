'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { LaravelContext } from '@/lib/laravel-context'
import { ApiError } from '@/services/core'
import { resolveSelection } from '@/lib/product-selection'
import { portfolioService } from '@/services/portfolio/portfolio-service'
import type { ProductInfo, ProductsResponse } from '@/services/portfolio/types'

/** 'all' is every configured product (only where the screen can show several at once). Otherwise a product key. */
export type ProductChoice = string

const storageKey = (c: LaravelContext) => `g2g_product_${c.organizationId || c.subInstituteId || 'default'}`

function readStored(c: LaravelContext): string | null {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('product')
    if (fromUrl) return fromUrl
    return window.localStorage.getItem(storageKey(c))
  } catch {
    return null
  }
}

/** The products as stored in the Product Portfolio, with what each is missing for discovery. */
export function useProducts(context: LaravelContext) {
  const [data, setData] = useState<ProductsResponse['data'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let live = true
    portfolioService.getProducts(context)
      .then((res) => { if (live) { setData(res.data); setError(null) } })
      .catch((cause) => { if (live) setError(cause instanceof ApiError || cause instanceof Error ? cause.message : 'Could not load the products.') })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [context, version])

  return { products: data?.products ?? null, companyProfile: data?.company_profile ?? null, loading, error, reload }
}

/**
 * The selected product, remembered per organisation in this browser (and settable by `?product=`). The saved or linked value is only
 * used if it names a real configured product; otherwise `fallback` applies.
 */
export function useSelectedProduct(context: LaravelContext, products: ProductInfo[] | null, opts: { allowAll: boolean }) {
  const [choice, setChoice] = useState<ProductChoice | null>(null)

  useEffect(() => {
    if (!products || choice !== null) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoice(resolveSelection(readStored(context), products, opts.allowAll))
  }, [products, choice, context, opts.allowAll])

  const select = useCallback((next: ProductChoice) => {
    setChoice(next)
    try { window.localStorage.setItem(storageKey(context), next) } catch { /* private mode: the choice just is not remembered */ }
  }, [context])

  return [choice, select] as const
}

/** The product pills. A product that is not configured for discovery is still selectable (to read its records) but says so. */
export function ProductSelector({
  products, loading, error, value, onChange, allowAll,
}: {
  products: ProductInfo[] | null
  loading: boolean
  error: string | null
  value: ProductChoice | null
  onChange: (next: ProductChoice) => void
  allowAll: boolean
}) {
  if (loading && !products) return <Skeleton className="h-9 w-80 rounded-lg" aria-label="Loading products" />
  if (error || !products) return <p className="text-sm text-destructive" role="alert">{error ?? 'Products unavailable.'}</p>

  const items = [...(allowAll ? [{ key: 'all', label: 'All products', ready: true }] : []), ...products.map((p) => ({ key: p.key, label: p.label, ready: p.ready }))]

  return (
    <div role="radiogroup" aria-label="Product" className="inline-flex max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1">
      {items.map((p) => (
        <button
          key={p.key}
          type="button"
          role="radio"
          aria-checked={value === p.key}
          onClick={() => onChange(p.key)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${value === p.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {p.label}
          {!p.ready && <Badge variant="warning" className="px-1.5 py-0 text-[10px]">needs setup</Badge>}
        </button>
      ))}
    </div>
  )
}

/** What is missing for the selected product, in the words the backend gives (nothing is invented here). */
export function ProductSetupNotice({ product }: { product: ProductInfo | undefined }) {
  if (!product || product.ready) return null
  return (
    <div role="status" className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-medium">{product.label} is not ready for discovery.</p>
        <ul className="mt-1 list-disc pl-5">
          {product.missing.map((m) => <li key={m}>{m}</li>)}
        </ul>
        {product.next_step && <p className="mt-1 font-medium">Next: {product.next_step}</p>}
        <p className="mt-1 text-xs">Records already stored for it can still be read. Nothing from another product is used in its place.</p>
      </div>
    </div>
  )
}

/**
 * The product dropdown of Company opportunities: exactly the configured products, no "All". A product that is not set up is selectable (to
 * read its records and reach its setup) and says so.
 */
export function ProductDropdown({
  products, loading, error, value, onChange, id = 'product-select',
}: {
  products: ProductInfo[] | null
  loading: boolean
  error: string | null
  value: ProductChoice | null
  onChange: (next: ProductChoice) => void
  id?: string
}) {
  if (loading && !products) return <Skeleton className="h-10 w-64 rounded-lg" aria-label="Loading products" />
  if (error || !products) return <p className="text-sm text-destructive" role="alert">{error ?? 'Products unavailable.'}</p>

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">Product</label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 min-w-56 rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {products.map((p) => <option key={p.key} value={p.key}>{p.label}{p.ready ? '' : ' (ICP setup required)'}</option>)}
      </select>
    </div>
  )
}
