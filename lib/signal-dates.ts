/*
 * The calendar days of the Signals date selector. A "day" is a plain YYYY-MM-DD in the APPLICATION's timezone (the one the backend reports with the
 * research dates), computed from text and the timezone name, never from the browser's local midnight, so no UTC/local boundary can move a day.
 */

export const DAY = /^\d{4}-\d{2}-\d{2}$/

/** Today's date in `timeZone`, as YYYY-MM-DD. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  } catch {
    return now.toISOString().slice(0, 10)
  }
}

/** The day `n` days before `day`, by calendar arithmetic on the text (UTC maths on a date with no time, so there is no daylight-saving drift). */
export function shiftDay(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  t.setUTCDate(t.getUTCDate() - n)

  return t.toISOString().slice(0, 10)
}

/** Today and the two calendar days before it, newest first. */
export function recentDays(today: string, count = 3): string[] {
  return Array.from({ length: count }, (_, i) => shiftDay(today, i))
}

/** A date a person picked is usable only if it is a real day that is not in the future. */
export function isPickableDay(day: string, today: string): boolean {
  return DAY.test(day) && day <= today && shiftDay(shiftDay(day, 0), 0) === day
}

/** "Today", "Yesterday" or nothing, for one of the recent days. */
export function relativeLabel(day: string, today: string): string | null {
  if (day === today) return 'Today'
  if (day === shiftDay(today, 1)) return 'Yesterday'

  return null
}

/** "1–5 of 12" from the server's page, page size and total. Null when there is nothing to count. */
export function rangeText(page: number, perPage: number, total: number): string | null {
  if (total <= 0) return null
  const from = (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)

  return `${from}–${to} of ${total}`
}
