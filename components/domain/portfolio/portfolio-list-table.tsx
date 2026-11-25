'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronDown, MoreHorizontal, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { formatMoney, formatQuantity, mayTickRow, productTotal, rowActions, sellKeysPresent, whyNoTick, type DisplayItem, type GroupHeader, type RowAction } from '@/lib/portfolio-list/model'
import type { SortKey } from '@/lib/portfolio-list/query'
import { GROUP_ROW } from '@/lib/portfolio-list/tones'
import type { PortfolioCan, PortfolioRow } from '@/services/product-master/portfolio-list-types'
import { Money } from './currency-badge'
import { ArchivedChip, IcpChip, ProductChip, ReadinessChip, ServiceChip, SharedChip, StateChip } from './portfolio-list-chips'

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
      {/* Every heading has the same look (the cell's small capitals); the one the list is sorted by is darker and carries the arrow. */}
      <button type="button" onClick={() => onSort(sortKey)} className={cn('inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', current && 'text-foreground')}>
        {label}
        {current && <ChevronDown className={cn('size-3.5 transition-transform', dir === 'asc' && 'rotate-180')} aria-hidden="true" />}
      </button>
    </TableHead>
  )
}

/** What a row's menu does, told to the list: move it to another Product, or delete it. */
export type RowActionHandler = (row: PortfolioRow, action: RowAction) => void

/** The "..." menu of a row: Move to another Product and Delete for a Sub-product, Delete product for a Product. Not drawn when the person may do neither. */
function RowMenu({ row, can, onAction }: { row: PortfolioRow; can: PortfolioCan; onAction: RowActionHandler }) {
  const actions = rowActions(row, can)
  if (actions.length === 0) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="icon" variant="ghost" className="size-8 shrink-0" aria-label={`Actions for ${row.name}`}>
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.includes('move') && <DropdownMenuItem onSelect={() => onAction(row, 'move')}>Move to another Product</DropdownMenuItem>}
        {actions.includes('delete') && <DropdownMenuItem onSelect={() => onAction(row, 'delete')}>{row.kind === 'product' ? 'Delete product' : 'Delete'}</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Dash({ why }: { why?: string }) {
  return <span className="text-muted-foreground" title={why}>—</span>
}

/**
 * A Sell value of a row: the value; a dash when the row IS sold but has no value (a real gap); "Not shown" when the caller may not view this type's Sell section;
 * and nothing at all when the row has no Sell side (its "Not sold" chip already says why), so a Sub-product that is not sold is not a row of four dashes.
 */
function SellValue({ row, value }: { row: PortfolioRow; value: ReactNode }) {
  if (!sellKeysPresent(row)) return row.hasSell ? <span className="text-muted-foreground" title="You may not view the price details of this type.">Not shown</span> : null
  if (value !== null) return <>{value}</>
  return row.hasSell ? <Dash /> : null
}

/** A Product's total (S16): the first currency's price with its tax, and "+1 more" when the Sub-products are priced in other currencies too (the sentence names them for a screen reader). */
function ProductTotal({ row }: { row: PortfolioRow }) {
  const total = productTotal(row)
  if (total === null) return null
  const { first, more } = total

  return (
    <span className="flex flex-wrap items-center gap-x-1.5 text-sm">
      <span className="text-muted-foreground">Total</span>
      <Money amount={first.total} code={first.currency} className="font-medium text-foreground" />
      {more.length > 0 && <span className="text-muted-foreground">+{more.length} more<span className="sr-only">: {more.map((t) => formatMoney(t.total, t.currency)).join(', ')}</span></span>}
    </span>
  )
}

function GroupRow({ group, columns, canAdd, onAdd, can, onAction }: { group: GroupHeader; columns: number; canAdd: boolean; onAdd: (productId: number) => void; can: PortfolioCan; onAction: RowActionHandler }) {
  const product = group.row
  return (
    <TableRow className={GROUP_ROW} data-group={group.key}>
      <TableCell colSpan={columns}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {product ? (
            <>
              <Link href={rowHref(product)} className="text-base font-semibold text-foreground hover:underline">{product.name}</Link>
              <ProductChip />
              {product.shared && <SharedChip />}
              {product.status === 'archived' && <ArchivedChip />}
              {/* what the section holds, and its one action, on the right: the name and its labels stay together on the left */}
              <span className="ml-auto flex flex-wrap items-center gap-3">
                {can.viewSell && <ProductTotal row={product} />}
                <span className="text-sm text-muted-foreground">{product.subProductCount ?? 0} {product.subProductCount === 1 ? 'sub-product' : 'sub-products'}</span>
                {canAdd && !product.shared && product.status === 'active' && (
                  <Button type="button" size="sm" variant="outline" onClick={() => onAdd(product.id)} aria-label={`Add a sub-product to ${product.name}`}>
                    <Plus className="mr-1 size-3.5" aria-hidden="true" />Add sub-product
                  </Button>
                )}
                <RowMenu row={product} can={can} onAction={onAction} />
              </span>
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
export function PortfolioListTable({ items, can, sort, dir, onSort, selected, onToggle, onToggleAll, canAddSubProduct, onAddSubProduct, onRowAction, busy }: {
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
  /** A row's own menu: move it to another Product, or delete it. */
  onRowAction: RowActionHandler
  busy: boolean
}) {
  const sell = can.viewSell
  const rows = items.flatMap((i) => (i.kind === 'row' ? [i.row] : []))
  const tickable = rows.filter((r) => mayTickRow(r, can))
  const allTicked = tickable.length > 0 && tickable.every((r) => selected.has(r.id))
  const columns = 5 + (sell ? 5 : 0)

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
              return <GroupRow key={`g-${item.key}-${index}`} group={item} columns={columns} canAdd={canAddSubProduct} onAdd={onAddSubProduct} can={can} onAction={onRowAction} />
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
                <TableCell className="min-w-[14rem] pl-4">
                  {/* a Sub-product sits under its Product: an elbow line from the section above to the name says so, and a Service is the one kind that is labelled */}
                  <div className="flex items-center gap-2">
                    <span aria-hidden="true" className="ml-3 inline-block h-5 w-4 shrink-0 -translate-y-1.5 rounded-bl-md border-b-2 border-l-2 border-border" />
                    <Link href={rowHref(row)} className="min-w-0 font-medium text-foreground hover:underline">{row.name}</Link>
                    {row.type === 'service' && <ServiceChip />}
                    {row.status === 'archived' && <ArchivedChip />}
                    {row.shared && <SharedChip />}
                    <span className="ml-auto"><RowMenu row={row} can={can} onAction={onRowAction} /></span>
                  </div>
                </TableCell>
                {sell && <TableCell className="font-mono text-xs"><SellValue row={row} value={row.sku ?? null} /></TableCell>}
                {sell && <TableCell><SellValue row={row} value={row.unitPrice === null || row.unitPrice === undefined ? null : <Money amount={row.unitPrice} code={row.currency} />} /></TableCell>}
                {sell && <TableCell className="hidden lg:table-cell"><SellValue row={row} value={row.category ?? null} /></TableCell>}
                {sell && <TableCell className="hidden text-right lg:table-cell"><SellValue row={row} value={formatQuantity(row.qtyInStock)} /></TableCell>}
                {sell && <TableCell>{row.state ? <StateChip state={row.state} /> : <Dash />}</TableCell>}
                <TableCell><ReadinessChip readiness={row.readiness} /></TableCell>
                <TableCell className="text-right tabular-nums">{row.signalsFound === null ? <Dash /> : <span className={row.signalsFound === 0 ? 'text-muted-foreground' : 'font-medium text-foreground'}>{row.signalsFound}</span>}</TableCell>
                <TableCell><IcpChip state={row.icp} /></TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
