/*
 * The currency catalogue (S16 contract section 2): the same twelve currencies as hp_erp `config/currencies.php`, in the same order, with the same fields.
 * A value that is not in the list is LEGACY (free text typed before the list existed): it stays readable and is shown as typed with a neutral badge, and
 * it is never "fixed" silently. No exchange rate, no HSN/GST split: neither exists anywhere yet.
 */

export interface Currency {
  /** The three-letter code, upper case: what is stored. */
  code: string
  name: string
  /** What is drawn in the round badge and before an amount. */
  symbol: string
  /** Digits after the point (JPY has none). */
  decimals: number
  /** The country's two-letter code. */
  country: string
}

export const CURRENCIES: readonly Currency[] = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2, country: 'IN' },
  { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2, country: 'US' },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2, country: 'EU' },
  { code: 'GBP', name: 'Pound Sterling', symbol: '£', decimals: 2, country: 'GB' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', decimals: 2, country: 'AE' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimals: 2, country: 'SG' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2, country: 'AU' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimals: 2, country: 'CA' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimals: 0, country: 'JP' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimals: 2, country: 'CH' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', decimals: 2, country: 'SA' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', decimals: 2, country: 'ZA' },
]

/** The currency every organisation falls back to (the stored `org.currency` setting defaults to it too). */
export const FALLBACK_CURRENCY = 'INR'

/** The catalogue entry for a code (any case, spaces ignored), or null for an empty value and for a legacy one. */
export function currencyOf(code: string | null | undefined): Currency | null {
  if (typeof code !== 'string') return null
  const wanted = code.trim().toUpperCase()
  if (wanted === '') return null

  return CURRENCIES.find((c) => c.code === wanted) ?? null
}

/** The code a new Sub-product starts with: the organisation's own default when it is in the list, else the Indian rupee. */
export function defaultCurrencyCode(meta: { defaultCurrency?: string | null } | null | undefined): string {
  return currencyOf(meta?.defaultCurrency)?.code ?? FALLBACK_CURRENCY
}

/** The digits an amount in this code carries: the catalogue's own, 2 for a legacy or an empty code. */
export const decimalsOf = (code: string | null | undefined): number => currencyOf(code)?.decimals ?? 2
