import { decimalsOf } from '@/lib/money/currencies'

/**
 * The SUGGESTED VALUE of an opportunity (S16, 25 Nov 2026; hp_erp contract section 6): under the Sub-products of interest, a read-only figure that says what they would come to
 * at their own prices. quantity x price for each Sub-product, added up, IN THE OPPORTUNITY'S CURRENCY: there is no exchange rate anywhere, so a row in another currency is
 * never converted and never guessed at. It is not added; it is LISTED as not added, with the reason, so the figure is never quietly short.
 *
 *   - a row with no price yet ............ not added ("no price yet")
 *   - a row whose price has no currency .. not added ("no currency"): the server counts such a row under its default currency, but this page does not know it, and a figure
 *                                           that guesses is worse than one that says so
 *   - a row priced in another currency ... not added ("priced in USD")
 *   - an opportunity with no currency .... nothing can be added: the page says to set one
 *   - an answer that carries no price at all (a viewer who may not see prices) ... nothing is drawn
 *
 * The figure is a SUGGESTION. Nothing here writes: the opportunity's Amount is the person's to type, and this module has no way to send anything.
 */

/** The part of an opportunity's Sub-product row this reads. `unitPrice` ABSENT means the answer carries no prices for this viewer; NULL means "no price yet". */
export interface OpportunityPricedRow {
  id: string
  name: string
  quantity: number
  unitPrice?: number | null
  currency?: string | null
}

export type NotAddedReason = 'no-price' | 'no-currency' | 'other-currency'

export interface AddedRow {
  id: string
  name: string
  quantity: number
  unitPrice: number
  amount: number
}

export interface NotAddedRow {
  id: string
  name: string
  reason: NotAddedReason
  /** The row's own currency code as typed (upper case), for the "priced in USD" sentence; null when it has none. */
  currency: string | null
}

export interface SuggestedValue {
  /** `hidden`: nothing to say (no rows, or the answer carries no prices). `needs-currency`: the opportunity has no currency. `ready`: the figure and the lists are real. */
  state: 'hidden' | 'needs-currency' | 'ready'
  /** The opportunity's currency, trimmed and upper case; null when it has none. */
  currency: string | null
  /** The sum of the added rows, rounded to the currency's digits. 0 when nothing was added. */
  total: number
  added: AddedRow[]
  notAdded: NotAddedRow[]
}

const clean = (code: string | null | undefined): string | null => {
  const text = typeof code === 'string' ? code.trim().toUpperCase() : ''
  return text === '' ? null : text
}

/** quantity x price in whole minor units of the currency (cents): the float noise of 3 x 0.1 is cut off before it is rounded half up. */
function minorUnits(quantity: number, price: number, decimals: number): number {
  return Math.round(Number((quantity * price * 10 ** decimals).toPrecision(12)))
}

export function suggestedValue(opportunityCurrency: string | null | undefined, rows: readonly OpportunityPricedRow[]): SuggestedValue {
  const currency = clean(opportunityCurrency)
  const carriesPrices = rows.some((row) => row.unitPrice !== undefined)
  if (rows.length === 0 || !carriesPrices) return { state: 'hidden', currency, total: 0, added: [], notAdded: [] }
  if (currency === null) return { state: 'needs-currency', currency, total: 0, added: [], notAdded: [] }

  const decimals = decimalsOf(currency)
  const added: AddedRow[] = []
  const notAdded: NotAddedRow[] = []
  let totalMinor = 0
  for (const row of rows) {
    const own = clean(row.currency)
    if (typeof row.unitPrice !== 'number' || !Number.isFinite(row.unitPrice)) {
      notAdded.push({ id: row.id, name: row.name, reason: 'no-price', currency: own })
    } else if (own === null) {
      notAdded.push({ id: row.id, name: row.name, reason: 'no-currency', currency: null })
    } else if (own !== currency) {
      notAdded.push({ id: row.id, name: row.name, reason: 'other-currency', currency: own })
    } else {
      const minor = minorUnits(row.quantity, row.unitPrice, decimals)
      totalMinor += minor
      added.push({ id: row.id, name: row.name, quantity: row.quantity, unitPrice: row.unitPrice, amount: minor / 10 ** decimals })
    }
  }

  return { state: 'ready', currency, total: totalMinor / 10 ** decimals, added, notAdded }
}

/** Why a row was not added, in the words of the screen. */
export function notAddedSentence(row: NotAddedRow, opportunityCurrency: string): string {
  if (row.reason === 'no-price') return `${row.name}: no price yet.`
  if (row.reason === 'no-currency') return `${row.name}: its price has no currency.`

  return `${row.name}: priced in ${row.currency}, not ${opportunityCurrency}.`
}
