'use client'

import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { TimePicker } from '@/components/ui/time-picker'
import { cn } from '@/lib/utils'
import { WORKING_DAYS, type ScheduleEntry, type WorkingDay } from '@/services/organization/employee-directory'

/**
 * The working week, one row per day.
 *
 * PER-DAY IS NOT A FLOURISH, IT IS WHAT THE DATA SAYS. tbluser stores
 * monday..sunday plus a <day>_in_date / <day>_out_date pair for each, and on
 * live those pairs genuinely differ: Monday-to-Friday in-times are identical
 * for 215 of the 216 employees who have any, but **Saturday's out-time differs
 * from Monday's for 202 of them** - half-days are the norm here. A single
 * shift applied to every ticked day would quietly erase that for almost
 * everyone.
 *
 * It also matters more than it looks: monday_in_date is the threshold both
 * AttendanceDashboardApiController and AttendanceApiController compare a punch
 * against to decide whether someone was late. A wrong default here produces
 * wrong lateness reports.
 *
 * Both places that edit a schedule use this - the Add wizard's last step and
 * the drawer's Personal Information tab - so they cannot drift apart.
 */

const WEEKDAYS: WorkingDay[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']

export function emptySchedule(): ScheduleEntry[] {
  return WORKING_DAYS.map((day) => ({
    day,
    working: WEEKDAYS.includes(day),
    in_time: WEEKDAYS.includes(day) ? '09:00' : null,
    out_time: WEEKDAYS.includes(day) ? '18:00' : null,
  }))
}

/** Read a saved employee row back into the grid's shape. */
export function scheduleFromEmployee(row: Record<string, any> | null | undefined): ScheduleEntry[] {
  if (!row) return emptySchedule()

  return WORKING_DAYS.map((day) => {
    const working = Number(row[day]) === 1
    // TIME columns come back as "HH:mm:ss"; the picker speaks "HH:mm".
    const trim = (value: unknown) => {
      const text = String(value ?? '').trim()
      return text ? text.slice(0, 5) : null
    }
    return {
      day,
      working,
      in_time: working ? trim(row[`${day}_in_date`]) : null,
      out_time: working ? trim(row[`${day}_out_date`]) : null,
    }
  })
}

function label(day: WorkingDay) {
  return day.charAt(0).toUpperCase() + day.slice(1)
}

export function AttendanceGrid({
  value,
  onChange,
  disabled,
}: {
  value: ScheduleEntry[]
  onChange: (next: ScheduleEntry[]) => void
  disabled?: boolean
}) {
  function update(day: WorkingDay, patch: Partial<ScheduleEntry>) {
    onChange(value.map((entry) => (entry.day === day ? { ...entry, ...patch } : entry)))
  }

  /**
   * Monday's hours across Tuesday to Friday - weekdays only.
   *
   * Deliberately never Saturday: that is the day whose hours actually differ,
   * and a button that silently overwrote it would destroy the one thing this
   * grid exists to preserve.
   */
  function applyMondayToWeekdays() {
    const monday = value.find((entry) => entry.day === 'monday')
    if (!monday) return

    onChange(value.map((entry) =>
      entry.day !== 'monday' && WEEKDAYS.includes(entry.day)
        ? { ...entry, working: monday.working, in_time: monday.in_time, out_time: monday.out_time }
        : entry,
    ))
  }

  const workingDays = value.filter((entry) => entry.working).length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {workingDays === 0
            ? 'No working days set.'
            : `${workingDays} working day${workingDays === 1 ? '' : 's'}. Monday's start time is what attendance reports compare against for lateness.`}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={applyMondayToWeekdays} disabled={disabled}>
          <Copy className="mr-2 size-3.5" aria-hidden="true" />
          Apply Monday to Tue–Fri
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        {value.map((entry) => (
          <div
            key={entry.day}
            className={cn(
              'flex flex-wrap items-center gap-3 border-b border-border px-3 py-2 last:border-b-0',
              !entry.working && 'bg-muted/30',
            )}
          >
            <label className="flex w-32 shrink-0 cursor-pointer items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={entry.working}
                disabled={disabled}
                onCheckedChange={(working) => {
                  update(entry.day, {
                    working,
                    // Clearing the times on an off day keeps "not worked" and
                    // "worked, hours unknown" from looking the same in the row.
                    in_time: working ? entry.in_time ?? '09:00' : null,
                    out_time: working ? entry.out_time ?? '18:00' : null,
                  })
                }}
              />
              {label(entry.day)}
            </label>

            {entry.working ? (
              <div className="flex flex-wrap items-center gap-2">
                <TimePicker
                  value={entry.in_time ?? '09:00'}
                  onChange={(time) => update(entry.day, { in_time: time })}
                  disabled={disabled}
                />
                <span className="text-xs text-muted-foreground">to</span>
                <TimePicker
                  value={entry.out_time ?? '18:00'}
                  onChange={(time) => update(entry.day, { out_time: time })}
                  disabled={disabled}
                />
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Not a working day</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
