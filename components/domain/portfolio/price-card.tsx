'use client'

import type { ReactNode } from 'react'
import { decimalsOf } from '@/lib/money/currencies'
import { formatAmount } from '@/lib/money/format'
import { priceWithTax } from '@/lib/money/tax'
import { cn } from '@/lib/utils'
import type { PmPriceTotal } from '@/services/product-master/record-types'
import { CurrencyBadge } from './currency-badge'

/*
 * The price of a Sub-product and the total of a Product, drawn the same way: "Price 1,000.00 + GST 18% 180.00 = Total 1,180.00" with the currency's badge.
 * Tax is exclusive (the price is what the seller asks, the tax is added on top) and every sum comes from lib/money/tax.ts, the twin of the server's
 * calculator, so the card on screen and the quote the server prices agree to the paisa. Words: Price, Tax, Total. Each figure is a labelled term (a
 * screen reader gets "Price, 1,000.00"); the + and = in front of the figures are drawn by the stylesheet.
 */

const BOX = 'rounded-lg border border-border bg-muted p-3'
const SIGN_PLUS = "before:mr-1.5 before:text-muted-foreground before:content-['+']"
const SIGN_EQUALS = "before:mr-1.5 before:text-muted-foreground before:content-['=']"

function Part({ label, value, sign, strong }: { label: string; value: string; sign?: 'plus' | 'equals'; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('tabular-nums text-foreground', strong ? 'text-base font-semibold' : 'text-sm font-medium', sign === 'plus' && SIGN_PLUS, sign === 'equals' && SIGN_EQUALS)}>{value}</dd>
    </div>
  )
}

/** The name a tax line carries: the rate's own name and its percentage ("GST 18%"), or just "Tax 18%". */
export function taxLabel(name: string | null | undefined, percent: number): string {
  const word = name && name.trim() !== '' ? name.trim() : 'Tax'
  const text = `${Number(percent)}%`

  return word.includes('%') ? word : `${word} ${text}`
}

const noPrice = (price: number | string | null | undefined): boolean => price === null || price === undefined || (typeof price === 'string' && price.trim() === '')

/**
 * The price card of one Sub-product. `price` is a number (a saved price) or the text in the form; an empty price says "No price yet", text that is not a number
 * says so, and no tax rate means no tax line (the card then shows the price alone). `children` sit under the figures (the form's note about a dropped rate).
 */
export function PriceCard({ price, currency, taxPercent, taxName, className, children }: {
  price: number | string | null | undefined
  currency: string | null | undefined
  taxPercent?: number | null
  taxName?: string | null
  className?: string
  children?: ReactNode
}) {
  const empty = noPrice(price)
  const rate = taxPercent === null || taxPercent === undefined ? null : taxPercent
  const sum = empty ? null : priceWithTax(price, rate, decimalsOf(currency))
  const digits = (n: number) => formatAmount(n, currency) ?? ''

  return (
    <section aria-label="Price with tax" className={cn(BOX, 'space-y-2', className)}>
      <CurrencyBadge code={currency} showCode showName />
      {empty
        ? <p className="text-sm text-muted-foreground">No price yet</p>
        : sum === null
          ? <p className="text-sm text-muted-foreground">Enter the price as a number to see the total.</p>
          : rate === null
            ? (
              <>
                <dl className="flex flex-wrap items-end gap-x-3 gap-y-2"><Part label="Price" value={digits(sum.subtotal)} strong /></dl>
                <p className="text-xs text-muted-foreground">No tax is added.</p>
              </>
            )
            : (
              <dl className="flex flex-wrap items-end gap-x-3 gap-y-2">
                <Part label="Price" value={digits(sum.subtotal)} />
                <Part label={taxLabel(taxName, rate)} value={digits(sum.tax)} sign="plus" />
                <Part label="Total" value={digits(sum.total)} sign="equals" strong />
              </dl>
            )}
      {children}
    </section>
  )
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/**
 * The total card of a Product: one block per currency ("Price 12,500.00 + Tax 2,250.00 = Total 14,750.00, from 5 of 7 Sub-products"), and one sentence for the
 * Sub-products that are not in it ("2 Sub-products have no price yet"). The server adds the figures (each Sub-product's tax by its own rate); this only draws
 * them. Nothing at all when the server sent no totals (a person who may not view prices gets none, and a Product with no priced Sub-product has none).
 */
export function PriceTotals({ totals, className }: { totals: readonly PmPriceTotal[] | null | undefined; className?: string }) {
  if (!totals || totals.length === 0) return null
  // `uncounted` is the Product's own count (the Sub-products that are not in any total), the same in every block.
  const uncounted = Math.max(0, ...totals.map((t) => t.uncounted))
  const everyone = totals.reduce((n, t) => n + t.counted, 0) + uncounted

  return (
    <section aria-label="Total of the Sub-products" className={cn(BOX, 'space-y-3', className)}>
      <ul className="space-y-3">
        {totals.map((t) => {
          const code = t.currency ?? ''
          const digits = (n: number) => formatAmount(n, code) ?? ''
          return (
            <li key={code || 'none'} className="space-y-2">
              <CurrencyBadge code={code} showCode showName />
              <dl className="flex flex-wrap items-end gap-x-3 gap-y-2">
                <Part label="Price" value={digits(t.subtotal)} />
                <Part label="Tax" value={digits(t.tax)} sign="plus" />
                <Part label="Total" value={digits(t.total)} sign="equals" strong />
              </dl>
              <p className="text-xs text-muted-foreground">from {t.counted} of {plural(everyone, 'Sub-product', 'Sub-products')}</p>
            </li>
          )
        })}
      </ul>
      {uncounted > 0 && <p role="status" className="text-sm text-foreground">{uncounted === 1 ? '1 Sub-product has no price yet' : `${uncounted} Sub-products have no price yet`}</p>}
    </section>
  )
}
