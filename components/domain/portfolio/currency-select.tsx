'use client'

import { NativeSelect, type FieldControlProps } from '@/components/shared/scaffolds'
import { CURRENCIES, currencyOf } from '@/lib/money/currencies'
import { CurrencyBadge } from './currency-badge'

/**
 * The currency choice of a Sub-product: a LABELLED native select (put it inside a `Field`, which wires the label, the hint and the error), with the round
 * symbol badge of the chosen currency beside it. A native control is the accessible, scroll-safe choice inside a drawer, and an option can only hold text, so each
 * option spells the symbol, the code and the name ("₹ INR - Indian Rupee"). No flag pictures: Windows draws no emoji flags.
 *
 * A stored value that is not in the catalogue (legacy text) is kept as one more option, as typed and marked, so opening and saving a Sub-product never
 * rewrites it. An empty value (a Sub-product saved before the list existed) is offered as "Default (INR)", the currency the server counts it under.
 */
export function CurrencySelect({ value, onChange, disabled, fallbackCode, ...control }: Partial<FieldControlProps> & {
  value: string
  onChange: (code: string) => void
  disabled?: boolean
  /** The currency an empty value stands for (the organisation's default). With it, an empty value is a choice of its own. */
  fallbackCode?: string
}) {
  const typed = value.trim()
  const known = currencyOf(typed)
  const shown = known?.code ?? (typed !== '' ? typed : (fallbackCode ?? ''))

  return (
    <div className="relative min-w-0">
      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2"><CurrencyBadge code={shown} /></span>
      <NativeSelect {...control} className="pl-11" value={known ? known.code : typed} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {typed === '' && <option value="">{fallbackCode ? `Default (${fallbackCode})` : 'Choose a currency'}</option>}
        {typed !== '' && !known && <option value={typed}>{`${typed} (not in the list)`}</option>}
        {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{`${c.symbol} ${c.code} - ${c.name}`}</option>)}
      </NativeSelect>
    </div>
  )
}
