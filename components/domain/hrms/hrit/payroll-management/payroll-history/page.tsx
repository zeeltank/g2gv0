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
import { usePayrollHistory } from '@/hooks/use-payroll-history'
import { usePayslipDownload } from '@/hooks/use-payslip-download'

/**
 * Employee Payroll History.
 *
 * F-169. POST /employee-payroll-history was implemented and had no caller. It
 * is what an employee needs at loan time and what HR needs in a pay dispute:
 * one financial year of payslips with the per-component breakdown. My HR shows
 * only month, gross and net - no components at all.
 *
 * The screen's one hard rule is that it must not lose money. A filed payslip
 * stores amounts against whatever pay-head ids existed when it was generated;
 * the server's `header` map only names heads that are ACTIVE today. Rendering
 * just the named columns would drop deactivated, soft-deleted and - on one
 * payslip in this deployment - another organisation's heads, which between them
 * account for 75,000 of an 81,300 payslip. Every head that appears is shown,
 * and the ones that cannot be named say so.
 */
export default function PayrollHistoryPage() {
  const {
    financialYear,
    setFinancialYear,
    employeeId,
    setEmployeeId,
    years,
    employeeOptions,
    heads,
    people,
    loading,
    error,
    loadedFor,
    unnamedHeads,
    unreconciled,
    apply,
    retry,
  } = usePayrollHistory()

  const money = React.useMemo(
    () => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [],
  )

  const dirty =
    loadedFor !== null && (loadedFor.year !== financialYear || loadedFor.employeeId !== employeeId)

  const exportCsv = () => {
    if (!loadedFor) return
    downloadCsv(
      `payroll-history-${loadedFor.year}.csv`,
      ['Employee No', 'Employee', 'Month', 'Year', ...heads.map((h) => h.label), 'Days', 'Deductions', 'Net Pay'],
      people.flatMap((person) =>
        person.months.map((month) => [
          person.employeeNo,
          person.employeeName,
          month.month,
          month.year,
          ...heads.map((head) => (month.amounts[head.id] ?? 0).toFixed(2)),
          month.totalDays.toFixed(2),
          month.totalDeduction.toFixed(2),
          month.totalPayment.toFixed(2),
        ]),
      ),
    )
  }

  const hasRows = people.some((person) => person.months.length > 0)

  /*
   * F-209. This screen already holds every month of an employee's pay and
   * the components behind it, and offered no way to get the document that
   * states them. One row, one payslip.
   */
  const payslip = usePayslipDownload()

  return (
    <PayrollPageShell
      title="Employee Payroll History"
      description="One financial year of payslips per employee, broken down by pay head."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={loading || !hasRows}>
            <Download className="mr-2 size-4" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            disabled={loading || !hasRows}
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
            <Label htmlFor="history-year" required>
              Financial Year
            </Label>
            <Select
              id="history-year"
              value={financialYear}
              onChange={setFinancialYear}
              options={years.map((item) => ({ value: item, label: item }))}
              placeholder="Select a year"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="history-employee">Employee</Label>
            <Select
              id="history-employee"
              value={employeeId}
              onChange={setEmployeeId}
              options={employeeOptions}
            />
          </div>

          <div className="flex items-end">
            <Button onClick={apply} disabled={loading || !financialYear} className="w-full sm:w-auto">
              <RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading…' : 'Apply'}
            </Button>
          </div>
        </div>

        {dirty && (
          <p className="mt-3 text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{loadedFor?.year}</span>. Press
            Apply to load {financialYear}.
          </p>
        )}
      </div>

      {/* Its own line: a payslip that would not build says nothing about
          whether the year's history loaded. */}
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
          <h2 className="text-lg font-semibold text-foreground">Unable to load the payroll history</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{error}</p>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
            This is a failure to load, not a statement that nothing was paid.
          </p>
          <Button variant="outline" size="sm" className="mt-5" onClick={retry}>
            <RefreshCw className="mr-2 size-4" />
            Try again
          </Button>
        </div>
      ) : loading ? (
        <PayrollTableSkeleton rows={6} />
      ) : !hasRows ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <h2 className="text-lg font-semibold text-foreground">
            No payslips for {loadedFor?.year ?? 'the selected year'}
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            A financial year runs April to March. Payslips appear here once payroll has been
            generated for a month in that range.
          </p>
        </div>
      ) : (
        <>
          {unnamedHeads > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                <span className="font-semibold">
                  {unnamedHeads} pay {unnamedHeads === 1 ? 'head is' : 'heads are'} shown as
                  &ldquo;Head #&rdquo; because {unnamedHeads === 1 ? 'it is' : 'they are'} no longer
                  in this organisation&rsquo;s active list.
                </span>{' '}
                The amounts are real and were paid, so they are included in the totals rather than
                hidden. A head can look like this because it was deactivated, deleted, or belongs to
                a different organisation. Check these against the payslip before relying on the
                breakdown.
              </AlertDescription>
            </Alert>
          )}

          {unreconciled > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                <span className="font-semibold">
                  {unreconciled} {unreconciled === 1 ? 'month does' : 'months do'} not add up.
                </span>{' '}
                The components plus deductions do not equal the net pay that was filed. The filed
                net pay is what was actually paid; the breakdown below is what the payslip recorded
                against each head. They are shown side by side rather than reconciled silently.
              </AlertDescription>
            </Alert>
          )}

          {people.map((person) => (
            <div key={`${person.employeeNo}-${person.employeeName}`} className="space-y-2">
              <h2 className="px-1 text-base font-semibold text-foreground">
                {person.employeeName}
                {person.employeeNo && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {person.employeeNo}
                  </span>
                )}
              </h2>

              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left">
                      <th scope="col" className="px-4 py-3 font-semibold">Month</th>
                      {heads.map((head) => (
                        <th key={head.id} scope="col" className="px-4 py-3 text-right font-semibold">
                          {head.unnamed ? (
                            <span className="inline-flex items-center gap-1 text-destructive">
                              <AlertTriangle className="size-3.5" aria-hidden="true" />
                              {head.label}
                            </span>
                          ) : (
                            head.label
                          )}
                        </th>
                      ))}
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Days</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Deductions</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Net Pay</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Payslip</th>
                    </tr>
                  </thead>
                  <tbody>
                    {person.months.map((month) => {
                      const reconciles =
                        Math.abs(month.componentSum - month.totalDeduction - month.totalPayment) <= 0.5
                      return (
                        <tr
                          key={`${month.month}-${month.year}`}
                          className="border-b border-border/60 last:border-0"
                        >
                          <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                            {month.month} {month.year}
                          </td>
                          {heads.map((head) => (
                            <td key={head.id} className="px-4 py-3 text-right tabular-nums">
                              {month.amounts[head.id] === undefined
                                ? '—'
                                : money.format(month.amounts[head.id])}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-right tabular-nums">{month.totalDays}</td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {money.format(month.totalDeduction)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-semibold tabular-nums ${
                              reconciles ? '' : 'text-destructive'
                            }`}
                            title={
                              reconciles
                                ? undefined
                                : `Components ${money.format(month.componentSum)} − deductions ${money.format(
                                    month.totalDeduction,
                                  )} = ${money.format(
                                    month.componentSum - month.totalDeduction,
                                  )}, but ${money.format(month.totalPayment)} was filed.`
                            }
                          >
                            {money.format(month.totalPayment)}
                            {!reconciles && <span aria-hidden="true"> *</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              aria-label={`Download the ${month.month} ${month.year} payslip for ${person.employeeName}`}
                              title={`Download the ${month.month} ${month.year} payslip`}
                              disabled={payslip.busy || !person.employeeId}
                              onClick={() =>
                                payslip.download({
                                  employeeId: person.employeeId,
                                  employeeName: person.employeeName,
                                  employeeNo: person.employeeNo,
                                  month: month.month,
                                  year: month.year,
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
                      <td className="px-4 py-3 font-semibold">
                        Year total — {person.months.length}{' '}
                        {person.months.length === 1 ? 'month' : 'months'}
                      </td>
                      {heads.map((head) => (
                        <td key={head.id} className="px-4 py-3 text-right font-semibold tabular-nums">
                          {money.format(
                            person.months.reduce((sum, m) => sum + (m.amounts[head.id] ?? 0), 0),
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {money.format(person.months.reduce((sum, m) => sum + m.totalDeduction, 0))}
                      </td>
                      <td className="px-4 py-3 text-right text-base font-bold tabular-nums">
                        {money.format(person.months.reduce((sum, m) => sum + m.totalPayment, 0))}
                      </td>
                      {/* the Payslip column */}
                      <td className="px-4 py-3" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}

          {unreconciled > 0 && (
            <p className="px-1 text-xs text-muted-foreground">
              * The components on this row do not add up to the net pay that was filed. Hover the
              figure for the arithmetic.
            </p>
          )}
        </>
      )}

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