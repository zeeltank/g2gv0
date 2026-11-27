import type { CrmBulkActionResponse } from '@/types/crm'
import { formatMoney as formatMoneyText } from '@/lib/money/format'
import { mayMoveRow } from '@/lib/portfolio/removal-model'
import type { PmPriceTotal } from '@/services/product-master/record-types'
import type {
  MatchDecisionRow, MatchRow, MatchesData, PortfolioCan, PortfolioIcpState, PortfolioItemType, PortfolioRow, PortfolioSellState,
} from '@/services/product-master/portfolio-list-types'

/*
 * What the Product Portfolio list shows, as plain functions (slice 15, track P3-A): the groups of a page, the words of a state, which rows a person may tick,
 * what a bulk action sends, which suggestions need a decision. No React and no network, so every rule is tested without a browser.
 * Words on screen: Product and Sub-product (a Service is a Sub-product of type Service).
 */

// ---------------------------------------------------------------------------------------------------------------------------- the groups of a page

export interface GroupHeader {
  kind: 'group'
  /** Stable across pages: `p:<Product number>` or `none` for the Sub-products that have no Product yet. */
  key: string
  label: string
  /** The Product's own row, when this page holds it; null when the header is made from a Sub-product's Product name. */
  row: PortfolioRow | null
  /** The page begins inside this group: its Product row (or earlier Sub-products) was on the page before. */
  continued: boolean
  noProduct: boolean
}

export interface RowItem {
  kind: 'row'
  row: PortfolioRow
}

export type DisplayItem = GroupHeader | RowItem

const NO_PRODUCT_LABEL = 'No product yet'

function groupKeyOf(row: PortfolioRow): string {
  if (row.kind === 'product') return `p:${row.id}`
  if (row.needsProduct || row.productId === null) return 'none'
  return `p:${row.productId}`
}

/**
 * The rows of one page as the screen draws them: a header for each Product, then its Sub-products; the Sub-products with no Product go under "No product yet".
 * The server already orders a page in groups. A header is made for a group the page begins inside of (its Product row was on the page before) and for a
 * group whose Product row a filter left out (a search for a type or a sold state returns Sub-products only), so a Sub-product is never drawn without its Product.
 */
export function displayItems(rows: readonly PortfolioRow[], page: number): DisplayItem[] {
  const out: DisplayItem[] = []
  let current: string | null = null
  rows.forEach((row, index) => {
    const key = groupKeyOf(row)
    if (key !== current) {
      current = key
      const noProduct = key === 'none'
      out.push({
        kind: 'group',
        key,
        label: noProduct ? NO_PRODUCT_LABEL : row.kind === 'product' ? row.name : (row.productName ?? 'Product'),
        row: row.kind === 'product' ? row : null,
        continued: row.kind !== 'product' && page > 1 && index === 0 && !noProduct,
        noProduct,
      })
      if (row.kind === 'product') return
    } else if (row.kind === 'product') {
      // A Product row after a Sub-product of the same group cannot happen in the server's order; draw it as a row of its own rather than lose it.
      out.push({ kind: 'row', row })
      return
    }
    out.push({ kind: 'row', row })
  })
  return out
}

/** Where a row opens: a Product its own page (`/portfolio/{key}`), a Sub-product the page of the record (`/portfolio/products/{id}`). Shared by the table and the grid. */
export function rowHref(row: Pick<PortfolioRow, 'kind' | 'key' | 'id'>): string {
  return row.kind === 'product' ? `/portfolio/${encodeURIComponent(row.key)}` : `/portfolio/products/${row.id}`
}

// ---------------------------------------------------------------------------------------------------------------------------- words

/** The Sell state in words. A record in the Recycle Bin says so, because that is where a person goes to bring it back. */
export const STATE_WORD: Record<PortfolioSellState, string> = {
  sold: 'Sold',
  paused: 'Paused',
  not_sold: 'Not sold',
  binned: 'In the Recycle Bin',
}

export type StateTone = 'success' | 'pending' | 'inactive'

export function stateTone(state: PortfolioSellState): StateTone {
  return state === 'sold' ? 'success' : state === 'paused' ? 'pending' : 'inactive'
}

export function typeWord(row: Pick<PortfolioRow, 'kind' | 'type'>): string {
  if (row.kind === 'product') return 'Product'
  return row.type === 'service' ? 'Service' : 'Sub-product'
}

export const ICP_WORD: Record<PortfolioIcpState, string> = {
  active: 'In use',
  draft: 'Draft',
  archived: 'Archived',
  template: 'Built in',
  none: 'None yet',
}

export type ReadinessTone = 'success' | 'primary' | 'pending' | 'inactive' | 'default'

/** The colour a readiness word is drawn in: live and proven read as good, in progress as pending, concept and deferred as quiet. The word always carries the meaning. */
export function readinessTone(readiness: string | null | undefined): ReadinessTone {
  switch (readiness) {
    case 'Live – with client':
    case 'Proven on real client data (pilot)':
      return 'success'
    case 'Built – no production client':
      return 'primary'
    case 'In development':
    case 'Pilot planned':
    case 'Prototype':
      return 'pending'
    case 'Proposal / concept':
    case 'Deferred':
      return 'inactive'
    default:
      return 'default'
  }
}

export function icpTone(state: PortfolioIcpState): ReadinessTone {
  return state === 'active' ? 'success' : state === 'draft' ? 'pending' : state === 'template' ? 'primary' : state === 'archived' ? 'inactive' : 'default'
}

/** An amount with its currency's symbol ("₹1,20,000.00"); the one rule is `lib/money/format.ts`. */
export const formatMoney = (amount: number | null | undefined, currency: string | null | undefined): string | null => formatMoneyText(amount, currency)

export function formatQuantity(quantity: number | null | undefined): string | null {
  return quantity === null || quantity === undefined ? null : quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })
}

/**
 * What a Product row shows as its total (S16): the first currency's block, and the blocks after it (drawn as "+1 more"). Null for a row that is not a Product
 * and for one the server sent no total for (a caller who may not view prices, or a Product with nothing priced).
 */
export function productTotal(row: Pick<PortfolioRow, 'kind' | 'priceTotals'>): { first: PmPriceTotal; more: PmPriceTotal[] } | null {
  if (row.kind !== 'product') return null
  const [first, ...more] = row.priceTotals ?? []

  return first ? { first, more } : null
}

// ---------------------------------------------------------------------------------------------------------------------------- what the caller sees and may tick

/** The Sell keys of a row (SKU, category, stock, price, currency) are there only for a caller who may view the Sell section of that row's type. */
export function sellKeysPresent(row: PortfolioRow): boolean {
  return 'unitPrice' in row
}

/**
 * A row can be ticked for a bulk action when it has a live catalogue entry (sold or paused: one in the Recycle Bin is already deleted and one that is not
 * sold has nothing to delete or hand over), it is the organisation's own (a shared Product's Sub-products are read only), the caller may change Sub-products,
 * and the caller may see its Sell section (the person who may not is never offered a bulk action on what they cannot see).
 */
export function mayTick(row: PortfolioRow, can: Pick<PortfolioCan, 'editSubProduct'>): boolean {
  return row.kind !== 'product' && row.hasSell && (row.state === 'sold' || row.state === 'paused') && !row.shared && can.editSubProduct && sellKeysPresent(row)
}

/**
 * A row can be TICKED when a bulk action can work on it: the Sell actions (Reassign, Delete to the Recycle Bin) need a live entry in CRM (`mayTick`), and Move to
 * another Product needs only that it is a Sub-product or an item of this organisation that the caller may change (`mayMoveRow`), sold or not.
 */
export function mayTickRow(row: PortfolioRow, can: Pick<PortfolioCan, 'editSubProduct'>): boolean {
  return mayTick(row, can) || mayMoveRow(row, can)
}

/** Why a row has no tick, in a short sentence for the disabled box's name. Null when it can be ticked. */
export function whyNoTick(row: PortfolioRow, can: Pick<PortfolioCan, 'editSubProduct'>): string | null {
  if (mayTickRow(row, can)) return null
  if (row.kind === 'product') return 'A Product has no entry in CRM to change here'
  if (row.shared) return 'A shared record is read only'
  return 'You may not change it'
}

export type RowAction = 'move' | 'delete'

/**
 * What a row's own menu offers: a Sub-product or an item can be moved to another Product or deleted by a person who may change Sub-products; a Product can only be
 * deleted, and only by an administrator (the same gates as Archive). A shared record is read only and has no menu.
 */
export function rowActions(row: Pick<PortfolioRow, 'kind' | 'shared'>, can: Pick<PortfolioCan, 'editSubProduct' | 'createProduct'>): RowAction[] {
  if (row.shared) return []
  if (row.kind === 'product') return can.createProduct ? ['delete'] : []
  return can.editSubProduct ? ['move', 'delete'] : []
}

/**
 * Whether Reassign and Delete (to the Recycle Bin) work on everything that is ticked. They act on entries in CRM, so a ticked Sub-product that is not sold in CRM
 * (which can still be moved) makes them unavailable; the bar then says so, and the person unticks it or uses Move.
 */
export function sellActionsFit(rows: readonly PortfolioRow[], can: Pick<PortfolioCan, 'editSubProduct'>): boolean {
  return rows.every((row) => mayTick(row, can))
}

export const SELL_ACTIONS_NOTE = 'Reassign and Delete are for sub-products that are sold in CRM. Untick the others to use them.'

// ---------------------------------------------------------------------------------------------------------------------------- bulk actions

export interface BulkPlan {
  /** Catalogue ids, by item type: a batch holds ONE type. */
  byType: Record<PortfolioItemType, number[]>
  /** Rows whose catalogue id could not be found (the Sell read was refused or failed), by name. */
  unresolved: string[]
}

/**
 * Turns the ticked rows into catalogue ids by item type. A list row carries its catalogue id only when the API sends it; otherwise `resolve` reads it from the
 * row's Sell section (one read per row). A row it cannot resolve is named and left out, so the person is told which one was not touched.
 */
export async function planBulk(rows: readonly PortfolioRow[], resolve: (masterId: number) => Promise<number | null>): Promise<BulkPlan> {
  const plan: BulkPlan = { byType: { product: [], service: [] }, unresolved: [] }
  const found = await Promise.all(rows.map(async (row) => {
    if (typeof row.crmProductId === 'number' && row.crmProductId > 0) return row.crmProductId
    try {
      return await resolve(row.id)
    } catch {
      return null
    }
  }))
  rows.forEach((row, index) => {
    const id = found[index]
    if (id === null) plan.unresolved.push(row.name)
    else plan.byType[row.type === 'service' ? 'service' : 'product'].push(id)
  })
  return plan
}

/** Several bulk answers as one (one per item type): the totals and every result, so one sentence can say what happened. */
export function mergeBulkAnswers(answers: ReadonlyArray<CrmBulkActionResponse['data']>): CrmBulkActionResponse['data'] {
  return {
    results: answers.flatMap((a) => a.results),
    summary: { succeeded: answers.reduce((n, a) => n + a.summary.succeeded, 0), failed: answers.reduce((n, a) => n + a.summary.failed, 0) },
  }
}

// ---------------------------------------------------------------------------------------------------------------------------- the pair review

/** The verdicts that come with a Sub-product to decide about. The others (a service, no match, no Product, test words) have nothing to confirm. */
export function needsDecision(match: MatchRow): boolean {
  return match.candidate !== null
}

export function matchesToReview(data: Pick<MatchesData, 'matches'> | null | undefined): MatchRow[] {
  return (data?.matches ?? []).filter(needsDecision)
}

/** The banner sentence. Null when nothing needs a decision. */
export function matchesBanner(count: number): string | null {
  if (count <= 0) return null
  return `${count} ${count === 1 ? 'product may be the same as a sub-product' : 'products may be the same as sub-products'}`
}

export const VERDICT_HINT: Record<string, string> = {
  'MATCH-HIGH': 'A strong match',
  AMBIGUOUS: 'Could be this one or another',
  EDITION: 'Two entries for one Sub-product',
}

/** The sentence a confirmation asks, naming both records and what happens to each. */
export function confirmSameText(match: MatchRow, keptName: string): string {
  return `“${match.name}” (sold in CRM) and “${match.candidate?.name ?? ''}” (the Sub-product) become ONE record named “${keptName}”. Every quote, order and invoice that uses “${match.name}` +
    '” keeps working. Each decision is logged.'
}

export function decidedSummary(decision: Pick<MatchDecisionRow, 'decision' | 'itemName' | 'survivorName'>): string {
  const item = decision.itemName ?? 'A product'
  const sub = decision.survivorName ?? 'a Sub-product'
  return decision.decision === 'same' ? `${item} and ${sub} are the same product` : `${item} is a different product from ${sub}`
}

// ---------------------------------------------------------------------------------------------------------------------------- the screen's state

export type ListScreenState = 'unavailable' | 'error' | 'loading' | 'empty' | 'filtered-empty' | 'ready'

/**
 * Which of the six states the list is in. "empty" is only for an organisation with no records at all (nothing narrows the list and the server's own total is 0);
 * an empty answer to a search or a choice is "filtered-empty", with a way out. `unavailable` is a server whose Product database is not set up yet.
 */
export function listScreenState(input: { loaded: boolean; error: string; available: boolean; rows: number; narrowed: boolean }): ListScreenState {
  if (input.error) return 'error'
  if (!input.loaded) return 'loading'
  if (!input.available) return 'unavailable'
  if (input.rows > 0) return 'ready'
  return input.narrowed ? 'filtered-empty' : 'empty'
}
