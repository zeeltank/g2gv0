/**
 * Shared CSV export — there wasn't one. `components/domain/competency/
 * cm-audit.tsx` has its own private `csvCell`/`downloadCsv` pair (and isn't
 * the only screen that does), each screen re-inventing the same escaping
 * and blob-download dance. This is that logic, extracted once, generic over
 * any row shape via a `columns` map instead of a hardcoded field list.
 */

export type CsvColumn<T> = {
  /** Header cell text. */
  label: string
  /** Pulls this column's value out of one row. */
  value: (row: T) => string | number | null | undefined
}

function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value)

  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => csvCell(c.label)).join(',')
  const body = rows.map((row) => columns.map((c) => csvCell(c.value(row))).join(','))

  return [header, ...body].join('\n')
}

/** Builds the CSV and triggers a browser download — same blob/anchor/revoke shape every existing inline implementation already used. */
export function downloadCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
  const csv = toCsv(rows, columns)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  link.click()

  URL.revokeObjectURL(url)
}
