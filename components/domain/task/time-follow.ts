/**
 * Auto-follow: end always re-derives from start + 1 hour, on every start
 * change — not a fill-once default (locked-in). Two variants because the
 * time-field call sites across this domain carry the time in two different
 * shapes: some share one separate date field, some carry their own.
 */

/** "HH:mm"(:ss) -> "HH:mm" one hour later, wrapping within the same day. For
 *  fields where start/end are independent time-of-day values sharing one
 *  separate date field - there is no second date to carry a midnight
 *  rollover into. */
export function addOneHourToClock(value: string): string {
  const [hourStr, minuteStr = '0'] = value.split(':')
  const hour = Number(hourStr)
  const minute = Number(minuteStr)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return value
  const nextHour = (hour + 1) % 24
  return `${String(nextHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/** "YYYY-MM-DDTHH:mm" -> one hour later via real Date math, correctly
 *  rolling into the next calendar day when needed. For fields that carry
 *  their own date (events). */
export function addOneHourToDateTimeLocal(value: string): string {
  if (!value) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  date.setHours(date.getHours() + 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
