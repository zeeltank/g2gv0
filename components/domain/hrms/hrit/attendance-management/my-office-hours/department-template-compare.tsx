'use client'

import * as React from 'react'
import { Building2, Copy, Minus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ScheduleEntry } from '@/services/organization/employee-directory'
import type { OfficeHoursDay } from '@/services/hrms'

const ORDER = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
] as const

const SHORT: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}

/**
 * The department's own hours, shown BESIDE the editor rather than inside it.
 *
 * ── WHY IT IS A SEPARATE COMPONENT AND NOT A PROP ON THE GRID ───────────────
 *
 * `AttendanceGrid` has two existing callers - the add-employee wizard and the
 * directory's Personal Information tab - and neither has a department template
 * to compare against. Adding an optional `template` prop would put a branch
 * inside the shared editor for the benefit of exactly one of its three callers,
 * and the comparison would then have to be maintained in the place where a
 * mistake breaks all three screens.
 *
 * Here it is additive: the grid is untouched, and the only way this component
 * changes anything is by calling the SAME `onChange` the grid calls.
 *
 * ── WHAT IT IS ACTUALLY FOR ─────────────────────────────────────────────────
 *
 * An employee asking for different hours is, in practice, asking to differ from
 * their department - so "how am I different" is the question, and answering it
 * needs both weeks visible at once. The `differs` dot is the answer per day; the
 * copy button is the escape hatch for the common case, which is somebody whose
 * hours were simply never set and who wants their team's.
 *
 * Saturday is why this is per-day and not a range: on live, Saturday's out-time
 * differs from Monday's for 202 of the 216 employees who have any hours at all.
 * A single "9 to 6, Mon-Fri" summary would be wrong for almost everybody.
 */
export function DepartmentTemplateCompare({
  template, week, departmentName, onCopy, disabled,
}: {
  /** The department's week, or null when the department has no hours set. */
  template: OfficeHoursDay[] | null
  /** The week currently in the editor, so each row can say whether it differs. */
  week: ScheduleEntry[]
  departmentName?: string | null
  /** Replaces the editor's whole week with the template. */
  onCopy: () => void
  disabled?: boolean
}) {
  const rows = React.useMemo(() => {
    const templateByDay = new Map((template ?? []).map((day) => [day.weekday, day]))
    const draftByDay = new Map(week.map((entry) => [entry.day as string, entry]))

    return ORDER.map((weekday) => {
      const t = templateByDay.get(weekday) ?? null
      const mine = draftByDay.get(weekday) ?? null

      // No template row means the department never set this day - there is
      // nothing to differ FROM, so the row is not marked as a difference.
      const differs =
        t !== null && mine !== null &&
        ((t.is_working === true) !== mine.working ||
          (t.in_time ?? null) !== (mine.in_time ?? null) ||
          (t.out_time ?? null) !== (mine.out_time ?? null))

      return { weekday, template: t, differs }
    })
  }, [template, week])

  const differences = rows.filter((row) => row.differs).length

  if (!template || template.length === 0) {
    return (
      <aside className="rounded-xl border border-dashed border-border bg-muted/20 p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Building2 className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            {departmentName ?? 'Your department'}
          </h3>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          No hours have been set for your department, so there is nothing to compare against.
          What you enter stands on its own.
        </p>
      </aside>
    )
  }

  return (
    <aside className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4 shadow-sm">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Building2 className="size-4 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {departmentName ?? 'Your department'}&apos;s hours
          </h3>
          <p className="text-xs text-muted-foreground">
            {differences === 0
              ? 'Your week matches it exactly.'
              : `You differ on ${differences} ${differences === 1 ? 'day' : 'days'}.`}
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-1">
        {rows.map(({ weekday, template: day, differs }) => (
          <li
            key={weekday}
            className={cn(
              'flex items-center justify-between gap-2 rounded px-2 py-1 text-xs',
              differs && 'bg-amber-500/10',
            )}
          >
            <span className="flex items-center gap-1.5">
              {/*
                * A dot AND a changed background - two channels, so the marker
                * survives greyscale printing and colour blindness.
                */}
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  differs ? 'bg-amber-500' : 'bg-transparent',
                )}
                aria-hidden="true"
              />
              <span className={cn('font-medium', differs ? 'text-foreground' : 'text-muted-foreground')}>
                {SHORT[weekday]}
              </span>
            </span>

            <span className="tabular-nums text-muted-foreground">
              {day?.is_working === false ? (
                <span className="flex items-center gap-1 text-muted-foreground/60">
                  <Minus className="size-3" aria-hidden="true" />
                  <span className="sr-only">Not a working day</span>
                </span>
              ) : day?.in_time || day?.out_time ? (
                `${day.in_time ?? '--:--'}–${day.out_time ?? '--:--'}`
              ) : (
                'not set'
              )}
            </span>

            {differs && <span className="sr-only">differs from your week</span>}
          </li>
        ))}
      </ul>

      {/*
        * Calls the editor's own onChange and nothing else - no second write
        * path, and no request is sent by pressing this.
        */}
      <Button variant="outline" size="sm" onClick={onCopy} disabled={disabled}>
        <Copy className="mr-2 size-4" />
        Use these hours
      </Button>
      <p className="text-[11px] leading-snug text-muted-foreground">
        This only fills in the form. Nothing is sent until you ask for approval.
      </p>
      {/*
        * THE CONSEQUENCE NOBODY WOULD GUESS, SAID WHERE THE CHOICE IS MADE.
        *
        * An approved request stamps `employee_request` provenance on every
        * weekday it wrote, and a department Apply then SKIPS those days by
        * default (`RosterProvenance::isEmployeeSet`). So an employee who copies
        * their department's week and submits it unchanged - the obvious thing
        * to do when you have no hours at all - ends up permanently excluded
        * from the department's future updates, having asked for the
        * department's hours.
        *
        * The fourth-bucket behaviour is correct and deliberate; what would be
        * wrong is for this to be a surprise. It is one sentence here rather
        * than a special case in the submit logic, because the behaviour is not
        * the defect - the silence was.
        */}
      <p className="text-[11px] leading-snug text-muted-foreground">
        Once hours are yours, changes your department makes later will not
        overwrite them unless HR chooses to.
      </p>
    </aside>
  )
}
