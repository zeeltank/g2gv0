import type { PmPriceTotal } from '@/services/product-master/record-types'
import type { PortfolioCan, PortfolioIcpState, PortfolioRow } from '@/services/product-master/portfolio-list-types'
import {
  icpTone, mayTickRow, productTotal, readinessTone, rowHref, sellKeysPresent, STATE_WORD, stateTone, whyNoTick,
  type DisplayItem, type GroupHeader, type ReadinessTone,
} from './model'
import type { SortKey } from './query'

/*
 * The grid (cards) view of the Product Portfolio list, as plain functions (27 Nov 2026): how the groups of one page become cards, what each card shows, the chips on it,
 * and the sort choices of the grid. It reads what `displayItems` already made of the page (a Product header with its Sub-products under it), so the grid and the table can
 * never disagree about which row belongs under which Product. Nothing is invented: a fact the API did not send is not drawn (there is no description field, so a card
 * shows facts, not prose), and a price is drawn only for a caller who may view Sell and only when the row carries one.
 * Words on screen: Product and Sub-product (a Service is a Sub-product of type Service). No React and no network, so every rule is tested without a browser.
 */

// ---------------------------------------------------------------------------------------------------------------------------- chips

export type ChipKind = 'service' | 'archived' | 'shared' | 'readiness' | 'state' | 'icp'

/** One chip on a card: the WORD carries the meaning, the tone only picks the border and the small icon next to it (never colour alone). */
export interface CardChip {
  kind: ChipKind
  label: string
  tone: ReadinessTone
  /** A longer sentence for the chip's tooltip, when its label alone is not enough. */
  hint?: string
}

/** The ICP state said as a phrase, because a chip has no column heading above it (the table says just "In use" under "ICP"). */
export const ICP_CHIP_WORD: Record<PortfolioIcpState, string> = {
  active: 'ICP in use',
  draft: 'ICP draft',
  archived: 'ICP archived',
  template: 'ICP built in',
  none: 'No ICP yet',
}

export const SHARED_HINT = 'A built-in product shared by every organisation. It cannot be changed here.'

const sharedChip = (): CardChip => ({ kind: 'shared', label: 'Shared, read only', tone: 'default', hint: SHARED_HINT })
const archivedChip = (): CardChip => ({ kind: 'archived', label: 'Archived', tone: 'inactive' })
const readinessChip = (readiness: string): CardChip => ({ kind: 'readiness', label: readiness, tone: readinessTone(readiness) })

/** The chips of a Product card: shared, archived, its readiness and its ICP, each only when the row has it. */
export function productChips(row: PortfolioRow): CardChip[] {
  const chips: CardChip[] = []
  if (row.shared) chips.push(sharedChip())
  if (row.status === 'archived') chips.push(archivedChip())
  if (row.readiness) chips.push(readinessChip(row.readiness))
  if (row.icp) chips.push({ kind: 'icp', label: ICP_CHIP_WORD[row.icp], tone: icpTone(row.icp) })
  return chips
}

/**
 * The chips of a Sub-product row inside a card: a Service says so (the one kind that is labelled), then archived, shared, its own state in CRM (for a caller who may view
 * Sell: the table keeps that column from everybody else) and its own readiness. A Sub-product keeps its own state and readiness; it never borrows its Product's.
 */
export function subProductChips(row: PortfolioRow, can: Pick<PortfolioCan, 'viewSell'>): CardChip[] {
  const chips: CardChip[] = []
  if (row.type === 'service') chips.push({ kind: 'service', label: 'Service', tone: 'default' })
  if (row.status === 'archived') chips.push(archivedChip())
  if (row.shared) chips.push(sharedChip())
  if (can.viewSell && row.state) chips.push({ kind: 'state', label: STATE_WORD[row.state], tone: stateTone(row.state) })
  if (row.readiness) chips.push(readinessChip(row.readiness))
  return chips
}

// ---------------------------------------------------------------------------------------------------------------------------- facts

/** "31 signals found", "1 signal found", "No signals found yet"; null when nobody counted (a row with no signal key). */
export function signalsText(signalsFound: number | null | undefined): string | null {
  if (signalsFound === null || signalsFound === undefined) return null
  if (signalsFound === 0) return 'No signals found yet'
  return `${signalsFound} ${signalsFound === 1 ? 'signal' : 'signals'} found`
}

/** "3 sub-products", "1 sub-product", "No sub-products yet". */
export function subProductCountText(count: number): string {
  if (count <= 0) return 'No sub-products yet'
  return `${count} ${count === 1 ? 'sub-product' : 'sub-products'}`
}

export interface RowPrice {
  amount: number
  currency: string | null
}

/**
 * What a Sub-product row shows as its price: the unit price, and ONLY for a caller who may view Sell and only when the row carries the Sell keys with a price in them (the
 * API leaves the keys out for anyone who may not view that row's type). Both checks are made here, so a card never draws a price the caller was not meant to see.
 */
export function rowPrice(row: PortfolioRow, can: Pick<PortfolioCan, 'viewSell'>): RowPrice | null {
  if (!can.viewSell || !sellKeysPresent(row)) return null
  if (row.unitPrice === null || row.unitPrice === undefined) return null
  return { amount: row.unitPrice, currency: row.currency ?? null }
}

/** True when the caller may view Sell in general but not this row's type (the row is sold and its Sell keys are absent): the card then says the price is not shown. */
export function rowPriceHidden(row: PortfolioRow, can: Pick<PortfolioCan, 'viewSell'>): boolean {
  return can.viewSell && row.hasSell && !sellKeysPresent(row)
}

// ---------------------------------------------------------------------------------------------------------------------------- the cards

/** A Product with more Sub-products on the page than this keeps the first INLINE_SHOWN on its card and says "+N more"; one with this many or fewer shows them all. */
export const INLINE_LIMIT = 4
export const INLINE_SHOWN = 3

export interface GridSubRow {
  row: PortfolioRow
  href: string
  chips: CardChip[]
  price: RowPrice | null
  priceHidden: boolean
  /** Whether a bulk action can work on it, and when not, why (the sentence of the disabled box). */
  tickable: boolean
  whyNoTick: string | null
}

export interface GridCard {
  /** Stable across pages: the group's key (`p:<Product number>`, or `none`). */
  key: string
  kind: 'product' | 'no-product'
  title: string
  /** The Product's own row, when this page holds it; null for the "No product yet" card and for a card made from its Sub-products' Product name. */
  product: PortfolioRow | null
  /** The page of the Product: only a card with the Product's own row can open it. */
  href: string | null
  /** What the stretched link is called for a screen reader: names the Product and how many of its Sub-products the card does not show. Null with no link. */
  openLabel: string | null
  continued: boolean
  /** One plain sentence under the title when the card is not the whole story (continued from the last page, the matches only, or a stray group); otherwise null. */
  note: string | null
  chips: CardChip[]
  signals: string | null
  /** A Product's total, only for a caller who may view Sell. */
  total: { first: PmPriceTotal; more: PmPriceTotal[] } | null
  /** "3 sub-products": the Product's own count, from its own row. */
  countText: string | null
  /** Every Sub-product of the group on this page. */
  subs: GridSubRow[]
  /** The ones the card draws. */
  shown: GridSubRow[]
  /** How many of `subs` the card does not draw: the "+N more" that opens the Product. */
  more: number
  /** The card's own "Add sub-product" action: the Product is the organisation's own and active, and the caller may add Sub-products. */
  canAddSubProduct: boolean
}

function subRow(row: PortfolioRow, can: PortfolioCan): GridSubRow {
  return {
    row,
    href: rowHref(row),
    chips: subProductChips(row, can),
    price: rowPrice(row, can),
    priceHidden: rowPriceHidden(row, can),
    tickable: mayTickRow(row, can),
    whyNoTick: whyNoTick(row, can),
  }
}

function noteOf(group: GroupHeader): string | null {
  if (group.noProduct) return 'Open one to choose its Product.'
  if (group.continued) return 'Continued from the previous page'
  if (group.row === null) return 'Showing the sub-products that match'
  return null
}

function startCard(group: GroupHeader, can: PortfolioCan): GridCard {
  const product = group.row
  return {
    key: group.key,
    kind: group.noProduct ? 'no-product' : 'product',
    title: group.label,
    product,
    href: product ? rowHref(product) : null,
    openLabel: null,
    continued: group.continued,
    note: noteOf(group),
    chips: product ? productChips(product) : [],
    signals: product ? signalsText(product.signalsFound) : null,
    total: product && can.viewSell ? productTotal(product) : null,
    countText: product ? subProductCountText(product.subProductCount ?? 0) : null,
    subs: [],
    shown: [],
    more: 0,
    canAddSubProduct: product !== null && can.createSubProduct && !product.shared && product.status === 'active',
  }
}

/** Fills in what depends on how many Sub-products the card got: which are drawn, how many are left out, and what the link is called. */
function seal(card: GridCard): GridCard {
  // Only a card that can open its Product leaves Sub-products out: there is nowhere to send a person who asks for the rest of a card with no Product page.
  const shown = card.href !== null && card.subs.length > INLINE_LIMIT ? card.subs.slice(0, INLINE_SHOWN) : card.subs
  const more = card.subs.length - shown.length
  const left = more > 0 ? `, ${more} more ${more === 1 ? 'sub-product' : 'sub-products'}` : ''
  return { ...card, shown, more, openLabel: card.href !== null ? `Open ${card.title}${left}` : null }
}

/**
 * The cards of one page, in the order of the page. Each group of `displayItems` is one card: a Product with its Sub-products inside it, or the "No product yet" card of
 * the strays. A group whose Product row is not on the page (it began on the page before, or a filter left it out) still gets a card, made from the name its Sub-products
 * carry, so a Sub-product is never drawn without its Product's name.
 */
export function gridCards(items: readonly DisplayItem[], can: PortfolioCan): GridCard[] {
  const cards: GridCard[] = []
  let current: GridCard | null = null
  for (const item of items) {
    if (item.kind === 'group') {
      current = startCard(item, can)
      cards.push(current)
      continue
    }
    const row = item.row
    if (row.kind === 'product') {
      // A Product row where a Sub-product's group was running cannot happen in the server's order; it gets a card of its own rather than being lost.
      current = startCard({ kind: 'group', key: `p:${row.id}`, label: row.name, row, continued: false, noProduct: false }, can)
      cards.push(current)
      continue
    }
    if (current === null) {
      current = startCard({ kind: 'group', key: 'none', label: 'No product yet', row: null, continued: false, noProduct: true }, can)
      cards.push(current)
    }
    current.subs.push(subRow(row, can))
  }
  return cards.map(seal)
}

/** Every Sub-product row on the cards, in order (the ticks and "select all" work on these). */
export function cardRows(cards: readonly GridCard[]): PortfolioRow[] {
  return cards.flatMap((card) => card.subs.map((s) => s.row))
}

/** Whether any row on the page can be ticked. When none can (a person who may change nothing), the grid draws no tick boxes at all. */
export function pageHasTickable(cards: readonly GridCard[]): boolean {
  return cards.some((card) => card.subs.some((s) => s.tickable))
}

// ---------------------------------------------------------------------------------------------------------------------------- the sort of the grid

/**
 * The table sorts by its column headings, which the grid does not have, so the grid offers the same orders in a select. The server keeps the groups in order of the
 * Product's name whatever the sort is: Name turns the Products themselves (A to Z or Z to A), the other orders sort the Sub-products inside each Product. A Sub-product
 * a card does not draw comes later in that order, so a sort by signals puts the Sub-products with the most signals on the card first.
 */
export interface GridSortChoice {
  value: string
  label: string
  sort: SortKey
  dir: 'asc' | 'desc'
}

const SORT_CHOICES: GridSortChoice[] = [
  { value: 'name:asc', label: 'Name, A to Z', sort: 'name', dir: 'asc' },
  { value: 'name:desc', label: 'Name, Z to A', sort: 'name', dir: 'desc' },
  { value: 'signals:desc', label: 'Most signals found first', sort: 'signals', dir: 'desc' },
  { value: 'signals:asc', label: 'Fewest signals found first', sort: 'signals', dir: 'asc' },
  { value: 'readiness:asc', label: 'Readiness, A to Z', sort: 'readiness', dir: 'asc' },
  { value: 'readiness:desc', label: 'Readiness, Z to A', sort: 'readiness', dir: 'desc' },
  { value: 'price:asc', label: 'Price, low to high', sort: 'price', dir: 'asc' },
  { value: 'price:desc', label: 'Price, high to low', sort: 'price', dir: 'desc' },
]

/** The choices a caller gets: price belongs to the people who may view prices (the server answers Name to everybody else). */
export function gridSortChoices(canViewSell: boolean): GridSortChoice[] {
  return SORT_CHOICES.filter((choice) => canViewSell || choice.sort !== 'price')
}

/** The choice that matches the address's sort and direction; an order the grid does not offer reads as Name, A to Z. */
export function gridSortValue(sort: string, dir: string, canViewSell: boolean): string {
  const value = `${sort}:${dir}`
  return gridSortChoices(canViewSell).some((choice) => choice.value === value) ? value : 'name:asc'
}

/** A chosen value as the sort and direction to write to the address. Anything the grid does not offer is Name, A to Z. */
export function parseGridSort(value: string, canViewSell: boolean): { sort: SortKey; dir: 'asc' | 'desc' } {
  const choice = gridSortChoices(canViewSell).find((c) => c.value === value) ?? SORT_CHOICES[0]
  return { sort: choice.sort, dir: choice.dir }
}

/** The sentence under the grid when the order is not by name, so a person knows what the order moved; null for a sort by name. */
export function gridSortNote(sort: SortKey): string | null {
  return sort === 'name' ? null : 'Products stay in order of name. The sort orders the sub-products inside each product.'
}
