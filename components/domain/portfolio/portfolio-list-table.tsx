'use client'

import Link from 'next/link'
import { ChevronDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { formatMoney, formatQuantity, mayTick, sellKeysPresent, typeWord, whyNoTick, type DisplayItem, type GroupHeader } from '@/lib/portfolio-list/model'
import type { SortKey } from '@/lib/portfolio-list/query'
import { GROUP_ROW } from '@/lib/portfolio-list/tones'
import type { PortfolioCan, PortfolioRow } from '@/services/product-master/portfolio-list-types'
import { ArchivedChip, IcpChip, ProductChip, ReadinessChip, SharedChip, StateChip } from './portfolio-list-chips'

/** Where a row opens: a Product its own page (`/portfolio/{key}`), a Sub-product the page of the record (`/portfolio/products/{id}`). */
export function rowHref(row: Pick<PortfolioRow, 'kind' | 'key' | 'id'>): string {
  return row.kind === 'product' ? `/portfolio/${encodeURIComponent(row.key)}` : `/portfolio/products/${row.id}`
}

function SortHead({ label, sortKey, active, dir, onSort, className }: {
  label: string
  sortKey: SortKey
  active: SortKey
  dir: 'asc' | 'desc'
  onSort: (key: SortKey) => void
  className?: string
}) {
  const current = active === sortKey
  return (
    <TableHead className={className} aria-sort={current ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1 normal-case text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {label}
        {current && <ChevronDown className={cn('size-3.5 transition-transform', dir === 'asc' && 'rotate-180')} aria-hidden="true" />}
      </button>
    </TableHead>
  )
}

function Dash({ why }: { why?: string }) {
  return <span className="text-muted-foreground" title={why}>—</span>
}

/** A Sell value of a row: the value, a dash when the row has none, "Not shown" when the caller may not view this type's Sell section. */
function SellValue({ row, value }: { row: PortfolioRow; value: string | null }) {
  if (!sellKeysPresent(row)) return row.hasSell ? <span className="text-muted-foreground" title="You may not view the price details of this type.">Not shown</span> : <Dash />
  return value !== null ? <>{value}</> : <Dash />
}

function GroupRow({ group, columns, canAdd, onAdd }: { group: GroupHeader; columns: number; canAdd: boolean; onAdd: (productId: number) => void }) {
  const product = group.row
  return (
    <TableRow className={GROUP_ROW} data-group={group.key}>
      <TableCell colSpan={columns}>
        <div className="flex flex-wrap items-center gap-2">
          {product ? (
            <>
              <Link href={rowHref(product)} className="font-semibold text-foreground hover:underline">{product.name}</Link>
              <ProductChip />
              {product.shared && <SharedChip />}
              {product.status === 'archived' && <ArchivedChip />}
              <span className="text-xs text-muted-foreground">{product.subProductCount ?? 0} {product.subProductCount === 1 ? 'sub-product' : 'sub-products'}</span>
              {canAdd && !product.shared && product.status === 'active' && (
                <Button type="button" size="sm" variant="outline" onClick={() => onAdd(product.id)} aria-label={`Add a sub-product to ${product.name}`}>
                  <Plus className="mr-1 size-3.5" aria-hidden="true" />Add sub-product
                </Button>
              )}
            </>
          ) : (
            <>
              <span className="font-semibold text-foreground">{group.label}</span>
              {group.continued && <span className="text-xs text-muted-foreground">continued from the previous page</span>}
              {group.noProduct && <span className="text-xs text-muted-foreground">Open one to choose its Product.</span>}
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}

/**
 * The rows of the page, grouped by Product. A Sub-product is drawn under the header of its Product; the columns that hold Sell data (SKU, Price, Category, In
 * stock, Sold in CRM) are drawn only for a caller who may view Sell. Every Sub-product row has a tick box: disabled, with its reason, for a row a bulk action
 * cannot change.
 */
export function PortfolioListTable({ items, can, sort, dir, onSort, selected, onToggle, onToggleAll, canAddSubProduct, onAddSubProduct, busy }: {
  items: DisplayItem[]
  can: PortfolioCan
  sort: SortKey
  dir: 'asc' | 'desc'
  onSort: (key: SortKey) => void
  selected: ReadonlySet<number>
  onToggle: (id: number) => void
  onToggleAll: (checked: boolean) => void
  canAddSubProduct: boolean
  onAddSubProduct: (productId: number) => void
  busy: boolean
}) {
  const sell = can.viewSell
  const rows = items.flatMap((i) => (i.kind === 'row' ? [i.row] : []))
  const tickable = rows.filter((r) => mayTick(r, can))
  const allTicked = tickable.length > 0 && tickable.every((r) => selected.has(r.id))
  const columns = 6 + (sell ? 5 : 0)

  return (
    <div className={cn('overflow-x-auto rounded-lg border border-border transition-opacity', busy && 'opacity-60')} aria-busy={busy}>
      <Table>
        <caption className="sr-only">Products and their sub-products</caption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <input
                type="checkbox"
                aria-label="Select every sub-product on this page that can be changed"
                checked={allTicked}
                disabled={tickable.length === 0}
                onChange={(event) => onToggleAll(event.target.checked)}
              />
            </TableHead>
            <SortHead label="Name" sortKey="name" active={sort} dir={dir} onSort={onSort} />
            <TableHead>Type</TableHead>
            {sell && <TableHead>SKU</TableHead>}
            {sell && <SortHead label="Price" sortKey="price" active={sort} dir={dir} onSort={onSort} />}
            {sell && <TableHead className="hidden lg:table-cell">Category</TableHead>}
            {sell && <TableHead className="hidden text-right lg:table-cell">In stock</TableHead>}
            {sell && <TableHead>Sold in CRM</TableHead>}
            <SortHead label="Readiness" sortKey="readiness" active={sort} dir={dir} onSort={onSort} />
            <SortHead label="Signals" sortKey="signals" active={sort} dir={dir} onSort={onSort} className="text-right" />
            <TableHead>ICP</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => {
            if (item.kind === 'group') {
              return <GroupRow key={`g-${item.key}-${index}`} group={item} columns={columns} canAdd={canAddSubProduct} onAdd={onAddSubProduct} />
            }
            const row = item.row
            const why = whyNoTick(row, can)
            return (
              <TableRow key={`r-${row.id}`} className={cn(row.status === 'archived' && 'opacity-70')} data-row={row.id}>
                <TableCell>
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.name}`}
                    title={why ?? undefined}
                    checked={selected.has(row.id)}
                    disabled={why !== null}
                    onChange={() => onToggle(row.id)}
                  />
                </TableCell>
                <TableCell className="pl-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={rowHref(row)} className="font-medium text-foreground hover:underline">{row.name}</Link>
                    {row.status === 'archived' && <ArchivedChip />}
                    {row.shared && <SharedChip />}
                  </div>
                </TableCell>
                <TableCell>{typeWord(row)}</TableCell>
                {sell && <TableCell className="font-mono text-xs"><SellValue row={row} value={row.sku ?? null} /></TableCell>}
                {sell && <TableCell><SellValue row={row} value={formatMoney(row.unitPrice, row.currency)} /></TableCell>}
                {sell && <TableCell className="hidden lg:table-cell"><SellValue row={row} value={row.category ?? null} /></TableCell>}
                {sell && <TableCell className="hidden text-right lg:table-cell"><SellValue row={row} value={formatQuantity(row.qtyInStock)} /></TableCell>}
                {sell && <TableCell>{row.state ? <StateChip state={row.state} /> : <Dash />}</TableCell>}
                <TableCell><ReadinessChip readiness={row.readiness} /></TableCell>
                <TableCell className="text-right">{row.signalsFound === null ? <Dash /> : row.signalsFound}</TableCell>
                <TableCell><IcpChip state={row.icp} /></TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
