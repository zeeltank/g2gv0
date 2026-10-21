'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Plus, Search, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { LaravelContext } from '@/lib/laravel-context'
import { addProduct, notChosen, removeProduct } from '@/lib/icp-products'
import { portfolioService } from '@/services/portfolio/portfolio-service'
import type { ProductOffer } from '@/services/portfolio/types'

/**
 * The products an ICP is for, picked from THIS organisation's Product Portfolio. Nothing is chosen for the person: the picker starts with exactly what
 * the ICP saved (or nothing), shows search results only once something is typed, and lets a product be added or removed. A product that was
 * deleted from the portfolio is shown as removed so it can be taken out of the list.
 */
export function IcpProductPicker({
  context, chosen, disabled, catalogVersion, onChange, onCreate,
}: {
  context: LaravelContext
  /** The saved list of Offer IDs; null for an older ICP that has no list. */
  chosen: string[] | null
  disabled: boolean
  /** Changes when the portfolio changes (a product was added, edited or deleted), so names and results are read again. */
  catalogVersion: number
  onChange: (next: string[]) => void
  onCreate?: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductOffer[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [details, setDetails] = useState<Record<string, ProductOffer | 'removed'>>({})
  const seq = useRef(0)
  const list = chosen ?? []

  // Names for the chosen products (one read each; a product that no longer exists is marked as removed).
  useEffect(() => {
    let live = true
    for (const id of list) {
      if (details[id] && catalogVersion === 0) continue
      portfolioService.getOffer(context, id)
        .then((res) => { if (live) setDetails((d) => ({ ...d, [id]: res.data })) })
        .catch(() => { if (live) setDetails((d) => ({ ...d, [id]: 'removed' })) })
    }

    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, list.join('|'), catalogVersion])

  // Search the portfolio only when something is typed.
  useEffect(() => {
    const q = query.trim()
    const mine = ++seq.current
    if (q === '') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]); setError(''); setSearching(false)
      return
    }
    setSearching(true)
    const t = setTimeout(() => {
      portfolioService.getOffers(context, { search: q, per_page: 10 })
        .then((res) => { if (mine === seq.current) { setResults(res.data.data); setError('') } })
        .catch(() => { if (mine === seq.current) setError('Could not search the Product Portfolio.') })
        .finally(() => { if (mine === seq.current) setSearching(false) })
    }, 250)

    return () => clearTimeout(t)
  }, [query, context, catalogVersion])

  const shown = notChosen(results, list)

  return (
    <div className="space-y-3">
      {chosen === null && (
        <div role="status" className="rounded-lg border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground">
          This ICP has no product list yet, so it uses the offers stored for its product in the Product Portfolio. Choose products to make the list your own.
          {!disabled && <Button type="button" size="sm" variant="outline" className="ml-2" onClick={() => onChange([])}>Choose products</Button>}
        </div>
      )}

      {chosen !== null && (
        <ul aria-label="Products in this ICP" className="flex flex-wrap gap-2">
          {list.length === 0 && <li className="text-sm text-muted-foreground">No products chosen. The ICP is not tied to any product.</li>}
          {list.map((id) => {
            const d = details[id]
            const removed = d === 'removed'

            return (
              <li key={id} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${removed ? 'border-destructive/40 bg-destructive/5' : 'border-primary/30 bg-primary/5'}`}>
                <span className="min-w-0 break-words font-medium">{removed ? id : d ? d.name : id}</span>
                <span className="text-xs text-muted-foreground">{removed ? 'no longer in the portfolio' : d ? d.parent_product : ''}</span>
                {!disabled && (
                  <button type="button" aria-label={`Remove ${removed ? id : d ? d.name : id} from this ICP`} className="rounded-full p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onChange(removeProduct(list, id))}>
                    <X className="size-3.5" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {chosen !== null && !disabled && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-60 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                role="combobox"
                aria-expanded={query.trim() !== ''}
                aria-controls="icp-product-results"
                aria-label="Search your Product Portfolio"
                placeholder="Search your products by name, ID or description…"
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {onCreate && <Button type="button" size="sm" variant="outline" onClick={onCreate}><Plus className="mr-1 size-3.5" /> New product</Button>}
          </div>

          {query.trim() !== '' && (
            <div id="icp-product-results" role="listbox" aria-label="Matching products" className="max-h-56 overflow-y-auto rounded-lg border border-border/60 bg-card">
              {searching && <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Searching…</p>}
              {error && <p role="alert" className="p-3 text-sm text-destructive">{error}</p>}
              {!searching && !error && shown.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">No other product matches “{query.trim()}”. {onCreate ? 'Use New product to add it to your portfolio, then pick it here.' : ''}</p>
              )}
              {shown.map((o) => (
                <button
                  key={o.offer_id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="flex w-full items-start justify-between gap-3 border-b border-border/40 px-3 py-2 text-left last:border-b-0 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                  onClick={() => { onChange(addProduct(list, o.offer_id)); setDetails((d) => ({ ...d, [o.offer_id]: o })); setQuery('') }}
                >
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-medium text-foreground">{o.name} <span className="font-normal text-muted-foreground">· {o.offer_id}</span></span>
                    {o.what_it_does && <span className="block break-words text-xs text-muted-foreground">{o.what_it_does.slice(0, 140)}</span>}
                  </span>
                  <Badge variant="muted" className="shrink-0">{o.parent_product}</Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
