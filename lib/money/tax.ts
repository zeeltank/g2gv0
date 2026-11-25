/*
 * The tax rule (S16 contract section 3), the same on both sides. Tax is EXCLUSIVE: the price is what the seller asks and the tax is added on top.
 * In integer minor units (paise, cents):
 *
 *   minor    = round_half_up(price * 10^decimals)
 *   pctMilli = round_half_up(percentage * 1000)
 *   taxMinor = floor((minor * pctMilli + 50000) / 100000)
 *   total    = minor + taxMinor
 *
 * hp_erp `App\Domain\Money\TaxCalculator::tax()` is the twin of this file and both are proven with the same twelve vectors (tax.test.ts). A missing or null
 * percentage means tax 0. An amount that cannot be read as a non-negative number has no answer (null): the screens say "No price yet" then.
 */

export interface PriceWithTax {
  /** The price, rounded to the currency's digits. */
  subtotal: number
  tax: number
  total: number
}

const DECIMAL = /^(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i

/** A decimal text as a count of 10^-scale units: digits and a scale, exactly (no binary fraction is involved). */
function parseDecimal(value: number | string): { digits: string; scale: number } | null {
  const text = (typeof value === 'number' ? (Number.isFinite(value) ? String(value) : '') : value).trim()
  const match = DECIMAL.exec(text.replace(/^\+/, ''))
  if (!match || (match[1] === '' && (match[2] ?? '') === '')) return null
  const whole = match[1]
  const fraction = match[2] ?? ''
  const exponent = match[3] ? Number(match[3]) : 0
  const scale = fraction.length - exponent
  const digits = `${whole}${fraction}`.replace(/^0+(?=\d)/, '')

  return { digits: digits === '' ? '0' : digits, scale }
}

/** round_half_up(value * 10^places) as an integer, from the decimal text. null: not a non-negative number. */
function toUnits(value: number | string | null | undefined, places: number): number | null {
  if (value === null || value === undefined) return null
  const parsed = parseDecimal(value)
  if (parsed === null) return null
  const { digits, scale } = parsed
  // digits * 10^-scale * 10^places = digits * 10^(places - scale)
  const shift = places - scale
  if (shift >= 0) {
    const out = Number(`${digits}${'0'.repeat(Math.min(shift, 30))}`)
    return Number.isSafeInteger(out) ? out : null
  }
  const cut = -shift
  if (cut > digits.length) return 0
  const kept = digits.slice(0, digits.length - cut) || '0'
  const next = digits.charAt(digits.length - cut)
  const out = Number(kept) + (next >= '5' ? 1 : 0)

  return Number.isSafeInteger(out) ? out : null
}

/** The tax in minor units: floor((minor * pctMilli + 50000) / 100000), done without ever forming a product that could lose a digit. */
function taxMinor(minor: number, pctMilli: number): number {
  const quotient = Math.floor(minor / 100000)
  const remainder = minor - quotient * 100000

  return quotient * pctMilli + Math.floor((remainder * pctMilli + 50000) / 100000)
}

/** The price, the tax on it and the total, for a rate and a currency with `decimals` digits. null when the price or the rate is not a non-negative number. */
export function priceWithTax(price: number | string | null | undefined, percentage: number | string | null | undefined, decimals: number): PriceWithTax | null {
  const places = Number.isInteger(decimals) && decimals >= 0 && decimals <= 6 ? decimals : 2
  const minor = toUnits(price, places)
  if (minor === null) return null
  const pctMilli = percentage === null || percentage === undefined || percentage === '' ? 0 : toUnits(percentage, 3)
  if (pctMilli === null) return null
  const tax = taxMinor(minor, pctMilli)
  const total = minor + tax
  if (!Number.isSafeInteger(total)) return null
  const unit = 10 ** places

  return { subtotal: minor / unit, tax: tax / unit, total: total / unit }
}
