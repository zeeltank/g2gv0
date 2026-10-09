/**
 * One vocabulary for "what happened on this attendance day".
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 *
 * Three screens in this module described the same day in three different
 * vocabularies, and the differences were not stylistic:
 *
 *   Manage Employee Attendance  present | incomplete | recorded | absent |
 *                               weekend | unset | upcoming
 *   Monthly Attendance Report   present | absent | leave | holiday | weekend |
 *                               incomplete
 *   The tracking calendar       present | late | absent | leave - and its
 *                               `toDayStatus` returned null for everything
 *                               else, so a day with a punch-in and NO punch-out
 *                               rendered completely unmarked, indistinguishable
 *                               from a day with no data at all
 *
 * The admin grid's set is canonical here because it is the only one that can
 * say `unset`, and `unset` is the distinction the whole desk was built around:
 * 2,008 of 2,283 active employees have no roster, and the other two screens
 * each invented a different answer for them - one calls every day a weekend,
 * the other calls Monday to Saturday worked. Extended with `leave` and
 * `holiday`, which the monthly report knows about and the grid does not.
 *
 * ── THE LOOKUPS ARE TOTAL, ON PURPOSE ───────────────────────────────────────
 *
 * The server's vocabulary grows - `recorded` was added to it late in phase 18 -
 * so every lookup here falls back rather than returning undefined.
 * `statusLabel()` was already written that way in the grid; `STATUS_CLASS` was
 * not, which meant a status the client did not know rendered with no fill at
 * all, visually identical to `upcoming`. Both are total now.
 */

/** Every status this module can render. */
export type AttendanceDayStatus =
  | 'present' // punched in and out
  | 'incomplete' // punched in, never out
  | 'recorded' // a row exists with neither time - something created it
  | 'absent' // no row, and the roster says this day is worked
  | 'weekend' // no row, and the roster says it is not
  | 'unset' // no row, and the employee has NO roster at all
  | 'upcoming' // no row, and the day is in the future
  | 'leave' // an approved leave day
  | 'holiday' // a holiday from the calendar
  | 'unknown' // we do not know - see fromMonthlyReportDay()

/**
 * One day, however it was sourced.
 *
 * A superset of the admin grid's `AttendanceGridCell` plus the fields only the
 * monthly report carries, so one tile component can render either.
 */
export interface AttendanceDayCell {
  status: AttendanceDayStatus
  /** "HH:MM" or null. */
  in: string | null
  out: string | null
  /** Worked time, "HH:MM" or "HH:MM:SS". Null unless the day has both punches. */
  duration: string | null
  work_mode?: string | null
  /** A correction has been applied to this day. */
  edited?: boolean
  /** The rostered hours for this weekday. Null when the employee has no roster. */
  shift_in: string | null
  shift_out: string | null
  /** From the monthly report only. */
  is_late?: boolean
  leave_type?: string | null
  leave_reason?: string | null
  holiday_name?: string | null
}

export const STATUS_LABEL: Record<AttendanceDayStatus, string> = {
  present: 'Present',
  incomplete: 'No punch out',
  recorded: 'Recorded',
  absent: 'Absent',
  weekend: 'Non-working',
  unset: 'No roster',
  upcoming: 'Upcoming',
  leave: 'On leave',
  holiday: 'Holiday',
  unknown: 'Not recorded',
}

/**
 * One sentence each, for the legend.
 *
 * The grid's own legend was a row of swatches and one word apiece, which is
 * enough to decode a colour and not enough to explain why "Absent" and "No
 * roster" are different answers. That difference is the reason this screen
 * exists, so it is written down where somebody reading the legend will see it.
 */
export const STATUS_HELP: Record<AttendanceDayStatus, string> = {
  present: 'Punched in and out.',
  incomplete: 'Punched in, but never punched out - so there are no hours for the day.',
  recorded: 'A row exists for the day with neither time on it.',
  absent: 'Nothing recorded, and this employee is rostered to work this weekday.',
  weekend: 'Nothing recorded, and this employee is not rostered to work this weekday.',
  unset: 'Nothing recorded, and nobody has set which days this employee works - so this is neither an absence nor a day off.',
  upcoming: 'This day has not happened yet.',
  leave: 'Approved leave.',
  holiday: 'A holiday from the organisation calendar.',
  unknown: 'We do not have enough information to say what this day was.',
}

/**
 * Both themes, through the existing colour idiom.
 *
 * Deliberately NOT `bg-success/10` and friends: globals.css documents those
 * tokens at 1.86:1 against white in dark mode. They are badge fills that carry
 * their own foreground, not tints meant to have readable text laid over them.
 * Using them here would look more designed and read worse.
 */
export const STATUS_CLASS: Record<AttendanceDayStatus, string> = {
  present: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
  incomplete: 'bg-amber-500/20 text-amber-900 dark:text-amber-200',
  recorded: 'bg-sky-500/15 text-sky-800 dark:text-sky-200',
  absent: 'bg-rose-500/15 text-rose-800 dark:text-rose-200',
  weekend: 'bg-muted text-muted-foreground',
  unset: 'bg-violet-500/15 text-violet-800 dark:text-violet-200',
  upcoming: 'bg-transparent text-muted-foreground/50',
  leave: 'bg-indigo-500/15 text-indigo-800 dark:text-indigo-200',
  holiday: 'bg-teal-500/15 text-teal-800 dark:text-teal-200',
  unknown: 'bg-muted/60 text-muted-foreground',
}

/** Two or three characters, because a compact cell is 28px wide. */
export const SHORT_STATUS: Record<AttendanceDayStatus, string> = {
  present: 'P',
  incomplete: 'IN',
  recorded: 'R',
  absent: 'A',
  weekend: '—',
  unset: '?',
  upcoming: '',
  leave: 'L',
  holiday: 'H',
  unknown: '·',
}

/** The label, falling back to the raw value rather than rendering `undefined`. */
export function statusLabel(status: AttendanceDayStatus | string): string {
  return STATUS_LABEL[status as AttendanceDayStatus] ?? status
}

/** The fill. Falls back to a neutral tint so an unknown status is still visible. */
export function statusClass(status: AttendanceDayStatus | string): string {
  return STATUS_CLASS[status as AttendanceDayStatus] ?? 'bg-muted text-muted-foreground'
}

/** The glyph. Falls back to a dot - something, rather than an empty cell. */
export function statusGlyph(status: AttendanceDayStatus | string): string {
  return SHORT_STATUS[status as AttendanceDayStatus] ?? '·'
}

export function statusHelp(status: AttendanceDayStatus | string): string {
  return STATUS_HELP[status as AttendanceDayStatus] ?? 'An attendance state this screen does not recognise.'
}

/** Statuses where the employee was at work, for counting. */
export const WORKED_STATUSES: AttendanceDayStatus[] = ['present', 'incomplete']

/* ========================================================================== */
/* Durations                                                                  */
/* ========================================================================== */

/**
 * "HH:MM" or "HH:MM:SS" to whole minutes. Null for anything unparseable.
 *
 * The two writers of `timestamp_diff` disagree about the seconds - one truncates
 * to the minute, the other keeps them - so both forms are in the live data and
 * both have to parse.
 */
export function parseDuration(value: string | null | undefined): number | null {
  if (!value) return null
  const parts = value.split(':')
  if (parts.length < 2) return null
  const hours = Number(parts[0])
  const minutes = Number(parts[1])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

/** Whole minutes back to "H:MM". */
export function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return `${hours}:${String(minutes).padStart(2, '0')}`
}

/**
 * Total worked time across a month, and whether the total is understated.
 *
 * `missing` counts days the employee was clearly at work but which carry no
 * duration - an unclosed day has no hours, so adding them as zero would quietly
 * understate the month. The caller renders "8:12+" and says why, rather than
 * printing a number it knows is wrong.
 */
export function sumDurations(cells: AttendanceDayCell[]): { minutes: number; missing: number } {
  let minutes = 0
  let missing = 0

  for (const cell of cells) {
    const parsed = parseDuration(cell.duration)
    if (parsed !== null) {
      minutes += parsed
    } else if (WORKED_STATUSES.includes(cell.status)) {
      missing += 1
    }
  }

  return { minutes, missing }
}

/* ========================================================================== */
/* Punctuality                                                                */
/* ========================================================================== */

/**
 * Minutes late (positive) or early (negative) against the rostered start.
 *
 * **Returns null unless BOTH the punch and the roster exist**, and that is the
 * whole point of the function rather than an edge case. Two live endpoints
 * compute lateness against `tbluser.monday_in_date` for every day of the week,
 * and the Early Going Report reads Saturday's column for Thursday. Both are
 * index arithmetic gone wrong, and both produce a confident number for an
 * employee who has no roster at all.
 *
 * For the 2,008 employees with no roster the honest answer is "we cannot say",
 * and null is how that is said. A caller that renders 0 for null has
 * reintroduced the bug.
 */
export function latenessMinutes(cell: AttendanceDayCell): number | null {
  const actual = parseDuration(cell.in)
  const expected = parseDuration(cell.shift_in)
  if (actual === null || expected === null) return null
  return actual - expected
}

/** Was the employee late, where that can be answered at all. */
export function isLate(cell: AttendanceDayCell, graceMinutes = 0): boolean | null {
  if (typeof cell.is_late === 'boolean') return cell.is_late
  const delta = latenessMinutes(cell)
  if (delta === null) return null
  return delta > graceMinutes
}

/* ========================================================================== */
/* Translating the monthly report                                             */
/* ========================================================================== */

/** The shape `MonthlyAttendanceDay` arrives in, declared locally to avoid a cycle. */
interface MonthlyDayLike {
  date: string
  status: string
  punchin_time: string | null
  punchout_time: string | null
  working_hours: string | null
  is_late?: boolean
  shift_time: string | null
  leave?: { leave_type?: string | null; reason?: string | null } | null
  holiday_name?: string | null
}

/** "2026-10-03 09:15:00" or "09:15:00" to "09:15". Null stays null. */
function toClock(value: string | null | undefined): string | null {
  if (!value) return null
  const match = value.match(/(\d{1,2}):(\d{2})/)
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null
}

/**
 * One monthly-report day to one canonical cell.
 *
 * ── THE LOAD-BEARING LINE IS THE `weekend` REWRITE ──────────────────────────
 *
 * The monthly report has no `unset`. For an employee with no roster it reports
 * **`weekend`** for every day - which is exactly the divergence the admin desk
 * was built to refuse, and the reason its own module docblock says the grid
 * "refuses to guess". Rendering the report's answer unchanged in a component
 * that sits on that desk would quietly undo the commitment.
 *
 * So the mapper takes `hasRoster` from the caller and rewrites
 * `weekend → unset` when it is explicitly `false`.
 *
 * When `hasRoster` is `undefined` the caller genuinely does not know - the
 * Employee Directory tab and the tracking surface have no grid row to read it
 * from - and the honest output is `unknown`, which says "we do not have enough
 * information" instead of picking a side. It is NOT defaulted to true: that
 * would make a no-roster employee read as a month of weekends again, which is
 * the bug.
 */
export function fromMonthlyReportDay(
  day: MonthlyDayLike,
  hasRoster?: boolean,
): AttendanceDayCell {
  const inTime = toClock(day.punchin_time)
  const outTime = toClock(day.punchout_time)

  let status: AttendanceDayStatus

  if (inTime && outTime) {
    status = 'present'
  } else if (inTime) {
    status = 'incomplete'
  } else if (day.status === 'leave') {
    status = 'leave'
  } else if (day.status === 'holiday') {
    status = 'holiday'
  } else if (day.status === 'weekend') {
    // See the docblock. This branch is the reason the function takes hasRoster.
    status = hasRoster === false ? 'unset' : hasRoster === true ? 'weekend' : 'unknown'
  } else if (day.status === 'absent') {
    status = hasRoster === false ? 'unset' : 'absent'
  } else {
    status = (STATUS_LABEL[day.status as AttendanceDayStatus] ? day.status : 'unknown') as AttendanceDayStatus
  }

  return {
    status,
    in: inTime,
    out: outTime,
    duration: day.working_hours,
    shift_in: toClock(day.shift_time),
    // The monthly report carries only the START of the rostered shift, so there
    // is no honest value for the end. Null rather than a guess.
    shift_out: null,
    is_late: day.is_late,
    leave_type: day.leave?.leave_type ?? null,
    leave_reason: day.leave?.reason ?? null,
    holiday_name: day.holiday_name ?? null,
  }
}

/* ========================================================================== */
/* Counting a month                                                           */
/* ========================================================================== */

export interface AttendanceDayTotals {
  present: number
  absent: number
  /** Null when no day in the month could be judged - never 0 in that case. */
  late: number | null
  noRoster: number
  leave: number
  holiday: number
  minutes: number
  /** Days clearly worked that carry no duration, so `minutes` understates. */
  missingDuration: number
}

/**
 * Per-employee totals for a month.
 *
 * `late` is null, not zero, when nothing could be judged. An employee with no
 * roster has no start time to be late against, and reporting "0 late" for them
 * is a confident claim about something unknowable - the same mistake the two
 * Monday-reading endpoints make.
 */
export function totalsFor(cells: AttendanceDayCell[]): AttendanceDayTotals {
  const { minutes, missing } = sumDurations(cells)

  let lateCount = 0
  let judgeable = 0

  for (const cell of cells) {
    const late = isLate(cell)
    if (late === null) continue
    judgeable += 1
    if (late) lateCount += 1
  }

  const count = (status: AttendanceDayStatus) => cells.filter((cell) => cell.status === status).length

  return {
    present: count('present') + count('incomplete'),
    absent: count('absent'),
    late: judgeable === 0 ? null : lateCount,
    noRoster: count('unset'),
    leave: count('leave'),
    holiday: count('holiday'),
    minutes,
    missingDuration: missing,
  }
}
