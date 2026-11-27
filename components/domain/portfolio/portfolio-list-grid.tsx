'use client'

import { useId } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { NativeSelect } from '@/components/shared/scaffolds/form-field'
import { cn } from '@/lib/utils'
import { cardRows, gridSortChoices, pageHasTickable, type GridCard } from '@/lib/portfolio-list/grid'
import { mayTickRow } from '@/lib/portfolio-list/model'
import type { PortfolioCan } from '@/services/product-master/portfolio-list-types'
import { PortfolioCard } from './portfolio-list-card'
import type { RowActionHandler } from './portfolio-list-table'

/*
 * The grid (cards) of the Product Portfolio: the same page the table draws, as one card for each Product with its Sub-products inside it. It takes the cards the pure model
 * made (lib/portfolio-list/grid.ts) and the ticks, the menus and the bulk bar of the screen around it, so the two layouts do the same things to the same rows.
 *
 * The columns come from the width of the grid's own box, not of the window (a container query), so it fits the Market Signals tab with its sidebar the same as a
 * full-width page: one column on a phone, two, three and four as the box widens.
 */
// `items-start`: a card is as tall as what it holds. Stretching every card to the tallest one of its row left a Product with no sub-products as a tall box with a gap in the middle.
const COLUMNS = 'grid grid-cols-1 items-start gap-4 @2xl:grid-cols-2 @4xl:grid-cols-3 @7xl:grid-cols-4'

export function PortfolioListGrid({ cards, can, selected, onToggle, onToggleAll, onAddSubProduct, onRowAction, busy, sortNote }: {
  cards: GridCard[]
  can: PortfolioCan
  selected: ReadonlySet<number>
  onToggle: (id: number) => void
  onToggleAll: (checked: boolean) => void
  onAddSubProduct: (productId: number) => void
  /** A card's own menus: move a Sub-product to another Product, or delete it (or the Product). */
  onRowAction: RowActionHandler
  busy: boolean
  /** The sentence about what the sort moved, when the order is not by name. */
  sortNote: string | null
}) {
  const selectable = pageHasTickable(cards)
  const tickable = cardRows(cards).filter((row) => mayTickRow(row, can))
  const allTicked = tickable.length > 0 && tickable.every((row) => selected.has(row.id))

  return (
    <div className="space-y-3" aria-busy={busy}>
      {(selectable || sortNote) && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
          {selectable
            ? (
              <label className="inline-flex items-center gap-2 text-foreground" title="Selects every sub-product on this page that can be changed">
                <input type="checkbox" checked={allTicked} onChange={(event) => onToggleAll(event.target.checked)} className="size-4" />
                Select all on this page
              </label>
            )
            : <span />}
          {sortNote && <p className="text-muted-foreground">{sortNote}</p>}
        </div>
      )}
      <div className="@container">
        <ul aria-label="Products and their sub-products" className={cn(COLUMNS, busy && 'opacity-60')}>
          {cards.map((card, index) => (
            <PortfolioCard
              key={`${card.key}-${index}`}
              card={card}
              can={can}
              selectable={selectable}
              selected={selected}
              onToggle={onToggle}
              onAddSubProduct={onAddSubProduct}
              onRowAction={onRowAction}
            />
          ))}
        </ul>
      </div>
    </div>
  )
}

/** The shape of the grid while the page loads, so the page does not jump when the real cards arrive. Told to a screen reader as one "Loading…". */
export function PortfolioGridSkeleton() {
  return (
    <div role="status" className="@container">
      <span className="sr-only">Loading…</span>
      <ul aria-hidden="true" className={COLUMNS}>
        {Array.from({ length: 6 }, (_, index) => (
          <li key={index} className="min-w-0">
            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
              <Skeleton className="h-5 w-2/3 motion-reduce:animate-none" />
              <Skeleton className="h-4 w-1/3 motion-reduce:animate-none" />
              <Skeleton className="h-24 w-full motion-reduce:animate-none" />
              <Skeleton className="h-8 w-1/2 motion-reduce:animate-none" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The grid's Sort, drawn like the filters beside it. The table sorts by its column headings; the grid has none, so it gets this. */
export function GridSortSelect({ value, canViewSell, onChange }: { value: string; canViewSell: boolean; onChange: (value: string) => void }) {
  const id = useId()
  return (
    <div className="flex min-w-[9rem] max-w-[14rem] flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">Sort by</label>
      <NativeSelect id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {gridSortChoices(canViewSell).map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
      </NativeSelect>
    </div>
  )
}
