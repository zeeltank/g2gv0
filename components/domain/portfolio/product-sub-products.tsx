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
export function SubProductsTab({ data, totals, error, loading, canAdd, onAdd, onPage, archived }: {
  data: SubProductsData | null
  /** The archived Sub-products, kept out of the list above and shown only when asked for (a deleted or archived Sub-product must not look alive). */
  archived?: ArchivedSubProducts
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
  const archivedPart = archived && archived.count > 0 ? <ArchivedPart archived={archived} /> : null
  if (data.rows.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState title="No sub-products yet" description="Add the first sub-product of this product." action={add} />
        {archivedPart}
      </div>
    )
  }
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
      <RowsTable rows={data.rows} showSold={showSold} showPrice={showPrice} loading={loading} />
      <Pager label="Sub-product pages" paging={data.paging} loading={loading} onPage={onPage} />
      {archivedPart}
    </div>
  )
}

/** What the Sub-products tab needs to offer the archived ones: how many there are, whether they are open, and their own page of rows. */
export interface ArchivedSubProducts {
  count: number
  open: boolean
  data: SubProductsData | null
  loading: boolean
  error: string
  onToggle: () => void
  onPage: (page: number) => void
}

function RowsTable({ rows, showSold, showPrice, loading }: { rows: PmListRow[]; showSold: boolean; showPrice: boolean; loading: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border" aria-busy={loading}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead><TableHead>Type</TableHead>{showSold && <TableHead>Sold in CRM</TableHead>}{showPrice && <TableHead className="text-right">Price</TableHead>}
            <TableHead>Readiness</TableHead><TableHead className="text-right">Signals</TableHead><TableHead>ICP</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
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
  )
}

function Pager({ label, paging, loading, onPage }: { label: string; paging: PmPaging; loading: boolean; onPage: (page: number) => void }) {
  if (paging.lastPage <= 1) return null
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">Page {paging.page} of {paging.lastPage}</span>
      <span className="flex gap-2">
        <Button size="sm" variant="outline" disabled={loading || paging.page <= 1} onClick={() => onPage(paging.page - 1)}>Previous</Button>
        <Button size="sm" variant="outline" disabled={loading || paging.page >= paging.lastPage} onClick={() => onPage(paging.page + 1)}>Next</Button>
      </span>
    </nav>
  )
}

/** The archived Sub-products, closed until asked for: they are out of the lists, the pickers and the signals, and only here can one be found to be opened and restored. */
function ArchivedPart({ archived }: { archived: ArchivedSubProducts }) {
  const { data, open } = archived
  return (
    <section aria-label="Archived sub-products" className="space-y-2 border-t border-border pt-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" variant="outline" aria-expanded={open} onClick={archived.onToggle}>
          {open ? 'Hide archived' : `Show ${archived.count} archived`}
        </Button>
        <p className="text-xs text-muted-foreground">Archived sub-products are hidden from the lists, the pickers and the signals. Open one to restore it.</p>
      </div>
      {open && (archived.error
        ? <p role="alert" className={`text-sm ${FIELD_ERROR_TEXT}`}>{archived.error}</p>
        : !data
          ? <p role="status" className="text-sm text-muted-foreground">Loading…</p>
          : (
            <>
              <RowsTable rows={data.rows} showSold={data.can.viewSell} showPrice={data.rows.some((r) => r.unitPrice !== undefined)} loading={archived.loading} />
              <Pager label="Archived sub-product pages" paging={data.paging} loading={archived.loading} onPage={archived.onPage} />
            </>
          ))}
    </section>
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
