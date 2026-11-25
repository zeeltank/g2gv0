'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FIELD_ERROR_TEXT } from '@/lib/org-accounts/tones'
import { sellWord, typeWord } from '@/lib/portfolio/page-model'
import type { PmListCan, PmListRow, PmPaging, PmPriceTotal } from '@/services/product-master/record-types'
import { Money } from './currency-badge'
import { IcpChip, ReadinessChip, SellChip } from './portfolio-chips'
import { PriceTotals } from './price-card'

/** The address of a Sub-product's own page. */
export const subProductHref = (id: number): string => `/portfolio/products/${id}`

export interface SubProductsData {
  rows: PmListRow[]
  paging: PmPaging
  /** What the caller may do, as the list answered it (`viewSell` decides whether the Sold in CRM column is drawn). */
  can: PmListCan
}

/**
 * The Sub-products tab of a Product: a paged list, each name linking to its own page, with Add sub-product. The state and the readiness are open to every
 * signed-in person; the price column appears only when the server sent a price (it does so only for a caller who may view that Sub-product's Sell section).
 */
export function SubProductsTab({ data, totals, error, loading, canAdd, onAdd, onPage }: {
  data: SubProductsData | null
  /** What the Sub-products add up to (S16), one block per currency; nothing is drawn for none. */
  totals?: readonly PmPriceTotal[] | null
  error: string
  loading: boolean
  canAdd: boolean
  onAdd: () => void
  onPage: (page: number) => void
}) {
  if (error) return <p role="alert" className={`text-sm ${FIELD_ERROR_TEXT}`}>{error}</p>
  if (!data) return <p role="status" className="text-sm text-muted-foreground">Loading…</p>
  const add = canAdd ? <Button size="sm" onClick={onAdd}><Plus className="mr-1.5 size-4" aria-hidden="true" />Add sub-product</Button> : undefined
  if (data.rows.length === 0) return <EmptyState title="No sub-products yet" description="Add the first sub-product of this product." action={add} />
  const showPrice = data.rows.some((r) => r.unitPrice !== undefined)
  // The mock-up shows Sold in CRM and Price only to people who may open the Sell side; the state itself is open in the API, so the screen holds it back.
  const showSold = data.can.viewSell

  return (
    <div className="space-y-3">
      <PriceTotals totals={totals} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{data.paging.total} {data.paging.total === 1 ? 'sub-product' : 'sub-products'}</p>
        {add}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border" aria-busy={loading}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Type</TableHead>{showSold && <TableHead>Sold in CRM</TableHead>}{showPrice && <TableHead className="text-right">Price</TableHead>}
              <TableHead>Readiness</TableHead><TableHead className="text-right">Signals</TableHead><TableHead>ICP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium"><Link href={subProductHref(r.id)} className="text-foreground underline underline-offset-2 hover:no-underline">{r.name}</Link></TableCell>
                <TableCell>{typeWord(r.type)}</TableCell>
                {showSold && <TableCell><SellChip word={sellWord(r.state)} /></TableCell>}
                {showPrice && <TableCell className="text-right">{r.unitPrice === null || r.unitPrice === undefined ? '—' : <Money amount={r.unitPrice} code={r.currency ?? null} />}</TableCell>}
                <TableCell><ReadinessChip readiness={r.readiness} />{!r.readiness && <span className="text-muted-foreground">Not described</span>}</TableCell>
                <TableCell className="text-right">{r.signalsFound === null ? '—' : r.signalsFound}</TableCell>
                <TableCell><IcpChip state={r.icp} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {data.paging.lastPage > 1 && (
        <nav aria-label="Sub-product pages" className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">Page {data.paging.page} of {data.paging.lastPage}</span>
          <span className="flex gap-2">
            <Button size="sm" variant="outline" disabled={loading || data.paging.page <= 1} onClick={() => onPage(data.paging.page - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={loading || data.paging.page >= data.paging.lastPage} onClick={() => onPage(data.paging.page + 1)}>Next</Button>
          </span>
        </nav>
      )}
    </div>
  )
}

/** The Signals & ICP tab of a Product: a Product has no ideal customer of its own, so it lists the state of each Sub-product's, each linking to that Sub-product's tab. */
export function ProductSignalsTab({ data, productKey, error }: { data: SubProductsData | null; productKey: string; error: string }) {
  if (error) return <p role="alert" className={`text-sm ${FIELD_ERROR_TEXT}`}>{error}</p>
  if (!data) return <p role="status" className="text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        A product has no ideal customer of its own: each sub-product has its own. Open a sub-product to see or set it.{' '}
        <Link href={`/signals?product=${encodeURIComponent(productKey)}`} className="text-foreground underline underline-offset-2 hover:no-underline">See the signals for this product</Link>.
      </p>
      {data.rows.length === 0
        ? <EmptyState title="No sub-products yet" description="Add a sub-product, then give it an ideal customer." />
        : (
          <ul aria-label="Ideal customer of each sub-product" className="divide-y divide-border/60 rounded-lg border border-border">
            {data.rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-3 text-sm">
                <Link href={`${subProductHref(r.id)}?tab=signals`} className="min-w-0 font-medium text-foreground underline underline-offset-2 hover:no-underline">{r.name}</Link>
                <span className="flex flex-wrap items-center gap-3"><span className="text-muted-foreground">{r.signalsFound === null ? 'Signals not counted' : `${r.signalsFound} ${r.signalsFound === 1 ? 'signal' : 'signals'}`}</span><IcpChip state={r.icp} /></span>
              </li>
            ))}
          </ul>
        )}
    </div>
  )
}
