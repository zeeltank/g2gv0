/**
 * DATE-ONLY VALUES, WITHOUT THE TIMEZONE SHIFT.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * THE BUG THIS EXISTS TO STOP
 * ═══════════════════════════════════════════════════════════════════════
 *
 * A date picker hands back a LOCAL-midnight Date. `toISOString()` converts to
 * UTC before formatting:
 *
 *   pick 2 Jan in IST  ->  2026-01-02T00:00:00+05:30
 *   .toISOString()     ->  2026-01-01T18:30:00.000Z
 *   .slice(0, 10)      ->  "2026-01-01"          <-- a day earlier
 *
 * That wrong string is then POSTed and stored in a DATE column, so the day is
 * lost permanently — this is data corruption, not a display quirk. It bites
 * every timezone east of Greenwich, which includes every user of this product.
 *
 * The mirror image happens on the way back: `new Date("2026-01-02")` is
 * specified to parse as UTC midnight, so west of Greenwich it renders as 1 Jan.
 *
 * A calendar date has no timezone. It is three numbers. Read and write it as
 * three numbers and neither shift can occur.
 */

/** Local Date -> "YYYY-MM-DD". Never uses toISOString(). */
export function toDateOnly(value: Date | string | null | undefined): string {
  if (!value) return ''

  if (typeof value === 'string') {
    // Already date-only, or a datetime whose date part is what we want.
    return value.slice(0, 10)
  }

  if (Number.isNaN(value.getTime())) return ''

  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

/**
 * "YYYY-MM-DD" -> a Date at LOCAL midnight.
 *
 * Use this instead of `new Date(str)` anywhere a date-only string is turned
 * back into a Date for display or comparison.
 */
export function fromDateOnly(value: string | null | undefined): Date | undefined {
  if (!value) return undefined

  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!parts) {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  }

  return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
}

/** Today as "YYYY-MM-DD" in the user's own timezone. */
export function todayDateOnly(): string {
  return toDateOnly(new Date())
}
