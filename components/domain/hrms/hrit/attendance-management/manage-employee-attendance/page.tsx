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
  Info,
  Users,
  History,
  Lock,
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
import { EmployeeAttendancePanel } from '@/domain/hrms/hrit/attendance-management/shared/employee-attendance-panel'
import { AttendanceCorrectionDialog } from '@/domain/hrms/hrit/attendance-management/shared/attendance-correction-dialog'
import { ChangeHistory } from './change-history'
import {
  STATUS_HELP,
  STATUS_LABEL,
  statusClass,
  statusLabel,
  type AttendanceDayStatus,
} from '@/domain/hrms/hrit/attendance-management/shared/attendance-day-status'
import { MonthGrid } from './month-grid'
import type { TileDensity } from '@/domain/hrms/hrit/attendance-management/shared/attendance-day-tile'
import { OfficeHoursTab } from './office-hours'
import { useAttendanceAdmin } from '@/hooks/use-attendance-admin'
import { useOfficeHoursRequests } from '@/hooks/use-office-hours-requests'
import { useAuth } from '@/hooks/use-auth'
import { HR_ADMIN_ROLES } from '@/types/role'
import { cn } from '@/lib/utils'
import type {
  AttendanceGridCell,
  AttendanceGridDay,
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
/** localStorage key for the grid density. Namespaced, so it cannot collide. */
const DENSITY_KEY = 'g2g.mea.density'

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
    edits, editsLoading, editsError, editsMeta, editsLoadedAt, loadEdits,
    historyMonth, setHistoryMonth, historyMonthLabel,
    historyUserId, historyDay, focusHistory, clearHistoryFilters,
    liveHistory, setLiveHistory,
  } = useAttendanceAdmin()

  /*
   * Only for the tab-bar badge below - a count, nothing else. The actual
   * approve/reject queue (`OfficeHoursProposals`, inside the Office hours tab
   * itself) owns its own instance of this hook, because it needs the full
   * row list and `decide()`. Two instances of the same read-only GET is a
   * smaller cost than threading that state through a tab nobody has opened
   * yet - and for anyone who is not an approver, the endpoint 403s, `rows`
   * stays empty, and the badge simply never appears (same "the server
   * decides who sees this" idiom the queue itself uses).
   */
  const officeHoursRequests = useOfficeHoursRequests()
  const pendingOfficeHoursCount = officeHoursRequests.rows.length

  const [tab, setTab] = React.useState<'grid' | 'history' | 'hours'>('grid')
  const [selected, setSelected] = React.useState<number[]>([])
  const [editing, setEditing] = React.useState<{
    employee: AttendanceGridEmployee
    date: string
    cell: AttendanceGridCell
  } | null>(null)

  /**
   * The employee whose month is open in the drill-down panel.
   *
   * Carries the display fields rather than a user id alone, because the panel
   * is also opened from the change history - where the grid row for that
   * employee may not be on the current page, so there is nothing to look up.
   */
  const [viewing, setViewing] = React.useState<{
    user_id: number
    name: string
    employee_code: string | null
    department_name: string | null
    has_roster?: boolean
    month: string
  } | null>(null)

  /**
   * Bumped after a correction, so the open panel refetches.
   *
   * `correct()` reloads the grid; the panel reads a different endpoint and has
   * no way to know. One number is enough and cannot get out of step.
   */
  /**
   * How tall a day cell is. Persisted, because it is a per-person preference.
   *
   * `MonthGrid` and `AttendanceDayTile` have supported three densities since
   * they were extracted, and nothing let anybody change it - so every user got
   * `compact` whether 31 x 28px suited their eyes or not.
   *
   * Compact stays the default: 31 columns is the whole point of the matrix, and
   * at `times` density a month does not fit on a laptop without horizontal
   * scrolling. The other two exist for the people who would rather scroll than
   * squint.
   *
   * READ INSIDE try/catch, AND SO IS THE WRITE. localStorage throws outright in
   * a few real contexts - Safari private browsing, a browser set to block site
   * data, an embedded webview - and an unguarded read here would take the whole
   * attendance desk down with it, to remember a row height.
   */
  const [density, setDensity] = React.useState<TileDensity>(() => {
    try {
      const stored = window.localStorage.getItem(DENSITY_KEY)
      return stored === 'comfortable' || stored === 'times' || stored === 'roomy'
        ? stored
        : 'compact'
    } catch {
      return 'compact'
    }
  })

  const changeDensity = React.useCallback((value: TileDensity) => {
    setDensity(value)
    try {
      window.localStorage.setItem(DENSITY_KEY, value)
    } catch {
      // Not remembering it is a smaller problem than not rendering.
    }
  }, [])

  const [correctionNonce, setCorrectionNonce] = React.useState(0)

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

  /**
   * Refresh whatever is actually on screen.
   *
   * The header button is shared by three tabs; sending it to the grid
   * regardless meant two of them had a Refresh button that did nothing. Office
   * hours owns its own refresh inside its tab, so this dispatches the two the
   * page holds state for.
   */
  const refreshActiveTab = React.useCallback(async () => {
    if (tab === 'history') {
      await loadEdits()
      return
    }
    await refresh()
  }, [tab, loadEdits, refresh])

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
    <div className="mea-print-root flex w-full flex-col gap-4">
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
            {/*
              * TAB-AWARE, AND THIS WAS A REAL BUG.
              *
              * It called `refresh` - which is loadGrid - on every tab. On the
              * history tab it fetched the grid and nothing visible happened,
              * and its spinner was wired to the grid's loading state too, so
              * the button did not even appear to do anything. That is very
              * likely most of what "change history is not working" meant.
              */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refreshActiveTab()}
              disabled={tab === 'history' ? editsLoading : isLoading}
            >
              <RefreshCw
                className={cn(
                  'mr-2 size-4',
                  (tab === 'history' ? editsLoading : isLoading) && 'animate-spin',
                )}
              />
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
          { id: 'grid' as const, label: 'Attendance grid', icon: CalendarClock, count: 0 },
          { id: 'hours' as const, label: 'Office hours', icon: Clock, count: pendingOfficeHoursCount },
          { id: 'history' as const, label: 'Change history', icon: History, count: 0 },
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
            {/*
              * Why this exists: the approval queue below renders nothing at
              * all when it is empty (F-91's "hiding is not access control"
              * idiom - a role check here would just drift from the server's).
              * That is correct for the panel, but it meant the ONLY way to
              * learn a request was waiting was to already be looking at this
              * tab - there was nothing pulling anyone there. The count is
              * read from the same endpoint the panel itself uses, so it can
              * never claim a request exists that the panel would not also
              * show.
              */}
            {entry.count > 0 && (
              <span
                className="flex min-w-[1.125rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none tabular-nums text-primary-foreground"
                aria-label={`${entry.count} waiting for your decision`}
              >
                {entry.count > 99 ? '99+' : entry.count}
              </span>
            )}
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
          {/*
            * The toolbar cluster - filters, the roster banner, and the key -
            * kept at a tighter gap than the page's own gap-4. These three used
            * to be full-height cards stacked with the page's spacing between
            * each, which on its own ran past 400px before a single employee
            * row was visible. Grouping them tightens that without touching
            * how the grid itself, the bulk bar or the approver queue below
            * are spaced.
            */}
          <div className="flex flex-col gap-2.5">
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
              <Alert className="border-amber-500/40 bg-amber-500/10 py-2.5">
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

            <Legend
              employees={employees}
              days={days}
              density={density}
              onDensityChange={changeDensity}
            />
          </div>

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
                density={density}
                onOpenEmployee={(employee) =>
                  setViewing({
                    user_id: employee.user_id,
                    name: employee.name,
                    employee_code: employee.employee_code,
                    department_name: employee.department_name,
                    has_roster: employee.has_roster,
                    month,
                  })
                }
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
        <OfficeHoursTab onProposalDecided={() => void officeHoursRequests.refresh()} />
      ) : (
        <ChangeHistory
          monthLabel={historyMonthLabel}
          month={historyMonth}
          setMonth={setHistoryMonth}
          rows={edits}
          meta={editsMeta}
          loadedAt={editsLoadedAt}
          isLoading={editsLoading}
          error={editsError}
          onRetry={() => void loadEdits()}
          filteredUserId={historyUserId}
          filteredDay={historyDay}
          filteredName={
            historyUserId !== null
              ? (edits.find((row) => row.user_id === historyUserId)?.employee_name
                  ?? employees.find((e) => e.user_id === historyUserId)?.name
                  ?? null)
              : null
          }
          onClearFilters={clearHistoryFilters}
          live={liveHistory}
          onLiveChange={setLiveHistory}
          onOpenEmployee={(userId, day) => {
            const row = employees.find((e) => e.user_id === userId)
            setViewing({
              user_id: userId,
              name: row?.name ?? edits.find((r) => r.user_id === userId)?.employee_name ?? 'Employee',
              employee_code: row?.employee_code ?? null,
              department_name: row?.department_name ?? null,
              has_roster: row?.has_roster,
              month: day ? day.slice(0, 7) : historyMonth,
            })
          }}
        />
      )}

      {/*
        * The drill-down panel.
        *
        * `key={viewing.user_id}` is deliberate: the panel owns its own month,
        * and keying it means opening a different employee starts from the
        * grid's month rather than inheriting wherever you had paged to for the
        * last one. Its own docblock says so.
        */}
      {viewing && (
        <EmployeeAttendancePanel
          key={viewing.user_id}
          open
          onOpenChange={(open) => !open && setViewing(null)}
          userId={viewing.user_id}
          employeeName={viewing.name}
          employeeCode={viewing.employee_code}
          departmentName={viewing.department_name}
          hasRoster={viewing.has_roster}
          initialMonth={viewing.month}
          canCorrect={mayManage}
          reloadKey={correctionNonce}
          onCorrect={(date, cell) => {
            // The grid row may not be on this page - the panel can be opened
            // from the history - so a synthetic row carries what the dialog
            // needs without pretending to be a full grid employee.
            setEditing({
              employee: {
                user_id: viewing.user_id,
                name: viewing.name,
                employee_code: viewing.employee_code,
                department_id: null,
                department_name: viewing.department_name,
                has_roster: viewing.has_roster ?? true,
                days: {},
              },
              date,
              cell: {
                status: cell.status as AttendanceGridCell['status'],
                in: cell.in,
                out: cell.out,
                duration: cell.duration,
                work_mode: cell.work_mode ?? null,
                edited: cell.edited ?? false,
                shift_in: cell.shift_in,
                shift_out: cell.shift_out,
              },
            })
          }}
          onOpenHistory={(date) => {
            focusHistory(viewing.user_id, date)
            setViewing(null)
            setTab('history')
          }}
        />
      )}

      {/*
        * Rendered as a SIBLING of the panel, not inside it.
        *
        * Both Sheet and Dialog sit at z-50, so DOM order decides which is on
        * top. A dialog rendered inside the Sheet would be trapped beneath it.
        */}
      {editing && (
        <AttendanceCorrectionDialog
          employeeName={editing.employee.name}
          hasRoster={editing.employee.has_roster}
          date={editing.date}
          cell={editing.cell}
          isSaving={isSaving}
          onClose={() => setEditing(null)}
          onSubmit={async (payload) => {
            const ok = await correct({ userId: editing.employee.user_id, day: editing.date, ...payload })
            if (ok) {
              setEditing(null)
              setCorrectionNonce((value) => value + 1)
            }
          }}
        />
      )}
    </div>
  )
}

/* ========================================================================== */
/* Status vocabulary                                                          */
/* ========================================================================== */

const DENSITIES: Array<{ value: TileDensity; label: string }> = [
  { value: 'compact', label: 'Compact' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'times', label: 'Times' },
]

/**
 * This month's counts, the density switch, and the key - in one slim row.
 *
 * ── THE COUNTS ARE THE POINT ────────────────────────────────────────────────
 *
 * Nothing on this screen totalled anything. An HR user could look at 1,550
 * cells and not learn how many absences were in them without counting by eye -
 * so the single largest legibility win here is not a nicer cell, it is a
 * number beside each colour.
 *
 * ── THE SWATCH KEY MOVED BEHIND A BUTTON ────────────────────────────────────
 *
 * It used to sit permanently on screen as its own row - eleven swatches plus
 * a density switch, which wraps to two lines on anything narrower than a wide
 * desktop. Most of what it explains is read once and then remembered; the
 * count chips below it are what gets looked at every time the page opens. So
 * the swatches, and the one-sentence explanation each used to carry only in a
 * `title=` attribute, now live in a popover behind "Legend" - reachable by
 * keyboard and screen reader exactly as before, just not paid for in height
 * on every visit.
 *
 * ── THE CHIPS ARE A MEASUREMENT OF WHAT WAS OBSERVED ────────────────────────
 *
 * Built from the statuses actually present in the cells, not the full known
 * vocabulary - so a status this frontend has never heard of still appears,
 * labelled by `statusLabel()`, which is total and falls back to the raw name.
 * The row scrolls sideways rather than wrapping, so the row height is fixed
 * whether this month has three statuses on screen or all ten.
 */
function Legend({
  employees, days, density, onDensityChange,
}: {
  employees: AttendanceGridEmployee[]
  days: AttendanceGridDay[]
  density: TileDensity
  onDensityChange: (value: TileDensity) => void
}) {
  /** Status -> how many cells on screen hold it. Observed, not assumed. */
  const counts = React.useMemo(() => {
    const tally = new Map<string, number>()

    for (const employee of employees) {
      for (const day of days) {
        const cell = employee.days[day.date]
        if (!cell) continue
        const status = String(cell.status ?? 'unknown')
        tally.set(status, (tally.get(status) ?? 0) + 1)
      }
    }

    // Biggest first - the thing worth noticing is usually the big number.
    return Array.from(tally.entries()).sort((a, b) => b[1] - a[1])
  }, [employees, days])

  /** Cells an HR user has corrected. Its own count, not a status. */
  const editedCount = React.useMemo(() => {
    let total = 0
    for (const employee of employees) {
      for (const day of days) {
        if (employee.days[day.date]?.edited) total += 1
      }
    }
    return total
  }, [employees, days])

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card py-1.5 pl-2 pr-3 text-xs">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground print:hidden"
          >
            <Info className="size-3.5" aria-hidden="true" />
            Legend
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80">
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            What each colour means
          </p>
          <div className="flex max-h-80 flex-col gap-2.5 overflow-y-auto">
            {(Object.keys(STATUS_LABEL) as AttendanceDayStatus[]).map((status) => (
              <div key={status} className="flex items-start gap-2.5">
                <span
                  className={cn('mt-0.5 inline-block size-3 shrink-0 rounded border border-border', statusClass(status))}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground">{statusLabel(status)}</p>
                  <p className="text-xs leading-snug text-muted-foreground">{STATUS_HELP[status]}</p>
                </div>
              </div>
            ))}
            <div className="flex items-start gap-2.5 border-t border-border pt-2.5">
              <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">Changed by HR</p>
                <p className="text-xs leading-snug text-muted-foreground">
                  This day&apos;s punch times were corrected by an admin or HR user - the small dot in
                  the corner of the cell.
                </p>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <div className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />

      {/* What is on screen this month - a fixed-height strip that scrolls
          sideways instead of wrapping, so the row never grows taller. */}
      {counts.length > 0 ? (
        <div className="g2g-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
          <span className="shrink-0 text-muted-foreground">This month:</span>
          {counts.map(([status, count]) => (
            <span
              key={status}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2 py-0.5"
              title={STATUS_HELP[status as AttendanceDayStatus] ?? undefined}
            >
              <span
                className={cn(
                  'inline-block size-2 rounded-full border border-border',
                  statusClass(status as AttendanceDayStatus),
                )}
                aria-hidden="true"
              />
              <span className="font-medium tabular-nums text-foreground">{count}</span>
              <span className="text-muted-foreground">
                {statusLabel(status as AttendanceDayStatus)}
              </span>
            </span>
          ))}
          {editedCount > 0 && (
            <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 px-2 py-0.5">
              <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
              <span className="font-medium tabular-nums text-foreground">{editedCount}</span>
              <span className="text-muted-foreground">changed by HR</span>
            </span>
          )}
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {/*
        * print:hidden - a density switch on paper is noise. The grid itself
        * prints, and the print block forces its own layout anyway.
        */}
      <div className="ml-auto flex shrink-0 items-center gap-1 print:hidden">
        <span className="text-muted-foreground">Size</span>
        {DENSITIES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onDensityChange(option.value)}
            aria-pressed={density === option.value}
            className={cn(
              'rounded px-2 py-0.5 transition-colors',
              density === option.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
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
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card px-3 py-2.5 print:hidden">
      <div className="flex w-40 flex-col gap-1">
        <Label htmlFor="mea-month" className="text-xs font-medium text-muted-foreground">
          Month
        </Label>
        <MonthPicker id="mea-month" value={month} onChange={setMonth} className="h-8 text-xs" />
      </div>

      <div className="flex w-44 flex-col gap-1">
        <Label htmlFor="mea-department" className="text-xs font-medium text-muted-foreground">
          Department
        </Label>
        <Select
          id="mea-department"
          size="sm"
          value={departmentId}
          onChange={setDepartmentId}
          options={[{ value: 'all', label: 'All departments' }, ...departments]}
          placeholder="All departments"
        />
      </div>

      <div className="flex min-w-[200px] flex-1 flex-col gap-1">
        <Label htmlFor="mea-search" className="text-xs font-medium text-muted-foreground">
          Find an employee
        </Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="mea-search"
            size="sm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name or employee code"
            className="pl-8"
          />
        </div>
      </div>

      <div className="flex w-36 flex-col gap-1">
        <Label htmlFor="mea-per-page" className="text-xs font-medium text-muted-foreground">
          Rows per page
        </Label>
        <Select
          id="mea-per-page"
          size="sm"
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
/* The change history                                                         */
