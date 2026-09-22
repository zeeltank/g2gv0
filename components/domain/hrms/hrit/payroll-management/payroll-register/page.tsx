'use client'

import * as React from 'react'
import { AlertTriangle, Download, FileText, Printer, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  PayrollPageShell,
  PayrollTableSkeleton,
  downloadCsv,
} from '@/domain/hrms/hrit/payroll-management/shared/payroll-shell'
import { usePayrollRegister } from '@/hooks/use-payroll-reports'
import { usePayslipDownload } from '@/hooks/use-payslip-download'

/**
 * Payroll Register.
 *
 * F-172. POST /payroll-report was implemented and had no caller. It is the only
 * thing in the product that puts the DAY COUNTS next to the PAY: for each
 * employee it walks the month against attendance, leave and the holiday
 * calendar and returns lwp_days, leave_days and absent_days alongside the
 * payslip. Nothing else in the frontend joins payroll to attendance, so "why is
 * this person's pay low" had no single place to be answered.
 *
 * Use it before releasing payment, not after.
 */
export default function PayrollRegisterPage() {
  const {
    month,
    year,
    setMonth,
    setYear,
    months,
    years,
    loading,
    error,
    rows,
    loadedFor,
    totals,
    flagged,
    apply,
    retry,
  } = usePayrollRegister()

  const money = React.useMemo(
    () => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [],
  )

  const dirty = loadedFor !== null && (loadedFor.month !== month || loadedFor.year !== year)

  /*
   * F-209. This is the screen HR reads a month's pay on, and until now it
   * offered CSV and print but no payslip - the one document an employee
   * ever asks for. The row already knows the employee and the period.
   */
  const payslip = usePayslipDownload()

  const exportCsv = () => {
    if (!loadedFor) return
    downloadCsv(
      `payroll-register-${loadedFor.month}-${loadedFor.year}.csv`,
      ['Employee No', 'Name', 'Paid Days', 'LWP Days', 'Leave Days', 'Absent Days', 'Deductions', 'Net Pay', 'Paid By'],
      rows.map((row) => [
        row.employeeNo,
        row.name,
        row.totalDays,
        row.lwpDays,
        row.leaveDays,
        row.absentDays,
        row.deduction.toFixed(2),
        row.netPay.toFixed(2),
        row.receivedBy,
      ]),
    )
  }

  return (
    <PayrollPageShell
      title="Payroll Register"
      description="The month's payslips with the day counts reconciled against attendance, leave and holidays."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={loading || rows.length === 0}>
            <Download className="mr-2 size-4" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            disabled={loading || rows.length === 0}
            className="print:hidden"
          >
            <Printer className="mr-2 size-4" />
            Print
          </Button>
        </>
      }
    >
      <div className="rounded-xl border border-border bg-card p-4 print:hidden">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="register-month" required>
              Month
            </Label>
            <Select
              id="register-month"
              value={month}
              onChange={setMonth}
              options={months.map((item) => ({ value: item, label: item }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="register-year" required>
              Year
            </Label>
            {/*
              Labelled "2025-2026" and VALUED "2025", exactly as the Blade
              dropdown has always been. Helpers::getPairYears() is a keyed map
              and the key is what the query wants; posting the label back gives
              Carbon "Trailing data" and a 500, not an empty register.
            */}
            <Select id="register-year" value={year} onChange={setYear} options={years} />
          </div>

          <div className="flex items-end">
            <Button onClick={apply} disabled={loading} className="w-full sm:w-auto">
              <RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading…' : 'Apply'}
            </Button>
          </div>
        </div>

        {dirty && (
          <p className="mt-3 text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{loadedFor?.month} {loadedFor?.year}</span>.
            Press Apply to load {month} {year}.
          </p>
        )}
      </div>

      {/* A payslip that would not build says nothing about whether the register
          loaded, so it gets its own line rather than replacing the table. */}
      {payslip.error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{payslip.error}</span>
            <Button variant="ghost" size="sm" onClick={payslip.clearError}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {error ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-destructive/40 bg-destructive/5 px-6 py-12 text-center">
          <AlertTriangle className="mb-4 size-10 text-destructive" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-foreground">Unable to load the register</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{error}</p>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
            This is a failure to load, not a statement that payroll was not run.
          </p>
          <Button variant="outline" size="sm" className="mt-5" onClick={retry}>
            <RefreshCw className="mr-2 size-4" />
            Try again
          </Button>
        </div>
      ) : loading ? (
        <PayrollTableSkeleton rows={6} />
      ) : rows.length === 0 ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <h2 className="text-lg font-semibold text-foreground">
            No payroll was generated for {loadedFor?.month} {loadedFor?.year}
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Generate the month on the Monthly Payroll screen, then come back here to check it before
            releasing payment.
          </p>
        </div>
      ) : (
        <>
          {flagged > 0 && (
            <Alert>
              <AlertDescription>
                <span className="font-semibold">
                  {flagged} of {rows.length}{' '}
                  {flagged === 1 ? 'employee has' : 'employees have'} unpaid or absent days this
                  month.
                </span>{' '}
                Those rows are highlighted below. This is the reconciliation, not an error — check
                them against the attendance before releasing payment.
              </AlertDescription>
            </Alert>
          )}

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <caption className="hidden p-4 text-left text-base font-semibold print:table-caption">
                Payroll Register — {loadedFor?.month} {loadedFor?.year}
              </caption>
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th scope="col" className="px-4 py-3 font-semibold">Employee No</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Name</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Paid Days</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">LWP</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Leave</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Absent</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Deductions</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Net Pay</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Payslip</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const reduced = row.lwpDays > 0 || row.absentDays > 0
                  return (
                    <tr
                      key={row.key}
                      className={`border-b border-border/60 last:border-0 ${
                        reduced ? 'bg-warning/5' : ''
                      }`}
                    >
                      <td className="px-4 py-3 tabular-nums">{row.employeeNo || '—'}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.totalDays}</td>
                      <td
                        className={`px-4 py-3 text-right tabular-nums ${
                          row.lwpDays > 0 ? 'font-semibold text-destructive' : 'text-muted-foreground'
                        }`}
                      >
                        {row.lwpDays}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {row.leaveDays}
                      </td>
                      <td
                        className={`px-4 py-3 text-right tabular-nums ${
                          row.absentDays > 0 ? 'font-semibold text-destructive' : 'text-muted-foreground'
                        }`}
                      >
                        {row.absentDays}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {money.format(row.deduction)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {money.format(row.netPay)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          aria-label={`Download payslip for ${row.name}`}
                          title={`Download payslip for ${row.name}`}
                          disabled={payslip.busy}
                          onClick={() =>
                            payslip.download({
                              employeeId: row.employeeId,
                              employeeName: row.name,
                              employeeNo: row.employeeNo,
                              month: loadedFor?.month ?? '',
                              year: loadedFor?.year ?? '',
                            })
                          }
                        >
                          <FileText className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30">
                  <td colSpan={3} className="px-4 py-3 font-semibold">
                    {rows.length} {rows.length === 1 ? 'employee' : 'employees'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{totals.lwp}</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{totals.absent}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {money.format(totals.deduction)}
                  </td>
                  <td className="px-4 py-3 text-right text-base font-bold tabular-nums">
                    {money.format(totals.net)}
                  </td>
                  {/* the Payslip column */}
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {/* F-99. Print emits the register, not the application shell. */}
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
    </PayrollPageShell>
  )
}
