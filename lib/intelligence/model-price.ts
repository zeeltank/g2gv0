/**
 * Model prices as people enter and read them, against what the API stores.
 *
 * Vendors publish a price per MILLION tokens ("$0.30 in, $1.20 out"); the API keeps it per 1,000 tokens (`ai_models.input_cost_per_1k`, a DECIMAL(12,6)).
 * The two differ by a factor of 1,000, so converting is moving the decimal point three places. That is done on the digits, not with `* 1000`, because
 * floating point gets it wrong in the last place (0.0001152 * 1000000 is 115.19999999999999) and a price shown as 115.19999999999999 is a price
 * nobody typed.
 *
 * A blank price is unknown, never zero: the server cannot work out a run's cost from half a rate card, so a rate that is blank stays null all the way.
 */

/** The currencies the model manager offers. The server's `config('ai.currencies')` is the authority; a row that comes back with another code is kept as it is. */
export const PRICE_CURRENCIES = ['INR', 'USD'] as const

/** Rupees, as the owner decided: a new price is in INR until someone says otherwise. */
export const DEFAULT_PRICE_CURRENCY = 'INR'

/** What an older server's rows mean: before currencies existed the screen said "(USD)", so a rate with no currency is a dollar rate. */
export const LEGACY_PRICE_CURRENCY = 'USD'

const SYMBOLS: Record<string, string> = { INR: '₹', USD: '$' }

/** The symbol for a currency; an unknown code is its own label, so a price is never shown with the wrong symbol. */
export function currencySymbol(currency: string): string {
  return SYMBOLS[currency] ?? currency
}

/** A currency code as stored: trimmed and upper-case, or null when there is none. */
export function normaliseCurrency(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const code = value.trim().toUpperCase()
  return code === '' ? null : code
}

/** The currency of a catalogue row, for a server that may not send one yet. */
export function rowCurrency(row: { currency?: string | null }): string {
  return normaliseCurrency(row.currency) ?? LEGACY_PRICE_CURRENCY
}

/** The decimal places the stored rate keeps, per 1,000 tokens. */
const MAX_PER_1K_DECIMALS = 6

/** DECIMAL(12,6): six digits before the point. */
const MAX_PER_1K_INTEGER_DIGITS = 6

/** Per million, that is this many decimal places: three fewer, because the point moves three places. */
export const MAX_PER_MILLION_DECIMALS = MAX_PER_1K_DECIMALS - 3

const PLAIN_DECIMAL = /^(\d*)(?:\.(\d*))?$/

/** A decimal split into its digits, with the zeros that do not change the value removed. Null when the text is not a plain non-negative decimal. */
function splitDecimal(text: string): { whole: string; fraction: string } | null {
  const match = PLAIN_DECIMAL.exec(text)
  if (!match) return null
  const whole = match[1] ?? ''
  const fraction = match[2] ?? ''
  if (whole === '' && fraction === '') return null
  return { whole: whole.replace(/^0+(?=\d)/, '') || '0', fraction: fraction.replace(/0+$/, '') }
}

function joinDecimal(whole: string, fraction: string): string {
  const cleanWhole = whole.replace(/^0+(?=\d)/, '') || '0'
  const cleanFraction = fraction.replace(/0+$/, '')
  return cleanFraction === '' ? cleanWhole : `${cleanWhole}.${cleanFraction}`
}

/** One price as typed. Either `per1k` (what the API takes: null when blank) or `error` (what to tell the person). */
export type PriceParse = { per1k: string | null; error?: undefined } | { per1k?: undefined; error: string }

/**
 * Per million tokens (typed) to per 1,000 tokens (sent), as an exact decimal string. Blank is null: unknown.
 * At most three decimals are accepted per million, which is the six the stored rate holds per 1,000.
 */
export function perMillionToPer1k(text: string): PriceParse {
  const typed = text.trim()
  if (typed === '') return { per1k: null }
  if (typed.startsWith('-')) return { error: 'A price cannot be negative.' }

  const parts = splitDecimal(typed)
  if (!parts) return { error: 'Enter a number such as 28.80, with digits and a decimal point only.' }
  if (parts.fraction.length > MAX_PER_MILLION_DECIMALS) {
    return { error: `Use at most ${MAX_PER_MILLION_DECIMALS} decimal places: the stored rate keeps ${MAX_PER_1K_DECIMALS} per 1,000 tokens.` }
  }

  // Four digits at least, so the last three can always be taken off the end.
  const padded = parts.whole.padStart(4, '0')
  const head = padded.slice(0, -3)
  if (head.replace(/^0+/, '').length > MAX_PER_1K_INTEGER_DIGITS) return { error: 'That price is too large.' }

  return { per1k: joinDecimal(head, padded.slice(-3) + parts.fraction) }
}

/**
 * A stored per-1,000 rate (a number, or a DECIMAL sent as text) back to the per-million text the person would type. Null, blank or unreadable is blank:
 * the form shows an empty box rather than a made-up price.
 */
export function per1kToPerMillion(value: number | string | null | undefined): string {
  let text: string
  if (typeof value === 'number') {
    // The column keeps six decimals, so six is exact; toFixed also spares us the exponent form String() gives a tiny number.
    if (!Number.isFinite(value) || value < 0) return ''
    text = value.toFixed(MAX_PER_1K_DECIMALS)
  } else if (typeof value === 'string') {
    text = value.trim()
  } else {
    return ''
  }

  const parts = splitDecimal(text)
  if (!parts) return ''
  const fraction = parts.fraction.padEnd(3, '0')
  return joinDecimal(parts.whole + fraction.slice(0, 3), fraction.slice(3))
}

/** The two prices of a form, checked together. `errors` is keyed by the API's field names so it merges with a server's field errors. */
export interface PriceCheck {
  input: string | null
  output: string | null
  errors: Partial<Record<'input_cost_per_1k' | 'output_cost_per_1k', string[]>>
}

const NEEDS_BOTH = 'Enter the other price too, or leave both blank: a run\'s cost needs the input and the output price.'

/** Each price on its own, and then both or neither: with one missing the server could not price a call, so the cost would stay unknown anyway. */
export function checkPrices(inputText: string, outputText: string): PriceCheck {
  const input = perMillionToPer1k(inputText)
  const output = perMillionToPer1k(outputText)
  const errors: PriceCheck['errors'] = {}

  if (input.error) errors.input_cost_per_1k = [input.error]
  if (output.error) errors.output_cost_per_1k = [output.error]

  if (!input.error && !output.error) {
    if (input.per1k === null && output.per1k !== null) errors.input_cost_per_1k = [NEEDS_BOTH]
    if (output.per1k === null && input.per1k !== null) errors.output_cost_per_1k = [NEEDS_BOTH]
  }

  return { input: input.per1k ?? null, output: output.per1k ?? null, errors }
}

/** What goes in the request: the exact decimal as a number, or null. The nearest double to a six-decimal value prints back as the same six decimals. */
export function toRequestNumber(per1k: string | null): number | null {
  return per1k === null ? null : Number(per1k)
}

/** A per-million amount for the table: the symbol, then at least two decimals ("₹28.80"), with every typed decimal kept ("₹28.125"). */
export function formatPerMillion(perMillion: string, currency: string): string {
  if (perMillion === '') return ''
  const [whole, fraction = ''] = perMillion.split('.')
  const symbol = currencySymbol(currency)
  return `${symbol.length > 1 ? `${symbol} ` : symbol}${whole}.${fraction.padEnd(2, '0')}`
}

/** Both rates of a row, per million, in its own currency: "₹28.80 / ₹115.20". Null when the row does not have both, because a half rate prices nothing. */
export function describeRates(
  row: { input_cost_per_1k: number | string | null; output_cost_per_1k: number | string | null; currency?: string | null },
): string | null {
  const input = per1kToPerMillion(row.input_cost_per_1k)
  const output = per1kToPerMillion(row.output_cost_per_1k)
  if (input === '' || output === '') return null
  const currency = rowCurrency(row)
  return `${formatPerMillion(input, currency)} / ${formatPerMillion(output, currency)}`
}
