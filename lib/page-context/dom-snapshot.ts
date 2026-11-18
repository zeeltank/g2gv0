/**
 * What is on the screen right now, read from the page itself.
 *
 * Application-agnostic: nothing here knows a module, a route, a table name or a backend.
 * It reads the standard structure every page is built from - the page heading, section
 * headings with counts ("Department List (40)"), tables, filter controls, the search box,
 * tabs and selected rows - so ANY page yields a snapshot without registering anything. The
 * application decides what to do with it (G2G sends it to its own backend; another app
 * sends it to its own).
 *
 * WHAT IT READS IS WHAT THE USER ALREADY SEES. It reads text the page has rendered, for the
 * signed-in user, and nothing else - no network, no storage. Everything is capped, because
 * the snapshot is destined for a model prompt and a page can be arbitrarily large.
 *
 * The container is passed in, not found, so the reader never wanders into the sidebar, the
 * header or the chat panel itself.
 */

export interface PageFilter {
  label: string
  value: string
}

export interface PageTable {
  /** The nearest heading above the table, without its count. */
  title: string | null
  columns: string[]
  /** Visible rows, each keyed by column. At most `LIMITS.rows`. */
  rows: Array<Record<string, string>>
  /** How many rows the page says exist, when a heading carries a count; else the rows read. */
  rowCount: number
}

export interface PageSnapshot {
  title: string | null
  description: string | null
  /** Section headings that carry a count - "Department List (40)" -> {label, value: 40}. */
  metrics: Array<{ label: string; value: number }>
  filters: PageFilter[]
  /** What is typed in the page's search box, and what that box says it searches. */
  search: { query: string; placeholder: string | null } | null
  tabs: Array<{ label: string; active: boolean }>
  /** The first cell of each selected row. */
  selected: string[]
  tables: PageTable[]
}

export const LIMITS = {
  text: 200,
  cell: 80,
  rows: 25,
  columns: 10,
  tables: 3,
  filters: 12,
  metrics: 12,
  tabs: 10,
  selected: 25,
} as const

const clean = (value: string | null | undefined, max: number = LIMITS.text): string =>
  (value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

/** Rendered, not hidden: a collapsed panel or an inactive tab body is not "on the screen". */
function visible(element: Element): boolean {
  if (element.closest('[hidden], [aria-hidden="true"], [inert]')) return false
  // jsdom has no layout, so an element with no rects is only treated as hidden when the
  // environment actually does layout (a real browser).
  const withLayout = typeof (element as HTMLElement).getClientRects === 'function'
  if (!withLayout) return true
  const style = element.ownerDocument.defaultView?.getComputedStyle(element as HTMLElement)
  return !(style && (style.display === 'none' || style.visibility === 'hidden'))
}

/** "Department List (40)" -> ["Department List", 40]. */
function splitCount(text: string): [string, number | null] {
  const match = /^(.*?)\s*[(\[]\s*([\d,]+)\s*[)\]]\s*$/.exec(text)
  return match ? [match[1].trim(), Number(match[2].replace(/,/g, ''))] : [text, null]
}

function cellText(cell: Element): string {
  // A cell often stacks a name over a code ("Development" / "D"); keep both, in order.
  const parts = Array.from(cell.querySelectorAll('*'))
    .filter((child) => child.children.length === 0)
    .map((child) => clean(child.textContent, LIMITS.cell))
    .filter(Boolean)
  const joined = parts.length > 0 ? Array.from(new Set(parts)).join(' · ') : clean(cell.textContent, LIMITS.cell)
  return joined.slice(0, LIMITS.cell)
}

function labelFor(control: Element): string {
  const doc = control.ownerDocument
  const aria = control.getAttribute('aria-label')
  if (aria) return clean(aria, 60)
  const id = control.getAttribute('id')
  if (id) {
    const escape = doc.defaultView?.CSS?.escape ?? ((value: string) => value)
    const label = doc.querySelector(`label[for="${escape(id)}"]`)
    if (label) return clean(label.textContent, 60)
  }
  const wrapping = control.closest('label')
  if (wrapping) return clean(wrapping.textContent, 60)
  return clean(control.getAttribute('name') ?? '', 60)
}

export function readPage(root: Element): PageSnapshot {
  const headings = Array.from(root.querySelectorAll('h1, h2, h3, h4')).filter(visible)

  const h1 = root.querySelector('h1')
  const title = clean(h1?.textContent) || null

  // The line of text under the page title is its description.
  let description: string | null = null
  if (h1) {
    const next = h1.parentElement?.querySelector('p') ?? h1.nextElementSibling
    description = clean(next?.textContent, 300) || null
  }

  const metrics: PageSnapshot['metrics'] = []
  for (const heading of headings) {
    const [label, value] = splitCount(clean(heading.textContent))
    if (value !== null && label && metrics.length < LIMITS.metrics) metrics.push({ label, value })
  }

  // Filters: native selects and combobox buttons, each with the value currently chosen.
  const filters: PageFilter[] = []
  const seenFilters = new Set<string>()
  const pushFilter = (label: string, value: string) => {
    const key = `${label}|${value}`
    if (value && !seenFilters.has(key) && filters.length < LIMITS.filters) {
      seenFilters.add(key)
      filters.push({ label, value })
    }
  }

  for (const select of Array.from(root.querySelectorAll('select')).filter(visible)) {
    const chosen = (select as HTMLSelectElement).selectedOptions?.[0]
    pushFilter(labelFor(select), clean(chosen?.textContent, 60))
  }

  for (const trigger of Array.from(root.querySelectorAll('[role="combobox"]')).filter(visible)) {
    const text = clean(trigger.textContent, 80)
    const split = /^([^:]{1,40}):\s*(.+)$/.exec(text)
    // "Status: All" carries its own label; otherwise fall back to the control's label.
    pushFilter(split ? split[1].trim() : labelFor(trigger), split ? split[2].trim() : text)
  }

  // Search: the first text-like box the page offers.
  let search: PageSnapshot['search'] = null
  const box = Array.from(
    root.querySelectorAll('input[type="search"], input[type="text"], input:not([type])'),
  ).filter(visible)[0] as HTMLInputElement | undefined
  if (box) {
    search = { query: clean(box.value, 80), placeholder: clean(box.getAttribute('placeholder'), 80) || null }
  }

  const tabs = Array.from(root.querySelectorAll('[role="tab"]'))
    .filter(visible)
    .slice(0, LIMITS.tabs)
    .map((tab) => ({
      label: clean(tab.textContent, 60),
      active: tab.getAttribute('aria-selected') === 'true' || tab.getAttribute('data-state') === 'active',
    }))
    .filter((tab) => tab.label)

  const selected: string[] = []
  const tables: PageTable[] = []

  for (const table of Array.from(root.querySelectorAll('table')).filter(visible).slice(0, LIMITS.tables)) {
    const columns = Array.from(table.querySelectorAll('thead th, thead td'))
      .map((th) => clean(th.textContent, 60))
      .slice(0, LIMITS.columns)

    if (columns.length === 0) continue

    // The nearest heading that comes before the table in the document.
    const before = headings.filter(
      // 4 is Node.DOCUMENT_POSITION_FOLLOWING; spelled out so this runs without a global `Node`.
      (heading) => heading.compareDocumentPosition(table) & 4,
    )
    const nearest = before[before.length - 1]
    const [tableTitle, counted] = nearest ? splitCount(clean(nearest.textContent)) : [null, null]

    const rows: Array<Record<string, string>> = []
    const bodyRows = Array.from(table.querySelectorAll('tbody tr'))

    for (const tr of bodyRows) {
      const cells = Array.from(tr.querySelectorAll('td, th'))
      if (cells.length === 0) continue

      const row: Record<string, string> = {}
      columns.forEach((column, index) => {
        const text = cells[index] ? cellText(cells[index]) : ''
        if (column && text) row[column] = text
      })

      if (Object.keys(row).length === 0) continue

      const isSelected =
        tr.getAttribute('aria-selected') === 'true' ||
        tr.getAttribute('data-state') === 'selected' ||
        tr.querySelector('input[type="checkbox"]:checked, [role="checkbox"][aria-checked="true"]') !== null

      if (isSelected && selected.length < LIMITS.selected) {
        selected.push(Object.values(row)[0] ?? '')
      }

      if (rows.length < LIMITS.rows) rows.push(row)
    }

    if (rows.length > 0) {
      tables.push({ title: tableTitle || null, columns, rows, rowCount: counted ?? bodyRows.length })
    }
  }

  return { title, description, metrics, filters, search, tabs, selected: selected.filter(Boolean), tables }
}

/** A stable fingerprint, so a caller can tell whether the page changed without comparing deeply. */
export function snapshotKey(snapshot: PageSnapshot): string {
  return JSON.stringify(snapshot)
}

/** Whether there is anything worth sending. */
export function hasContent(snapshot: PageSnapshot): boolean {
  return Boolean(snapshot.title) || snapshot.tables.length > 0 || snapshot.metrics.length > 0
}
