'use client'

import * as React from 'react'
import { AlertTriangle, Check, Clock, History, Send, Undo2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { GtgPageHeader } from '@/components/shell/gtg-page-header'
import {
  AttendanceGrid,
  emptySchedule,
} from '@/domain/organization/employee-directory-parts/attendance-grid'
import { useMyOfficeHours } from '@/hooks/use-my-office-hours'
import { DepartmentTemplateCompare } from './department-template-compare'
import { cn } from '@/lib/utils'
import type { ScheduleEntry, WorkingDay } from '@/services/organization/employee-directory'
import type { OfficeHoursDay } from '@/services/hrms'

/**
 * My office hours - an employee proposing their own working days and times.
 *
 * ── NOTHING HERE CHANGES PAY, AND THAT IS THE DESIGN ────────────────────────
 *
 * These are the 21 `tbluser` roster columns, and they are a payroll input:
 * PayrollController reads `saturday_in_date` when counting 2nd-Saturday
 * lateness, which is subtracted from payable days. So an employee writing them
 * directly would be an employee adjusting an input to their own pay.
 *
 * This screen therefore submits a REQUEST. Only an HR approval writes the
 * columns, and the screen says so rather than letting somebody discover it.
 *
 * ── THE EDITOR IS REUSED, NOT REBUILT ──────────────────────────────────────
 *
 * `AttendanceGrid` already edits a working week and is already good - it is
 * per-day because the data is per-day, and its own docblock records why: on
 * live, **Saturday's out-time differs from Monday's for 202 of the 216
 * employees who have any**. This screen is its third caller, alongside the
 * add-employee wizard and the directory's Personal Information tab. A second
 * editor would drift, and the half that drifted would be the one with no
 * explanation attached.
 *
 * The two things it does not do - compare against the department template, and
 * seed from something real rather than a guess - are added AROUND it rather
 * than inside it, so neither existing caller changes.
 */
export default function MyOfficeHoursPage() {
  const {
    current, template, hasSchedule, departmentName, pending, history,
    isLoading, isSaving, error, notice, setError, setNotice,
    submit, withdraw,
  } = useMyOfficeHours()

  const [draft, setDraft] = React.useState<ScheduleEntry[] | null>(null)
  const [reason, setReason] = React.useState('')
  const [localError, setLocalError] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState(false)

  /**
   * What the grid starts from, and it is labelled rather than silently chosen.
   *
   * `emptySchedule()` defaults to Mon-Fri 09:00-18:00, which is a GUESS - and
   * this module's whole position is not to guess about a roster. So the seed is
   *: the employee's own recorded hours, else their department's template, else
   * empty - and the screen says which was used, because starting from a
   * department's hours and starting from nothing look identical once the form
   * is filled in.
   */
  const seed = React.useMemo<{ entries: ScheduleEntry[]; from: 'mine' | 'department' | 'blank' }>(() => {
    if (hasSchedule && current.length > 0) {
      return { entries: current.map(toEntry), from: 'mine' }
    }
    if (template && template.length > 0) {
      return { entries: template.map(toEntry), from: 'department' }
    }
    return { entries: emptySchedule(), from: 'blank' }
  }, [current, template, hasSchedule])

  const week = draft ?? seed.entries

  const copyTemplate = () => {
    if (!template) return
    setDraft(template.map(toEntry))
  }

  /**
   * Only the weekdays that actually differ from what is recorded are sent.
   *
   * A weekday left out is left exactly as it is - which is why the server
   * stores a row per weekday rather than 21 columns. Sending all seven would
   * make the employee the author of days they never thought about, and the
   * approval would then stamp provenance on those days too, which later stops a
   * department apply touching them.
   */
  const changedDays = React.useMemo(() => {
    const byDay = new Map(current.map((day) => [day.weekday, day]))

    return week.filter((entry) => {
      const now = byDay.get(entry.day as OfficeHoursDay['weekday'])
      if (!now) return true
      const sameWorking = (now.is_working === true) === entry.working
      const sameIn = (now.in_time ?? null) === (entry.in_time ?? null)
      const sameOut = (now.out_time ?? null) === (entry.out_time ?? null)
      return !(sameWorking && sameIn && sameOut)
    })
  }, [week, current])

  const send = async () => {
    setLocalError(null)

    if (changedDays.length === 0) {
      setLocalError('Nothing has changed yet, so there is nothing to ask for.')
      return
    }
    if (!week.some((entry) => entry.working)) {
      setLocalError('Pick at least one working day.')
      return
    }
    for (const entry of changedDays) {
      if (entry.working && entry.in_time && entry.out_time && entry.out_time <= entry.in_time) {
        setLocalError(`${label(entry.day)}: the finish time has to be after the start time.`)
        return
      }
    }
    if (!reason.trim()) {
      setLocalError('Say why — whoever reviews this needs to know.')
      return
    }

    const ok = await submit({
      week: changedDays.map((entry) => ({
        weekday: entry.day,
        is_working: entry.working,
        in_time: entry.working ? entry.in_time : null,
        out_time: entry.working ? entry.out_time : null,
      })),
      reason: reason.trim(),
    })

    if (ok) {
      setReason('')
      setDraft(null)
      setEditing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <GtgPageHeader
        title="My office hours"
        description="The days and times you are expected to work. Ask for a change here and HR will review it."
      />

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={() => setError(null)}>Dismiss</Button>
          </AlertDescription>
        </Alert>
      )}

      {notice && (
        <Alert className="border-emerald-500/40 bg-emerald-500/10">
          <Check className="size-4 text-emerald-600" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span className="text-emerald-800 dark:text-emerald-200">{notice}</span>
            <Button variant="ghost" size="sm" onClick={() => setNotice(null)}>Dismiss</Button>
          </AlertDescription>
        </Alert>
      )}

      {/* ── pending ───────────────────────────────────────────────────── */}
      {pending && (
        <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium text-sky-900 dark:text-sky-200">
                You have a change waiting for review
              </p>
              <p className="mt-0.5 text-sm text-sky-800/80 dark:text-sky-200/80">
                Asked {pending.submitted_at?.slice(0, 10)} &mdash; &ldquo;{pending.reason}&rdquo;
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void withdraw(pending.id)}
              disabled={isSaving}
            >
              <Undo2 className="mr-2 size-4" />
              Withdraw
            </Button>
          </div>

          <WeekDiff week={pending.week} current={pending.current_week} className="mt-3" />

          <p className="mt-2 text-xs text-sky-800/80 dark:text-sky-200/80">
            Your hours have not changed yet. They change only if this is approved.
          </p>
        </div>
      )}

      {/* ── the most recent decision ──────────────────────────────────── */}
      {!pending && history[0] && (
        <div
          className={cn(
            'rounded-xl border p-4',
            history[0].status === 'approved'
              ? 'border-emerald-500/40 bg-emerald-500/10'
              : 'border-rose-500/40 bg-rose-500/10',
          )}
        >
          <p
            className={cn(
              'font-medium',
              history[0].status === 'approved'
                ? 'text-emerald-900 dark:text-emerald-200'
                : 'text-rose-900 dark:text-rose-200',
            )}
          >
            {history[0].status === 'approved'
              ? `Applied${history[0].applied_at ? ' on ' + history[0].applied_at.slice(0, 10) : ''}${history[0].reviewed_by_name ? ' by ' + history[0].reviewed_by_name : ''}`
              : `Not approved${history[0].reviewed_by_name ? ' by ' + history[0].reviewed_by_name : ''}`}
          </p>
          {history[0].reviewer_comment && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              &ldquo;{history[0].reviewer_comment}&rdquo;
            </p>
          )}
          {history[0].status === 'approved' && (
            <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-200/80">
              Your office hours decide what counts as late and what counts as a full day, so this
              affects your attendance records and payable days.
            </p>
          )}
        </div>
      )}

      {/* ── nobody has set your hours at all ──────────────────────────── */}
      {hasSchedule === false && (
        <Alert className="border-amber-500/40 bg-amber-500/10">
          <AlertTriangle className="size-4 text-amber-600" />
          <AlertDescription className="text-amber-900 dark:text-amber-200">
            <strong>Nobody has recorded which days you work.</strong> Until somebody does, lateness
            and absence cannot be calculated for you, and the attendance screens each fall back
            differently. You can ask for your hours to be set below.
          </AlertDescription>
        </Alert>
      )}

      {/* ── the week ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground">
              {pending ? 'Your hours as they stand' : 'Your working week'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {seed.from === 'mine'
                ? 'These are your recorded hours.'
                : seed.from === 'department'
                  ? `Nothing is recorded for you yet — this starts from ${departmentName ?? 'your department'}'s hours.`
                  : 'Nothing is recorded for you, and your department has no hours set either — this starts blank.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!pending && !editing && (
              <Button size="sm" onClick={() => setEditing(true)}>
                <Clock className="mr-2 size-4" />
                Ask for a change
              </Button>
            )}
          </div>
        </div>

        {/*
          * The editor and the department's week, side by side.
          *
          * The comparison sits BESIDE the grid rather than inside it, so the
          * shared editor gains no props and its two other callers do not
          * change. The strip's only power is to call the same `onChange` the
          * grid calls.
          */}
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <AttendanceGrid
              value={week}
              onChange={setDraft}
              // Read-only unless they have asked to change it, and always while
              // something is pending - editing a week whose fate is undecided
              // would be editing a copy.
              disabled={!editing || !!pending || isSaving}
            />
          </div>

          <div className="lg:w-64 lg:shrink-0">
            <DepartmentTemplateCompare
              template={template}
              week={week}
              departmentName={departmentName}
              onCopy={copyTemplate}
              disabled={!editing || !!pending || isSaving}
            />
          </div>
        </div>

        {editing && !pending && (
          <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
            {changedDays.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Asking to change{' '}
                <strong className="text-foreground">
                  {changedDays.map((entry) => label(entry.day)).join(', ')}
                </strong>
                . Days you have not changed are left exactly as they are.
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="moh-reason">
                Why <span className="text-destructive">*</span>
              </Label>
              <Input
                id="moh-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="I collect my child on Thursdays…"
                maxLength={255}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              This is a request. Your hours do not change until HR approves it, and approving it
              affects what counts as late and what counts as a full day &mdash; including for days
              already past.
            </p>

            {localError && (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertDescription>{localError}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void send()} disabled={isSaving}>
                <Send className="mr-2 size-4" />
                {isSaving ? 'Sending…' : 'Send for approval'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setDraft(null)
                  setReason('')
                  setLocalError(null)
                  setEditing(false)
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── previous requests ─────────────────────────────────────────── */}
      {history.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <History className="size-4" aria-hidden="true" />
            Previous requests
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {history.map((row) => (
              <li key={row.id} className="flex flex-wrap items-baseline gap-2 text-sm">
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-xs font-medium',
                    row.status === 'approved'
                      ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
                      : 'bg-rose-500/15 text-rose-800 dark:text-rose-200',
                  )}
                >
                  {row.status === 'approved' ? 'Approved' : 'Not approved'}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {row.submitted_at?.slice(0, 10)}
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground">{row.reason}</span>
                {row.reviewer_comment && (
                  <span className="text-xs text-muted-foreground">
                    &ldquo;{row.reviewer_comment}&rdquo;
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ========================================================================== */

function label(day: string) {
  return day.charAt(0).toUpperCase() + day.slice(1)
}

/** OfficeHoursDay to the shared grid's ScheduleEntry. */
function toEntry(day: OfficeHoursDay): ScheduleEntry {
  return {
    day: day.weekday as WorkingDay,
    // null means never set, and the grid has no third state - false is the
    // honest rendering of "not recorded as a working day".
    working: day.is_working === true,
    in_time: day.in_time,
    out_time: day.out_time,
  }
}

/** Current vs requested, for a pending or decided request. */
function WeekDiff({
  week, current, className,
}: {
  week: OfficeHoursDay[]
  current: OfficeHoursDay[]
  className?: string
}) {
  const byDay = new Map(current.map((day) => [day.weekday, day]))

  const show = (day: OfficeHoursDay | null | undefined) => {
    if (!day) return '—'
    if (day.is_working === null) return 'not set'
    if (!day.is_working) return 'not worked'
    if (!day.in_time && !day.out_time) return 'worked, no hours'
    return `${day.in_time ?? '--:--'}–${day.out_time ?? '--:--'}`
  }

  return (
    <div className={cn('overflow-x-auto rounded border border-border bg-card', className)}>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th scope="col" className="px-2 py-1.5 font-semibold">Day</th>
            <th scope="col" className="px-2 py-1.5 font-semibold">Now</th>
            <th scope="col" className="px-2 py-1.5 font-semibold">You asked for</th>
          </tr>
        </thead>
        <tbody>
          {week.map((day) => (
            <tr key={day.weekday} className="border-b border-border last:border-0">
              <td className="px-2 py-1.5 font-medium text-foreground">{label(day.weekday)}</td>
              <td className="px-2 py-1.5 tabular-nums text-muted-foreground">
                {show(byDay.get(day.weekday))}
              </td>
              <td className="px-2 py-1.5 font-medium tabular-nums text-primary">{show(day)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
