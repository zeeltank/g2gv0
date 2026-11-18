/**
 * Dates of successful research runs, as the dropdown shows them. The backend sends plain YYYY-MM-DD days in the application's timezone; they
 * are formatted from the text itself (never through a Date), so no timezone can move a day.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-10-15" -> "15 Oct 2026". Anything that is not a day is returned as it came. */
export function formatRunDate(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!m) return day
  const month = MONTHS[Number(m[2]) - 1]

  return month ? `${Number(m[3])} ${month} ${m[1]}` : day
}

/**
 * Which date is selected after the list of dates is (re)loaded. A date the person already chose stays chosen while it still exists; otherwise
 * the newest. `jumpToNewest` is used right after a run finishes, so the new run's day is shown. No date at all -> null (never today).
 */
export function chooseRunDate(dates: { date: string }[], current: string | null, jumpToNewest = false): string | null {
  if (dates.length === 0) return null
  if (!jumpToNewest && current && dates.some((d) => d.date === current)) return current

  return [...dates].sort((a, b) => (a.date < b.date ? 1 : -1))[0].date
}
