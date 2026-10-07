'use client'

import * as React from 'react'
import {
  AlertTriangle,
  Building2,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Save,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  useDepartmentSchedules,
  copyAcrossWeek,
  WEEKEND,
} from '@/hooks/use-department-schedules'
import { cn } from '@/lib/utils'
import type {
  DepartmentSchedule,
  DepartmentScheduleDay,
  SchedulePreviewResponse,
} from '@/services/hrms'

/**
 * Office hours, per department, applied day by day.
 *
 * ── WHAT THIS IS WRITING TO ─────────────────────────────────────────────────
 *
 * There is no office-hours table in this product. Hours live as fourteen `time`
 * columns on `tbluser`, per employee per day, plus seven flags saying which
 * days are worked. `hrms_in_out_times` exists, is empty and is read by nothing;
 * `tenant_setting['org.working_days']` is written by a settings screen and read
 * by no attendance code at all.
 *
 * So this screen keeps a department TEMPLATE and applies it onto those employee
 * columns. Nothing downstream has to change, and an employee whose hours
 * genuinely differ keeps them until somebody applies over them deliberately.
 *
 * ── WHY SAVE AND APPLY ARE TWO BUTTONS ──────────────────────────────────────
 *
 * The previous version of this feature was REMOVED because a bulk shift write
 * silently flattened Saturday across a department. 100 employees in one tenant
 * have a Saturday that finishes at 14:00; a blanket 09:00-18:00 wiped it with
 * no record and no warning.
 *
 * Save writes the template and touches nobody. Apply asks the server what it
 * would change, shows the number of employees who hold DIFFERENT hours, and
 * waits. Saturday and Sunday are never swept into a copy-forward or an apply
 * unless they are ticked.
 */
export function OfficeHoursTab() {
  const {
    schedules, isLoading, isSaving, error, notice, setError, setNotice,
    save, preview, apply,
  } = useDepartmentSchedules()

  const [openId, setOpenId] = React.useState<number | null>(null)
  const [drafts, setDrafts] = React.useState<Record<number, DepartmentScheduleDay[]>>({})
  const [pending, setPending] = React.useState<{
    department: DepartmentSchedule
    weekdays: string[]
    result: SchedulePreviewResponse
  } | null>(null)

  const draftFor = (department: DepartmentSchedule) =>
    drafts[department.department_id] ?? department.week

  const setDraft = (departmentId: number, week: DepartmentScheduleDay[]) =>
    setDrafts((current) => ({ ...current, [departmentId]: week }))

  const neverSet = schedules.filter((entry) => !entry.has_schedule)
  const employeesWithoutSchedule = neverSet.reduce((sum, entry) => sum + entry.employee_count, 0)

  const startApply = async (department: DepartmentSchedule, weekdays: string[]) => {
    const result = await preview(department.department_id, weekdays)
    if (result) setPending({ department, weekdays, result })
  }

  return (
    <div className="flex flex-col gap-4">
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

      <Alert>
        <Clock className="size-4" />
        <AlertDescription className="text-sm">
          Setting hours here saves a template for the department. It changes nothing for anybody
          until you press <strong>Apply</strong> on the days you want written &mdash; and Apply
          shows you how many employees already have different hours before it does.
          {/*
            * The per-employee half of "per department, then per employee".
            *
            * That editor already exists and is already good - attendance-grid.tsx,
            * rendered by the add-employee sheet and the edit-employee Personal Info
            * tab. It is NOT duplicated here: one grid with two callers cannot drift,
            * two grids will. What was missing is that somebody standing on this
            * screen, looking at an employee whose Saturday differs, has no way of
            * knowing where to go. So this says where.
            */}
          <span className="mt-1.5 block text-muted-foreground">
            To set one person&apos;s hours differently from their department, edit them in
            <strong> Employee Directory</strong> &rarr; the employee &rarr;{' '}
            <strong>Personal Info</strong>, where the day-by-day grid lives. Applying a department
            template over them replaces those hours, which is what the count on the confirmation
            is warning you about.
          </span>
        </AlertDescription>
      </Alert>

      {/* The 88%, from the department side. */}
      {!isLoading && employeesWithoutSchedule > 0 && (
        <Alert className="border-amber-500/40 bg-amber-500/10">
          <AlertTriangle className="size-4 text-amber-600" />
          <AlertDescription className="text-amber-900 dark:text-amber-200">
            <strong>
              {neverSet.length} {neverSet.length === 1 ? 'department has' : 'departments have'} no
              office hours set, covering {employeesWithoutSchedule}{' '}
              {employeesWithoutSchedule === 1 ? 'employee' : 'employees'}.
            </strong>{' '}
            Without hours, lateness and absence cannot be calculated for them, and the attendance
            screens each fall back differently &mdash; one reads every day as a weekend, another
            reads Monday to Saturday as worked.
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <Building2 className="mx-auto mb-4 size-10 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-base font-semibold text-foreground">No departments yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Office hours are set per department. Create a department under Organizational
            Management first, then set its week here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {schedules.map((department) => (
            <DepartmentCard
              key={department.department_id}
              department={department}
              week={draftFor(department)}
              isOpen={openId === department.department_id}
              isSaving={isSaving}
              onToggle={() =>
                setOpenId(openId === department.department_id ? null : department.department_id)
              }
              onChange={(week) => setDraft(department.department_id, week)}
              onSave={async () => {
                const ok = await save(department.department_id, draftFor(department))
                if (ok) {
                  setDrafts((current) => {
                    const next = { ...current }
                    delete next[department.department_id]
                    return next
                  })
                }
              }}
              onApply={(weekdays) => void startApply(department, weekdays)}
            />
          ))}
        </div>
      )}

      {pending && (
        <ApplyConfirmation
          department={pending.department}
          weekdays={pending.weekdays}
          result={pending.result}
          isSaving={isSaving}
          onCancel={() => setPending(null)}
          onConfirm={async () => {
            const ok = await apply(pending.department.department_id, pending.weekdays)
            if (ok) setPending(null)
          }}
        />
      )}
    </div>
  )
}

/* ========================================================================== */

const LABEL: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
}

function DepartmentCard({
  department, week, isOpen, isSaving, onToggle, onChange, onSave, onApply,
}: {
  department: DepartmentSchedule
  week: DepartmentScheduleDay[]
  isOpen: boolean
  isSaving: boolean
  onToggle: () => void
  onChange: (week: DepartmentScheduleDay[]) => void
  onSave: () => Promise<void>
  onApply: (weekdays: string[]) => void
}) {
  const [copyWeekend, setCopyWeekend] = React.useState(false)
  const [selected, setSelected] = React.useState<string[]>([])

  const dirty = week !== department.week

  // Only days that are actually saved can be applied — the server refuses a
  // weekday with no stored hours, and offering it here would turn a reasonable
  // refusal into a confusing one.
  const applicable = department.week
    .filter((day) => day.is_working !== null)
    .map((day) => day.weekday)

  const setDay = (weekday: string, patch: Partial<DepartmentScheduleDay>) =>
    onChange(week.map((day) => (day.weekday === weekday ? { ...day, ...patch } : day)))

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="min-w-0">
          <span className="block truncate font-medium text-foreground">
            {department.department_name}
          </span>
          <span className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="size-3" aria-hidden="true" />
              {department.employee_count} {department.employee_count === 1 ? 'employee' : 'employees'}
            </span>
            {department.has_schedule ? (
              <span className="tabular-nums">
                {summarise(department.week)}
              </span>
            ) : (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-800 dark:text-amber-200">
                No hours set
              </span>
            )}
          </span>
        </div>
        <ChevronDown className={cn('size-5 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="border-t border-border px-4 py-4">
          <div className="flex flex-col gap-2">
            {week.map((day) => {
              const isWeekend = WEEKEND.includes(day.weekday)
              return (
                <div
                  key={day.weekday}
                  className={cn(
                    'grid items-center gap-3 rounded-lg border border-border px-3 py-2 sm:grid-cols-[130px_auto_1fr_1fr]',
                    isWeekend && 'bg-muted/40',
                  )}
                >
                  <span className="text-sm font-medium text-foreground">
                    {LABEL[day.weekday]}
                    {isWeekend && (
                      <span className="ml-1 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                        weekend
                      </span>
                    )}
                  </span>

                  <div className="flex items-center gap-2">
                    <Switch
                      id={`oh-${department.department_id}-${day.weekday}`}
                      checked={day.is_working === true}
                      // onChange, not onCheckedChange: ui/switch wraps a native
                      // checkbox. ui/checkbox is the one with onCheckedChange.
                      onChange={(event) => setDay(day.weekday, { is_working: event.target.checked })}
                    />
                    <Label
                      htmlFor={`oh-${department.department_id}-${day.weekday}`}
                      className="text-xs text-muted-foreground"
                    >
                      {day.is_working === true ? 'Worked' : day.is_working === false ? 'Not worked' : 'Not set'}
                    </Label>
                  </div>

                  <Input
                    type="time"
                    aria-label={`${LABEL[day.weekday]} opening time`}
                    value={day.in_time ?? ''}
                    disabled={day.is_working !== true}
                    onChange={(event) => setDay(day.weekday, { in_time: event.target.value || null })}
                  />
                  <Input
                    type="time"
                    aria-label={`${LABEL[day.weekday]} closing time`}
                    value={day.out_time ?? ''}
                    disabled={day.is_working !== true}
                    onChange={(event) => setDay(day.weekday, { out_time: event.target.value || null })}
                  />
                </div>
              )
            })}
          </div>

          {/* The copy-forward, with the weekend held back. */}
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onChange(copyAcrossWeek(week, 'monday', copyWeekend))}
            >
              <Copy className="mr-2 size-4" />
              Copy Monday to the rest of the week
            </Button>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={copyWeekend}
                onCheckedChange={(checked) => setCopyWeekend(checked === true)}
              />
              Include Saturday and Sunday
            </label>
            <span className="text-xs text-muted-foreground">
              Left unticked, the weekend keeps its own hours &mdash; Saturday is the day that
              usually differs.
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <Button onClick={() => void onSave()} disabled={isSaving || !dirty}>
                <Save className="mr-2 size-4" />
                {isSaving ? 'Saving…' : 'Save hours'}
              </Button>
              {dirty && (
                <span className="text-xs text-amber-700 dark:text-amber-300">
                  Unsaved changes &mdash; save before applying.
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {applicable.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  Save the week before applying it to employees.
                </span>
              ) : (
                <>
                  <span className="text-xs text-muted-foreground">Apply to employees:</span>
                  {applicable.map((weekday) => (
                    <label
                      key={weekday}
                      className="flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs"
                    >
                      <Checkbox
                        checked={selected.includes(weekday)}
                        onCheckedChange={(checked) =>
                          setSelected((current) =>
                            checked === true
                              ? [...current, weekday]
                              : current.filter((entry) => entry !== weekday),
                          )
                        }
                      />
                      {LABEL[weekday].slice(0, 3)}
                    </label>
                  ))}
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={selected.length === 0 || dirty}
                    onClick={() => onApply(selected)}
                  >
                    Apply {selected.length > 0 ? `${selected.length} ${selected.length === 1 ? 'day' : 'days'}` : ''}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** "Mon–Fri 09:30–18:30, Sat 09:30–13:30" in as few characters as it takes. */
function summarise(week: DepartmentScheduleDay[]) {
  const working = week.filter((day) => day.is_working === true && day.in_time && day.out_time)
  if (working.length === 0) return 'no working days set'

  const first = working[0]
  const uniform = working.every((day) => day.in_time === first.in_time && day.out_time === first.out_time)

  if (uniform) {
    return `${working.length} ${working.length === 1 ? 'day' : 'days'} · ${first.in_time}–${first.out_time}`
  }

  return `${working.length} days · hours vary by day`
}

/* ========================================================================== */

/**
 * The confirmation that the deleted version of this feature did not have.
 *
 * `would_change` is the number this dialog exists to show: employees who hold
 * hours somebody chose, which this apply would overwrite. "40 match, 0 differ"
 * is a safe apply. "40 match, 12 differ" means twelve people have a reason, and
 * flattening them silently is what got that version removed.
 */
function ApplyConfirmation({
  department, weekdays, result, isSaving, onCancel, onConfirm,
}: {
  department: DepartmentSchedule
  weekdays: string[]
  result: SchedulePreviewResponse
  isSaving: boolean
  onCancel: () => void
  onConfirm: () => Promise<void>
}) {
  const { data } = result
  const overwriting = data.total_would_change

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Apply these hours to {department.department_name}?</DialogTitle>
          <DialogDescription>
            {data.employees} active {data.employees === 1 ? 'employee' : 'employees'} in this
            department, {weekdays.length} {weekdays.length === 1 ? 'day' : 'days'} selected.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-3 py-2 font-semibold">Day</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Hours</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Already match</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Would be set</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Would be overwritten</th>
                </tr>
              </thead>
              <tbody>
                {data.per_weekday.map((row) => (
                  <tr key={row.weekday} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium text-foreground">
                      {LABEL[row.weekday] ?? row.weekday}
                      {row.is_weekend && (
                        <span className="ml-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                          weekend
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                      {row.is_working ? (row.in_time && row.out_time ? `${row.in_time}–${row.out_time}` : 'worked, no hours') : 'not worked'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {row.already_match}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {row.would_set}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right font-medium tabular-nums',
                        row.would_change > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground',
                      )}
                    >
                      {row.would_change}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {overwriting > 0 ? (
            <Alert className="border-amber-500/40 bg-amber-500/10">
              <AlertTriangle className="size-4 text-amber-600" />
              <AlertDescription className="text-amber-900 dark:text-amber-200">
                <strong>
                  {overwriting} {overwriting === 1 ? 'employee already has' : 'employees already have'}{' '}
                  different hours on {overwriting === 1 ? 'that day' : 'those days'}.
                </strong>{' '}
                Applying replaces them. If some of those hours were set deliberately &mdash; a
                shorter Saturday, for instance &mdash; untick that day and set those employees
                individually instead. The original hours are kept in the change record either way.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <Check className="size-4" />
              <AlertDescription>
                Nobody in this department has different hours on the selected days
                {data.total_would_set > 0
                  ? `, and ${data.total_would_set} ${data.total_would_set === 1 ? 'employee has' : 'employees have'} none set yet.`
                  : '.'}
              </AlertDescription>
            </Alert>
          )}

          {data.includes_weekend.length > 0 && (
            <p className="text-xs text-muted-foreground">
              This includes {data.includes_weekend.map((day) => LABEL[day] ?? day).join(' and ')}.
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Office hours decide what counts as late and what counts as a full day, so this can
            change payable days on future payroll runs.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={() => void onConfirm()}
            disabled={isSaving || data.employees_touched === 0}
            variant={overwriting > 0 ? 'destructive' : 'default'}
          >
            {isSaving
              ? 'Applying…'
              : data.employees_touched === 0
                ? 'Nothing to change'
                : `Apply to ${data.employees_touched} ${data.employees_touched === 1 ? 'employee' : 'employees'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
