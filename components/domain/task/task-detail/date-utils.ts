/**
 * Date helpers for the task detail panel. Every date on the wire is a
 * `YYYY-MM-DD` string with no time or zone, so it is read as LOCAL midnight -
 * `new Date('2026-11-27')` would be UTC midnight, and a day early west of it.
 */

export function parseDay(value: string | null | undefined): Date | null {
  if (!value) return null
  const day = new Date(`${value.slice(0, 10)}T00:00:00`)
  return Number.isNaN(day.getTime()) ? null : day
}

/** `27 Nov 2026`, or `fallback` when there is no date. */
export function formatDay(value: string | null | undefined, fallback = 'No date'): string {
  const day = parseDay(value)
  return day
    ? day.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : fallback
}

/** `27 Nov`, for a range where the year is obvious from the end of it. */
export function formatDayShort(value: string | null | undefined, fallback = '—'): string {
  const day = parseDay(value)
  return day ? day.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : fallback
}

/** `YYYY-MM-DD` in local time, `offset` days from today. */
export function localDay(offset = 0): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Whole days from today to `value`: negative when it has passed. Null when there is no date. */
export function daysFromToday(value: string | null | undefined): number | null {
  const day = parseDay(value)
  if (!day) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((day.getTime() - today.getTime()) / 86_400_000)
}

export type DueTone = 'overdue' | 'soon' | 'later' | 'done'

/**
 * How to label a due date. A finished task is never "overdue", and the label
 * always carries words as well as a colour - colour alone is not a signal.
 */
export function dueBadge(due: string | null | undefined, finished: boolean): { label: string; tone: DueTone } | null {
  if (finished) return { label: 'Done', tone: 'done' }
  const days = daysFromToday(due)
  if (days === null) return null
  if (days < 0) return { label: `Overdue ${Math.abs(days)}d`, tone: 'overdue' }
  if (days === 0) return { label: 'Due today', tone: 'soon' }
  if (days <= 3) return { label: `Due in ${days}d`, tone: 'soon' }
  return { label: `Due in ${days}d`, tone: 'later' }
}

/** `3 min ago`, `2 h ago`, `yesterday`, else the date. */
export function relativeTime(value: string | null | undefined): string {
  if (!value) return ''
  const then = new Date(value.includes('T') ? value : value.replace(' ', 'T'))
  if (Number.isNaN(then.getTime())) return value
  const minutes = Math.round((Date.now() - then.getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
