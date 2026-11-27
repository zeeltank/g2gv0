'use client'

import { useId } from 'react'
import Link from 'next/link'
import { CircleCheck, CircleDot, CircleMinus, Clock, Plus, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { rowActions } from '@/lib/portfolio-list/model'
import type { CardChip, GridCard, GridSubRow } from '@/lib/portfolio-list/grid'
import { chipClass } from '@/lib/portfolio-list/tones'
import type { PortfolioCan } from '@/services/product-master/portfolio-list-types'
import { Money } from './currency-badge'
import { ProductTotal, RowMenu, type RowActionHandler } from './portfolio-list-table'

/*
 * One card of the grid. A Product's card HOLDS its Sub-products: the Product's own facts sit above, and the Sub-products sit in a tray that fills the foot of the card,
 * so a card with five Sub-products and a card with none do not look alike. The whole card is ONE link to the Product (a stretched, empty link laid over it: one tab stop,
 * with a real name), and everything a person can do inside it (tick a Sub-product, open a Sub-product, a row's menu, Add sub-product) sits above that link, because a link
 * never contains a button.
 */

/** The small icon next to a chip's word, by tone, so a status is never told by colour alone. A neutral chip (Service, Shared) has none. */
const TONE_ICON: Record<CardChip['tone'], LucideIcon | null> = {
  success: CircleCheck,
  primary: CircleDot,
  pending: Clock,
  inactive: CircleMinus,
  default: null,
}

function ChipView({ chip }: { chip: CardChip }) {
  const Icon = TONE_ICON[chip.tone]
  return (
    // A chip of the table never wraps; on a card a long readiness word must fit the card's width, so it may take a second line instead of running out of the box.
    <span className={cn(chipClass(chip.tone), 'max-w-full whitespace-normal rounded-xl text-left')} title={chip.hint}>
      {Icon && <Icon className="size-3 shrink-0" aria-hidden="true" />}
      {chip.label}
    </span>
  )
}

function SubProductRow({ sub, can, selectable, ticked, onToggle, onRowAction }: {
  sub: GridSubRow
  can: PortfolioCan
  selectable: boolean
  ticked: boolean
  onToggle: (id: number) => void
  onRowAction: RowActionHandler
}) {
  const row = sub.row
  const hasMenu = rowActions(row, can).length > 0
  return (
    <li data-row={row.id} className="flex items-start gap-2 py-2">
      {selectable && (
        <input
          type="checkbox"
          aria-label={`Select ${row.name}`}
          title={sub.whyNoTick ?? undefined}
          checked={ticked}
          disabled={!sub.tickable}
          onChange={() => onToggle(row.id)}
          className="relative z-20 mt-1 size-4 shrink-0"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-1">
          <Link href={sub.href} className="relative z-20 min-w-0 break-words font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{row.name}</Link>
          {hasMenu && <span className="relative z-20 -mr-2 -mt-1 shrink-0"><RowMenu row={row} can={can} onAction={onRowAction} /></span>}
        </div>
        {(sub.chips.length > 0 || sub.price || sub.priceHidden) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            {sub.chips.length > 0 && <span className="flex flex-wrap items-center gap-1.5">{sub.chips.map((chip) => <ChipView key={chip.kind} chip={chip} />)}</span>}
            {sub.price && <Money amount={sub.price.amount} code={sub.price.currency} className="text-sm font-medium text-foreground" />}
            {sub.priceHidden && <span className="text-xs text-muted-foreground" title="You may not view the price details of this type.">Price not shown</span>}
          </div>
        )}
      </div>
    </li>
  )
}

export function PortfolioCard({ card, can, selectable, selected, onToggle, onAddSubProduct, onRowAction }: {
  card: GridCard
  can: PortfolioCan
  /** Tick boxes are drawn on the Sub-product rows only when something on the page can be ticked. */
  selectable: boolean
  selected: ReadonlySet<number>
  onToggle: (id: number) => void
  onAddSubProduct: (productId: number) => void
  onRowAction: RowActionHandler
}) {
  const titleId = useId()
  const product = card.product
  const hasProductMenu = product !== null && rowActions(product, can).length > 0
  const hasFooter = card.countText !== null || (card.canAddSubProduct && product !== null)

  return (
    <li className="min-w-0" data-card={card.key}>
      <article
        aria-labelledby={titleId}
        className={cn(
          'relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card',
          // A Product with its own row carries the accent of the list's Product band on its left edge; the strays are drawn dashed, as a place that is not a Product.
          product ? 'border-l-4 border-l-primary hover:border-y-foreground hover:border-r-foreground' : 'hover:border-foreground',
          card.kind === 'no-product' && 'border-dashed',
        )}
      >
        {card.href !== null && (
          <Link href={card.href} aria-label={card.openLabel ?? undefined} className="absolute inset-0 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" />
        )}

        <div className="flex items-start justify-between gap-2 px-4 pt-4">
          <div className="min-w-0">
            <h2 id={titleId} className="break-words text-base font-semibold leading-snug text-foreground">{card.title}</h2>
            {card.note && <p className="mt-0.5 text-xs text-muted-foreground">{card.note}</p>}
          </div>
          {hasProductMenu && product && <span className="relative z-20 -mr-2 -mt-1 shrink-0"><RowMenu row={product} can={can} onAction={onRowAction} /></span>}
        </div>

        {card.chips.length > 0 && <div className="flex flex-wrap items-center gap-1.5 px-4 pt-2">{card.chips.map((chip) => <ChipView key={chip.kind} chip={chip} />)}</div>}
        {card.signals && <p className="px-4 pt-2 text-sm text-muted-foreground">{card.signals}</p>}
        {card.total && product && <div className="px-4 pt-1"><ProductTotal row={product} /></div>}

        <div className="mt-auto pt-4">
          {(card.subs.length > 0 || hasFooter) && (
            <div className="border-t border-border bg-muted px-4 py-3">
              {card.subs.length > 0 && (
                <>
                  <ul aria-label={`Sub-products of ${card.title}`} className="divide-y divide-border">
                    {card.shown.map((sub) => (
                      <SubProductRow key={sub.row.id} sub={sub} can={can} selectable={selectable} ticked={selected.has(sub.row.id)} onToggle={onToggle} onRowAction={onRowAction} />
                    ))}
                  </ul>
                  {card.more > 0 && <p className="border-t border-border pt-2 text-sm font-medium text-foreground">+{card.more} more</p>}
                </>
              )}
              {hasFooter && (
                <div className={cn('flex flex-wrap items-center justify-between gap-2', card.subs.length > 0 && 'pt-3')}>
                  {card.countText && <p className="text-sm text-muted-foreground">{card.countText}</p>}
                  {card.canAddSubProduct && product && (
                    <Button type="button" size="sm" variant="outline" className="relative z-20" onClick={() => onAddSubProduct(product.id)} aria-label={`Add a sub-product to ${product.name}`}>
                      <Plus className="mr-1 size-3.5" aria-hidden="true" />Add sub-product
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </article>
    </li>
  )
}
