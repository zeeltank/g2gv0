'use client'

import * as React from 'react'
import { AlertTriangle, Download, Printer, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { StatusBadge } from '@/components/ui/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { GtgPageHeader } from '@/components/shell/gtg-page-header'
import { downloadCsv } from '@/domain/hrms/hrit/payroll-management/shared/payroll-shell'
import { useMonthlyAttendance } from '@/hooks/use-monthly-attendance'
import { useAuth } from '@/hooks/use-auth'
import { HR_ADMIN_ROLES, ROLE_GROUPS } from '@/types/role'
import type { MonthlyAttendanceDay } from '@/services/hrms'

/**
 * Monthly Attendance Report.
 *
 * F-171. GET /api/employee-attendance-monthly-report is the most complete
 * attendance endpoint in the module and had no caller anywhere: a nine-field
 * summary plus a row per date with status, punch times, working hours,
 * lateness, the rostered shift, leave (with its reason) and holiday names.
 *
 * What it adds over the reports that already exist: those are day COUNTS over a
 * range and cannot tell a weekend from an absence. This is resolved per day
 * against the roster and the holiday calendar, so "9 absences" becomes nine
 * dates you can point at - which is what an attendance dispute actually needs.
 *
 * Access: the server allows HR/admin/executive/auditor to read anyone, and
 * everybody else only themselves (F-159). There is no role gate in this
 * component on purpose - a React component is a hint, never the gate (F-91).
 */
export default function MonthlyAttendanceReportPage() {
  const {
    month,
    setMonth,
    employeeId,
    setEmployeeId,
    employees,
    employeesError,
    months,
    loading,
    error,
    summary,
    days,
    employeeName,
    loadedFor,
    apply,
    retry,
  } = useMonthlyAttendance()

  const { user } = useAuth()

  /*
   * F-159 again, from the other side. The server lets HR/admin/executive/auditor
   * read anyone and everybody else only themselves. Offering an employee a list
   * of their colleagues would be offering them 22 choices, 21 of which return
   * 403 - a picker that mostly produces refusals teaches people the screen is
   * broken.
   *
   * This is a HINT, not the gate. The server still decides, and if this list is
   * ever wrong the refusal arrives with its own explanation.
   */
  const canReadOthers = Boolean(
    user && [...HR_ADMIN_ROLES, ...ROLE_GROUPS.oversight].includes(user.role),
  )

  const employeeOptions = React.useMemo(() => {
    const visible = canReadOthers
      ? employees
      : employees.filter((employee) => String(employee.id) === String(user?.id ?? ''))

    return visible.map((employee) => ({
      value: String(employee.id),
      label: [employee.first_name, employee.middle_name, employee.last_name]
        .filter((part) => part && String(part).trim() !== '' && String(part).trim() !== '-')
        .join(' ')
        .trim() || `Employee ${employee.id}`,
    }))
  }, [employees, canReadOthers, user?.id])

  const monthLabel = months.find((item) => item.value === loadedFor?.month)?.label ?? loadedFor?.month

  const dirty =
    loadedFor !== null && (loadedFor.month !== month || loadedFor.employeeId !== employeeId)

  const exportCsv = () => {
    if (!loadedFor) return
    downloadCsv(
      `attendance-${employeeName || loadedFor.employeeId}-${loadedFor.month}.csv`,
      ['Date', 'Day', 'Status', 'Punch In', 'Punch Out', 'Working Hours', 'Late', 'Shift', 'Leave', 'Holiday'],
      days.map((day) => [
        day.date,
        day.day_name,
        statusLabel(day.status),
        day.punchin_time ?? '',
        day.punchout_time ?? '',
        day.working_hours ?? '',
        day.is_late ? 'Yes' : '',
        day.shift_time ?? '',
        day.leave?.type ?? '',
        day.holiday_name ?? '',
      ]),
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-full flex-col gap-4 sm:gap-5 md:gap-6">
      <GtgPageHeader
        title="Monthly Attendance Report"
        description="One employee, one month, day by day — with the roster and the holiday calendar already applied."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={loading || days.length === 0}>
              <Download className="mr-2 size-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              disabled={loading || days.length === 0}
              className="print:hidden"
            >
              <Printer className="mr-2 size-4" />
              Print
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-4 px-4 pb-4 sm:px-0 sm:pb-0 sm:gap-5 md:gap-6">
        <div className="rounded-xl border border-border bg-card p-4 print:hidden">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="mar-employee" required>
                Employee
              </Label>
              <Select
                id="mar-employee"
                value={employeeId}
                onChange={setEmployeeId}
                options={employeeOptions}
                placeholder={employeeOptions.length === 0 ? 'No employees available' : 'Select an employee'}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mar-month" required>
                Month
              </Label>
              <Select
                id="mar-month"
                value={month}
                onChange={setMonth}
                options={months}
              />
            </div>

            <div className="flex items-end">
              <Button onClick={apply} disabled={loading || !employeeId} className="w-full sm:w-auto">
                <RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Loading…' : 'Apply'}
              </Button>
            </div>
          </div>

          {dirty && (
            <p className="mt-3 text-xs text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{monthLabel}</span>. Press Apply
              to load the new selection.
            </p>
          )}

          {/* A failed picker fetch is not an organisation with no employees. */}
          {employeesError && (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>
                {employeesError} The list above may be incomplete — this is a failure to load it, not
                an empty organisation.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {error ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-destructive/40 bg-destructive/5 px-6 py-12 text-center">
            <AlertTriangle className="mb-4 size-10 text-destructive" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-foreground">Unable to load this month</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" className="mt-5" onClick={retry}>
              <RefreshCw className="mr-2 size-4" />
              Try again
            </Button>
          </div>
        ) : loading ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-80 w-full rounded-xl" />
          </>
        ) : days.length === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <h2 className="text-lg font-semibold text-foreground">Nothing recorded for this month</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Choose an employee and a month, then press Apply.
            </p>
          </div>
        ) : (
          <>
            {summary && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                <SummaryCard label="Working days" value={summary.working_days} />
                <SummaryCard label="Present" value={summary.present_days} tone="success" />
                <SummaryCard label="Absent" value={summary.absent_days} tone="destructive" />
                <SummaryCard label="Leave" value={summary.leave_days} />
                <SummaryCard label="Late" value={summary.late_days} tone="warning" />
                <SummaryCard label="Holidays" value={summary.holiday_days} />
                <SummaryCard label="Weekends" value={summary.weekend_days} />
                <SummaryCard label="Days in month" value={summary.total_days} />
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[840px] border-collapse text-sm">
                <caption className="hidden p-4 text-left text-base font-semibold print:table-caption">
                  {employeeName} — {monthLabel}
                </caption>
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Day</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Punch In</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Punch Out</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Working Hours</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Shift</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((day) => (
                    <tr key={day.date} className="border-b border-border/60 last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums">{day.date}</td>
                      <td className="px-4 py-3 text-muted-foreground">{day.day_name}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={statusLabel(day.status)} variant={statusVariant(day.status)} />
                          {day.is_late && <StatusBadge status="Late" variant="warning" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{day.punchin_time ?? '—'}</td>
                      <td className="px-4 py-3 tabular-nums">{day.punchout_time ?? '—'}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {day.working_hours ?? (
                          <span className="text-xs text-muted-foreground">
                            {day.status === 'incomplete' ? 'No punch-out' : '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {day.shift_time ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{note(day)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* F-99. Print emits the report, not the application shell. */}
      <style jsx global>{`
        @media print {
          body {
            background: #fff;
          }
          aside,
          nav,
          header,
          .print\\:hidden {
            display: none !important;
          }
          table {
            width: 100% !important;
            min-width: 0 !important;
            font-size: 10pt;
          }
          thead {
            display: table-header-group;
          }
          tr {
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'success' | 'destructive' | 'warning'
}) {
  const colour =
    tone === 'success'
      ? 'text-success'
      : tone === 'destructive'
        ? 'text-destructive'
        : tone === 'warning'
          ? 'text-warning'
          : 'text-foreground'

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${colour}`}>{value}</p>
    </div>
  )
}

function statusLabel(status: string) {
  switch (status) {
    case 'present':
      return 'Present'
    case 'absent':
      return 'Absent'
    case 'leave':
      return 'On Leave'
    case 'holiday':
      return 'Holiday'
    case 'weekend':
      return 'Weekly Off'
    case 'incomplete':
      return 'Incomplete'
    default:
      // Never invent a label for a status the server may add later.
      return status
  }
}

function statusVariant(status: string): 'success' | 'error' | 'warning' | 'inactive' {
  switch (status) {
    case 'present':
      return 'success'
    case 'absent':
      return 'error'
    case 'incomplete':
      return 'warning'
    default:
      // Holiday, weekend and leave are not achievements or failures, so they
      // get the neutral variant rather than a green or a red one.
      return 'inactive'
  }
}

/** The one thing that explains the row: the leave reason, or the holiday. */
function note(day: MonthlyAttendanceDay) {
  if (day.holiday_name) return day.holiday_name
  if (day.leave) {
    const parts = [day.leave.type, day.leave.reason].filter(
      (part) => part && String(part).trim() !== '',
    )
    return parts.length > 0 ? parts.join(' — ') : 'On leave'
  }
  return '—'
}
