import type { ProductFilterOption, SignalListParams, SignalListResponse, SignalRow } from '@/services/signal-review/signal-types'
import { fitSummary } from './list-model'
import { dateBadge, sourceLink, statusChip, type DateBadgeKind } from './signal-display'

/**
 * Exporting the signals that match the current filters as a CSV file. The file is built in the browser from the same list endpoint the screen uses, one
 * page at a time. Pure, so the two things that can hurt a person (a spreadsheet running text from the file as a formula, and a file that silently stops
 * short) are proved by tests.
 */

/** The server's largest page (`per_page` is validated as at most 50). */
export const EXPORT_PAGE_SIZE = 50
/** The most rows one file holds. Past it the file says so and the person narrows the filters. */
export const EXPORT_CAP = 2000

export const CSV_HEADERS = ['Title', 'Organisation', 'Product', 'Date kind', 'Date', 'Fit', 'Status', 'Reason', 'Source link'] as const

// ── The file ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A cell that starts with one of these is read by Excel and Sheets as a formula, whatever quotes surround it. */
const FORMULA_START = /^[=+\-@\t\r]/

/** Text from a source page can start with anything. A leading apostrophe makes a spreadsheet show the text as it is instead of running it. */
export function neutraliseFormula(text: string): string {
  return FORMULA_START.test(text) ? `'${text}` : text
}

/** One field: made safe, then quoted, with a quote inside the text doubled. Every field is quoted, so a comma or a line break inside it is just text. */
export function csvField(value: string | null | undefined): string {
  return `"${neutraliseFormula(value ?? '').replace(/"/g, '""')}"`
}

const DATE_KIND_WORDS: Record<DateBadgeKind, string> = { event: 'Event', published: 'Published', unknown: 'Unknown' }

/**
 * The latest dismissal reason, when the list row carries one (`last_decision.reason_label`) and the signal is still dismissed. The list endpoint sends no
 * such field today, so the column stays empty until it does; nothing is guessed from the note.
 */
export function reasonLabel(row: SignalRow): string {
  if (row.review_status !== 'Dismissed') return ''
  const decision = row.last_decision
  const label = decision && typeof decision === 'object' ? (decision as { reason_label?: unknown }).reason_label : null
  return typeof label === 'string' ? label : ''
}

/** One signal as the nine cells of CSV_HEADERS, in the screen's own words. */
export function signalCsvCells(row: SignalRow, products?: readonly ProductFilterOption[]): string[] {
  const badge = dateBadge(row.date_info)
  return [
    row.title,
    row.company_name,
    row.product_master_name ?? '',
    DATE_KIND_WORDS[badge.kind],
    badge.kind === 'unknown' ? '' : (row.date_info.date ?? '').slice(0, 10),
    fitSummary(row, products) ?? '',
    statusChip(row.review_status).label,
    reasonLabel(row),
    sourceLink(row)?.url ?? '',
  ]
}

/**
 * The whole file: a byte-order mark first, so Excel reads Hindi and Gujarati text as UTF-8, then a header and one line per signal, lines ended by CRLF as
 * the CSV standard says.
 */
export function buildCsv(rows: readonly SignalRow[], products?: readonly ProductFilterOption[]): string {
  const lines = [CSV_HEADERS as readonly string[], ...rows.map((row) => signalCsvCells(row, products))]
  return `\uFEFF${lines.map((cells) => cells.map(csvField).join(',')).join('\r\n')}\r\n`
}

/** `signals-2026-11-03.csv`, for the day on the person's own clock. */
export function csvFileName(now: Date = new Date()): string {
  const two = (n: number) => String(n).padStart(2, '0')
  return `signals-${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}.csv`
}

// ── Reading every page ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The person pressed Cancel (or left the screen). Not a failure: no file is made and nothing is said about an error. */
export class ExportCancelled extends Error {
  constructor() {
    super('The export was cancelled.')
    this.name = 'ExportCancelled'
  }
}

export interface Collected {
  rows: SignalRow[]
  /** How many signals match the filters, as the server counts them. */
  total: number
  /** True when more match than the cap allows, so the file holds only the first `cap`. */
  capped: boolean
  /** From the first page: used to turn a fit code into the product's name. */
  products: ProductFilterOption[]
}

/**
 * Reads the pages of the list one after another, at the server's largest page size, until every matching signal is read or the cap is reached. Cancelling
 * takes effect when the page being asked for arrives. A page that adds nothing new ends the reading, so a server that ignores `page` cannot hold it in a
 * loop. `params` are the screen's own filters; `page` and `per_page` in them are replaced.
 */
export async function collectSignals(input: {
  fetchPage: (params: SignalListParams) => Promise<SignalListResponse>
  params: SignalListParams
  signal?: AbortSignal
  cap?: number
  onProgress?: (progress: { loaded: number; total: number }) => void
}): Promise<Collected> {
  const cap = input.cap ?? EXPORT_CAP
  const rows: SignalRow[] = []
  const seen = new Set<number>()
  let total = 0
  let products: ProductFilterOption[] = []

  for (let page = 1; ; page += 1) {
    if (input.signal?.aborted) throw new ExportCancelled()
    const response = await input.fetchPage({ ...input.params, page, per_page: EXPORT_PAGE_SIZE })
    if (input.signal?.aborted) throw new ExportCancelled()

    if (page === 1) {
      total = response.meta.total
      products = response.filters?.products ?? []
    }

    // A signal can move to another page while the pages are being read; it is kept once.
    let added = 0
    for (const row of response.data) {
      if (rows.length >= cap || seen.has(row.id)) continue
      seen.add(row.id)
      rows.push(row)
      added += 1
    }

    input.onProgress?.({ loaded: rows.length, total: Math.min(Math.max(total, rows.length), cap) })
    if (rows.length >= cap || added === 0 || page >= response.meta.last_page) break
  }

  return { rows, total, capped: total > cap, products }
}
