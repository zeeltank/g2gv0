/**
 * Times and numbers for the Automations and Runs tabs. Every one goes through Intl, never a hand-written format.
 *
 * The server sends times as "2026-11-26 09:30:00" (no zone) or as ISO text. A time with no zone is read as UTC, the way the rest of the GTM screens read
 * it (components/domain/gtm/gtm-shared.tsx, fmtDate), so a run shows the same time here as it does there.
 */

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** The moment a server time names, or null when it names none. */
export function parseServerTime(value: string | null | undefined): Date | null {
  if (!value) return null
  const text = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value.includes('T') ? value : value.replace(' ', 'T')}Z`
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

/** "2 hours ago", "yesterday", "in 5 minutes". Times a minute apart or less read "just now". */
export function relativeTime(value: string | null | undefined, now: Date = new Date(), locale = 'en'): string {
  const date = parseServerTime(value)
  if (!date) return 'at an unknown time'
  const diff = date.getTime() - now.getTime()
  const abs = Math.abs(diff)
  if (abs < MINUTE) return 'just now'
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (abs < HOUR) return rtf.format(Math.round(diff / MINUTE), 'minute')
  if (abs < DAY) return rtf.format(Math.round(diff / HOUR), 'hour')
  if (abs < 30 * DAY) return rtf.format(Math.round(diff / DAY), 'day')
  return absoluteDate(value, false)
}

/** "26 Nov 2026" or, with the time, "26 Nov 2026, 09:30". In the person's own time zone. */
export function absoluteDate(value: string | null | undefined, withTime = true, locale = 'en-GB'): string {
  const date = parseServerTime(value)
  if (!date) return 'an unknown time'
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date)
}

/** "Today", "Yesterday", or "Wed 25 Nov": the heading of a day in the run timeline. */
export function dayHeading(value: string | null | undefined, now: Date = new Date(), locale = 'en-GB'): string {
  const date = parseServerTime(value)
  if (!date) return 'Unknown date'
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOf(now) - startOf(date)) / DAY)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', ...(days > 300 || days < -300 ? { year: 'numeric' as const } : {}) }).format(date)
}

/** "30,000". The grouping follows the person's own language unless a locale is given. */
export function formatNumber(value: number, locale?: string): string {
  return new Intl.NumberFormat(locale).format(value)
}
