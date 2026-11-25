import { currencyOf } from './currencies'

/*
 * How an amount is written (S16 contract section 5): the currency's symbol, the currency's own digits, Indian grouping (1,20,000.00) for the rupee and
 * international grouping (120,000.00) for every other code. A code that is not in the catalogue is legacy text: it is written as typed ("Rs 1,234.00"),
 * never turned into a symbol. An amount with no code is just the number with two digits.
 */

const GROUPING: Record<string, Intl.NumberFormat> = {}

function numberFormat(locale: 'en-IN' | 'en-US', decimals: number): Intl.NumberFormat {
  const key = `${locale}:${decimals}`
  return (GROUPING[key] ??= new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }))
}

/** The symbols that sit against the number; every other symbol (CHF, R, a word) is followed by a space so the two never run together. */
const GLUED_SYMBOL = /[$€£¥₹]$/

const usable = (amount: number | null | undefined): amount is number => typeof amount === 'number' && Number.isFinite(amount)

/** The number alone, with the grouping and the digits of its currency: "1,20,000.00". Null for no amount. */
export function formatAmount(amount: number | null | undefined, code: string | null | undefined): string | null {
  if (!usable(amount)) return null
  const currency = currencyOf(code)
  const digits = currency ? currency.decimals : 2
  const text = numberFormat(currency?.code === 'INR' ? 'en-IN' : 'en-US', digits).format(Math.abs(amount))

  return amount < 0 && Number(text.replace(/[^\d]/g, '')) !== 0 ? `-${text}` : text
}

/** The symbol in front of an amount: "₹", "S$", "CHF " (with its space). Empty for no code; a legacy code as typed, with its space. */
export function moneyPrefix(code: string | null | undefined): string {
  if (typeof code !== 'string' || code.trim() === '') return ''
  const currency = currencyOf(code)
  if (!currency) return `${code.trim()} `

  return GLUED_SYMBOL.test(currency.symbol) ? currency.symbol : `${currency.symbol} `
}

/** An amount with its symbol: "₹1,20,000.00", "$1,234.50", "¥1,500", "CHF 1,500.00"; a legacy code as typed ("Rs 1,234.00"); null for no amount. */
export function formatMoney(amount: number | null | undefined, code: string | null | undefined): string | null {
  const text = formatAmount(amount, code)
  if (text === null) return null
  const sign = text.startsWith('-') ? '-' : ''

  return `${sign}${moneyPrefix(code)}${sign ? text.slice(1) : text}`
}
