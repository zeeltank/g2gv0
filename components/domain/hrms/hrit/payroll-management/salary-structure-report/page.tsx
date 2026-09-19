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
import { useSalaryStructureReport } from '@/hooks/use-payroll-reports'

/**
 * Salary Structure Report.
 *
 * Every employee's structure for a year, as one grid — the read-only view the
 * Salary Structure screen could not give you, because that screen is an editor
 * scoped to a department and exports a client-side CSV instead.
 *
 * It could not have been built before F-160: showSalaryStructureReport read
 * session() with no type=API branch, so an API caller resolved to tenant null,
 * every `where sub_institute_id = null` matched nothing, and the report came
 * back empty however it was filtered.
 *
 * Head naming follows the F-169 rule: `headers` names only ACTIVE pay heads,
 * and a stored structure can reference heads since deactivated or deleted. The
 * columns are the union, and what cannot be named says so rather than being
 * dropped — on this deployment five of eight live structures point at a
 * soft-deleted head, which is exactly what HR needs to see.
 */
export default function SalaryStructureReportPage() {
  const {
    year,
    setYear,
    years,
    loading,
    error,
    heads,
    rows,
    loadedFor,
    unnamedHeads,
    apply,
    retry,
  } = useSalaryStructureReport()

  const money = React.useMemo(
    () => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [],
  )

  // The server's years are a keyed map (value 2025, label "2025-2026"), so the
  // hook hands them over already paired rather than flattened.
  const yearOptions = React.useMemo(
    () => [{ value: '0', label: 'All years' }, ...years],
    [years],
  )

  const dirty = loadedFor !== null && loadedFor !== year
  const shownYear = loadedFor === '0' ? 'all years' : loadedFor

  const exportCsv = () => {
    if (loadedFor === null) return
    downloadCsv(
      `salary-structures-${loadedFor === '0' ? 'all-years' : loadedFor}.csv`,
      ['Employee No', 'Employee', 'Department', 'Year', ...heads.map((h) => h.label), 'Total'],
      rows.map((row) => [
        row.employeeNo,
        row.name,
        row.department,
        row.year,
        ...heads.map((head) => (row.amounts[head.id] ?? 0).toFixed(2)),
        row.total.toFixed(2),
      ]),
    )
  }

  return (
    <PayrollPageShell
      title="Salary Structure Report"
      description="Every employee's structure for a year, component by component."
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
            <Label htmlFor="ssr-year">Year</Label>
            <Select id="ssr-year" value={year} onChange={setYear} options={yearOptions} />
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
            Showing <span className="font-semibold text-foreground">{shownYear}</span>. Press Apply to
            load {year === '0' ? 'all years' : year}.
          </p>
        )}
      </div>

      {error ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-destructive/40 bg-destructive/5 px-6 py-12 text-center">
          <AlertTriangle className="mb-4 size-10 text-destructive" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-foreground">Unable to load the structures</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{error}</p>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
            This is a failure to load, not a statement that no structures exist.
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
            No salary structures for {shownYear}
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Structures are created per employee, per year on the Salary Structure screen. Until one
            exists, payroll has nothing to calculate from.
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
                A structure pointing at a deactivated or deleted head still carries an amount, and
                payroll still reads it. Re-point those structures at a live head on the Salary
                Structure screen.
              </AlertDescription>
            </Alert>
          )}

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full border-collapse text-sm">
              <caption className="hidden p-4 text-left text-base font-semibold print:table-caption">
                Salary Structures — {shownYear}
              </caption>
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th scope="col" className="px-4 py-3 font-semibold">Employee No</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Employee</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Department</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Year</th>
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
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 tabular-nums">{row.employeeNo || '—'}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.department || '—'}</td>
                    <td className="px-4 py-3 tabular-nums">{row.year}</td>
                    {heads.map((head) => (
                      <td key={head.id} className="px-4 py-3 text-right tabular-nums">
                        {row.amounts[head.id] === undefined ? '—' : money.format(row.amounts[head.id])}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {money.format(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30">
                  <td colSpan={4} className="px-4 py-3 font-semibold">
                    {rows.length} {rows.length === 1 ? 'structure' : 'structures'}
                  </td>
                  {heads.map((head) => (
                    <td key={head.id} className="px-4 py-3 text-right font-semibold tabular-nums">
                      {money.format(rows.reduce((sum, row) => sum + (row.amounts[head.id] ?? 0), 0))}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right text-base font-bold tabular-nums">
                    {money.format(rows.reduce((sum, row) => sum + row.total, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
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
