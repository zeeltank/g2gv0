'use client'

import * as React from 'react'
import { AlertTriangle, Download, Printer, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  PayrollPageShell,
  PayrollTableSkeleton,
  downloadCsv,
} from '@/domain/hrms/hrit/payroll-management/shared/payroll-shell'
import { useBankWiseReport } from '@/hooks/use-bank-wise-report'

/**
 * Bank-wise Payment Advice.
 *
 * F-166. POST /payroll-bank-wise-report has been implemented, routed, gated and
 * returning clean JSON all along, with no caller anywhere in the frontend. It
 * is the one payroll report that produces something finance cannot get any
 * other way - the month's paid employees with the account details needed to
 * move the money - and it was being re-keyed by hand.
 *
 * Two things this screen is careful about, because it is about money:
 *
 *   - A failed fetch never renders as an empty month. "Nobody was paid in
 *     August" is a claim, and it must not be produced by a 500.
 *   - A row with no account number or no IFSC is called out rather than
 *     exported silently. It cannot go in a transfer file, and a blank cell in
 *     a downloaded CSV reads as a rendering fault, not as missing data.
 */
export default function PayrollBankReportPage() {
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
    totalNet,
    unpayable,
    loadedFor,
    apply,
    retry,
  } = useBankWiseReport()

  const money = React.useMemo(
    () => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [],
  )

  // Draft vs applied: changing a dropdown must not silently refetch, and the
  // heading must say which month the rows on screen belong to - not which month
  // the dropdown happens to show.
  const dirty = loadedFor !== null && (loadedFor.month !== month || loadedFor.year !== year)

  const exportCsv = () => {
    if (!loadedFor) return
    downloadCsv(
      `payment-advice-${loadedFor.month}-${loadedFor.year}.csv`,
      ['Employee No', 'Name', 'Department', 'Bank', 'Account Number', 'IFSC', 'Net Pay', 'Payable'],
      rows.map((row) => [
        row.employeeNo,
        row.name,
        row.department,
        row.bankName,
        // Forced to text so a spreadsheet does not turn a long account number
        // into scientific notation - which would silently corrupt a transfer file.
        row.accountNo ? `="${row.accountNo}"` : '',
        row.ifsc,
        row.netPay.toFixed(2),
        row.payable ? 'Yes' : 'Missing bank details',
      ]),
    )
  }

  return (
    <PayrollPageShell
      title="Bank-wise Payment Advice"
      description="Everyone paid in the selected month, with the account details needed to release the payment."
      actions={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={loading || rows.length === 0}
          >
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
      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-4 print:hidden">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="advice-month" required>
              Month
            </Label>
            <Select
              id="advice-month"
              value={month}
              onChange={setMonth}
              options={months.map((item) => ({ value: item, label: item }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="advice-year" required>
              Year
            </Label>
            <Select
              id="advice-year"
              value={year}
              onChange={setYear}
              options={years.map((item) => ({ value: item, label: item }))}
            />
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

      {/*
        The error branch REPLACES the table. It does not sit above a table
        reading "no records", which is how the same failure reads as "nobody was
        paid" - the defect this module already carries on two other screens.
      */}
      {error ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-destructive/40 bg-destructive/5 px-6 py-12 text-center">
          <AlertTriangle className="mb-4 size-10 text-destructive" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-foreground">Unable to load the payment advice</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{error}</p>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
            This is a failure to load, not a statement that nobody was paid.
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
            This advice lists employees who were actually paid. Generate the month on the Monthly
            Payroll screen first, then come back here to release the payment.
          </p>
        </div>
      ) : (
        <>
          {unpayable > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                <span className="font-semibold">
                  {unpayable} of {rows.length} {unpayable === 1 ? 'employee is' : 'employees are'} missing
                  bank details.
                </span>{' '}
                Those lines cannot be paid by transfer. Add the account number and IFSC on the
                employee&rsquo;s record, then reload this advice.
              </AlertDescription>
            </Alert>
          )}

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <caption className="hidden p-4 text-left text-base font-semibold print:table-caption">
                Bank-wise Payment Advice — {loadedFor?.month} {loadedFor?.year}
              </caption>
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th scope="col" className="px-4 py-3 font-semibold">Employee No</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Name</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Department</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Bank</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Account Number</th>
                  <th scope="col" className="px-4 py-3 font-semibold">IFSC</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Net Pay</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={`${row.employeeId}-${row.employeeNo}`}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="px-4 py-3 tabular-nums">{row.employeeNo || '—'}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.department || '—'}</td>
                    <td className="px-4 py-3">{row.bankName || <MissingCell />}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {row.accountNo || <MissingCell />}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{row.ifsc || <MissingCell />}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {money.format(row.netPay)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30">
                  <td colSpan={6} className="px-4 py-3 text-right font-semibold">
                    Total for {loadedFor?.month} {loadedFor?.year} — {rows.length}{' '}
                    {rows.length === 1 ? 'employee' : 'employees'}
                  </td>
                  <td className="px-4 py-3 text-right text-base font-bold tabular-nums">
                    {money.format(totalNet)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {/*
        F-99. A Print button with no print stylesheet emits the whole
        application - sidebar, filter panel and every button - instead of the
        advice. These rules are what make Print produce a document finance can
        hand over.
      */}
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
            font-size: 11pt;
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

/** A cell the transfer file cannot use, said plainly rather than left blank. */
function MissingCell() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
      <AlertTriangle className="size-3.5" aria-hidden="true" />
      Missing
    </span>
  )
}