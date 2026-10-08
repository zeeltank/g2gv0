'use client'

import * as React from 'react'
import {
  AlertTriangle,
  CalendarClock,
  CalendarPlus,
  Check,
  Clock,
  ChevronLeft,
  ChevronRight,
  Download,
  ClipboardCheck,
  Users,
  History,
  Lock,
  Pencil,
  Printer,
  RefreshCw,
  Search,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { MonthPicker } from '@/components/ui/month-picker'
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
import { GtgPageHeader } from '@/components/shell/gtg-page-header'
import { csvText, downloadCsv } from '@/domain/hrms/hrit/payroll-management/shared/payroll-shell'
import { RegularisationQueue } from '@/domain/hrms/hrit/attendance-management/attendance-tracking/components/regularisation-queue'
import { OfficeHoursTab } from './office-hours'
import { useAttendanceAdmin } from '@/hooks/use-attendance-admin'
import { useAuth } from '@/hooks/use-auth'
import { HR_ADMIN_ROLES } from '@/types/role'
import { cn } from '@/lib/utils'
import type {
  AttendanceGridCell,
  AttendanceGridEmployee,
  AttendanceGridStatus,
} from '@/services/hrms'

/**
 * Manage Employee Attendance - the HR attendance desk.
 *
 * ── WHY THIS IS A SEPARATE SCREEN FROM ATTENDANCE TRACKING ──────────────────
 *
 * Attendance Tracking is an employee's own month: punch in, punch out, see
 * mine. This is everybody's, and it writes. They were asked for as separate
 * screens and they should be - a tab cannot express ownership. Everyone who can
 * open Tracking sees their own data; only admin/hr can open this one, and the
 * endpoint behind every cell refuses an employee outside the caller's
 * organisation.
 *
 * ── AN ATTENDANCE EDIT IS A PAY EDIT ────────────────────────────────────────
 *
 * `timestamp_diff` is read by PayrollController, and a corrected 2nd-Saturday
 * punch-in changes the late count that is SUBTRACTED from payable days. The
 * dialog says so where it is true rather than leaving it to be discovered at
 * payroll, and every change is recorded with its before-image and a required
 * reason.
 *
 * ── THE EMPTY CELL PROBLEM, SHOWN RATHER THAN GUESSED ───────────────────────
 *
 * 2,008 of 2,283 active employees have no roster at all - every weekday flag
 * 0. The two screens that already existed disagree about those people because
 * each invented its own fallback: Monthly Attendance Report reads every day as
 * a weekend, Attendance Tracking reads Mon-Sat as worked. Same employee, same
 * month, two answers, and neither is stated as an assumption.
 *
 * This grid renders a fourth state - "No roster set" - in its own colour, and
 * banners the count. It is the difference between telling HR someone has nine
 * absences and telling them nobody ever recorded which days that person works.
 */
export default function ManageEmployeeAttendancePage() {
  const { user } = useAuth()
  const {
    month, setMonth, monthLabel,
    departmentId, setDepartmentId, departments,
    search, setSearch,
    page, setPage, perPage, setPerPage,
    days, employees, meta,
    isLoading, error, notice, setNotice, setError,
    refresh,
    correct, correctMany, isSaving,
    edits, editsLoading, editsError, loadEdits,
  } = useAttendanceAdmin()

  const [tab, setTab] = React.useState<'grid' | 'history' | 'hours'>('grid')
  const [selected, setSelected] = React.useState<number[]>([])
  const [editing, setEditing] = React.useState<{
    employee: AttendanceGridEmployee
    date: string
    cell: AttendanceGridCell
  } | null>(null)

  /*
   * A hint, not the gate. The route carries profile:admin,hr and the controller
   * checks the subject's organisation on top of that (F-91). This panel exists
   * so somebody who reaches the URL gets an explanation instead of a grid that
   * fails with 403 and no reason.
   */
  const mayManage = !user || HR_ADMIN_ROLES.includes(user.role)

  React.useEffect(() => {
    if (tab === 'history') void loadEdits()
  }, [tab, loadEdits])

  /*
   * The selection, narrowed to who is actually on screen.
   *
   * DERIVED, not reset by an effect. Ticking three people, changing the
   * department filter and pressing the bulk action must not write to three
   * employees you are no longer looking at - and clearing the state in an
   * effect leaves exactly one render where it still could, besides being the
   * cascading-render pattern the linter flags. Intersecting at read time has no
   * such window: the moment the grid changes, those ids are not in `selected`
   * as far as anything downstream can tell.
   *
   * The raw state is kept rather than trimmed so that paging away and back
   * restores the ticks instead of silently dropping them.
   */
  const visible = React.useMemo(
    () => new Set(employees.map((employee) => employee.user_id)),
    [employees],
  )
  const effective = React.useMemo(
    () => selected.filter((userId) => visible.has(userId)),
    [selected, visible],
  )

  if (user && !mayManage) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
        <div
          className="mb-5 flex size-14 items-center justify-center rounded-lg bg-destructive/10 text-destructive"
          aria-hidden="true"
        >
          <Lock className="size-7" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Access Restricted</h2>
        <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
          Changing another employee&apos;s attendance is limited to HR and Administrator roles.
          To correct your own attendance, raise a regularisation request from Attendance Tracking.
        </p>
      </div>
    )
  }

  /* ---------------------------------------------------------------- export */

  const exportCsv = () => {
    downloadCsv(
      `attendance-${month}.csv`,
      ['Employee', 'Code', 'Department', 'Roster set', ...days.map((d) => `${d.day_of} ${d.weekday}`)],
      employees.map((employee) => [
        csvText(employee.name),
        // csvText on every code and time: an employee code like 0012 and a
        // time like 09:15 are both mangled into something else by a
        // spreadsheet that reads them as a number or a duration.
        csvText(employee.employee_code ?? ''),
        csvText(employee.department_name ?? ''),
        employee.has_roster ? 'Yes' : 'No',
        ...days.map((d) => {
          const cell = employee.days[d.date]
          if (!cell) return csvText('')
          if (cell.in || cell.out) return csvText(`${cell.in ?? '--'} - ${cell.out ?? '--'}`)
          return csvText(statusLabel(cell.status))
        }),
      ]),
    )
  }

  const printable = () => window.print()

  /* ---------------------------------------------------------------- render */

  return (
    <div className="mea-print-root flex w-full flex-col gap-6">
      {/*
        * Print rules, scoped to this screen.
        *
        * The grid is 31 columns of a table that normally scrolls inside its own
        * container; on paper there is nothing to scroll, so the container's
        * overflow has to be released and the sheet turned landscape or the last
        * three weeks fall off the edge. Backgrounds are forced because the cell
        * colours ARE the data - a grey "non-working" and a red "absent" are
        * indistinguishable once a printer drops the fills.
        */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          .mea-print-root { gap: 0.75rem; }
          .mea-print-root .overflow-x-auto { overflow: visible !important; }
          .mea-print-root table { font-size: 8pt; }
          .mea-print-root th, .mea-print-root td { page-break-inside: avoid; }
          .mea-print-root [class*="sticky"] { position: static !important; }
          .mea-print-root * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <GtgPageHeader
        title="Manage Employee Attendance"
        description="Correct an employee's punch times, fill in a day that was never recorded, and see who changed what. Every change is kept with its reason."
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={isLoading}>
              <RefreshCw className={cn('mr-2 size-4', isLoading && 'animate-spin')} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={employees.length === 0}>
              <Download className="mr-2 size-4" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={printable} disabled={employees.length === 0}>
              <Printer className="mr-2 size-4" />
              Print
            </Button>
          </div>
        }
      />

      {/* Three tabs: the month, the hours that define it, and who changed what. */}
      <div className="flex gap-1 border-b border-border print:hidden" role="tablist">
        {([
          { id: 'grid' as const, label: 'Attendance grid', icon: CalendarClock },
          { id: 'hours' as const, label: 'Office hours', icon: Clock },
          { id: 'history' as const, label: 'Change history', icon: History },
        ]).map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            onClick={() => setTab(entry.id)}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              tab === entry.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <entry.icon className="size-4" />
            {entry.label}
          </button>
        ))}
      </div>

      {/* Order: error, then loading, then empty, then data - the same order every
          screen in this module uses, so a failure is never hidden behind a
          spinner that never resolves. */}
      {error && (
        <Alert variant="destructive" className="print:hidden">
          <AlertTriangle className="size-4" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={() => setError(null)}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {notice && (
        <Alert className="border-emerald-500/40 bg-emerald-500/10 print:hidden">
          <Check className="size-4 text-emerald-600" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span className="text-emerald-800 dark:text-emerald-200">{notice}</span>
            <Button variant="ghost" size="sm" onClick={() => setNotice(null)}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {tab === 'grid' ? (
        <>
          <GridFilters
            month={month}
            setMonth={setMonth}
            departmentId={departmentId}
            setDepartmentId={setDepartmentId}
            departments={departments}
            search={search}
            setSearch={setSearch}
            perPage={perPage}
            setPerPage={setPerPage}
          />

          {/* The 88%, stated on the screen that can fix it. */}
          {!isLoading && meta.without_roster > 0 && (
            <Alert className="border-amber-500/40 bg-amber-500/10">
              <AlertTriangle className="size-4 text-amber-600" />
              <AlertDescription className="text-amber-900 dark:text-amber-200">
                <strong>
                  {meta.without_roster} of {employees.length} employees shown have no working days set.
                </strong>{' '}
                Their days read &ldquo;No roster&rdquo; rather than present or absent, because nothing
                records which days they are expected to work. Until a roster is set, lateness and
                absence cannot be calculated for them &mdash; and the other attendance screens each
                guess differently.
              </AlertDescription>
            </Alert>
          )}

          <Legend />

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-11 w-full" />
              ))}
            </div>
          ) : employees.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
              <CalendarClock className="mx-auto mb-4 size-10 text-muted-foreground" aria-hidden="true" />
              <h3 className="text-base font-semibold text-foreground">No employees to show</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                {search
                  ? `Nothing matches "${search}" in ${monthLabel}.`
                  : departmentId !== 'all'
                    ? `No active employees in this department for ${monthLabel}.`
                    : `No active employees found for ${monthLabel}.`}
              </p>
            </div>
          ) : (
            <>
              <BulkBar
                days={days}
                employees={employees}
                selected={effective}
                isSaving={isSaving}
                onClear={() => setSelected([])}
                onApply={async (date, times, reason) => {
                  const { failed } = await correctMany(
                    effective.map((userId) => ({ userId, day: date, ...times, reason })),
                  )
                  if (failed === 0) setSelected([])
                }}
              />
              <MonthGrid
                days={days}
                employees={employees}
                selected={effective}
                onToggle={(userId) =>
                  setSelected((current) =>
                    current.includes(userId)
                      ? current.filter((entry) => entry !== userId)
                      : [...current, userId],
                  )
                }
                onToggleAll={() =>
                  setSelected((current) =>
                    effective.length === employees.length
                      ? []
                      : employees.map((employee) => employee.user_id),
                  )
                }
                onPick={(employee, date, cell) => setEditing({ employee, date, cell })}
              />

              {/*
                * The approver queue, in the same screen.
                *
                * Reused rather than rebuilt - this is the component Attendance
                * Tracking already uses, so approving here and approving there
                * cannot drift. Approving applies the correction to the
                * attendance row, and onDecided refreshes the grid, so the
                * corrected cell appears without a second trip.
                *
                * It renders NOTHING when the caller lacks approve_leave in
                * hrms_leave_role_permissions - which is a different authority
                * from this screen's admin/hr gate, and deliberately so: who may
                * correct a day and who may approve somebody's request for a
                * correction are separate decisions. The server decides, and the
                * note below says so rather than leaving an absent panel to read
                * as a bug.
                */}
              <div className="print:hidden">
                <RegularisationQueue onDecided={() => void refresh({ quiet: true })} />
              </div>
            </>
          )}

          {!isLoading && employees.length > 0 && (
            <Pager page={page} setPage={setPage} meta={meta} />
          )}
        </>
      ) : tab === 'hours' ? (
        <OfficeHoursTab />
      ) : (
        <ChangeHistory
          monthLabel={monthLabel}
          month={month}
          setMonth={setMonth}
          rows={edits}
          isLoading={editsLoading}
          error={editsError}
          onRetry={() => void loadEdits()}
        />
      )}

      {editing && (
        <CorrectionDialog
          employee={editing.employee}
          date={editing.date}
          cell={editing.cell}
          isSaving={isSaving}
          onClose={() => setEditing(null)}
          onSubmit={async (payload) => {
            const ok = await correct({ userId: editing.employee.user_id, day: editing.date, ...payload })
            if (ok) setEditing(null)
          }}
        />
      )}
    </div>
  )
}

/* ========================================================================== */
/* Status vocabulary                                                          */
/* ========================================================================== */

/**
 * The words on the screen, and the colours.
 *
 * `unset` is the one that matters. It is not a styling choice - it is the
 * difference between "nine absences" and "nobody recorded which days this
 * person works", and the module's two other attendance screens currently
 * answer that question differently from each other.
 */
function statusLabel(status: AttendanceGridStatus | string): string {
  // Falls back to the raw value rather than throwing. The server's vocabulary
  // can grow - `recorded` was added to it late in this phase - and an unknown
  // status should show itself, not render `undefined` in the grid and crash the
  // dialog on `.toLowerCase()` of nothing.
  return STATUS_LABEL[status as AttendanceGridStatus] ?? status
}

const STATUS_LABEL: Record<AttendanceGridStatus, string> = {
  present: 'Present',
  incomplete: 'No punch out',
  recorded: 'Recorded',
  absent: 'Absent',
  weekend: 'Non-working',
  unset: 'No roster',
  upcoming: 'Upcoming',
}

const STATUS_CLASS: Record<AttendanceGridStatus, string> = {
  present: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
  incomplete: 'bg-amber-500/20 text-amber-900 dark:text-amber-200',
  recorded: 'bg-sky-500/15 text-sky-800 dark:text-sky-200',
  absent: 'bg-rose-500/15 text-rose-800 dark:text-rose-200',
  weekend: 'bg-muted text-muted-foreground',
  unset: 'bg-violet-500/15 text-violet-800 dark:text-violet-200',
  upcoming: 'bg-transparent text-muted-foreground/50',
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-card px-4 py-2.5 text-xs">
      {(Object.keys(STATUS_LABEL) as AttendanceGridStatus[]).map((status) => (
        <span key={status} className="flex items-center gap-1.5">
          <span
            className={cn('inline-block size-3 rounded border border-border', STATUS_CLASS[status])}
            aria-hidden="true"
          />
          <span className="text-muted-foreground">{statusLabel(status)}</span>
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <Pencil className="size-3 text-primary" aria-hidden="true" />
        <span className="text-muted-foreground">Changed by HR</span>
      </span>
    </div>
  )
}

/* ========================================================================== */
/* Filters                                                                    */
/* ========================================================================== */

function GridFilters({
  month, setMonth, departmentId, setDepartmentId, departments, search, setSearch, perPage, setPerPage,
}: {
  month: string
  setMonth: (value: string) => void
  departmentId: string
  setDepartmentId: (value: string) => void
  departments: Array<{ value: string; label: string }>
  search: string
  setSearch: (value: string) => void
  perPage: number
  setPerPage: (value: number) => void
}) {
  return (
    <div className="grid gap-4 rounded-xl border border-border bg-card p-4 print:hidden sm:grid-cols-2 lg:grid-cols-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mea-month">Month</Label>
        <MonthPicker id="mea-month" value={month} onChange={setMonth} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mea-department">Department</Label>
        <Select
          id="mea-department"
          value={departmentId}
          onChange={setDepartmentId}
          options={[{ value: 'all', label: 'All departments' }, ...departments]}
          placeholder="All departments"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mea-search">Find an employee</Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="mea-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name or employee code"
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mea-per-page">Rows per page</Label>
        <Select
          id="mea-per-page"
          value={String(perPage)}
          onChange={(value) => setPerPage(Number(value))}
          options={[
            { value: '10', label: '10 employees' },
            { value: '25', label: '25 employees' },
            { value: '50', label: '50 employees' },
            { value: '100', label: '100 employees' },
          ]}
        />
      </div>
    </div>
  )
}

/* ========================================================================== */
/* The grid                                                                   */
/* ========================================================================== */

/**
 * Employees down, days across, the name column frozen.
 *
 * The scroll lives on this container, not on the page: a 31-day row is wider
 * than any screen, and letting the body scroll sideways would take the filters
 * and the heading with it.
 */
function MonthGrid({
  days,
  employees,
  selected,
  onToggle,
  onToggleAll,
  onPick,
}: {
  days: Array<{ date: string; day_of: number; weekday: string; is_future: boolean }>
  employees: AttendanceGridEmployee[]
  selected: number[]
  onToggle: (userId: number) => void
  onToggleAll: () => void
  onPick: (employee: AttendanceGridEmployee, date: string, cell: AttendanceGridCell) => void
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-20 min-w-[240px] border-b border-r border-border bg-card px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              <span className="flex items-center gap-2">
                <Checkbox
                  checked={employees.length > 0 && selected.length === employees.length}
                  indeterminate={selected.length > 0 && selected.length < employees.length}
                  onCheckedChange={onToggleAll}
                  aria-label="Select every employee on this page"
                  className="print:hidden"
                />
                Employee
              </span>
            </th>
            {days.map((day) => (
              <th
                key={day.date}
                scope="col"
                className={cn(
                  'border-b border-border bg-card px-1 py-2 text-center text-xs font-semibold',
                  // Saturday and Sunday read differently at a glance. Not a
                  // roster claim - the roster is per employee and per cell.
                  (day.weekday === 'Sat' || day.weekday === 'Sun')
                    ? 'text-muted-foreground'
                    : 'text-foreground',
                )}
              >
                <span className="block tabular-nums">{day.day_of}</span>
                <span className="block text-[10px] font-normal text-muted-foreground">{day.weekday}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.user_id} className="group">
              <th
                scope="row"
                className={cn(
                  'sticky left-0 z-10 border-b border-r border-border px-4 py-2 text-left align-middle font-normal',
                  selected.includes(employee.user_id) ? 'bg-primary/10' : 'bg-card group-hover:bg-muted/40',
                )}
              >
                <span className="flex items-start gap-2">
                  <Checkbox
                    checked={selected.includes(employee.user_id)}
                    onCheckedChange={() => onToggle(employee.user_id)}
                    aria-label={`Select ${employee.name}`}
                    className="mt-0.5 print:hidden"
                  />
                  <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground">{employee.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {employee.employee_code ? `${employee.employee_code} · ` : ''}
                  {employee.department_name ?? 'No department'}
                </span>
                {!employee.has_roster && (
                  <span className="mt-0.5 inline-block rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-800 dark:text-violet-200">
                    No roster set
                  </span>
                )}
                  </span>
                </span>
              </th>

              {days.map((day) => {
                const cell = employee.days[day.date]
                if (!cell) {
                  return <td key={day.date} className="border-b border-border px-1 py-2" />
                }

                return (
                  <td key={day.date} className="border-b border-border p-0.5 text-center">
                    <button
                      type="button"
                      onClick={() => onPick(employee, day.date, cell)}
                      title={cellTitle(employee, day.date, cell)}
                      aria-label={cellTitle(employee, day.date, cell)}
                      className={cn(
                        'relative flex h-10 w-full min-w-[46px] flex-col items-center justify-center rounded transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        'hover:ring-2 hover:ring-primary/50',
                        STATUS_CLASS[cell.status],
                      )}
                    >
                      {cell.in || cell.out ? (
                        <>
                          <span className="text-[10px] font-medium leading-tight tabular-nums">
                            {cell.in ?? '--:--'}
                          </span>
                          <span className="text-[10px] leading-tight tabular-nums opacity-80">
                            {cell.out ?? '--:--'}
                          </span>
                        </>
                      ) : (
                        <span className="text-[10px] font-medium leading-tight">
                          {SHORT_STATUS[cell.status] ?? '?'}
                        </span>
                      )}

                      {cell.edited && (
                        <Pencil
                          className="absolute right-0.5 top-0.5 size-2.5 text-primary"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Two or three characters, because a cell is 46px wide. */
const SHORT_STATUS: Record<AttendanceGridStatus, string> = {
  present: 'P',
  incomplete: 'IN',
  recorded: 'R',
  absent: 'A',
  weekend: '—',
  unset: '?',
  upcoming: '',
}

function cellTitle(employee: AttendanceGridEmployee, date: string, cell: AttendanceGridCell) {
  const parts = [
    employee.name,
    new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }),
    statusLabel(cell.status),
  ]

  if (cell.in || cell.out) parts.push(`In ${cell.in ?? '--'}, out ${cell.out ?? '--'}`)
  if (cell.duration) parts.push(`Worked ${cell.duration}`)
  if (cell.shift_in && cell.shift_out) parts.push(`Expected ${cell.shift_in}-${cell.shift_out}`)
  if (cell.edited) parts.push('Changed by HR')

  return parts.join(' · ')
}

/* ========================================================================== */
/* Bulk action                                                                */
/* ========================================================================== */

/**
 * One day, the same times, several employees.
 *
 * ── WHAT THIS DELIBERATELY DOES NOT OFFER ───────────────────────────────────
 *
 * "Mark absent" and "mark holiday" are the obvious companions to this and
 * neither is here, because neither is a thing this system can write:
 *
 *   - An absence is the ABSENCE of an attendance row, so marking somebody
 *     absent means deleting theirs. The only method that claimed to do that
 *     (HrmsController::destroy) is an empty stub that replies "Deleted
 *     Successfully" having done nothing, and the correction endpoint has no
 *     delete path on purpose - a bulk delete of pay-bearing rows is not
 *     something to add alongside a new screen.
 *   - A holiday comes from the holiday calendar, not from an attendance row.
 *     Writing "holiday" into attendance would put the same fact in two places
 *     and let them disagree.
 *
 * A button labelled "mark absent" that quietly did something else would be
 * worse than its absence, so this does the one thing it can do honestly: set
 * the same punch times on one day for everybody ticked.
 *
 * ── ALLSETTLED, AND THE COUNT IS REPORTED ───────────────────────────────────
 *
 * The hook uses Promise.allSettled and reports "changed 18 of 20". A bulk write
 * over a tenant boundary or onto a future day is refused per employee, and
 * claiming a clean sweep when two were refused is the kind of thing that gets
 * found at payroll.
 */
function BulkBar({
  days, employees, selected, isSaving, onClear, onApply,
}: {
  days: Array<{ date: string; day_of: number; weekday: string; is_future: boolean }>
  employees: AttendanceGridEmployee[]
  selected: number[]
  isSaving: boolean
  onClear: () => void
  onApply: (
    date: string,
    times: { inTime?: string; outTime?: string },
    reason: string,
  ) => Promise<void>
}) {
  // Only days that have happened. The server refuses a future date, and
  // offering one here turns a correct refusal into a confusing one.
  const selectable = days.filter((day) => !day.is_future)

  const [date, setDate] = React.useState('')
  const [inTime, setInTime] = React.useState('09:00')
  const [outTime, setOutTime] = React.useState('18:00')
  const [reason, setReason] = React.useState('')
  const [localError, setLocalError] = React.useState<string | null>(null)

  if (selected.length === 0) {
    return (
      <p className="text-xs text-muted-foreground print:hidden">
        Tick employees to set the same punch times on one day for several people at once, or click
        any cell to change a single day.
      </p>
    )
  }

  const names = employees
    .filter((employee) => selected.includes(employee.user_id))
    .map((employee) => employee.name)

  const submit = async () => {
    setLocalError(null)

    if (!date) {
      setLocalError('Pick the day to change.')
      return
    }
    if (!inTime && !outTime) {
      setLocalError('Give a punch in time, a punch out time, or both.')
      return
    }
    if (inTime && outTime && outTime <= inTime) {
      setLocalError('The punch out time has to be after the punch in time.')
      return
    }
    if (!reason.trim()) {
      setLocalError('A reason is required — it is recorded against every employee changed.')
      return
    }

    await onApply(
      date,
      { ...(inTime ? { inTime } : {}), ...(outTime ? { outTime } : {}) },
      reason.trim(),
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Users className="size-4" aria-hidden="true" />
          {selected.length} {selected.length === 1 ? 'employee' : 'employees'} selected
          <span className="max-w-[28rem] truncate font-normal text-muted-foreground" title={names.join(', ')}>
            — {names.slice(0, 3).join(', ')}
            {names.length > 3 ? ` and ${names.length - 3} more` : ''}
          </span>
        </span>
        <Button variant="ghost" size="sm" onClick={onClear} disabled={isSaving}>
          Clear selection
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mea-bulk-day">Day</Label>
          <Select
            id="mea-bulk-day"
            value={date}
            onChange={setDate}
            options={selectable.map((day) => ({
              value: day.date,
              label: `${day.day_of} ${day.weekday}`,
            }))}
            placeholder={selectable.length === 0 ? 'No days yet this month' : 'Pick a day'}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mea-bulk-in">Punch in</Label>
          <Input
            id="mea-bulk-in"
            type="time"
            value={inTime}
            onChange={(event) => setInTime(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mea-bulk-out">Punch out</Label>
          <Input
            id="mea-bulk-out"
            type="time"
            value={outTime}
            onChange={(event) => setOutTime(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mea-bulk-reason">
            Reason <span className="text-destructive">*</span>
          </Label>
          <Input
            id="mea-bulk-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Badge reader was down"
            maxLength={255}
          />
        </div>
      </div>

      {localError && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{localError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void submit()} disabled={isSaving}>
          {isSaving
            ? 'Changing…'
            : `Set these times for ${selected.length} ${selected.length === 1 ? 'employee' : 'employees'}`}
        </Button>
        <span className="text-xs text-muted-foreground">
          Each employee is changed separately and recorded with your name and this reason. If some
          cannot be changed, the rest still are and you are told how many.
        </span>
      </div>
    </div>
  )
}

/* ========================================================================== */
/* Pager                                                                      */
/* ========================================================================== */

function Pager({
  page, setPage, meta,
}: {
  page: number
  setPage: (value: number) => void
  meta: { page: number; per_page: number; total: number; total_pages: number }
}) {
  const from = (meta.page - 1) * meta.per_page + 1
  const to = Math.min(meta.page * meta.per_page, meta.total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <p className="text-sm text-muted-foreground tabular-nums">
        Showing <strong className="text-foreground">{from}</strong>&ndash;
        <strong className="text-foreground">{to}</strong> of{' '}
        <strong className="text-foreground">{meta.total}</strong> employees
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={meta.page <= 1}
        >
          <ChevronLeft className="mr-1 size-4" />
          Previous
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums">
          Page {meta.page} of {Math.max(1, meta.total_pages)}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage(page + 1)}
          disabled={meta.page >= meta.total_pages}
        >
          Next
          <ChevronRight className="ml-1 size-4" />
        </Button>
      </div>
    </div>
  )
}

/* ========================================================================== */
/* The correction dialog                                                      */
/* ========================================================================== */

/**
 * One employee, one day.
 *
 * Leaving a time blank leaves that side of the day alone, which is the common
 * case: filling in a punch-out that was never recorded without restating the
 * punch-in. The dialog says that in words rather than relying on the user to
 * infer it from an empty box.
 */
function CorrectionDialog({
  employee, date, cell, isSaving, onClose, onSubmit,
}: {
  employee: AttendanceGridEmployee
  date: string
  cell: AttendanceGridCell
  isSaving: boolean
  onClose: () => void
  onSubmit: (payload: { inTime?: string; outTime?: string; reason: string }) => Promise<void>
}) {
  const [inTime, setInTime] = React.useState(cell.in ?? '')
  const [outTime, setOutTime] = React.useState(cell.out ?? '')
  const [reason, setReason] = React.useState('')
  const [localError, setLocalError] = React.useState<string | null>(null)

  const isFuture = cell.status === 'upcoming'
  const creating = !cell.in && !cell.out

  const prettyDate = new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const submit = async () => {
    setLocalError(null)

    if (!inTime && !outTime) {
      setLocalError('Give a punch in time, a punch out time, or both.')
      return
    }
    if (!reason.trim()) {
      setLocalError('A reason is required — it is what makes this change answerable later.')
      return
    }
    if (inTime && outTime && outTime <= inTime) {
      // The server stores a null duration rather than a negative one, so this
      // would save and then read as "no hours worked" with no explanation.
      setLocalError('The punch out time has to be after the punch in time.')
      return
    }

    await onSubmit({
      ...(inTime ? { inTime } : {}),
      ...(outTime ? { outTime } : {}),
      reason: reason.trim(),
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {creating ? <CalendarPlus className="size-5" /> : <Pencil className="size-5" />}
            {creating ? 'Add a missing day' : 'Correct this day'}
          </DialogTitle>
          <DialogDescription>
            {employee.name} &middot; {prettyDate}
          </DialogDescription>
        </DialogHeader>

        {isFuture ? (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>
              This day has not happened yet, so there are no hours to record. The server refuses a
              future date for the same reason.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-col gap-4">
            {/* What is there now, so the change is made against something real
                rather than from memory. */}
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
              <span className="font-medium text-foreground">Currently: </span>
              {cell.in || cell.out ? (
                <span className="tabular-nums text-muted-foreground">
                  in {cell.in ?? '—'}, out {cell.out ?? '—'}
                  {cell.duration ? ` (${cell.duration} worked)` : ''}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  nothing recorded — {statusLabel(cell.status).toLowerCase()}
                </span>
              )}
              {cell.shift_in && cell.shift_out && (
                <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
                  Rostered hours for this day: {cell.shift_in}&ndash;{cell.shift_out}
                </span>
              )}
              {!employee.has_roster && (
                <span className="mt-0.5 block text-xs text-violet-700 dark:text-violet-300">
                  This employee has no working days set, so lateness cannot be calculated for them.
                </span>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mea-in">Punch in</Label>
                <Input
                  id="mea-in"
                  type="time"
                  value={inTime}
                  onChange={(event) => setInTime(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mea-out">Punch out</Label>
                <Input
                  id="mea-out"
                  type="time"
                  value={outTime}
                  onChange={(event) => setOutTime(event.target.value)}
                />
              </div>
            </div>

            <p className="-mt-2 text-xs text-muted-foreground">
              Leave a box empty to keep what is already recorded on that side of the day.
            </p>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mea-reason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="mea-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Forgot to punch out; badge reader was down; approved by manager…"
                rows={2}
                maxLength={255}
              />
            </div>

            {/* Said where it is true, not discovered at payroll. */}
            <Alert className="border-amber-500/40 bg-amber-500/10">
              <AlertTriangle className="size-4 text-amber-600" />
              <AlertDescription className="text-xs text-amber-900 dark:text-amber-200">
                Attendance feeds payroll. Changing these times changes the hours recorded for this
                day and can change this employee&apos;s payable days. The change is kept with your
                name, the original times and this reason.
              </AlertDescription>
            </Alert>

            {localError && (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertDescription>{localError}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={isSaving || isFuture}>
            {isSaving ? 'Saving…' : creating ? 'Add this day' : 'Save correction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ========================================================================== */
/* The change history                                                         */
/* ========================================================================== */

/**
 * Who changed whose day, from what, to what, and why.
 *
 * The platform event log holds the same facts and is the system of record, but
 * it is keyed by entity and time; answering "who changed Priya's Tuesday" from
 * it is a query nobody on the HR desk will write. This is that question, asked
 * the way the screen asks it.
 */
function ChangeHistory({
  monthLabel, month, setMonth, rows, isLoading, error, onRetry,
}: {
  monthLabel: string
  month: string
  setMonth: (value: string) => void
  rows: Array<{
    id: number
    day: string
    employee_name: string | null
    changed_by_name: string | null
    before_in_time: string | null
    before_out_time: string | null
    after_in_time: string | null
    after_out_time: string | null
    created_row: number
    reason: string
    source: string
    created_at: string
  }>
  isLoading: boolean
  error: string | null
  onRetry: () => void
}) {
  const time = (value: string | null) => (value ? value.slice(11, 16) : null)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mea-history-month">Month</Label>
          <MonthPicker id="mea-history-month" value={month} onChange={setMonth} />
        </div>
        <p className="pb-2 text-sm text-muted-foreground">
          Changes to days in {monthLabel}, newest first.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={onRetry}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <History className="mx-auto mb-4 size-10 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-base font-semibold text-foreground">No changes in {monthLabel}</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Nobody has corrected an attendance day in this month. Corrections made from the
            attendance grid, and employee regularisation requests that were approved, both appear
            here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-4 py-2.5 font-semibold">Employee</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Day</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Was</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Changed to</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Reason</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">By</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-2.5 font-medium text-foreground">
                    {row.employee_name?.trim() || `Employee #${row.id}`}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted-foreground">
                    {new Date(`${row.day}T00:00:00`).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted-foreground">
                    {row.created_row
                      ? <em className="not-italic text-xs">day did not exist</em>
                      : `${time(row.before_in_time) ?? '—'} / ${time(row.before_out_time) ?? '—'}`}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium tabular-nums text-foreground">
                    {time(row.after_in_time) ?? '—'} / {time(row.after_out_time) ?? '—'}
                  </td>
                  <td className="max-w-[260px] px-4 py-2.5 text-muted-foreground">
                    <span className="block truncate" title={row.reason}>{row.reason}</span>
                    {row.source !== 'admin' && (
                      <span className="text-xs text-muted-foreground/70">via {row.source}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                    <span className="block">{row.changed_by_name?.trim() || 'Unknown'}</span>
                    <span className="block text-xs text-muted-foreground/70 tabular-nums">
                      {row.created_at?.slice(0, 16).replace('T', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
