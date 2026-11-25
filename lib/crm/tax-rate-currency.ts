import { CURRENCIES, currencyOf } from '@/lib/money/currencies'

/**
 * The currency choice of a tax rate (S16, 25 Nov 2026): a rate is tied to ONE currency from the catalogue (India: GST in INR) or to none ("Any currency", stored as null,
 * and it fits a Sub-product in every currency). A select cannot hold null, so "Any currency" travels as a sentinel and is turned back into null before anything is sent.
 * A stored code that is not in the catalogue is kept as one more choice, as typed and marked, so showing a rate never rewrites it.
 */

/** The select's value for "Any currency". */
export const ANY_CURRENCY = 'any'

export interface CurrencyChoice {
  label: string
  value: string
}

/** "Any currency", then the catalogue (symbol, code and name), with a legacy stored code in between when there is one. */
export function currencyChoices(stored: string | null | undefined): CurrencyChoice[] {
  const typed = typeof stored === 'string' ? stored.trim() : ''
  const legacy: CurrencyChoice[] = typed !== '' && !currencyOf(typed) ? [{ label: `${typed} (not in the list)`, value: typed }] : []

  return [{ label: 'Any currency', value: ANY_CURRENCY }, ...legacy, ...CURRENCIES.map((c) => ({ label: `${c.symbol} ${c.code} - ${c.name}`, value: c.code }))]
}

/** What the select holds for a stored value: the catalogue's own code (upper case), a legacy code as typed, or "Any currency" for none. */
export function currencyValue(stored: string | null | undefined): string {
  const typed = typeof stored === 'string' ? stored.trim() : ''
  if (typed === '') return ANY_CURRENCY

  return currencyOf(typed)?.code ?? typed
}

/** What is sent for a chosen value: null for "Any currency", otherwise the code. */
export function currencyPayload(chosen: string): string | null {
  return chosen === ANY_CURRENCY ? null : chosen
}
