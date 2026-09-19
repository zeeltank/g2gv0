/**
 * HUMAN LABELS FOR MACHINE VALUES.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT WAS ON SCREEN BEFORE THIS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Two settings screens asked people to choose between strings like these:
 *
 *     Asia/Kolkata                    an IANA database identifier
 *     America/New York                the same, with one underscore replaced
 *     dd/mm/yyyy — 09/02/2026         the format token as the label, the human
 *                                     example demoted to an annotation
 *     1,23,456.78                     a number format offered as raw sample text
 *
 * None of that is wrong, exactly. It is just the internal value shown where the
 * label belongs — and `replace('_', ' ')` only ever replaced the FIRST
 * underscore, so `America/Port_of_Spain` came out as `America/Port of_Spain`.
 *
 * The rule applied here: lead with what a person recognises, and keep the
 * technical value only where it genuinely disambiguates. A time zone needs its
 * offset, because "India" and "GMT+5:30" answer different questions.
 *
 * ── ONE SOURCE, TWO SCREENS ─────────────────────────────────────────────────
 *
 * Preferences (per person) and Organisation defaults (per organisation) offer
 * the same choices. They had two private copies of these lists, already drifting
 * — one had eight zones, the other eight different ones. A shared module means a
 * zone added for one is available to both.
 */

export type LabelledOption = { value: string; label: string }

/**
 * The time zones this product offers, with their offsets written out.
 *
 * Deliberately a short curated list rather than all ~600 IANA zones: a dropdown
 * of six hundred entries is not a choice, it is a search problem, and every live
 * organisation is in one of these. Adding one is a one-line change here.
 *
 * Offsets are written as text rather than computed, because a computed offset
 * changes under daylight saving and a label that silently reads GMT+1 in summer
 * and GMT+0 in winter looks like a bug. The city is what identifies the zone;
 * the offset is orientation.
 */
export const TIMEZONES: LabelledOption[] = [
  { value: 'Asia/Kolkata', label: 'India — Kolkata (GMT+5:30)' },
  { value: 'Asia/Dubai', label: 'United Arab Emirates — Dubai (GMT+4)' },
  { value: 'Asia/Singapore', label: 'Singapore (GMT+8)' },
  { value: 'Asia/Tokyo', label: 'Japan — Tokyo (GMT+9)' },
  { value: 'Europe/London', label: 'United Kingdom — London (GMT+0/+1)' },
  { value: 'Europe/Berlin', label: 'Germany — Berlin (GMT+1/+2)' },
  { value: 'America/New_York', label: 'United States — New York (GMT−5/−4)' },
  { value: 'America/Chicago', label: 'United States — Chicago (GMT−6/−5)' },
  { value: 'America/Los_Angeles', label: 'United States — Los Angeles (GMT−8/−7)' },
  { value: 'Australia/Sydney', label: 'Australia — Sydney (GMT+10/+11)' },
  { value: 'UTC', label: 'UTC — no offset' },
]

/**
 * A zone's label, falling back to something readable for an unlisted value.
 *
 * An organisation whose stored zone is not in the list above must still see
 * something sensible rather than an empty dropdown, so the identifier is tidied:
 * `America/Port_of_Spain` → `America / Port of Spain`. Note the global replace —
 * the old code used `replace('_', ' ')`, which handles only the first.
 */
export function timezoneLabel(value: string): string {
  const known = TIMEZONES.find((zone) => zone.value === value)

  if (known) return known.label

  return value.replace(/_/g, ' ').replace('/', ' / ')
}

/**
 * The date formats, with a worked example as the LABEL.
 *
 * It was the other way round — `dd/mm/yyyy — 09/02/2026`, token first. But
 * nobody picks a date format by parsing `dd/mm/yyyy`; they pick it by seeing
 * which of three dates looks like the one they write. So the example leads and
 * the token, which is what an administrator would quote in a support message,
 * follows in brackets.
 *
 * The 9th of February is chosen on purpose: day and month differ, so
 * `09/02/2026` and `02/09/2026` are visibly different. A date like 05/05 would
 * make two of the three options look identical.
 */
export function dateFormatOptions(formats: string[]): LabelledOption[] {
  const SAMPLES: Record<string, string> = {
    'dd/mm/yyyy': '09/02/2026',
    'mm/dd/yyyy': '02/09/2026',
    'yyyy-mm-dd': '2026-02-09',
  }

  const NAMES: Record<string, string> = {
    'dd/mm/yyyy': 'day/month/year',
    'mm/dd/yyyy': 'month/day/year',
    'yyyy-mm-dd': 'year-month-day',
  }

  return formats.map((format) => ({
    value: format,
    label: SAMPLES[format]
      ? `${SAMPLES[format]}  (${NAMES[format] ?? format})`
      : format,
  }))
}

/**
 * The number formats, named rather than shown raw.
 *
 * The stored values ARE samples — `1,23,456.78` — which made them look like
 * placeholder text rather than a choice. The sample is still the useful part, so
 * it stays; what it gains is a name, because "Indian" and "1,23,456.78" mean the
 * same thing to different people.
 */
export function numberFormatOptions(formats: string[]): LabelledOption[] {
  const NAMES: Record<string, string> = {
    '1,23,456.78': 'Indian grouping',
    '123,456.78': 'Thousands with commas',
    '123.456,78': 'European — dots and a decimal comma',
  }

  return formats.map((format) => ({
    value: format,
    label: NAMES[format] ? `${format}  (${NAMES[format]})` : format,
  }))
}

/**
 * `LeaveRequest #4821` → `Leave request #4821`.
 *
 * The audit trail printed `entity_type` verbatim, and that value is a class name
 * or a table name straight out of the event stream. An auditor reading a record
 * of what changed should not have to know the schema to read it.
 *
 * Unrecognised types are de-camel-cased and lowercased rather than hidden, so a
 * new entity is readable the first time it appears rather than invisible.
 */
export function entityLabel(entityType: string): string {
  const NAMES: Record<string, string> = {
    hrms_emp_leave: 'Leave request',
    tbluser: 'Person',
    hrms_departments: 'Department',
    tbluserprofilemaster: 'Role',
    s_user_jobrole: 'Job role',
    g2g_task: 'Task',
    evidence: 'Evidence',
  }

  if (NAMES[entityType]) return NAMES[entityType]

  const spaced = entityType
    .replace(/^(tbl|hrms_|g2g_|s_)/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[._]/g, ' ')
    .trim()

  if (!spaced) return entityType

  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}
