'use client'

import { currencyOf } from '@/lib/money/currencies'
import { formatAmount } from '@/lib/money/format'
import { cn } from '@/lib/utils'

/*
 * The currency's icon: a round badge that holds its symbol (₹, $, €), drawn from text, so it needs no picture, no package and no emoji flag (Windows draws
 * none). The look is the Portfolio's own: foreground text on a solid theme surface with a plain border, so contrast holds in the light and the dark theme.
 * A code that is not in the catalogue (a legacy value typed before the list existed) gets a NEUTRAL badge (a dashed border and the generic currency sign),
 * and its code is shown as typed: it is never turned into a symbol it does not have.
 */

const ROUND = 'inline-flex shrink-0 justify-center rounded-full border bg-muted font-semibold leading-none text-foreground'
const KNOWN = 'border-border'
const NEUTRAL = 'border-dashed border-border bg-card text-muted-foreground'

/** The sentence a screen reader gets for the badge. */
export function currencyLabel(code: string | null | undefined): string {
  const typed = typeof code === 'string' ? code.trim() : ''
  const currency = currencyOf(typed)

  return currency ? `${currency.name} (${currency.code})` : `${typed} (not in the list)`
}

/**
 * The round symbol badge. On its own it is an image with a name ("Indian Rupee (INR)"); with `showCode` and `showName` the words are drawn beside it and
 * the badge is hidden from a screen reader, so the name is never read twice. Nothing is drawn for an empty code.
 */
export function CurrencyBadge({ code, showCode = false, showName = false, className }: {
  code: string | null | undefined
  showCode?: boolean
  showName?: boolean
  className?: string
}) {
  const typed = typeof code === 'string' ? code.trim() : ''
  if (typed === '') return null
  const currency = currencyOf(typed)
  const symbol = currency ? currency.symbol : '¤'
  // A symbol of one or two characters sits in a circle; a longer one (CHF, د.إ) stretches the circle into a pill.
  const look = cn(ROUND, 'items-center', currency ? KNOWN : NEUTRAL, symbol.length > 2 ? 'h-6 px-1.5 text-[0.65rem]' : 'size-6 text-xs')
  const named = showCode || showName
  const badge = named
    ? <span aria-hidden="true" className={look}>{symbol}</span>
    : <span role="img" aria-label={currencyLabel(typed)} className={cn(look, className)}>{symbol}</span>
  if (!named) return badge

  return (
    <span className={cn('inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm', className)}>
      {badge}
      {showCode && <span className="font-medium text-foreground">{currency ? currency.code : typed}</span>}
      {showName && <span className="text-muted-foreground">{currency ? currency.name : 'not in the list'}</span>}
    </span>
  )
}

/** An amount as a person reads it in a table or a card: the badge, then the number with the currency's own digits and grouping. Nothing for no amount. */
export function Money({ amount, code, className }: { amount: number | null | undefined; code: string | null | undefined; className?: string }) {
  const text = formatAmount(amount, code)
  if (text === null) return null

  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums', className)}>
      <CurrencyBadge code={code} />
      <span>{text}</span>
    </span>
  )
}
